// staff.js - 직원 관리 + 가계부(매출/지출/통계) 통합 버전

// ==========================================
// 1. 전역 변수 및 초기화
// ==========================================
let currentUser = null;
let staffList = [];
let currentDate = new Date();
let calendarDate = new Date();
let currentWeekStartDate = new Date();

// 가계부용 전역 변수
let accountingData = { daily: {}, monthly: {} };
let currentAccDate = new Date().toISOString().split('T')[0]; // 오늘 날짜 기본

// 현재 매장 정보 파싱
const urlParams = new URLSearchParams(window.location.search);
const currentStore = urlParams.get('store') || 'chogazip';
const storeNameKr = currentStore === 'yangeun' ? '양은이네' : '초가짚';

// 요일 맵핑
const DAY_MAP = { 'Sun':'일', 'Mon':'월', 'Tue':'화', 'Wed':'수', 'Thu':'목', 'Fri':'금', 'Sat':'토' };
const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

document.addEventListener('DOMContentLoaded', () => {
    document.title = `${storeNameKr} 관리자 모드`;
    document.getElementById('pageTitle').textContent = `👥 ${storeNameKr} 관리 시스템`;
    
    if (currentStore === 'yangeun') {
        document.querySelector('.weekly-header').style.background = '#ff9800'; 
    }

    // 주간 기준일 초기화 (일요일 시작)
    const today = new Date();
    const day = today.getDay();
    currentWeekStartDate.setDate(today.getDate() - day);
    
    // 초기 데이터 로드
    loadStaffData();
});

// ==========================================
// 2. 탭 전환 및 화면 제어
// ==========================================

function switchTab(tabName) {
    // 1. 모든 탭 버튼과 컨텐츠 비활성화
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    // 2. 클릭된 탭 활성화 (onclick 속성 매칭)
    const targetBtn = document.querySelector(`button[onclick="switchTab('${tabName}')"]`);
    if(targetBtn) targetBtn.classList.add('active');
    
    // 3. 컨텐츠 표시
    const content = document.getElementById(`${tabName}-content`);
    if(content) content.classList.add('active');

    // 4. 탭별 데이터 로드
    if(tabName === 'daily') renderDailyView();
    if(tabName === 'weekly') renderWeeklyView();
    if(tabName === 'monthly') renderMonthlyView();
    if(tabName === 'accounting') loadAccountingData(); // [NEW] 가계부 로드
}

// [NEW] 가계부 내부 서브 탭 전환 (일일 / 월간 / 내역)
function switchAccSubTab(subTabId) {
    // 서브 컨텐츠 숨기기
    document.querySelectorAll('.acc-sub-content').forEach(el => el.style.display = 'none');
    
    // 서브 탭 버튼 스타일 초기화 (메인 탭과 구분하기 위해 부모 요소 기준 탐색)
    const subTabContainer = document.querySelector('.tabs[style*="grid-template-columns"]'); 
    if(subTabContainer) {
        subTabContainer.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
    }

    // 클릭된 버튼 활성화
    const clickedBtn = event.currentTarget;
    if(clickedBtn) clickedBtn.classList.add('active');

    // 선택된 화면 표시
    document.getElementById(subTabId).style.display = 'block';

    // 내역 탭일 경우 데이터 갱신
    if (subTabId === 'acc-history') loadHistoryTable();
}


// ==========================================
// 3. 로그인 및 권한 관리
// ==========================================

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
            
            // 권한별 탭 노출
            if (['admin', 'manager'].includes(data.role)) {
                document.getElementById('manageTabBtn').style.display = 'inline-block';
            }
            if (data.role === 'admin') {
                document.getElementById('bulkSection').style.display = 'block';
                document.getElementById('logTabBtn').style.display = 'inline-block';
                document.getElementById('salarySection').style.display = 'block';
                loadLogs();
            }
            
            // 현재 화면 갱신
            const activeTab = document.querySelector('.tab-content.active');
            if(activeTab && activeTab.id === 'accounting-content') loadAccountingData();
            
            renderManageList(); 
        } else {
            document.getElementById('loginError').style.display = 'block';
            document.getElementById('loginError').textContent = '비밀번호가 일치하지 않습니다.';
        }
    } catch (e) { alert('서버 오류'); }
}


