// staff.js - 통합 버전 (직원관리 + 가계부 고도화)

// ==========================================
// 1. 전역 변수 및 초기화
// ==========================================
let currentUser = null;
let staffList = [];
let currentDate = new Date();
let calendarDate = new Date();
let currentWeekStartDate = new Date();

let currentManageDate = new Date(); // 직원 관리 탭용 날짜

// 가계부용 전역 변수
let accountingData = { daily: {}, monthly: {} };
let currentAccDate = new Date().toISOString().split('T')[0];
let currentDashboardDate = new Date(); // 가계부 조회 기준 월
let currentUnifiedDate = new Date(); // 통합분석 조회 기준 월
let prepayData = { customers: {}, logs: [] }; 

// 현재 매장 정보 파싱
const urlParams = new URLSearchParams(window.location.search);
const currentStore = urlParams.get('store') || 'chogazip';
const storeNameKr = currentStore === 'yangeun' ? '양은이네' : '초가짚';

// 요일 맵핑
const DAY_MAP = { 'Sun':'일', 'Mon':'월', 'Tue':'화', 'Wed':'수', 'Thu':'목', 'Fri':'금', 'Sat':'토' };
const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

document.addEventListener('DOMContentLoaded', () => {
    document.title = `${storeNameKr} 관리자 모드`;
    
    // 2. 매장별 테마 적용
    if (currentStore === 'yangeun') {
        document.body.classList.add('theme-yangeun');
        document.body.classList.remove('theme-chogazip');
    } else {
        document.body.classList.add('theme-chogazip');
        document.body.classList.remove('theme-yangeun');
    }

    // 3. 헤더 텍스트 변경
    const titleEl = document.getElementById('pageTitle');
    if(titleEl) {
        if (currentStore === 'yangeun') {
            titleEl.innerHTML = `🥘 양은이네 <span style="font-size:0.7em; opacity:0.8;">관리시스템</span>`;
        } else {
            titleEl.innerHTML = `🏠 초가짚 <span style="font-size:0.7em; opacity:0.8;">관리시스템</span>`;
        }
    }

    // 매장에 따른 가계부 UI 변경 실행
    initStoreSettings();

    // 주간 기준일 초기화
    const today = new Date();
    const day = today.getDay();
    currentWeekStartDate.setDate(today.getDate() - day);
    
    // 초기 데이터 로드
    loadStaffData();

    // 1. 매장 전환 버튼 텍스트 설정
    initSwitchStoreButton();

    // ============================================================
    // [수정됨] 로그인 유지 확인 (localStorage + 3시간 타임아웃 적용)
    // ============================================================
    const savedUserStr = localStorage.getItem('staffUser'); // sessionStorage -> localStorage로 변경
    
    if (savedUserStr) {
        try {
            const savedUser = JSON.parse(savedUserStr);
            const now = new Date().getTime();
            const threeHours = 3 * 60 * 60 * 1000; // 3시간 (밀리초 단위)

            // 저장된 로그인 시간(loginTime)이 있고, 3시간이 지나지 않았는지 체크
            if (savedUser.loginTime && (now - savedUser.loginTime < threeHours)) {
                // 유효하면 로그인 유지
                currentUser = savedUser;
                onLoginSuccess(currentUser); 
            } else {
                // 3시간 지났으면 정보 삭제 (로그아웃)
                console.log('⌛ 로그인 세션이 만료되었습니다. (3시간 경과)');
                localStorage.removeItem('staffUser');
                currentUser = null;
            }
        } catch (e) {
            // 데이터가 깨졌을 경우 초기화
            console.error('로그인 정보 파싱 오류', e);
            localStorage.removeItem('staffUser');
        }
    }
});

// [추가] 직원 관리 탭 월 이동 함수
function changeManageMonth(delta) {
    currentManageDate.setMonth(currentManageDate.getMonth() + delta);
    renderManageList();
}

function resetManageMonth() {
    currentManageDate = new Date();
    renderManageList();
}



// 매장별 UI 세팅
function initStoreSettings() {
    // 1. 양은이네 설정
    if (currentStore === 'yangeun') {
        const meatLabel = document.getElementById('labelMeat');
        if (meatLabel) meatLabel.textContent = '🍞 SPC 유통';
        
        const etcLabel = document.getElementById('labelEtc');
        if (etcLabel) {
            etcLabel.textContent = '🦪 막걸리/굴';
            etcLabel.style.color = '#795548';
            etcLabel.style.fontWeight = 'bold';
        }

        const dispDiv = document.getElementById('divDisposable');
        if(dispDiv) dispDiv.style.display = 'block';
        const delivDiv = document.getElementById('divDeliveryFee'); 
        if(delivDiv) delivDiv.style.display = 'block';          
        
        const salesGrid = document.getElementById('salesInputGrid');
        if (salesGrid) {
            salesGrid.innerHTML = `
                <div><span class="category-label">💳 카드 매출</span><input type="number" id="inpCard" class="money-input" placeholder="0"></div>
                <div><span class="category-label">🛵 배달의민족</span><input type="number" id="inpBaemin" class="money-input" placeholder="0"></div>
                <div><span class="category-label">🛵 요기요</span><input type="number" id="inpYogiyo" class="money-input" placeholder="0"></div>
                <div><span class="category-label">🛵 쿠팡이츠</span><input type="number" id="inpCoupang" class="money-input" placeholder="0"></div>
                `;
            salesGrid.style.gridTemplateColumns = "1fr 1fr"; 
        }
    } else {
        // 2. 초가짚 설정
        const dispDiv = document.getElementById('divDisposable');
        if(dispDiv) dispDiv.style.display = 'none';
        const delivDiv = document.getElementById('divDeliveryFee');
        if(delivDiv) delivDiv.style.display = 'none';
    }
}

// 1. 매장 전환 버튼 초기화
function initSwitchStoreButton() {
    const btn = document.getElementById('switchStoreBtn');
    if (!btn) return;

    if (currentStore === 'yangeun') {
        btn.innerHTML = '🏠 초가짚 관리';
        btn.style.color = '#333'; // 초가짚 느낌
    } else {
        btn.innerHTML = '🥘 양은이네 관리';
        btn.style.color = '#d32f2f'; // 양은이네 느낌 (붉은색)
    }
}

// 2. 매장 이동 함수 (클릭 시 실행)
function moveToOtherStore() {
    const targetStore = currentStore === 'yangeun' ? 'chogazip' : 'yangeun';
    
    // 페이지 이동 (세션 스토리지에 로그인 정보가 있으므로 이동 후 자동 로그인됨)
    location.href = `staff.html?store=${targetStore}`;
}

// ==========================================
// 2. 탭 전환 및 화면 제어
// ==========================================

// [수정] 메인 탭 전환
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    // 버튼 활성화 (상단 메인 탭)
    const targetBtn = document.querySelector(`.tabs > button[onclick="switchTab('${tabName}')"]`);
    if(targetBtn) targetBtn.classList.add('active');
    
    // 컨텐츠 활성화
    const contentId = (tabName === 'attendance') ? 'attendance-content' : `${tabName}-content`;
    const content = document.getElementById(contentId);
    if(content) content.classList.add('active');

    if(tabName === 'attendance') {
        // 근무관리 탭에 진입하면, 현재 활성화된 서브탭의 로직 실행
        const activeSub = document.querySelector('.att-sub-content.active');
        if(!activeSub || activeSub.id === 'att-daily') renderDailyView();
        else if(activeSub.id === 'att-weekly') renderWeeklyView();
        else if(activeSub.id === 'att-monthly') renderMonthlyView();
        else if(activeSub.id === 'att-manage') {
            // 직원관리 탭은 DOM 준비 후 렌더링
            setTimeout(() => renderManageList(), 50);
        }
        else if(activeSub.id === 'att-logs') loadLogs();
    }
    
    if(tabName === 'accounting') {
        loadAccountingData();
        const activeAccSub = document.querySelector('.acc-sub-content.active');
        if (activeAccSub && activeAccSub.id === 'acc-prepayment') loadPrepaymentData();
    }
    if(tabName === 'unified') loadUnifiedData();
}

