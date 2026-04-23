const cron = require('node-cron');
const { sendToKakao, refreshKakaoTokens } = require('../utils/kakao');
const { getKstNow } = require('../utils/data');
const { getDailyScheduleMessage } = require('../utils/staff-calc');
const { generateAndSendBriefing } = require('../utils/briefing');
const { generateMarketingBriefing } = require('../crawlers/naver-place');
const { runPosCrawler } = require('../crawlers/union-pos');
const { runNaverPlaceCheck } = require('../crawlers/naver-place');
const { sendDailyReservationBriefing } = require('../utils/reservation-notify');

function registerAllCrons() {
    // 근무표 브리핑 (매일 오전 11:30)
    cron.schedule('30 11 * * *', async () => {
        console.log('🔔 [알림] 오전 11:30 근무표 브리핑 시작...');

        try {
            const today = getKstNow();
            const msgChoga = getDailyScheduleMessage('chogazip', today);
            const msgYang = getDailyScheduleMessage('yangeun', today);

            const finalMsg = `
[📅 ${today.getUTCMonth()+1}월 ${today.getUTCDate()}일 근무자 브리핑]

${msgChoga}

----------------

${msgYang}
`.trim();

            await sendToKakao(finalMsg);
            console.log('✅ 근무표 전송 완료');
        } catch (e) {
            console.error('❌ 근무표 전송 실패:', e);
        }
    }, {
        timezone: "Asia/Seoul"
    });

    // 일일 경영 브리핑 (매일 오전 11시)
    cron.schedule('0 11 * * *', () => {
        console.log('🔔 [알림] 오전 11시 일일 브리핑 생성 중...');
        generateAndSendBriefing();
    }, {
        timezone: "Asia/Seoul"
    });

    // 마케팅 브리핑 (11:00~11:30 사이 랜덤)
    cron.schedule('0 11 * * *', () => {
        const randomDelayMs = Math.floor(Math.random() * 30 * 60 * 1000);
        const delayMinutes = Math.floor(randomDelayMs / 60000);

        console.log(`🔔 [스케줄] 마케팅 브리핑 예약됨 - ${delayMinutes}분 후 실행 예정`);

        setTimeout(async () => {
            console.log('🔔 [스케줄] 마케팅 브리핑 시작...');
            await generateMarketingBriefing();
        }, randomDelayMs);
    }, {
        timezone: "Asia/Seoul"
    });

    // POS 매출 자동 수집 (매일 오전 6시)
    cron.schedule('0 6 * * *', async () => {
        console.log('🔔 [스케줄] 오전 6시 POS 매출 자동 수집 시작...');
        await runPosCrawler(['chogazip', 'yangeun']);
    }, {
        timezone: "Asia/Seoul"
    });

    // 마케팅 순위 체크 (매일 오전 4시에 스케줄링, 4~8시 사이 랜덤 실행)
    cron.schedule('0 4 * * *', () => {
        const randomDelayMs = Math.floor(Math.random() * 4 * 60 * 60 * 1000);
        const delayMinutes = Math.floor(randomDelayMs / 60000);
        const scheduledTime = new Date(Date.now() + randomDelayMs);

        console.log(`🔔 [스케줄] 순위 체크 예약됨 - ${delayMinutes}분 후 (${scheduledTime.toLocaleTimeString('ko-KR')}) 실행 예정`);

        setTimeout(async () => {
            console.log('🔔 [스케줄] 네이버 플레이스 순위 체크 시작...');
            await runNaverPlaceCheck();
        }, randomDelayMs);
    }, {
        timezone: "Asia/Seoul"
    });

    // 예약 현황 브리핑 (매일 오후 2시)
    cron.schedule('0 14 * * *', async () => {
        console.log('🔔 [알림] 오후 2시 예약 현황 브리핑 시작...');
        await sendDailyReservationBriefing();
    }, {
        timezone: "Asia/Seoul"
    });

    // 카카오 refresh_token 만료 체크 및 선제 갱신 (매일 새벽 3시)
    // Kakao 정책상 refresh_token 은 만료 1개월 이내에만 자동 갱신되므로 매일 체크
    cron.schedule('0 3 * * *', async () => {
        console.log('🔔 [스케줄] 새벽 3시 카카오 토큰 만료 체크 시작...');
        try {
            await refreshKakaoTokens();
        } catch (e) {
            console.error('❌ 카카오 토큰 갱신 체크 실패:', e);
        }
    }, {
        timezone: "Asia/Seoul"
    });

    console.log('📅 모든 cron 스케줄 등록 완료');
}

module.exports = { registerAllCrons };
