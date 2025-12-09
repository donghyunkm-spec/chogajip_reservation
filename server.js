// server.js - Google Calendar 연동 + 수동 테이블 배정
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// Google Calendar API 설정
let calendar = null;
let calendarInitialized = false;

// 시간 겹침 확인 함수
function isTimeOverlap(time1, time2) {
    if (time1 === time2) return true;
    
    const [hour1, minute1] = time1.split(':').map(Number);
    const [hour2, minute2] = time2.split(':').map(Number);
    
    const startTime1 = hour1 * 60 + minute1;
    const endTime1 = startTime1 + 180; // 3시간 이용
    
    const startTime2 = hour2 * 60 + minute2;
    const endTime2 = startTime2 + 180; // 3시간 이용
    
    return (startTime1 < endTime2 && startTime2 < endTime1);
}

// 데이터 파일 경로 도우미 함수
function getStaffFile(store) {
    const storeName = store === 'yangeun' ? 'staff_yangeun.json' : 'staff.json'; // 기본값 chogazip(staff.json)
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

// 테이블 충돌 검사 함수
function checkTableConflict(newReservation, existingReservations) {
    const conflictingReservations = existingReservations.filter(r => 
        r.status === 'active' && 
        r.date === newReservation.date && 
        isTimeOverlap(r.time, newReservation.time)
    );
    
    const usedTables = new Set();
    conflictingReservations.forEach(r => {
        if (r.tables) {
            r.tables.forEach(t => usedTables.add(t));
        }
    });
    
    // 새 예약의 테이블 중 이미 사용 중인 테이블이 있는지 확인
    const conflictTables = newReservation.tables.filter(t => usedTables.has(t));
    
    return conflictTables;
}

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));  // 현재 디렉토리를 static으로 설정

// Google Calendar 초기화
async function initializeGoogleCalendar() {
    try {
        // 환경변수 확인
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        
        if (!serviceAccountKey || !calendarId) {
            console.log('⚠️ Google Calendar 환경변수 미설정 - Calendar 연동 건너뜀');
            console.log('필요 환경변수: GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_CALENDAR_ID');
            return false;
        }

        // JSON 키 파싱
        const credentials = JSON.parse(serviceAccountKey);
        
        // JWT 인증 설정
        const auth = new google.auth.JWT(
            credentials.client_email,
            null,
            credentials.private_key,
            ['https://www.googleapis.com/auth/calendar']
        );

        // Calendar API 초기화
        calendar = google.calendar({ version: 'v3', auth });
        
        // 연결 테스트
        await calendar.calendars.get({ calendarId: calendarId });
        
        calendarInitialized = true;
        console.log('✅ Google Calendar API 초기화 성공');
        return true;
        
    } catch (error) {
        console.error('❌ Google Calendar 초기화 실패:', error.message);
        console.log('📝 Google Calendar 없이 계속 진행됩니다.');
        return false;
    }
}

// Google Calendar 이벤트 생성
async function createCalendarEvent(reservation) {
    if (!calendarInitialized || !calendar) {
        console.log('Calendar 미초기화 - 이벤트 생성 건너뜀');
        return null;
    }
    
    try {
        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        
        // 3시간 이용 시간 계산
        const startDateTime = `${reservation.date}T${reservation.time}:00`;
        const endTime = addHours(reservation.time, 3);
        const endDateTime = `${reservation.date}T${endTime}:00`;
        
        // 테이블 표시를 T/R 형식으로 변환
        const displayTables = reservation.tables ? reservation.tables.map(t => {
            if (t.startsWith('hall-')) {
                return 'T' + t.split('-')[1];
            } else if (t.startsWith('room-')) {
                return 'R' + t.split('-')[1];
            }
            return t;
        }).join(', ') : '미배정';
        
        const event = {
            summary: `🏠 ${reservation.name}님 ${reservation.people}명 (${displayTables})`,
            description: `
📍 테이블: ${displayTables}
👥 인원: ${reservation.people}명
🪑 좌석선호: ${getPreferenceText(reservation.preference)}
📞 연락처: ${reservation.phone || '미입력'}
⏰ 등록시간: ${new Date(reservation.timestamp).toLocaleString('ko-KR')}
            `.trim(),
            start: {
                dateTime: startDateTime,
                timeZone: 'Asia/Seoul'
            },
            end: {
                dateTime: endDateTime,
                timeZone: 'Asia/Seoul'
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: 15 },
                    { method: 'popup', minutes: 5 }
                ]
            }
        };

        const response = await calendar.events.insert({
            calendarId: calendarId,
            resource: event
        });

        console.log(`📅 Google Calendar 이벤트 생성: ${response.data.id}`);
        return response.data.id;
        
    } catch (error) {
        console.error('❌ Calendar 이벤트 생성 실패:', error.message);
        return null;
    }
}

