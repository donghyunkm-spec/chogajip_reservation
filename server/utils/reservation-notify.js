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
 * 당일 14시 이후 알림 대상인지 판단
 * - 대상 날짜가 오늘인지, 현재 KST 시각이 14시 이후인지 확인
 */
function shouldNotifyForDate(dateStr) {
    const now = getKstNow();
    const todayStr = now.toISOString().slice(0, 10);
    if (dateStr !== todayStr) return false;
    const kstHour = now.getUTCHours();
    if (kstHour < 14) return false;
    return true;
}

/**
 * 당일 예약 즉시 알림 (오후 2시 이후에만)
 */
async function sendNewReservationNotify(newRes) {
    try {
        if (!shouldNotifyForDate(newRes.date)) return;

        const allToday = getTodayReservations();

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

/**
 * 당일 예약 수정 즉시 알림 (오후 2시 이후에만)
 * - 구예약 혹은 신예약 중 하나라도 날짜가 오늘이면 발송
 */
async function sendUpdateReservationNotify(oldRes, newRes) {
    try {
        const oldIsToday = shouldNotifyForDate(oldRes && oldRes.date);
        const newIsToday = shouldNotifyForDate(newRes && newRes.date);
        if (!oldIsToday && !newIsToday) return;

        const allToday = getTodayReservations();

        let msg = `[✏️ 당일 예약 수정!]\n`;
        msg += `━━━━━━━━━━━━━━━━━━\n`;
        if (oldIsToday && newIsToday) {
            msg += `▶ 변경전:${formatReservation(oldRes)}\n`;
            msg += `▶ 변경후:${formatReservation(newRes)}\n\n`;
        } else if (oldIsToday && !newIsToday) {
            msg += `▶ 당일 → 타일자 이동\n`;
            msg += `▶ 변경전:${formatReservation(oldRes)}\n`;
            msg += `▶ 변경후(${newRes.date}):${formatReservation(newRes)}\n\n`;
        } else {
            msg += `▶ 타일자 → 당일 이동\n`;
            msg += `▶ 변경전(${oldRes.date}):${formatReservation(oldRes)}\n`;
            msg += `▶ 변경후:${formatReservation(newRes)}\n\n`;
        }
        msg += buildDailySummaryMessage(allToday);

        await sendToKakao(msg);
        console.log('✅ 당일 예약 수정 즉시 알림 전송 완료');
    } catch (e) {
        console.error('❌ 당일 예약 수정 알림 전송 실패:', e);
    }
}

/**
 * 당일 예약 취소/삭제 즉시 알림 (오후 2시 이후에만)
 */
async function sendCancelReservationNotify(cancelledRes) {
    try {
        if (!shouldNotifyForDate(cancelledRes && cancelledRes.date)) return;

        const allToday = getTodayReservations();

        let msg = `[❌ 당일 예약 취소!]\n`;
        msg += `━━━━━━━━━━━━━━━━━━\n`;
        msg += `▶ 취소:${formatReservation(cancelledRes)}\n\n`;
        msg += buildDailySummaryMessage(allToday);

        await sendToKakao(msg);
        console.log('✅ 당일 예약 취소 즉시 알림 전송 완료');
    } catch (e) {
        console.error('❌ 당일 예약 취소 알림 전송 실패:', e);
    }
}

module.exports = {
    sendDailyReservationBriefing,
    sendNewReservationNotify,
    sendUpdateReservationNotify,
    sendCancelReservationNotify
};