/// [수정] 근무관리 내부 서브탭 전환
function switchAttSubTab(subId, btn) {
    // 1. 모든 서브 콘텐츠 숨김
    document.querySelectorAll('.att-sub-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });

    // 2. 버튼 활성화
    const parentTabs = btn.parentElement;
    parentTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    // 3. 선택한 콘텐츠 표시
    const targetDiv = document.getElementById(subId);
    if(targetDiv) {
        targetDiv.style.display = 'block';
        targetDiv.classList.add('active');
    }

    // 4. 데이터 렌더링
    if(subId === 'att-daily') renderDailyView();
    else if(subId === 'att-weekly') renderWeeklyView();
    else if(subId === 'att-monthly') renderMonthlyView();
    else if(subId === 'att-manage') {
        // 직원관리 탭은 DOM이 준비된 후 렌더링
        setTimeout(() => renderManageList(), 50);
    }
    else if(subId === 'att-logs') loadLogs();
}

// 2. 통합 데이터 로드 함수
let uniDataChoga = null;
let uniDataYang = null;

// 1. (UPDATE) loadUnifiedData: 직원 데이터도 함께 로드하도록 변경
async function loadUnifiedData() {
    if (!currentUser || currentUser.role !== 'admin') { 
        alert("사장님 전용 메뉴입니다."); 
        return; 
    }

    try {
        // 회계 데이터와 직원 데이터를 모두 병렬로 가져옵니다.
        const [accChoga, accYang, staffChogaRes, staffYangRes] = await Promise.all([
            fetch('/api/accounting?store=chogazip').then(r => r.json()),
            fetch('/api/accounting?store=yangeun').then(r => r.json()),
            fetch('/api/staff?store=chogazip').then(r => r.json()),
            fetch('/api/staff?store=yangeun').then(r => r.json())
        ]);
        
        // 전역 변수나 통합 뷰용 변수에 저장
        uniDataChoga = accChoga.data || { monthly: {}, daily: {} };
        uniDataYang = accYang.data || { monthly: {}, daily: {} };
        
        // 직원 데이터도 저장 (계산을 위해)
        uniStaffChoga = staffChogaRes.data || [];
        uniStaffYang = staffYangRes.data || [];
        
        // 화면 갱신
        updateUnifiedView();
    } catch(e) {
        console.error("통합 데이터 로드 실패", e);
        alert("데이터를 불러오는데 실패했습니다.");
    }
}

// 3. 서브탭 전환 (통합용)
function switchUnifiedSubTab(subId, btn) {
    document.querySelectorAll('.uni-sub-content').forEach(el => el.style.display = 'none');
    document.getElementById(subId).style.display = 'block';
    
    // 버튼 스타일 초기화 후 활성화
    const container = btn.parentElement;
    container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
}

// [staff.js] updateUnifiedView 수정

function updateUnifiedView() {
    const mode = document.getElementById('unifiedStoreSelect').value;
    const today = currentUnifiedDate; 
    const monthStr = getMonthStr(today);
    
    // 제목 업데이트
    const titleEl = document.getElementById('unifiedMonthTitle');
    if (titleEl) {
        titleEl.textContent = `${today.getFullYear()}년 ${today.getMonth() + 1}월`;
    } 
    
    // 데이터셋 준비
    const datasets = [];
    if (mode === 'combined' || mode === 'chogazip') datasets.push({ acc: uniDataChoga, staff: uniStaffChoga, type: 'choga' });
    if (mode === 'combined' || mode === 'yangeun') datasets.push({ acc: uniDataYang, staff: uniStaffYang, type: 'yang' });

    // [1] 예상 순익용 변수 (일할)
    let predStats = { meat:0, food:0, rent:0, utility:0, liquor:0, loan:0, delivery:0, staff:0, etc:0 };
    let totalSales = 0;

    // [2] 월간 분석용 변수 (고정비 100%)
    let fullStats = { meat:0, food:0, rent:0, utility:0, liquor:0, loan:0, delivery:0, staff:0, etc:0 };

    const currentDay = today.getDate();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const ratio = currentDay / lastDay; 

    datasets.forEach(ds => {
        const d = ds.acc;
        
        // 1. 변동비 & 매출 (공통)
        if (d.daily) {
            Object.keys(d.daily).forEach(date => {
                if(date.startsWith(monthStr)) {
                    const day = d.daily[date];
                    // [수정] 통합 뷰에서도 계좌이체는 매출에 포함되지 않음 (이미 저장된 sales 사용)
                    // 기존에 저장된 데이터는 sales에 포함되어 있을 수 있으므로 재계산을 추천하지만,
                    // 일단 저장된 daily.sales 값을 신뢰하거나, 필요 시 여기서도 재계산 로직을 넣을 수 있음.
                    // (일관성을 위해 저장된 값 사용)
                    totalSales += (day.sales || 0);
                    
                    // 변동비는 예상이나 현실이나 똑같음 (이미 쓴 돈)
                    const vMeat = (day.meat || 0);
                    const vFood = (day.food || 0);
                    const vEtc = (day.etc || 0);

                    predStats.meat += vMeat; predStats.food += vFood; predStats.etc += vEtc;
                    fullStats.meat += vMeat; fullStats.food += vFood; fullStats.etc += vEtc;
                }
            });
        }

        // 2. 인건비 & 고정비
        const staffFull = getEstimatedStaffCost(monthStr, ds.staff); // 월 전체 예상액
        const staffPred = Math.floor(staffFull * ratio); // 오늘까지 일할액

        predStats.staff += staffPred;
        fullStats.staff += staffFull;

        if (d.monthly && d.monthly[monthStr]) {
            const m = d.monthly[monthStr];
            
            // 항목별 값 추출
            const vRent = (m.rent||0);
            const vUtil = (m.utility||0) + (m.gas||0) + (m.tableOrder||0) + (m.foodWaste||0);
            const vLiq = (m.liquor||0) + (m.beverage||0);
            const vLoan = (m.liquorLoan||0);
            const vDel = (m.deliveryFee||0);
            const vEtcFix = (m.businessCard||0) + (m.taxAgent||0) + (m.tax||0) + (m.etc_fixed||0) + (m.disposable||0);

            // [예상 탭] 일할 적용
            predStats.rent += Math.floor(vRent * ratio);
            predStats.utility += Math.floor(vUtil * ratio);
            predStats.liquor += Math.floor(vLiq * ratio);
            predStats.loan += Math.floor(vLoan * ratio);
            predStats.delivery += Math.floor(vDel * ratio);
            predStats.etc += Math.floor(vEtcFix * ratio);

            // [분석 탭] 100% 적용
            fullStats.rent += vRent;
            fullStats.utility += vUtil;
            fullStats.liquor += vLiq;
            fullStats.loan += vLoan;
            fullStats.delivery += vDel;
            fullStats.etc += vEtcFix;
        }
    });

    // --- [탭 1] 예상 순익 렌더링 ---
    const predCostTotal = Object.values(predStats).reduce((a,b)=>a+b, 0);
    const predProfit = totalSales - predCostTotal;
    const predMargin = totalSales > 0 ? ((predProfit / totalSales) * 100).toFixed(1) : 0;

    document.getElementById('uniPredSales').textContent = totalSales.toLocaleString() + '원';
    document.getElementById('uniPredCost').textContent = predCostTotal.toLocaleString() + '원';
    const predEl = document.getElementById('uniPredProfit');
    predEl.textContent = predProfit.toLocaleString() + '원';
    predEl.style.color = predProfit >= 0 ? '#fff' : '#ffab91';
    document.getElementById('uniPredMargin').textContent = `마진율: ${predMargin}%`;
    
    renderDetailedCostChart('uniPredCostList', predStats, totalSales, predCostTotal);

    // --- [탭 2] 월간 분석 렌더링 (고정비 100% 기준) ---
    const fullCostTotal = Object.values(fullStats).reduce((a,b)=>a+b, 0);
    const fullProfit = totalSales - fullCostTotal;
    const fullMargin = totalSales > 0 ? ((fullProfit / totalSales) * 100).toFixed(1) : 0;

    document.getElementById('uniDashSales').textContent = totalSales.toLocaleString() + '원';
    document.getElementById('uniDashCost').textContent = fullCostTotal.toLocaleString() + '원'; // 전체 비용
    const dashEl = document.getElementById('uniDashProfit');
    dashEl.textContent = fullProfit.toLocaleString() + '원';
    dashEl.style.color = fullProfit >= 0 ? '#333' : 'red'; // 흑자면 검정, 적자면 빨강
    document.getElementById('uniDashMargin').textContent = `실질마진: ${fullMargin}%`;

    // [중요] 월간 분석 탭에도 차트를 그리기 위해 HTML에 컨테이너가 필요합니다.
    let dashListEl = document.getElementById('uniDashCostList');
    if (!dashListEl) {
        // 차트 그릴 공간이 없으면 동적으로 salesChart 위에 생성
        const chartArea = document.getElementById('uniSalesChart');
        if(chartArea) {
            dashListEl = document.createElement('div');
            dashListEl.id = 'uniDashCostList';
            dashListEl.className = 'cost-list';
            dashListEl.style.marginBottom = '20px';
            chartArea.parentNode.insertBefore(dashListEl, chartArea); // 차트 위에 삽입
            
            // 제목도 하나 달아줌
            const title = document.createElement('h3');
            title.className = 'chart-title';
            title.textContent = '📉 전체 비용 구조 (고정비 100% 반영)';
            chartArea.parentNode.insertBefore(title, dashListEl);
        }
    }
    
    // 차트 렌더링 (분석 탭용 데이터 사용)
    if(dashListEl) {
        renderDetailedCostChart('uniDashCostList', fullStats, totalSales, fullCostTotal);
    }
}

// (NEW) 상세 항목 차트 렌더링 함수
function renderDetailedCostChart(containerId, stats, salesTotal, totalCost) {
    const el = document.getElementById(containerId);
    if(!el) return;

    // 큰 항목 순서대로 정렬하거나 고정된 순서로 표시
    const items = [
        { label: '🥩 고기/SPC', val: stats.meat, color: '#ef5350' },
        { label: '🥬 삼시세끼', val: stats.food, color: '#8d6e63' },
        { label: '🏠 임대료', val: stats.rent, color: '#ab47bc' },
        { label: '👥 인건비', val: stats.staff, color: '#ba68c8' },
        { label: '💡 관리/공과', val: stats.utility, color: '#5c6bc0' }, // 별도 분리
        { label: '🍶 주류대출', val: stats.loan, color: '#ff9800' },     // 별도 분리
        { label: '🍺 주류/음료', val: stats.liquor, color: '#ce93d8' },
        { label: '🛵 배달수수료', val: stats.delivery, color: '#00bcd4' },
        { label: '🎸 기타통합', val: stats.etc, color: '#90a4ae' }
    ].sort((a,b) => b.val - a.val); // 금액 큰 순서로 정렬

    let html = '';
    items.forEach(item => {
        if (item.val > 0) {
            const widthPct = Math.max((item.val / totalCost) * 100, 1);
            const textPct = salesTotal > 0 ? ((item.val / salesTotal) * 100).toFixed(1) : '0.0';
            html += `
            <div class="bar-row">
                <div class="bar-label" style="width:90px;">${item.label}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${widthPct}%; background:${item.color};"></div></div>
                <div class="bar-value" style="width:70px;">${item.val.toLocaleString()} <span style="font-size:10px; color:#999;">(${textPct}%)</span></div>
            </div>`;
        }
    });
    el.innerHTML = html;
}

// 통합 비용 차트 렌더링
function renderUnifiedCostList(containerId, costs, ratio, salesTotal, totalCost) {
    const el = document.getElementById(containerId);
    if(!el) return;
    
    // 일할 적용
    const items = [
        { label: '🥩 고기/재료', val: costs.meat, color: '#ef5350' },
        { label: '🥬 식자재/유통', val: costs.food, color: '#8d6e63' },
        { label: '🏠 임대료', val: Math.floor(costs.rent * ratio), color: '#ab47bc' },
        { label: '🍶 주류/음료', val: Math.floor(costs.liquor * ratio), color: '#ce93d8' },
        { label: '🛵 배달대행', val: Math.floor(costs.delivery * ratio), color: '#00bcd4' },
        { label: '💡 관리/공과', val: Math.floor(costs.utility * ratio), color: '#e1bee7' },
        { label: '🔧 기타잡비', val: costs.etc + Math.floor(costs.others * ratio), color: '#78909c' }
    ].sort((a,b) => b.val - a.val);

    let html = '';
    items.forEach(item => {
        if (item.val > 0) {
            const widthPct = Math.max((item.val / totalCost) * 100, 1);
            const textPct = salesTotal > 0 ? ((item.val / salesTotal) * 100).toFixed(1) : '0.0';
            html += `
            <div class="bar-row">
                <div class="bar-label">${item.label}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${widthPct}%; background:${item.color};"></div></div>
                <div class="bar-value">${item.val.toLocaleString()} <span style="font-size:11px; color:#999;">(${textPct}%)</span></div>
            </div>`;
        }
    });
    el.innerHTML = html;
}

// 통합 매출 차트 렌더링
function renderUnifiedSalesChart(types, total) {
    const el = document.getElementById('uniSalesChart');
    if(!el) return;
    
    if(total === 0) { el.innerHTML = '<div style="text-align:center; color:#999;">데이터 없음</div>'; return; }

    const renderBar = (l, v, c) => v > 0 ? `<div class="bar-row"><div class="bar-label">${l}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max((v/total)*100,1)}%; background:${c};"></div></div><div class="bar-value">${v.toLocaleString()}</div></div>` : '';

    // [수정] 통합 차트에서도 계좌이체 바(Bar) 제거 (매출 아님)
    el.innerHTML = `
        ${renderBar('💳 카드', types.card, '#42a5f5')}
        ${renderBar('📱 배달앱', types.app, '#2ac1bc')}
        ${renderBar('💵 현금', types.cash, '#66bb6a')}
        ${renderBar('🎫 기타', types.etc, '#ffa726')}
    `;
}

// [선결제 관련 함수들]
async function loadPrepaymentData() {
    if (!currentUser) { openLoginModal(); return; }
    document.getElementById('preDate').value = new Date().toISOString().split('T')[0];
    
    try {
        const res = await fetch(`/api/prepayments?store=${currentStore}`);
        const json = await res.json();
        prepayData = json.data;
        renderPrepaymentUI();
    } catch(e) { console.error(e); }
}

function renderPrepaymentUI() {
    if (!prepayData || !prepayData.customers || !prepayData.logs) {
        prepayData = { customers: {}, logs: [] };
    }

    const datalist = document.getElementById('customerList');
    if (datalist) {
        datalist.innerHTML = Object.keys(prepayData.customers).map(name => `<option value="${name}">`).join('');
    }

    const balanceTbody = document.getElementById('preBalanceTable');
    if (balanceTbody) {
        balanceTbody.innerHTML = '';
        const sortedCustomers = Object.entries(prepayData.customers).sort((a, b) => b[1].balance - a[1].balance);
        
        if (sortedCustomers.length === 0) {
            balanceTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">데이터가 없습니다.</td></tr>';
        } else {
            sortedCustomers.forEach(([name, info]) => {
                const row = document.createElement('tr');
                row.style.cursor = 'pointer';
                row.title = "클릭하면 이름을 입력창에 채웁니다.";
                row.onclick = () => {
                    document.getElementById('preCustName').value = name;
                    document.getElementById('preAmount').focus();
                };
                
                row.innerHTML = `
                    <td style="text-align:left;"><strong>👤 ${name}</strong></td>
                    <td style="font-weight:bold; color:${info.balance < 0 ? 'red' : '#1976D2'};">${info.balance.toLocaleString()}원</td>
                    <td style="color:#666; font-size:11px;">${info.lastUpdate}</td>
                `;
                balanceTbody.appendChild(row);
            });
        }
    }

    const logTbody = document.getElementById('preLogTable');
    if(logTbody) {
        if (!prepayData.logs || prepayData.logs.length === 0) {
            logTbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">기록이 없습니다.</td></tr>';
        } else {
            logTbody.innerHTML = prepayData.logs.map((log) => `
                <tr>
                    <td>${log.date.substring(5)}</td>
                    <td style="font-weight:bold; color:#555;">${log.actor || '-'}</td> 
                    <td><strong>${log.customerName}</strong></td>
                    <td style="color:${log.type === 'charge' ? '#2e7d32' : '#d32f2f'};">${log.type === 'charge' ? '충전' : '사용'}</td>
                    <td style="text-align:right;">${log.amount.toLocaleString()}</td>
                    <td style="font-size:11px; color:#999; text-align:right;">${log.currentBalance.toLocaleString()}</td>
                    <td style="font-size:11px; text-align:left;">${log.note || '-'}</td>
                    <td style="text-align:center;">
                        ${(currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager')) ? 
                        `<button onclick="deletePrepayLog(${log.id})" style="padding:2px 5px; background:#ffc107; border:none; border-radius:3px; font-size:10px; cursor:pointer;">취소</button>` 
                        : ''}
                    </td>
                </tr>
            `).join('');
        }
    }
}

async function deletePrepayLog(logId) {
    if(!confirm('이 기록을 취소하시겠습니까? (잔액이 다시 복구됩니다)')) return;
    try {
        const res = await fetch(`/api/prepayments/${logId}`, {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ actor: currentUser.name, store: currentStore })
        });
        if(res.ok) { alert('취소되었습니다.'); loadPrepaymentData(); }
    } catch(e) { alert('삭제 실패'); }
}