// Google Calendar 이벤트 업데이트
async function updateCalendarEvent(reservation) {
    if (!calendarInitialized || !calendar || !reservation.calendarEventId) {
        console.log('Calendar 미초기화 또는 이벤트ID 없음 - 업데이트 건너뜀');
        return false;
    }
    
    try {
        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        
        const startDateTime = `${reservation.date}T${reservation.time}:00`;
        const endTime = addHours(reservation.time, 3);
        const endDateTime = `${reservation.date}T${endTime}:00`;
        
        // 테이블 표시를 T/R 형식으로 변환
        const displayTables = reservation.tables ? reservation.tables.map(t => {
            if (t.startsWith('hall-')) {
                return 'T' + t.split('-')[1];
            } else if (t.startsWith('room-')) {
                return 'R' + t.split('-')[1];
            }
            return t;
        }).join(', ') : '미배정';
        
        const event = {
            summary: `🏠 ${reservation.name}님 ${reservation.people}명 (${displayTables})`,
            description: `
📍 테이블: ${displayTables}
👥 인원: ${reservation.people}명
🪑 좌석선호: ${getPreferenceText(reservation.preference)}
📞 연락처: ${reservation.phone || '미입력'}
⏰ 수정시간: ${new Date().toLocaleString('ko-KR')}
            `.trim(),
            start: {
                dateTime: startDateTime,
                timeZone: 'Asia/Seoul'
            },
            end: {
                dateTime: endDateTime,
                timeZone: 'Asia/Seoul'
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: 15 },
                    { method: 'popup', minutes: 5 }
                ]
            }
        };

        await calendar.events.update({
            calendarId: calendarId,
            eventId: reservation.calendarEventId,
            resource: event
        });

        console.log(`📅 Google Calendar 이벤트 업데이트: ${reservation.calendarEventId}`);
        return true;
        
    } catch (error) {
        console.error('❌ Calendar 이벤트 업데이트 실패:', error.message);
        return false;
    }
}

// Google Calendar 이벤트 삭제
async function deleteCalendarEvent(eventId) {
    if (!calendarInitialized || !calendar || !eventId) {
        console.log('Calendar 미초기화 또는 이벤트ID 없음 - 삭제 건너뜀');
        return false;
    }
    
    try {
        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        
        await calendar.events.delete({
            calendarId: calendarId,
            eventId: eventId
        });

        console.log(`📅 Google Calendar 이벤트 삭제: ${eventId}`);
        return true;
        
    } catch (error) {
        console.error('❌ Calendar 이벤트 삭제 실패:', error.message);
        return false;
    }
}

function addHours(timeStr, hours) {
    const [hourStr, minuteStr] = timeStr.split(':');
    let hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);
    
    hour = (hour + hours) % 24;
    
    return `${hour.toString().padStart(2, '0')}:${minuteStr}`;
}

// 선호도 텍스트 변환
function getPreferenceText(preference) {
    switch(preference) {
        case 'room': return '룸 선호';
        case 'hall': return '홀 선호';
        default: return '관계없음';
    }
}

// Railway Volume 경로 사용 (영구 저장)
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data';
const DATA_FILE = path.join(VOLUME_PATH, 'reservations.json');

console.log(`📁 Volume 경로 설정: ${VOLUME_PATH}`);
console.log(`📄 데이터 파일 설정: ${DATA_FILE}`);

// 볼륨 디렉토리 생성
function ensureVolumeDirectory() {
    try {
        if (!fs.existsSync(VOLUME_PATH)) {
            fs.mkdirSync(VOLUME_PATH, { recursive: true });
            console.log(`📁 볼륨 디렉토리 생성 완료: ${VOLUME_PATH}`);
        }
        return VOLUME_PATH;
    } catch (error) {
        console.error(`❌ 볼륨 디렉토리 오류:`, error);
        const fallbackPath = path.join(__dirname, 'data');
        if (!fs.existsSync(fallbackPath)) {
            fs.mkdirSync(fallbackPath, { recursive: true });
        }
        return fallbackPath;
    }
}

// 초기화
const actualDataPath = ensureVolumeDirectory();
const FINAL_DATA_FILE = path.join(actualDataPath, 'reservations.json');