// ==========================================
// 4. 가계부 (매출/지출/통계) 로직 [핵심 수정됨]
// ==========================================

async function loadAccountingData() {
    if (!currentUser) { 
        alert("로그인이 필요합니다.");
        openLoginModal(); 
        switchTab('daily'); // 로그인 안했으면 일단 일별 탭으로 복귀
        return; 
    }
    
    // 권한 체크: 사장님(admin)만 통계(profitSection) 및 샘플생성 버튼 보임
    const isAdmin = (currentUser.role === 'admin');
    const profitSection = document.getElementById('profitSection');
    if(profitSection) profitSection.style.display = isAdmin ? 'block' : 'none';
    
    const sampleBtn = document.getElementById('sampleBtn');
    if(sampleBtn) sampleBtn.style.display = isAdmin ? 'block' : 'none';

    try {
        const res = await fetch(`/api/accounting?store=${currentStore}`);
        const json = await res.json();
        accountingData = json.data || { daily: {}, monthly: {} };
        
        // 날짜 인풋 초기화
        document.getElementById('accDate').value = currentAccDate;
        
        // 각 화면 데이터 렌더링
        loadDailyAccounting(); // 일일 탭
        loadMonthlyForm();     // 월간 탭
        renderAccountingDashboard(isAdmin); // 통계 화면
    } catch(e) { console.error('회계 로드 실패', e); }
}

// [4-1] 일일 데이터 로드
function loadDailyAccounting() {
    currentAccDate = document.getElementById('accDate').value;
    const dayData = accountingData.daily[currentAccDate] || {};
    
    document.getElementById('inpCard').value = dayData.card || '';
    document.getElementById('inpCash').value = dayData.cash || '';
    document.getElementById('inpNote').value = dayData.note || '';
    
    document.getElementById('inpFood').value = dayData.food || '';
    document.getElementById('inpMeat').value = dayData.meat || '';
    document.getElementById('inpEtc').value = dayData.etc || '';
}

// [4-2] 일일 데이터 저장
async function saveDailyAccounting() {
    const data = {
        card: parseInt(document.getElementById('inpCard').value) || 0,
        cash: parseInt(document.getElementById('inpCash').value) || 0,
        note: document.getElementById('inpNote').value || '',
        
        food: parseInt(document.getElementById('inpFood').value) || 0,
        meat: parseInt(document.getElementById('inpMeat').value) || 0,
        etc: parseInt(document.getElementById('inpEtc').value) || 0,
        
        // 검색/집계 편의를 위해 합계 필드 추가
        sales: (parseInt(document.getElementById('inpCard').value) || 0) + (parseInt(document.getElementById('inpCash').value) || 0)
    };

    try {
        await fetch('/api/accounting/daily', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ date: currentAccDate, data, store: currentStore })
        });
        
        // 로컬 데이터 갱신
        if(!accountingData.daily) accountingData.daily = {};
        accountingData.daily[currentAccDate] = data;
        
        alert('일일 데이터가 저장되었습니다.');
        renderAccountingDashboard(currentUser.role === 'admin');
    } catch(e) { alert('저장 실패'); }
}

// [4-3] 월간 데이터 로드
function loadMonthlyForm() {
    const currentMonth = currentAccDate.substring(0, 7);
    const mData = accountingData.monthly[currentMonth] || {};
    
    document.getElementById('fixLiquor').value = mData.liquor || '';
    document.getElementById('fixBeverage').value = mData.beverage || '';
    document.getElementById('fixRent').value = mData.rent || '';
    document.getElementById('fixUtility').value = mData.utility || '';
    document.getElementById('fixGas').value = mData.gas || '';
    document.getElementById('fixEtc').value = mData.etc_fixed || '';
}

