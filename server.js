const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
// const { google } = require('googleapis'); // 캘린더 미사용시 주석

const app = express();
const PORT = process.env.PORT || 3000;

// === 데이터 경로 설정 ===
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data';
const fallbackPath = path.join(__dirname, 'data');
const actualDataPath = fs.existsSync(VOLUME_PATH) ? VOLUME_PATH : fallbackPath;
if (!fs.existsSync(actualDataPath)) fs.mkdirSync(actualDataPath, { recursive: true });

console.log(`📁 데이터 저장 경로: ${actualDataPath}`);

// === 파일 경로 정의 ===
const FINAL_DATA_FILE = path.join(actualDataPath, 'reservations.json');
const PREPAYMENT_FILE = path.join(actualDataPath, 'prepayments.json');

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
app.get('/api/prepayments', (req, res) => {
    // 안전하게 객체 기본값 제공
    let data = readJson(PREPAYMENT_FILE, { customers: {}, logs: [] });
    // 만약 파일이 깨져서 배열로 되어있다면 강제 복구
    if (Array.isArray(data)) data = { customers: {}, logs: [] };
    res.json({ success: true, data });
});

app.post('/api/prepayments', (req, res) => {
    const { customerName, amount, type, date, note, actor, store } = req.body;
    let data = readJson(PREPAYMENT_FILE, { customers: {}, logs: [] });
    if (Array.isArray(data)) data = { customers: {}, logs: [] };

    if (!data.customers[customerName]) {
        data.customers[customerName] = { balance: 0, lastUpdate: "" };
    }

    const val = parseInt(amount);
    if (type === 'charge') data.customers[customerName].balance += val;
    else data.customers[customerName].balance -= val;

    data.customers[customerName].lastUpdate = date;
    
    data.logs.unshift({
        id: Date.now() + Math.random(), // 중복 방지용 랜덤 추가
        date, customerName, type, amount: val,
        currentBalance: data.customers[customerName].balance,
        note, actor
    });

    if (writeJson(PREPAYMENT_FILE, data)) {
        addLog(store, actor, type === 'charge'?'선결충전':'선결사용', customerName, `${amount}원`);
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

app.delete('/api/prepayments/:id', (req, res) => {
    const logId = parseFloat(req.params.id); // ID가 소수점일 수 있음
    const { actor, store } = req.body;

    let data = readJson(PREPAYMENT_FILE, { customers: {}, logs: [] });
    if (Array.isArray(data)) {
        // 데이터가 깨진 상태라면 복구 시도 불가하므로 에러 리턴 혹은 초기화
        return res.status(500).json({ success: false, error: 'Data corrupted' });
    }

    const idx = data.logs.findIndex(l => l.id === logId);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' });

    const target = data.logs[idx];

    // 잔액 원복 (고객이 여전히 존재할 때만)
    if (data.customers[target.customerName]) {
        if (target.type === 'charge') data.customers[target.customerName].balance -= target.amount;
        else data.customers[target.customerName].balance += target.amount;
    }

    // 로그 삭제
    data.logs.splice(idx, 1);

    if (writeJson(PREPAYMENT_FILE, data)) {
        addLog(store, actor, '선결취소', target.customerName, '기록삭제 및 잔액원복');
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

// 로그 조회
app.get('/api/logs', (req, res) => {
    const file = getLogFile(req.query.store || 'chogazip');
    res.json({ success: true, data: readJson(file, []) });
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});