// 초기 데이터 파일 생성
if (!fs.existsSync(FINAL_DATA_FILE)) {
    fs.writeFileSync(FINAL_DATA_FILE, JSON.stringify([], null, 2));
    console.log(`📄 새 데이터 파일 생성: ${FINAL_DATA_FILE}`);
}

// 데이터 읽기
function readReservations() {
    try {
        const data = fs.readFileSync(FINAL_DATA_FILE, 'utf8');
        return JSON.parse(data) || [];
    } catch (error) {
        console.error('데이터 읽기 오류:', error);
        return [];
    }
}

// 데이터 쓰기
function writeReservations(reservations) {
    try {
        fs.writeFileSync(FINAL_DATA_FILE, JSON.stringify(reservations, null, 2));
        return true;
    } catch (error) {
        console.error('데이터 쓰기 오류:', error);
        return false;
    }
}

// API 엔드포인트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/ping', (req, res) => {
    try {
        const reservations = readReservations();
        res.json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            reservationCount: reservations.length,
            calendarEnabled: calendarInitialized,
            message: '서버 정상 동작 중!' + (calendarInitialized ? ' (Google Calendar 연동됨)' : ' (Google Calendar 미연동)')
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

app.get('/api/reservations', (req, res) => {
    try {
        const reservations = readReservations();
        res.json({ 
            success: true, 
            data: reservations,
            count: reservations.length
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: '예약 데이터를 불러올 수 없습니다: ' + error.message
        });
    }
});

app.post('/api/reservations', async (req, res) => {
    try {
        const newReservation = req.body;
        
        // 필수 정보 검증
        if (!newReservation.name || !newReservation.people || !newReservation.date || !newReservation.time || !newReservation.tables) {
            return res.status(400).json({ 
                success: false, 
                error: '필수 정보가 누락되었습니다. (이름, 인원수, 날짜, 시간, 테이블)' 
            });
        }

        // 테이블이 배열인지 확인
        if (!Array.isArray(newReservation.tables) || newReservation.tables.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: '테이블을 선택해주세요.' 
            });
        }

        const reservations = readReservations();
        
        // 테이블 충돌 검사
        const conflictTables = checkTableConflict(newReservation, reservations);
        if (conflictTables.length > 0) {
            const displayConflictTables = conflictTables.map(t => {
                if (t.startsWith('hall-')) {
                    return 'T' + t.split('-')[1];
                } else if (t.startsWith('room-')) {
                    return 'R' + t.split('-')[1];
                }
                return t;
            }).join(', ');
            
            return res.status(400).json({
                success: false,
                error: `선택한 테이블 중 일부가 이미 예약되어 있습니다: ${displayConflictTables}`
            });
        }

        // 예약 정보 설정
        newReservation.id = Date.now();
        newReservation.timestamp = new Date().toISOString();
        newReservation.status = 'active';

        // 테이블 표시를 위한 변환
        const displayTables = newReservation.tables.map(t => {
            if (t.startsWith('hall-')) {
                return 'T' + t.split('-')[1];
            } else if (t.startsWith('room-')) {
                return 'R' + t.split('-')[1];
            }
            return t;
        });

        // Google Calendar 이벤트 생성 시도
        const calendarEventId = await createCalendarEvent(newReservation);
        if (calendarEventId) {
            newReservation.calendarEventId = calendarEventId;
        }

        reservations.push(newReservation);
        
        if (writeReservations(reservations)) {
            console.log(`✅ 새 예약: ${newReservation.name}님 (${newReservation.people}명) - 테이블: ${displayTables.join(', ')}`);
            res.json({ 
                success: true, 
                message: `예약이 완료되었습니다! 배정 테이블: ${displayTables.join(', ')}` + (calendarEventId ? ' (Google Calendar 연동됨)' : ''),
                data: newReservation
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: '예약 저장에 실패했습니다.' 
            });
        }
    } catch (error) {
        console.error('예약 추가 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '서버 오류가 발생했습니다.' 
        });
    }
});

