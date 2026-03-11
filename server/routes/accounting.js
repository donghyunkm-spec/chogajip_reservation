const express = require('express');
const fs = require('fs');
const router = express.Router();
const { readJson, writeJson, getAccountingFile, addLog } = require('../utils/data');
const { mapStoreKrToCode } = require('../utils/store');

// 회계 조회
router.get('/', (req, res) => {
    const file = getAccountingFile(req.query.store || 'chogazip');
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ monthly:{}, daily:{} }));

    let data = readJson(file, { monthly: {}, daily: {} });
    if (Array.isArray(data)) data = { monthly: {}, daily: {} };
    if (!data.monthly) data.monthly = {};
    if (!data.daily) data.daily = {};

    res.json({ success: true, data });
});

// 일일 매출 저장
router.post('/daily', (req, res) => {
    const { date, data, store, actor } = req.body;
    const file = getAccountingFile(store || 'chogazip');
    let accData = readJson(file, { monthly: {}, daily: {} });
    if (!accData.daily) accData.daily = {};

    accData.daily[date] = data;
    if (writeJson(file, accData)) {
        addLog(store, actor, '매출입력', date, '일일매출저장');
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

// POS 크롤러 데이터 수신
router.post('/crawler', (req, res) => {
    const {
        date,
        store: storeKr,
        sales,
        deductions,
        max_receipt_no
    } = req.body;

    const storeCode = mapStoreKrToCode(storeKr);
    if (!storeCode) {
        return res.status(400).json({ success: false, message: 'Unknown store name' });
    }

    const file = getAccountingFile(storeCode);

    let accData = readJson(file, { monthly: {}, daily: {} });
    if (!accData.daily) accData.daily = {};

    const existingData = accData.daily[date] || {};

    const cardSales = (sales.card || 0) + (sales.etc || 0);
    const cashSales = sales.cash || 0;

    const baemin = existingData.baemin || 0;
    const yogiyo = existingData.yogiyo || 0;
    const coupang = existingData.coupang || 0;

    let totalSales = 0;
    if (storeCode === 'yangeun') {
        totalSales = cardSales + cashSales + baemin + yogiyo + coupang;
    } else {
        totalSales = req.body.net_sales || sales.total || 0;
    }

    const newData = {
        ...existingData,
        card: cardSales,
        cash: cashSales,
        sales: totalSales,
        receiptCount: max_receipt_no,
        discount: sales.discount || 0,
        refund: deductions.refund_total || 0,
        void: deductions.void_total || 0,
        crawledAt: new Date().toISOString()
    };

    accData.daily[date] = newData;

    if (writeJson(file, accData)) {
        addLog(storeCode, 'Crawler', '매출자동입력', date, `POS데이터 반영(영수증:${max_receipt_no}, 반품:${newData.refund})`);
        console.log(`🤖 [Crawler] ${storeKr} ${date} 매출 업데이트 완료`);
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

// 배달 크롤러 데이터 수신
router.post('/delivery-crawler', (req, res) => {
    const {
        platform,
        store: storeKr,
        date,
        order_count,
        payment_amount,
        crawled_at
    } = req.body;

    const storeCode = mapStoreKrToCode(storeKr);
    if (!storeCode) {
        return res.status(400).json({ success: false, message: 'Unknown store name' });
    }

    let platformKey = '';
    if (platform === '배달의민족') platformKey = 'baemin';
    else if (platform === '요기요') platformKey = 'yogiyo';
    else if (platform === '쿠팡이츠') platformKey = 'coupang';
    else return res.status(400).json({ success: false, message: 'Unknown platform' });

    const file = getAccountingFile(storeCode);

    let accData = readJson(file, { monthly: {}, daily: {} });
    if (!accData.daily) accData.daily = {};
    const existingData = accData.daily[date] || {};

    const newData = {
        ...existingData,
        [platformKey]: payment_amount || 0,
        [`${platformKey}Count`]: order_count || 0,
        [`${platformKey}CrawledAt`]: crawled_at
    };

    const card = newData.card || 0;
    const cash = newData.cash || 0;
    const gift = newData.gift || 0;
    const baemin = newData.baemin || 0;
    const yogiyo = newData.yogiyo || 0;
    const coupang = newData.coupang || 0;

    let totalSales = 0;
    if (storeCode === 'yangeun') {
        totalSales = card + cash + baemin + yogiyo + coupang;
    } else {
        totalSales = card + cash + gift;
    }
    newData.sales = totalSales;

    accData.daily[date] = newData;

    if (writeJson(file, accData)) {
        addLog(storeCode, 'Crawler', '배달매출입력', date, `${platform}(${order_count}건) 업데이트`);
        console.log(`🛵 [Delivery] ${storeKr} ${date} ${platform} 업데이트 완료`);
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

// 월간 고정비 저장
router.post('/monthly', (req, res) => {
    const { month, data, store, actor } = req.body;
    const file = getAccountingFile(store || 'chogazip');
    let accData = readJson(file, { monthly: {}, daily: {} });
    if (!accData.monthly) accData.monthly = {};

    accData.monthly[month] = data;
    if (writeJson(file, accData)) {
        addLog(store, actor, '월간지출', month, '고정비용 저장');
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

module.exports = router;
