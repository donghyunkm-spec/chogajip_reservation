const express = require('express');
const fs = require('fs');
const router = express.Router();
const { readJson, writeJson, getStaffFile, addLog } = require('../utils/data');
const { sendToKakao } = require('../utils/kakao');
const { getDailyScheduleMessage } = require('../utils/staff-calc');
const { asyncHandler } = require('../middleware/error-handler');

// 직원 조회
router.get('/', (req, res) => {
    const store = req.query.store || 'chogazip';
    const staffFile = getStaffFile(store);
    if (!fs.existsSync(staffFile)) fs.writeFileSync(staffFile, '[]');
    res.json({ success: true, data: readJson(staffFile, []) });
});

// 직원 등록
router.post('/', (req, res) => {
    const { staffList, actor, store } = req.body;
    const file = getStaffFile(store || 'chogazip');
    let staff = readJson(file, []);
    if (!Array.isArray(staff)) staff = [];

    const newStaff = staffList.map(s => ({ ...s, id: Date.now() + Math.floor(Math.random()*1000) }));
    staff.push(...newStaff);

    if (writeJson(file, staff)) {
        addLog(store, actor, '직원등록', `${newStaff.length}명`, '일괄등록');
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

// 직원 수정
router.put('/:id', (req, res) => {
    const { updates, actor, store } = req.body;
    const file = getStaffFile(store || 'chogazip');
    let staff = readJson(file, []);
    const idx = staff.findIndex(s => s.id == req.params.id);

    if (idx !== -1) {
        staff[idx] = { ...staff[idx], ...updates };
        writeJson(file, staff);
        addLog(store, actor, '직원수정', staff[idx].name, '정보수정');
        res.json({ success: true });
    } else res.status(404).json({ success: false });
});

// 직원 삭제
router.delete('/:id', (req, res) => {
    const store = req.query.store || 'chogazip';
    const actor = req.query.actor || 'Unknown';
    const file = getStaffFile(store);
    let staff = readJson(file, []);

    const target = staff.find(s => s.id == req.params.id);
    staff = staff.filter(s => s.id != req.params.id);

    if (writeJson(file, staff)) {
        if(target) addLog(store, actor, '직원삭제', target.name, '삭제됨');
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

// Bug #1 수정: async 버전만 유지 (카카오 알림 포함)
router.post('/exception', asyncHandler(async (req, res) => {
    const { id, date, type, time, actor, store } = req.body;
    const file = getStaffFile(store || 'chogazip');
    let staff = readJson(file, []);
    const target = staff.find(s => s.id == id);

    if (target) {
        if (!target.exceptions) target.exceptions = {};
        if (type === 'delete') delete target.exceptions[date];
        else target.exceptions[date] = { type, time };

        writeJson(file, staff);
        addLog(store, actor, '근무변경', target.name, `${date} ${type}`);

        // 변경된 날짜가 '오늘'이면 즉시 카톡 발송
        const todayStr = new Date().toISOString().split('T')[0];
        if (date === todayStr) {
            console.log('🔔 당일 근무 변경 감지! 알림 발송 중...');
            const msg = getDailyScheduleMessage(store, new Date());
            await sendToKakao(`📢 [긴급] 당일 근무 변경 알림\n(${actor}님 수정)\n\n${msg}`);
        }

        res.json({ success: true });
    } else res.status(404).json({ success: false });
}));

// 대타 등록
router.post('/temp', asyncHandler(async (req, res) => {
    const { name, date, time, salary, actor, store } = req.body;
    const file = getStaffFile(store || 'chogazip');
    let staff = readJson(file, []);

    const newWorker = {
        id: Date.now(),
        name: name,
        position: '알바(대타)',
        workDays: [],
        salaryType: 'hourly',
        salary: parseInt(salary) || 0,
        time: '',
        exceptions: {
            [date]: { type: 'work', time: time }
        }
    };

    staff.push(newWorker);

    if (writeJson(file, staff)) {
        addLog(store, actor, '대타등록', name, `${date} ${time}`);

        // 변경된 날짜가 '오늘'이면 즉시 카톡 발송
        const todayStr = new Date().toISOString().split('T')[0];
        if (date === todayStr) {
             console.log('🔔 당일 대타 등록 감지! 알림 발송 중...');
             const msg = getDailyScheduleMessage(store, new Date());
             await sendToKakao(`📢 [긴급] 당일 대타/추가 알림\n(${actor}님 등록)\n\n${msg}`);
        }

        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
}));

module.exports = router;
