// staff.js - 통합 버전 (직원관리 + 가계부 고도화)

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
let currentAccDate = new Date().toISOString().split('T')[0];
let currentDashboardDate = new Date(); // 가계부 조회 기준 월
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
    const titleEl = document.getElementById('pageTitle');
    if(titleEl) titleEl.textContent = `👥 ${storeNameKr} 관리 시스템`;
    
    if (currentStore === 'yangeun') {
        const header = document.querySelector('.weekly-header');
        if(header) header.style.background = '#ff9800'; 
    }

    // [추가] 매장에 따른 가계부 UI 변경 실행
    initStoreSettings();

    // 주간 기준일 초기화
    const today = new Date();
    const day = today.getDay();
    currentWeekStartDate.setDate(today.getDate() - day);
    
    // 초기 데이터 로드
    loadStaffData();
});

// [신규 함수] 매장별 UI 세팅
function initStoreSettings() {
    // 1. 양은이네 설정
    if (currentStore === 'yangeun') {
        // [지출 라벨 변경]
        const meatLabel = document.getElementById('labelMeat');
        if (meatLabel) meatLabel.textContent = '🍞 SPC 유통';
        
        // [NEW] 기타잡비 -> 막걸리/굴 변경
        const etcLabel = document.getElementById('labelEtc');
        if (etcLabel) {
            etcLabel.textContent = '🦪 막걸리/굴';
            etcLabel.style.color = '#795548';
            etcLabel.style.fontWeight = 'bold';
        }

        // [NEW] 일회용기 입력칸 보이기
        const dispDiv = document.getElementById('divDisposable');
        if(dispDiv) dispDiv.style.display = 'block';
        
        // [매출 입력칸 변경] (기존 코드 유지)
        const salesGrid = document.getElementById('salesInputGrid');
        if (salesGrid) {
            salesGrid.innerHTML = `
                <div><span class="category-label">💳 카드 매출</span><input type="number" id="inpCard" class="money-input" placeholder="0"></div>
                <div><span class="category-label">🛵 배달의민족</span><input type="number" id="inpBaemin" class="money-input" placeholder="0"></div>
                <div><span class="category-label">🛵 요기요</span><input type="number" id="inpYogiyo" class="money-input" placeholder="0"></div>
                <div><span class="category-label">🛵 쿠팡이츠</span><input type="number" id="inpCoupang" class="money-input" placeholder="0"></div>
                <div><span class="category-label" style="color:#673ab7;">📒 선결제(장부)</span><input type="number" id="inpPrepay" class="money-input" placeholder="0" style="color:#673ab7; background:#f3e5f5;"></div>
            `;
            salesGrid.style.gridTemplateColumns = "1fr 1fr"; 
        }
    } else {
        // 2. 초가짚 설정
        // 일회용기 숨기기 (기본값 none이지만 확실하게)
        const dispDiv = document.getElementById('divDisposable');
        if(dispDiv) dispDiv.style.display = 'none';
    }
}

// ==========================================
// 2. 탭 전환 및 화면 제어
// ==========================================

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    // 메인 탭 버튼 활성화
    const targetBtn = document.querySelector(`button[onclick="switchTab('${tabName}')"]`);
    if(targetBtn) targetBtn.classList.add('active');
    
    const content = document.getElementById(`${tabName}-content`);
    if(content) content.classList.add('active');

    if(tabName === 'daily') renderDailyView();
    if(tabName === 'weekly') renderWeeklyView();
    if(tabName === 'monthly') renderMonthlyView();
    if(tabName === 'accounting') loadAccountingData();
    if(tabName === 'prepayment') loadPrepaymentData();
}

// [선결제 관련 함수들]
async function loadPrepaymentData() {
    if (!currentUser) { openLoginModal(); return; }
    document.getElementById('preDate').value = new Date().toISOString().split('T')[0];
    
    try {
        const res = await fetch('/api/prepayments');
        const json = await res.json();
        prepayData = json.data;
        renderPrepaymentUI();
    } catch(e) { console.error(e); }
}

function renderPrepaymentUI() {
    // 1. 고객 리스트 (자동완성)
    const datalist = document.getElementById('customerList');
    datalist.innerHTML = Object.keys(prepayData.customers).map(name => `<option value="${name}">`).join('');

    // 2. 잔액 테이블
    const balanceTbody = document.getElementById('preBalanceTable');
    balanceTbody.innerHTML = '';
    Object.entries(prepayData.customers).forEach(([name, info]) => {
        balanceTbody.innerHTML += `
            <tr>
                <td style="text-align:left;"><strong>${name}</strong></td>
                <td style="font-weight:bold; color:${info.balance < 0 ? 'red' : '#1976D2'};">${info.balance.toLocaleString()}원</td>
                <td style="color:#666; font-size:11px;">${info.lastUpdate}</td>
            </tr>`;
    });

    // 3. 로그 테이블
    const logTbody = document.getElementById('preLogTable');
    logTbody.innerHTML = prepayData.logs.map(log => `
        <tr>
            <td>${log.date.substring(5)}</td>
            <td><strong>${log.customerName}</strong></td>
            <td style="color:${log.type === 'charge' ? '#2e7d32' : '#d32f2f'};">${log.type === 'charge' ? '충전' : '사용'}</td>
            <td>${log.amount.toLocaleString()}</td>
            <td style="font-size:11px; color:#999;">${log.currentBalance.toLocaleString()}</td>
            <td style="font-size:11px; text-align:left;">${log.note || '-'}</td>
        </tr>
    `).join('');
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
            // 입력창 초기화 (고객명은 유지하면 연속입력 편함)
            document.getElementById('preAmount').value = '';
            document.getElementById('preNote').value = '';
        }
    } catch(e) { alert('저장 실패'); }
}

