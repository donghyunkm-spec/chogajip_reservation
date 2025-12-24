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

// [API] 일일 대타/추가 근무자 등록 (신규 추가)
app.post('/api/staff/temp', (req, res) => {
    const { name, date, time, salary, actor, store } = req.body;
    const file = getStaffFile(store || 'chogazip');
    let staff = readJson(file, []);
    
    // 1. 대타를 새로운 직원으로 등록하되, 정규 근무요일(workDays)은 비워둡니다.
    const newWorker = {
        id: Date.now(),
        name: name,
        position: '알바(대타)',
        workDays: [], // 정기 근무 없음
        salaryType: 'hourly',
        salary: parseInt(salary) || 0, // 시급 정보 저장 (인건비 계산용)
        time: '', // 기본 시간 없음
        // 2. 해당 날짜에만 근무하도록 예외(exception) 처리
        exceptions: {
            [date]: { type: 'work', time: time }
        }
    };

    staff.push(newWorker);
    
    if (writeJson(file, staff)) {
        addLog(store, actor, '대타등록', name, `${date} ${time}`);
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
        addLog(store, actor, '매출등록', date, '일일매출저장');
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

app.post('/api/accounting/monthly', (req, res) => {
    const { month, data, store, actor } = req.body;
    const file = getAccountingFile(store || 'chogazip');
    let accData = readJson(file, { monthly: {}, daily: {} });
    if (!accData.monthly) accData.monthly = {};
    
    accData.monthly[month] = data;
    writeJson(file, accData);
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
        addLog(targetStore, actor, type === 'charge'?'선결충전':'선결사용', customerName, `${amount}원`);
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
        addLog(targetStore, actor, '선결취소', target.customerName, '기록삭제 및 잔액원복');
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

// 1. 카카오 인증 코드 받기 및 토큰 발급 (Redirect URI)
app.get('/oauth/kakao', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send('인증 코드가 없습니다.');

    try {
        // 토큰 발급 요청
        const response = await axios.post('https://kauth.kakao.com/oauth/token', null, {
            params: {
                grant_type: 'authorization_code',
                client_id: KAKAO_REST_API_KEY,
                redirect_uri: KAKAO_REDIRECT_URI,
                code: code
            },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const tokens = response.data;
        // 토큰 파일 저장
        writeJson(KAKAO_TOKEN_FILE, tokens);
        
        console.log('✅ 카카오 토큰 발급 및 저장 완료');
        res.send('<h1>✅ 카카오 로그인 성공!</h1><p>토큰이 서버에 저장되었습니다. 창을 닫으셔도 됩니다.</p>');

    } catch (error) {
        console.error('토큰 발급 실패:', error.response ? error.response.data : error.message);
        res.send('토큰 발급 실패. 로그를 확인하세요.');
    }
});

// 2. 메시지 전송 함수 (나에게 보내기)
async function sendToKakao(text) {
    try {
        let tokens = readJson(KAKAO_TOKEN_FILE, null);
        if (!tokens) {
            console.log('❌ 저장된 카카오 토큰이 없습니다. /kakao-auth.html 에서 로그인해주세요.');
            return;
        }

        // 액세스 토큰 갱신 시도 (만료 대비 무조건 갱신 시도 혹은 유효성 체크 후 갱신)
        // 간단하게 리프레시 토큰으로 갱신 먼저 시도
        try {
            const refreshRes = await axios.post('https://kauth.kakao.com/oauth/token', null, {
                params: {
                    grant_type: 'refresh_token',
                    client_id: KAKAO_REST_API_KEY,
                    refresh_token: tokens.refresh_token
                },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            
            // 갱신된 토큰 정보 합치기 (새로운 access_token 등)
            if (refreshRes.data.access_token) {
                tokens = { ...tokens, ...refreshRes.data };
                writeJson(KAKAO_TOKEN_FILE, tokens); // 갱신된 토큰 저장
            }
        } catch (refreshErr) {
            console.log('🔄 토큰 갱신 건너뜀 (아직 유효하거나 리프레시 만료):', refreshErr.message);
            // 리프레시 토큰도 만료되면 다시 로그인해야 함
        }

        // 메시지 전송 (나에게 보내기 - 텍스트 템플릿)
        await axios.post('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
            template_object: JSON.stringify({
                object_type: 'text',
                text: text,
                link: {
                    web_url: 'https://yyyn-reservation-production.up.railway.app', // 클릭 시 이동할 주소
                    mobile_web_url: 'https://yyyn-reservation-production.up.railway.app'
                }
            })
        }, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log('🚀 카카오톡 알림 전송 성공');

    } catch (error) {
        console.error('❌ 카카오 전송 실패:', error.response ? error.response.data : error.message);
    }
}

cron.schedule('0 11 * * *', () => {
    console.log('🔔 [알림] 오전 11시 일일 브리핑 생성 중...');
    sendDailyBriefing();
});

function sendDailyBriefing() {
    try {
        const today = new Date();
        const monthStr = today.toISOString().slice(0, 7); // YYYY-MM
        
        // 1. 데이터 읽기
        const accChoga = readJson(getAccountingFile('chogazip'), { monthly: {}, daily: {} });
        const accYang = readJson(getAccountingFile('yangeun'), { monthly: {}, daily: {} });

        // 2. 이번 달 데이터 집계 (예상 순익 계산 로직 간소화)
        const statsChoga = calculateMonthStats(accChoga, monthStr, today.getDate());
        const statsYang = calculateMonthStats(accYang, monthStr, today.getDate());
        
        // 3. 메시지 작성
        const message = `
[📅 ${today.getMonth()+1}월 ${today.getDate()}일 경영 브리핑]

🏠 초가짚
- 현재매출: ${statsChoga.sales.toLocaleString()}원
- 예상순익: ${statsChoga.profit.toLocaleString()}원 (${statsChoga.margin}%)

🥘 양은이네
- 현재매출: ${statsYang.sales.toLocaleString()}원
- 예상순익: ${statsYang.profit.toLocaleString()}원 (${statsYang.margin}%)

💰 통합 예상 순익
- 합산매출: ${(statsChoga.sales + statsYang.sales).toLocaleString()}원
- 합산순익: ${(statsChoga.profit + statsYang.profit).toLocaleString()}원
        `.trim();

        console.log("--------------------------------");
        console.log(message);
        console.log("--------------------------------");
        
        // [카카오톡/슬랙 전송 로직 위치]
        // 예: sendToKakao(message); 
        // 실제 카카오 API 연동은 복잡하므로, 우선 서버 로그로 확인하시거나 
        // Slack Webhook 등을 이용하시면 훨씬 간편하게 받아보실 수 있습니다.

    } catch (e) {
        console.error('브리핑 생성 실패:', e);
    }
}

// 간단 통계 계산 헬퍼
function calculateMonthStats(data, monthStr, currentDay) {
    let sales = 0;
    let cost = 0;
    
    // 일별 합계
    if(data.daily) {
        Object.keys(data.daily).forEach(date => {
            if(date.startsWith(monthStr)) {
                sales += (data.daily[date].sales || 0);
                cost += (data.daily[date].cost || 0);
            }
        });
    }

    // 고정비 일할 계산
    const mData = (data.monthly && data.monthly[monthStr]) ? data.monthly[monthStr] : {};
    const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const ratio = currentDay / lastDay;
    
    const fixedTotal = (mData.rent||0) + (mData.utility||0) + (mData.gas||0) + (mData.liquor||0) + 
                       (mData.beverage||0) + (mData.etc_fixed||0) + (mData.liquorLoan||0) + 
                       (mData.deliveryFee||0) + (mData.disposable||0) + (mData.businessCard||0) + 
                       (mData.taxAgent||0) + (mData.tax||0) + (mData.foodWaste||0) + (mData.tableOrder||0);
    
    // *인건비는 서버에서 정확히 계산하기 어려우므로(staff 파일 필요) 제외하거나 고정비에 포함된 것으로 가정
    const appliedFixed = Math.floor(fixedTotal * ratio);
    
    const totalProfit = sales - (cost + appliedFixed);
    const margin = sales > 0 ? ((totalProfit / sales) * 100).toFixed(1) : 0;

    return { sales, profit: totalProfit, margin };
}

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});