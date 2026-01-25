// staff.js - 직원관리 + 근무관리

// ==========================================
// 1. 전역 변수
// ==========================================
window.staffList = [];
let currentDate = new Date();
let calendarDate = new Date();
let currentWeekStartDate = new Date();
let currentManageDate = new Date();

// 주간 기준일 초기화
(function() {
    const today = new Date();
    const day = today.getDay();
    currentWeekStartDate.setDate(today.getDate() - day);
})();

// ==========================================
// 2. 직원 관리 탭 월 이동
// ==========================================
function changeManageMonth(delta) {
    currentManageDate.setMonth(currentManageDate.getMonth() + delta);
    renderManageList();
}

function resetManageMonth() {
    currentManageDate = new Date();
    renderManageList();
}

// ==========================================
// 3. 직원 데이터 로드 및 관리
// ==========================================
async function loadStaffData() {
    try {
        const res = await fetch(`/api/staff?store=${currentStore}`);
        const json = await res.json();
        staffList = json.data;

        renderDailyView();
        renderWeeklyView();
        renderMonthlyView();
        renderManageList();

    } catch(e) { console.error("데이터 로드 실패"); }
}

function renderManageList() {
    const list = document.getElementById('manageStaffList');
    if(!list) return;

    const titleEl = document.getElementById('manageMonthTitle');
    if(titleEl) {
        titleEl.textContent = `${currentManageDate.getFullYear()}년 ${currentManageDate.getMonth() + 1}월 근무자`;
    }

    if (!staffList || staffList.length === 0) {
        list.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">직원 데이터를 불러오는 중...</div>';
        return;
    }

    list.innerHTML = '';
    const isAdmin = currentUser && currentUser.role === 'admin';

    const y = currentManageDate.getFullYear();
    const m = currentManageDate.getMonth();
    const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
    const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];

    const filteredStaff = staffList.filter(s => {
        if (!s.startDate && !s.endDate) return true;
        if (s.startDate && s.startDate > lastDay) return false;
        if (s.endDate && s.endDate < firstDay) return false;
        return true;
    });

    const nameCount = {};
    staffList.forEach(s => { nameCount[s.name] = (nameCount[s.name] || 0) + 1; });

    if (isAdmin) {
        const duplicates = Object.keys(nameCount).filter(name => nameCount[name] > 1);
        if (duplicates.length > 0) {
            list.innerHTML += `
                <div style="background:#fff3cd; border:2px solid #ffc107; padding:15px; border-radius:8px; margin-bottom:20px;">
                    <h4 style="color:#856404; margin:0 0 10px 0;">⚠️ 중복 직원 감지됨 (${duplicates.length}명)</h4>
                    <p style="font-size:13px; color:#856404; margin-bottom:10px;">
                        동일 이름의 직원이 여러 명입니다: <strong>${duplicates.join(', ')}</strong>
                    </p>
                    <button onclick="window.showMergeStaffModal()" style="background:#28a745; color:white; border:none; padding:10px 20px; border-radius:5px; font-weight:bold; cursor:pointer;">
                        🔧 중복 직원 병합하기
                    </button>
                </div>
            `;
        }
    }

    if (filteredStaff.length === 0) {
        list.innerHTML += '<div style="text-align:center; padding:20px; color:#999;">선택한 달에 근무하는 직원이 없습니다.</div>';
        return;
    }

    filteredStaff.forEach(s => {
        const daysStr = s.workDays.map(d => DAY_MAP[d]).join(',');
        const salaryInfo = isAdmin ?
            `<div style="font-size:12px; color:#28a745; margin-top:3px;">
                💰 ${s.salaryType === 'monthly' ? '월급' : '시급'}: ${s.salary ? s.salary.toLocaleString() : '0'}원
             </div>` : '';

        let statusBadge = '';
        if (s.endDate && s.endDate < new Date().toISOString().split('T')[0]) {
            statusBadge = '<span class="badge" style="background:#999; color:white; font-size:10px; margin-left:5px;">퇴사</span>';
        }

        list.innerHTML += `
            <div class="reservation-item">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="font-size:16px;">${s.name}</strong> ${statusBadge}
                        <span style="font-size:12px; color:#666;">(${s.time})</span>
                        <div style="font-size:13px; margin-top:5px;">📅 ${daysStr}</div>
                        <div style="font-size:11px; color:#666; margin-top:2px;">기간: ${s.startDate||'미설정'} ~ ${s.endDate||'미설정'}</div>
                        ${salaryInfo}
                    </div>
                    <div>
                        <button class="edit-btn" onclick="openEditModal(${s.id})">수정</button>
                        <button class="delete-btn" onclick="deleteStaff(${s.id})">삭제</button>
                    </div>
                </div>
            </div>`;
    });
}

function openEditModal(id) {
    if (!currentUser) { openLoginModal(); return; }
    const target = staffList.find(s => s.id === id);
    if (!target) return;

    document.getElementById('editId').value = target.id;
    document.getElementById('editName').value = target.name;
    document.getElementById('editTime').value = target.time;

    document.getElementById('editStartDate').value = target.startDate || '';
    document.getElementById('editEndDate').value = target.endDate || '';

    const isAdmin = currentUser.role === 'admin';
    const salarySection = document.getElementById('modalSalarySection');
    if (isAdmin) {
        salarySection.style.display = 'block';
        document.getElementById('editSalaryType').value = target.salaryType || 'hourly';
        document.getElementById('editSalary').value = target.salary || 0;
    } else {
        salarySection.style.display = 'none';
    }
    document.getElementById('editModalOverlay').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModalOverlay').style.display = 'none';
}

