// server.js - Google Calendar 연동 + 테이블 배정 알고리즘
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

// 테이블 정보 (테이블별 수용 인원)
const TABLE_INFO = {
    hall: {
        1: { capacity: 5 },  // 홀 1번 테이블은 5명까지
        2: { capacity: 4 }, 3: { capacity: 4 }, 4: { capacity: 4 },
        5: { capacity: 4 }, 6: { capacity: 4 }, 7: { capacity: 4 },
        8: { capacity: 4 }, 9: { capacity: 4 }, 10: { capacity: 4 },
        11: { capacity: 4 }, 12: { capacity: 4 }, 13: { capacity: 4 },
        14: { capacity: 4 }, 15: { capacity: 4 }, 16: { capacity: 4 }
    },
    room: {
        1: { capacity: 4 }, 2: { capacity: 4 }, 3: { capacity: 4 },
        4: { capacity: 4 }, 5: { capacity: 4 }, 6: { capacity: 4 },
        7: { capacity: 4 }, 8: { capacity: 4 }, 9: { capacity: 4 }
    }
};

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

// 사용 중인 테이블 목록 가져오기
function getUsedTables(reservations) {
    const usedTables = new Set();
    reservations.forEach(reservation => {
        if (reservation.tables && reservation.tables.length > 0) {
            reservation.tables.forEach(table => usedTables.add(table));
        }
    });
    return usedTables;
}