async function savePrepayment() {
    const customerName = document.getElementById('preCustName').value.trim();
    const amount = document.getElementById('preAmount').value;
    const type = document.getElementById('preType').value;
    const date = document.getElementById('preDate').value;
    const note = document.getElementById('preNote').value;

    if (!customerName || !amount || !date) { alert('필수 항목을 입력하세요.'); return; }
    if (!confirm(`${customerName}님께 ${parseInt(amount).toLocaleString()}원을 ${type === 'charge' ? '충전' : '차감'}하시겠습니까?`)) return;

    try {
        const res = await fetch('/api/prepayments', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ customerName, amount, type, date, note, actor: currentUser.name, store: currentStore })
        });
        if (res.ok) {
            alert('등록되었습니다.');
            loadPrepaymentData();
            document.getElementById('preAmount').value = '';
            document.getElementById('preNote').value = '';
        }
    } catch(e) { alert('저장 실패'); }
}

// [가계부 내부 서브탭 전환]
// 2. switchAccSubTab 수정 (여기에 선결제 로딩 로직 추가)
function switchAccSubTab(subTabId, btnElement) {
    // 1. 모든 서브 콘텐츠 숨김
    document.querySelectorAll('.acc-sub-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });
    
    // 2. 버튼 활성화 처리
    const subTabContainer = document.querySelector('.tabs[style*="grid-template-columns"]'); 
    // .tabs 부모 찾기가 애매할 수 있으므로, btnElement가 있으면 그걸 쓰고, 없으면 id로 찾습니다.
    if(btnElement) {
        // 형제 버튼들의 active 제거
        const siblings = btnElement.parentElement.querySelectorAll('.tab');
        siblings.forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    } else {
        // 직접 ID로 호출된 경우 (예: 초기화 시)
        // 매입/매출 내부의 탭들만 선택해서 초기화해야 함
        const accContent = document.getElementById('accounting-content');
        if(accContent) {
            accContent.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
            const targetBtn = accContent.querySelector(`button[onclick*="${subTabId}"]`);
            if(targetBtn) targetBtn.classList.add('active');
        }
    }

    // 3. 타겟 콘텐츠 표시
    const targetDiv = document.getElementById(subTabId);
    if(targetDiv) {
        targetDiv.style.display = 'block';
        targetDiv.classList.add('active');
        
        // [핵심 수정] 서브 탭 별 데이터 로드/UI 업데이트 트리거
        if (subTabId === 'acc-history') loadHistoryTable();
        else if (subTabId === 'acc-prediction') renderPredictionStats();
        else if (subTabId === 'acc-dashboard') renderDashboardStats();
        else if (subTabId === 'acc-monthly') loadMonthlyForm();
        else if (subTabId === 'acc-prepayment') {
            // [Fix] 탭을 누르는 순간 데이터를 가져오도록 함 (리프레시 문제 해결)
            loadPrepaymentData(); 
        }
        else if (subTabId === 'acc-logs') loadAccountingLogs();  // ✅ 신규 추가
    }
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
// staff.js - tryLogin 함수 수정

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
            // ============================================================
            // [수정됨] 로그인 성공 시 localStorage에 저장 (시간 포함)
            // ============================================================
            const sessionData = {
                ...data,
                loginTime: new Date().getTime() // 현재 시간(타임스탬프) 추가
            };
            
            // sessionStorage 대신 localStorage 사용 (브라우저 꺼도 유지됨)
            localStorage.setItem('staffUser', JSON.stringify(sessionData));
            
            // 로그인 성공 UI 처리 함수 호출
            onLoginSuccess(data);
            
            closeLoginModal();
        } else {
            const err = document.getElementById('loginError');
            if(err) {
                err.style.display = 'block';
                err.textContent = '비밀번호가 일치하지 않습니다.';
            }
        }
    } catch (e) { 
        console.error('로그인 에러:', e);
        alert('로그인 처리 중 오류가 발생했습니다.'); 
    }
}

// [신규] 로그인 성공 시 UI 업데이트 함수 (분리)
// tryLogin 내부와 DOMContentLoaded 에서 공통으로 사용
async function onLoginSuccess(user) {
    currentUser = user;
    
    const loginBtn = document.getElementById('loginBtn');
    if(loginBtn) loginBtn.style.display = 'none';
    
    const userInfoDiv = document.getElementById('userInfo');
    if(userInfoDiv) {
        userInfoDiv.style.display = 'block';
        userInfoDiv.innerHTML = `${user.name} (${user.role === 'admin' ? '사장' : user.role === 'manager' ? '점장' : '직원'})`;
    }

    // 관리자/점장 공통 권한 (매장 전환 버튼 보이기)
    if (user.role === 'admin' || user.role === 'manager') {
        const switchBtn = document.getElementById('switchStoreBtn');
        if(switchBtn) switchBtn.style.display = 'inline-block';
    }

    // 관리자(사장님) 전용 권한
    if (user.role === 'admin') {
        const bulkSection = document.getElementById('bulkSection');
        if(bulkSection) bulkSection.style.display = 'block';
        
        const salarySection = document.getElementById('salarySection');
        if(salarySection) salarySection.style.display = 'block';
        
        const backupBtn = document.getElementById('adminBackupBtn');
        if(backupBtn) backupBtn.style.display = 'block';
        
        const unifiedBtn = document.getElementById('unifiedTabBtn');
        if(unifiedBtn) unifiedBtn.style.display = 'inline-block';
        
        try { await loadLogs(); } catch(e) {}
    }
    
    // 현재 탭 데이터 로드
    const activeTab = document.querySelector('.tab-content.active');
    if(activeTab && activeTab.id === 'accounting-content') {
        try { await loadAccountingData(); } catch(e) {}
    }
    try { renderManageList(); } catch(e) {}
}

// ==========================================
// 4. 가계부 (매출/지출/통계) 로직
// ==========================================

function getMonthStr(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function changeAccMonth(delta) {
    currentDashboardDate.setMonth(currentDashboardDate.getMonth() + delta);
    loadAccountingData(); 
}

function resetAccMonth() {
    currentDashboardDate = new Date();
    loadAccountingData();
}

// 통합분석 월 이동 함수
function changeUnifiedMonth(delta) {
    currentUnifiedDate.setMonth(currentUnifiedDate.getMonth() + delta);
    loadUnifiedData(); 
}

function resetUnifiedMonth() {
    currentUnifiedDate = new Date();
    loadUnifiedData();
}

async function loadAccountingData() {
    if (!currentUser) { 
        alert("로그인이 필요합니다.");
        openLoginModal(); 
        switchTab('daily'); 
        return; 
    }
    
    try {
        const res = await fetch(`/api/accounting?store=${currentStore}`);
        const json = await res.json();
        accountingData = json.data || { daily: {}, monthly: {} };
        if(!accountingData.daily) accountingData.daily = {};
        if(!accountingData.monthly) accountingData.monthly = {};
        updateDashboardUI();
    } catch(e) { console.error('회계 로드 실패', e); }
}

function updateDashboardUI() {
    const monthStr = getMonthStr(currentDashboardDate);
    const [y, m] = monthStr.split('-');
    
    const titleEl = document.getElementById('dashboardTitle');
    if(titleEl) titleEl.textContent = `${y}년 ${m}월`;
    const fixTitle = document.getElementById('fixCostTitle');
    if(fixTitle) fixTitle.textContent = `${m}월`;
    const fixBtn = document.getElementById('fixBtnMonth');
    if(fixBtn) fixBtn.textContent = `${m}월`;

    const activeSubTab = document.querySelector('.acc-sub-content.active');
    
    if (!activeSubTab) { switchAccSubTab('acc-daily'); return; }

    if (activeSubTab.id === 'acc-history') loadHistoryTable();
    else if (activeSubTab.id === 'acc-prediction') renderPredictionStats();
    else if (activeSubTab.id === 'acc-dashboard') renderDashboardStats();
    else if (activeSubTab.id === 'acc-monthly') loadMonthlyForm();
}

// [서브탭 1] 일일 데이터 로드/저장
function loadDailyAccounting() {
    const datePicker = document.getElementById('accDate').value;
    if (!datePicker) return;

    const dayData = (accountingData.daily && accountingData.daily[datePicker]) ? accountingData.daily[datePicker] : {};
    
    if(document.getElementById('inpCard')) document.getElementById('inpCard').value = dayData.card || '';
    if(document.getElementById('inpTransfer')) document.getElementById('inpTransfer').value = dayData.transfer || '';
    
    if (currentStore === 'yangeun') {
        if(document.getElementById('inpBaemin')) document.getElementById('inpBaemin').value = dayData.baemin || '';
        if(document.getElementById('inpYogiyo')) document.getElementById('inpYogiyo').value = dayData.yogiyo || '';
        if(document.getElementById('inpCoupang')) document.getElementById('inpCoupang').value = dayData.coupang || '';
    } else {
        if(document.getElementById('inpGift')) document.getElementById('inpGift').value = dayData.gift || '';
    }
    
    document.getElementById('inpStartCash').value = (dayData.startCash !== undefined) ? dayData.startCash : 100000;
    document.getElementById('inpCash').value = dayData.cash || '';
    document.getElementById('inpDeposit').value = dayData.bankDeposit || ''; 

    document.getElementById('inpFood').value = dayData.food || '';
    document.getElementById('inpMeat').value = dayData.meat || ''; 
    document.getElementById('inpEtc').value = dayData.etc || ''; 
    document.getElementById('inpNote').value = dayData.note || '';

    calcDrawerTotal(); 
}

function calcDrawerTotal() {
    const startCash = parseInt(document.getElementById('inpStartCash').value) || 0; 
    const cashSales = parseInt(document.getElementById('inpCash').value) || 0;      
    const transfer = parseInt(document.getElementById('inpTransfer').value) || 0;   
    const deposit = parseInt(document.getElementById('inpDeposit').value) || 0;     

    // [수정] 돈통 계산은 기존과 동일 (계좌이체는 돈통에 없는 돈이므로 차감)
    // 현금 매출(CashSales)에는 계좌이체가 포함되어 있다고 가정하므로, 
    // 실제 돈통에는 (현금매출 - 계좌이체) 만큼의 현금이 더해져야 함.
    const finalTotal = (startCash + cashSales) - (transfer + deposit);
    const displayEl = document.getElementById('drawerTotalDisplay');
    displayEl.textContent = finalTotal.toLocaleString() + '원';

    if(finalTotal < 0) {
        displayEl.style.color = "red";
        displayEl.innerHTML += " <span style='font-size:14px'>(⚠️ 잔액 부족)</span>";
    } else {
        displayEl.style.color = "#1565c0";
    }
}

// [카카오톡] 수동 브리핑 발송
async function sendKakaoBriefingManual() {
    if (!currentUser || currentUser.role !== 'admin') {
        alert("사장님만 보낼 수 있습니다.");
        return;
    }

    if (!confirm('📢 현재 시점의 매출/순익 브리핑을\n카카오톡(나에게)으로 보내시겠습니까?')) return;

    try {
        const res = await fetch('/api/kakao/send-briefing', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ actor: currentUser.name })
        });
        
        const json = await res.json();
        
        if (json.success) {
            alert('🚀 발송되었습니다! 카카오톡을 확인해주세요.');
        } else {
            alert('발송 실패: 서버 로그를 확인해주세요.');
        }
    } catch (e) {
        console.error(e);
        alert('서버 통신 오류');
    }
}

