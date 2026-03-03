const express = require('express');
const router = express.Router();
const { readJson, POS_HISTORY_FILE } = require('../utils/data');
const { posStatus } = require('../state');

// POS 상태 조회
router.get('/status', (req, res) => {
    res.json({ success: true, data: posStatus });
});

// POS 수동 실행
router.post('/run', (req, res) => {
    if (posStatus.running) {
        return res.json({ success: false, message: '이미 실행 중입니다.' });
    }

    const { stores, date } = req.body || {};

    // 동적 import로 순환 참조 방지
    const { runPosCrawler } = require('../crawlers/union-pos');
    runPosCrawler(
        stores || ['chogazip', 'yangeun'],
        date || null
    ).then(result => {
        console.log('POS 크롤러 실행 완료:', result.success);
    });

    res.json({ success: true, message: 'POS 매출 수집을 시작했습니다.' });
});

// POS 이력 조회
router.get('/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 30;
    const history = readJson(POS_HISTORY_FILE, []);
    res.json({ success: true, data: history.slice(0, limit) });
});

module.exports = router;