app.put('/api/reservations/:id', async (req, res) => {
    try {
        const reservationId = parseInt(req.params.id);
        const updates = req.body;
        
        const reservations = readReservations();
        const reservationIndex = reservations.findIndex(r => r.id === reservationId);
        
        if (reservationIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: '예약을 찾을 수 없습니다.' 
            });
        }

        const oldReservation = reservations[reservationIndex];
        
        // 테이블 충돌 검사 (현재 예약 제외)
        if (updates.tables && Array.isArray(updates.tables)) {
            const tempReservations = [...reservations];
            tempReservations.splice(reservationIndex, 1); // 현재 예약 제외
            
            const testReservation = {
                ...oldReservation,
                ...updates
            };
            
            const conflictTables = checkTableConflict(testReservation, tempReservations);
            if (conflictTables.length > 0) {
                const displayConflictTables = conflictTables.map(t => {
                    if (t.startsWith('hall-')) {
                        return 'T' + t.split('-')[1];
                    } else if (t.startsWith('room-')) {
                        return 'R' + t.split('-')[1];
                    }
                    return t;
                }).join(', ');
                
                return res.status(400).json({
                    success: false,
                    error: `선택한 테이블 중 일부가 이미 예약되어 있습니다: ${displayConflictTables}`
                });
            }
        }
        
        reservations[reservationIndex] = { 
			...oldReservation, 
			...updates,
			calendarEventId: oldReservation.calendarEventId, // 기존 calendarEventId 보존
			updatedAt: new Date().toISOString()
		};
        
        // Google Calendar 이벤트 업데이트 시도
        const calendarUpdated = await updateCalendarEvent(reservations[reservationIndex]);
        
        if (writeReservations(reservations)) {
            console.log(`✏️ 예약 수정: ID ${reservationId}`);
            res.json({ 
                success: true, 
                message: '예약이 성공적으로 수정되었습니다.' + (calendarUpdated ? ' (Google Calendar 업데이트됨)' : ''),
                data: reservations[reservationIndex]
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: '예약 수정에 실패했습니다.' 
            });
        }
    } catch (error) {
        console.error('예약 수정 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '서버 오류가 발생했습니다.' 
        });
    }
});

app.delete('/api/reservations/:id', async (req, res) => {
    try {
        const reservationId = parseInt(req.params.id);
        
        const reservations = readReservations();
        const reservationIndex = reservations.findIndex(r => r.id === reservationId);
        
        if (reservationIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: '예약을 찾을 수 없습니다.' 
            });
        }

        const deletedReservation = reservations.splice(reservationIndex, 1)[0];
        
        // Google Calendar 이벤트 삭제 시도
        let calendarDeleted = false;
        if (deletedReservation.calendarEventId) {
            calendarDeleted = await deleteCalendarEvent(deletedReservation.calendarEventId);
        }
        
        if (writeReservations(reservations)) {
            console.log(`🗑️ 예약 삭제: ${deletedReservation.name}님`);
            res.json({ 
                success: true, 
                message: '예약이 성공적으로 삭제되었습니다.' + (calendarDeleted ? ' (Google Calendar에서도 삭제됨)' : ''),
                data: deletedReservation
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: '예약 삭제에 실패했습니다.' 
            });
        }
    } catch (error) {
        console.error('예약 삭제 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '서버 오류가 발생했습니다.' 
        });
    }
});



// ... (기존 예약 관련 코드 유지) ...

// ==========================================
// [업데이트] 직원 관리 + 로그 시스템
// ==========================================

const STAFF_DATA_FILE = path.join(actualDataPath, 'staff.json');
const LOG_DATA_FILE = path.join(actualDataPath, 'logs.json'); // 로그 파일 경로

// 파일 초기화
if (!fs.existsSync(STAFF_DATA_FILE)) fs.writeFileSync(STAFF_DATA_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(LOG_DATA_FILE)) fs.writeFileSync(LOG_DATA_FILE, JSON.stringify([], null, 2));

function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')) || []; } 
    catch (e) { return []; }
}

function writeJson(file, data) {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); return true; } 
    catch (e) { return false; }
}

// 로그 기록 함수 (store 파라미터 추가)
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
    logs.unshift(newLog);
    if (logs.length > 1000) logs.pop();
    writeJson(logFile, logs);
}

// 1. 로그인 API
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === 'admin1234!') res.json({ success: true, role: 'admin', name: '사장님' });
    else if (password === 'chogazip1234') res.json({ success: true, role: 'manager', name: '점장님' });
    else if (password === 'chrkwlv1234!') res.json({ success: true, role: 'viewer', name: '직원' });
    else res.status(401).json({ success: false, message: '비밀번호 불일치' });
});

// 2. 직원 목록 조회 (store 쿼리 파라미터 처리)
app.get('/api/staff', (req, res) => {
    const store = req.query.store || 'chogazip';
    const file = getStaffFile(store);
    res.json({ success: true, data: readJson(file) });
});

// 3. 직원 등록 (일괄/개별)
app.post('/api/staff', (req, res) => {
    const { staffList, actor, store } = req.body; // store 받기
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
        const names = addedStaff.map(s => s.name).join(', ');
        addLog(targetStore, actor || 'Unknown', '등록', names, `${addedStaff.length}명 신규/일괄 등록됨`);
        res.json({ success: true, message: '등록 완료' });
    } else {
        res.status(500).json({ success: false, error: '저장 실패' });
    }
});