async function saveDailyAccounting() {
    if (!currentUser) { alert("로그인이 필요합니다."); openLoginModal(); return; }
    if (!['admin', 'manager'].includes(currentUser.role)) { alert("점장 또는 사장님만 매출을 입력/수정할 수 있습니다."); return; }

    const dateStr = document.getElementById('accDate').value;
    if (!dateStr) { alert('날짜를 선택해주세요.'); return; }

    const startCash = parseInt(document.getElementById('inpStartCash').value) || 0;
    const cash = parseInt(document.getElementById('inpCash').value) || 0;
    const bankDeposit = parseInt(document.getElementById('inpDeposit').value) || 0;
    const transfer = parseInt(document.getElementById('inpTransfer').value) || 0;
    
    const food = parseInt(document.getElementById('inpFood').value) || 0;
    const meat = parseInt(document.getElementById('inpMeat').value) || 0;
    const etc = parseInt(document.getElementById('inpEtc').value) || 0;
    const note = document.getElementById('inpNote').value || '';

    let card = 0, gift = 0, baemin = 0, yogiyo = 0, coupang = 0;
    let totalSales = 0;

    if (currentStore === 'yangeun') {
        card = parseInt(document.getElementById('inpCard').value) || 0;
        baemin = parseInt(document.getElementById('inpBaemin').value) || 0;
        yogiyo = parseInt(document.getElementById('inpYogiyo').value) || 0;
        coupang = parseInt(document.getElementById('inpCoupang').value) || 0;
        // [수정] 계좌이체(transfer)는 매출 합계에서 제외 (현금에 포함됨 or 관리용)
        totalSales = card + cash + baemin + yogiyo + coupang; 
    } else {
        card = parseInt(document.getElementById('inpCard').value) || 0;
        gift = parseInt(document.getElementById('inpGift').value) || 0;
        // [수정] 계좌이체(transfer)는 매출 합계에서 제외
        totalSales = card + cash + gift;
    }

    const totalCost = food + meat + etc;

    if (totalSales === 0 && totalCost === 0) {
        if(!confirm(`${dateStr} 입력된 금액이 없습니다 (0원).\n그래도 저장하시겠습니까?`)) return;
    }

    const data = {
        startCash, cash, bankDeposit, card, transfer, 
        gift: (currentStore === 'yangeun' ? 0 : gift),
        baemin, yogiyo, coupang,
        sales: totalSales, food, meat, etc, cost: totalCost, note: note
    };

    try {
        await fetch('/api/accounting/daily', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ date: dateStr, data: data, store: currentStore, actor: currentUser.name })
        });
        
        if(!accountingData.daily) accountingData.daily = {};
        accountingData.daily[dateStr] = data;
        alert('저장되었습니다.');
        switchAccSubTab('acc-history');
    } catch(e) { alert('저장 실패: 서버 오류'); }
}

// [staff.js]

// 1. [NEW] 필터 적용 버튼 클릭 시 실행
function applyHistoryFilter() {
    const filterKey = document.getElementById('historyFilterSelect').value;
    loadHistoryTable(filterKey);
}

// 2. [UPDATE] 기존 loadHistoryTable 함수 교체
function loadHistoryTable(filterKey = 'all') {
    const monthStr = getMonthStr(currentDashboardDate); 
    const tbody = document.getElementById('historyTableBody');
    const summaryDiv = document.getElementById('filterResultSummary'); // 요약 박스
    
    if(!tbody) return;
    tbody.innerHTML = '';
    
    // 필터링된 항목의 총합을 계산하기 위한 변수
    let filteredSum = 0;
    let filteredCount = 0;
    
    // 레이블 맵핑 (화면 표시용)
    const labelMap = {
        'card': '💳 카드', 'cash': '💵 현금', 'baemin': '🛵 배민', 
        'yogiyo': '🛵 요기요', 'coupang': '🛵 쿠팡', 'gift': '🎫 기타',
        'meat': (currentStore === 'yangeun' ? '🍞 SPC' : '🥩 고기'),
        'food': '🥬 삼시세끼', 'etc': '🍦 잡비'
    };

    const rows = []; 

    if (accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if (!date.startsWith(monthStr)) return; // 현재 월 데이터만
            
            const d = accountingData.daily[date];
            
            // === [핵심 로직] 필터링 수행 ===
            if (filterKey !== 'all') {
                const targetValue = d[filterKey] || 0;
                // 해당 항목의 값이 0이면 리스트에서 제외 (검증할 필요 없음)
                if (targetValue === 0) return;
                
                // 값이 있으면 합계에 누적
                filteredSum += targetValue;
                filteredCount++;
            }
            // ============================

            const totalSales = (d.sales||0);
            const totalCost = (d.cost||0);
            
            // 상세 내역 텍스트 생성
            let details = [];
            
            // 필터링 중이라면, 해당 항목을 강조해서 보여줌
            if (filterKey !== 'all') {
                const val = d[filterKey] || 0;
                const label = labelMap[filterKey] || filterKey;
                // 강조 스타일 적용
                details.push(`<span style="background:#fff9c4; color:#f57f17; padding:2px 4px; font-weight:bold; border-radius:3px; border:1px solid #fbc02d;">${label}: ${val.toLocaleString()}</span>`);
            } else {
                // 전체 보기일 때는 기존 로직 유지
                if(d.card) details.push(`💳카드:${d.card.toLocaleString()}`);
                if(d.cash) details.push(`💵현금:${d.cash.toLocaleString()}`);
                if(d.transfer) details.push(`🏦이체:${d.transfer.toLocaleString()}`);
                
                if (currentStore === 'yangeun') {
                    if(d.baemin) details.push(`배민:${d.baemin.toLocaleString()}`);
                    if(d.yogiyo) details.push(`요기:${d.yogiyo.toLocaleString()}`);
                    if(d.coupang) details.push(`쿠팡:${d.coupang.toLocaleString()}`);
                } else {
                    if(d.gift) details.push(`🎫기타:${d.gift.toLocaleString()}`);
                }
                
                const meatName = (currentStore === 'yangeun') ? 'SPC' : '고기';
                if(d.meat) details.push(`${meatName}:${d.meat.toLocaleString()}`);
                if(d.food) details.push(`유통:${d.food.toLocaleString()}`);
                if(d.etc) details.push(`잡비:${d.etc.toLocaleString()}`);
            }

            if(d.note) details.push(`📝"${d.note}"`);

            rows.push({
                date: date, dayStr: `${date.substring(8)}일`,
                sales: totalSales, cost: totalCost,
                desc: details.join(' / '), type: 'daily'
            });
        });
    }

    // [월 고정비 표시] - 전체 보기일 때만 표시 (필터링 중일 땐 헷갈리므로 제외하거나 필요시 추가)
    if (filterKey === 'all' && accountingData.monthly && accountingData.monthly[monthStr]) {
        const m = accountingData.monthly[monthStr];
        const fixedTotal = (m.rent||0) + (m.utility||0) + (m.gas||0) + (m.liquor||0) + (m.beverage||0) + (m.etc_fixed||0)
                         + (m.disposable||0) + (m.businessCard||0) + (m.taxAgent||0) + (m.tax||0) + (m.foodWaste||0) + (m.tableOrder||0) + (m.liquorLoan||0)
                         + (m.deliveryFee||0);
        
        if (fixedTotal > 0) {
            rows.push({
                date: `${monthStr}-99`, dayStr: `월말 고정`, // 맨 뒤로 보내기 위해 99
                sales: 0, cost: fixedTotal,
                desc: `<span style="color:#00796b; font-weight:bold;">[월 고정비 합계]</span>`,
                type: 'fixed'
            });
        }
    }

    // [UI 업데이트] 결과 없음 처리
    if (rows.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#999;">해당 내역이 없습니다.</td></tr>'; 
        if(summaryDiv) summaryDiv.style.display = 'none';
        return; 
    }

    // [UI 업데이트] 요약 박스 표시 (필터 모드일 때만)
    if (filterKey !== 'all' && summaryDiv) {
        summaryDiv.style.display = 'block';
        const label = labelMap[filterKey] || filterKey;
        const [y, m] = monthStr.split('-');
        summaryDiv.innerHTML = `
            <div>✅ ${m}월 [${label}] 검증 결과</div>
            <div style="font-size:18px; margin-top:5px;">총 ${filteredCount}건 / 합계: <span style="font-weight:900; text-decoration:underline;">${filteredSum.toLocaleString()}원</span></div>
            <div style="font-size:11px; font-weight:normal; margin-top:2px;">(앱/영수증 합계와 일치하는지 확인하세요)</div>
        `;
    } else if (summaryDiv) {
        summaryDiv.style.display = 'none';
    }

    // 날짜 역순 정렬
    rows.sort((a,b) => b.date.localeCompare(a.date));

    // 테이블 렌더링
    rows.forEach(r => {
        let actionBtn = '';
        if (r.type === 'daily') {
            const btnStyle = "background:#607d8b; color:white; border:none; border-radius:3px; padding:5px 10px; cursor:pointer; font-size:12px;";
            // 필터링 중일 때 수정 버튼 누르면 해당 날짜로 이동하면서 전체보기로 바뀌는게 덜 헷갈림
            actionBtn = `<button onclick="editHistoryDate('${r.date}')" style="${btnStyle}">✏️ 수정</button>`;
        } else {
             const btnStyle = "background:#00796b; color:white; border:none; border-radius:3px; padding:5px 10px; cursor:pointer; font-size:12px;";
             actionBtn = `<button onclick="switchAccSubTab('acc-monthly')" style="${btnStyle}">⚙️ 설정</button>`;
        }
        
        const rowStyle = `border-bottom:1px solid #eee; ${r.type === 'fixed' ? 'background:#e0f7fa;' : ''}`;
        
        tbody.innerHTML += `
            <tr style="${rowStyle}">
                <td style="text-align:center;"><strong>${r.dayStr}</strong></td>
                <td style="color:#1976D2; font-weight:bold; text-align:right;">${r.sales.toLocaleString()}</td>
                <td style="color:#d32f2f; text-align:right;">${r.cost.toLocaleString()}</td>
                <td style="font-size:12px; color:#555; word-break:keep-all; line-height:1.4;">${r.desc}</td>
                <td style="text-align:center;">${actionBtn}</td>
            </tr>`;
    });
}

function editHistoryDate(date) {
    if (!currentUser || !['admin', 'manager'].includes(currentUser.role)) { alert("수정 권한이 없습니다"); return; }
    document.getElementById('accDate').value = date;
    loadDailyAccounting();
    switchAccSubTab('acc-daily');
    alert(`${date} 데이터를 불러왔습니다.\n수정 후 [저장하기]를 눌러주세요.`);
}

// [월 고정비 로드]
function loadMonthlyForm() {
    const monthStr = getMonthStr(currentDashboardDate);
    const mData = (accountingData.monthly && accountingData.monthly[monthStr]) ? accountingData.monthly[monthStr] : {};

    if(document.getElementById('fixRent')) document.getElementById('fixRent').value = mData.rent || '';
    if(document.getElementById('fixUtility')) document.getElementById('fixUtility').value = mData.utility || '';
    if(document.getElementById('fixGas')) document.getElementById('fixGas').value = mData.gas || '';
    if(document.getElementById('fixLiquor')) document.getElementById('fixLiquor').value = mData.liquor || '';

    if(document.getElementById('fixMakgeolli')) document.getElementById('fixMakgeolli').value = mData.makgeolli || '';

    if(document.getElementById('fixBeverage')) document.getElementById('fixBeverage').value = mData.beverage || '';
    if(document.getElementById('fixEtc')) document.getElementById('fixEtc').value = mData.etc_fixed || '';
    if(document.getElementById('fixLiquorLoan')) document.getElementById('fixLiquorLoan').value = mData.liquorLoan || '';
    if(document.getElementById('fixDeliveryFee')) document.getElementById('fixDeliveryFee').value = mData.deliveryFee || '';
    if(document.getElementById('fixDisposable')) document.getElementById('fixDisposable').value = mData.disposable || '';
    if(document.getElementById('fixBusinessCard')) document.getElementById('fixBusinessCard').value = mData.businessCard || '';
    if(document.getElementById('fixTaxAgent')) document.getElementById('fixTaxAgent').value = mData.taxAgent || '';
    if(document.getElementById('fixTax')) document.getElementById('fixTax').value = mData.tax || '';
    if(document.getElementById('fixFoodWaste')) document.getElementById('fixFoodWaste').value = mData.foodWaste || '';
    if(document.getElementById('fixTableOrder')) document.getElementById('fixTableOrder').value = mData.tableOrder || '';

    // [NEW] 주류/음료 매출 설정 로드
    if(document.getElementById('fixAlcoholSales')) document.getElementById('fixAlcoholSales').value = mData.alcoholSales || '';
    if(document.getElementById('fixBeverageSales')) document.getElementById('fixBeverageSales').value = mData.beverageSales || '';
}