// [4-4] 월간 데이터 저장
async function saveFixedCost() {
    const currentMonth = currentAccDate.substring(0, 7);
    const data = {
        liquor: parseInt(document.getElementById('fixLiquor').value) || 0,
        beverage: parseInt(document.getElementById('fixBeverage').value) || 0,
        rent: parseInt(document.getElementById('fixRent').value) || 0,
        utility: parseInt(document.getElementById('fixUtility').value) || 0,
        gas: parseInt(document.getElementById('fixGas').value) || 0,
        etc_fixed: parseInt(document.getElementById('fixEtc').value) || 0
    };

    try {
        await fetch('/api/accounting/fixed', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ month: currentMonth, data, store: currentStore })
        });
        
        if(!accountingData.monthly) accountingData.monthly = {};
        accountingData.monthly[currentMonth] = data;
        
        alert('월간 누적 데이터가 저장되었습니다.');
        renderAccountingDashboard(currentUser.role === 'admin');
    } catch(e) { alert('저장 실패'); }
}

// [4-5] 통계 대시보드 (사장님 전용)
function renderAccountingDashboard(isAdmin) {
    if (!isAdmin) return; // 사장님 아니면 계산 로직 실행 안 함

    const currentMonth = currentAccDate.substring(0, 7);
    document.getElementById('accMonthTitle').textContent = `${currentMonth.split('-')[1]}월 손익 현황`;

    // A. 월간 고정비 합계
    const mData = accountingData.monthly[currentMonth] || {};
    const monthlyTotal = 
        (mData.liquor||0) + (mData.beverage||0) + (mData.rent||0) + 
        (mData.utility||0) + (mData.gas||0) + (mData.etc_fixed||0);

    // B. 일일 매출/지출 합계
    let totalSales = 0;
    let totalDailyCost = 0;
    
    Object.keys(accountingData.daily).forEach(date => {
        if (date.startsWith(currentMonth)) {
            const d = accountingData.daily[date];
            const sales = (d.card||0) + (d.cash||0);
            const cost = (d.food||0) + (d.meat||0) + (d.etc||0);
            totalSales += sales;
            totalDailyCost += cost;
        }
    });

    // C. 인건비 (예상) - getEstimatedStaffCost 함수 활용
    let totalStaffCost = getEstimatedStaffCost(currentMonth);

    // D. 최종 계산
    const totalCost = monthlyTotal + totalDailyCost + totalStaffCost;
    const netProfit = totalSales - totalCost;

    // UI 업데이트
    document.getElementById('totalSalesDisplay').textContent = totalSales.toLocaleString() + '원';
    document.getElementById('totalCostDisplay').textContent = totalCost.toLocaleString() + '원';
    document.getElementById('staffCostDisplay').textContent = totalStaffCost.toLocaleString();
    
    const profitEl = document.getElementById('netProfitDisplay');
    profitEl.textContent = netProfit.toLocaleString() + '원';
    profitEl.style.color = netProfit >= 0 ? '#fff' : '#ffcdd2';
}

// [4-6] 내역 조회 및 수정 (표)
function loadHistoryTable() {
    const currentMonth = currentAccDate.substring(0, 7);
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    const sortedDates = Object.keys(accountingData.daily)
        .filter(d => d.startsWith(currentMonth))
        .sort().reverse();

    if (sortedDates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">데이터가 없습니다.</td></tr>';
        return;
    }

    sortedDates.forEach(date => {
        const d = accountingData.daily[date];
        const sales = (d.card||0) + (d.cash||0);
        const cost = (d.food||0) + (d.meat||0) + (d.etc||0);
        
        tbody.innerHTML += `
            <tr>
                <td>${date.substring(5)}</td>
                <td style="color:#1976D2; font-weight:bold;">${sales.toLocaleString()}</td>
                <td style="color:#d32f2f;">${cost.toLocaleString()}</td>
                <td style="font-size:11px; color:#666;">${d.note || '-'}</td>
                <td>
                    <button onclick="editHistoryDate('${date}')" style="font-size:11px; background:#607d8b; color:white; border:none; border-radius:3px; padding:3px 6px; cursor:pointer;">수정</button>
                </td>
            </tr>
        `;
    });
}

