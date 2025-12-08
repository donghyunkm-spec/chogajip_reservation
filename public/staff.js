// 전역 변수
let currentUser = null;
let staffList = [];
let currentDate = new Date(); // 일별 뷰 기준
let calendarDate = new Date(); // 월별 뷰 기준
let currentWeekStartDate = new Date(); // 주별 뷰 기준 (해당 주 일요일)

// 요일 맵핑 (일~토 순서 중요)
const DAY_MAP = { 'Sun':'일', 'Mon':'월', 'Tue':'화', 'Wed':'수', 'Thu':'목', 'Fri':'금', 'Sat':'토' };
const REVERSE_DAY_MAP = { '일':'Sun', '월':'Mon', '화':'Tue', '수':'Wed', '목':'Thu', '금':'Fri', '토':'Sat' };
// 순서: 일 월 화 수 목 금 토
const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

document.addEventListener('DOMContentLoaded', () => {
    // 주간 기준일 초기화 (오늘이 포함된 주의 일요일로 설정)
    const today = new Date();
    const day = today.getDay(); // 0(일)~6(토)
    currentWeekStartDate.setDate(today.getDate() - day);
    
    loadStaffData();
});

// 1. 로그인 관련
function openLoginModal() {
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
}

function closeLoginModal() {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('loginError').style.display = 'none';
}

async function tryLogin() {
    const pwd = document.getElementById('loginPassword').value;
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();
        
        if (data.success) {
            currentUser = data;
            closeLoginModal();
            document.getElementById('loginBtn').style.display = 'none';
            const userInfoDiv = document.getElementById('userInfo');
            userInfoDiv.style.display = 'block';
            userInfoDiv.innerHTML = `${data.name} (${data.role === 'admin' ? '사장' : data.role === 'manager' ? '점장' : '직원'})`;
            
            if (['admin', 'manager'].includes(data.role)) {
                document.getElementById('manageTabBtn').style.display = 'inline-block';
            }
            if (data.role === 'admin') {
                document.getElementById('bulkSection').style.display = 'block';
                document.getElementById('logTabBtn').style.display = 'inline-block';
                loadLogs();
            }
            renderDailyView(); // 관리자 버튼 갱신을 위해
            renderWeeklyView();
        } else {
            document.getElementById('loginError').style.display = 'block';
        }
    } catch (e) { alert('서버 오류'); }
}

// 2. 탭 전환
function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    const btnMap = { 'daily': 0, 'weekly': 1, 'monthly': 2, 'manage': 3, 'logs': 4 };
    document.querySelectorAll('.tab')[btnMap[tab]].classList.add('active');
    document.getElementById(`${tab}-content`).classList.add('active');

    if(tab === 'daily') renderDailyView();
    if(tab === 'weekly') renderWeeklyView();
    if(tab === 'monthly') renderMonthlyView();
}

// 3. 데이터 로드
async function loadStaffData() {
    try {
        const res = await fetch('/api/staff');
        const json = await res.json();
        staffList = json.data;
        renderDailyView();
        renderWeeklyView();
        renderMonthlyView();
        renderManageList();
    } catch(e) { console.error("데이터 로드 실패"); }
}

// [뷰 1] 일별 현황
function renderDailyView() {
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayKey = dayMap[currentDate.getDay()];
    
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    document.getElementById('currentDateDisplay').textContent = `${month}월 ${day}일 (${DAY_MAP[todayKey]})`;

    const container = document.getElementById('dailyStaffList');
    container.innerHTML = '';

    let dailyWorkers = [];

    staffList.forEach(staff => {
        let isWorking = false;
        let workTime = staff.time;
        let isException = false;

        if (staff.exceptions && staff.exceptions[dateStr]) {
            const ex = staff.exceptions[dateStr];
            if (ex.type === 'work') {
                isWorking = true;
                workTime = ex.time;
                isException = true;
            } else if (ex.type === 'off') {
                isWorking = false;
            }
        } else {
            if (staff.workDays.includes(todayKey)) {
                isWorking = true;
            }
        }

        if (isWorking) {
            dailyWorkers.push({ ...staff, displayTime: workTime, isException });
        }
    });

    document.getElementById('dailyCountBadge').textContent = `총 ${dailyWorkers.length}명 근무`;

    dailyWorkers.sort((a,b) => parseInt(a.displayTime) - parseInt(b.displayTime));

    if (dailyWorkers.length === 0) {
        container.innerHTML = '<div class="empty-state">근무자가 없습니다.</div>';
    } else {
        dailyWorkers.forEach(s => {
            const adminButtons = `
                <div style="margin-top:5px; border-top:1px dashed #eee; padding-top:5px; text-align:right;">
                    <button onclick="setDailyException(${s.id}, '${dateStr}', 'time')" style="font-size:11px; padding:3px 6px; background:#17a2b8; color:white; border:none; border-radius:3px; cursor:pointer; margin-right:5px;">⏰ 시간변경</button>
                    <button onclick="setDailyException(${s.id}, '${dateStr}', 'off')" style="font-size:11px; padding:3px 6px; background:#dc3545; color:white; border:none; border-radius:3px; cursor:pointer;">⛔ 오늘휴무</button>
                </div>
            `;

            const highlightStyle = s.isException ? 'background-color:#fff3cd; border-color:#ffc107;' : '';
            const statusBadge = s.isException ? '<span class="badge alternative-badge">변동</span>' : '';

            container.innerHTML += `
                <div class="reservation-item" style="border-left:5px solid #4CAF50; ${highlightStyle}">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <strong>${s.name}</strong> ${statusBadge}
                            <div style="font-size:14px; color:#0066cc; font-weight:bold; margin-top:2px;">${s.displayTime}</div>
                            <div style="font-size:12px; color:#666;">${s.position || '직원'}</div>
                        </div>
                    </div>
                    ${adminButtons}
                </div>
            `;
        });
    }
}