// [가계부 내부 서브탭 전환 함수 - 수정됨]
function switchAccSubTab(subTabId, btnElement) {
    // 1. 모든 서브 컨텐츠 숨기기
    document.querySelectorAll('.acc-sub-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });
    
    // 2. 버튼 스타일 초기화 (가계부 탭 내부의 버튼만)
    const subTabContainer = document.querySelector('.tabs[style*="grid-template-columns"]'); 
    if(subTabContainer) {
        subTabContainer.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
    }

    // 3. 클릭된 버튼 활성화
    if(btnElement) {
        btnElement.classList.add('active');
    } else {
        // 버튼 객체가 안 넘어왔을 경우(자동실행 등) ID로 찾아서 활성화 시도
        const matchingBtn = document.querySelector(`button[onclick*="${subTabId}"]`);
        if(matchingBtn) matchingBtn.classList.add('active');
    }

    // 4. 선택된 화면 표시 및 데이터 갱신
    const targetDiv = document.getElementById(subTabId);
    if(targetDiv) {
        targetDiv.style.display = 'block';
        targetDiv.classList.add('active');
        
        // 화면이 보인 후 데이터 갱신 (setTimeout으로 렌더링 확보)
        setTimeout(() => {
            updateDashboardUI();
        }, 0);
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
            const loginBtn = document.getElementById('loginBtn');
            if(loginBtn) loginBtn.style.display = 'none';
            
            const userInfoDiv = document.getElementById('userInfo');
            userInfoDiv.style.display = 'block';
            userInfoDiv.innerHTML = `${data.name} (${data.role === 'admin' ? '사장' : data.role === 'manager' ? '점장' : '직원'})`;
            
            if (['admin', 'manager'].includes(data.role)) {
                const manageBtn = document.getElementById('manageTabBtn');
                if(manageBtn) manageBtn.style.display = 'inline-block';
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
            const err = document.getElementById('loginError');
            err.style.display = 'block';
            err.textContent = '비밀번호가 일치하지 않습니다.';
        }
    } catch (e) { alert('서버 오류'); }
}

// ==========================================
// 4. 가계부 (매출/지출/통계) 로직
// ==========================================

// 날짜 포맷 헬퍼 (YYYY-MM)
function getMonthStr(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

// 월 변경 네비게이션
function changeAccMonth(delta) {
    currentDashboardDate.setMonth(currentDashboardDate.getMonth() + delta);
    loadAccountingData(); 
}

function resetAccMonth() {
    currentDashboardDate = new Date();
    loadAccountingData();
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
        // 데이터가 없어도 안전하게 초기화
        accountingData = json.data || { daily: {}, monthly: {} };
        if(!accountingData.daily) accountingData.daily = {};
        if(!accountingData.monthly) accountingData.monthly = {};
        
        updateDashboardUI();
    } catch(e) { console.error('회계 로드 실패', e); }
}

// 통합 UI 업데이트 (탭 전환/월 이동 시 호출됨)
// 1. UI 업데이트 함수 (탭 전환 시 호출됨) - acc-history 케이스 추가
function updateDashboardUI() {
    const monthStr = getMonthStr(currentDashboardDate);
    const [y, m] = monthStr.split('-');
    
    // 헤더 텍스트 업데이트
    const titleEl = document.getElementById('dashboardTitle');
    if(titleEl) titleEl.textContent = `${y}년 ${m}월`;
    const fixTitle = document.getElementById('fixCostTitle');
    if(fixTitle) fixTitle.textContent = `${m}월`;
    const fixBtn = document.getElementById('fixBtnMonth');
    if(fixBtn) fixBtn.textContent = `${m}월`;

    // 활성화된 서브탭 확인
    const activeSubTab = document.querySelector('.acc-sub-content.active');
    
    if (!activeSubTab) {
        switchAccSubTab('acc-daily');
        return; 
    }

    if (activeSubTab.id === 'acc-daily') {
        // 일일 입력 탭: 특별히 로드할 것 없음 (날짜 선택 시 로드됨)
    } 
    else if (activeSubTab.id === 'acc-history') {
        // [NEW] 내역 탭: 테이블 데이터 로드
        loadHistoryTable();
    }
    // [NEW] 예상 순익 탭 추가
    else if (activeSubTab.id === 'acc-prediction') {
        renderPredictionStats();
    }
    else if (activeSubTab.id === 'acc-dashboard') {
        renderDashboardStats();
    } 
    else if (activeSubTab.id === 'acc-monthly') {
        loadMonthlyForm();
    }
}

// [서브탭 1] 일일 데이터 로드/저장
// [JS 수정 1] 데이터 불러오기: 시재금과 입금액도 불러오도록 수정
function loadDailyAccounting() {
    const datePicker = document.getElementById('accDate').value;
    if (!datePicker) return;

    const dayData = (accountingData.daily && accountingData.daily[datePicker]) ? accountingData.daily[datePicker] : {};
    
    // [수정] 공통 필드
    if(document.getElementById('inpCard')) document.getElementById('inpCard').value = dayData.card || '';
    if(document.getElementById('inpTransfer')) document.getElementById('inpTransfer').value = dayData.transfer || '';
    // 선결제 추가
    if(document.getElementById('inpPrepay')) document.getElementById('inpPrepay').value = dayData.prepay || ''; 
    
    // [수정] 매장별 필드 분기 처리
    if (currentStore === 'yangeun') {
        if(document.getElementById('inpBaemin')) document.getElementById('inpBaemin').value = dayData.baemin || '';
        if(document.getElementById('inpYogiyo')) document.getElementById('inpYogiyo').value = dayData.yogiyo || '';
        if(document.getElementById('inpCoupang')) document.getElementById('inpCoupang').value = dayData.coupang || '';
    } else {
        // 초가짚 (기존 로직)
        if(document.getElementById('inpGift')) document.getElementById('inpGift').value = dayData.gift || '';
    }
    
    // 나머지 현금/지출 로직은 그대로 유지
    document.getElementById('inpStartCash').value = (dayData.startCash !== undefined) ? dayData.startCash : 100000;
    document.getElementById('inpCash').value = dayData.cash || '';
    document.getElementById('inpDeposit').value = dayData.bankDeposit || ''; 

    document.getElementById('inpFood').value = dayData.food || '';
    document.getElementById('inpMeat').value = dayData.meat || ''; // ID는 그대로 inpMeat 사용 (라벨만 SPC로 보임)
    document.getElementById('inpEtc').value = dayData.etc || ''; 
    document.getElementById('inpNote').value = dayData.note || '';

    calcDrawerTotal(); 
}

// [JS 수정] 돈통 잔액 실시간 계산 (공식 수정됨)
function calcDrawerTotal() {
    // 1. 아침에 세어본 돈 (기본 10만원 or 직접 입력)
    const startCash = parseInt(document.getElementById('inpStartCash').value) || 0; 
    
    // 2. POS에 찍힌 현금 매출
    const cashSales = parseInt(document.getElementById('inpCash').value) || 0;      
    
    // 3. 실제 현금이 아닌 것 (계좌이체)
    const transfer = parseInt(document.getElementById('inpTransfer').value) || 0;   
    
    // 4. 은행에 넣으려고 빼간 돈
    const deposit = parseInt(document.getElementById('inpDeposit').value) || 0;     

    // [공식] 시작돈 + 번돈 - 계좌이체 - 입금액 = 남은돈
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

// [JS 수정 3] 데이터 저장: 시재금과 입금액도 함께 저장
// [JS 수정 3] 데이터 저장: 시재금과 입금액도 함께 저장
async function saveDailyAccounting() {
    // (1) 로그인 체크
    if (!currentUser) { 
        alert("로그인이 필요합니다."); 
        openLoginModal(); 
        return; 
    }

    // (2) 권한 체크 (점장 이상 가능)
    if (!['admin', 'manager'].includes(currentUser.role)) {
        alert("점장 또는 사장님만 매출을 입력/수정할 수 있습니다.");
        return;
    }

    const dateStr = document.getElementById('accDate').value;
    const prepay = parseInt(document.getElementById('inpPrepay').value) || 0;

    if (!dateStr) { alert('날짜를 선택해주세요.'); return; }

    // 공통 데이터
    const startCash = parseInt(document.getElementById('inpStartCash').value) || 0;
    const cash = parseInt(document.getElementById('inpCash').value) || 0;
    const bankDeposit = parseInt(document.getElementById('inpDeposit').value) || 0;
    const transfer = parseInt(document.getElementById('inpTransfer').value) || 0;
    
    const food = parseInt(document.getElementById('inpFood').value) || 0;
    const meat = parseInt(document.getElementById('inpMeat').value) || 0;
    const etc = parseInt(document.getElementById('inpEtc').value) || 0;
    const note = document.getElementById('inpNote').value || '';

    // [수정] 매장별 매출 데이터 수집
    let card = 0, gift = 0, baemin = 0, yogiyo = 0, coupang = 0;
    let totalSales = 0;

    if (currentStore === 'yangeun') {
        card = parseInt(document.getElementById('inpCard').value) || 0;
        baemin = parseInt(document.getElementById('inpBaemin').value) || 0;
        yogiyo = parseInt(document.getElementById('inpYogiyo').value) || 0;
        coupang = parseInt(document.getElementById('inpCoupang').value) || 0;
        // 양은이네 총매출 공식
        totalSales = card + cash + transfer + baemin + yogiyo + coupang;
    } else {
        card = parseInt(document.getElementById('inpCard').value) || 0;
        gift = parseInt(document.getElementById('inpGift').value) || 0;
        // 초가짚 총매출 공식
        totalSales = card + cash + transfer + gift;
    }

    const totalCost = food + meat + etc;

    // ============================================================
    // [수정된 부분 시작] confirm 제거 및 안전장치 로직
    // ============================================================
    
    // 1. 모든 금액이 0원인 경우에만 확인창을 띄움 (실수로 빈 값 저장 방지)
    //    브라우저 팝업 차단이 되어도, 실제 데이터가 있을  때는 이 if문에 걸리지 않으므로 바로 저장됨
    if (totalSales === 0 && totalCost === 0) {
        if(!confirm(`${dateStr} 입력된 금액이 없습니다 (0원).\n그래도 저장하시겠습니까?`)) {
            return; // 취소 시 저장 안 함
        }
    }

    // 2. 데이터가 있다면 묻지 않고 즉시 저장 (팝업 차단 이슈 해결)
    // 기존의 confirmMsg 생성 및 confirm 호출 로직 삭제됨
    
    // ============================================================
    // [수정된 부분 끝]
    // ============================================================

const data = {
        startCash, cash, bankDeposit,
        card, transfer, 
        gift: (currentStore === 'yangeun' ? 0 : gift),
        baemin, yogiyo, coupang,
        // [NEW] 데이터 객체에 선결제 추가
        prepay: prepay, 
        sales: totalSales,
        food, meat, etc,
        cost: totalCost,
        note: note
    };

    // [디버깅용] 실제 전송되는 데이터를 콘솔에 찍어 0원이 뜨는지 확인 가능
    console.log('Sending Data:', data);

    try {
        // (5) API 전송 (actor 정보 포함)
        await fetch('/api/accounting/daily', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                date: dateStr, 
                data: data, 
                store: currentStore,
                actor: currentUser.name // [로그용] 누가 수정했는지 전송
            })
        });
        
        // 로컬 데이터 갱신
        if(!accountingData.daily) accountingData.daily = {};
        accountingData.daily[dateStr] = data;
        
        // alert 대신 가볍게 처리하거나, 성공했다는 메시지 띄움
        alert('저장되었습니다.');
        
        // 저장 후 '입력 내역' 탭으로 자동 이동하여 확인시켜줌
        switchAccSubTab('acc-history');
        
    } catch(e) { 
        console.error(e);
        alert('저장 실패: 서버 오류'); 
    }
}