// 기본 테이블 배정 함수
function assignTables(people, preference, date, time, allReservations) {
    console.log(`테이블 배정 시작: ${people}명, 선호도: ${preference}, 날짜: ${date}, 시간: ${time}`);
    
    // 같은 날짜/시간대 예약 필터링
    const activeReservations = allReservations.filter(r => r.status === 'active' || !r.status);
    const conflictingReservations = activeReservations.filter(r => 
        r.date === date && isTimeOverlap(r.time, time)
    );
    
    const usedTables = getUsedTables(conflictingReservations);
    console.log(`사용 중인 테이블: ${Array.from(usedTables).join(', ')}`);
    
    // 1명~4명: 개별 테이블 배정
    if (people <= 4) {
        // 선호도에 따른 배정
        if (preference === 'room') {
            // 룸 우선
            for (let i = 1; i <= 9; i++) {
                const tableId = `room-${i}`;
                if (!usedTables.has(tableId)) {
                    console.log(`룸 배정 성공: ${tableId}`);
                    return [tableId];
                }
            }
            // 룸이 없으면 홀
            for (let i = 9; i <= 16; i++) {
                const tableId = `hall-${i}`;
                if (!usedTables.has(tableId)) {
                    console.log(`홀 배정 (룸 대안): ${tableId}`);
                    return [tableId];
                }
            }
        } else if (preference === 'hall') {
            // 홀 우선 (9~16번)
            for (let i = 9; i <= 16; i++) {
                const tableId = `hall-${i}`;
                if (!usedTables.has(tableId)) {
                    console.log(`홀 배정 성공: ${tableId}`);
                    return [tableId];
                }
            }
            // 홀이 없으면 룸
            for (let i = 1; i <= 9; i++) {
                const tableId = `room-${i}`;
                if (!usedTables.has(tableId)) {
                    console.log(`룸 배정 (홀 대안): ${tableId}`);
                    return [tableId];
                }
            }
        } else {
            // 관계없음: 룸 우선
            for (let i = 1; i <= 9; i++) {
                const tableId = `room-${i}`;
                if (!usedTables.has(tableId)) {
                    console.log(`룸 배정 성공 (관계없음): ${tableId}`);
                    return [tableId];
                }
            }
            for (let i = 9; i <= 16; i++) {
                const tableId = `hall-${i}`;
                if (!usedTables.has(tableId)) {
                    console.log(`홀 배정 성공 (관계없음): ${tableId}`);
                    return [tableId];
                }
            }
        }
    }
    
    // 5명: 홀 1번 우선
    if (people === 5 && !usedTables.has('hall-1')) {
        console.log(`5명 홀1번 배정: hall-1`);
        return ['hall-1'];
    }
    
    // 5명 이상: 단체석 배정
    if (people >= 5) {
        // 룸 선호 단체석
        if (preference === 'room') {
            if (people <= 8) {
                // 룸 2개 테이블 조합
                const roomPairs = [
                    ['room-1', 'room-2'], ['room-2', 'room-3'],
                    ['room-4', 'room-5'], ['room-5', 'room-6'],
                    ['room-7', 'room-8'], ['room-8', 'room-9']
                ];
                for (const pair of roomPairs) {
                    if (!usedTables.has(pair[0]) && !usedTables.has(pair[1])) {
                        console.log(`룸 단체석 배정: ${pair.join(', ')}`);
                        return pair;
                    }
                }
            }
            if (people >= 9 && people <= 12) {
                // 룸 3개 테이블 조합
                const roomGroups = [
                    ['room-1', 'room-2', 'room-3'],
                    ['room-4', 'room-5', 'room-6'],
                    ['room-7', 'room-8', 'room-9']
                ];
                for (const group of roomGroups) {
                    if (group.every(t => !usedTables.has(t))) {
                        console.log(`룸 단체석 배정: ${group.join(', ')}`);
                        return group;
                    }
                }
            }
        }
        
        // 홀 단체석 (5~8명)
        if (people >= 5 && people <= 8) {
            const hallPairs = [
                ['hall-1', 'hall-2'], ['hall-3', 'hall-4'], 
                ['hall-5', 'hall-6'], ['hall-7', 'hall-8']
            ];
            for (const pair of hallPairs) {
                if (!usedTables.has(pair[0]) && !usedTables.has(pair[1])) {
                    console.log(`홀 단체석 배정: ${pair.join(', ')}`);
                    return pair;
                }
            }
        }
    }
    
    console.log(`모든 배정 시도 실패`);
    return []; // 배정 실패
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
        
        const event = {
            summary: `🏠 ${reservation.name}님 ${reservation.people}명`,
            description: `
📍 테이블: ${reservation.tables ? reservation.tables.join(', ') : '미배정'}
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
        
        const event = {
            summary: `🏠 ${reservation.name}님 ${reservation.people}명`,
            description: `
📍 테이블: ${reservation.tables ? reservation.tables.join(', ') : '미배정'}
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
        
        if (!newReservation.name || !newReservation.people || !newReservation.date || !newReservation.time) {
            return res.status(400).json({ 
                success: false, 
                error: '필수 정보가 누락되었습니다.' 
            });
        }

        const reservations = readReservations();
        newReservation.id = Date.now();
        newReservation.timestamp = new Date().toISOString();
        newReservation.status = 'active';

        // 스마트 테이블 배정
        const assignedTables = assignTables(
            newReservation.people, 
            newReservation.preference || 'any', 
            newReservation.date, 
            newReservation.time, 
            reservations
        );

        if (assignedTables.length > 0) {
            newReservation.tables = assignedTables;

            // Google Calendar 이벤트 생성 시도
            const calendarEventId = await createCalendarEvent(newReservation);
            if (calendarEventId) {
                newReservation.calendarEventId = calendarEventId;
            }

            reservations.push(newReservation);
            
            if (writeReservations(reservations)) {
                console.log(`✅ 새 예약: ${newReservation.name}님 (${newReservation.people}명) - 테이블: ${assignedTables.join(', ')}`);
                res.json({ 
                    success: true, 
                    message: `예약이 완료되었습니다! 배정 테이블: ${assignedTables.join(', ')}` + (calendarEventId ? ' (Google Calendar 연동됨)' : ''),
                    data: newReservation
                });
            } else {
                res.status(500).json({ 
                    success: false, 
                    error: '예약 저장에 실패했습니다.' 
                });
            }
        } else {
            res.status(400).json({
                success: false,
                error: `죄송합니다. 해당 시간대(${newReservation.time})에 ${newReservation.people}명이 앉을 수 있는 자리가 없습니다.`
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
        
        // 테이블 재배정이 필요한 경우
        if (updates.people || updates.date || updates.time || updates.preference) {
            const tempReservations = [...reservations];
            tempReservations.splice(reservationIndex, 1); // 현재 예약 제외
            
            const newTables = assignTables(
                updates.people || oldReservation.people,
                updates.preference || oldReservation.preference,
                updates.date || oldReservation.date,
                updates.time || oldReservation.time,
                tempReservations
            );
            
            if (newTables.length > 0) {
                updates.tables = newTables;
            } else {
                return res.status(400).json({
                    success: false,
                    error: '해당 조건으로 예약 수정이 어렵습니다. 다른 시간대를 선택해주세요.'
                });
            }
        }
        
        reservations[reservationIndex] = { 
            ...oldReservation, 
            ...updates,
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
    
    console.log(`✅ 서버 정상 동작 중!`);
}).on('error', (error) => {
    console.error(`❌ 서버 시작 오류:`, error);
});