// [월 고정비 저장]
async function saveFixedCost() {
    if (!currentUser) { openLoginModal(); return; }
    if (!['admin', 'manager'].includes(currentUser.role)) { alert("관리자 권한이 필요합니다."); return; }

    const monthStr = getMonthStr(currentDashboardDate);
    const rent = parseInt(document.getElementById('fixRent').value) || 0;
    const utility = parseInt(document.getElementById('fixUtility').value) || 0;
    const gas = parseInt(document.getElementById('fixGas').value) || 0;
    const liquor = parseInt(document.getElementById('fixLiquor').value) || 0; 

    const makgeolli = parseInt(document.getElementById('fixMakgeolli').value) || 0;

    const beverage = parseInt(document.getElementById('fixBeverage').value) || 0;
    const etc_fixed = parseInt(document.getElementById('fixEtc').value) || 0;
    const liquorLoan = parseInt(document.getElementById('fixLiquorLoan').value) || 0;
    const disposable = (currentStore === 'yangeun') ? (parseInt(document.getElementById('fixDisposable').value) || 0) : 0;
    const deliveryFee = (currentStore === 'yangeun') ? (parseInt(document.getElementById('fixDeliveryFee').value) || 0) : 0;
    const businessCard = parseInt(document.getElementById('fixBusinessCard').value) || 0;
    const taxAgent = parseInt(document.getElementById('fixTaxAgent').value) || 0;
    const tax = parseInt(document.getElementById('fixTax').value) || 0;
    const foodWaste = parseInt(document.getElementById('fixFoodWaste').value) || 0;
    const tableOrder = parseInt(document.getElementById('fixTableOrder').value) || 0;

    // [NEW] 주류/음료 매출 읽기
    const alcoholSales = parseInt(document.getElementById('fixAlcoholSales').value) || 0;
    const beverageSales = parseInt(document.getElementById('fixBeverageSales').value) || 0;

    if(!confirm(`${monthStr} 고정 지출 및 매출 설정을 저장하시겠습니까?`)) return;

    const data = { 
        rent, utility, gas, liquor, makgeolli, beverage, etc_fixed,
        disposable, businessCard, taxAgent, tax, foodWaste, tableOrder, liquorLoan, deliveryFee,
        alcoholSales, beverageSales // 저장
    };

    try {
        const res = await fetch('/api/accounting/monthly', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ month: monthStr, data: data, store: currentStore, actor: currentUser.name })
        });
        if (res.ok) {
            if(!accountingData.monthly) accountingData.monthly = {};
            accountingData.monthly[monthStr] = data;
            alert('저장되었습니다.');
            updateDashboardUI();
        } else alert('저장 실패');
    } catch(e) { console.error(e); alert('저장 실패'); }
}

// [분석 HTML 생성]
function generateDetailAnalysisHtml(totalSales, varCost, deliverySales, alcSales, bevSales, alcCost, bevCost, delivCost) {
    let html = `<h4 style="color:#00796b; margin-bottom:10px; border-top:1px solid #eee; padding-top:15px;">🕵️ 유형별 원가 분석 (마진율)</h4>`;
    html += `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">`;

    if (currentStore === 'yangeun') {
        const delRatio = deliverySales > 0 ? ((delivCost / deliverySales) * 100).toFixed(1) : '0.0';
        html += createAnalysisCard('🛵 배달 효율', 
            `배달매출: ${deliverySales.toLocaleString()}`, 
            `수수료: ${delivCost.toLocaleString()}`, 
            `수수료율: <strong>${delRatio}%</strong>`, '#e0f7fa');
    }

    const alcRatio = alcSales > 0 ? ((alcCost / alcSales) * 100).toFixed(1) : '0.0';
    html += createAnalysisCard('🍺 주류 마진', 
        `주류매출: ${alcSales.toLocaleString()}`, 
        `주류매입: ${alcCost.toLocaleString()}`, 
        `원가율: <strong>${alcRatio}%</strong>`, '#fff3e0');

    const bevRatio = bevSales > 0 ? ((bevCost / bevSales) * 100).toFixed(1) : '0.0';
    html += createAnalysisCard('🥤 음료 마진', 
        `음료매출: ${bevSales.toLocaleString()}`, 
        `음료매입: ${bevCost.toLocaleString()}`, 
        `원가율: <strong>${bevRatio}%</strong>`, '#f3e5f5');

    const foodSales = Math.max(0, totalSales - alcSales - bevSales);
    const foodCost = varCost; 
    const foodRatio = foodSales > 0 ? ((foodCost / foodSales) * 100).toFixed(1) : '0.0';
    
    html += createAnalysisCard('🍳 식자재(안주) 효율', 
        `순수 음식매출: ${foodSales.toLocaleString()}`, 
        `식자재비: ${foodCost.toLocaleString()}`, 
        `원가율: <strong style="color:#d32f2f; font-size:15px;">${foodRatio}%</strong>`, '#e8f5e9');

    html += `</div>`;
    if (alcSales === 0 && bevSales === 0) {
        html += `<p style="font-size:11px; color:#999; margin-top:5px; text-align:right;">* 고정비 설정에서 주류/음료 매출을 입력해야 식자재 분석이 정확해집니다.</p>`;
    }
    return html;
}

function createAnalysisCard(title, row1, row2, row3, bg) {
    return `
    <div style="background:${bg}; padding:10px; border-radius:8px; font-size:12px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">
        <div style="font-weight:bold; margin-bottom:5px; color:#455a64; border-bottom:1px dashed rgba(0,0,0,0.1); padding-bottom:3px;">${title}</div>
        <div style="color:#555;">${row1}</div>
        <div style="color:#555;">${row2}</div>
        <div style="margin-top:5px; font-size:13px; color:#333; text-align:right;">${row3}</div>
    </div>`;
}

function renderPredictionStats() {
    const today = new Date();
    const currentYear = currentDashboardDate.getFullYear();
    const currentMonth = currentDashboardDate.getMonth() + 1;
    const monthStr = getMonthStr(currentDashboardDate);

    const lastDayOfThisMonth = new Date(currentYear, currentMonth, 0).getDate();
    let appliedDay = lastDayOfThisMonth;
    let ratio = 1.0;

    // [수정됨] 현재 보고 있는 달이 '이번 달'인 경우에만 일할 비율 적용
    if (today.getFullYear() === currentYear && (today.getMonth() + 1) === currentMonth) {
        appliedDay = today.getDate();
        
        // --- [추가된 로직 시작] ---
        // 오늘 날짜의 매출 데이터를 확인합니다.
        const todayStr = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        const todayData = (accountingData.daily && accountingData.daily[todayStr]) ? accountingData.daily[todayStr] : {};
        const todaySales = todayData.sales || 0;

        // 만약 오늘 매출이 0원(아직 입력 안 함)이라면, 일할 계산을 '어제' 기준으로 합니다.
        // (단, 1일인 경우는 0일로 처리되어야 하므로 appliedDay > 0 조건만 체크)
        if (todaySales === 0 && appliedDay > 0) {
            appliedDay = appliedDay - 1;
        }
        // --- [추가된 로직 끝] ---

        ratio = appliedDay / lastDayOfThisMonth;
    } else if (new Date(currentYear, currentMonth - 1, 1) > today) {
        // 미래의 달
        appliedDay = 0; ratio = 0;
    }

    const ratioText = `${appliedDay}/${lastDayOfThisMonth}`;
    if(document.getElementById('predDateRatio')) document.getElementById('predDateRatio').textContent = ratioText;
    if(document.getElementById('predCostText')) document.getElementById('predCostText').textContent = `(일할/실비 구분적용)`;

    const mData = (accountingData.monthly && accountingData.monthly[monthStr]) ? accountingData.monthly[monthStr] : {};
    
    // 1. 매출 데이터 집계 (배달 통합)
    let sales = { card: 0, cash: 0, delivery: 0, gift: 0, total: 0 };
    let variableCostTotal = 0;
    let deliverySalesTotal = 0; // 분석용

    if (accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if (date.startsWith(monthStr)) {
                const d = accountingData.daily[date];
                
                // 매출 합산
                sales.card += (d.card || 0);
                sales.cash += (d.cash || 0);
                sales.gift += (d.gift || 0);
                
                // 배달 3사 합산 -> 'delivery'로 통합
                const dayDelivery = (d.baemin || 0) + (d.yogiyo || 0) + (d.coupang || 0);
                sales.delivery += dayDelivery;
                
                // [참고] 계좌이체는 매출에 포함 안 함 (현금에 포함된 것으로 간주하거나 별도 관리)
                
                variableCostTotal += (d.cost || 0);
            }
        });
    }
    sales.total = sales.card + sales.cash + sales.delivery + sales.gift;
    deliverySalesTotal = sales.delivery;

    // 2. 비용 계산 로직 개선
    // [A] 일할 계산 대상 (Time-based): 임대료, 공과금, 기타고정비 등
    const timeBasedFixedRaw = (mData.rent||0) + (mData.utility||0) + (mData.gas||0)
                            + (mData.etc_fixed||0) + (mData.disposable||0) + (mData.businessCard||0) 
                            + (mData.taxAgent||0) + (mData.tax||0) + (mData.foodWaste||0) + (mData.tableOrder||0);
    
    // [B] 100% 반영 대상 (Actuals): 주류, 음료, 막걸리, 대출상환, 배달수수료
    // -> 이미 들어온 물건값이거나 매출에 비례해 발생한 수수료이므로 나누지 않음
    const actualBasedFixed = (mData.liquor||0) + (mData.makgeolli||0) + (mData.beverage||0)
                           + (mData.liquorLoan||0) + (mData.deliveryFee||0);

    // [C] 인건비 (예상치에 일할 적용)
    const estimatedStaffCostFull = getEstimatedStaffCost(monthStr);
    const appliedStaffCost = Math.floor(estimatedStaffCostFull * ratio);

    // 최종 보정된 비용 합계
    // = 변동비(실비) + 시간비례고정비(일할) + 실비성고정비(100%) + 인건비(일할)
    const appliedTimeBased = Math.floor(timeBasedFixedRaw * ratio);
    const totalCurrentCost = variableCostTotal + appliedTimeBased + actualBasedFixed + appliedStaffCost;

    const netProfit = sales.total - totalCurrentCost;
    const margin = sales.total > 0 ? ((netProfit / sales.total) * 100).toFixed(1) : 0;

    // 3. UI 업데이트
    document.getElementById('predTotalSales').textContent = sales.total.toLocaleString() + '원';
    document.getElementById('predTotalCost').textContent = totalCurrentCost.toLocaleString() + '원';
    
    const profitEl = document.getElementById('predNetProfit');
    profitEl.textContent = netProfit.toLocaleString() + '원';
    profitEl.style.color = netProfit >= 0 ? '#fff' : '#ffab91';
    document.getElementById('predMargin').textContent = `보정 마진율: ${margin}%`;

    // 4. 차트 렌더링
    // [NEW] 매출 차트 (그룹화된 데이터 사용)
    renderGroupedSalesChart('predSalesChart', sales);

    // 비용 리스트 (계산된 값 전달)
    // renderCostList 함수가 비율을 내부에서 곱해버리므로, 
    // 여기서는 '이미 계산된 값'을 표시하기 위해 커스텀 객체를 만들어 전달하거나 
    // renderCostList를 수정해야 합니다. 
    // -> 기존 renderCostList는 비율을 무조건 곱하므로, 정확한 표시를 위해 
    //    여기서 직접 HTML을 그리는 헬퍼를 호출하거나, renderCostList에 1.0을 주고 미리 계산된 값을 넘기는 꼼수를 씁니다.
    
    // 꼼수: mData를 조작해서 넘기기보다, 새로운 비용 렌더링 함수 사용 권장.
    // 하지만 코드 수정을 최소화하기 위해 mData 복사본을 만들어 '비율 적용 안 할 항목'은 ratio 역산해서 넣기? -> 복잡함.
    // 결론: 직접 렌더링하는 로직을 여기에 작성 (가장 깔끔)
    
    renderPredictionCostList('predCostList', {
        meat: getVariableCostSum(monthStr, 'meat'),
        food: getVariableCostSum(monthStr, 'food'),
        etc: getVariableCostSum(monthStr, 'etc'),
        rent: Math.floor((mData.rent||0) * ratio),
        staff: appliedStaffCost,
        delivery: mData.deliveryFee || 0, // 100%
        liquor: (mData.liquor||0) + (mData.makgeolli||0) + (mData.beverage||0) + (mData.liquorLoan||0), // 100%
        utility: Math.floor(((mData.utility||0) + (mData.gas||0)) * ratio),
        others: Math.floor(((mData.businessCard||0) + (mData.taxAgent||0) + (mData.tax||0) + (mData.tableOrder||0) + (mData.etc_fixed||0) + (mData.foodWaste||0) + (mData.disposable||0)) * ratio)
    }, sales.total, totalCurrentCost);

    // 분석 HTML 생성
    const analysisContainer = document.getElementById('predDetailAnalysis');
    if (analysisContainer) {
        // 주류 매출 등도 일할 계산 할지 말지 결정 필요하나, 보통 매출은 실적이므로 100% 씁니다.
        // 다만 고정비(Liquor Cost)를 100% 썼으므로 매출도 100% 써야 원가율이 맞습니다.
        const alcoholSales = mData.alcoholSales || 0;
        const beverageSales = mData.beverageSales || 0;
        const liquorCost = (mData.liquor||0) + (mData.makgeolli||0) + (mData.liquorLoan||0);
        const beverageCost = mData.beverage || 0;
        const deliveryFee = mData.deliveryFee || 0;

        analysisContainer.innerHTML = generateDetailAnalysisHtml(
            sales.total, variableCostTotal, deliverySalesTotal,
            alcoholSales, beverageSales, 
            liquorCost, beverageCost, deliveryFee
        );
    }
}

