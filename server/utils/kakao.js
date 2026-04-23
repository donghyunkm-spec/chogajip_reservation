const axios = require('axios');
const { readJson, writeJson, KAKAO_TOKEN_FILE } = require('./data');

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || 'b93a072ab458557243baf45e12f2a011';
const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || 'https://chogajipreservation-production.up.railway.app/oauth/kakao';

async function sendToKakao(text) {
    let tokenList = readJson(KAKAO_TOKEN_FILE, []);

    if (!Array.isArray(tokenList) || tokenList.length === 0) {
        console.log('❌ 카카오톡 발송 실패: 등록된 사용자가 없습니다.');
        return;
    }

    console.log(`📢 총 ${tokenList.length}명에게 카톡 전송 시작...`);
    let isListChanged = false;

    for (let i = 0; i < tokenList.length; i++) {
        let user = tokenList[i];

        try {
            // 액세스 토큰 갱신 시도
            try {
                const refreshRes = await axios.post('https://kauth.kakao.com/oauth/token', null, {
                    params: {
                        grant_type: 'refresh_token',
                        client_id: KAKAO_REST_API_KEY,
                        refresh_token: user.refresh_token
                    },
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });

                if (refreshRes.data.access_token) {
                    user.access_token = refreshRes.data.access_token;
                    if (refreshRes.data.refresh_token) {
                        user.refresh_token = refreshRes.data.refresh_token;
                    }
                    isListChanged = true;
                }
            } catch (refreshErr) {
                console.log(`⚠️ ${user.nickname}: 토큰 갱신 실패 (만료되었을 수 있음)`);
            }

            // 메시지 전송
            await axios.post('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
                template_object: JSON.stringify({
                    object_type: 'text',
                    text: text,
                    link: {
                        web_url: 'https://chogajipreservation-production.up.railway.app',
                        mobile_web_url: 'https://chogajipreservation-production.up.railway.app'
                    }
                })
            }, {
                headers: {
                    'Authorization': `Bearer ${user.access_token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            console.log(`✅ 전송 성공: ${user.nickname}`);

        } catch (error) {
            console.error(`❌ 전송 실패 (${user.nickname}):`, error.response ? error.response.data : error.message);
        }

        tokenList[i] = user;
    }

    if (isListChanged) {
        writeJson(KAKAO_TOKEN_FILE, tokenList);
        console.log('💾 갱신된 토큰 정보를 저장했습니다.');
    }
}

// refresh_token 만료 1개월 이내 시 갱신 (Kakao는 이 시점에만 새 refresh_token 발급)
// 매일 cron 으로 호출해 만료 임박 토큰을 선제적으로 연장
async function refreshKakaoTokens() {
    let tokenList = readJson(KAKAO_TOKEN_FILE, []);
    if (!Array.isArray(tokenList) || tokenList.length === 0) {
        console.log('ℹ️ 등록된 카카오 토큰이 없어 갱신 스킵');
        return;
    }

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    let isListChanged = false;

    for (let i = 0; i < tokenList.length; i++) {
        const user = tokenList[i];
        const updatedAt = user.updatedAt ? new Date(user.updatedAt).getTime() : 0;
        // refresh_token 유효기간 (없으면 기본 60일 가정)
        const refreshExpiresInSec = user.refresh_token_expires_in || 60 * 24 * 60 * 60;
        const refreshExpiresAt = updatedAt + refreshExpiresInSec * 1000;
        const daysUntilExpiry = (refreshExpiresAt - now) / DAY_MS;

        // 만료까지 30일 초과 남았으면 굳이 갱신 호출 안 함 (해도 새 refresh_token 안 옴)
        if (daysUntilExpiry > 30) {
            console.log(`⏭️  ${user.nickname}: refresh_token 만료까지 ${Math.floor(daysUntilExpiry)}일 (갱신 불필요)`);
            continue;
        }

        try {
            console.log(`🔄 ${user.nickname}: refresh_token 만료까지 ${Math.floor(daysUntilExpiry)}일 — 갱신 시도`);
            const res = await axios.post('https://kauth.kakao.com/oauth/token', null, {
                params: {
                    grant_type: 'refresh_token',
                    client_id: KAKAO_REST_API_KEY,
                    refresh_token: user.refresh_token
                },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const data = res.data;
            user.access_token = data.access_token;
            if (data.expires_in) user.expires_in = data.expires_in;

            if (data.refresh_token) {
                user.refresh_token = data.refresh_token;
                user.refresh_token_expires_in = data.refresh_token_expires_in || refreshExpiresInSec;
                user.updatedAt = new Date().toISOString();
                console.log(`✅ ${user.nickname}: 새 refresh_token 발급 — 유효기간 ${Math.floor(user.refresh_token_expires_in / 86400)}일 연장`);
            } else {
                console.log(`⚠️  ${user.nickname}: access_token 만 갱신됨 (refresh_token 미갱신)`);
            }

            tokenList[i] = user;
            isListChanged = true;
        } catch (err) {
            const errData = err.response ? err.response.data : err.message;
            console.error(`❌ ${user.nickname}: 토큰 갱신 실패 -`, errData);
            if (daysUntilExpiry <= 7) {
                console.error(`🚨 ${user.nickname}: refresh_token 만료까지 ${Math.floor(daysUntilExpiry)}일 — 수동 재로그인 필요 (/kakao-auth.html)`);
            }
        }
    }

    if (isListChanged) {
        writeJson(KAKAO_TOKEN_FILE, tokenList);
        console.log('💾 갱신된 토큰 정보를 저장했습니다.');
    }
}

module.exports = { KAKAO_REST_API_KEY, KAKAO_REDIRECT_URI, sendToKakao, refreshKakaoTokens };