function editHistoryDate(date) {
    document.getElementById('accDate').value = date;
    loadDailyAccounting(); // 해당 날짜 데이터 로드
    switchAccSubTab('acc-daily'); // 입력 탭으로 강제 이동
}

// [4-7] 샘플 데이터 생성 (테스트용)
async function generateSampleData() {
    if (!confirm('현재 보고 있는 달의 샘플 데이터를 생성하시겠습니까?\n(기존 데이터에 덮어씌워집니다)')) return;

    const currentMonth = currentAccDate.substring(0, 7); // ex: "2024-12"
    const [y, m] = currentMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate(); // 이번달 마지막 날

    // 1. 일일 데이터 생성 (오늘 날짜까지만)
    const todayDate = new Date().getDate();
    
    for (let i = 1; i <= lastDay; i++) {
        if (i > todayDate) break; // 미래 데이터는 생성 안 함

        const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        
        // 랜덤 매출 (50만 ~ 150만)
        const card = Math.floor(Math.random() * 100) * 10000 + 500000;
        const cash = Math.floor(Math.random() * 10) * 10000;
        
        // 랜덤 지출
        const food = Math.floor(Math.random() * 20) * 5000; 
        const meat = i % 3 === 0 ? 300000 : 0; // 3일에 한번 고기
        const etc = Math.floor(Math.random() * 5) * 1000;

        const data = {
            card, cash, sales: card+cash,
            food, meat, etc,
            note: i % 7 === 0 ? '단체 예약' : ''
        };

        // 비동기 요청 (순차 처리)
        await fetch('/api/accounting/daily', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ date: dateStr, data, store: currentStore })
        });
    }

    // 2. 월간 고정비 생성
    const monthlyData = {
        liquor: 1500000,
        beverage: 300000,
        rent: 2000000,
        utility: 150000,
        gas: 100000,
        etc_fixed: 50000
    };

    await fetch('/api/accounting/fixed', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ month: currentMonth, data: monthlyData, store: currentStore })
    });

    alert('샘플 데이터가 생성되었습니다!');
    loadAccountingData(); // 새로고침
}


// ==========================================
// 5. 직원 관리 (조회/등록/수정/삭제)
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
    list.innerHTML = '';
    
    const isAdmin = currentUser && currentUser.role === 'admin';

    staffList.forEach(s => {
        const daysStr = s.workDays.map(d => DAY_MAP[d]).join(',');
        const salaryInfo = isAdmin ? 
            `<div style="font-size:12px; color:#28a745; margin-top:3px;">
                💰 ${s.salaryType === 'monthly' ? '월급' : '시급'}: ${s.salary ? s.salary.toLocaleString() : '0'}원
             </div>` : '';

        list.innerHTML += `
            <div class="reservation-item">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="font-size:16px;">${s.name}</strong> 
                        <span style="font-size:12px; color:#666;">(${s.time})</span>
                        <div style="font-size:13px; margin-top:5px;">📅 ${daysStr}</div>
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
    
    // 급여 필드 설정
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
    const salaryType = document.getElementById('editSalaryType').value;
    const salary = parseInt(document.getElementById('editSalary').value) || 0;

    const updates = { time };
    if (currentUser && currentUser.role === 'admin') {
        updates.salaryType = salaryType;
        updates.salary = salary;
    }

    try {
        await fetch(`/api/staff/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                updates: updates, 
                actor: currentUser.name,
                store: currentStore 
            })
        });
        closeEditModal();
        loadStaffData();
        if(currentUser.role === 'admin') loadLogs();
    } catch(e) { alert('수정 실패'); }
}