async function saveStaffEdit() {
    const id = parseInt(document.getElementById('editId').value);
    const time = document.getElementById('editTime').value;

    const startDate = document.getElementById('editStartDate').value || null;
    const endDate = document.getElementById('editEndDate').value || null;

    const salaryType = document.getElementById('editSalaryType').value;
    const salary = parseInt(document.getElementById('editSalary').value) || 0;

    const updates = { time, startDate, endDate };

    if (currentUser && currentUser.role === 'admin') {
        updates.salaryType = salaryType;
        updates.salary = salary;
    }

    try {
        await fetch(`/api/staff/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ updates: updates, actor: currentUser.name, store: currentStore })
        });
        closeEditModal();
        loadStaffData();
        if(currentUser.role === 'admin') loadLogs();
    } catch(e) { alert('수정 실패'); }
}

async function deleteStaff(id) {
    if (!currentUser) { openLoginModal(); return; }

    if (currentUser.role !== 'admin') {
        alert("직원삭제는 카톡으로 요청하세요");
        return;
    }

    if (!confirm('정말로 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.')) return;

    try {
        await fetch(`/api/staff/${id}?actor=${encodeURIComponent(currentUser.name)}&store=${currentStore}`, { method: 'DELETE' });
        loadStaffData();
        loadLogs();
    } catch(e) {
        alert('삭제 중 오류가 발생했습니다.');
    }
}

// 중복 직원 병합 모달
window.showMergeStaffModal = function() {
    const nameCount = {};
    staffList.forEach(s => { nameCount[s.name] = (nameCount[s.name] || 0) + 1; });
    const duplicates = Object.keys(nameCount).filter(name => nameCount[name] > 1);

    if (duplicates.length === 0) {
        alert('중복된 직원이 없습니다.');
        return;
    }

    let html = `<div style="max-height:400px; overflow-y:auto;">
        <p style="font-size:13px; color:#666; margin-bottom:15px;">
            이름이 같은 직원들의 <strong>근무 기록(출근부)을 하나로 합칩니다.</strong><br>
            가장 최근 데이터(혹은 월급/시급이 설정된 데이터)를 기준으로 통합됩니다.
        </p>`;

    duplicates.forEach(name => {
        const sameNameStaff = staffList.filter(s => s.name === name);
        sameNameStaff.sort((a,b) => b.id - a.id);
        const keeper = sameNameStaff[0];

        html += `
            <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid #dee2e6;">
                <h4 style="margin:0 0 10px 0; color:#495057;">👤 ${name} (${sameNameStaff.length}건)</h4>
                <div style="font-size:12px; color:#666;">
                    <strong>[유지될 정보]</strong> 시급: ${keeper.salary.toLocaleString()}원 / 근무: ${keeper.time}
                </div>
                <div style="margin-top:5px; font-size:12px; color:#007bff;">
                    ➕ 과거 근무 기록들이 모두 이 직원에게 합쳐집니다.
                </div>
                <button onclick="mergeStaffByName('${name}')" style="width:100%; background:#dc3545; color:white; border:none; padding:8px; border-radius:5px; font-weight:bold; margin-top:10px;">
                    🔧 병합 실행 (나머지 ${sameNameStaff.length - 1}개 삭제)
                </button>
            </div>`;
    });
    html += '</div>';

    const content = document.getElementById('mergeModalContent');
    const overlay = document.getElementById('mergeModalOverlay');
    if (content && overlay) {
        content.innerHTML = html;
        overlay.style.display = 'flex';
    }
}

window.closeMergeModal = function() {
    const modal = document.getElementById('mergeModalOverlay');
    if (modal) {
        modal.style.display = 'none';
    }
}

window.mergeStaffByName = async function(name) {
    const sameNameStaff = staffList.filter(s => s.name === name);
    if (sameNameStaff.length < 2) return;

    if (!confirm(`${name}님의 중복 데이터를 하나로 합치시겠습니까?\n\n모든 근무 요일과 기록이 하나로 통합됩니다.`)) return;

    sameNameStaff.sort((a, b) => {
        if (a.startDate && !b.startDate) return -1;
        if (!a.startDate && b.startDate) return 1;
        return b.id - a.id;
    });

    const keeper = sameNameStaff[0];
    const deletables = sameNameStaff.slice(1);

    let combinedExceptions = { ...keeper.exceptions };
    let combinedWorkDays = new Set(keeper.workDays || []);

    let earliestStart = keeper.startDate;
    let latestEnd = keeper.endDate;

    deletables.forEach(s => {
        if (s.exceptions) {
            combinedExceptions = { ...combinedExceptions, ...s.exceptions };
        }

        if (s.workDays && Array.isArray(s.workDays)) {
            s.workDays.forEach(day => combinedWorkDays.add(day));
        }

        if (s.startDate && (!earliestStart || s.startDate < earliestStart)) earliestStart = s.startDate;
        if (s.endDate && (!latestEnd || s.endDate > latestEnd)) latestEnd = s.endDate;
    });

    const finalWorkDays = Array.from(combinedWorkDays);

    let finalSalary = keeper.salary;
    let finalSalaryType = keeper.salaryType;

    if (!finalSalary && deletables.some(s => s.salary > 0)) {
        const salarySource = deletables.find(s => s.salary > 0);
        finalSalary = salarySource.salary;
        finalSalaryType = salarySource.salaryType;
    }

    const updates = {
        startDate: earliestStart,
        endDate: latestEnd,
        exceptions: combinedExceptions,
        workDays: finalWorkDays,
        salary: finalSalary,
        salaryType: finalSalaryType
    };

    try {
        await fetch(`/api/staff/${keeper.id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ updates, actor: currentUser.name, store: currentStore })
        });

        for (const s of deletables) {
            await fetch(`/api/staff/${s.id}?actor=${encodeURIComponent(currentUser.name)}&store=${currentStore}`, { method: 'DELETE' });
        }

        alert(`병합 완료!\n총 ${finalWorkDays.length}개의 요일과 근무 기록이 통합되었습니다.`);
        window.closeMergeModal();
        loadStaffData();

    } catch (e) {
        console.error(e);
        alert('병합 중 오류 발생: ' + e.message);
    }
}

