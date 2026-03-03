// 마케팅 크롤러 상태 변수
const marketingStatus = {
    running: false,
    lastRun: null,
    lastResult: null,
    progress: { current: 0, total: 0, keyword: '' }
};

// POS 크롤러 상태 변수
const posStatus = {
    running: false,
    lastRun: null,
    lastResult: null,
    progress: { current: 0, total: 0, store: '' }
};

module.exports = { marketingStatus, posStatus };
