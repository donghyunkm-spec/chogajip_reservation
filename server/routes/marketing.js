const express = require('express');
const router = express.Router();
const { readJson, writeJson, MARKETING_FILE } = require('../utils/data');
const { marketingStatus } = require('../state');
const { asyncHandler } = require('../middleware/error-handler');

// 상태 조회
router.get('/status', (req, res) => {
    res.json({ success: true, data: marketingStatus });
});

// 수동 실행
router.post('/run', asyncHandler(async (req, res) => {
    if (marketingStatus.running) {
        return res.json({ success: false, message: '이미 실행 중입니다.' });
    }

    // 동적 import로 순환 참조 방지
    const { runNaverPlaceCheck } = require('../crawlers/naver-place');
    runNaverPlaceCheck().then(result => {
        console.log('마케팅 크롤러 실행 완료:', result.success);
    });

    res.json({ success: true, message: '크롤러 실행을 시작했습니다.' });
}));

// 대시보드 요약 데이터
router.get('/summary', (req, res) => {
    const data = readJson(MARKETING_FILE, { config: { stores: [], categories: {} }, stores: {} });

    const summary = [];
    const { stores: storeConfigs, categories } = data.config;

    if (storeConfigs && categories) {
        storeConfigs.forEach(storeConfig => {
            const storeName = storeConfig.name;
            const cat = storeConfig.category || 'chogazip';
            const categoryKeywords = (categories[cat] && categories[cat].keywords) || [];
            const storeData = data.stores[storeName];

            categoryKeywords.forEach(keyword => {
                const records = (storeData && storeData.keywords && storeData.keywords[keyword]) || [];
                const latest = records.length > 0 ? records[records.length - 1] : null;
                const previous = records.length > 1 ? records[records.length - 2] : null;

                summary.push({
                    store: storeName,
                    is_mine: storeConfig.is_mine,
                    category: cat,
                    keyword,
                    rank: latest ? latest.rank : null,
                    found: latest ? latest.found : false,
                    date: latest ? latest.date : null,
                    change: (latest && previous && latest.rank && previous.rank)
                        ? previous.rank - latest.rank
                        : null,
                    history: records.slice(-30)
                });
            });
        });
    }

    res.json({
        success: true,
        data: {
            summary,
            last_updated: data.last_updated,
            config: data.config
        }
    });
});

// 설정 조회
router.get('/config', (req, res) => {
    const data = readJson(MARKETING_FILE, { config: { stores: [], keywords: [], settings: {} } });
    res.json({ success: true, data: data.config });
});

// 설정 저장
router.post('/config', (req, res) => {
    const { config } = req.body;
    const data = readJson(MARKETING_FILE, { config: {}, stores: {}, history: [] });
    data.config = { ...data.config, ...config };

    if (writeJson(MARKETING_FILE, data)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

// 가게 추가/수정 (upsert)
router.post('/config/store', (req, res) => {
    const { name, is_mine, category } = req.body;
    const data = readJson(MARKETING_FILE, { config: { stores: [], categories: {}, settings: {} }, stores: {} });

    if (!data.config.stores) data.config.stores = [];
    if (!data.config.categories) data.config.categories = {};

    const cat = category || 'chogazip';

    if (!data.config.categories[cat]) {
        data.config.categories[cat] = { keywords: [] };
    }

    const existingIndex = data.config.stores.findIndex(s => s.name === name);

    if (existingIndex >= 0) {
        data.config.stores[existingIndex] = {
            ...data.config.stores[existingIndex],
            is_mine: is_mine !== false,
            category: cat
        };
    } else {
        data.config.stores.push({ name, is_mine: is_mine !== false, category: cat });
        data.stores[name] = { keywords: {} };
    }

    if (writeJson(MARKETING_FILE, data)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

// 가게 삭제
router.delete('/config/store', (req, res) => {
    const { name } = req.body;
    const data = readJson(MARKETING_FILE, { config: { stores: [], categories: {}, settings: {} }, stores: {} });

    data.config.stores = data.config.stores.filter(s => s.name !== name);
    delete data.stores[name];

    if (writeJson(MARKETING_FILE, data)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

// 키워드 추가 (카테고리별)
router.post('/config/keyword', (req, res) => {
    const { keyword, category } = req.body;
    const data = readJson(MARKETING_FILE, { config: { stores: [], categories: {}, settings: {} }, stores: {} });

    if (!category || !keyword) {
        return res.json({ success: false, message: '카테고리와 키워드를 모두 입력하세요.' });
    }

    if (!data.config.categories) data.config.categories = {};
    if (!data.config.categories[category]) {
        data.config.categories[category] = { keywords: [] };
    }

    if (data.config.categories[category].keywords.includes(keyword)) {
        return res.json({ success: false, message: '이미 등록된 키워드입니다.' });
    }

    data.config.categories[category].keywords.push(keyword);

    if (writeJson(MARKETING_FILE, data)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

// 키워드 삭제 (카테고리별)
router.delete('/config/keyword', (req, res) => {
    const { keyword, category } = req.body;
    const data = readJson(MARKETING_FILE, { config: { stores: [], categories: {}, settings: {} }, stores: {} });

    if (!category || !keyword) {
        return res.json({ success: false, message: '카테고리와 키워드를 모두 입력하세요.' });
    }

    if (data.config.categories && data.config.categories[category]) {
        data.config.categories[category].keywords =
            data.config.categories[category].keywords.filter(k => k !== keyword);
    }

    const categoryStores = data.config.stores.filter(s => s.category === category);
    categoryStores.forEach(store => {
        if (data.stores[store.name] && data.stores[store.name].keywords) {
            delete data.stores[store.name].keywords[keyword];
        }
    });

    if (writeJson(MARKETING_FILE, data)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

module.exports = router;