async function processBulkText() {
    const text = document.getElementById('bulkText').value;
    if (!text.trim()) return;

    const lines = text.split('\n');
    const payload = [];

    lines.forEach((line) => {
       let parts = line.split(',').map(p => p.trim());
       if (parts.length < 3) parts = line.split(/\s+/);
       if(parts.length >= 3) {
           const name = parts[0];
           const dayStr = parts[1];
           let timeStr = parts[2];
           const workDays = [];
            for (let [eng, kor] of Object.entries(DAY_MAP)) {
                if (dayStr.includes(kor)) workDays.push(eng);
            }
           timeStr = timeStr.replace('시', '').replace(' ', '');
            if (timeStr.includes('~')) {
                const [start, end] = timeStr.split('~');
                const cleanStart = start.includes(':') ? start : start + ':00';
                const cleanEnd = end.includes(':') ? end : end + ':00';
                timeStr = `${cleanStart}~${cleanEnd}`;
            }
           if (name && workDays.length > 0) payload.push({ name, time: timeStr, workDays, position: '직원', salaryType:'hourly', salary:0 });
       }
    });

    if (payload.length > 0) {
        if(confirm(`${payload.length}명 등록하시겠습니까?`)) {
            try {
                const res = await fetch('/api/staff', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ staffList: payload, actor: currentUser.name, store: currentStore })
                });
                const json = await res.json();
                if (json.success) {
                    alert('등록 완료!');
                    loadStaffData();
                    document.getElementById('bulkText').value = '';
                } else alert('실패');
            } catch (e) { alert('오류'); }
        }
    }
}

// ==========================================
// 4. 근무표 뷰 렌더링
// ==========================================

function getStartTimeValue(timeStr) {
    if (!timeStr) return 99999;
    let start = timeStr.split('~')[0].trim().replace('시', '').replace(' ', '');
    if (!start.includes(':')) start += ':00';
    const [h, m] = start.split(':').map(Number);
    return (h * 60) + (m || 0);
}

function calculateDuration(timeStr) {
    if (!timeStr || !timeStr.includes('~')) return 0;
    const parts = timeStr.split('~');
    const [sh, sm] = parts[0].trim().split(':').map(Number);
    const [eh, em] = parts[1].trim().split(':').map(Number);

    const startMin = sh * 60 + (sm || 0);
    let endMin = eh * 60 + (em || 0);
    if (endMin < startMin) endMin += 24 * 60;
    return (endMin - startMin) / 60;
}

