const express = require('express');
const fs = require('fs');
const router = express.Router();
const { readJson, writeJson, getPosDataFile } = require('../utils/data');

// 조회
router.get('/', (req, res) => {
    const store = req.query.store || 'chogazip';
    const file = getPosDataFile(store);

    if (!fs.existsSync(file)) {
        return res.json({ success: true, data: null });
    }
    const data = readJson(file, null);
    res.json({ success: true, data });
});

// 저장 (전달된 필드만 업데이트)
router.post('/', (req, res) => {
    const { store } = req.body;
    const file = getPosDataFile(store || 'chogazip');

    let existingData = { products: null, receipts: null, updatedAt: null };
    if (fs.existsSync(file)) {
        existingData = readJson(file, existingData) || existingData;
    }

    const data = { ...existingData };
    if ('products' in req.body) {
        data.products = req.body.products;
    }
    if ('receipts' in req.body) {
        data.receipts = req.body.receipts;
    }
    data.updatedAt = new Date().toISOString();

    if (writeJson(file, data)) {
        console.log(`📊 POS 데이터 저장 완료 [${store}] (상품: ${data.products?.length || 0}개, 영수증: ${data.receipts?.length || 0}건)`);
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

module.exports = router;