// [staff.js] loadHistoryTable 함수 전체 교체

function loadHistoryTable() {
    const monthStr = getMonthStr(currentDashboardDate); // e.g. "2024-12"
    const tbody = document.getElementById('historyTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    const rows = []; // 데이터를 모아서 날짜순 정렬하기 위한 배열

    // 1. 일일 데이터 (Daily Data) 처리
    if (accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if (!date.startsWith(monthStr)) return;
            
            const d = accountingData.daily[date];
            const totalSales = (d.card||0)+(d.cash||0)+(d.transfer||0)+(d.gift||0);
            const totalCost = (d.food||0)+(d.meat||0)+(d.etc||0);
            
            // [상세 내역 생성]
            let details = [];
            
            // (1) 매출 상세
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

            // [NEW] 선결제 내역 표시 (보라색으로 강조)
            if(d.prepay) details.push(`<span style="color:#673ab7; font-weight:bold;">📒선결제:${d.prepay.toLocaleString()}</span>`);
            
            // (2) 지출 상세 (고기 명칭 변경)
            const meatName = (currentStore === 'yangeun') ? 'SPC' : '고기';
            if(d.meat) details.push(`${meatName}:${d.meat.toLocaleString()}`);
            if(d.food) details.push(`유통:${d.food.toLocaleString()}`);
            if(d.etc) details.push(`잡비:${d.etc.toLocaleString()}`);
            
            // (3) 메모
            if(d.note) details.push(`📝"${d.note}"`);

            rows.push({
                date: date,
                dayStr: `${date.substring(8)}일`,
                sales: totalSales,
                cost: totalCost,
                desc: details.join(' / '),
                type: 'daily' // 일반 입력 데이터
            });
        });
    }

    // 2. Fixed Cost Data 처리 (신규 필드 포함)
    if (accountingData.monthly && accountingData.monthly[monthStr]) {
        const m = accountingData.monthly[monthStr];
        const fixedTotal = (m.rent||0) + (m.utility||0) + (m.gas||0) + (m.liquor||0) + (m.beverage||0) + (m.etc_fixed||0)
                         + (m.disposable||0) + (m.businessCard||0) + (m.taxAgent||0) + (m.tax||0) + (m.foodWaste||0) + (m.tableOrder||0) + (m.liquorLoan||0);
        
        if (fixedTotal > 0) {
            let fDetails = [];
            if(m.rent) fDetails.push(`🏠월세:${m.rent.toLocaleString()}`);
            if(m.utility) fDetails.push(`💡관리:${m.utility.toLocaleString()}`);
            if(m.gas) fDetails.push(`🔥가스:${m.gas.toLocaleString()}`);
            // [NEW]
            if(m.disposable) fDetails.push(`🥡용기:${m.disposable.toLocaleString()}`);
            if(m.businessCard) fDetails.push(`💳카드:${m.businessCard.toLocaleString()}`);
            if(m.taxAgent) fDetails.push(`🧑‍💼세무:${m.taxAgent.toLocaleString()}`);
            if(m.tax) fDetails.push(`💸세금:${m.tax.toLocaleString()}`);
            if(m.foodWaste) fDetails.push(`🗑️음쓰:${m.foodWaste.toLocaleString()}`);
            if(m.tableOrder) fDetails.push(`📟오더:${m.tableOrder.toLocaleString()}`);
            // [추가] 내역 텍스트 표시
            if(m.liquorLoan) fDetails.push(`🍶대출:${m.liquorLoan.toLocaleString()}`);
            
            if(m.etc_fixed) fDetails.push(`🔧기타:${m.etc_fixed.toLocaleString()}`);

            const [year, month] = monthStr.split('-').map(Number);
            const lastDay = new Date(year, month, 0).getDate(); 
            
            rows.push({
                date: `${monthStr}-${lastDay}`,
                dayStr: `${lastDay}일 (고정비)`,
                sales: 0, cost: fixedTotal,
                desc: `<span style="color:#00796b; font-weight:bold;">[월 고정]</span> ` + fDetails.join('/'),
                type: 'fixed'
            });
        }
    }

    // 3. 날짜 내림차순 정렬 및 렌더링
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#999;">데이터가 없습니다.</td></tr>';
        return;
    }

    rows.sort((a,b) => b.date.localeCompare(a.date));

    rows.forEach(r => {
        let actionBtn = '';
        
        // 버튼 처리: 일반 데이터는 '수정', 고정비는 '설정' 탭으로 이동
        if (r.type === 'daily') {
            const btnStyle = "background:#607d8b; color:white; border:none; border-radius:3px; padding:5px 10px; cursor:pointer; font-size:12px;";
            actionBtn = `<button onclick="editHistoryDate('${r.date}')" style="${btnStyle}">✏️ 수정</button>`;
        } else {
             const btnStyle = "background:#00796b; color:white; border:none; border-radius:3px; padding:5px 10px; cursor:pointer; font-size:12px;";
             actionBtn = `<button onclick="switchAccSubTab('acc-monthly')" style="${btnStyle}">⚙️ 설정</button>`;
        }

        // 고정비 행은 배경색을 살짝 다르게(연한 파랑) 표시하여 구분
        const rowStyle = `border-bottom:1px solid #eee; ${r.type === 'fixed' ? 'background:#e0f7fa;' : ''}`;

        tbody.innerHTML += `
            <tr style="${rowStyle}">
                <td style="text-align:center;"><strong>${r.dayStr}</strong></td>
                <td style="color:#1976D2; font-weight:bold; text-align:right;">${r.sales.toLocaleString()}</td>
                <td style="color:#d32f2f; text-align:right;">${r.cost.toLocaleString()}</td>
                <td style="font-size:11px; color:#555; word-break:keep-all; line-height:1.4;">${r.desc}</td>
                <td style="text-align:center;">${actionBtn}</td>
            </tr>
        `;
    });
}

