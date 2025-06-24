// server.js - Railway PostgreSQL 연동
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL 연결 설정
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// 테이블 생성
async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS reservations (
                id BIGINT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                phone VARCHAR(20),
                company VARCHAR(100),
                reservation_method VARCHAR(20),
                people INTEGER NOT NULL,
                preference VARCHAR(20) NOT NULL,
                date DATE NOT NULL,
                time TIME NOT NULL,
                tables TEXT,
                status VARCHAR(20) DEFAULT 'active',
                cancel_reason TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ 데이터베이스 테이블 초기화 완료');
    } catch (error) {
        console.error('❌ 데이터베이스 초기화 실패:', error);
    }
}

// 예약 조회
app.get('/api/reservations', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM reservations ORDER BY date DESC, time DESC'
        );
        
        const reservations = result.rows.map(row => ({
            id: parseInt(row.id),
            name: row.name,
            phone: row.phone,
            company: row.company,
            reservationMethod: row.reservation_method,
            people: row.people,
            preference: row.preference,
            date: row.date.toISOString().split('T')[0],
            time: row.time.slice(0, 5),
            tables: row.tables ? row.tables.split(',') : [],
            status: row.status,
            cancelReason: row.cancel_reason,
            timestamp: row.timestamp.toISOString(),
            updatedAt: row.updated_at?.toISOString()
        }));
        
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
app.post('/api/reservations', async (req, res) => {
    try {
        const {
            id, name, phone, company, reservationMethod,
            people, preference, date, time, tables, status
        } = req.body;
        
        if (!name || !people || !date || !time) {
            return res.status(400).json({ 
                success: false, 
                error: '필수 정보가 누락되었습니다.' 
            });
        }

        const reservationId = id || Date.now();
        const tablesStr = tables ? tables.join(',') : '';
        
        await pool.query(`
            INSERT INTO reservations 
            (id, name, phone, company, reservation_method, people, preference, date, time, tables, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            reservationId, name, phone || '', company || '', reservationMethod || '',
            people, preference, date, time, tablesStr, status || 'active'
        ]);
        
        console.log(`새 예약 추가: ${name}님 (${people}명) - ${date} ${time}`);
        res.json({ 
            success: true, 
            message: '예약이 성공적으로 등록되었습니다.',
            data: { id: reservationId, name, people, date, time }
        });
    } catch (error) {
        console.error('예약 추가 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '예약 저장에 실패했습니다.' 
        });
    }
});

// 예약 수정
app.put('/api/reservations/:id', async (req, res) => {
    try {
        const reservationId = req.params.id;
        const updates = req.body;
        
        const setClause = [];
        const values = [];
        let valueIndex = 1;
        
        Object.entries(updates).forEach(([key, value]) => {
            if (key === 'tables') {
                setClause.push(`tables = $${valueIndex}`);
                values.push(Array.isArray(value) ? value.join(',') : value);
            } else if (key === 'reservationMethod') {
                setClause.push(`reservation_method = $${valueIndex}`);
                values.push(value);
            } else if (key === 'cancelReason') {
                setClause.push(`cancel_reason = $${valueIndex}`);
                values.push(value);
            } else {
                setClause.push(`${key} = $${valueIndex}`);
                values.push(value);
            }
            valueIndex++;
        });
        
        setClause.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(reservationId);
        
        const query = `
            UPDATE reservations 
            SET ${setClause.join(', ')}
            WHERE id = $${valueIndex}
        `;
        
        const result = await pool.query(query, values);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ 
                success: false, 
                error: '예약을 찾을 수 없습니다.' 
            });
        }
        
        console.log(`예약 수정: ID ${reservationId}`);
        res.json({ 
            success: true, 
            message: '예약이 성공적으로 수정되었습니다.'
        });
    } catch (error) {
        console.error('예약 수정 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '예약 수정에 실패했습니다.' 
        });
    }
});

// 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 서버 상태 확인
app.get('/api/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 서버 시작
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🏠 초가집 예약 시스템 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`🌐 접속: http://localhost:${PORT}`);
    
    // 데이터베이스 초기화
    await initDatabase();
});

process.on('SIGTERM', () => {
    console.log('🛑 서버 종료 신호를 받았습니다.');
    pool.end();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 서버를 종료합니다.');
    pool.end();
    process.exit(0);
});