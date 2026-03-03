const express = require('express');
const router = express.Router();
const { readJson, FINAL_DATA_FILE, getStaffFile, getAccountingFile, getPrepaymentFile, getLogFile } = require('../utils/data');

router.get('/', (req, res) => {
    const store = req.query.store || 'chogazip';

    try {
        const reservations = readJson(FINAL_DATA_FILE, []);
        const staff = readJson(getStaffFile(store), []);
        const accounting = readJson(getAccountingFile(store), { monthly: {}, daily: {} });
        const prepayments = readJson(getPrepaymentFile(store), { customers: {}, logs: [] });
        const logs = readJson(getLogFile(store), []);

        const backupData = {
            metadata: {
                store: store,
                backupDate: new Date().toISOString(),
                version: "1.0"
            },
            reservations,
            staff,
            accounting,
            prepayments,
            logs
        };

        res.json({ success: true, data: backupData });

    } catch (e) {
        console.error('백업 생성 실패:', e);
        res.status(500).json({ success: false, error: '백업 생성 중 오류 발생' });
    }
});

module.exports = router;
