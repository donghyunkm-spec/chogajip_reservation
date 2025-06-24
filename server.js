// server.js - Railway용 Node.js 서버
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 데이터 파일 경로
const DATA_FILE = path.join(__dirname, 'data', 'reservations.json');

// 데이터 디렉토리 생성
if (!fs.existsSync(path.dirname(DATA_FILE))) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

// 초기 데이터 파일 생성
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

// 환경변수 백업 시스템 추가
function saveToEnvironment(data) {
    try {
        if (data && data.length > 0) {
            const compressed = JSON.stringify(data);
            // 환경변수는 Railway Variables에서 수동으로 설정해야 함
            console.log(`💾 환경변수 백업 데이터 (복사해서 Railway Variables에 BACKUP_DATA로 저장하세요):`);
            console.log(`---START---`);
            console.log(compressed);
            console.log(`---END---`);
        }
    } catch (error) {
        console.error('환경변수 백업 실패:', error);
    }
}

// 환경변수에서 복원
function restoreFromEnvironment() {
    try {
        console.log(`🔍 환경변수 복원 시도 중...`);
        const backupData = process.env.BACKUP_DATA;
        
        if (!backupData) {
            console.log(`❌ BACKUP_DATA 환경변수가 없음`);
            return null;
        }
        
        console.log(`📏 환경변수 데이터 길이: ${backupData.length} 문자`);
        console.log(`📄 데이터 앞부분: ${backupData.substring(0, 200)}...`);
        
        const parsed = JSON.parse(backupData);
        
        if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`✅ 환경변수에서 파싱 성공: ${parsed.length}건`);
            return parsed;
        } else {
            console.log(`❌ 환경변수 데이터가 올바르지 않음: ${typeof parsed}`);
            return null;
        }
    } catch (error) {
        console.error('❌ 환경변수 복원 실패:', error.message);
        console.error('환경변수 내용:', process.env.BACKUP_DATA?.substring(0, 500));
        return null;
    }
}

// 간단한 백업 함수 (데이터 쓸 때마다 호출)
function createBackup(data) {
    try {
        if (data && data.length > 0) {
            // 1. 파일 백업 (임시)
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const backupFile = path.join(__dirname, 'data', `backup-${timestamp}.json`);
            fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
            console.log(`💾 파일 백업 생성: backup-${timestamp}.json (${data.length}건)`);
            
            // 2. 환경변수 백업 (영구)
            saveToEnvironment(data);
        }
    } catch (error) {
        console.error('백업 생성 실패:', error);
    }
}

// 백업에서 복원 (서버 시작시만)
function restoreFromBackup() {
    try {
        console.log(`🔄 복원 프로세스 시작...`);
        
        // 현재 데이터 확인
        let currentData = [];
        try {
            if (fs.existsSync(DATA_FILE)) {
                const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
                currentData = JSON.parse(fileContent);
                console.log(`📄 현재 파일 데이터: ${currentData.length}건`);
            } else {
                console.log(`📄 데이터 파일이 존재하지 않음`);
            }
        } catch (e) {
            console.log(`📄 데이터 파일 읽기 실패:`, e.message);
            currentData = [];
        }

        if (currentData.length === 0) {
            console.log(`🔄 데이터가 비어있음 - 백업에서 복원 시도`);
            
            // 1. 먼저 환경변수에서 복원 시도
            const envData = restoreFromEnvironment();
            if (envData) {
                fs.writeFileSync(DATA_FILE, JSON.stringify(envData, null, 2));
                console.log(`✅ 환경변수에서 복원 완료: ${envData.length}건`);
                return;
            }

            // 2. 파일 백업에서 복원 시도
            console.log(`🔄 파일 백업에서 복원 시도`);
            const dataDir = path.dirname(DATA_FILE);
            if (fs.existsSync(dataDir)) {
                const files = fs.readdirSync(dataDir);
                const backupFiles = files
                    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
                    .sort()
                    .reverse(); // 최신 순

                console.log(`📂 백업 파일 ${backupFiles.length}개 발견: ${backupFiles.slice(0, 3).join(', ')}`);

                if (backupFiles.length > 0) {
                    const latestBackup = path.join(dataDir, backupFiles[0]);
                    const backupData = JSON.parse(fs.readFileSync(latestBackup, 'utf8'));
                    
                    if (backupData.length > 0) {
                        fs.writeFileSync(DATA_FILE, JSON.stringify(backupData, null, 2));
                        console.log(`✅ 파일 백업에서 복원: ${backupFiles[0]} (${backupData.length}건)`);
                        return;
                    }
                }
            }
            
            console.log(`❌ 복원할 백업 데이터를 찾지 못함`);
        } else {
            console.log(`✅ 기존 데이터 존재 - 복원 불필요`);
        }
    } catch (error) {
        console.error('❌ 백업 복원 실패:', error);
    }
}

// 데이터 읽기 함수
function readReservations() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('데이터 읽기 오류:', error);
        return [];
    }
}

// 데이터 쓰기 함수 (백업 포함)
function writeReservations(reservations) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(reservations, null, 2));
        return true;
    } catch (error) {
        console.error('데이터 쓰기 오류:', error);
        return false;
    }
}

// 메인 페이지 제공
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 상태 확인
app.get('/api/ping', (req, res) => {
    const reservations = readReservations();
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        reservationCount: reservations.length,
        hasEnvBackup: !!process.env.BACKUP_DATA
    });
});