// 일별 보기 렌더링
function renderDailyView() {
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayKey = dayMap[currentDate.getDay()];

    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const dateDisplay = document.getElementById('currentDateDisplay');
    if(dateDisplay) dateDisplay.textContent = `${month}월 ${day}일 (${DAY_MAP[todayKey]})`;

    const container = document.getElementById('dailyStaffList');
    if(!container) return;
    container.innerHTML = '';

    let dailyWorkers = [];

    staffList.forEach(staff => {
        if (staff.startDate && dateStr < staff.startDate) return;
        if (staff.endDate && dateStr > staff.endDate) return;

        let isWorking = false;
        let workTime = staff.time;
        let isException = false;
        let isOff = false;

        if (staff.exceptions && staff.exceptions[dateStr]) {
            const ex = staff.exceptions[dateStr];
            if (ex.type === 'work') {
                isWorking = true; workTime = ex.time; isException = true;
            } else if (ex.type === 'off') {
                isWorking = true;
                isException = true;
                isOff = true;
            }
        } else {
            if (staff.workDays.includes(todayKey)) {
                isWorking = true;
            }
        }

        if (isWorking) {
            dailyWorkers.push({ ...staff, displayTime: workTime, isException, isOff });
        }
    });

    const realWorkCount = dailyWorkers.filter(w => !w.isOff).length;

    const badge = document.getElementById('dailyCountBadge');
    if(badge) {
        badge.style.background = '#ff5722';

        if (realWorkCount >= 8) {
            badge.style.background = '#d32f2f';
            badge.innerHTML = `총 ${realWorkCount}명 근무<br><span style="font-size:11px; background:white; color:#d32f2f; padding:2px 5px; border-radius:4px; margin-top:4px; display:inline-block;">⚠️ 인원 과다 (비용 확인)</span>`;
        } else if (realWorkCount > 0 && realWorkCount <= 6) {
            badge.style.background = '#e65100';
            badge.innerHTML = `총 ${realWorkCount}명 근무<br><span style="font-size:11px; background:white; color:#e65100; padding:2px 5px; border-radius:4px; margin-top:4px; display:inline-block;">⚠️ 인원 부족? (확인)</span>`;
        } else {
            badge.textContent = `총 ${realWorkCount}명 근무`;
        }
    }

    dailyWorkers.sort((a,b) => {
        if(a.isOff && !b.isOff) return 1;
        if(!a.isOff && b.isOff) return -1;
        return getStartTimeValue(a.displayTime) - getStartTimeValue(b.displayTime);
    });

    if (dailyWorkers.length === 0) {
        container.innerHTML = '<div class="empty-state">근무자가 없습니다.</div>';
    } else {
        dailyWorkers.forEach(s => {
            let rowClass = s.isOff ? 'reservation-item temp-off-row' : 'reservation-item';
            let statusBadge = '';

            if (s.isOff) statusBadge = '<span class="badge" style="background:#9e9e9e; color:white;">⛔ 임시휴무</span>';
            else if (s.isException) statusBadge = '<span class="badge alternative-badge">변동</span>';

            let adminButtons = '';
            if (s.isOff) {
                adminButtons = `
                <div style="margin-top:5px; border-top:1px dashed #ccc; padding-top:5px; text-align:right;">
                     <button onclick="cancelException(${s.id}, '${dateStr}')" style="font-size:11px; padding:3px 6px; background:#666; color:white; border:none; border-radius:3px; cursor:pointer;">↩️ 휴무 취소 (근무복구)</button>
                </div>`;
            } else {
                adminButtons = `
                <div style="margin-top:5px; border-top:1px dashed #eee; padding-top:5px; text-align:right;">
                    <button onclick="openTimeChangeModal(${s.id}, '${dateStr}', '${s.displayTime}')" style="font-size:11px; padding:3px 6px; background:#17a2b8; color:white; border:none; border-radius:3px; cursor:pointer; margin-right:5px;">⏰ 시간변경</button>
                    <button onclick="setDailyException(${s.id}, '${dateStr}', 'off')" style="font-size:11px; padding:3px 6px; background:#dc3545; color:white; border:none; border-radius:3px; cursor:pointer;">⛔ 오늘휴무</button>
                </div>`;
            }

            container.innerHTML += `
                <div class="${rowClass}" style="border-left:5px solid ${s.isOff ? '#999' : '#4CAF50'};">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <strong>${s.name}</strong> ${statusBadge}
                            <div class="reservation-time" style="font-size:14px; color:${s.isOff ? '#999' : '#0066cc'}; font-weight:bold; margin-top:2px;">
                                ${s.isOff ? '휴무' : s.displayTime}
                            </div>
                            <div style="font-size:12px; color:#666;">${s.position || '직원'}</div>
                        </div>
                    </div>
                    ${adminButtons}
                </div>`;
        });
    }
}

function changeDate(d) { currentDate.setDate(currentDate.getDate() + d); renderDailyView(); }
function resetToToday() { currentDate = new Date(); renderDailyView(); }

