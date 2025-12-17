// server.js - 통합 최적화 버전
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. 공통 설정 및 파일 시스템 초기화
// ==========================================

// Railway Volume 경로 설정
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data';
const fallbackPath = path.join(__dirname, 'data');

function ensureVolumeDirectory() {
    try {
        if (!fs.existsSync(VOLUME_PATH)) {
            // 권한 문제 등이 생길 수 있으므로 try-catch
            fs.mkdirSync(VOLUME_PATH, { recursive: true });
        }
        return VOLUME_PATH;
    } catch (error) {
        console.error(`❌ 볼륨 디렉토리 오류, 로컬 폴더 사용:`, error.message);
        if (!fs.existsSync(fallbackPath)) {
            fs.mkdirSync(fallbackPath, { recursive: true });
        }
        return fallbackPath;
    }
}

const actualDataPath = ensureVolumeDirectory();
console.log(`📁 데이터 저장 경로: ${actualDataPath}`);

// 예약 데이터 파일
const FINAL_DATA_FILE = path.join(actualDataPath, 'reservations.json');
if (!fs.existsSync(FINAL_DATA_FILE)) fs.writeFileSync(FINAL_DATA_FILE, JSON.stringify([], null, 2));

// [헬퍼 함수] JSON 읽기/쓰기
function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')) || []; } 
    catch (e) { return []; }
}

function writeJson(file, data) {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); return true; } 
    catch (e) { console.error('쓰기 에러:', e); return false; }
}

// [헬퍼 함수] 매장별 파일 경로 가져오기
function getStaffFile(store) {
    const storeName = store === 'yangeun' ? 'staff_yangeun.json' : 'staff.json';
    const filePath = path.join(actualDataPath, storeName);
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify([], null, 2));
    return filePath;
}

function getLogFile(store) {
    const storeName = store === 'yangeun' ? 'logs_yangeun.json' : 'logs.json';
    const filePath = path.join(actualDataPath, storeName);
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify([], null, 2));
    return filePath;
}

// [헬퍼 함수] 로그 기록
function addLog(store, actor, action, targetName, details) {
    const logFile = getLogFile(store);
    const logs = readJson(logFile);
    const newLog = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        actor: actor,
        action: action,
        target: targetName,
        details: details
    };
    logs.unshift(newLog); // 최신순
    if (logs.length > 1000) logs.pop(); // 1000개 제한
    writeJson(logFile, logs);
}

// ==========================================
// 2. Google Calendar 설정
// ==========================================
let calendar = null;
let calendarInitialized = false;

async function initializeGoogleCalendar() {
    try {
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        
        if (!serviceAccountKey || !calendarId) {
            console.log('⚠️ Google Calendar 환경변수 미설정 - 기능 꺼짐');
            return false;
        }

        const credentials = JSON.parse(serviceAccountKey);
        const auth = new google.auth.JWT(
            credentials.client_email,
            null,
            credentials.private_key,
            ['https://www.googleapis.com/auth/calendar']
        );

        calendar = google.calendar({ version: 'v3', auth });
        await calendar.calendars.get({ calendarId: calendarId }); // 연결 테스트
        
        calendarInitialized = true;
        console.log('✅ Google Calendar API 초기화 성공');
        return true;
    } catch (error) {
        console.error('❌ Google Calendar 초기화 실패:', error.message);
        return false;
    }
}

// ... (캘린더 이벤트 생성/수정/삭제 함수들은 로직이 길어 생략하나, 
//      기존 코드의 createCalendarEvent, updateCalendarEvent, deleteCalendarEvent 함수를 
//      그대로 사용하시면 됩니다. 핵심은 아래 API 라우트입니다.)

// 시간 계산 헬퍼
function addHours(timeStr, hours) {
    const [h, m] = timeStr.split(':').map(Number);
    return `${(h + hours) % 24}`.padStart(2, '0') + `:${m.toString().padStart(2, '0')}`;
}

function isTimeOverlap(time1, time2) {
    if (time1 === time2) return true;
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    const start1 = h1 * 60 + m1, end1 = start1 + 180;
    const start2 = h2 * 60 + m2, end2 = start2 + 180;
    return (start1 < end2 && start2 < end1);
}

function checkTableConflict(newReservation, existingReservations) {
    const conflicts = existingReservations.filter(r => 
        r.status === 'active' && 
        r.date === newReservation.date && 
        isTimeOverlap(r.time, newReservation.time)
    );
    const usedTables = new Set();
    conflicts.forEach(r => r.tables && r.tables.forEach(t => usedTables.add(t)));
    return newReservation.tables.filter(t => usedTables.has(t));
}

// ==========================================
// 3. 미들웨어 및 서버 시작
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 4. API 라우트 - 예약 시스템
// ==========================================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/reservations', (req, res) => {
    res.json({ success: true, data: readJson(FINAL_DATA_FILE) });
});

