const fs = require('fs');
const path = require('path');

// === 데이터 경로 설정 ===
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data';
const fallbackPath = path.join(__dirname, '..', '..', 'data');
const actualDataPath = fs.existsSync(VOLUME_PATH) ? VOLUME_PATH : fallbackPath;
if (!fs.existsSync(actualDataPath)) fs.mkdirSync(actualDataPath, { recursive: true });

console.log(`📁 데이터 저장 경로: ${actualDataPath}`);

// === 파일 경로 정의 ===
const FINAL_DATA_FILE = path.join(actualDataPath, 'reservations.json');
const PREPAYMENT_FILE = path.join(actualDataPath, 'prepayments.json');
const KAKAO_TOKEN_FILE = path.join(actualDataPath, 'kakao_token.json');
const MARKETING_FILE = path.join(actualDataPath, 'marketing_ranking.json');
const POS_HISTORY_FILE = path.join(actualDataPath, 'pos_crawl_history.json');
const NOTES_FILE = path.join(actualDataPath, 'operation_notes.json');

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
function getPrepaymentFile(store) {
    const storeName = store === 'yangeun' ? 'prepayments_yangeun.json' : 'prepayments_chogazip.json';
    const filePath = path.join(actualDataPath, storeName);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({ customers: {}, logs: [] }, null, 2));
    }
    return filePath;
}
function getPosDataFile(store) {
    const fileName = store === 'yangeun' ? 'pos_data_yangeun.json' : 'pos_data_chogazip.json';
    return path.join(actualDataPath, fileName);
}

// KST(UTC+9) 기준 현재 Date 객체 반환 (Railway 서버는 UTC)
function getKstNow() {
    const now = new Date();
    return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}

// 로그 기록 함수
function addLog(store, actor, action, target, details) {
    const logFile = getLogFile(store);
    let logs = readJson(logFile, []);
    if (!Array.isArray(logs)) logs = [];

    logs.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        actor, action, target, details
    });
    if (logs.length > 1000) logs.pop();
    writeJson(logFile, logs);
}

module.exports = {
    actualDataPath,
    FINAL_DATA_FILE,
    PREPAYMENT_FILE,
    KAKAO_TOKEN_FILE,
    MARKETING_FILE,
    POS_HISTORY_FILE,
    NOTES_FILE,
    readJson,
    writeJson,
    getStaffFile,
    getLogFile,
    getAccountingFile,
    getPrepaymentFile,
    getPosDataFile,
    addLog,
    getKstNow
};