// 4. 직원 삭제
app.delete('/api/staff/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { actor, store } = req.query; // query로 받음
    const targetStore = store || 'chogazip';
    const file = getStaffFile(targetStore);
    
    let currentStaff = readJson(file);
    const target = currentStaff.find(s => s.id === id);
    
    if (!target) return res.status(404).json({success: false});

    const filtered = currentStaff.filter(s => s.id !== id);
    
    if (writeJson(file, filtered)) {
        addLog(targetStore, actor || 'Unknown', '삭제', target.name, '직원 정보 삭제됨');
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

// 5. 직원 개별 수정 (패턴 수정)
app.put('/api/staff/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { updates, actor, store } = req.body;
    const targetStore = store || 'chogazip';
    const file = getStaffFile(targetStore);
    
    let currentStaff = readJson(file);
    const index = currentStaff.findIndex(s => s.id === id);
    if (index !== -1) {
        const oldData = currentStaff[index];
        currentStaff[index] = { ...oldData, ...updates, updatedAt: new Date().toISOString() };
        
        if (writeJson(file, currentStaff)) {
            addLog(targetStore, actor || 'Unknown', '패턴수정', oldData.name, '고정 근무 패턴 변경됨');
            res.json({ success: true });
        } else res.status(500).json({ success: false });
    } else res.status(404).json({ success: false });
});

// 6. 날짜별 예외(변동) 등록 API
app.post('/api/staff/exception', (req, res) => {
    const { id, date, type, time, actor, store } = req.body; 
    const targetStore = store || 'chogazip';
    const file = getStaffFile(targetStore);
    
    let currentStaff = readJson(file);
    const index = currentStaff.findIndex(s => s.id === parseInt(id));
    
    if (index === -1) return res.status(404).json({success: false, message: '직원 없음'});

    const staff = currentStaff[index];
    if (!staff.exceptions) staff.exceptions = {};

    let logMsg = '';
    if (type === 'delete') {
        delete staff.exceptions[date];
        logMsg = `${date} 근무 설정 초기화(원래대로)`;
    } else {
        staff.exceptions[date] = { type, time };
        logMsg = `${date}일 ${type === 'off' ? '휴무 처리' : '시간 변경/추가 근무'}`;
        if (time) logMsg += ` (${time})`;
    }

    if (writeJson(file, currentStaff)) {
        addLog(targetStore, actor || 'Unknown', '일일변경', staff.name, logMsg);
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false, error: '저장 실패' });
    }
});

// 7. 일일 알바(대타) 등록 API
app.post('/api/staff/temp', (req, res) => {
    const { name, date, time, actor, store } = req.body;
    const targetStore = store || 'chogazip';
    const file = getStaffFile(targetStore);
    
    let currentStaff = readJson(file);

    const newStaff = {
        id: Date.now(),
        name: name,
        workDays: [],
        time: '',
        position: '일일알바',
        exceptions: {
            [date]: { type: 'work', time: time }
        },
        isTemp: true
    };

    currentStaff.push(newStaff);

    if (writeJson(file, currentStaff)) {
        addLog(targetStore, actor || 'Unknown', '대타등록', name, `${date} 일일 근무 등록`);
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

// 8. 로그 조회 API
app.get('/api/logs', (req, res) => {
    const store = req.query.store || 'chogazip';
    const file = getLogFile(store);
    res.json({ success: true, data: readJson(file) });
});

// ... (로그 조회 API 및 404 처리, listen 등 하단 코드 유지) ...

// 6. 로그 조회 API (관리자용)
app.get('/api/logs', (req, res) => {
    res.json({ success: true, data: readJson(LOG_DATA_FILE) });
});

app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'API 엔드포인트를 찾을 수 없습니다.' 
    });
});


// 서버 시작
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🏠 초가집 예약 시스템 서버 시작됨 - 포트 ${PORT}`);
    console.log(`📁 데이터 경로: ${FINAL_DATA_FILE}`);
    console.log(`🌐 서버 주소: http://0.0.0.0:${PORT}`);
    
    // Google Calendar 초기화
    console.log(`📅 Google Calendar 초기화 시작...`);
    await initializeGoogleCalendar();
    
    console.log(`✅ 서버 정상 동작 중! (수동 테이블 배정 모드)`);
}).on('error', (error) => {
    console.error(`❌ 서버 시작 오류:`, error);
});