// [HELPER] 변동비 합계 구하기
function getVariableCostSum(monthStr, type) {
    let sum = 0;
    if (accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if (date.startsWith(monthStr)) {
                sum += (accountingData.daily[date][type] || 0);
            }
        });
    }
    return sum;
}

// [NEW] 그룹화된 매출 차트 렌더링 (공통 사용)
function renderGroupedSalesChart(containerId, sales) {
    const el = document.getElementById(containerId);
    if(!el) return;
    
    if(sales.total === 0) { 
        el.innerHTML = '<div style="text-align:center; color:#999; padding:10px;">데이터 없음</div>'; 
        return; 
    }

    const renderBar = (l, v, c) => v > 0 ? 
        `<div class="bar-row">
            <div class="bar-label">${l}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.max((v/sales.total)*100,1)}%; background:${c};"></div></div>
            <div class="bar-value">${v.toLocaleString()}</div>
        </div>` : '';

    el.innerHTML = `
        ${renderBar('💳 카드', sales.card, '#42a5f5')}
        ${renderBar('🛵 배달', sales.delivery, '#2ac1bc')}
        ${renderBar('💵 현금', sales.cash, '#66bb6a')}
        ${renderBar('🎫 기타', sales.gift, '#ffa726')}
    `;
}

// [NEW] 예상 비용 리스트 렌더링 (계산된 값 그대로 출력)
function renderPredictionCostList(containerId, costs, salesTotal, totalCost) {
    const el = document.getElementById(containerId);
    if(!el) return;
    
    // 항목 정의 (값은 이미 계산되어 넘어옴)
    const meatLabel = (currentStore === 'yangeun') ? '🍞 SPC유통' : '🥩 한강유통';
    const items = [
        { label: meatLabel, val: costs.meat, color: '#ef5350' },
        { label: '🥬 삼시세끼', val: costs.food, color: '#8d6e63' },
        { label: '🛵 배달수수료', val: costs.delivery, color: '#00bcd4' }, // 100%
        { label: '🍶 주류/대출', val: costs.liquor, color: '#ce93d8' }, // 100%
        { label: '👥 인건비(N)', val: costs.staff, color: '#ba68c8' },
        { label: '🏠 임대료(N)', val: costs.rent, color: '#ab47bc' },
        { label: '💡 관리/공과(N)', val: costs.utility, color: '#e1bee7' },
        { label: '🎸 기타/잡비', val: costs.etc + costs.others, color: '#78909c' }
    ].sort((a,b) => b.val - a.val);

    let html = '';
    items.forEach(item => {
        if (item.val > 0) {
            const widthPct = Math.max((item.val / totalCost) * 100, 1);
            const textPct = salesTotal > 0 ? ((item.val / salesTotal) * 100).toFixed(1) : '0.0';
            html += `
            <div class="bar-row">
                <div class="bar-label">${item.label}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${widthPct}%; background:${item.color};"></div></div>
                <div class="bar-value">${item.val.toLocaleString()} <span style="font-size:11px; color:#999;">(${textPct}%)</span></div>
            </div>`;
        }
    });
    el.innerHTML = html;
}

/* renderDashboardStats (월간 분석) 함수도 그룹화된 차트를 쓰도록 수정 */
function renderDashboardStats() {
    const monthStr = getMonthStr(currentDashboardDate);
    const mData = (accountingData.monthly && accountingData.monthly[monthStr]) ? accountingData.monthly[monthStr] : {};
    
    // 매출 집계 (그룹화)
    let sales = { card:0, cash:0, delivery:0, gift:0, total:0 };
    let variableCostTotal = 0; 

    if (accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if (date.startsWith(monthStr)) {
                const d = accountingData.daily[date];
                sales.card += (d.card||0); 
                sales.cash += (d.cash||0);
                sales.gift += (d.gift||0);
                
                // 배달 통합
                const dayDelivery = (d.baemin||0) + (d.yogiyo||0) + (d.coupang||0);
                sales.delivery += dayDelivery;
                
                variableCostTotal += (d.cost || 0);
            }
        });
    }
    sales.total = sales.card + sales.cash + sales.delivery + sales.gift;
    
    const staffCost = getEstimatedStaffCost(monthStr);
    const fixedTotal = (mData.rent||0) + (mData.utility||0) + (mData.gas||0) + (mData.liquor||0) + (mData.makgeolli||0)
                     + (mData.beverage||0) + (mData.etc_fixed||0) + staffCost
                     + (mData.disposable||0) + (mData.businessCard||0) + (mData.taxAgent||0) 
                     + (mData.tax||0) + (mData.foodWaste||0) + (mData.tableOrder||0) + (mData.liquorLoan||0)
                     + (mData.deliveryFee||0);

    const totalCost = fixedTotal + variableCostTotal;
    const netProfit = sales.total - totalCost;
    const margin = sales.total > 0 ? ((netProfit / sales.total) * 100).toFixed(1) : 0;

    // UI 업데이트
    document.getElementById('dashTotalSales').textContent = sales.total.toLocaleString() + '원';
    document.getElementById('dashTotalCost').textContent = totalCost.toLocaleString() + '원';
    
    const profitEl = document.getElementById('dashNetProfit');
    profitEl.textContent = netProfit.toLocaleString() + '원';
    profitEl.style.color = netProfit >= 0 ? '#fff' : '#ffab91'; 
    document.getElementById('dashMargin').textContent = `순이익률: ${margin}%`;
    document.getElementById('dashStaffCost').textContent = staffCost.toLocaleString();

    let bepMsg = netProfit > 0 ? `🎉 흑자 달성! (+${netProfit.toLocaleString()}원)` : `⚠️ 손익분기까지 ${Math.abs(netProfit).toLocaleString()}원 남음`;
    document.getElementById('dashBreakEven').textContent = bepMsg;

    // 차트 렌더링 (공통 함수 사용)
    renderGroupedSalesChart('salesBreakdownChart', sales);
    
    // 비용 리스트 (기존 함수 재사용 - Ratio 1.0)
    renderCostList('costBreakdownList', mData, staffCost, 1.0, sales.total, totalCost, monthStr);

    // 상세 분석 HTML
    const analysisContainer = document.getElementById('dashDetailAnalysis');
    if (analysisContainer) {
        const alcoholSales = mData.alcoholSales || 0;
        const beverageSales = mData.beverageSales || 0;
        const liquorCost = (mData.liquor || 0) + (mData.makgeolli || 0) + (mData.liquorLoan || 0);
        const beverageCost = mData.beverage || 0;
        const deliveryFee = mData.deliveryFee || 0;

        analysisContainer.innerHTML = generateDetailAnalysisHtml(
            sales.total, variableCostTotal, sales.delivery, // sales.delivery 전달
            alcoholSales, beverageSales, 
            liquorCost, beverageCost, deliveryFee
        );
    }
}

// [헬퍼: 비용 리스트 그래프]
function renderCostList(containerId, mData, staffCost, ratio, salesTotal, totalCost, monthStr) {
    const el = document.getElementById(containerId);
    if(!el) return;
    
    if(totalCost === 0) { el.innerHTML = '<div style="text-align:center; padding:10px; color:#999;">데이터 없음</div>'; return; }

    let cMeat = 0, cFood = 0, cEtc = 0;
    if (accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if (date.startsWith(monthStr)) {
                cMeat += (accountingData.daily[date].meat||0);
                cFood += (accountingData.daily[date].food||0);
                cEtc += (accountingData.daily[date].etc||0);
            }
        });
    }

    const fRent = Math.floor((mData.rent||0) * ratio);
    const fStaff = Math.floor(staffCost * ratio);
    const fLiquor = Math.floor(((mData.liquor||0) + (mData.makgeolli||0) + (mData.beverage||0)) * ratio);
    const fUtility = Math.floor(((mData.utility||0) + (mData.gas||0)) * ratio);
    const fLoan = Math.floor((mData.liquorLoan||0) * ratio);
    const fDelivery = Math.floor((mData.deliveryFee||0) * ratio);
    const fOthers = Math.floor(((mData.businessCard||0) + (mData.taxAgent||0) + (mData.tax||0) + (mData.tableOrder||0) + (mData.etc_fixed||0) + (mData.disposable||0) + (mData.foodWaste||0)) * ratio);

    const meatLabel = (currentStore === 'yangeun') ? '🍞 SPC유통' : '🥩 한강유통';
    const etcLabel = (currentStore === 'yangeun') ? '🦪 막걸리/굴' : '🍦 일일잡비';

    const items = [
        { label: meatLabel, val: cMeat, color: '#ef5350' },
        { label: '🥬 삼시세끼', val: cFood, color: '#8d6e63' },
        { label: etcLabel, val: cEtc, color: '#78909c' },
        { label: '🏠 임대료', val: fRent, color: '#ab47bc' },
        { label: '👥 인건비', val: fStaff, color: '#ba68c8' },
        { label: '🛵 배달대행', val: fDelivery, color: '#00bcd4' },
        { label: '🍶 대출/주류/막걸리', val: fLoan + fLiquor, color: '#ce93d8' },
        { label: '💡 기타고정', val: fUtility + fOthers, color: '#e1bee7' }
    ].sort((a,b) => b.val - a.val);

    let html = '';
    items.forEach(item => {
        if (item.val > 0) {
            const widthPct = Math.max((item.val / totalCost) * 100, 1);
            const textPct = salesTotal > 0 ? ((item.val / salesTotal) * 100).toFixed(1) : '0.0';
            html += `
            <div class="bar-row">
                <div class="bar-label">${item.label}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${widthPct}%; background:${item.color};"></div></div>
                <div class="bar-value">${item.val.toLocaleString()} <span style="font-size:11px; color:#999;">(${textPct}%)</span></div>
            </div>`;
        }
    });
    el.innerHTML = html;
}