// 4. 수정 버튼 클릭 시 동작
function editHistoryDate(date) {
    // 1. 권한 체크
    if (!currentUser || !['admin', 'manager'].includes(currentUser.role)) {
        alert("수정 권한이 없습니다 (점장/관리자 전용)");
        return;
    }

    // 2. 날짜 세팅
    document.getElementById('accDate').value = date;
    
    // 3. 데이터 로드 (input 폼에 채우기)
    loadDailyAccounting();
    
    // 4. 입력 탭으로 이동
    switchAccSubTab('acc-daily');
    
    // 5. 알림
    alert(`${date} 데이터를 불러왔습니다.\n수정 후 [저장하기]를 눌러주세요.`);
}

// [서브탭 2] 대시보드 통계 (그래프 및 손익분기)
// [서브탭 2] 대시보드 통계 (그래프 및 손익분기)
function renderDashboardStats() {
    const monthStr = getMonthStr(currentDashboardDate);
    // 데이터 안전성 체크
    const mData = (accountingData.monthly && accountingData.monthly[monthStr]) ? accountingData.monthly[monthStr] : {};
    
    let sales = { card:0, cash:0, transfer:0, gift:0, baemin:0, yogiyo:0, coupang:0, total:0 };
    // [NEW] costs 객체에 신규 항목 추가
    let costs = { 
        meat:0, food:0, dailyEtc:0,
        rent: (mData.rent||0), 
        utility: (mData.utility||0), 
        gas: (mData.gas||0),
        liquor: (mData.liquor||0), 
        beverage: (mData.beverage||0), 
        fixedEtc: (mData.etc_fixed||0),
        // 신규
        disposable: (mData.disposable||0),
        businessCard: (mData.businessCard||0),
        taxAgent: (mData.taxAgent||0),
        tax: (mData.tax||0),
        foodWaste: (mData.foodWaste||0),
        tableOrder: (mData.tableOrder||0),
        liquorLoan: (mData.liquorLoan||0), 
        staff: 0 
    };
    costs.staff = getEstimatedStaffCost(monthStr);

    if (accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if (date.startsWith(monthStr)) {
                const d = accountingData.daily[date];
                
                // 매출 합산
                sales.card += (d.card||0); 
                sales.cash += (d.cash||0);
                sales.transfer += (d.transfer||0); 
                sales.gift += (d.gift||0);
                
                // 배달앱 합산 (양은이네용)
                sales.baemin += (d.baemin||0);
                sales.yogiyo += (d.yogiyo||0);
                sales.coupang += (d.coupang||0);
                
                // 지출 합산
                costs.meat += (d.meat||0); 
                costs.food += (d.food||0); 
                costs.dailyEtc += (d.etc||0);
            }
        });
    }

    // 총계 계산 (신규 비용 포함)
    sales.total = sales.card + sales.cash + sales.transfer + sales.gift + sales.baemin + sales.yogiyo + sales.coupang;
    
    const totalFixed = costs.rent + costs.utility + costs.gas + costs.liquor + costs.beverage + costs.fixedEtc + costs.staff
                     + costs.disposable + costs.businessCard + costs.taxAgent + costs.tax + costs.foodWaste + costs.tableOrder + costs.liquorLoan;
                     
    const totalVariable = costs.meat + costs.food + costs.dailyEtc;
    const totalCost = totalFixed + totalVariable;

    const netProfit = sales.total - totalCost;
    const margin = sales.total > 0 ? ((netProfit / sales.total) * 100).toFixed(1) : 0;

    // UI 바인딩
    document.getElementById('dashTotalSales').textContent = sales.total.toLocaleString() + '원';
    document.getElementById('dashTotalCost').textContent = totalCost.toLocaleString() + '원';
    
    const profitEl = document.getElementById('dashNetProfit');
    profitEl.textContent = netProfit.toLocaleString() + '원';
    profitEl.style.color = netProfit >= 0 ? '#fff' : '#ffab91'; 
    document.getElementById('dashMargin').textContent = `순이익률: ${margin}%`;
    document.getElementById('dashStaffCost').textContent = costs.staff.toLocaleString();

    let bepMsg = '';
    if (netProfit > 0) bepMsg = `🎉 흑자 달성! (+${netProfit.toLocaleString()}원)`;
    else bepMsg = `⚠️ 손익분기까지 ${Math.abs(netProfit).toLocaleString()}원 남음`;
    document.getElementById('dashBreakEven').textContent = bepMsg;

    // -----------------------------------------------------------
    // [차트 그리기 헬퍼 함수 - 개선됨]
    // barBase: 그래프 바 길이 계산용 분모 (매출차트면 총매출, 지출차트면 총지출)
    // pctBase: 퍼센트 텍스트 계산용 분모 (항상 총매출 기준)
    // -----------------------------------------------------------
    const renderBar = (label, val, color, barBase, pctBase) => {
        if(val === 0) return '';
        
        // 1. 그래프 바 길이 (시각적 비율)
        // barBase가 0이면 0%, 아니면 비율 계산
        const widthPct = barBase > 0 ? Math.max((val / barBase) * 100, 1) : 0;
        
        // 2. 텍스트 표시용 퍼센트 (총매출 대비 비율)
        // pctBase(총매출)가 0이면 0.0, 아니면 실제 비율
        const textPct = pctBase > 0 ? ((val / pctBase) * 100).toFixed(1) : '0.0';

        return `
            <div class="bar-row">
                <div class="bar-label">${label}</div>
                <div class="bar-track">
                    <div class="bar-fill" style="width:${widthPct}%; background:${color};"></div>
                </div>
                <div class="bar-value">
                    ${val.toLocaleString()}
                    <span style="font-size:11px; color:#999; font-weight:normal; margin-left:2px;">
                        (${textPct}%)
                    </span>
                </div>
            </div>`;
    };

    // [매출 차트]
    const chartEl = document.getElementById('salesBreakdownChart');
    if(chartEl) {
        if(sales.total === 0) {
            chartEl.innerHTML = '<div style="text-align:center; color:#999; padding:10px;">매출 데이터 없음</div>';
        } else {
            // 매출 차트는 '바 길이'와 '텍스트 비율' 모두 sales.total 기준
            if (currentStore === 'yangeun') {
                 chartEl.innerHTML = `
                    ${renderBar('💳 카드', sales.card, '#42a5f5', sales.total, sales.total)}
                    ${renderBar('🛵 배민', sales.baemin, '#2ac1bc', sales.total, sales.total)}
                    ${renderBar('🛵 요기요', sales.yogiyo, '#fa0050', sales.total, sales.total)}
                    ${renderBar('🛵 쿠팡', sales.coupang, '#00a5ff', sales.total, sales.total)}
                    ${renderBar('💵 현금', sales.cash, '#66bb6a', sales.total, sales.total)}
                    ${renderBar('🏦 계좌', sales.transfer, '#ab47bc', sales.total, sales.total)}
                `;
            } else {
                chartEl.innerHTML = `
                    ${renderBar('💳 카드', sales.card, '#42a5f5', sales.total, sales.total)}
                    ${renderBar('💵 현금', sales.cash, '#66bb6a', sales.total, sales.total)}
                    ${renderBar('🏦 계좌', sales.transfer, '#ab47bc', sales.total, sales.total)}
                    ${renderBar('🎫 기타', sales.gift, '#ffa726', sales.total, sales.total)}
                `;
            }
        }
    }

    // [지출 차트 렌더링 부분]
    const costListEl = document.getElementById('costBreakdownList');
    if(costListEl) {
        if(totalCost === 0) {
            costListEl.innerHTML = '...';
        } else {
            const meatLabel = (currentStore === 'yangeun') ? '🍞 SPC유통' : '🥩 한강유통';
            const etcLabel = (currentStore === 'yangeun') ? '🦪 막걸리/굴' : '🍦 기타 잡비';

            // [NEW] 그래프 항목에 추가
            const costItems = [
                { label: meatLabel, val: costs.meat, color: '#ef5350' },
                { label: '🏠 임대료', val: costs.rent, color: '#5c6bc0' },
                { label: '👥 인건비', val: costs.staff, color: '#26a69a' },
                { label: '🍶 대출상환', val: costs.liquorLoan, color: '#f57c00' }, // <-- 추가 (주황색 계열)
                { label: '🍺 주류/음료', val: costs.liquor + costs.beverage, color: '#ff7043' },
                { label: '🥬 삼시세끼', val: costs.food, color: '#8d6e63' },
                { label: '💡 공과금/가스', val: costs.utility + costs.gas, color: '#fdd835' },
                
                // 신규 항목들
                { label: '💳 카드대금', val: costs.businessCard, color: '#7e57c2' },
                { label: '💸 세금/기장', val: costs.tax + costs.taxAgent, color: '#ab47bc' },
                { label: '🗑️ 음쓰/용기', val: costs.foodWaste + costs.disposable, color: '#8d6e63' },
                { label: '📟 오더/기타', val: costs.tableOrder + costs.fixedEtc, color: '#bdbdbd' },
                
                { label: etcLabel, val: costs.dailyEtc, color: '#78909c' },
            ].sort((a,b) => b.val - a.val);

            // ... (렌더링 루프 유지) ...
            let costHtml = '';
            costItems.forEach(item => {
                if (item.val > 0) {
                     // renderBar 함수는 내부 스코프에 있다고 가정 (기존 코드 참고)
                     const widthPct = totalCost > 0 ? Math.max((item.val / totalCost) * 100, 1) : 0;
                     const textPct = sales.total > 0 ? ((item.val / sales.total) * 100).toFixed(1) : '0.0';
                     costHtml += `
                        <div class="bar-row">
                            <div class="bar-label">${item.label}</div>
                            <div class="bar-track">
                                <div class="bar-fill" style="width:${widthPct}%; background:${item.color};"></div>
                            </div>
                            <div class="bar-value">${item.val.toLocaleString()} <span style="font-size:11px; color:#999;">(${textPct}%)</span></div>
                        </div>`;
                }
            });
            costListEl.innerHTML = costHtml;
        }
    }
}

