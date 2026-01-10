const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
// const { google } = require('googleapis'); // 캘린더 미사용시 주석

const app = express();
const PORT = process.env.PORT || 3000;

const cron = require('node-cron'); // 스케줄러 모듈
const axios = require('axios'); // [NEW] HTTP 요청용

// === [설정] 카카오 개발자 센터 정보 입력 ===
// 실제 운영 시에는 process.env.KAKAO_KEY 등으로 관리하는 것이 보안상 좋습니다.
const KAKAO_REST_API_KEY = 'b93a072ab458557243baf45e12f2a011'; 
// Railway 배포 주소 + /oauth/kakao 경로 (예: https://내앱.up.railway.app/oauth/kakao)
const KAKAO_REDIRECT_URI = 'https://chogajipreservation-production.up.railway.app/oauth/kakao';

// === 데이터 경로 설정 ===
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data';
const fallbackPath = path.join(__dirname, 'data');
const actualDataPath = fs.existsSync(VOLUME_PATH) ? VOLUME_PATH : fallbackPath;
if (!fs.existsSync(actualDataPath)) fs.mkdirSync(actualDataPath, { recursive: true });

console.log(`📁 데이터 저장 경로: ${actualDataPath}`);

// === 파일 경로 정의 ===
const FINAL_DATA_FILE = path.join(actualDataPath, 'reservations.json');
const PREPAYMENT_FILE = path.join(actualDataPath, 'prepayments.json');
const KAKAO_TOKEN_FILE = path.join(actualDataPath, 'kakao_token.json'); // [NEW] 토큰 저장 파일

// 파일 초기화 확인
if (!fs.existsSync(FINAL_DATA_FILE)) fs.writeFileSync(FINAL_DATA_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(PREPAYMENT_FILE)) fs.writeFileSync(PREPAYMENT_FILE, JSON.stringify({ customers: {}, logs: [] }, null, 2));

// === 헬퍼 함수 ===
function readJson(file, defaultVal = []) {
    try {
        const content = fs.readFileSync(file, 'utf8');
        return content ? JSON.parse(content) : defaultVal;
    } catch (e) {
        console.error(`Read Error (${file}):`, e.message);
        return defaultVal;
    }
}

function writeJson(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error(`Write Error (${file}):`, e.message);
        return false;
    }
}

// 매장별 파일 경로
function getStaffFile(store) {
    return path.join(actualDataPath, store === 'yangeun' ? 'staff_yangeun.json' : 'staff.json');
}
function getLogFile(store) {
    return path.join(actualDataPath, store === 'yangeun' ? 'logs_yangeun.json' : 'logs.json');
}
function getAccountingFile(store) {
    return path.join(actualDataPath, store === 'yangeun' ? 'accounting_yangeun.json' : 'accounting_chogazip.json');
}

// 로그 기록 함수
function addLog(store, actor, action, target, details) {
    const logFile = getLogFile(store);
    let logs = readJson(logFile, []);
    // 파일이 깨져서 객체로 읽히는 경우 방지
    if (!Array.isArray(logs)) logs = [];
    
    logs.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        actor, action, target, details
    });
    if (logs.length > 1000) logs.pop();
    writeJson(logFile, logs);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =======================
// [API] 예약 시스템
// =======================
app.get('/api/reservations', (req, res) => {
    res.json({ success: true, data: readJson(FINAL_DATA_FILE, []) });
});

app.post('/api/reservations', (req, res) => {
    let reservations = readJson(FINAL_DATA_FILE, []);
    const newRes = { ...req.body, id: Date.now(), status: 'active' };
    reservations.push(newRes);
    if (writeJson(FINAL_DATA_FILE, reservations)) res.json({ success: true });
    else res.status(500).json({ success: false });
});

app.put('/api/reservations/:id', (req, res) => {
    let reservations = readJson(FINAL_DATA_FILE, []);
    const idx = reservations.findIndex(r => r.id == req.params.id);
    if (idx !== -1) {
        reservations[idx] = { ...reservations[idx], ...req.body };
        writeJson(FINAL_DATA_FILE, reservations);
        res.json({ success: true });
    } else res.status(404).json({ success: false });
});

app.delete('/api/reservations/:id', (req, res) => {
    let reservations = readJson(FINAL_DATA_FILE, []);
    reservations = reservations.filter(r => r.id != req.params.id);
    writeJson(FINAL_DATA_FILE, reservations);
    res.json({ success: true });
});

// =======================
// [API] 직원 관리 & 로그인
// =======================
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === 'admin1234!') res.json({ success: true, role: 'admin', name: '사장님' });
    else if (password === 'chogazip1234') res.json({ success: true, role: 'manager', name: '점장님' });
    else if (password === 'chrkwlv1234!') res.json({ success: true, role: 'viewer', name: '직원' });
    else res.status(401).json({ success: false });
});

app.get('/api/staff', (req, res) => {
    const store = req.query.store || 'chogazip';
    // 빈 파일일 경우 기본값 []
    const staffFile = getStaffFile(store);
    if (!fs.existsSync(staffFile)) fs.writeFileSync(staffFile, '[]');
    res.json({ success: true, data: readJson(staffFile, []) });
});