async function deleteStaff(id) {
    if (!currentUser) { openLoginModal(); return; }
    if (!confirm('삭제하시겠습니까?')) return;
    
    await fetch(`/api/staff/${id}?actor=${encodeURIComponent(currentUser.name)}&store=${currentStore}`, { method: 'DELETE' });
    loadStaffData();
    if(currentUser.role === 'admin') loadLogs();
}

// 일괄 등록
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
                    body: JSON.stringify({ 
                        staffList: payload, 
                        actor: currentUser.name,
                        store: currentStore 
                    })
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
// 6. 근무표 뷰 렌더링 (일별/주간/월별)
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

// [뷰 1] 일별
function renderDailyView() {
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayKey = dayMap[currentDate.getDay()];
    
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    document.getElementById('currentDateDisplay').textContent = `${month}월 ${day}일 (${DAY_MAP[todayKey]})`;
    const container = document.getElementById('dailyStaffList');
    if(!container) return;
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
            }
        } else {
            if (staff.workDays.includes(todayKey)) {
                isWorking = true;
                // 예외적으로 쉬는 날인지 체크
                if(staff.exceptions && staff.exceptions[dateStr] && staff.exceptions[dateStr].type === 'off') {
                    isWorking = false;
                }
            }
        }
        if (isWorking) dailyWorkers.push({ ...staff, displayTime: workTime, isException });
    });

    document.getElementById('dailyCountBadge').textContent = `총 ${dailyWorkers.length}명 근무`;
    dailyWorkers.sort((a,b) => getStartTimeValue(a.displayTime) - getStartTimeValue(b.displayTime));

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
function resetToToday() {
    currentDate = new Date();
    renderDailyView();
}

// [뷰 2] 주간
function renderWeeklyView() {
    const startWeek = new Date(currentWeekStartDate);
    const endWeek = new Date(currentWeekStartDate);
    endWeek.setDate(endWeek.getDate() + 6);
    
    document.getElementById('weeklyRangeDisplay').textContent = 
        `${startWeek.getMonth()+1}월 ${startWeek.getDate()}일 ~ ${endWeek.getMonth()+1}월 ${endWeek.getDate()}일`;

    const realToday = new Date(); 
    DAY_KEYS.forEach(k => {
        const col = document.getElementById(`col-${k}`);
        if(col) {
            col.innerHTML = '';
            col.classList.remove('today-highlight');
        }
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
            let isWorking = false;
            let workTime = s.time;
            let isException = false;

            if (s.exceptions && s.exceptions[dateStr]) {
                const ex = s.exceptions[dateStr];
                if (ex.type === 'work') {
                    isWorking = true;
                    workTime = ex.time;
                    isException = true;
                } else if (ex.type === 'off') isWorking = false;
            } else {
                if (s.workDays.includes(dayKey)) isWorking = true;
            }

            if (isWorking) {
                dayWorkers.push({ staff: s, time: workTime, isException });
            }
        });

        dayWorkers.sort((a,b) => getStartTimeValue(a.time) - getStartTimeValue(b.time));

        const col = document.getElementById(`col-${dayKey}`);
        if(col) {
            dayWorkers.forEach(w => {
                const exceptionClass = w.isException ? 'exception' : '';
                col.innerHTML += `
                    <div class="staff-card-weekly ${exceptionClass}">
                        <strong>${w.staff.name}</strong>
                        <span>${w.time}</span>
                    </div>`;
            });
        }
    }
}
function changeWeek(weeks) {
    currentWeekStartDate.setDate(currentWeekStartDate.getDate() + (weeks * 7));
    renderWeeklyView();
}
function resetToThisWeek() {
    const today = new Date();
    const day = today.getDay();
    currentWeekStartDate = new Date(today);
    currentWeekStartDate.setDate(today.getDate() - day);
    renderWeeklyView();
}