// [여기서부터 복사하세요] ==============================================

// [서브탭 3] 월간 고정비 데이터 로드 (누락된 함수 복구)
function loadMonthlyForm() {
    const monthStr = getMonthStr(currentDashboardDate);
    const mData = (accountingData.monthly && accountingData.monthly[monthStr]) ? accountingData.monthly[monthStr] : {};

    // 기존 필드
    if(document.getElementById('fixRent')) document.getElementById('fixRent').value = mData.rent || '';
    if(document.getElementById('fixUtility')) document.getElementById('fixUtility').value = mData.utility || '';
    if(document.getElementById('fixGas')) document.getElementById('fixGas').value = mData.gas || '';
    if(document.getElementById('fixLiquor')) document.getElementById('fixLiquor').value = mData.liquor || '';
    if(document.getElementById('fixBeverage')) document.getElementById('fixBeverage').value = mData.beverage || '';
    if(document.getElementById('fixEtc')) document.getElementById('fixEtc').value = mData.etc_fixed || '';
    
    // [NEW] 추가 필드 로드
    if(document.getElementById('fixDisposable')) document.getElementById('fixDisposable').value = mData.disposable || '';
    if(document.getElementById('fixBusinessCard')) document.getElementById('fixBusinessCard').value = mData.businessCard || '';
    if(document.getElementById('fixTaxAgent')) document.getElementById('fixTaxAgent').value = mData.taxAgent || '';
    if(document.getElementById('fixTax')) document.getElementById('fixTax').value = mData.tax || '';
    if(document.getElementById('fixFoodWaste')) document.getElementById('fixFoodWaste').value = mData.foodWaste || '';
    if(document.getElementById('fixTableOrder')) document.getElementById('fixTableOrder').value = mData.tableOrder || '';

    // [추가] 주류대출상환 데이터 로드
    if(document.getElementById('fixLiquorLoan')) document.getElementById('fixLiquorLoan').value = mData.liquorLoan || '';
}