// 주간 뷰 렌더링
function renderWeeklyView() {
    const startWeek = new Date(currentWeekStartDate);
    const endWeek = new Date(currentWeekStartDate);
    endWeek.setDate(endWeek.getDate() + 6);

    const rangeDisplay = document.getElementById('weeklyRangeDisplay');
    if(rangeDisplay) rangeDisplay.textContent = `${startWeek.getMonth()+1}월 ${startWeek.getDate()}일 ~ ${endWeek.getMonth()+1}월 ${endWeek.getDate()}일`;

    const realToday = new Date();

    DAY_KEYS.forEach((k, index) => {
        const headerDate = new Date(currentWeekStartDate);
        headerDate.setDate(headerDate.getDate() + index);
        const headerEl = document.getElementById(`header-${k}`);
        if (headerEl) {
            const month = headerDate.getMonth() + 1;
            const day = headerDate.getDate();
            headerEl.innerHTML = `${month}/${day}<br>${DAY_MAP[k]}`;
        }
    });

    DAY_KEYS.forEach(k => {
        const col = document.getElementById(`col-${k}`);
        if(col) { col.innerHTML = ''; col.classList.remove('today-highlight'); }
    });

    for (let i = 0; i < 7; i++) {
        const loopDate = new Date(currentWeekStartDate);
        loopDate.setDate(loopDate.getDate() + i);

        const year = loopDate.getFullYear();
        const month = String(loopDate.getMonth() + 1).padStart(2, '0');
        const day = String(loopDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const dayKey = DAY_KEYS[i];

        if (loopDate.getDate() === realToday.getDate() &&
            loopDate.getMonth() === realToday.getMonth() &&
            loopDate.getFullYear() === realToday.getFullYear()) {
            const col = document.getElementById(`col-${dayKey}`);
            if(col) col.classList.add('today-highlight');
        }

        let dayWorkers = [];
        staffList.forEach(s => {
            if (s.startDate && dateStr < s.startDate) return;
            if (s.endDate && dateStr > s.endDate) return;

            let isWorking = false;
            let workTime = s.time;
            let isException = false;
            let isOff = false;

            if (s.exceptions && s.exceptions[dateStr]) {
                const ex = s.exceptions[dateStr];
                if (ex.type === 'work') { isWorking = true; workTime = ex.time; isException = true; }
                else if (ex.type === 'off') { isWorking = true; isOff = true; }
            } else {
                if (s.workDays.includes(dayKey)) isWorking = true;
            }
            if (isWorking) dayWorkers.push({ staff: s, time: workTime, isException, isOff });
        });

        dayWorkers.sort((a,b) => {
             if(a.isOff && !b.isOff) return 1;
             if(!a.isOff && b.isOff) return -1;
             return getStartTimeValue(a.time) - getStartTimeValue(b.time)
        });

        const col = document.getElementById(`col-${dayKey}`);
        if(col) {
            dayWorkers.forEach(w => {
                let cardClass = 'staff-card-weekly';
                let timeText = w.time;

                if (w.isOff) {
                    cardClass += ' off-exception';
                    timeText = '휴무';
                } else if (w.isException) {
                    cardClass += ' exception';
                }

                col.innerHTML += `
                    <div class="${cardClass}">
                        <strong>${w.staff.name}</strong>
                        <span>${timeText}</span>
                    </div>`;
            });
        }
    }
}

function changeWeek(weeks) { currentWeekStartDate.setDate(currentWeekStartDate.getDate() + (weeks * 7)); renderWeeklyView(); }
function resetToThisWeek() {
    const today = new Date();
    const day = today.getDay();
    currentWeekStartDate = new Date(today);
    currentWeekStartDate.setDate(today.getDate() - day);
    renderWeeklyView();
}

// 월별 뷰 렌더링
function renderMonthlyView() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthDisplay = document.getElementById('monthDisplay');
    if(monthDisplay) monthDisplay.textContent = `${year}년 ${month + 1}월`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const container = document.getElementById('calendarBody');
    if(!container) return;
    container.innerHTML = '';
    const realToday = new Date();

    for (let i = 0; i < startDayOfWeek; i++) {
        container.innerHTML += `<div class="calendar-day empty"></div>`;
    }

    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let day = 1; day <= totalDays; day++) {
        const currentIterDate = new Date(year, month, day);
        const dayKey = dayMap[currentIterDate.getDay()];
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

        let count = 0;
        staffList.forEach(staff => {
            if (staff.startDate && dateStr < staff.startDate) return;
            if (staff.endDate && dateStr > staff.endDate) return;

            let isWorking = false;
            if (staff.exceptions && staff.exceptions[dateStr]) {
                if (staff.exceptions[dateStr].type === 'work') isWorking = true;
            } else {
                if (staff.workDays.includes(dayKey)) isWorking = true;
            }
            if(isWorking) count++;
        });

        let dayClass = '';
        if (currentIterDate.getDay() === 0) dayClass = 'sunday';
        if (currentIterDate.getDay() === 6) dayClass = 'saturday';
        if (currentIterDate.getDate() === realToday.getDate() &&
            currentIterDate.getMonth() === realToday.getMonth() &&
            currentIterDate.getFullYear() === realToday.getFullYear()) {
            dayClass += ' today-highlight';
        }

        let countStyle = 'background: #e3f2fd; color: #1565c0;';
        if (count > 0 && (count <= 6 || count >= 8)) {
            countStyle = 'background: #ffebee; color: #d32f2f; border: 1px solid #ffcdd2;';
        }

        container.innerHTML += `
            <div class="calendar-day ${dayClass}" onclick="goToDailyDetail(${year}, ${month}, ${day})">
                <span class="calendar-date-num">${day}</span>
                ${count > 0 ? `<span class="calendar-staff-count" style="${countStyle} padding: 4px; border-radius: 4px; text-align: center; font-size: 12px; font-weight: bold; margin-top: 5px; display: block;">근무 ${count}명</span>` : ''}
            </div>`;
    }
}

function changeMonth(d) { calendarDate.setMonth(calendarDate.getMonth() + d); renderMonthlyView(); }
function resetToThisMonth() { calendarDate = new Date(); renderMonthlyView(); }

function goToDailyDetail(year, month, day) {
    currentDate = new Date(year, month, day);
    switchTab('attendance');
    const dailyBtn = document.querySelector('button[onclick*="att-daily"]');
    if(dailyBtn) switchAttSubTab('att-daily', dailyBtn);
}

// ==========================================
// 5. 시간 변경 모달
// ==========================================
function openTimeChangeModal(id, dateStr, currentStr) {
    if (!currentUser) { openLoginModal(); return; }
    initTimeChangeOptions();

    document.getElementById('timeChangeId').value = id;
    document.getElementById('timeChangeDate').value = dateStr;
    document.getElementById('timeChangeModal').style.display = 'flex';
}

function closeTimeChangeModal() {
    document.getElementById('timeChangeModal').style.display = 'none';
}

