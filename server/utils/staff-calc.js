const { readJson, getStaffFile } = require('./data');

function calculateServerStaffCost(staffList, monthStr) {
    if (!staffList || !Array.isArray(staffList)) return 0;

    const [y, m] = monthStr.split('-');
    const year = parseInt(y);
    const month = parseInt(m);
    const lastDayObj = new Date(year, month, 0);
    const totalDaysInMonth = lastDayObj.getDate();
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let totalPay = 0;

    staffList.forEach(s => {
        const sDate = s.startDate ? new Date(s.startDate) : null;
        const eDate = s.endDate ? new Date(s.endDate) : null;

        const isEmployedAt = (dVal) => {
            const t = new Date(year, month - 1, dVal); t.setHours(0,0,0,0);
            if (sDate) { const start = new Date(sDate); start.setHours(0,0,0,0); if (t < start) return false; }
            if (eDate) { const end = new Date(eDate); end.setHours(0,0,0,0); if (t > end) return false; }
            return true;
        };

        if (s.salaryType === 'monthly') {
            let employedDays = 0;
            for (let d = 1; d <= totalDaysInMonth; d++) {
                if (isEmployedAt(d)) employedDays++;
            }
            if (employedDays === totalDaysInMonth) totalPay += (s.salary || 0);
            else totalPay += Math.floor((s.salary || 0) / totalDaysInMonth * employedDays);
        } else {
            let hours = 0;
            for (let d = 1; d <= totalDaysInMonth; d++) {
                if (!isEmployedAt(d)) continue;

                const dateKey = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const dateObj = new Date(year, month - 1, d);
                const dayName = dayMap[dateObj.getDay()];

                let isWorking = false;
                let timeStr = s.time;

                if (s.exceptions && s.exceptions[dateKey]) {
                    if (s.exceptions[dateKey].type === 'work') { isWorking = true; timeStr = s.exceptions[dateKey].time; }
                } else {
                    if (s.workDays.includes(dayName)) isWorking = true;
                }

                if (isWorking && timeStr && timeStr.includes('~')) {
                    const [start, end] = timeStr.split('~');
                    const [sh, sm] = start.trim().split(':').map(Number);
                    const [eh, em] = end.trim().split(':').map(Number);
                    let h = (eh * 60 + em) - (sh * 60 + sm);
                    if (h < 0) h += 24 * 60;
                    hours += (h / 60);
                }
            }
            totalPay += Math.floor(hours * (s.salary || 0));
        }
    });
    return totalPay;
}

function getDailyScheduleMessage(store, dateObj) {
    const storeName = store === 'yangeun' ? '🥘 양은이네' : '🏠 초가짚';
    const file = getStaffFile(store);
    const staffList = readJson(file, []);

    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayKey = dayMap[dateObj.getDay()];
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    let workers = [];
    let totalDailyCost = 0;

    staffList.forEach(s => {
        const sDate = s.startDate ? new Date(s.startDate) : null;
        const eDate = s.endDate ? new Date(s.endDate) : null;
        const targetDate = new Date(year, month - 1, day); targetDate.setHours(0,0,0,0);

        if (sDate) { const start = new Date(sDate); start.setHours(0,0,0,0); if (targetDate < start) return; }
        if (eDate) { const end = new Date(eDate); end.setHours(0,0,0,0); if (targetDate > end) return; }

        let isWorking = false;
        let timeStr = s.time;

        if (s.exceptions && s.exceptions[dateStr]) {
            const ex = s.exceptions[dateStr];
            if (ex.type === 'work') { isWorking = true; timeStr = ex.time; }
            else if (ex.type === 'off') { isWorking = false; }
        } else {
            if (s.workDays && s.workDays.includes(dayKey)) isWorking = true;
        }

        if (isWorking) {
            let cost = 0;
            if (s.salaryType === 'monthly') {
                cost = Math.floor((s.salary || 0) / lastDayOfMonth);
            } else {
                if (timeStr && timeStr.includes('~')) {
                    const [start, end] = timeStr.split('~');
                    const [sh, sm] = start.trim().split(':').map(Number);
                    const [eh, em] = end.trim().split(':').map(Number);

                    let startMin = sh * 60 + (sm || 0);
                    let endMin = eh * 60 + (em || 0);
                    if (endMin < startMin) endMin += 24 * 60;

                    const hours = (endMin - startMin) / 60;
                    cost = Math.floor(hours * (s.salary || 0));
                }
            }
            totalDailyCost += cost;
            workers.push({ name: s.name, time: timeStr });
        }
    });

    if (workers.length === 0) {
        return `${storeName}: 근무 없음 (휴무)`;
    }

    let msg = `${storeName}: 근무인원 ${workers.length}명\n`;

    if (workers.length >= 8) {
        msg += `🚨 [경고] 인원과다(${workers.length}명) → 비용 점검필요\n`;
    } else if (workers.length <= 6) {
        msg += `⚠️ [확인] 인원부족(${workers.length}명) → 서비스 점검필요\n`;
    }

    workers.forEach(w => {
        msg += `- ${w.name}: ${w.time}\n`;
    });
    msg += `💰 금일 인건비: ${totalDailyCost.toLocaleString()}원`;

    return msg;
}

module.exports = { calculateServerStaffCost, getDailyScheduleMessage };