// [staff.js 수정]
async function saveFixedCost() {
    if (!currentUser) { openLoginModal(); return; }
    if (!['admin', 'manager'].includes(currentUser.role)) {
        alert("관리자 권한이 필요합니다.");
        return;
    }

    const monthStr = getMonthStr(currentDashboardDate);
    
    // 기존 데이터
    const rent = parseInt(document.getElementById('fixRent').value) || 0;
    const utility = parseInt(document.getElementById('fixUtility').value) || 0;
    const gas = parseInt(document.getElementById('fixGas').value) || 0;
    const liquor = parseInt(document.getElementById('fixLiquor').value) || 0;
    const beverage = parseInt(document.getElementById('fixBeverage').value) || 0;
    const etc_fixed = parseInt(document.getElementById('fixEtc').value) || 0;
    // [추가] 값 읽어오기
    const liquorLoan = parseInt(document.getElementById('fixLiquorLoan').value) || 0;

    // [NEW] 추가 데이터
    // 양은이네가 아니면 일회용기는 0으로 처리
    const disposable = (currentStore === 'yangeun') ? (parseInt(document.getElementById('fixDisposable').value) || 0) : 0;
    const businessCard = parseInt(document.getElementById('fixBusinessCard').value) || 0;
    const taxAgent = parseInt(document.getElementById('fixTaxAgent').value) || 0;
    const tax = parseInt(document.getElementById('fixTax').value) || 0;
    const foodWaste = parseInt(document.getElementById('fixFoodWaste').value) || 0;
    const tableOrder = parseInt(document.getElementById('fixTableOrder').value) || 0;

    if(!confirm(`${monthStr} 고정 지출을 저장하시겠습니까?`)) return;

    const data = { 
        rent, utility, gas, liquor, beverage, etc_fixed,
        disposable, businessCard, taxAgent, tax, foodWaste, tableOrder, liquorLoan
    };

    try {
        const res = await fetch('/api/accounting/monthly', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                month: monthStr,
                data: data,
                store: currentStore,
                actor: currentUser.name
            })
        });

        if (res.ok) {
            if(!accountingData.monthly) accountingData.monthly = {};
            accountingData.monthly[monthStr] = data;
            alert('저장되었습니다.');
            updateDashboardUI();
        } else {
            alert('저장 실패: 서버 오류');
        }
    } catch(e) { console.error(e); alert('저장 실패'); }
}

