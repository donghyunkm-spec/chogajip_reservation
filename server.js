const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// === 미들웨어 설정 ===
const allowedOrigins = process.env.ALLOWED_ORIGINS || '*';
app.use(cors({ origin: allowedOrigins === '*' ? '*' : allowedOrigins.split(',') }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// === 마케팅 데이터 초기화 ===
const { initMarketingData } = require('./server/crawlers/naver-place');
initMarketingData();

// === 라우터 마운트 ===
app.use('/api/reservations', require('./server/routes/reservations'));
app.use('/api/login', require('./server/routes/login'));
app.use('/api/staff', require('./server/routes/staff'));
app.use('/api/accounting', require('./server/routes/accounting'));
app.use('/api/prepayments', require('./server/routes/prepayments'));
app.use('/api/notes', require('./server/routes/notes'));
app.use('/api/pos-data', require('./server/routes/pos-data'));
app.use('/api/backup', require('./server/routes/backup'));
app.use('/api/logs', require('./server/routes/logs'));
app.use('/api/marketing', require('./server/routes/marketing'));
app.use('/api/pos', require('./server/routes/pos-crawler'));

// 카카오 라우터 (OAuth 콜백 + API)
const kakaoRouter = require('./server/routes/kakao');
// Kakao 개발자센터에 등록된 redirect_uri 는 /oauth/kakao 이므로 직접 콜백 핸들러 연결
app.get('/oauth/kakao', kakaoRouter.kakaoCallbackHandler);
app.use('/api/kakao', kakaoRouter);

// === 에러 핸들러 ===
const { errorHandler } = require('./server/middleware/error-handler');
app.use(errorHandler);

// === Cron 스케줄 등록 ===
const { registerAllCrons } = require('./server/cron/schedules');
registerAllCrons();

// === 서버 시작 ===
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