app.post('/api/staff', (req, res) => {
    const { staffList, actor, store } = req.body;
    const file = getStaffFile(store || 'chogazip');
    let staff = readJson(file, []);
    if (!Array.isArray(staff)) staff = [];

    const newStaff = staffList.map(s => ({ ...s, id: Date.now() + Math.floor(Math.random()*1000) }));
    staff.push(...newStaff);
    
    if (writeJson(file, staff)) {
        addLog(store, actor, '직원등록', `${newStaff.length}명`, '일괄등록');
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

app.put('/api/staff/:id', (req, res) => {
    const { updates, actor, store } = req.body;
    const file = getStaffFile(store || 'chogazip');
    let staff = readJson(file, []);
    const idx = staff.findIndex(s => s.id == req.params.id);
    
    if (idx !== -1) {
        staff[idx] = { ...staff[idx], ...updates };
        writeJson(file, staff);
        addLog(store, actor, '직원수정', staff[idx].name, '정보수정');
        res.json({ success: true });
    } else res.status(404).json({ success: false });
});

app.delete('/api/staff/:id', (req, res) => {
    const store = req.query.store || 'chogazip';
    const actor = req.query.actor || 'Unknown';
    const file = getStaffFile(store);
    let staff = readJson(file, []);
    
    const target = staff.find(s => s.id == req.params.id);
    staff = staff.filter(s => s.id != req.params.id);
    
    if (writeJson(file, staff)) {
        if(target) addLog(store, actor, '직원삭제', target.name, '삭제됨');
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

// 일일 예외/대타
app.post('/api/staff/exception', (req, res) => {
    const { id, date, type, time, actor, store } = req.body;
    const file = getStaffFile(store || 'chogazip');
    let staff = readJson(file, []);
    const target = staff.find(s => s.id == id);
    
    if (target) {
        if (!target.exceptions) target.exceptions = {};
        if (type === 'delete') delete target.exceptions[date];
        else target.exceptions[date] = { type, time };
        
        writeJson(file, staff);
        addLog(store, actor, '근무변경', target.name, `${date} ${type}`);
        res.json({ success: true });
    } else res.status(404).json({ success: false });
});

app.post('/api/staff/temp', async (req, res) => { // async 추가
    const { name, date, time, salary, actor, store } = req.body;
    const file = getStaffFile(store || 'chogazip');
    let staff = readJson(file, []);
    
    const newWorker = {
        id: Date.now(),
        name: name,
        position: '알바(대타)',
        workDays: [],
        salaryType: 'hourly',
        salary: parseInt(salary) || 0,
        time: '',
        exceptions: {
            [date]: { type: 'work', time: time }
        }
    };

    staff.push(newWorker);
    
    if (writeJson(file, staff)) {
        addLog(store, actor, '대타등록', name, `${date} ${time}`);
        
        // [NEW] 변경된 날짜가 '오늘'이면 즉시 카톡 발송
        const todayStr = new Date().toISOString().split('T')[0];
        if (date === todayStr) {
             console.log('🔔 당일 대타 등록 감지! 알림 발송 중...');
             const msg = getDailyScheduleMessage(store, new Date());
             await sendToKakao(`📢 [긴급] 당일 대타/추가 알림\n(${actor}님 등록)\n\n${msg}`);
        }

        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

// =======================
// [API] 가계부 (매출/지출)
// =======================
app.get('/api/accounting', (req, res) => {
    const file = getAccountingFile(req.query.store || 'chogazip');
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ monthly:{}, daily:{} }));
    
    let data = readJson(file, { monthly: {}, daily: {} });
    // 구조 보정
    if (Array.isArray(data)) data = { monthly: {}, daily: {} };
    if (!data.monthly) data.monthly = {};
    if (!data.daily) data.daily = {};
    
    res.json({ success: true, data });
});

app.post('/api/accounting/daily', (req, res) => {
    const { date, data, store, actor } = req.body;
    const file = getAccountingFile(store || 'chogazip');
    let accData = readJson(file, { monthly: {}, daily: {} });
    if (!accData.daily) accData.daily = {};
    
    accData.daily[date] = data;
    if (writeJson(file, accData)) {
        addLog(store, actor, '매출입력', date, '일일매출저장');
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

app.post('/api/accounting/crawler', (req, res) => {
    // 1. 크롤러 데이터 수신
    const { 
        date, 
        store: storeKr, 
        sales, 
        deductions, 
        max_receipt_no 
    } = req.body;

    // 2. 매장명 맵핑 (한글 -> 영문 코드)
    let storeCode = 'chogazip';
    if (storeKr === '양은이네') storeCode = 'yangeun';
    else if (storeKr === '초가짚') storeCode = 'chogazip';
    else {
        return res.status(400).json({ success: false, message: 'Unknown store name' });
    }

    const file = getAccountingFile(storeCode);
    
    // 3. 기존 데이터 로드 (기존 지출 내역 등을 보존하기 위해)
    let accData = readJson(file, { monthly: {}, daily: {} });
    if (!accData.daily) accData.daily = {};

    // 4. 데이터 병합
    const existingData = accData.daily[date] || {};

    // 카드 매출 = card + etc (기타 결제수단 포함)
    const cardSales = (sales.card || 0) + (sales.etc || 0);
    
    // 현금 매출 (크롤러 값 사용)
    const cashSales = sales.cash || 0; 

    // 총 매출 (순매출 net_sales 사용)
    const totalSales = req.body.net_sales || sales.total || 0;

    const newData = {
        ...existingData, // 기존에 입력한 지출(food, meat)이나 메모 등은 유지
        
        // [매출 자동 갱신]
        card: cardSales,
        cash: cashSales,
        sales: totalSales, 
        
        // [신규 감사 데이터 - 수정불가 항목들]
        receiptCount: max_receipt_no,       // 영수증 번호 (테이블 수)
        discount: sales.discount || 0,      // 할인 합계
        refund: deductions.refund_total || 0, // 반품 합계
        void: deductions.void_total || 0,     // 전체 취소 합계

        crawledAt: new Date().toISOString() // 크롤링 시점 기록
    };

    // 5. 저장
    accData.daily[date] = newData;

    if (writeJson(file, accData)) {
        addLog(storeCode, 'Crawler', '매출자동입력', date, `POS데이터 반영(영수증:${max_receipt_no}, 반품:${newData.refund})`);
        console.log(`🤖 [Crawler] ${storeKr} ${date} 매출 업데이트 완료`);
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

// [server.js] 기존 app.post('/api/accounting/crawler', ...) 아래에 추가하세요.

app.post('/api/accounting/delivery-crawler', (req, res) => {
    // 1. 데이터 수신
    const { 
        platform, // "배달의민족", "요기요", "쿠팡이츠"
        store: storeKr, 
        date, 
        order_count, 
        payment_amount,
        crawled_at 
    } = req.body;

    // 2. 매장명 맵핑
    let storeCode = 'chogazip';
    if (storeKr === '양은이네') storeCode = 'yangeun';
    else if (storeKr === '초가짚') storeCode = 'chogazip';
    else return res.status(400).json({ success: false, message: 'Unknown store name' });

    // 3. 플랫폼 키 맵핑
    let platformKey = '';
    if (platform === '배달의민족') platformKey = 'baemin';
    else if (platform === '요기요') platformKey = 'yogiyo';
    else if (platform === '쿠팡이츠') platformKey = 'coupang';
    else return res.status(400).json({ success: false, message: 'Unknown platform' });

    const file = getAccountingFile(storeCode);
    
    // 4. 기존 데이터 로드
    let accData = readJson(file, { monthly: {}, daily: {} });
    if (!accData.daily) accData.daily = {};
    const existingData = accData.daily[date] || {};

    // 5. 데이터 병합 (해당 플랫폼 매출 및 건수 업데이트)
    const newData = {
        ...existingData,
        [platformKey]: payment_amount || 0,           // 예: baemin: 508000
        [`${platformKey}Count`]: order_count || 0,    // 예: baeminCount: 11
        [`${platformKey}CrawledAt`]: crawled_at       // 크롤링 시점
    };

    // 6. [중요] 총 매출 재계산 로직
    // 양은이네: 카드 + 현금 + 배달3사 (계좌이체 제외 등 기존 로직 준수)
    // 초가짚: 카드 + 현금 + 기타 (배달이 없지만 혹시 모르니 로직 포함)
    const card = newData.card || 0;
    const cash = newData.cash || 0;
    const gift = newData.gift || 0;
    const baemin = newData.baemin || 0;
    const yogiyo = newData.yogiyo || 0;
    const coupang = newData.coupang || 0;

    let totalSales = 0;
    if (storeCode === 'yangeun') {
        // 양은이네는 배달 포함
        totalSales = card + cash + baemin + yogiyo + coupang; 
    } else {
        // 초가짚은 기존대로
        totalSales = card + cash + gift;
    }
    newData.sales = totalSales;

    // 7. 저장
    accData.daily[date] = newData;

    if (writeJson(file, accData)) {
        addLog(storeCode, 'Crawler', '배달매출입력', date, `${platform}(${order_count}건) 업데이트`);
        console.log(`🛵 [Delivery] ${storeKr} ${date} ${platform} 업데이트 완료`);
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

app.post('/api/accounting/monthly', (req, res) => {
    const { month, data, store, actor } = req.body;
    const file = getAccountingFile(store || 'chogazip');
    let accData = readJson(file, { monthly: {}, daily: {} });
    if (!accData.monthly) accData.monthly = {};
    
    accData.monthly[month] = data;
    writeJson(file, accData);
    addLog(store, actor, '월간지출', month, '고정비용 저장');  // ✅ 이 줄 추가
    res.json({ success: true });
});

// =======================
// [API] 선결제 장부 (문제의 부분 수정됨)
// =======================
// [헬퍼 함수] 매장별 선결제 파일 경로 가져오기
function getPrepaymentFile(store) {
    const storeName = store === 'yangeun' ? 'prepayments_yangeun.json' : 'prepayments_chogazip.json';
    const filePath = path.join(actualDataPath, storeName);
    
    // 파일이 없으면 기본 구조 생성
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({ customers: {}, logs: [] }, null, 2));
    }
    return filePath;
}

// 1. 조회
app.get('/api/prepayments', (req, res) => {
    const store = req.query.store || 'chogazip';
    const file = getPrepaymentFile(store);
    
    // 안전하게 객체 기본값 제공
    let data = readJson(file, { customers: {}, logs: [] });
    // 만약 파일이 깨져서 배열로 되어있다면 강제 복구
    if (Array.isArray(data)) data = { customers: {}, logs: [] };
    
    res.json({ success: true, data });
});

// 2. 등록 (충전/차감)
app.post('/api/prepayments', (req, res) => {
    const { customerName, amount, type, date, note, actor, store } = req.body;
    const targetStore = store || 'chogazip';
    const file = getPrepaymentFile(targetStore);
    
    let data = readJson(file, { customers: {}, logs: [] });
    if (Array.isArray(data)) data = { customers: {}, logs: [] };

    // 고객 잔액 계산
    if (!data.customers[customerName]) {
        data.customers[customerName] = { balance: 0, lastUpdate: "" };
    }

    const val = parseInt(amount);
    if (type === 'charge') data.customers[customerName].balance += val;
    else data.customers[customerName].balance -= val;

    data.customers[customerName].lastUpdate = date;
    
    // 로그 추가
    data.logs.unshift({
        id: Date.now() + Math.random(), // 중복 방지
        date, customerName, type, amount: val,
        currentBalance: data.customers[customerName].balance,
        note, actor
    });

    if (writeJson(file, data)) {
        addLog(targetStore, actor, type === 'charge'?'선결제충전':'선결제사용', customerName, `${amount}원`);
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

// 3. 삭제 (취소)
app.delete('/api/prepayments/:id', (req, res) => {
    const logId = parseFloat(req.params.id);
    const { actor, store } = req.body;
    const targetStore = store || 'chogazip';
    const file = getPrepaymentFile(targetStore);

    let data = readJson(file, { customers: {}, logs: [] });
    if (Array.isArray(data)) return res.status(500).json({ success: false, error: 'Data corrupted' });

    const idx = data.logs.findIndex(l => l.id === logId);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' });

    const target = data.logs[idx];

    // 잔액 원상복구 (삭제하려는 내역의 반대로 계산)
    if (data.customers[target.customerName]) {
        if (target.type === 'charge') data.customers[target.customerName].balance -= target.amount;
        else data.customers[target.customerName].balance += target.amount;
    }

    // 로그 삭제
    data.logs.splice(idx, 1);

    if (writeJson(file, data)) {
        addLog(targetStore, actor, '선결제취소', target.customerName, '기록삭제 및 잔액원복');
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});


// 로그 조회
app.get('/api/logs', (req, res) => {
    const file = getLogFile(req.query.store || 'chogazip');
    res.json({ success: true, data: readJson(file, []) });
});

// =======================
// [API] 전체 데이터 백업 (사장님 전용)
// =======================
app.get('/api/backup', (req, res) => {
    const store = req.query.store || 'chogazip';
    
    try {
        // 1. 각 데이터 파일 읽기
        // 예약은 공유 파일이므로 공통으로 읽음
        const reservations = readJson(FINAL_DATA_FILE, []);
        
        // 나머지는 매장별 파일 읽기
        const staff = readJson(getStaffFile(store), []);
        const accounting = readJson(getAccountingFile(store), { monthly: {}, daily: {} });
        const prepayments = readJson(getPrepaymentFile(store), { customers: {}, logs: [] });
        const logs = readJson(getLogFile(store), []);

        // 2. 하나의 객체로 묶기
        const backupData = {
            metadata: {
                store: store,
                backupDate: new Date().toISOString(),
                version: "1.0"
            },
            reservations: reservations,
            staff: staff,
            accounting: accounting,
            prepayments: prepayments,
            logs: logs
        };

        // 3. 전송
        res.json({ success: true, data: backupData });
        
        // (선택사항) 백업을 수행했다는 로그 남기기
        // addLog(store, 'System', '백업', '전체데이터', '백업 파일 다운로드 실행'); 
        
    } catch (e) {
        console.error('백업 생성 실패:', e);
        res.status(500).json({ success: false, error: '백업 생성 중 오류 발생' });
    }
});

// 1. 카카오 인증 코드 받기 -> 사용자 식별 -> 토큰 저장 (중복 방지 로직 추가)
app.get('/oauth/kakao', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send('인증 코드가 없습니다.');

    try {
        // [1] 토큰 발급 요청
        const tokenRes = await axios.post('https://kauth.kakao.com/oauth/token', null, {
            params: {
                grant_type: 'authorization_code',
                client_id: KAKAO_REST_API_KEY,
                redirect_uri: KAKAO_REDIRECT_URI,
                code: code
            },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const newTokens = tokenRes.data;

        // [2] 사용자 정보 요청 (누구인지 식별하기 위해 필수!)
        const userRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
            headers: { Authorization: `Bearer ${newTokens.access_token}` }
        });

        const userId = userRes.data.id; // 카카오 고유 회원번호
        const userNickname = userRes.data.properties?.nickname || '이름없음';

        // [3] 기존 토큰 파일 읽기
        let tokenList = readJson(KAKAO_TOKEN_FILE, []);
        if (!Array.isArray(tokenList)) tokenList = []; // 파일이 깨졌거나 객체면 배열로 초기화

        // [4] 중복 확인 및 업데이트 (핵심 로직)
        const existingIdx = tokenList.findIndex(t => t.userId === userId);

        if (existingIdx !== -1) {
            // 이미 등록된 사용자라면 -> 토큰 정보만 갱신 (덮어쓰기)
            console.log(`🔄 기존 사용자(${userNickname}) 토큰 갱신`);
            tokenList[existingIdx] = {
                userId,
                nickname: userNickname,
                ...newTokens,
                updatedAt: new Date().toISOString()
            };
        } else {
            // 새로운 사용자라면 -> 리스트에 추가
            console.log(`➕ 새 사용자(${userNickname}) 등록`);
            tokenList.push({
                userId,
                nickname: userNickname,
                ...newTokens,
                updatedAt: new Date().toISOString()
            });
        }

        // [5] 저장
        writeJson(KAKAO_TOKEN_FILE, tokenList);
        
        res.send(`<h1>✅ 로그인 성공!</h1><p>${userNickname}님 등록 완료.<br>현재 알림 받는 인원: ${tokenList.length}명</p>`);

    } catch (error) {
        console.error('카카오 로그인 실패:', error.response ? error.response.data : error.message);
        res.send(`로그인 실패: ${error.message}`);
    }
});

// 1. (NEW) 서버 사이드 인건비 계산 함수
function calculateServerStaffCost(staffList, monthStr) {
    if (!staffList || !Array.isArray(staffList)) return 0;
    
    const [y, m] = monthStr.split('-');
    const year = parseInt(y);
    const month = parseInt(m);
    const lastDayObj = new Date(year, month, 0);
    const totalDaysInMonth = lastDayObj.getDate();
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let totalPay = 0;

    staffList.forEach(s => {
        // 입/퇴사일 체크 로직 (간소화)
        const sDate = s.startDate ? new Date(s.startDate) : null;
        const eDate = s.endDate ? new Date(s.endDate) : null;
        
        const isEmployedAt = (dVal) => {
            const t = new Date(year, month - 1, dVal); t.setHours(0,0,0,0);
            if (sDate) { const start = new Date(sDate); start.setHours(0,0,0,0); if (t < start) return false; }
            if (eDate) { const end = new Date(eDate); end.setHours(0,0,0,0); if (t > end) return false; }
            return true;
        };

        if (s.salaryType === 'monthly') {
            let employedDays = 0;
            for (let d = 1; d <= totalDaysInMonth; d++) {
                if (isEmployedAt(d)) employedDays++;
            }
            if (employedDays === totalDaysInMonth) totalPay += (s.salary || 0);
            else totalPay += Math.floor((s.salary || 0) / totalDaysInMonth * employedDays);
        } else {
            // 시급제 계산
            let hours = 0;
            for (let d = 1; d <= totalDaysInMonth; d++) {
                if (!isEmployedAt(d)) continue;
                
                const dateKey = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const dateObj = new Date(year, month - 1, d);
                const dayName = dayMap[dateObj.getDay()];

                let isWorking = false;
                let timeStr = s.time;

                // 예외 처리 확인
                if (s.exceptions && s.exceptions[dateKey]) {
                    if (s.exceptions[dateKey].type === 'work') { isWorking = true; timeStr = s.exceptions[dateKey].time; }
                } else {
                    if (s.workDays.includes(dayName)) isWorking = true;
                }

                if (isWorking && timeStr && timeStr.includes('~')) {
                    const [start, end] = timeStr.split('~');
                    const [sh, sm] = start.trim().split(':').map(Number);
                    const [eh, em] = end.trim().split(':').map(Number);
                    let h = (eh * 60 + em) - (sh * 60 + sm);
                    if (h < 0) h += 24 * 60; // 자정 넘어가는 경우
                    hours += (h / 60);
                }
            }
            totalPay += Math.floor(hours * (s.salary || 0));
        }
    });
    return totalPay;
}

// 2. 메시지 전송 함수 (등록된 모든 사용자에게 전송)
async function sendToKakao(text) {
    let tokenList = readJson(KAKAO_TOKEN_FILE, []);
    
    // 배열이 아니거나 비어있으면 중단
    if (!Array.isArray(tokenList) || tokenList.length === 0) {
        console.log('❌ 카카오톡 발송 실패: 등록된 사용자가 없습니다.');
        return;
    }

    console.log(`📢 총 ${tokenList.length}명에게 카톡 전송 시작...`);
    let isListChanged = false; // 저장 필요 여부 체크

    // 모든 사용자에게 순차 전송
    for (let i = 0; i < tokenList.length; i++) {
        let user = tokenList[i];
        
        try {
            // [A] 액세스 토큰 갱신 시도 (만료 대비)
            // 리프레시 토큰이 있으면 무조건 갱신 시도해보는 것이 안전함
            try {
                const refreshRes = await axios.post('https://kauth.kakao.com/oauth/token', null, {
                    params: {
                        grant_type: 'refresh_token',
                        client_id: KAKAO_REST_API_KEY,
                        refresh_token: user.refresh_token
                    },
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });

                if (refreshRes.data.access_token) {
                    // 갱신 성공 시 정보 업데이트
                    user.access_token = refreshRes.data.access_token;
                    // 리프레시 토큰도 새로 왔다면 업데이트 (만료 기간 연장됨)
                    if (refreshRes.data.refresh_token) {
                        user.refresh_token = refreshRes.data.refresh_token;
                    }
                    isListChanged = true;
                }
            } catch (refreshErr) {
                console.log(`⚠️ ${user.nickname}: 토큰 갱신 실패 (만료되었을 수 있음)`);
                // 여기서 실패하면 아래 전송도 실패할 확률 높음 -> 재로그인 필요
            }

            // [B] 메시지 전송 (나에게 보내기 API 사용)
            await axios.post('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
                template_object: JSON.stringify({
                    object_type: 'text',
                    text: text,
                    link: {
                        web_url: 'https://chogajipreservation-production.up.railway.app',
                        mobile_web_url: 'https://chogajipreservation-production.up.railway.app'
                    }
                })
            }, {
                headers: {
                    'Authorization': `Bearer ${user.access_token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            console.log(`✅ 전송 성공: ${user.nickname}`);

        } catch (error) {
            console.error(`❌ 전송 실패 (${user.nickname}):`, error.response ? error.response.data : error.message);
            // 필요 시, 실패한 사용자는 리스트에서 제거하거나 에러 표시를 할 수 있음
        }
        
        // 업데이트된 정보 배열에 다시 반영
        tokenList[i] = user;
    }

    // 변경사항(토큰 갱신 등)이 있으면 파일 저장
    if (isListChanged) {
        writeJson(KAKAO_TOKEN_FILE, tokenList);
        console.log('💾 갱신된 토큰 정보를 저장했습니다.');
    }
}

// [API] 수동 브리핑 발송 (버튼 클릭 시 동작)
app.post('/api/kakao/send-briefing', async (req, res) => {
    const { actor } = req.body;
    try {
        console.log(`🔔 [수동 발송] ${actor}님이 브리핑을 요청했습니다.`);
        
        // 기존 브리핑 생성 함수 실행
        await generateAndSendBriefing(); 
        
        // 로그 기록
        addLog('chogazip', actor, '카톡발송', '통합브리핑', '수동발송 완료');
        
        res.json({ success: true });
    } catch (e) {
        console.error('수동 발송 실패:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// [server.js] 기존 generateAndSendBriefing 및 관련 로직 대체

// [server.js] 수정된 로직

// 1. (UPDATE) 비용 추출 헬퍼 함수 (비율 계산 및 100% 고정비 데이터 추가 반환)
function extractStoreCosts(accData, staffData, monthStr, storeType, currentDay) {
    // 1. 변동비 (일별 실비 합산)
    let meat = 0, food = 0, etcDaily = 0, sales = 0;
    
    // [NEW] 오늘 날짜 매출이 0원인지 확인하기 위해 오늘 날짜 키 생성
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10); // YYYY-MM-DD
    let todaySales = 0;

    if (accData.daily) {
        if(accData.daily[todayKey]) todaySales = accData.daily[todayKey].sales || 0;

        Object.keys(accData.daily).forEach(date => {
            if (date.startsWith(monthStr)) {
                const d = accData.daily[date];
                sales += (d.sales || 0);
                meat += (d.meat || 0);
                food += (d.food || 0);
                etcDaily += (d.etc || 0);
            }
        });
    }

    // 2. 고정비 (월별 데이터)
    const m = (accData.monthly && accData.monthly[monthStr]) ? accData.monthly[monthStr] : {};
    
    // [A] 일할 계산 대상 (시간이 지나면 나가는 돈)
    const rent = m.rent || 0;
    const utility = (m.utility||0) + (m.gas||0) + (m.foodWaste||0) + (m.tableOrder||0);
    const etcFixed = (m.businessCard||0) + (m.taxAgent||0) + (m.tax||0) + (m.etc_fixed||0) + (m.disposable||0);

    // [B] 100% 반영 대상 (물건값, 수수료, 상환금 등) -> 화면 로직과 맞춤
    const makgeolli = m.makgeolli || 0;
    const liquor = (m.liquor||0) + (m.beverage||0) + makgeolli;
    const liquorLoan = m.liquorLoan || 0;
    const delivery = m.deliveryFee || 0;

    // 3. 인건비 (예상 총액)
    const staffTotal = calculateServerStaffCost(staffData, monthStr);

    // 4. [A] 예상 순익용 (일할 계산 비율 설정)
    const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    
    // [NEW] 매출 0원이면 어제 날짜 기준으로 비율 조정 (화면 로직과 동일)
    let appliedDay = currentDay;
    if (todaySales === 0 && appliedDay > 1) {
        appliedDay = appliedDay - 1;
    }
    const ratio = appliedDay / lastDay;

    // 예상 비용 항목 계산
    // [수정됨] 주류, 대출, 배달은 ratio를 곱하지 않고 100% 반영합니다.
    const itemsPred = {
        rent: Math.floor(rent * ratio),
        utility: Math.floor(utility * ratio),
        liquor: liquor,             // 100% 반영 (수정됨)
        loan: liquorLoan,           // 100% 반영 (수정됨)
        delivery: delivery,         // 100% 반영 (수정됨)
        staff: Math.floor(staffTotal * ratio),
        meat: meat,
        food: food,
        etc: etcDaily + Math.floor(etcFixed * ratio)
    };
    
    const costPred = Object.values(itemsPred).reduce((a,b)=>a+b, 0);
    const profitPred = sales - costPred;

    // 5. [B] 현실 점검용 (고정비 100% 반영)
    const costFull = meat + food + etcDaily + rent + utility + liquor + liquorLoan + delivery + etcFixed + staffTotal;
    const profitReal = sales - costFull;

    return {
        sales, 
        profitPred, // 예상 순익 (화면과 동일해짐)
        profitReal, // 현실 순익
        costFull,   
        items: itemsPred 
    };
}

// 2. (UPDATE) 브리핑 생성 및 전송 함수
// server.js - generateAndSendBriefing 함수 전체 교체 또는 해당 부분 수정

// server.js - generateAndSendBriefing 함수 교체

async function generateAndSendBriefing() {
    try {
        const today = new Date();
        const monthStr = today.toISOString().slice(0, 7);
        const dayNum = today.getDate();

        // 데이터 로드
        const accChoga = readJson(getAccountingFile('chogazip'), { monthly: {}, daily: {} });
        const staffChoga = readJson(getStaffFile('chogazip'), []);
        const accYang = readJson(getAccountingFile('yangeun'), { monthly: {}, daily: {} });
        const staffYang = readJson(getStaffFile('yangeun'), []);

        // 계산
        const choga = extractStoreCosts(accChoga, staffChoga, monthStr, 'choga', dayNum);
        const yang = extractStoreCosts(accYang, staffYang, monthStr, 'yang', dayNum);

        // 통합 데이터
        const totalSales = choga.sales + yang.sales;
        const totalProfitPred = choga.profitPred + yang.profitPred;
        const totalProfitReal = choga.profitReal + yang.profitReal;

        const formatMoney = (n) => n.toLocaleString();
        
        const getProfitText = (val) => {
            if (val > 0) return `📈 흑자: +${formatMoney(val)}원`;
            if (val < 0) return `📉 적자: ${formatMoney(val)}원`;
            return `0원 (본전)`;
        };

        // [NEW] 비용 항목 표시 헬퍼 함수 (수정됨: 금액 높은 순 정렬)
        const buildCostMessage = (data, storeName) => {
            const { items, sales } = data;
            let msg = '';
            
            // 1. 항목 정의
            const costKeys = [
                { key: 'meat', label: storeName === 'chogazip' ? '한강유통' : 'SPC/재료' },
                { key: 'food', label: '삼시세끼' },
                { key: 'liquor', label: '주류' },
                { key: 'loan', label: '주류대출' },
                { key: 'staff', label: '인건비(예상)' },
                { key: 'rent', label: '임대료(일할)' },
                { key: 'delivery', label: '배달수수료' },
                { key: 'utility', label: '관리/공과' }
            ];

            // 2. 항목 분류 (고액 / 소액)
            let highValueList = [];
            let smallCostTotal = 0;

            costKeys.forEach(({ key, label }) => {
                const val = items[key] || 0;
                if (val >= 1000000) {
                    // 100만원 이상 -> 리스트에 추가 (나중에 정렬)
                    highValueList.push({ label, val });
                } else if (val > 0) {
                    // 100만원 미만 -> 합산
                    smallCostTotal += val;
                }
            });

            // 3. 기타 잡비(etc)는 무조건 소액 합산에 포함
            const etcVal = items.etc || 0;
            if (etcVal > 0) {
                smallCostTotal += etcVal;
            }

            // 4. 고액 항목 정렬 (금액 큰 순서대로 내림차순)
            highValueList.sort((a, b) => b.val - a.val);

            // 5. 메시지 생성
            // 5-1. 고액 항목 출력
            highValueList.forEach(item => {
                const pct = sales > 0 ? `(${(item.val / sales * 100).toFixed(1)}%)` : '';
                msg += `- ${item.label}: ${formatMoney(item.val)} ${pct}\n`;
            });

            // 5-2. 소액 합산 출력 (마지막에 표시)
            if (smallCostTotal > 0) {
                msg += `- 기타운영비(소액): ${formatMoney(smallCostTotal)}\n`;
            }
            
            return msg;
        };

        // 메시지 본문 작성
        const message = `
[📅 ${today.getMonth()+1}월 ${today.getDate()}일 경영 브리핑]

🏠 초가짚 (예상마진 ${(choga.sales>0?(choga.profitPred/choga.sales*100).toFixed(1):0)}%)
■ 매출: ${formatMoney(choga.sales)}원
■ 예상순익: ${formatMoney(choga.profitPred)}원
${buildCostMessage(choga, 'chogazip')}

🥘 양은이네 (예상마진 ${(yang.sales>0?(yang.profitPred/yang.sales*100).toFixed(1):0)}%)
■ 매출: ${formatMoney(yang.sales)}원
■ 예상순익: ${formatMoney(yang.profitPred)}원
${buildCostMessage(yang, 'yangeun')}

💰 통합 요약
■ 합산매출: ${formatMoney(totalSales)}원
■ 예상순익: ${formatMoney(totalProfitPred)}원

📉 월간 현실 점검 (고정비 100% 반영)
■ 초가짚: ${getProfitText(choga.profitReal)}
■ 양은이네: ${getProfitText(yang.profitReal)}
■ 통합손익: ${getProfitText(totalProfitReal)}
`.trim();

        await sendToKakao(message);

    } catch (e) {
        console.error('브리핑 생성 실패:', e);
    }
}

// [NEW] 특정 날짜의 근무자 명단 및 일일 인건비 메시지 생성 함수
function getDailyScheduleMessage(store, dateObj) {
    const storeName = store === 'yangeun' ? '🥘 양은이네' : '🏠 초가짚';
    const file = getStaffFile(store);
    const staffList = readJson(file, []);
    
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayKey = dayMap[dateObj.getDay()];
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    let workers = [];
    let totalDailyCost = 0;

    staffList.forEach(s => {
        const sDate = s.startDate ? new Date(s.startDate) : null;
        const eDate = s.endDate ? new Date(s.endDate) : null;
        const targetDate = new Date(year, month - 1, day); targetDate.setHours(0,0,0,0);
        
        if (sDate) { const start = new Date(sDate); start.setHours(0,0,0,0); if (targetDate < start) return; }
        if (eDate) { const end = new Date(eDate); end.setHours(0,0,0,0); if (targetDate > end) return; }

        let isWorking = false;
        let timeStr = s.time;

        if (s.exceptions && s.exceptions[dateStr]) {
            const ex = s.exceptions[dateStr];
            if (ex.type === 'work') { isWorking = true; timeStr = ex.time; }
            else if (ex.type === 'off') { isWorking = false; }
        } else {
            if (s.workDays && s.workDays.includes(dayKey)) isWorking = true;
        }

        if (isWorking) {
            let cost = 0;
            if (s.salaryType === 'monthly') {
                cost = Math.floor((s.salary || 0) / lastDayOfMonth);
            } else {
                if (timeStr && timeStr.includes('~')) {
                    const [start, end] = timeStr.split('~');
                    const [sh, sm] = start.trim().split(':').map(Number);
                    const [eh, em] = end.trim().split(':').map(Number);
                    
                    let startMin = sh * 60 + (sm || 0);
                    let endMin = eh * 60 + (em || 0);
                    if (endMin < startMin) endMin += 24 * 60;
                    
                    const hours = (endMin - startMin) / 60;
                    cost = Math.floor(hours * (s.salary || 0));
                }
            }
            totalDailyCost += cost;
            workers.push({ name: s.name, time: timeStr });
        }
    });

    if (workers.length === 0) {
        return `${storeName}: 근무 없음 (휴무)`;
    }

    let msg = `${storeName}: 근무인원 ${workers.length}명\n`;
    
    // [수정] 8명 이상(과다) 또는 6명 이하(부족) 경고 로직 추가
    if (workers.length >= 8) {
        msg += `🚨 [경고] 인원과다(${workers.length}명) → 비용 점검필요\n`;
    } else if (workers.length <= 6) {
        msg += `⚠️ [확인] 인원부족(${workers.length}명) → 서비스 점검필요\n`;
    }

    workers.forEach(w => {
        msg += `- ${w.name}: ${w.time}\n`;
    });
    msg += `💰 금일 인건비: ${totalDailyCost.toLocaleString()}원`;

    return msg;
}

app.post('/api/staff/exception', async (req, res) => { // async 추가
    const { id, date, type, time, actor, store } = req.body;
    const file = getStaffFile(store || 'chogazip');
    let staff = readJson(file, []);
    const target = staff.find(s => s.id == id);
    
    if (target) {
        if (!target.exceptions) target.exceptions = {};
        if (type === 'delete') delete target.exceptions[date];
        else target.exceptions[date] = { type, time };
        
        writeJson(file, staff);
        addLog(store, actor, '근무변경', target.name, `${date} ${type}`);
        
        // [NEW] 변경된 날짜가 '오늘'이면 즉시 카톡 발송
        const todayStr = new Date().toISOString().split('T')[0];
        if (date === todayStr) {
            console.log('🔔 당일 근무 변경 감지! 알림 발송 중...');
            const msg = getDailyScheduleMessage(store, new Date());
            await sendToKakao(`📢 [긴급] 당일 근무 변경 알림\n(${actor}님 수정)\n\n${msg}`);
        }

        res.json({ success: true });
    } else res.status(404).json({ success: false });
});

cron.schedule('30 11 * * *', async () => {
    console.log('🔔 [알림] 오전 11:30 근무표 브리핑 시작...');
    
    try {
        const today = new Date();
        const msgChoga = getDailyScheduleMessage('chogazip', today);
        const msgYang = getDailyScheduleMessage('yangeun', today);

        const finalMsg = `
[📅 ${today.getMonth()+1}월 ${today.getDate()}일 근무자 브리핑]

${msgChoga}

----------------

${msgYang}
`.trim();

        await sendToKakao(finalMsg);
        console.log('✅ 근무표 전송 완료');
    } catch (e) {
        console.error('❌ 근무표 전송 실패:', e);
    }
}, {
    timezone: "Asia/Seoul"
});

cron.schedule('0 11 * * *', () => {
    console.log('🔔 [알림] 오전 11시 일일 브리핑 생성 중...');
    generateAndSendBriefing();
}, {
    timezone: "Asia/Seoul"
});

// 간단 통계 계산 헬퍼
// 2. (UPDATE) 통계 계산 함수 고도화 (인건비 및 상세 항목 포함)
function calculateMonthStats(accountingData, staffData, monthStr, currentDay) {
    let sales = 0;
    // 변동비 상세
    let costBreakdown = { meat: 0, food: 0, etc: 0 }; 
    let variableCostTotal = 0;

    // 일별 합계 (매출 및 변동비)
    if(accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if(date.startsWith(monthStr)) {
                const d = accountingData.daily[date];
                sales += (d.sales || 0);
                
                costBreakdown.meat += (d.meat || 0);
                costBreakdown.food += (d.food || 0);
                costBreakdown.etc += (d.etc || 0);
                variableCostTotal += (d.cost || 0);
            }
        });
    }

    // 고정비 데이터
    const mData = (accountingData.monthly && accountingData.monthly[monthStr]) ? accountingData.monthly[monthStr] : {};
    
    // 인건비 계산 (서버 로직 사용)
    const totalStaffCost = calculateServerStaffCost(staffData, monthStr);

    // 고정비 합계 (인건비 제외한 순수 고정비)
    const fixedItemsTotal = (mData.rent||0) + (mData.utility||0) + (mData.gas||0) + (mData.makgeolli||0) +
                            (mData.liquor||0) + (mData.beverage||0) + (mData.etc_fixed||0) + 
                            (mData.liquorLoan||0) + (mData.deliveryFee||0) + (mData.disposable||0) + 
                            (mData.businessCard||0) + (mData.taxAgent||0) + (mData.tax||0) + 
                            (mData.foodWaste||0) + (mData.tableOrder||0);

    // 일할 계산 비율 (오늘 날짜 기준 예상치)
    const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const ratio = currentDay / lastDay;

    // 예상 지출 = 변동비(실비) + (고정비+인건비) * 일할비율
    const appliedFixed = Math.floor((fixedItemsTotal + totalStaffCost) * ratio);
    const totalCost = variableCostTotal + appliedFixed;
    
    const profit = sales - totalCost;
    const margin = sales > 0 ? ((profit / sales) * 100).toFixed(1) : 0;

    return { 
        sales, 
        profit, 
        margin, 
        costBreakdown, 
        fixedRaw: fixedItemsTotal, 
        staffRaw: totalStaffCost,
        appliedFixed 
    };
}

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});