function changeDate(d) {
    currentDate.setDate(currentDate.getDate() + d);
    renderDailyView();
}

// [뷰 2] 주간 근무표 (대폭 수정됨)
function renderWeeklyView() {
    // 1. 주간 날짜 범위 표시 (일~토)
    const startWeek = new Date(currentWeekStartDate);
    const endWeek = new Date(currentWeekStartDate);
    endWeek.setDate(endWeek.getDate() + 6);
    
    document.getElementById('weeklyRangeDisplay').textContent = 
        `${startWeek.getMonth()+1}월 ${startWeek.getDate()}일 ~ ${endWeek.getMonth()+1}월 ${endWeek.getDate()}일`;

    // 2. 컬럼 초기화
    DAY_KEYS.forEach(k => document.getElementById(`col-${k}`).innerHTML = '');

    // 3. 일요일부터 토요일까지 루프 돌면서 해당 날짜의 실제 근무자 확인
    for (let i = 0; i < 7; i++) {
        const loopDate = new Date(currentWeekStartDate);
        loopDate.setDate(loopDate.getDate() + i);
        
        const year = loopDate.getFullYear();
        const month = String(loopDate.getMonth() + 1).padStart(2, '0');
        const day = String(loopDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const dayKey = DAY_KEYS[i]; // Sun, Mon...

        staffList.forEach(s => {
            let isWorking = false;
            let workTime = s.time;
            let isException = false;

            // 예외 확인
            if (s.exceptions && s.exceptions[dateStr]) {
                const ex = s.exceptions[dateStr];
                if (ex.type === 'work') {
                    isWorking = true;
                    workTime = ex.time;
                    isException = true;
                } else if (ex.type === 'off') {
                    isWorking = false;
                }
            } else {
                // 고정 패턴 확인
                if (s.workDays.includes(dayKey)) {
                    isWorking = true;
                }
            }

            if (isWorking) {
                const col = document.getElementById(`col-${dayKey}`);
                const exceptionClass = isException ? 'exception' : '';
                // 카드에 날짜별 특이사항 표시
                col.innerHTML += `
                    <div class="staff-card-weekly ${exceptionClass}">
                        <strong>${s.name}</strong>
                        <span>${workTime}</span>
                        ${isException ? '<br><span style="color:red; font-size:10px;">(변동)</span>' : ''}
                    </div>`;
            }
        });
    }
}

function changeWeek(weeks) {
    currentWeekStartDate.setDate(currentWeekStartDate.getDate() + (weeks * 7));
    renderWeeklyView();
}

// [뷰 3] 월별 캘린더
function renderMonthlyView() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    document.getElementById('monthDisplay').textContent = `${year}년 ${month + 1}월`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0(일) ~ 6(토)
    const totalDays = lastDay.getDate();

    const container = document.getElementById('calendarBody');
    container.innerHTML = '';

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

        container.innerHTML += `
            <div class="calendar-day ${dayClass}" onclick="goToDailyDetail(${year}, ${month}, ${day})">
                <span class="calendar-date-num">${day}</span>
                ${count > 0 ? `<span class="calendar-staff-count">근무 ${count}명</span>` : ''}
            </div>`;
    }
}

function changeMonth(d) {
    calendarDate.setMonth(calendarDate.getMonth() + d);
    renderMonthlyView();
}

function goToDailyDetail(year, month, day) {
    currentDate = new Date(year, month, day);
    switchTab('daily');
}

