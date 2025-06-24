// server.js - Railway용 Node.js 서버 (백업 기능 추가)
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('.'));  // public 폴더 대신 현재 디렉토리

// 데이터 파일 경로
const DATA_FILE = path.join(__dirname, 'data', 'reservations.json');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');

// 데이터 디렉토리 생성
if (!fs.existsSync(path.dirname(DATA_FILE))) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

// 백업 디렉토리 생성
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// 초기 데이터 파일 생성
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

// 백업 생성 함수
function createAutoBackup(reservations) {
    try {
        if (reservations && reservations.length > 0) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
            const backupData = {
                timestamp: new Date().toISOString(),
                reservations: reservations
            };
            fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
            
            // 오래된 백업 파일 정리 (10개만 유지)
            cleanOldBackups();
            
            console.log(`💾 백업 생성: backup-${timestamp}.json (${reservations.length}건)`);
        }
    } catch (error) {
        console.error('백업 생성 실패:', error);
    }
}

// 오래된 백업 정리
function cleanOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR);
        const backupFiles = files
            .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
            .map(f => ({
                name: f,
                path: path.join(BACKUP_DIR, f),
                mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime);
        
        if (backupFiles.length > 10) {
            const filesToDelete = backupFiles.slice(10);
            filesToDelete.forEach(file => {
                fs.unlinkSync(file.path);
                console.log(`🗑️ 오래된 백업 삭제: ${file.name}`);
            });
        }
    } catch (error) {
        console.error('백업 정리 실패:', error);
    }
}

// 최신 백업에서 복원
function restoreFromLatestBackup() {
    try {
        const currentReservations = readReservations();
        if (currentReservations.length === 0) {
            const files = fs.readdirSync(BACKUP_DIR);
            const backupFiles = files
                .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
                .sort()
                .reverse();
            
            if (backupFiles.length > 0) {
                const latestBackup = path.join(BACKUP_DIR, backupFiles[0]);
                const backupData = JSON.parse(fs.readFileSync(latestBackup, 'utf8'));
                
                if (backupData.reservations && backupData.reservations.length > 0) {
                    writeReservations(backupData.reservations);
                    console.log(`🔄 최신 백업에서 복원: ${backupFiles[0]} (${backupData.reservations.length}건)`);
                    return backupData.reservations;
                }
            }
        }
        return currentReservations;
    } catch (error) {
        console.error('백업 복원 실패:', error);
        return [];
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
        
        // 백업 생성
        createAutoBackup(reservations);
        
        return true;
    } catch (error) {
        console.error('데이터 쓰기 오류:', error);
        return false;
    }
}

// 메인 페이지 제공
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 서버 상태 확인
app.get('/api/ping', (req, res) => {
    const reservations = readReservations();
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        reservationCount: reservations.length
    });
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
    console.log(`📥 예약 등록 요청 받음:`, req.body);
    
    try {
        const newReservation = req.body;
        
        // 데이터 검증
        if (!newReservation.name || !newReservation.people || !newReservation.date || !newReservation.time) {
            console.log(`❌ 필수 정보 누락:`, { name: newReservation.name, people: newReservation.people, date: newReservation.date, time: newReservation.time });
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
        
        if (writeReservations(reservations)) {
            console.log(`✅ 새 예약 추가: ${newReservation.name}님 (${newReservation.people}명) - ${newReservation.date} ${newReservation.time}`);
            
            // 응답 전에 잠시 대기 (백업 완료 대기)
            setTimeout(() => {
                console.log(`📤 성공 응답 전송:`, { success: true, message: '예약 등록 완료' });
                res.json({ 
                    success: true, 
                    message: '예약이 성공적으로 등록되었습니다.',
                    data: newReservation
                });
            }, 100);
        } else {
            console.log(`❌ 예약 저장 실패`);
            res.status(500).json({ 
                success: false, 
                error: '예약 저장에 실패했습니다.' 
            });
        }
    } catch (error) {
        console.error('❌ 예약 추가 오류:', error);
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
            console.log(`✏️ 예약 수정: ID ${reservationId} - ${JSON.stringify(updates)}`);
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
            console.log(`🗑️ 예약 삭제: ${deletedReservation.name}님 - ID ${reservationId}`);
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
            console.log(`🔄 데이터 복원 완료: ${reservations.length}건의 예약`);
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
    console.log(`💾 백업 디렉토리: ${BACKUP_DIR}`);
    console.log(`🌐 로컬 접속: http://localhost:${PORT}`);
    
    // 시작시 백업에서 복원 시도
    const reservations = restoreFromLatestBackup();
    console.log(`📊 현재 저장된 예약: ${reservations.length}건`);
    
    // 30분마다 자동 백업
    setInterval(() => {
        const currentReservations = readReservations();
        if (currentReservations.length > 0) {
            createAutoBackup(currentReservations);
        }
    }, 30 * 60 * 1000);
});

// 종료 시그널 처리 (마지막 백업)
process.on('SIGTERM', () => {
    console.log('🛑 서버 종료 신호를 받았습니다.');
    const reservations = readReservations();
    if (reservations.length > 0) {
        createAutoBackup(reservations);
        console.log('💾 종료 전 마지막 백업 완료');
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 서버를 종료합니다.');
    const reservations = readReservations();
    if (reservations.length > 0) {
        createAutoBackup(reservations);
        console.log('💾 종료 전 마지막 백업 완료');
    }
    process.exit(0);
});