const express = require('express');
const axios = require('axios');
const router = express.Router();
const { readJson, writeJson, KAKAO_TOKEN_FILE, addLog } = require('../utils/data');
const { KAKAO_REST_API_KEY, KAKAO_REDIRECT_URI } = require('../utils/kakao');
const { generateAndSendBriefing } = require('../utils/briefing');
const { asyncHandler } = require('../middleware/error-handler');

// 카카오 인증 URL API (프론트엔드에서 사용)
router.get('/auth-url', (req, res) => {
    const authUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${KAKAO_REDIRECT_URI}&response_type=code&scope=talk_message`;
    res.json({ success: true, url: authUrl });
});

// 카카오 OAuth 콜백 핸들러 (server.js 에서 /oauth/kakao 로 직접 마운트)
const kakaoCallbackHandler = asyncHandler(async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send('인증 코드가 없습니다.');

    const tokenRes = await axios.post('https://kauth.kakao.com/oauth/token', null, {
        params: {
            grant_type: 'authorization_code',
            client_id: KAKAO_REST_API_KEY,
            redirect_uri: KAKAO_REDIRECT_URI,
            code: code
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const newTokens = tokenRes.data;

    const userRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${newTokens.access_token}` }
    });

    const userId = userRes.data.id;
    const userNickname = userRes.data.properties?.nickname || '이름없음';

    let tokenList = readJson(KAKAO_TOKEN_FILE, []);
    if (!Array.isArray(tokenList)) tokenList = [];

    const existingIdx = tokenList.findIndex(t => t.userId === userId);

    if (existingIdx !== -1) {
        console.log(`🔄 기존 사용자(${userNickname}) 토큰 갱신`);
        tokenList[existingIdx] = {
            userId,
            nickname: userNickname,
            ...newTokens,
            updatedAt: new Date().toISOString()
        };
    } else {
        console.log(`➕ 새 사용자(${userNickname}) 등록`);
        tokenList.push({
            userId,
            nickname: userNickname,
            ...newTokens,
            updatedAt: new Date().toISOString()
        });
    }

    writeJson(KAKAO_TOKEN_FILE, tokenList);

    res.send(`<h1>✅ 로그인 성공!</h1><p>${userNickname}님 등록 완료.<br>현재 알림 받는 인원: ${tokenList.length}명</p>`);
});

// /api/kakao/callback 으로도 접근 가능하도록 유지 (하위 호환)
router.get('/callback', kakaoCallbackHandler);

// 수동 브리핑 발송
router.post('/send-briefing', asyncHandler(async (req, res) => {
    const { actor } = req.body;
    console.log(`🔔 [수동 발송] ${actor}님이 브리핑을 요청했습니다.`);

    await generateAndSendBriefing();

    addLog('chogazip', actor, '카톡발송', '통합브리핑', '수동발송 완료');

    res.json({ success: true });
}));

module.exports = router;
module.exports.kakaoCallbackHandler = kakaoCallbackHandler;
