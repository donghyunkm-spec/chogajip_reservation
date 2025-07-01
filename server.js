// server.js - Google Calendar 연동 추가
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

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static('.'));  // 현재 디렉토리를 static으로 설정

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

// 시간에 시간 추가하는 함수
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
    res.send(`
        <h1>🏠 초가집 예약 시스템</h1>
        <p>서버가 정상 동작 중입니다!</p>
        <p>현재 시간: ${new Date().toLocaleString('ko-KR')}</p>
        <p>📅 Google Calendar: ${calendarInitialized ? '✅ 연동됨' : '⚠️ 미연동 (환경변수 설정 필요)'}</p>
        <p><a href="/api/ping">시스템 상태 확인</a></p>
        <p><a href="/api/reservations">예약 데이터 확인</a></p>
        
        <h3>📝 테스트용 예약 등록</h3>
        <form action="/api/reservations" method="POST" style="border: 1px solid #ccc; padding: 20px; margin: 20px 0;">
            <input type="hidden" name="_method" value="POST">
            <p>이름: <input type="text" name="name" placeholder="홍길동" required></p>
            <p>인원: <input type="number" name="people" value="4" min="1" max="20" required></p>
            <p>날짜: <input type="date" name="date" value="${new Date().toISOString().split('T')[0]}" required></p>
            <p>시간: <input type="time" name="time" value="19:00" required></p>
            <p>선호도: 
                <select name="preference">
                    <option value="any">관계없음</option>
                    <option value="room">룸 선호</option>
                    <option value="hall">홀 선호</option>
                </select>
            </p>
            <button type="submit" onclick="submitReservation(event)">예약 등록 테스트</button>
        </form>
        
        <script>
            function submitReservation(e) {
                e.preventDefault();
                const form = e.target.closest('form');
                const formData = new FormData(form);
                const data = Object.fromEntries(formData);
                
                fetch('/api/reservations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                })
                .then(res => res.json())
                .then(result => {
                    alert(result.message || result.error);
                    if (result.success) form.reset();
                })
                .catch(err => alert('오류: ' + err.message));
            }
        </script>
    `);
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
        
        if (!newReservation.name || !newReservation.people) {
            return res.status(400).json({ 
                success: false, 
                error: '필수 정보가 누락되었습니다.' 
            });
        }

        const reservations = readReservations();
        newReservation.id = Date.now();
        newReservation.timestamp = new Date().toISOString();

        // Google Calendar 이벤트 생성 시도
        const calendarEventId = await createCalendarEvent(newReservation);
        if (calendarEventId) {
            newReservation.calendarEventId = calendarEventId;
        }

        reservations.push(newReservation);
        
        if (writeReservations(reservations)) {
            console.log(`✅ 새 예약: ${newReservation.name}님`);
            res.json({ 
                success: true, 
                message: '예약이 성공적으로 등록되었습니다.' + (calendarEventId ? ' (Google Calendar 연동됨)' : ''),
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

// 404 처리
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