// [여기까지 복사하세요] ==============================================

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

    const dateDisplay = document.getElementById('currentDateDisplay');
    if(dateDisplay) dateDisplay.textContent = `${month}월 ${day}일 (${DAY_MAP[todayKey]})`;
    
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
                if(staff.exceptions && staff.exceptions[dateStr] && staff.exceptions[dateStr].type === 'off') {
                    isWorking = false;
                }
            }
        }
        if (isWorking) dailyWorkers.push({ ...staff, displayTime: workTime, isException });
    });

    const badge = document.getElementById('dailyCountBadge');
    if(badge) badge.textContent = `총 ${dailyWorkers.length}명 근무`;
    
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
    
    const rangeDisplay = document.getElementById('weeklyRangeDisplay');
    if(rangeDisplay) rangeDisplay.textContent = `${startWeek.getMonth()+1}월 ${startWeek.getDate()}일 ~ ${endWeek.getMonth()+1}월 ${endWeek.getDate()}일`;

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
    
    const lastDayObj = new Date(year, month + 1, 0);
    const totalDaysInMonth = lastDayObj.getDate(); 
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    let salaryReport = [];

    staffList.forEach(s => {
        const sDate = s.startDate ? new Date(s.startDate) : null;
        const eDate = s.endDate ? new Date(s.endDate) : null;
        
        const isEmployedAt = (targetDate) => {
            const t = new Date(targetDate); t.setHours(0,0,0,0);
            if (sDate) {
                const start = new Date(sDate); start.setHours(0,0,0,0);
                if (t < start) return false; 
            }
            if (eDate) {
                const end = new Date(eDate); end.setHours(0,0,0,0);
                if (t > end) return false; 
            }
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

            salaryReport.push({ 
                name: s.name, 
                type: '월급', 
                workCount: statusText, 
                totalHours: '-', 
                amount: finalPay 
            });
            return;
        }

        let totalHours = 0;
        let workCount = 0;
        
        for (let d = 1; d <= totalDaysInMonth; d++) {
            const currentDate = new Date(year, month, d);
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dayKey = dayMap[currentDate.getDay()];
            
            if (!isEmployedAt(currentDate)) continue;

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
            name: s.name, 
            type: '시급',
            workCount: workCount + '일', 
            totalHours: totalHours.toFixed(1) + '시간',
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
                <td>
                    ${r.name}
                    ${(r.workCount.includes('일할')) ? '<br><span style="font-size:10px; color:red;">(중도 입/퇴사)</span>' : ''}
                </td>
                <td><span class="badge" style="background:${r.type === '월급'?'#28a745':'#17a2b8'}; color:white; padding:3px 6px; border-radius:4px; font-size:11px;">${r.type}</span></td>
                <td style="font-size:12px;">${r.workCount}<br>${r.type==='시급' ? '('+r.totalHours+')' : ''}</td>
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

function getEstimatedStaffCost(monthStr) {
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

        const isEmployedAt = (targetDate) => {
            const t = new Date(targetDate); t.setHours(0,0,0,0);
            if (sDate) {
                const start = new Date(sDate); start.setHours(0,0,0,0);
                if (t < start) return false; 
            }
            if (eDate) {
                const end = new Date(eDate); end.setHours(0,0,0,0);
                if (t > end) return false;
            }
            return true;
        };

        if (s.salaryType === 'monthly') {
            let employedDays = 0;
            for (let d = 1; d <= totalDaysInMonth; d++) {
                if (isEmployedAt(new Date(year, month-1, d))) employedDays++;
            }
            
            if (employedDays === totalDaysInMonth) {
                totalPay += (s.salary || 0);
            } else {
                totalPay += Math.floor((s.salary || 0) / totalDaysInMonth * employedDays);
            }

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

// ==========================================
// [여기서부터 파일 끝까지 덮어쓰기 하세요]
// ==========================================

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
                name, 
                date: dateStr, 
                time, 
                actor: currentUser.name, 
                store: currentStore 
            })
        });
        const json = await res.json();
        if (json.success) { 
            alert('등록되었습니다.'); 
            loadStaffData(); 
        } else {
            alert('등록 실패');
        }
    } catch(e) { 
        alert('서버 오류'); 
    }
}

async function callExceptionApi(payload) {
    try {
        await fetch('/api/staff/exception', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                ...payload, 
                actor: currentUser.name, 
                store: currentStore 
            })
        });
        loadStaffData();
    } catch(e) { 
        alert('오류 발생'); 
    }
}

// staff.js 맨 마지막 부분 (loadLogs 함수 끝부분)

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

            json.data.forEach(log => {
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
    } catch(e) { 
        console.error("로그 로드 실패", e); 
    }
}

// [staff.js] 파일 하단에 추가