app.post('/api/reservations', async (req, res) => {
    // ... (기존 예약 추가 로직 유지 - 내용이 길어 생략, 기존 코드 사용 권장)
    // 핵심 로직: checkTableConflict -> readJson -> push -> writeJson -> createCalendarEvent
    // 복잡하다면 기존 코드의 app.post('/api/reservations') 부분을 그대로 복사해 넣으세요.
    try {
        const newRes = req.body;
        const reservations = readJson(FINAL_DATA_FILE);
        
        if (checkTableConflict(newRes, reservations).length > 0) {
            return res.status(400).json({ success: false, error: '테이블 중복' });
        }

        newRes.id = Date.now();
        newRes.status = 'active';
        reservations.push(newRes);
        
        if (writeJson(FINAL_DATA_FILE, reservations)) {
            // 캘린더 연동 (함수가 있다면 호출)
            // await createCalendarEvent(newRes); 
            res.json({ success: true, message: '예약 성공' });
        } else {
            res.status(500).json({ success: false, error: '저장 실패' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/reservations/:id', async (req, res) => {
    // ... (기존 예약 수정 로직)
    const id = parseInt(req.params.id);
    const updates = req.body;
    let reservations = readJson(FINAL_DATA_FILE);
    const idx = reservations.findIndex(r => r.id === id);
    
    if (idx === -1) return res.status(404).json({ success: false });
    
    reservations[idx] = { ...reservations[idx], ...updates };
    writeJson(FINAL_DATA_FILE, reservations);
    res.json({ success: true });
});

app.delete('/api/reservations/:id', async (req, res) => {
    // ... (기존 예약 삭제 로직)
    const id = parseInt(req.params.id);
    let reservations = readJson(FINAL_DATA_FILE);
    const filtered = reservations.filter(r => r.id !== id);
    writeJson(FINAL_DATA_FILE, filtered);
    res.json({ success: true });
});


// ==========================================
// 5. API 라우트 - 직원 관리 (멀티 스토어)
// ==========================================

// 로그인
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === 'admin1234!') res.json({ success: true, role: 'admin', name: '사장님' });
    else if (password === 'chogazip1234') res.json({ success: true, role: 'manager', name: '점장님' });
    else if (password === 'chrkwlv1234!') res.json({ success: true, role: 'viewer', name: '직원' });
    else res.status(401).json({ success: false, message: '비밀번호 불일치' });
});

// 직원 목록 조회
app.get('/api/staff', (req, res) => {
    const store = req.query.store || 'chogazip';
    res.json({ success: true, data: readJson(getStaffFile(store)) });
});

// 직원 등록
app.post('/api/staff', (req, res) => {
    const { staffList, actor, store } = req.body;
    const targetStore = store || 'chogazip';
    const file = getStaffFile(targetStore);
    
    let currentStaff = readJson(file);
    const addedStaff = staffList.map(s => ({
        id: Date.now() + Math.floor(Math.random() * 10000),
        ...s,
        updatedAt: new Date().toISOString()
    }));
    
    currentStaff = [...currentStaff, ...addedStaff];
    
    if (writeJson(file, currentStaff)) {
        addLog(targetStore, actor, '등록', addedStaff.map(s=>s.name).join(','), `${addedStaff.length}명 등록`);
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

// 직원 삭제
app.delete('/api/staff/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { actor, store } = req.query;
    const targetStore = store || 'chogazip';
    const file = getStaffFile(targetStore);
    
    let currentStaff = readJson(file);
    const target = currentStaff.find(s => s.id === id);
    if (!target) return res.status(404).json({ success: false });
    
    const filtered = currentStaff.filter(s => s.id !== id);
    if (writeJson(file, filtered)) {
        addLog(targetStore, actor, '삭제', target.name, '삭제됨');
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

// 직원 수정
app.put('/api/staff/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { updates, actor, store } = req.body;
    const targetStore = store || 'chogazip';
    const file = getStaffFile(targetStore);
    
    let currentStaff = readJson(file);
    const idx = currentStaff.findIndex(s => s.id === id);
    
    if (idx !== -1) {
        currentStaff[idx] = { ...currentStaff[idx], ...updates };
        writeJson(file, currentStaff);
        addLog(targetStore, actor, '수정', currentStaff[idx].name, '정보 수정됨');
        res.json({ success: true });
    } else res.status(404).json({ success: false });
});

// 일일 예외/대타 처리
app.post('/api/staff/exception', (req, res) => {
    const { id, date, type, time, actor, store } = req.body;
    const targetStore = store || 'chogazip';
    const file = getStaffFile(targetStore);
    
    let currentStaff = readJson(file);
    const idx = currentStaff.findIndex(s => s.id === parseInt(id));
    
    if (idx === -1) return res.status(404).json({ success: false });
    
    const staff = currentStaff[idx];
    if (!staff.exceptions) staff.exceptions = {};
    
    if (type === 'delete') delete staff.exceptions[date];
    else staff.exceptions[date] = { type, time };
    
    writeJson(file, currentStaff);
    addLog(targetStore, actor, '일일변경', staff.name, `${date} ${type}`);
    res.json({ success: true });
});

app.post('/api/staff/temp', (req, res) => {
    const { name, date, time, actor, store } = req.body;
    const targetStore = store || 'chogazip';
    const file = getStaffFile(targetStore);
    
    let currentStaff = readJson(file);
    const newStaff = {
        id: Date.now(),
        name, workDays: [], time: '', position: '일일알바',
        exceptions: { [date]: { type: 'work', time } },
        isTemp: true
    };
    currentStaff.push(newStaff);
    
    writeJson(file, currentStaff);
    addLog(targetStore, actor, '대타등록', name, `${date} 대타 등록`);
    res.json({ success: true });
});

// 로그 조회 (통합)
app.get('/api/logs', (req, res) => {
    const store = req.query.store || 'chogazip';
    res.json({ success: true, data: readJson(getLogFile(store)) });
});

// ... (기존 server.js 코드 아래에 추가) ...

// [헬퍼 함수] 회계 파일 경로
function getAccountingFile(store) {
    const storeName = store === 'yangeun' ? 'accounting_yangeun.json' : 'accounting_chogazip.json';
    const filePath = path.join(actualDataPath, storeName);
    
    // 파일 없으면 기본 구조 생성 (monthly: 고정비, daily: 일일데이터)
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({ monthly: {}, daily: {} }, null, 2));
    }
    return filePath;
}

// 1. 회계 데이터 조회
app.get('/api/accounting', (req, res) => {
    const { store } = req.query;
    const targetStore = store || 'chogazip';
    res.json({ success: true, data: readJson(getAccountingFile(targetStore)) });
});

// 2. 일일 데이터 저장 (매출/변동비)
app.post('/api/accounting/daily', (req, res) => {
    const { date, data, store } = req.body; // data = { sales, food, meat... }
    const targetStore = store || 'chogazip';
    const file = getAccountingFile(targetStore);
    
    let accData = readJson(file);
    if (!accData.daily) accData.daily = {};
    
    accData.daily[date] = data; // 날짜별 덮어쓰기
    
    if (writeJson(file, accData)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

// 3. 월 고정비 저장
app.post('/api/accounting/fixed', (req, res) => {
    const { month, data, store } = req.body; // month = "2024-12", data = { rent, gas... }
    const targetStore = store || 'chogazip';
    const file = getAccountingFile(targetStore);
    
    let accData = readJson(file);
    if (!accData.monthly) accData.monthly = {};
    
    accData.monthly[month] = data;
    
    if (writeJson(file, accData)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

// [NEW] 가계부 일괄 등록 API (엑셀 업로드용)
app.post('/api/accounting/bulk', (req, res) => {
    const { store, bulkData } = req.body; // bulkData는 배열 형태
    const targetStore = store || 'chogazip';
    const file = getAccountingFile(targetStore);
    
    let accData = readJson(file);
    if (!accData.daily) accData.daily = {};
    
    let count = 0;

    bulkData.forEach(item => {
        // 1. 필수값 0 처리 (빈칸 방지)
        const parse = (val) => parseInt(val) || 0;
        
        const card = parse(item.card);
        const cash = parse(item.cash);
        const transfer = parse(item.transfer);
        const gift = parse(item.gift); // 초가짚용
        const baemin = parse(item.baemin); // 양은이네용
        const yogiyo = parse(item.yogiyo); // 양은이네용
        const coupang = parse(item.coupang); // 양은이네용
        
        const food = parse(item.food);
        const meat = parse(item.meat);
        const etc = parse(item.etc);

        // 2. 매출/지출 합계 자동 계산
        let totalSales = 0;
        if (targetStore === 'yangeun') {
            totalSales = card + cash + transfer + baemin + yogiyo + coupang;
        } else {
            totalSales = card + cash + transfer + gift;
        }
        const totalCost = food + meat + etc;

        // 3. 데이터 구성
        const dateStr = item.date; // YYYY-MM-DD
        if (dateStr) {
            accData.daily[dateStr] = {
                startCash: parse(item.startCash) || 100000, // 시재 기본값
                cash, transfer, bankDeposit: parse(item.bankDeposit),
                card, gift, 
                baemin, yogiyo, coupang,
                sales: totalSales,
                food, meat, etc,
                cost: totalCost,
                note: item.note || '일괄등록됨'
            };
            count++;
        }
    });

    if (writeJson(file, accData)) {
        addLog(targetStore, '사장님', '일괄등록', `${count}건`, '과거 데이터 업로드');
        res.json({ success: true, count: count });
    } else {
        res.status(500).json({ success: false });
    }
});

// 404 및 실행
app.use('*', (req, res) => res.status(404).json({ success: false, error: 'Not Found' }));

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 서버 시작됨 (Port: ${PORT})`);
    await initializeGoogleCalendar();
}).on('error', (err) => console.error('서버 에러:', err));