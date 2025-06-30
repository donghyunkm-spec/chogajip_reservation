// server.js - Railway Volume 영구 저장 + Google Calendar 연동
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { google } = require('googleapis');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// Google Calendar API 설정
let calendar = null;
let calendarInitialized = false;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static('public'));  // public 사용

// Google Calendar 초기화
async function initializeGoogleCalendar() {
    try {
        // 환경변수에서 서비스 어카운트 키 가져오기
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
📝 예약방법: ${getMethodText(reservation.reservationMethod)}
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
📝 예약방법: ${getMethodText(reservation.reservationMethod)}
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

// 예약방법 텍스트 변환
function getMethodText(method) {
    switch(method) {
        case 'phone': return '전화';
        case 'naver': return '네이버';
        default: return '선택안함';
    }
}

// Railway Volume 경로 사용 (영구 저장) - 로깅 강화
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data';
const DATA_FILE = path.join(VOLUME_PATH, 'reservations.json');

console.log(`📁 Volume 경로 설정: ${VOLUME_PATH}`);
console.log(`📄 데이터 파일 설정: ${DATA_FILE}`);
console.log(`🔍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

// Google Calendar API 설정
let calendar = null;
let calendarInitialized = false;

// Google Calendar 초기화
async function initializeGoogleCalendar() {
    try {
        // 환경변수에서 서비스 어카운트 키 가져오기
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
📝 예약방법: ${getMethodText(reservation.reservationMethod)}
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
📝 예약방법: ${getMethodText(reservation.reservationMethod)}
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

// 예약방법 텍스트 변환
function getMethodText(method) {
    switch(method) {
        case 'phone': return '전화';
        case 'naver': return '네이버';
        default: return '선택안함';
    }
}

// 볼륨 디렉토리 생성 및 권한 확인 강화
function ensureVolumeDirectory() {
    try {
        if (!fs.existsSync(VOLUME_PATH)) {
            console.log(`📁 볼륨 경로 미존재, 생성 시도: ${VOLUME_PATH}`);
            fs.mkdirSync(VOLUME_PATH, { recursive: true });
            console.log(`📁 볼륨 디렉토리 생성 완료: ${VOLUME_PATH}`);
        } else {
            console.log(`📁 볼륨 디렉토리 존재 확인: ${VOLUME_PATH}`);
            // 디렉토리 권한 확인
            try {
                const stats = fs.statSync(VOLUME_PATH);
                console.log(`📁 볼륨 디렉토리 권한: ${stats.mode.toString(8)}`);
            } catch (statError) {
                console.error(`❌ 볼륨 디렉토리 권한 확인 실패:`, statError);
            }
        }
        
        // 볼륨 쓰기 테스트 상세화
        const testFile = path.join(VOLUME_PATH, 'test-write.txt');
        const testContent = `Test write at ${new Date().toISOString()}`;
        console.log(`✏️ 볼륨 쓰기 테스트 시작: ${testFile}`);
        
        fs.writeFileSync(testFile, testContent);
        const readBack = fs.readFileSync(testFile, 'utf8');
        console.log(`✅ 볼륨 쓰기/읽기 테스트 성공! 내용 확인: ${readBack.substring(0, 20)}...`);
        
        fs.unlinkSync(testFile);
        console.log(`🗑️ 테스트 파일 삭제 완료`);
        
    } catch (error) {
        console.error(`❌ 볼륨 디렉토리 오류:`, error);
        
        // 볼륨이 안 되면 기본 경로로 대체 (상세 로깅 추가)
        const fallbackPath = path.join(__dirname, 'data');
        console.log(`⚠️ 볼륨 접근 실패, 기본 경로 사용 시도: ${fallbackPath}`);
        
        if (!fs.existsSync(fallbackPath)) {
            try {
                fs.mkdirSync(fallbackPath, { recursive: true });
                console.log(`📁 기본 경로 생성 완료: ${fallbackPath}`);
            } catch (mkdirError) {
                console.error(`❌ 기본 경로 생성 실패:`, mkdirError);
            }
        } else {
            console.log(`📁 기본 경로 존재 확인: ${fallbackPath}`);
        }
        
        return fallbackPath;
    }
    
    return VOLUME_PATH;
}

// 초기화 시 볼륨 설정
const actualDataPath = ensureVolumeDirectory();
const FINAL_DATA_FILE = path.join(actualDataPath, 'reservations.json');

// 초기 데이터 파일 생성
if (!fs.existsSync(FINAL_DATA_FILE)) {
    fs.writeFileSync(FINAL_DATA_FILE, JSON.stringify([], null, 2));
    console.log(`📄 새 데이터 파일 생성: ${FINAL_DATA_FILE}`);
} else {
    console.log(`📄 기존 데이터 파일 발견: ${FINAL_DATA_FILE}`);
}

// 데이터 읽기 함수 개선
function readReservations() {
    try {
        console.log(`📖 데이터 파일 읽기 시도: ${FINAL_DATA_FILE}`);
        
        if (!fs.existsSync(FINAL_DATA_FILE)) {
            console.log(`⚠️ 데이터 파일이 존재하지 않음, 새 파일 생성`);
            fs.writeFileSync(FINAL_DATA_FILE, JSON.stringify([], null, 2));
            return [];
        }
        
        const data = fs.readFileSync(FINAL_DATA_FILE, 'utf8');
        console.log(`📊 데이터 파일 크기: ${data.length} 바이트`);
        
        if (!data || data.trim() === '') {
            console.log(`⚠️ 데이터 파일이 비어있음, 빈 배열 반환`);
            return [];
        }
        
        try {
            const reservations = JSON.parse(data);
            console.log(`✅ JSON 파싱 성공: ${Array.isArray(reservations) ? reservations.length : 0}건`);
            
            if (!Array.isArray(reservations)) {
                console.error(`❌ 데이터가 배열이 아님:`, typeof reservations);
                return [];
            }
            
            return reservations;
        } catch (parseError) {
            console.error(`❌ JSON 파싱 오류:`, parseError);
            throw parseError; // 백업 복원 로직으로 넘김
        }
    } catch (error) {
        console.error('❌ 데이터 읽기 오류:', error);
        
        // 백업 파일에서 복원 시도 (로깅 강화)
        try {
            console.log(`🔄 백업 파일 검색 시도...`);
            const backupFiles = fs.readdirSync(actualDataPath)
                .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
                .sort()
                .reverse();
                
            console.log(`🔍 백업 파일 ${backupFiles.length}개 발견`);
                
            if (backupFiles.length > 0) {
                const latestBackup = path.join(actualDataPath, backupFiles[0]);
                console.log(`📂 최신 백업 파일: ${latestBackup}`);
                
                const backupData = fs.readFileSync(latestBackup, 'utf8');
                
                if (!backupData || backupData.trim() === '') {
                    console.log(`⚠️ 백업 파일이 비어있음`);
                    return [];
                }
                
                try {
                    const backupReservations = JSON.parse(backupData);
                    console.log(`🔄 백업에서 복원: ${backupFiles[0]} (${backupReservations.length}건)`);
                    
                    // 메인 파일에 복원
                    fs.writeFileSync(FINAL_DATA_FILE, JSON.stringify(backupReservations, null, 2));
                    console.log(`✅ 메인 파일에 백업 데이터 복원 완료`);
                    
                    return backupReservations;
                } catch (backupParseError) {
                    console.error(`❌ 백업 파일 JSON 파싱 오류:`, backupParseError);
                }
            } else {
                console.log(`⚠️ 사용 가능한 백업 파일 없음`);
            }
        } catch (backupError) {
            console.error('❌ 백업 복원 실패:', backupError);
        }
        
        // 모든 시도 실패 시 빈 배열 반환
        console.log(`⚠️ 모든 복구 시도 실패, 빈 배열 반환`);
        return [];
    }
}

// 데이터 쓰기 함수 개선
function writeReservations(reservations) {
    try {
        if (!Array.isArray(reservations)) {
            console.error(`❌ 유효하지 않은 데이터 형식 (배열 아님):`, typeof reservations);
            return false;
        }
        
        console.log(`💾 데이터 저장 시도: ${reservations.length}건`);
        
        // 메인 파일 저장
        const dataJson = JSON.stringify(reservations, null, 2);
        console.log(`📊 저장할 데이터 크기: ${dataJson.length} 바이트`);
        
        fs.writeFileSync(FINAL_DATA_FILE, dataJson);
        console.log(`✅ 메인 파일 저장 완료: ${FINAL_DATA_FILE}`);
        
        // 자동 백업 생성 (최근 5개만 유지)
        if (reservations.length > 0) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const backupFile = path.join(actualDataPath, `backup-${timestamp}.json`);
            
            fs.writeFileSync(backupFile, dataJson);
            console.log(`💾 자동 백업 생성: ${backupFile} (${reservations.length}건)`);
            
            // 오래된 백업 정리
            try {
                const backupFiles = fs.readdirSync(actualDataPath)
                    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
                    .sort();
                    
                if (backupFiles.length > 5) {
                    const filesToDelete = backupFiles.slice(0, backupFiles.length - 5);
                    filesToDelete.forEach(file => {
                        try {
                            fs.unlinkSync(path.join(actualDataPath, file));
                            console.log(`🗑️ 오래된 백업 삭제: ${file}`);
                        } catch (deleteError) {
                            console.error(`❌ 백업 파일 삭제 실패:`, deleteError);
                        }
                    });
                }
            } catch (cleanupError) {
                console.error(`❌ 백업 정리 실패:`, cleanupError);
            }
        }
        
        return true;
    } catch (error) {
        console.error('❌ 데이터 쓰기 오류:', error);
        return false;
    }
}

// 파일 시스템 상태 체크 개선
function checkFileSystemStatus() {
    try {
        // 먼저 파일 존재 여부 확인
        if (!fs.existsSync(FINAL_DATA_FILE)) {
            console.log(`⚠️ 데이터 파일이 존재하지 않음`);
            return {
                filePath: FINAL_DATA_FILE,
                fileExists: false,
                error: '파일이 존재하지 않습니다',
                isVolume: FINAL_DATA_FILE.includes('/data'),
                writable: true
            };
        }
        
        const stats = fs.statSync(FINAL_DATA_FILE);
        
        // 파일 내용 샘플링 (오류 확인용)
        let fileContent = '';
        let fileData = [];
        let validJson = false;
        
        try {
            fileContent = fs.readFileSync(FINAL_DATA_FILE, 'utf8');
            fileData = JSON.parse(fileContent);
            validJson = true;
        } catch (readError) {
            console.error(`❌ 파일 읽기 오류:`, readError);
        }
        
        return {
            filePath: FINAL_DATA_FILE,
            fileSize: stats.size,
            lastModified: stats.mtime,
            recordCount: validJson && Array.isArray(fileData) ? fileData.length : 0,
            isVolume: FINAL_DATA_FILE.includes('/data'),
            validJson: validJson,
            writable: true,
            fileContentSample: fileContent ? fileContent.substring(0, 100) + '...' : ''
        };
    } catch (error) {
        console.error(`❌ 파일 시스템 상태 확인 오류:`, error);
        return {
            filePath: FINAL_DATA_FILE,
            error: error.message,
            writable: false
        };
    }
}

// API 엔드포인트들
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API 엔드포인트 - ping 개선
app.get('/api/ping', (req, res) => {
    try {
        const reservations = readReservations();
        const fsStatus = checkFileSystemStatus();
        
        // 추가 시스템 정보
        const systemInfo = {
            nodeVersion: process.version,
            platform: process.platform,
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            env: process.env.NODE_ENV || 'development',
            calendarEnabled: calendarInitialized
        };
        
        res.json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            reservationCount: reservations.length,
            fileSystem: fsStatus,
            system: systemInfo
        });
    } catch (error) {
        console.error('❌ Ping 처리 오류:', error);
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 예약 데이터 API 강화
app.get('/api/reservations', (req, res) => {
    try {
        console.log(`📥 예약 데이터 요청 수신`);
        const reservations = readReservations();
        console.log(`📤 예약 데이터 응답: ${reservations.length}건`);
        
        res.json({ 
            success: true, 
            data: reservations,
            count: reservations.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ 예약 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '예약 데이터를 불러올 수 없습니다: ' + error.message,
            data: []
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
        
        if (!newReservation.id) {
            newReservation.id = Date.now();
        }
        
        while (reservations.find(r => r.id === newReservation.id)) {
            newReservation.id = Date.now() + Math.floor(Math.random() * 1000);
        }

        // Google Calendar 이벤트 생성 시도
        const calendarEventId = await createCalendarEvent(newReservation);
        if (calendarEventId) {
            newReservation.calendarEventId = calendarEventId;
        }

        reservations.push(newReservation);
        
        if (writeReservations(reservations)) {
            console.log(`✅ 새 예약: ${newReservation.name}님 (${newReservation.people}명) - ${newReservation.date} ${newReservation.time}`);
            
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

app.get('/api/backup', (req, res) => {
    try {
        const reservations = readReservations();
        const backup = {
            timestamp: new Date().toISOString(),
            reservations: reservations
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="초가집_백업_${new Date().toISOString().split('T')[0]}.json"`);
        res.json(backup);
    } catch (error) {
        console.error('백업 다운로드 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '백업 생성에 실패했습니다.' 
        });
    }
});