// 일일 관리 버튼 액션 (로그인 체크)
async function setDailyException(id, dateStr, action) {
    if (!currentUser) { openLoginModal(); return; }

    if (action === 'off') {
        if (!confirm('이 직원을 오늘 명단에서 제외(휴무)하시겠습니까?')) return;
        await callExceptionApi({ id, date: dateStr, type: 'off' });
    } 
    else if (action === 'time') {
        const newTime = prompt('오늘만 적용할 근무 시간을 입력하세요 (예: 18:00~22:00)');
        if (!newTime) return;
        await callExceptionApi({ id, date: dateStr, type: 'work', time: newTime });
    }
}

async function addTempWorker() {
    if (!currentUser) { openLoginModal(); return; }

    const name = prompt('추가할 근무자(대타) 이름을 입력하세요:');
    if (!name) return;
    const time = prompt('근무 시간 (예: 18:00~23:00):', '18:00~23:00');
    if (!time) return;

    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    try {
        const res = await fetch('/api/staff/temp', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                name, date: dateStr, time, 
                actor: currentUser.name 
            })
        });
        const json = await res.json();
        if (json.success) {
            alert('일일 근무자가 추가되었습니다.');
            loadStaffData();
        } else {
            alert('추가 실패');
        }
    } catch(e) { alert('오류 발생'); }
}

async function callExceptionApi(payload) {
    try {
        const res = await fetch('/api/staff/exception', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ...payload, actor: currentUser.name })
        });
        const json = await res.json();
        if (json.success) {
            loadStaffData();
        } else {
            alert('처리 실패');
        }
    } catch(e) { alert('오류 발생'); }
}

async function processBulkText() {
    const text = document.getElementById('bulkText').value;
    if (!text.trim()) return;

    const lines = text.split('\n');
    const payload = [];
    let errorLines = [];

    lines.forEach((line, index) => {
        line = line.trim();
        if (!line) return;

        let parts = line.split(',').map(p => p.trim());
        if (parts.length < 3) parts = line.split(/\s+/); 

        if (parts.length >= 3) {
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

            if (name && workDays.length > 0) {
                payload.push({ name, time: timeStr, workDays, position: '직원' });
            } else {
                errorLines.push(`${index + 1}줄 요일확인: ${line}`);
            }
        } else {
            errorLines.push(`${index + 1}줄 형식오류: ${line}`);
        }
    });

    if (payload.length > 0) {
        if(confirm(`${payload.length}명 등록하시겠습니까?`)) {
            try {
                const res = await fetch('/api/staff', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ staffList: payload, actor: currentUser.name })
                });
                const json = await res.json();
                if (json.success) {
                    alert('등록 완료!');
                    loadStaffData();
                    document.getElementById('bulkText').value = '';
                } else alert('실패: ' + json.error);
            } catch (e) { alert('오류'); }
        }
    } else alert('등록할 데이터 없음');
}

function renderManageList() {
    const list = document.getElementById('manageStaffList');
    list.innerHTML = '';
    
    staffList.forEach(s => {
        const daysStr = s.workDays.map(d => DAY_MAP[d]).join(',');
        list.innerHTML += `
            <div class="reservation-item">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="font-size:16px;">${s.name}</strong> 
                        <span style="font-size:12px; color:#666;">(${s.time})</span>
                        <div style="font-size:13px; margin-top:5px;">📅 ${daysStr}</div>
                    </div>
                    <div>
                        <button class="edit-btn" onclick="editStaff(${s.id})">수정</button>
                        <button class="delete-btn" onclick="deleteStaff(${s.id})">삭제</button>
                    </div>
                </div>
            </div>`;
    });
}

async function editStaff(id) {
    if (!currentUser) { openLoginModal(); return; }
    
    const target = staffList.find(s => s.id === id);
    const newTime = prompt('근무 시간을 수정하세요:', target.time);
    if (newTime === null) return;
    
    await fetch(`/api/staff/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ updates: { time: newTime }, actor: currentUser.name })
    });
    loadStaffData();
    if(currentUser.role === 'admin') loadLogs();
}

async function deleteStaff(id) {
    if (!currentUser) { openLoginModal(); return; }

    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/staff/${id}?actor=${encodeURIComponent(currentUser.name)}`, { method: 'DELETE' });
    loadStaffData();
    if(currentUser.role === 'admin') loadLogs();
}

async function loadLogs() {
    const res = await fetch('/api/logs');
    const json = await res.json();
    const tbody = document.getElementById('logTableBody');
    tbody.innerHTML = '';
    
    json.data.forEach(log => {
        const date = new Date(log.timestamp).toLocaleString('ko-KR', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
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