function renderPredictionStats() {
    const today = new Date();
    const currentYear = currentDashboardDate.getFullYear();
    const currentMonth = currentDashboardDate.getMonth() + 1; // 1~12
    const monthStr = getMonthStr(currentDashboardDate);

    // 1. 이번 달의 총 일수 구하기 (28, 30, 31일)
    const lastDayOfThisMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    // 2. 적용할 일수(비율) 계산
    let appliedDay = lastDayOfThisMonth; // 기본값: 과거 데이터면 전체 반영
    let ratio = 1.0;

    // 만약 "현재 진행 중인 달(오늘이 포함된 달)"을 보고 있다면?
    if (today.getFullYear() === currentYear && (today.getMonth() + 1) === currentMonth) {
        appliedDay = today.getDate(); // 오늘 날짜 (예: 5일)
        ratio = appliedDay / lastDayOfThisMonth; // 예: 5 / 31 = 약 0.16
    } else if (new Date(currentYear, currentMonth - 1, 1) > today) {
        // 미래의 달을 보고 있다면?
        appliedDay = 0;
        ratio = 0;
    }

    // UI에 비율 정보 표시
    const ratioText = `${appliedDay}/${lastDayOfThisMonth}`;
    if(document.getElementById('predDateRatio')) document.getElementById('predDateRatio').textContent = ratioText;
    if(document.getElementById('predCostText')) document.getElementById('predCostText').textContent = `${ratioText}일치`;

    // -----------------------------------------------------------
    // 3. 데이터 집계 (기존 Dashboard 로직과 유사하지만 고정비에 ratio 적용)
    // -----------------------------------------------------------
    const mData = (accountingData.monthly && accountingData.monthly[monthStr]) ? accountingData.monthly[monthStr] : {};
    
    let salesTotal = 0;
    let variableCostTotal = 0; // 변동비 (식자재 등) - 이건 100% 반영
    
    // 일일 매출/지출 합산 (현재까지 쌓인 실적)
    if (accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if (date.startsWith(monthStr)) {
                const d = accountingData.daily[date];
                
                // 매출 합산 (매장별 로직 통합)
                const daySales = (d.card||0) + (d.cash||0) + (d.transfer||0) + (d.gift||0) 
                               + (d.baemin||0) + (d.yogiyo||0) + (d.coupang||0);
                salesTotal += daySales;

                // 변동 지출 합산 (고기, 야채, 잡비 등은 쓴 만큼 바로 반영)
                const dayCost = (d.meat||0) + (d.food||0) + (d.etc||0);
                variableCostTotal += dayCost;
            }
        });
    }

    // 고정비 합산 (월세, 인건비 등) -> 여기에 ratio(비율)을 곱함!
    const estimatedStaffCost = getEstimatedStaffCost(monthStr); // 인건비
    const fixedRaw = (mData.rent||0) + (mData.utility||0) + (mData.gas||0) 
                   + (mData.liquor||0) + (mData.beverage||0) + (mData.etc_fixed||0)
                   + (mData.disposable||0) + (mData.businessCard||0) + (mData.taxAgent||0) 
                   + (mData.tax||0) + (mData.foodWaste||0) + (mData.tableOrder||0) + (mData.liquorLoan||0);
    
    const totalFixedFull = fixedRaw + estimatedStaffCost;
    const appliedFixedCost = Math.floor(totalFixedFull * ratio); // 🔮 핵심: 비율 적용된 고정비

    // 최종 계산
    const totalCurrentCost = variableCostTotal + appliedFixedCost;
    const netProfit = salesTotal - totalCurrentCost;
    const margin = salesTotal > 0 ? ((netProfit / salesTotal) * 100).toFixed(1) : 0;

    // -----------------------------------------------------------
    // 4. UI 렌더링
    // -----------------------------------------------------------
    document.getElementById('predTotalSales').textContent = salesTotal.toLocaleString() + '원';
    document.getElementById('predTotalCost').textContent = totalCurrentCost.toLocaleString() + '원';
    
    const profitEl = document.getElementById('predNetProfit');
    profitEl.textContent = netProfit.toLocaleString() + '원';
    profitEl.style.color = netProfit >= 0 ? '#fff' : '#ffab91'; // 플러스면 흰색, 마이너스면 연한 붉은색
    
    document.getElementById('predMargin').textContent = `보정 마진율: ${margin}%`;

    // 상세 리스트 그리기 (바 차트)
    const costListEl = document.getElementById('predCostList');
    if(costListEl) {
        if(totalCurrentCost === 0) {
            costListEl.innerHTML = '<div style="text-align:center; padding:10px; color:#999;">데이터 없음</div>';
        } else {
            // 항목별 데이터 구성 (변동비는 그대로, 고정비는 ratio 적용)
            const meatLabel = (currentStore === 'yangeun') ? '🍞 SPC유통' : '🥩 한강유통';
            const etcLabel = (currentStore === 'yangeun') ? '🦪 막걸리/굴' : '🍦 일일잡비';

            // 고정비 항목들 (비율 적용)
            const fRent = Math.floor((mData.rent||0) * ratio);
            const fStaff = Math.floor(estimatedStaffCost * ratio);
            const fLiquor = Math.floor(((mData.liquor||0) + (mData.beverage||0)) * ratio);
            const fUtility = Math.floor(((mData.utility||0) + (mData.gas||0)) * ratio);
            const fLoan = Math.floor((mData.liquorLoan||0) * ratio);
            const fOthers = Math.floor(((mData.businessCard||0) + (mData.taxAgent||0) + (mData.tax||0) + (mData.tableOrder||0) + (mData.etc_fixed||0)) * ratio);

            // 변동비 항목들 (일일 데이터에서 합산된 값 그대로)
            // note: variableCostTotal 변수에 이미 합산되어 있으나, 개별 항목 표시를 위해 다시 계산하거나 위에서 저장해뒀어야 함.
            // 여기서는 accountingData.daily 루프를 다시 돌지 않고 위에서 합산 변수를 따로 만들지 않았으므로 간단히 다시 계산 (성능 이슈 없음)
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

            const costItems = [
                { label: meatLabel, val: cMeat, color: '#ef5350' }, // 변동
                { label: '🥬 삼시세끼', val: cFood, color: '#8d6e63' }, // 변동
                { label: etcLabel, val: cEtc, color: '#78909c' }, // 변동
                { label: '🏠 임대료(1/N)', val: fRent, color: '#ab47bc' }, // 고정
                { label: '👥 인건비(1/N)', val: fStaff, color: '#ba68c8' }, // 고정
                { label: '🍶 대출/주류(1/N)', val: fLoan + fLiquor, color: '#ce93d8' }, // 고정
                { label: '💡 기타고정(1/N)', val: fUtility + fOthers, color: '#e1bee7' }  // 고정
            ].sort((a,b) => b.val - a.val); // 큰 금액 순 정렬

            // 그래프 그리기 함수 (내부 정의)
            let html = '';
            costItems.forEach(item => {
                if (item.val > 0) {
                     const widthPct = Math.max((item.val / totalCurrentCost) * 100, 1);
                     const textPct = salesTotal > 0 ? ((item.val / salesTotal) * 100).toFixed(1) : '0.0';
                     html += `
                        <div class="bar-row">
                            <div class="bar-label">${item.label}</div>
                            <div class="bar-track">
                                <div class="bar-fill" style="width:${widthPct}%; background:${item.color};"></div>
                            </div>
                            <div class="bar-value">${item.val.toLocaleString()} <span style="font-size:11px; color:#999;">(${textPct}%)</span></div>
                        </div>`;
                }
            });
            costListEl.innerHTML = html;
        }
    }
}