app.post('/api/restore', (req, res) => {
    try {
        const { reservations } = req.body;
        
        if (!Array.isArray(reservations)) {
            return res.status(400).json({ 
                success: false, 
                error: '올바른 백업 데이터가 아닙니다.' 
            });
        }

        if (writeReservations(reservations)) {
            console.log(`🔄 데이터 복원: ${reservations.length}건`);
            res.json({ 
                success: true, 
                message: `${reservations.length}건의 예약이 복원되었습니다.`,
                count: reservations.length
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: '데이터 복원에 실패했습니다.' 
            });
        }
    } catch (error) {
        console.error('데이터 복원 오류:', error);
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

app.use((err, req, res, next) => {
    console.error('서버 에러:', err);
    res.status(500).json({
        success: false,
        error: '서버 내부 오류가 발생했습니다.'
    });
});

// 서버 시작 시 에러 핸들링 추가
app.on('error', (error) => {
    console.error(`❌ 서버 시작 오류:`, error);
});

// 서버 시작
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🏠 초가집 예약 시스템 서버 시작됨 - 포트 ${PORT}`);
    console.log(`📁 데이터 경로: ${FINAL_DATA_FILE}`);
    console.log(`💾 볼륨 사용: ${FINAL_DATA_FILE.includes('/data') ? 'YES' : 'NO'}`);
    console.log(`🌐 서버 주소: http://0.0.0.0:${PORT}`);
    
    // Google Calendar 초기화
    console.log(`📅 Google Calendar 초기화 시작...`);
    await initializeGoogleCalendar();
    
    try {
        const reservations = readReservations();
        console.log(`📊 현재 저장된 예약: ${reservations.length}건`);
        
        if (reservations.length > 0) {
            console.log(`📋 최근 예약:`);
            reservations.slice(-3).forEach((r, i) => {
                console.log(`  ${r.name}님 ${r.people}명 ${r.date} ${r.time}`);
            });
        }
        
        // 파일 시스템 상태 출력
        const fsStatus = checkFileSystemStatus();
        console.log(`📊 파일 시스템 상태:`, JSON.stringify(fsStatus, null, 2));
        
    } catch (error) {
        console.error(`❌ 초기화 오류:`, error);
    }
}).on('error', (error) => {
    console.error(`❌ 서버 리스닝 오류:`, error);
});

process.on('SIGTERM', () => {
    console.log('🛑 서버 종료 - 데이터는 볼륨에 안전하게 보존됨');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 서버 종료 - 데이터는 볼륨에 안전하게 보존됨');
    process.exit(0);
});