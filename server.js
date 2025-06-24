// server.js - 즉시 작동하는 백업 강화 버전
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// 데이터 디렉토리 설정
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DATA_FILE = path.join(DATA_DIR, 'reservations.json');

// 디렉토리 생성
function ensureDirectories() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
            console.log('📁 데이터 디렉토리 생성:', DATA_DIR);
        }
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
            console.log('📁 백업 디렉토리 생성:', BACKUP_DIR);
        }
    } catch (error) {
        console.error('디렉토리 생성 실패:', error);
    }
}

// 초기 데이터 파일 생성
function initializeDataFile() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            const initialData = [];
            fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
            console.log('📄 초기 데이터 파일 생성');
        }
    } catch (error) {
        console.error('데이터 파일 초기화 실패:', error);
    }
}

// 데이터 읽기
function readReservations() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return [];
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('데이터 읽기 오류:', error);
        // 백업에서 복원 시도
        return restoreFromBackup() || [];
    }
}

// 데이터 쓰기 (백업 포함)
function writeReservations(reservations) {
    try {
        // 메인 파일 저장
        fs.writeFileSync(DATA_FILE, JSON.stringify(reservations, null, 2));
        
        // 백업 생성 (데이터가 있을 때만)
        if (reservations.length > 0) {
            createBackup(reservations);
        }
        
        return true;
    } catch (error) {
        console.error('데이터 쓰기 오류:', error);
        return false;
    }
}

// 백업 생성
function createBackup(reservations) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
        
        const backupData = {
            timestamp: new Date().toISOString(),
            count: reservations.length,
            reservations: reservations
        };
        
        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        
        // 오래된 백업 정리 (최근 10개만 유지)
        cleanOldBackups();
        
        console.log(`💾 백업 생성: ${path.basename(backupFile)} (${reservations.length}건)`);
    } catch (error) {
        console.error('백업 생성 실패:', error);
    }
}

// 백업에서 복원
function restoreFromBackup() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) return null;
        
        const files = fs.readdirSync(BACKUP_DIR);
        const backupFiles = files
            .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
            .sort()
            .reverse(); // 최신 순
        
        for (const file of backupFiles) {
            try {
                const backupPath = path.join(BACKUP_DIR, file);
                const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
                
                if (backupData.reservations && Array.isArray(backupData.reservations)) {
                    console.log(`🔄 백업에서 복원: ${file} (${backupData.reservations.length}건)`);
                    return backupData.reservations;
                }
            } catch (err) {
                console.error(`백업 파일 ${file} 읽기 실패:`, err);
            }
        }
    } catch (error) {
        console.error('백업 복원 실패:', error);
    }
    return null;
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
            .sort((a, b) => b.mtime - a.mtime); // 최신 순 정렬
        
        // 10개 이상이면 오래된 것 삭제
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

// API 엔드포인트들
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/ping', (req, res) => {
    const reservations = readReservations();
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        reservationCount: reservations.length,
        dataFile: DATA_FILE
    });
});

app.get('/api/reservations', (req, res) => {
    try {
        const reservations = readReservations();
        console.log(`📋 예약 조회: ${reservations.length}건`);
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

app.post('/api/reservations', (req, res) => {
    try {
        const newReservation = req.body;
        
        // 필수 필드 검증
        if (!newReservation.name || !newReservation.people || !newReservation.date || !newReservation.time) {
            return res.status(400).json({ 
                success: false, 
                error: '필수 정보가 누락되었습니다.' 
            });
        }

        const reservations = readReservations();
        
        // ID 생성 및 중복 체크
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
            res.json({ 
                success: true, 
                message: '예약이 성공적으로 등록되었습니다.',
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
            console.log(`✏️ 예약 수정: ID ${reservationId}`);
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

// 백업 다운로드
app.get('/api/backup', (req, res) => {
    try {
        const reservations = readReservations();
        const backup = {
            timestamp: new Date().toISOString(),
            count: reservations.length,
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

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏠 초가집 예약 시스템 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📁 데이터 저장 위치: ${DATA_FILE}`);
    console.log(`💾 백업 저장 위치: ${BACKUP_DIR}`);
    
    // 초기화
    ensureDirectories();
    initializeDataFile();
    
    // 시작시 데이터 상태 확인
    const reservations = readReservations();
    console.log(`📊 현재 저장된 예약: ${reservations.length}건`);
    
    // 주기적 백업 (30분마다)
    setInterval(() => {
        const currentReservations = readReservations();
        if (currentReservations.length > 0) {
            createBackup(currentReservations);
        }
    }, 30 * 60 * 1000);
});

// 종료 시 마지막 백업
process.on('SIGTERM', () => {
    console.log('🛑 서버 종료 신호를 받았습니다.');
    const reservations = readReservations();
    if (reservations.length > 0) {
        createBackup(reservations);
        console.log('💾 종료 전 마지막 백업 완료');
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 서버를 종료합니다.');
    const reservations = readReservations();
    if (reservations.length > 0) {
        createBackup(reservations);
        console.log('💾 종료 전 마지막 백업 완료');
    }
    process.exit(0);
});