// [헬퍼: 매출 차트]
function renderDashboardCharts(sales, totalCost, mData, staffCost, variableCostTotal, monthStr) {
    const chartEl = document.getElementById('salesBreakdownChart');
    if(chartEl) {
        if(sales.total === 0) chartEl.innerHTML = '<div style="text-align:center; color:#999;">데이터 없음</div>';
        else {
            const renderBar = (l, v, c) => v > 0 ? `<div class="bar-row"><div class="bar-label">${l}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max((v/sales.total)*100,1)}%; background:${c};"></div></div><div class="bar-value">${v.toLocaleString()}</div></div>` : '';
            
            // [수정] 차트에서도 계좌이체 제거 (매출 아님)
            if (currentStore === 'yangeun') {
                chartEl.innerHTML = `
                    ${renderBar('💳 카드', sales.card, '#42a5f5')}
                    ${renderBar('🛵 배민', sales.baemin, '#2ac1bc')}
                    ${renderBar('🛵 요기요', sales.yogiyo, '#fa0050')}
                    ${renderBar('🛵 쿠팡', sales.coupang, '#00a5ff')}
                    ${renderBar('💵 현금', sales.cash, '#66bb6a')}`;
            } else {
                chartEl.innerHTML = `
                    ${renderBar('💳 카드', sales.card, '#42a5f5')}
                    ${renderBar('💵 현금', sales.cash, '#66bb6a')}
                    ${renderBar('🎫 기타', sales.gift, '#ffa726')}`;
            }
        }
    }
    renderCostList('costBreakdownList', mData, staffCost, 1.0, sales.total, totalCost, monthStr);
}

// ==========================================
// 5. 직원 관리 (조회/등록/수정/삭제)
// ==========================================

async function loadStaffData() {
    try {
        const res = await fetch(`/api/staff?store=${currentStore}`);
        const json = await res.json();
        staffList = json.data;
        
        // 데이터 로드 후 각 뷰 렌더링 (화면에는 현재 활성화된 탭만 보임)
        renderDailyView();
        renderWeeklyView();
        renderMonthlyView();
        renderManageList();
        
    } catch(e) { console.error("데이터 로드 실패"); }
}

function renderManageList() {
    const list = document.getElementById('manageStaffList');
    if(!list) return;
    
    // 1. 월 타이틀 업데이트
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
    
    // 2. 현재 선택된 월의 시작/끝 날짜 계산
    const y = currentManageDate.getFullYear();
    const m = currentManageDate.getMonth();
    const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
    const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];

    // 3. 필터링: 해당 월에 근무 기록이 있거나(재직 중), 기간이 겹치는 직원만 표시
    const filteredStaff = staffList.filter(s => {
        // 근무 기간이 설정되지 않았다면 -> 항상 표시 (또는 현재 재직자로 간주)
        if (!s.startDate && !s.endDate) return true;
        
        // 입사일이 월말보다 늦으면 (아직 입사 안함) -> 제외
        if (s.startDate && s.startDate > lastDay) return false;
        
        // 퇴사일이 월초보다 빠르면 (이미 퇴사함) -> 제외
        if (s.endDate && s.endDate < firstDay) return false;
        
        return true;
    });

    // 4. 중복 직원 감지 (전체 리스트 기준이 아니라, 현재 화면에 보이는 사람 기준일 수도 있지만 전체로 체크 추천)
    const nameCount = {};
    staffList.forEach(s => { nameCount[s.name] = (nameCount[s.name] || 0) + 1; });
    
    if (isAdmin) {
        const duplicates = Object.keys(nameCount).filter(name => nameCount[name] > 1);
        if (duplicates.length > 0) {
            // [수정] onclick을 HTML에 직접 넣어 이벤트 바인딩 문제 해결
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

        // 퇴사자 표시
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
    
    // [추가] 사장님(admin) 권한 체크 로직
    if (currentUser.role !== 'admin') {
        alert("직원삭제는 카톡으로 요청하세요");
        return;
    }

    if (!confirm('정말로 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.')) return;
    
    try {
        await fetch(`/api/staff/${id}?actor=${encodeURIComponent(currentUser.name)}&store=${currentStore}`, { method: 'DELETE' });
        loadStaffData();
        // admin 체크는 위에서 했으므로 로그 로드는 무조건 실행
        loadLogs(); 
    } catch(e) {
        alert('삭제 중 오류가 발생했습니다.');
    }
}

// 중복 직원 병합 모달 열기
// [수정] 모달 열기 함수 (window 객체에 할당하여 확실히 호출되게 함)
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
        // [중요] 최신 입사일 혹은 최근 ID 순으로 정렬하여 '메인'을 정함
        sameNameStaff.sort((a,b) => b.id - a.id);
        const keeper = sameNameStaff[0]; // 가장 최근에 등록된/수정된 사람을 keeper로

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
    console.log('❌ closeMergeModal 호출됨');
    const modal = document.getElementById('mergeModalOverlay');
    if (modal) {
        modal.style.display = 'none';
    }
}