function initTimeChangeOptions() {
    const hours = [];
    for(let i=0; i<=30; i++) {
        const val = i < 24 ? i : i - 24;
        const txt = i < 24 ? `${i}` : `(익일)${i-24}`;
        const valStr = String(val).padStart(2, '0');
        hours.push(`<option value="${valStr}">${txt}</option>`);
    }
    const html = hours.join('');

    const els = ['tcStartHour', 'tcEndHour'];
    els.forEach(id => {
        const el = document.getElementById(id);
        if(el && el.children.length === 0) {
            el.innerHTML = html;
            if(id === 'tcStartHour') el.value = "18";
            if(id === 'tcEndHour') el.value = "23";
        }
    });
}

async function submitTimeChange() {
    const id = parseInt(document.getElementById('timeChangeId').value);
    const dateStr = document.getElementById('timeChangeDate').value;

    const sh = document.getElementById('tcStartHour').value;
    const sm = document.getElementById('tcStartMin').value;
    const eh = document.getElementById('tcEndHour').value;
    const em = document.getElementById('tcEndMin').value;

    const newTime = `${sh}:${sm}~${eh}:${em}`;

    await callExceptionApi({ id, date: dateStr, type: 'work', time: newTime });
    alert('시간이 변경되었습니다.');
    closeTimeChangeModal();
}

async function cancelException(id, dateStr) {
    if(!confirm('휴무 설정을 취소하고 원래 근무로 되돌리시겠습니까?')) return;

    try {
        await fetch('/api/staff/exception', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                id: id,
                date: dateStr,
                type: 'delete',
                actor: currentUser.name,
                store: currentStore
            })
        });
        alert('휴무가 취소되고 원래 근무로 복구되었습니다.');
        loadStaffData();
    } catch(e) {
        console.error('휴무 복구 실패:', e);
        alert('복구 실패');
    }
}

// ==========================================
// 6. 급여 계산
// ==========================================
function calculateMonthlySalary() {
    const targetDate = currentManageDate;

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();

    const modalTitle = document.querySelector('#salaryModal h2');
    if(modalTitle) modalTitle.textContent = `💰 ${year}년 ${month + 1}월 예상 급여`;

    const lastDayObj = new Date(year, month + 1, 0);
    const totalDaysInMonth = lastDayObj.getDate();
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let salaryReport = [];

    staffList.forEach(s => {
        const sDate = s.startDate ? new Date(s.startDate) : null;
        const eDate = s.endDate ? new Date(s.endDate) : null;

        const isEmployedAt = (checkDate) => {
            const t = new Date(checkDate); t.setHours(0,0,0,0);
            if (sDate) { const start = new Date(sDate); start.setHours(0,0,0,0); if (t < start) return false; }
            if (eDate) { const end = new Date(eDate); end.setHours(0,0,0,0); if (t > end) return false; }
            return true;
        };

        if (s.salaryType === 'monthly') {
            let employedDays = 0;
            let statusText = '만근';

            for (let d = 1; d <= totalDaysInMonth; d++) {
                const currentDay = new Date(year, month, d);
                if (isEmployedAt(currentDay)) employedDays++;
            }

            let finalPay = s.salary || 0;
            if (employedDays < totalDaysInMonth) {
                finalPay = Math.floor((s.salary / totalDaysInMonth) * employedDays);
                statusText = `${employedDays}일 재직 (일할)`;
            }

            salaryReport.push({ name: s.name, type: '월급', workCount: statusText, totalHours: '-', amount: finalPay });
            return;
        }

        let totalHours = 0;
        let workCount = 0;

        for (let d = 1; d <= totalDaysInMonth; d++) {
            const currentDateObj = new Date(year, month, d);
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dayKey = dayMap[currentDateObj.getDay()];

            if (!isEmployedAt(currentDateObj)) continue;

            let isWorking = false;
            let timeStr = s.time;

            if (s.exceptions && s.exceptions[dateStr]) {
                const ex = s.exceptions[dateStr];
                if (ex.type === 'work') { isWorking = true; timeStr = ex.time; }
                else if (ex.type === 'off') { isWorking = false; }
            } else {
                if (s.workDays.includes(dayKey)) isWorking = true;
            }

            if (isWorking) {
                workCount++;
                totalHours += calculateDuration(timeStr);
            }
        }

        salaryReport.push({
            name: s.name, type: '시급',
            workCount: workCount + '일', totalHours: totalHours.toFixed(1) + '시간',
            amount: Math.floor(totalHours * (s.salary || 0))
        });
    });

    const tbody = document.getElementById('salaryTableBody');
    if(tbody) {
        tbody.innerHTML = '';
        let totalAll = 0;

        salaryReport.forEach(r => {
            totalAll += r.amount;
            tbody.innerHTML += `
                <tr>
                    <td>${r.name}${(r.workCount.includes('일할')) ? '<br><span style="font-size:10px; color:red;">(중도 입/퇴사)</span>' : ''}</td>
                    <td><span class="badge" style="background:${r.type === '월급'?'#28a745':'#17a2b8'}; color:white; padding:3px 6px; border-radius:4px; font-size:11px;">${r.type}</span></td>
                    <td style="font-size:12px;">${r.workCount}<br>${r.type==='시급' ? '('+r.totalHours+')' : ''}</td>
                    <td style="text-align:right; font-weight:bold;">${r.amount.toLocaleString()}원</td>
                </tr>`;
        });
        const totalEl = document.getElementById('totalSalaryAmount');
        if(totalEl) totalEl.textContent = `총 지출 예상: ${totalAll.toLocaleString()}원`;
        document.getElementById('salaryModal').style.display = 'flex';
    }
}

