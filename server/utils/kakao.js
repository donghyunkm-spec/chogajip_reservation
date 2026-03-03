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

module.exports = { KAKAO_REST_API_KEY, KAKAO_REDIRECT_URI, sendToKakao };