// [수정] 병합 실행 함수 (핵심 로직 수정)
// [수정] 병합 실행 함수 (근무 요일 및 기록 통합 강화)
window.mergeStaffByName = async function(name) {
    const sameNameStaff = staffList.filter(s => s.name === name);
    if (sameNameStaff.length < 2) return;

    if (!confirm(`${name}님의 중복 데이터를 하나로 합치시겠습니까?\n\n모든 근무 요일과 기록이 하나로 통합됩니다.`)) return;

    // 1. 기준 직원 선정 (가장 최근 ID를 기준으로 하되, 근무 시작일이 명시된 직원을 우선)
    sameNameStaff.sort((a, b) => {
        if (a.startDate && !b.startDate) return -1;
        if (!a.startDate && b.startDate) return 1;
        return b.id - a.id; // ID 역순 (최신 등록이 위로)
    });
    
    const keeper = sameNameStaff[0];
    const deletables = sameNameStaff.slice(1);

    // 2. 데이터 통합 준비
    let combinedExceptions = { ...keeper.exceptions };
    
    // [핵심 수정 1] 근무 요일(workDays) 통합을 위한 Set 생성 (중복 제거)
    let combinedWorkDays = new Set(keeper.workDays || []);

    let earliestStart = keeper.startDate;
    let latestEnd = keeper.endDate;

    deletables.forEach(s => {
        // A. 근무 기록(Exceptions) 통합
        if (s.exceptions) {
            // 날짜(Key)가 다르면 추가되고, 같으면 덮어씌워짐
            combinedExceptions = { ...combinedExceptions, ...s.exceptions };
        }
        
        // B. [핵심 수정 2] 고정 근무 요일 통합
        if (s.workDays && Array.isArray(s.workDays)) {
            s.workDays.forEach(day => combinedWorkDays.add(day));
        }
        
        // C. 날짜 범위 확장 (가장 빠른 입사일 ~ 가장 늦은 퇴사일)
        if (s.startDate && (!earliestStart || s.startDate < earliestStart)) earliestStart = s.startDate;
        if (s.endDate && (!latestEnd || s.endDate > latestEnd)) latestEnd = s.endDate;
    });

    // Set을 다시 배열로 변환
    const finalWorkDays = Array.from(combinedWorkDays);

    // 3. 급여 정보 결정 (Keeper의 급여가 0원이라면 다른 데이터에서 가져옴)
    let finalSalary = keeper.salary;
    let finalSalaryType = keeper.salaryType;
    
    // Keeper 급여가 없는데 삭제될 데이터에 급여가 있다면 그것을 사용
    if (!finalSalary && deletables.some(s => s.salary > 0)) {
        const salarySource = deletables.find(s => s.salary > 0);
        finalSalary = salarySource.salary;
        finalSalaryType = salarySource.salaryType;
    }

    const updates = {
        startDate: earliestStart,
        endDate: latestEnd,
        exceptions: combinedExceptions, // 일별 기록 통합
        workDays: finalWorkDays,        // [NEW] 요일 통합 적용
        salary: finalSalary,
        salaryType: finalSalaryType
    };

    try {
        // 4. Keeper 업데이트 API 호출
        await fetch(`/api/staff/${keeper.id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ updates, actor: currentUser.name, store: currentStore })
        });

        // 5. 나머지 삭제 API 호출
        for (const s of deletables) {
            await fetch(`/api/staff/${s.id}?actor=${encodeURIComponent(currentUser.name)}&store=${currentStore}`, { method: 'DELETE' });
        }

        alert(`병합 완료!\n총 ${finalWorkDays.length}개의 요일과 근무 기록이 통합되었습니다.`);
        window.closeMergeModal(); // 모달 닫기 명시적 호출
        loadStaffData(); // 리스트 갱신

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

// [수정] 일별 보기 렌더링 (임시 휴무 시각화)
// staff.js - renderDailyView 함수 교체

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
        // [입퇴사 체크] 해당 날짜가 직원의 근무 기간 내인지 확인 (문자열 직접 비교)
        // 입사일 체크: 입사일 이전이면 제외
        if (staff.startDate && dateStr < staff.startDate) return;
        
        // 퇴사일 체크: 퇴사일 이후면 제외
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
    
    // [수정] 8명 이상(과다) 또는 6명 이하(부족) 경고 표시
    const badge = document.getElementById('dailyCountBadge');
    if(badge) {
        // 기본 스타일
        badge.style.background = '#ff5722'; 
        
        if (realWorkCount >= 8) {
            // 인원 과다 -> 빨강
            badge.style.background = '#d32f2f';
            badge.innerHTML = `총 ${realWorkCount}명 근무<br><span style="font-size:11px; background:white; color:#d32f2f; padding:2px 5px; border-radius:4px; margin-top:4px; display:inline-block;">⚠️ 인원 과다 (비용 확인)</span>`;
        } else if (realWorkCount > 0 && realWorkCount <= 6) {
            // 인원 부족 -> 주황/빨강 계열
            badge.style.background = '#e65100'; 
            badge.innerHTML = `총 ${realWorkCount}명 근무<br><span style="font-size:11px; background:white; color:#e65100; padding:2px 5px; border-radius:4px; margin-top:4px; display:inline-block;">⚠️ 인원 부족? (확인)</span>`;
        } else {
            // 정상 (7명 등)
            badge.textContent = `총 ${realWorkCount}명 근무`;
        }
    }
    
    // 정렬
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

// [수정] 주간 뷰 렌더링 (임시 휴무 시각화)
function renderWeeklyView() {
    // ... (날짜 계산 로직 기존 동일) ...
    const startWeek = new Date(currentWeekStartDate);
    const endWeek = new Date(currentWeekStartDate);
    endWeek.setDate(endWeek.getDate() + 6);
    
    const rangeDisplay = document.getElementById('weeklyRangeDisplay');
    if(rangeDisplay) rangeDisplay.textContent = `${startWeek.getMonth()+1}월 ${startWeek.getDate()}일 ~ ${endWeek.getMonth()+1}월 ${endWeek.getDate()}일`;

    const realToday = new Date(); 

    // 주간 헤더에 날짜 업데이트
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
            // [입퇴사 체크] 해당 날짜가 직원의 근무 기간 내인지 확인 (문자열 직접 비교)
            // 입사일 체크: 입사일 이전이면 제외
            if (s.startDate && dateStr < s.startDate) return;
            
            // 퇴사일 체크: 퇴사일 이후면 제외
            if (s.endDate && dateStr > s.endDate) return;
            
            let isWorking = false;
            let workTime = s.time;
            let isException = false;
            let isOff = false;

            if (s.exceptions && s.exceptions[dateStr]) {
                const ex = s.exceptions[dateStr];
                if (ex.type === 'work') { isWorking = true; workTime = ex.time; isException = true; }
                else if (ex.type === 'off') { isWorking = true; isOff = true; } // 표시를 위해 true
            } else {
                if (s.workDays.includes(dayKey)) isWorking = true;
            }
            if (isWorking) dayWorkers.push({ staff: s, time: workTime, isException, isOff });
        });

        // 정렬
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

// [추가] 시간 변경 모달 열기
function openTimeChangeModal(id, dateStr, currentStr) {
    if (!currentUser) { openLoginModal(); return; }
    
    // 시간 옵션 생성 (staff.js 초기화 시점에 initTimeOptions가 실행되어 있어야 함. 
    // 하지만 모달이 새로 생겼으므로 여기서 옵션을 다시 채워주거나 전역으로 관리해야 함.
    // 간단하게 여기서 옵션 생성 로직을 호출해줍니다.)
    initTimeChangeOptions(); 

    document.getElementById('timeChangeId').value = id;
    document.getElementById('timeChangeDate').value = dateStr;
    document.getElementById('timeChangeModal').style.display = 'flex';
    
    // 현재 시간 파싱해서 선택해주면 좋겠지만, 일단 기본값으로 둡니다.
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
        if(el && el.children.length === 0) { // 비어있을 때만 채움
            el.innerHTML = html;
            if(id === 'tcStartHour') el.value = "18";
            if(id === 'tcEndHour') el.value = "23";
        }
    });
}

// [추가] 시간 변경 저장
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

// [추가] 예외(휴무 등) 취소 함수
async function cancelException(id, dateStr) {
    if(!confirm('휴무 설정을 취소하고 원래 근무로 되돌리시겠습니까?')) return;
    
    try {
        // [수정] DELETE 메서드가 아니라 POST 메서드에 type: 'delete'로 전송
        await fetch('/api/staff/exception', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                id: id, 
                date: dateStr, 
                type: 'delete',  // ✅ 이 타입이 서버에서 예외를 삭제하도록 함
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


function changeWeek(weeks) { currentWeekStartDate.setDate(currentWeekStartDate.getDate() + (weeks * 7)); renderWeeklyView(); }
function resetToThisWeek() {
    const today = new Date();
    const day = today.getDay();
    currentWeekStartDate = new Date(today);
    currentWeekStartDate.setDate(today.getDate() - day);
    renderWeeklyView();
}

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
            // [입퇴사 체크] 해당 날짜가 직원의 근무 기간 내인지 확인 (문자열 직접 비교)
            // 입사일 체크: 입사일 이전이면 제외
            if (staff.startDate && dateStr < staff.startDate) return;
            
            // 퇴사일 체크: 퇴사일 이후면 제외
            if (staff.endDate && dateStr > staff.endDate) return;
            
            let isWorking = false;
            // 예외처리 로직 (날짜별)
            if (staff.exceptions && staff.exceptions[dateStr]) {
                if (staff.exceptions[dateStr].type === 'work') isWorking = true;
            } else {
                if (staff.workDays.includes(dayKey)) isWorking = true;
            }
            // 월별 뷰는 간단하게 근무 여부만 카운트
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

        // [수정] 근무자 수에 따른 스타일 지정 (6명 이하 or 8명 이상 -> 빨간색 강조)
        let countStyle = 'background: #e3f2fd; color: #1565c0;'; // 기본 파란색
        if (count > 0 && (count <= 6 || count >= 8)) {
            // 경고 스타일 (배경 연한 빨강, 글씨 진한 빨강)
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

// 캘린더에서 날짜 클릭 시 이동하는 함수도 수정 필요 (daily로 탭 전환 시 서브탭 처리)
function goToDailyDetail(year, month, day) { 
    currentDate = new Date(year, month, day); 
    
    // 1. 메인 탭은 'attendance'로
    switchTab('attendance');
    
    // 2. 서브 탭 버튼 찾아서 클릭 트리거 (일별 탭 활성화)
    const dailyBtn = document.querySelector('button[onclick*="att-daily"]');
    if(dailyBtn) switchAttSubTab('att-daily', dailyBtn);
}

// ==========================================
// 7. 기타 기능 (급여/로그/예외처리)
// ==========================================

// [수정] 현재 선택된 월(currentManageDate)을 기준으로 급여 계산
function calculateMonthlySalary() {
    // 1. 기준 날짜 설정 (현재 보고 있는 달)
    const targetDate = currentManageDate; 
    
    // [수정 포인트] now 대신 targetDate 사용
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth(); // 0 ~ 11
    
    // 모달 제목 업데이트
    const modalTitle = document.querySelector('#salaryModal h2');
    if(modalTitle) modalTitle.textContent = `💰 ${year}년 ${month + 1}월 예상 급여`;

    const lastDayObj = new Date(year, month + 1, 0);
    const totalDaysInMonth = lastDayObj.getDate(); 
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    let salaryReport = [];

    staffList.forEach(s => {
        // 입/퇴사일 체크를 위한 날짜 객체 변환
        const sDate = s.startDate ? new Date(s.startDate) : null;
        const eDate = s.endDate ? new Date(s.endDate) : null;
        
        // 해당 날짜(checkDate)에 재직 중인지 확인하는 함수
        const isEmployedAt = (checkDate) => {
            const t = new Date(checkDate); t.setHours(0,0,0,0);
            if (sDate) { const start = new Date(sDate); start.setHours(0,0,0,0); if (t < start) return false; }
            if (eDate) { const end = new Date(eDate); end.setHours(0,0,0,0); if (t > end) return false; }
            return true;
        };

        // 1. 월급제 계산
        if (s.salaryType === 'monthly') {
            let employedDays = 0;
            let statusText = '만근';

            // 해당 월의 1일부터 말일까지 루프
            for (let d = 1; d <= totalDaysInMonth; d++) {
                const currentDay = new Date(year, month, d);
                if (isEmployedAt(currentDay)) employedDays++;
            }

            let finalPay = s.salary || 0;
            // 만근이 아니면 일할 계산
            if (employedDays < totalDaysInMonth) {
                finalPay = Math.floor((s.salary / totalDaysInMonth) * employedDays);
                statusText = `${employedDays}일 재직 (일할)`;
            }

            salaryReport.push({ name: s.name, type: '월급', workCount: statusText, totalHours: '-', amount: finalPay });
            return;
        }

        // 2. 시급제 계산
        let totalHours = 0;
        let workCount = 0;
        
        for (let d = 1; d <= totalDaysInMonth; d++) {
            const currentDate = new Date(year, month, d);
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dayKey = dayMap[currentDate.getDay()];
            
            // 재직 기간이 아니면 스킵
            if (!isEmployedAt(currentDate)) continue;

            let isWorking = false;
            let timeStr = s.time;

            // 예외 근무(대타, 휴무) 우선 적용
            if (s.exceptions && s.exceptions[dateStr]) {
                const ex = s.exceptions[dateStr];
                if (ex.type === 'work') { isWorking = true; timeStr = ex.time; }
                else if (ex.type === 'off') { isWorking = false; }
            } else {
                // 고정 근무 요일 확인
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

    // 결과 렌더링
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

// 2. (UPDATE) getEstimatedStaffCost: 특정 직원 리스트를 받아서 계산하도록 수정
// (기존에는 전역 staffList만 썼지만, 이제는 인자로 데이터를 받습니다)
function getEstimatedStaffCost(monthStr, targetStaffList = null) {
    // targetStaffList가 없으면 현재 페이지의 staffList 사용 (하위 호환)
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

// [기존 addTempWorker 함수는 삭제하거나 주석 처리하시고 아래 코드를 사용하세요]

// 1. 시간 선택 옵션 생성 (00~30시 등 넉넉하게 생성)
function initTimeOptions() {
    const hours = [];
    // 0시부터 30시(다음날 새벽 6시)까지 생성 (야간 영업 고려)
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
        startEl.value = "18"; // 기본값 18시
    }
    if(endEl) {
        endEl.innerHTML = html;
        endEl.value = "23"; // 기본값 23시
    }
}

// 페이지 로드 시 시간 옵션 초기화 실행
document.addEventListener('DOMContentLoaded', () => {
    initTimeOptions();
});

// 2. 모달 열기 (직원 리스트 자동완성 추가)
function addTempWorker() {
    if (!currentUser) { openLoginModal(); return; }
    
    // 입력창 초기화
    document.getElementById('tempName').value = '';
    document.getElementById('tempSalary').value = '10000'; 
    
    const dataList = document.getElementById('staffNameList');
    if (dataList && typeof staffList !== 'undefined') {
        // [수정] 월급(monthly) 직원은 제외하고, 시급(hourly) 알바만 필터링해서 보여줌
        const options = staffList
            .filter(s => s.salaryType !== 'monthly') // 월급 직원 제외
            .map(s => `<option value="${s.name}">`)
            .join('');
        
        dataList.innerHTML = options;
    }

    document.getElementById('tempWorkerModal').style.display = 'flex';
}

function closeTempModal() {
    document.getElementById('tempWorkerModal').style.display = 'none';
}

// [staff.js] autoFillSalary 함수 수정 (맨 아래쪽에 있음)

function autoFillSalary(inputName) {
    if (!inputName) return;

    // [수정] 이름이 같아도, "현재 일하고 있는(퇴사일이 안 지난)" 기록을 우선적으로 찾음
    const todayStr = new Date().toISOString().split('T')[0];
    
    const target = staffList.find(s => {
        if (s.name !== inputName) return false;
        
        // 퇴사일(endDate)이 존재하고, 그게 오늘보다 전이면 -> 이미 퇴사한 기록(제외)
        if (s.endDate && s.endDate < todayStr) return false;
        
        // 아직 입사 안 한 미래의 기록도 제외하고 싶다면 아래 주석 해제 (보통은 냅둬도 됨)
        // if (s.startDate && s.startDate > todayStr) return false;

        return true;
    });

    // 만약 활성 기록을 못 찾았으면 그냥 이름 같은 아무나(가장 최근 등록된) 찾음 (혹시 모르니)
    const finalTarget = target || staffList.find(s => s.name === inputName);

    if (finalTarget && finalTarget.salary) {
        document.getElementById('tempSalary').value = finalTarget.salary;
    }
}

// 4. 저장하기 (서버 통신)
// [수정] 일일 대타/추가 등록 (중복 방지 로직 적용)
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

    // 1. 정확히 같은 이름이 있는지 확인
    const existingStaff = staffList.find(s => s.name === name);

    if (existingStaff) {
        // 2. 동일 이름 발견 → 확인 창
        const isExisting = confirm(
            `⚠️ "${name}"님과 동일한 이름이 이미 있습니다.\n\n` +
            `✅ [확인] → 기존 인원에 오늘 근무 추가\n` +
            `❌ [취소] → 동명이인으로 별도 등록 (${name}1, ${name}2...)`
        );
        
        if (isExisting) {
            // 2-A. "예" (확인) → 기존 직원에 오늘 근무 추가
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
            // 2-B. "아니요" (취소) → 동명이인 처리 (이름에 숫자 붙이기)
            const sameNameList = staffList.filter(s => 
                s.name === name || s.name.match(new RegExp(`^${name}\\d+$`))
            );
            
            // 가장 큰 숫자 찾기
            let maxNum = 0;
            sameNameList.forEach(s => {
                const match = s.name.match(/(\d+)$/);
                if (match) {
                    maxNum = Math.max(maxNum, parseInt(match[1]));
                } else if (s.name === name) {
                    maxNum = Math.max(maxNum, 0); // 숫자 없는 기본 이름
                }
            });
            
            // 새 이름 생성
            const newName = `${name}${maxNum + 1}`;
            
            if (!confirm(`동명이인으로 "${newName}"(으)로 등록하시겠습니까?`)) {
                return;
            }
            
            // 새로운 임시 직원 생성 (이름만 변경)
            await createNewTempWorker(newName, dateStr, timeStr, salary);
            return;
        }
    }

    // 3. 같은 이름 없음 → 바로 새 직원 생성
    await createNewTempWorker(name, dateStr, timeStr, salary);
}

// [신규] 새 임시 직원 생성 함수 (중복 제거)
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

// [수정] 근무/직원 관련 로그만 로드
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

            // [필터링] 직원/근무 관련 로그만 표시
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

// [신규] 매입/매출 관련 로그만 로드
async function loadAccountingLogs() {
    try {
        const res = await fetch(`/api/logs?store=${currentStore}`);
        const json = await res.json();
        const tbody = document.getElementById('accLogTableBody');
        
        if(tbody) {
            tbody.innerHTML = '';
            if (!json.data || json.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">기록이 없습니다.</td></tr>';
                return;
            }

            // [필터링] 매입/매출 관련 로그만 표시
            const accountingActions = ['매출입력', '매출수정', '매출삭제', '월간지출', '선결제충전', '선결제사용', '선결제취소'];
            const filteredLogs = json.data.filter(log => accountingActions.includes(log.action));

            if (filteredLogs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">매입/매출 관련 기록이 없습니다.</td></tr>';
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
    } catch(e) { console.error("회계 로그 로드 실패", e); }
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
            
            // 각 데이터를 별도 파일로 다운로드
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
                
                // 파일 간 다운로드 간격 (브라우저 제한 회피)
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