function closeSalaryModal() { document.getElementById('salaryModal').style.display = 'none'; }

// accounting.js 에서 사용하는 함수 (window에 노출)
window.getEstimatedStaffCost = function(monthStr, targetStaffList = null) {
    const list = targetStaffList || staffList;

    const [y, m] = monthStr.split('-');
    const year = parseInt(y);
    const month = parseInt(m);

    const lastDayObj = new Date(year, month, 0);
    const totalDaysInMonth = lastDayObj.getDate();
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let totalPay = 0;

    list.forEach(s => {
        const sDate = s.startDate ? new Date(s.startDate) : null;
        const eDate = s.endDate ? new Date(s.endDate) : null;

        const isEmployedAt = (targetDate) => {
            const t = new Date(targetDate); t.setHours(0,0,0,0);
            if (sDate) { const start = new Date(sDate); start.setHours(0,0,0,0); if (t < start) return false; }
            if (eDate) { const end = new Date(eDate); end.setHours(0,0,0,0); if (t > end) return false; }
            return true;
        };

        if (s.salaryType === 'monthly') {
            let employedDays = 0;
            for (let d = 1; d <= totalDaysInMonth; d++) {
                if (isEmployedAt(new Date(year, month-1, d))) employedDays++;
            }
            if (employedDays === totalDaysInMonth) totalPay += (s.salary || 0);
            else totalPay += Math.floor((s.salary || 0) / totalDaysInMonth * employedDays);

        } else {
            let hours = 0;
            for (let d = 1; d <= totalDaysInMonth; d++) {
                const dateObj = new Date(year, month-1, d);
                const dateKey = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const dayName = dayMap[dateObj.getDay()];

                if (!isEmployedAt(dateObj)) continue;

                let isWorking = false;
                let timeStr = s.time;

                if (s.exceptions && s.exceptions[dateKey]) {
                    if (s.exceptions[dateKey].type === 'work') { isWorking = true; timeStr = s.exceptions[dateKey].time; }
                } else {
                    if (s.workDays.includes(dayName)) isWorking = true;
                }
                if (isWorking) hours += calculateDuration(timeStr);
            }
            totalPay += Math.floor(hours * (s.salary || 0));
        }
    });
    return totalPay;
}

// ==========================================
// 7. 일일 예외 및 대타
// ==========================================
async function setDailyException(id, dateStr, action) {
    if (!currentUser) { openLoginModal(); return; }
    if (action === 'off') {
        if (!confirm('이 직원을 오늘 명단에서 제외(휴무)하시겠습니까?')) return;
        await callExceptionApi({ id, date: dateStr, type: 'off' });
    } else if (action === 'time') {
        const newTime = prompt('오늘만 적용할 근무 시간을 입력하세요 (예: 18:00~22:00)');
        if (!newTime) return;
        await callExceptionApi({ id, date: dateStr, type: 'work', time: newTime });
    }
}

function initTimeOptions() {
    const hours = [];
    for(let i=0; i<=30; i++) {
        const val = i < 24 ? i : i - 24;
        const txt = i < 24 ? `${i}` : `(익일)${i-24}`;
        const valStr = String(val).padStart(2, '0');
        hours.push(`<option value="${valStr}">${txt}</option>`);
    }
    const html = hours.join('');

    const startEl = document.getElementById('tempStartHour');
    const endEl = document.getElementById('tempEndHour');

    if(startEl) {
        startEl.innerHTML = html;
        startEl.value = "18";
    }
    if(endEl) {
        endEl.innerHTML = html;
        endEl.value = "23";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initTimeOptions();
});

function addTempWorker() {
    if (!currentUser) { openLoginModal(); return; }

    document.getElementById('tempName').value = '';
    document.getElementById('tempSalary').value = '10000';

    const dataList = document.getElementById('staffNameList');
    if (dataList && typeof staffList !== 'undefined') {
        const options = staffList
            .filter(s => s.salaryType !== 'monthly')
            .map(s => `<option value="${s.name}">`)
            .join('');

        dataList.innerHTML = options;
    }

    document.getElementById('tempWorkerModal').style.display = 'flex';
}

function closeTempModal() {
    document.getElementById('tempWorkerModal').style.display = 'none';
}

function autoFillSalary(inputName) {
    if (!inputName) return;

    const todayStr = new Date().toISOString().split('T')[0];

    const target = staffList.find(s => {
        if (s.name !== inputName) return false;
        if (s.endDate && s.endDate < todayStr) return false;
        return true;
    });

    const finalTarget = target || staffList.find(s => s.name === inputName);

    if (finalTarget && finalTarget.salary) {
        document.getElementById('tempSalary').value = finalTarget.salary;
    }
}