// 백업 상태 확인 API 추가
app.get('/api/backup/status', (req, res) => {
    try {
        const reservations = readReservations();
        const envBackup = process.env.BACKUP_DATA;
        
        let envCount = 0;
        try {
            if (envBackup) {
                const parsed = JSON.parse(envBackup);
                envCount = Array.isArray(parsed) ? parsed.length : 0;
            }
        } catch (e) {
            envCount = 0;
        }
        
        res.json({
            success: true,
            current: {
                count: reservations.length,
                data: reservations.slice(-3) // 최근 3개만
            },
            environment: {
                count: envCount,
                hasBackup: !!envBackup
            },
            message: `현재 ${reservations.length}건, 환경변수 백업 ${envCount}건`
        });
    } catch (error) {
        console.error('백업 상태 확인 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '백업 상태 확인 실패' 
        });
    }
});

// 예약 목록 조회
app.get('/api/reservations', (req, res) => {
    try {
        const reservations = readReservations();
        res.json({ 
            success: true, 
            data: reservations,
            count: reservations.length
        });
    } catch (error) {
        console.error('예약 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '예약 데이터를 불러올 수 없습니다.',
            data: []
        });
    }
});

// 새 예약 추가
app.post('/api/reservations', (req, res) => {
    try {
        const newReservation = req.body;
        
        // 데이터 검증
        if (!newReservation.name || !newReservation.people || !newReservation.date || !newReservation.time) {
            return res.status(400).json({ 
                success: false, 
                error: '필수 정보가 누락되었습니다.' 
            });
        }

        const reservations = readReservations();
        
        // ID 중복 확인 및 생성
        if (!newReservation.id) {
            newReservation.id = Date.now();
        }
        
        while (reservations.find(r => r.id === newReservation.id)) {
            newReservation.id = Date.now() + Math.floor(Math.random() * 1000);
        }

        // 예약 추가
        reservations.push(newReservation);
        
        // 먼저 파일 저장
        fs.writeFileSync(DATA_FILE, JSON.stringify(reservations, null, 2));
        
        // 성공 응답 즉시 전송
        res.json({ 
            success: true, 
            message: '예약이 성공적으로 등록되었습니다.',
            data: newReservation
        });
        
        // 백업은 응답 후에 비동기로 처리
        setImmediate(() => {
            createBackup(reservations);
        });
        
        console.log(`새 예약 추가: ${newReservation.name}님 (${newReservation.people}명) - ${newReservation.date} ${newReservation.time}`);
        
    } catch (error) {
        console.error('예약 추가 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '서버 오류가 발생했습니다.' 
        });
    }
});

// 예약 수정 (취소 등)
app.put('/api/reservations/:id', (req, res) => {
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

        // 예약 정보 업데이트
        reservations[reservationIndex] = { 
            ...reservations[reservationIndex], 
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        if (writeReservations(reservations)) {
            console.log(`예약 수정: ID ${reservationId} - ${JSON.stringify(updates)}`);
            res.json({ 
                success: true, 
                message: '예약이 성공적으로 수정되었습니다.',
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

// 예약 삭제
app.delete('/api/reservations/:id', (req, res) => {
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
        
        if (writeReservations(reservations)) {
            console.log(`예약 삭제: ${deletedReservation.name}님 - ID ${reservationId}`);
            res.json({ 
                success: true, 
                message: '예약이 성공적으로 삭제되었습니다.',
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

// 데이터 백업 다운로드
app.get('/api/backup', (req, res) => {
    try {
        const reservations = readReservations();
        const backup = {
            timestamp: new Date().toISOString(),
            reservations: reservations
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="thatch_house_backup_${new Date().toISOString().split('T')[0]}.json"`);
        res.json(backup);
    } catch (error) {
        console.error('백업 다운로드 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '백업 생성에 실패했습니다.' 
        });
    }
});

// 데이터 복원
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
            console.log(`데이터 복원 완료: ${reservations.length}건의 예약`);
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

// 404 에러 핸들링
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'API 엔드포인트를 찾을 수 없습니다.' 
    });
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
    console.error('서버 에러:', err);
    res.status(500).json({
        success: false,
        error: '서버 내부 오류가 발생했습니다.'
    });
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏠 초가집 예약 시스템 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📁 데이터 파일: ${DATA_FILE}`);
    console.log(`🌐 로컬 접속: http://localhost:${PORT}`);
    
    // 환경변수 확인
    console.log(`🔍 환경변수 BACKUP_DATA 존재: ${!!process.env.BACKUP_DATA}`);
    if (process.env.BACKUP_DATA) {
        console.log(`📏 환경변수 데이터 길이: ${process.env.BACKUP_DATA.length} 문자`);
        console.log(`📄 환경변수 데이터 앞부분: ${process.env.BACKUP_DATA.substring(0, 100)}...`);
    }
    
    // 시작시 백업에서 복원 시도
    restoreFromBackup();
    
    // 시작시 데이터 상태 확인
    const reservations = readReservations();
    console.log(`📊 현재 저장된 예약: ${reservations.length}건`);
    
    if (reservations.length > 0) {
        console.log(`📋 예약 목록:`);
        reservations.forEach((r, i) => {
            console.log(`  ${i+1}. ${r.name}님 ${r.people}명 ${r.date} ${r.time}`);
        });
    }
});

// 종료 시그널 처리
process.on('SIGTERM', () => {
    console.log('🛑 서버 종료 신호를 받았습니다.');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 서버를 종료합니다.');
    process.exit(0);
});