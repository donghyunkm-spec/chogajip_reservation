const { readJson, FINAL_DATA_FILE, getKstNow } = require('./data');
const { sendToKakao } = require('./kakao');

/**
 * 오늘 예약 목록을 가져온다
 */
function getTodayReservations() {
    const now = getKstNow();
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const reservations = readJson(FINAL_DATA_FILE, []);
    return reservations
        .filter(r => r.date === todayStr && (r.status === 'active' || !r.status))
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

/**
 * 예약 한 건을 한 줄로 포맷
 */
function formatReservation(r) {
    const time = r.time || '미정';
    const name = r.name || '미입력';
    const people = r.people || r.partySize || '?';
    const seat = r.seatPreference || '관계없음';
    const tables = r.assignedTables && r.assignedTables.length > 0
        ? ` [${r.assignedTables.join(',')}번]`
        : '';
    return `  ${time} | ${name} | ${people}명 | ${seat}${tables}`;
}

/**
 * 오늘의 전체 예약 현황 메시지 생성
 */
function buildDailySummaryMessage(reservations) {
    const now = getKstNow();
    const month = now.getUTCMonth() + 1;
    const date = now.getUTCDate();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[now.getUTCDay()];

    let msg = `[📋 ${month}/${date}(${dayName}) 금일 예약 현황]\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n`;

    if (reservations.length === 0) {
        msg += `\n예약 없음`;
    } else {
        const totalPeople = reservations.reduce((sum, r) => sum + (parseInt(r.people || r.partySize) || 0), 0);
        msg += `총 ${reservations.length}팀 / ${totalPeople}명\n\n`;

        reservations.forEach(r => {
            msg += formatReservation(r) + '\n';
        });
    }

    return msg.trim();
}

/**
 * 매일 오후 2시 예약 현황 카톡 전송
 */
async function sendDailyReservationBriefing() {
    try {
        const reservations = getTodayReservations();
        const msg = buildDailySummaryMessage(reservations);
        await sendToKakao(msg);
        console.log('✅ 예약 현황 카톡 전송 완료');
    } catch (e) {
        console.error('❌ 예약 현황 카톡 전송 실패:', e);
    }
}

/**
 * 당일 예약 즉시 알림 (오후 2시 이후에만)
 */
async function sendNewReservationNotify(newRes) {
    try {
        const now = getKstNow();
        const todayStr = now.toISOString().slice(0, 10);

        // 당일 예약이 아니면 무시
        if (newRes.date !== todayStr) return;

        // 오후 2시 이전이면 무시 (2시 브리핑에 포함됨)
        const kstHour = now.getUTCHours();
        if (kstHour < 14) return;

        // 새 예약 정보 + 전체 현황
        const allToday = getTodayReservations();

        const month = now.getUTCMonth() + 1;
        const date = now.getUTCDate();

        let msg = `[🔔 당일 예약 추가!]\n`;
        msg += `━━━━━━━━━━━━━━━━━━\n`;
        msg += `▶ 신규:${formatReservation(newRes)}\n\n`;
        msg += buildDailySummaryMessage(allToday);

        await sendToKakao(msg);
        console.log('✅ 당일 신규 예약 즉시 알림 전송 완료');
    } catch (e) {
        console.error('❌ 당일 신규 예약 알림 전송 실패:', e);
    }
}

module.exports = { sendDailyReservationBriefing, sendNewReservationNotify };