async function saveTempWorker() {
    const name = document.getElementById('tempName').value.trim();
    const salary = document.getElementById('tempSalary').value;

    const sh = document.getElementById('tempStartHour').value;
    const sm = document.getElementById('tempStartMin').value;
    const eh = document.getElementById('tempEndHour').value;
    const em = document.getElementById('tempEndMin').value;

    if (!name) { alert('이름을 입력해주세요.'); return; }
    if (!salary) { alert('시급을 입력해주세요.'); return; }

    const timeStr = `${sh}:${sm}~${eh}:${em}`;

    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const existingStaff = staffList.find(s => s.name === name);

    if (existingStaff) {
        const isExisting = confirm(
            `⚠️ "${name}"님과 동일한 이름이 이미 있습니다.\n\n` +
            `✅ [확인] → 기존 인원에 오늘 근무 추가\n` +
            `❌ [취소] → 동명이인으로 별도 등록 (${name}1, ${name}2...)`
        );

        if (isExisting) {
            await callExceptionApi({
                id: existingStaff.id,
                date: dateStr,
                type: 'work',
                time: timeStr
            });
            alert('✅ 기존 직원 근무 일정에 추가되었습니다.');
            closeTempModal();
            return;

        } else {
            const sameNameList = staffList.filter(s =>
                s.name === name || s.name.match(new RegExp(`^${name}\\d+$`))
            );

            let maxNum = 0;
            sameNameList.forEach(s => {
                const match = s.name.match(/(\d+)$/);
                if (match) {
                    maxNum = Math.max(maxNum, parseInt(match[1]));
                } else if (s.name === name) {
                    maxNum = Math.max(maxNum, 0);
                }
            });

            const newName = `${name}${maxNum + 1}`;

            if (!confirm(`동명이인으로 "${newName}"(으)로 등록하시겠습니까?`)) {
                return;
            }

            await createNewTempWorker(newName, dateStr, timeStr, salary);
            return;
        }
    }

    await createNewTempWorker(name, dateStr, timeStr, salary);
}

async function createNewTempWorker(name, dateStr, timeStr, salary) {
    try {
        const res = await fetch('/api/staff/temp', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: name,
                date: dateStr,
                time: timeStr,
                salary: salary,
                actor: currentUser.name,
                store: currentStore
            })
        });
        const json = await res.json();
        if (json.success) {
            alert('✅ 임시 근무자가 등록되었습니다.');
            closeTempModal();
            loadStaffData();
        } else {
            alert('❌ 등록 실패');
        }
    } catch(e) {
        console.error(e);
        alert('❌ 서버 통신 오류');
    }
}

async function callExceptionApi(payload) {
    try {
        await fetch('/api/staff/exception', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ...payload, actor: currentUser.name, store: currentStore })
        });
        loadStaffData();
    } catch(e) { alert('오류 발생'); }
}

// ==========================================
// 8. 로그 및 백업
// ==========================================
async function loadLogs() {
    try {
        const res = await fetch(`/api/logs?store=${currentStore}`);
        const json = await res.json();
        const tbody = document.getElementById('logTableBody');

        if(tbody) {
            tbody.innerHTML = '';
            if (!json.data || json.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">기록이 없습니다.</td></tr>';
                return;
            }

            const staffActions = ['직원등록', '직원수정', '직원삭제', '근무변경', '대타등록'];
            const filteredLogs = json.data.filter(log => staffActions.includes(log.action));

            if (filteredLogs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">직원/근무 관련 기록이 없습니다.</td></tr>';
                return;
            }

            filteredLogs.forEach(log => {
                const date = new Date(log.timestamp).toLocaleString('ko-KR', {
                    month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
                });
                tbody.innerHTML += `
                    <tr>
                        <td>${date}</td>
                        <td>${log.actor}</td>
                        <td class="log-action-${log.action}">${log.action}</td>
                        <td>${log.target}</td>
                        <td>${log.details}</td>
                    </tr>`;
            });
        }
    } catch(e) { console.error("로그 로드 실패", e); }
}

async function downloadAllData() {
    if (!currentUser || currentUser.role !== 'admin') { alert("사장님만 가능한 기능입니다."); return; }

    if (!confirm(`현재 매장(${currentStore})의 모든 데이터를 파일별로 다운로드하시겠습니까?\n(staff, accounting, prepayments, logs 각각 별도 파일)`)) return;

    try {
        const res = await fetch(`/api/backup?store=${currentStore}`);
        const json = await res.json();

        if (json.success) {
            const data = json.data;
            const date = new Date();
            const dateStr = date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0');

            const files = [
                { name: 'staff', data: data.staff, desc: '직원 데이터' },
                { name: 'accounting', data: data.accounting, desc: '회계 데이터' },
                { name: 'prepayments', data: data.prepayments, desc: '선결제 데이터' },
                { name: 'logs', data: data.logs, desc: '변경 이력' }
            ];

            let downloadCount = 0;

            for (const file of files) {
                const dataStr = JSON.stringify(file.data, null, 2);
                const fileName = `${currentStore}_${file.name}_${dateStr}.json`;

                const blob = new Blob([dataStr], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                downloadCount++;

                await new Promise(resolve => setTimeout(resolve, 100));
            }

            alert(`✅ ${downloadCount}개 파일 다운로드 완료!\n\n다운로드된 파일:\n` +
                  files.map(f => `- ${currentStore}_${f.name}_${dateStr}.json`).join('\n') +
                  `\n\nPC의 '다운로드' 폴더를 확인하세요.`);
        } else alert("백업 데이터 생성 실패");
    } catch (e) {
        console.error(e);
        alert("서버 통신 오류: " + e.message);
    }
}