// [뷰 3] 월별
function renderMonthlyView() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    document.getElementById('monthDisplay').textContent = `${year}년 ${month + 1}월`;

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
function resetToThisMonth() {
    calendarDate = new Date();
    renderMonthlyView();
}
function goToDailyDetail(year, month, day) {
    currentDate = new Date(year, month, day);
    switchTab('daily');
}

// ==========================================
// 7. 기타 기능 (급여/로그/예외처리)
// ==========================================

function calculateMonthlySalary() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // 계산 로직은 getEstimatedStaffCost와 동일하나 상세 리포트 생성용
    const lastDay = new Date(year, month + 1, 0).getDate();
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let salaryReport = [];

    staffList.forEach(s => {
        if (s.salaryType === 'monthly') {
            salaryReport.push({ name: s.name, type: '월급', workCount: '-', totalHours: '-', amount: s.salary || 0 });
            return;
        }
        let totalHours = 0;
        let workCount = 0;
        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dayKey = dayMap[new Date(year, month, d).getDay()];
            let isWorking = false;
            let timeStr = s.time;

            if (s.exceptions && s.exceptions[dateStr]) {
                const ex = s.exceptions[dateStr];
                if (ex.type === 'work') { isWorking = true; timeStr = ex.time; }
            } else {
                if (s.workDays.includes(dayKey)) isWorking = true;
            }
            if (isWorking) { workCount++; totalHours += calculateDuration(timeStr); }
        }
        salaryReport.push({
            name: s.name, type: '시급',
            workCount: workCount + '일', totalHours: totalHours.toFixed(1) + '시간',
            amount: Math.floor(totalHours * (s.salary || 0))
        });
    });

    const tbody = document.getElementById('salaryTableBody');
    tbody.innerHTML = '';
    let totalAll = 0;
    salaryReport.forEach(r => {
        totalAll += r.amount;
        tbody.innerHTML += `
            <tr>
                <td>${r.name}</td>
                <td><span class="badge ${r.type === '월급' ? 'alternative-badge' : ''}" style="background:${r.type === '월급'?'#28a745':'#17a2b8'}; color:white;">${r.type}</span></td>
                <td>${r.workCount} / ${r.totalHours}</td>
                <td style="text-align:right; font-weight:bold;">${r.amount.toLocaleString()}원</td>
            </tr>
        `;
    });
    document.getElementById('totalSalaryAmount').textContent = `총 지출 예상: ${totalAll.toLocaleString()}원`;
    document.getElementById('salaryModal').style.display = 'flex';
}
function closeSalaryModal() {
    document.getElementById('salaryModal').style.display = 'none';
}

// 순수 인건비 계산 (가계부용)
function getEstimatedStaffCost(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    let totalPay = 0;

    staffList.forEach(s => {
        if (s.salaryType === 'monthly') {
            totalPay += (s.salary || 0);
        } else {
            let hours = 0;
            for (let d = 1; d <= lastDay; d++) {
                const dateKey = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const dayName = dayMap[new Date(y, m-1, d).getDay()];
                
                let isWorking = false;
                let timeStr = s.time;

                if (s.exceptions && s.exceptions[dateKey]) {
                    if (s.exceptions[dateKey].type === 'work') {
                        isWorking = true;
                        timeStr = s.exceptions[dateKey].time;
                    }
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

// 예외 처리 및 대타
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
            body: JSON.stringify({ name, date: dateStr, time, actor: currentUser.name, store: currentStore })
        });
        const json = await res.json();
        if (json.success) { alert('등록되었습니다.'); loadStaffData(); }
    } catch(e) { alert('오류'); }
}
async function callExceptionApi(payload) {
    try {
        await fetch('/api/staff/exception', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ...payload, actor: currentUser.name, store: currentStore })
        });
        loadStaffData();
    } catch(e) { alert('오류'); }
}

async function loadLogs() {
    const res = await fetch(`/api/logs?store=${currentStore}`);
    const json = await res.json();
    const tbody = document.getElementById('logTableBody');
    if(tbody) {
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
}