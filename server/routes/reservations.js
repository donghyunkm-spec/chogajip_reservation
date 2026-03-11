const express = require('express');
const router = express.Router();
const { readJson, writeJson, FINAL_DATA_FILE } = require('../utils/data');
const { asyncHandler } = require('../middleware/error-handler');
const { sendNewReservationNotify } = require('../utils/reservation-notify');

// 예약 조회
router.get('/', (req, res) => {
    res.json({ success: true, data: readJson(FINAL_DATA_FILE, []) });
});

// 예약 통계 (중요: :id 패턴보다 먼저 정의)
router.get('/stats', (req, res) => {
    const reservations = readJson(FINAL_DATA_FILE, []);
    const { startDate, endDate } = req.query;

    let filtered = reservations.filter(r => r.status === 'active' || !r.status);
    if (startDate) filtered = filtered.filter(r => r.date >= startDate);
    if (endDate) filtered = filtered.filter(r => r.date <= endDate);

    // 1. 일자별 통계
    const byDate = {};
    filtered.forEach(r => {
        if (!byDate[r.date]) byDate[r.date] = { count: 0, people: 0 };
        byDate[r.date].count++;
        byDate[r.date].people += parseInt(r.people) || 0;
    });

    // 2. 시간별 통계
    const byHour = {};
    for (let h = 11; h <= 22; h++) {
        byHour[h] = { count: 0, people: 0 };
    }
    filtered.forEach(r => {
        if (r.time) {
            const hour = parseInt(r.time.split(':')[0]);
            if (byHour[hour]) {
                byHour[hour].count++;
                byHour[hour].people += parseInt(r.people) || 0;
            }
        }
    });

    // 3. 요일별 통계
    const byDayOfWeek = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    filtered.forEach(r => {
        if (r.date) {
            const dow = new Date(r.date).getDay();
            byDayOfWeek[dow]++;
        }
    });

    // 4. 단골 분석
    const customerMap = {};
    filtered.forEach(r => {
        const key = `${(r.name || '').trim()}_${(r.phone || '').replace(/[^0-9]/g, '').slice(-4)}`;
        const displayName = (r.name || '익명').trim();

        if (!customerMap[key]) {
            customerMap[key] = {
                name: displayName,
                phone: r.phone || '',
                count: 0,
                totalPeople: 0,
                dates: [],
                lastVisit: null
            };
        }
        customerMap[key].count++;
        customerMap[key].totalPeople += parseInt(r.people) || 0;
        customerMap[key].dates.push(r.date);
        if (!customerMap[key].lastVisit || r.date > customerMap[key].lastVisit) {
            customerMap[key].lastVisit = r.date;
        }
    });

    const regulars = Object.values(customerMap)
        .filter(c => c.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);

    // 5. 좌석 선호도
    const bySeatPref = { '룸': 0, '홀': 0, '관계없음': 0 };
    filtered.forEach(r => {
        const pref = r.seatPreference || '관계없음';
        if (bySeatPref[pref] !== undefined) bySeatPref[pref]++;
    });

    // 6. 인원수별 분포
    const byPartySize = {};
    filtered.forEach(r => {
        const size = parseInt(r.people) || 0;
        const category = size <= 2 ? '1-2명' : size <= 4 ? '3-4명' : size <= 6 ? '5-6명' : size <= 10 ? '7-10명' : '11명+';
        if (!byPartySize[category]) byPartySize[category] = 0;
        byPartySize[category]++;
    });

    // 7. 월별 통계
    const byMonth = {};
    filtered.forEach(r => {
        if (r.date) {
            const month = r.date.substring(0, 7);
            if (!byMonth[month]) byMonth[month] = { count: 0, people: 0 };
            byMonth[month].count++;
            byMonth[month].people += parseInt(r.people) || 0;
        }
    });

    // 8. 예약 방법 통계
    const byMethod = {};
    filtered.forEach(r => {
        const method = r.reservationMethod || '기타';
        if (!byMethod[method]) byMethod[method] = 0;
        byMethod[method]++;
    });

    res.json({
        success: true,
        data: {
            total: filtered.length,
            totalPeople: filtered.reduce((sum, r) => sum + (parseInt(r.people) || 0), 0),
            byDate,
            byHour,
            byDayOfWeek,
            regulars,
            allCustomers: Object.values(customerMap).sort((a, b) => b.count - a.count),
            bySeatPref,
            byPartySize,
            byMonth,
            byMethod
        }
    });
});

// 예약 생성
router.post('/', (req, res) => {
    let reservations = readJson(FINAL_DATA_FILE, []);
    const newRes = { ...req.body, id: Date.now(), status: 'active' };
    reservations.push(newRes);
    if (writeJson(FINAL_DATA_FILE, reservations)) {
        // 당일 예약이면 즉시 카톡 알림 (비동기, 응답 블로킹 안함)
        sendNewReservationNotify(newRes).catch(e => console.error('카톡 알림 오류:', e));
        res.json({ success: true });
    }
    else res.status(500).json({ success: false });
});

// 예약 수정
router.put('/:id', (req, res) => {
    let reservations = readJson(FINAL_DATA_FILE, []);
    const idx = reservations.findIndex(r => String(r.id) === req.params.id);
    if (idx !== -1) {
        reservations[idx] = { ...reservations[idx], ...req.body };
        if (writeJson(FINAL_DATA_FILE, reservations)) {
            res.json({ success: true });
        } else res.status(500).json({ success: false });
    } else res.status(404).json({ success: false });
});

// 예약 삭제
router.delete('/:id', (req, res) => {
    let reservations = readJson(FINAL_DATA_FILE, []);
    reservations = reservations.filter(r => String(r.id) !== req.params.id);
    if (writeJson(FINAL_DATA_FILE, reservations)) {
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

module.exports = router;
