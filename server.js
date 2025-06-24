// server.js - Railway Volume 영구 저장
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static('public'));  // public  사용

// Railway Volume 경로 사용 (영구 저장)
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data';
const DATA_FILE = path.join(VOLUME_PATH, 'reservations.json');

console.log(`📁 Volume 경로: ${VOLUME_PATH}`);
console.log(`📄 데이터 파일: ${DATA_FILE}`);

// 볼륨 디렉토리 생성
function ensureVolumeDirectory() {
    try {
        if (!fs.existsSync(VOLUME_PATH)) {
            fs.mkdirSync(VOLUME_PATH, { recursive: true });
            console.log(`📁 볼륨 디렉토리 생성: ${VOLUME_PATH}`);
        } else {
            console.log(`📁 볼륨 디렉토리 존재: ${VOLUME_PATH}`);
        }
        
        // 볼륨 쓰기 테스트
        const testFile = path.join(VOLUME_PATH, 'test.txt');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log(`✅ 볼륨 쓰기 권한 확인됨`);
        
    } catch (error) {
        console.error(`❌ 볼륨 디렉토리 오류:`, error);
        
        // 볼륨이 안 되면 기본 경로로 대체
        const fallbackPath = path.join(__dirname, 'data');
        if (!fs.existsSync(fallbackPath)) {
            fs.mkdirSync(fallbackPath, { recursive: true });
        }
        console.log(`⚠️ 기본 경로로 대체: ${fallbackPath}`);
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

// 데이터 읽기 함수
function readReservations() {
    try {
        const data = fs.readFileSync(FINAL_DATA_FILE, 'utf8');
        const reservations = JSON.parse(data);
        return Array.isArray(reservations) ? reservations : [];
    } catch (error) {
        console.error('데이터 읽기 오류:', error);
        
        // 백업 파일에서 복원 시도
        try {
            const backupPattern = path.join(actualDataPath, 'backup-*.json');
            const backupFiles = fs.readdirSync(actualDataPath)
                .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
                .sort()
                .reverse();
                
            if (backupFiles.length > 0) {
                const latestBackup = path.join(actualDataPath, backupFiles[0]);
                const backupData = JSON.parse(fs.readFileSync(latestBackup, 'utf8'));
                console.log(`🔄 백업에서 복원: ${backupFiles[0]} (${backupData.length}건)`);
                
                // 메인 파일에 복원
                fs.writeFileSync(FINAL_DATA_FILE, JSON.stringify(backupData, null, 2));
                return backupData;
            }
        } catch (backupError) {
            console.error('백업 복원 실패:', backupError);
        }
        
        return [];
    }
}

// 데이터 쓰기 함수 (자동 백업 포함)
function writeReservations(reservations) {
    try {
        // 메인 파일 저장
        fs.writeFileSync(FINAL_DATA_FILE, JSON.stringify(reservations, null, 2));
        
        // 자동 백업 생성 (최근 5개만 유지)
        if (reservations.length > 0) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const backupFile = path.join(actualDataPath, `backup-${timestamp}.json`);
            fs.writeFileSync(backupFile, JSON.stringify(reservations, null, 2));
            
            // 오래된 백업 정리
            const backupFiles = fs.readdirSync(actualDataPath)
                .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
                .sort();
                
            if (backupFiles.length > 5) {
                const filesToDelete = backupFiles.slice(0, backupFiles.length - 5);
                filesToDelete.forEach(file => {
                    fs.unlinkSync(path.join(actualDataPath, file));
                });
            }
            
            console.log(`💾 자동 백업: backup-${timestamp}.json (${reservations.length}건)`);
        }
        
        return true;
    } catch (error) {
        console.error('데이터 쓰기 오류:', error);
        return false;
    }
}

// 파일 시스템 상태 체크
function checkFileSystemStatus() {
    try {
        const stats = fs.statSync(FINAL_DATA_FILE);
        const reservations = readReservations();
        
        return {
            filePath: FINAL_DATA_FILE,
            fileSize: stats.size,
            lastModified: stats.mtime,
            recordCount: reservations.length,
            isVolume: FINAL_DATA_FILE.includes('/data'),
            writable: true
        };
    } catch (error) {
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

app.get('/api/ping', (req, res) => {
    const reservations = readReservations();
    const fsStatus = checkFileSystemStatus();
    
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        reservationCount: reservations.length,
        fileSystem: fsStatus
    });
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

        reservations.push(newReservation);
        
        if (writeReservations(reservations)) {
            console.log(`✅ 새 예약: ${newReservation.name}님 (${newReservation.people}명) - ${newReservation.date} ${newReservation.time}`);
            
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
            console.log(`🗑️ 예약 삭제: ${deletedReservation.name}님`);
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏠 초가집 예약 시스템 서버 시작됨 - 포트 ${PORT}`);
    console.log(`📁 데이터 경로: ${FINAL_DATA_FILE}`);
    console.log(`💾 볼륨 사용: ${FINAL_DATA_FILE.includes('/data') ? 'YES' : 'NO'}`);
    console.log(`🌐 서버 주소: http://0.0.0.0:${PORT}`);
    
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