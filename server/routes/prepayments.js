const express = require('express');
const router = express.Router();
const { readJson, writeJson, getPrepaymentFile, addLog } = require('../utils/data');

// 조회
router.get('/', (req, res) => {
    const store = req.query.store || 'chogazip';
    const file = getPrepaymentFile(store);

    let data = readJson(file, { customers: {}, logs: [] });
    if (Array.isArray(data)) data = { customers: {}, logs: [] };

    res.json({ success: true, data });
});

// 등록 (충전/차감)
router.post('/', (req, res) => {
    const { customerName, amount, type, date, note, actor, store } = req.body;
    const targetStore = store || 'chogazip';
    const file = getPrepaymentFile(targetStore);

    let data = readJson(file, { customers: {}, logs: [] });
    if (Array.isArray(data)) data = { customers: {}, logs: [] };

    if (!data.customers[customerName]) {
        data.customers[customerName] = { balance: 0, lastUpdate: "" };
    }

    const val = parseInt(amount);
    if (type === 'charge') data.customers[customerName].balance += val;
    else data.customers[customerName].balance -= val;

    data.customers[customerName].lastUpdate = date;

    data.logs.unshift({
        id: Date.now() + Math.random(),
        date, customerName, type, amount: val,
        currentBalance: data.customers[customerName].balance,
        note, actor
    });

    if (writeJson(file, data)) {
        addLog(targetStore, actor, type === 'charge'?'선결제충전':'선결제사용', customerName, `${amount}원`);
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

// 삭제 (취소)
router.delete('/:id', (req, res) => {
    const logId = parseFloat(req.params.id);
    const { actor, store } = req.body;
    const targetStore = store || 'chogazip';
    const file = getPrepaymentFile(targetStore);

    let data = readJson(file, { customers: {}, logs: [] });
    if (Array.isArray(data)) return res.status(500).json({ success: false, error: 'Data corrupted' });

    const idx = data.logs.findIndex(l => l.id === logId);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' });

    const target = data.logs[idx];

    if (data.customers[target.customerName]) {
        if (target.type === 'charge') data.customers[target.customerName].balance -= target.amount;
        else data.customers[target.customerName].balance += target.amount;
    }

    data.logs.splice(idx, 1);

    if (writeJson(file, data)) {
        addLog(targetStore, actor, '선결제취소', target.customerName, '기록삭제 및 잔액원복');
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

module.exports = router;
