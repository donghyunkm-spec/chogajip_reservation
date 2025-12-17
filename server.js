// staff.js - 통합 버전 (직원관리 + 가계부 고도화) - 최종 수정본

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

    initStoreSettings();

    const today = new Date();
    const day = today.getDay();
    currentWeekStartDate.setDate(today.getDate() - day);
    
    loadStaffData();
});

// [헬퍼 함수] 숫자 파싱 (콤마 제거 포함 - 핵심 수정사항)
function parseMoney(val) {
    if (!val) return 0;
    // 문자열인 경우 콤마 제거 후 정수 변환
    if (typeof val === 'string') {
        return parseInt(val.replace(/,/g, '')) || 0;
    }
    return parseInt(val) || 0;
}

function initStoreSettings() {
    if (currentStore === 'yangeun') {
        const meatLabel = document.getElementById('labelMeat');
        if (meatLabel) meatLabel.textContent = '🍞 SPC 유통';
        
        const salesGrid = document.getElementById('salesInputGrid');
        if (salesGrid) {
            salesGrid.innerHTML = `
                <div>
                    <span class="category-label">💳 카드 매출</span>
                    <input type="number" id="inpCard" class="money-input" placeholder="0">
                </div>
                <div>
                    <span class="category-label">🛵 배달의민족</span>
                    <input type="number" id="inpBaemin" class="money-input" placeholder="0">
                </div>
                <div>
                    <span class="category-label">🛵 요기요</span>
                    <input type="number" id="inpYogiyo" class="money-input" placeholder="0">
                </div>
                <div>
                    <span class="category-label">🛵 쿠팡이츠</span>
                    <input type="number" id="inpCoupang" class="money-input" placeholder="0">
                </div>
            `;
            salesGrid.style.gridTemplateColumns = "1fr 1fr"; 
        }
    }
}

// ==========================================
// 2. 탭 전환 및 화면 제어
// ==========================================

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    const targetBtn = document.querySelector(`button[onclick="switchTab('${tabName}')"]`);
    if(targetBtn) targetBtn.classList.add('active');
    
    const content = document.getElementById(`${tabName}-content`);
    if(content) content.classList.add('active');

    if(tabName === 'daily') renderDailyView();
    if(tabName === 'weekly') renderWeeklyView();
    if(tabName === 'monthly') renderMonthlyView();
    if(tabName === 'accounting') loadAccountingData();
}

function switchAccSubTab(subTabId, btnElement) {
    document.querySelectorAll('.acc-sub-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });
    
    const subTabContainer = document.querySelector('.tabs[style*="grid-template-columns"]'); 
    if(subTabContainer) {
        subTabContainer.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
    }

    if(btnElement) {
        btnElement.classList.add('active');
    } else {
        const matchingBtn = document.querySelector(`button[onclick*="${subTabId}"]`);
        if(matchingBtn) matchingBtn.classList.add('active');
    }

    const targetDiv = document.getElementById(subTabId);
    if(targetDiv) {
        targetDiv.style.display = 'block';
        targetDiv.classList.add('active');
        setTimeout(() => { updateDashboardUI(); }, 0);
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
    
    if (!activeSubTab) {
        switchAccSubTab('acc-daily');
        return; 
    }

    if (activeSubTab.id === 'acc-daily') {
        // 일일 입력 탭
    } 
    else if (activeSubTab.id === 'acc-history') {
        loadHistoryTable();
    }
    else if (activeSubTab.id === 'acc-dashboard') {
        renderDashboardStats();
    } 
    else if (activeSubTab.id === 'acc-monthly') {
        loadMonthlyForm();
    }
}

// [수정] 일일 데이터 로드
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

// [수정] 돈통 잔액 실시간 계산 (parseMoney 사용)
function calcDrawerTotal() {
    const startCash = parseMoney(document.getElementById('inpStartCash').value);
    const cashSales = parseMoney(document.getElementById('inpCash').value);      
    const transfer = parseMoney(document.getElementById('inpTransfer').value);   
    const deposit = parseMoney(document.getElementById('inpDeposit').value);     

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

// [수정] 일일 데이터 저장 함수 (parseMoney 적용 및 0원 저장 방지)
async function saveDailyAccounting() {
    if (!currentUser) { 
        alert("로그인이 필요합니다."); 
        openLoginModal(); 
        return; 
    }

    if (!['admin', 'manager'].includes(currentUser.role)) {
        alert("점장 또는 사장님만 매출을 입력/수정할 수 있습니다.");
        return;
    }

    const dateStr = document.getElementById('accDate').value;
    if (!dateStr) { alert('날짜를 선택해주세요.'); return; }

    // 콤마 제거 및 숫자 변환
    const startCash = parseMoney(document.getElementById('inpStartCash').value);
    const cash = parseMoney(document.getElementById('inpCash').value);
    const bankDeposit = parseMoney(document.getElementById('inpDeposit').value);
    const transfer = parseMoney(document.getElementById('inpTransfer').value);
    
    const food = parseMoney(document.getElementById('inpFood').value);
    const meat = parseMoney(document.getElementById('inpMeat').value);
    const etc = parseMoney(document.getElementById('inpEtc').value);
    const note = document.getElementById('inpNote').value || '';

    let card = 0, gift = 0, baemin = 0, yogiyo = 0, coupang = 0;
    let totalSales = 0;

    if (currentStore === 'yangeun') {
        card = parseMoney(document.getElementById('inpCard').value);
        baemin = parseMoney(document.getElementById('inpBaemin').value);
        yogiyo = parseMoney(document.getElementById('inpYogiyo').value);
        coupang = parseMoney(document.getElementById('inpCoupang').value);
        totalSales = card + cash + transfer + baemin + yogiyo + coupang;
    } else {
        // 초가짚
        const elCard = document.getElementById('inpCard');
        const elGift = document.getElementById('inpGift');
        card = elCard ? parseMoney(elCard.value) : 0;
        gift = elGift ? parseMoney(elGift.value) : 0;
        totalSales = card + cash + transfer + gift;
    }

    // [중요] 모든 값이 0원인 경우 경고 (실수로 날짜 바꿔서 지워진 상태로 저장하는 것 방지)
    const totalCost = food + meat + etc;
    if (totalSales === 0 && totalCost === 0 && note === '') {
        if (!confirm('⚠️ 매출과 지출이 모두 0원입니다.\n\n혹시 날짜를 변경해서 입력한 내용이 초기화되었나요?\n\n그래도 저장하시겠습니까?')) {
            return;
        }
    } else {
        if(!confirm(`${dateStr} 데이터를 저장하시겠습니까?\n매출: ${totalSales.toLocaleString()}원`)) return;
    }

    const data = {
        startCash, cash, bankDeposit,
        card, transfer, 
        gift: (currentStore === 'yangeun' ? 0 : gift),
        baemin, yogiyo, coupang,
        sales: totalSales,
        food, meat, etc,
        cost: totalCost,
        note: note
    };

    try {
        const res = await fetch('/api/accounting/daily', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                date: dateStr, 
                data: data, 
                store: currentStore,
                actor: currentUser.name 
            })
        });
        
        const json = await res.json();
        if (!json.success) throw new Error('저장 실패');

        if(!accountingData.daily) accountingData.daily = {};
        accountingData.daily[dateStr] = data;
        
        alert('저장되었습니다.');
        switchAccSubTab('acc-history');
        
    } catch(e) { 
        console.error(e);
        alert('저장 실패: 서버 오류'); 
    }
}

function loadHistoryTable() {
    const monthStr = getMonthStr(currentDashboardDate);
    const tbody = document.getElementById('historyTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    const rows = [];

    if (accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if (!date.startsWith(monthStr)) return;
            
            const d = accountingData.daily[date];
            const totalSales = (d.sales !== undefined) ? d.sales : ((d.card||0)+(d.cash||0)+(d.transfer||0)+(d.gift||0));
            const totalCost = (d.cost !== undefined) ? d.cost : ((d.food||0)+(d.meat||0)+(d.etc||0));
            
            let details = [];
            
            if(d.card) details.push(`💳${d.card.toLocaleString()}`);
            if(d.cash) details.push(`💵${d.cash.toLocaleString()}`);
            
            if (currentStore === 'yangeun') {
                if(d.baemin) details.push(`배${d.baemin.toLocaleString()}`);
            } else {
                if(d.gift) details.push(`기${d.gift.toLocaleString()}`);
            }
            
            if(d.note) details.push(`"${d.note}"`);

            rows.push({
                date: date,
                dayStr: `${date.substring(8)}일`,
                sales: totalSales,
                cost: totalCost,
                desc: details.join('/'),
                type: 'daily'
            });
        });
    }

    if (accountingData.monthly && accountingData.monthly[monthStr]) {
        const m = accountingData.monthly[monthStr];
        const fixedTotal = (m.rent||0) + (m.utility||0) + (m.gas||0) + (m.liquor||0) + (m.beverage||0) + (m.etc_fixed||0);
        
        if (fixedTotal > 0) {
            const [year, month] = monthStr.split('-');
            const lastDay = new Date(year, month, 0).getDate(); 
            const fullDate = `${monthStr}-${String(lastDay).padStart(2,'0')}`;

            rows.push({
                date: fullDate, 
                dayStr: `${lastDay}일 (고정비)`,
                sales: 0,
                cost: fixedTotal,
                desc: `[고정지출] 월세 등`,
                type: 'fixed'
            });
        }
    }

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#999;">데이터가 없습니다.</td></tr>';
        return;
    }

    rows.sort((a,b) => b.date.localeCompare(a.date));

    rows.forEach(r => {
        let actionBtn = '';
        if (r.type === 'daily') {
            const btnStyle = "background:#607d8b; color:white; border:none; border-radius:3px; padding:5px 10px; cursor:pointer; font-size:12px;";
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
                <td style="font-size:11px; color:#555;">${r.desc}</td>
                <td style="text-align:center;">${actionBtn}</td>
            </tr>
        `;
    });
}

function editHistoryDate(date) {
    if (!currentUser || !['admin', 'manager'].includes(currentUser.role)) {
        alert("수정 권한이 없습니다");
        return;
    }
    document.getElementById('accDate').value = date;
    loadDailyAccounting();
    switchAccSubTab('acc-daily');
    alert(`${date} 데이터를 불러왔습니다.\n수정 후 [저장하기]를 눌러주세요.`);
}

function renderDashboardStats() {
    const monthStr = getMonthStr(currentDashboardDate);
    const mData = (accountingData.monthly && accountingData.monthly[monthStr]) ? accountingData.monthly[monthStr] : {};
    
    let sales = { card:0, cash:0, transfer:0, gift:0, baemin:0, yogiyo:0, coupang:0, total:0 };
    let costs = { 
        meat:0, food:0, dailyEtc:0,
        rent: (mData.rent||0), utility: (mData.utility||0), gas: (mData.gas||0),
        liquor: (mData.liquor||0), beverage: (mData.beverage||0), fixedEtc: (mData.etc_fixed||0),
        staff: 0 
    };

    costs.staff = getEstimatedStaffCost(monthStr);

    if (accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if (date.startsWith(monthStr)) {
                const d = accountingData.daily[date];
                sales.card += (d.card||0); 
                sales.cash += (d.cash||0);
                sales.transfer += (d.transfer||0); 
                sales.gift += (d.gift||0);
                sales.baemin += (d.baemin||0);
                sales.yogiyo += (d.yogiyo||0);
                sales.coupang += (d.coupang||0);
                
                costs.meat += (d.meat||0); 
                costs.food += (d.food||0); 
                costs.dailyEtc += (d.etc||0);
            }
        });
    }

    sales.total = sales.card + sales.cash + sales.transfer + sales.gift + sales.baemin + sales.yogiyo + sales.coupang;
    
    const totalFixed = costs.rent + costs.utility + costs.gas + costs.liquor + costs.beverage + costs.fixedEtc + costs.staff;
    const totalVariable = costs.meat + costs.food + costs.dailyEtc;
    const totalCost = totalFixed + totalVariable;
    const netProfit = sales.total - totalCost;
    const margin = sales.total > 0 ? ((netProfit / sales.total) * 100).toFixed(1) : 0;

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

    const renderBar = (label, val, color, barBase, pctBase) => {
        if(val === 0) return '';
        const widthPct = barBase > 0 ? Math.max((val / barBase) * 100, 1) : 0;
        const textPct = pctBase > 0 ? ((val / pctBase) * 100).toFixed(1) : '0.0';

        return `
            <div class="bar-row">
                <div class="bar-label">${label}</div>
                <div class="bar-track">
                    <div class="bar-fill" style="width:${widthPct}%; background:${color};"></div>
                </div>
                <div class="bar-value">
                    ${val.toLocaleString()}
                    <span style="font-size:11px; color:#999; font-weight:normal; margin-left:2px;">(${textPct}%)</span>
                </div>
            </div>`;
    };

    const chartEl = document.getElementById('salesBreakdownChart');
    if(chartEl) {
        if(sales.total === 0) {
            chartEl.innerHTML = '<div style="text-align:center; color:#999; padding:10px;">매출 데이터 없음</div>';
        } else {
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

    const costListEl = document.getElementById('costBreakdownList');
    if(costListEl) {
        if(totalCost === 0) {
            costListEl.innerHTML = '<div style="text-align:center; color:#999; padding:10px;">지출 내역 없음</div>';
        } else {
            const meatLabel = (currentStore === 'yangeun') ? '🍞 SPC유통' : '🥩 한강유통';
            const costItems = [
                { label: meatLabel, val: costs.meat, color: '#ef5350' },
                { label: '🏠 임대료', val: costs.rent, color: '#5c6bc0' },
                { label: '👥 인건비', val: costs.staff, color: '#26a69a' },
                { label: '🍺 주류/음료', val: costs.liquor + costs.beverage, color: '#ff7043' },
                { label: '🥬 삼시세끼', val: costs.food, color: '#8d6e63' },
                { label: '💡 공과금', val: costs.utility + costs.gas, color: '#fdd835' },
                { label: '🍦 기타지출', val: costs.dailyEtc + costs.fixedEtc, color: '#bdbdbd' },
            ].sort((a,b) => b.val - a.val);

            let costHtml = '';
            costItems.forEach(item => {
                if (item.val > 0) {
                    costHtml += renderBar(item.label, item.val, item.color, totalCost, sales.total);
                }
            });
            costListEl.innerHTML = costHtml;
        }
    }
}

function loadMonthlyForm() {
    const monthStr = getMonthStr(currentDashboardDate);
    const mData = (accountingData.monthly && accountingData.monthly[monthStr]) ? accountingData.monthly[monthStr] : {};

    if(document.getElementById('fixRent')) document.getElementById('fixRent').value = mData.rent || '';
    if(document.getElementById('fixUtility')) document.getElementById('fixUtility').value = mData.utility || '';
    if(document.getElementById('fixGas')) document.getElementById('fixGas').value = mData.gas || '';
    if(document.getElementById('fixLiquor')) document.getElementById('fixLiquor').value = mData.liquor || '';
    if(document.getElementById('fixBeverage')) document.getElementById('fixBeverage').value = mData.beverage || '';
    if(document.getElementById('fixEtc')) document.getElementById('fixEtc').value = mData.etc_fixed || '';
}

// [수정] 충돌 해결된 고정비 저장 함수
async function saveFixedCost() {
    if (!currentUser) { openLoginModal(); return; }
    if (!['admin', 'manager'].includes(currentUser.role)) {
        alert("관리자 권한이 필요합니다.");
        return;
    }

    const monthStr = getMonthStr(currentDashboardDate);
    
    const rent = parseMoney(document.getElementById('fixRent').value);
    const utility = parseMoney(document.getElementById('fixUtility').value);
    const gas = parseMoney(document.getElementById('fixGas').value);
    const liquor = parseMoney(document.getElementById('fixLiquor').value);
    const beverage = parseMoney(document.getElementById('fixBeverage').value);
    const etc_fixed = parseMoney(document.getElementById('fixEtc').value);

    if(!confirm(`${monthStr} 고정 지출을 저장하시겠습니까?`)) return;

    const data = { rent, utility, gas, liquor, beverage, etc_fixed };

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

        if (!res.ok) throw new Error('Network response was not ok');
        const json = await res.json();
        
        if (!json.success) {
            throw new Error(json.message || '서버 저장 실패');
        }

        if(!accountingData.monthly) accountingData.monthly = {};
        accountingData.monthly[monthStr] = data;

        alert('성공적으로 저장되었습니다.');
        updateDashboardUI();
        
    } catch(e) {
        console.error('고정비 저장 에러:', e);
        alert('저장에 실패했습니다.\n사유: ' + e.message);
    }
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
// 6. 근무표 뷰 렌더링
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

function changeDate(d) { currentDate.setDate(currentDate.getDate() + d); renderDailyView(); }
function resetToToday() { currentDate = new Date(); renderDailyView(); }

function renderWeeklyView() {
    const startWeek = new Date(currentWeekStartDate);
    const endWeek = new Date(currentWeekStartDate);
    endWeek.setDate(endWeek.getDate() + 6);
    
    const rangeDisplay = document.getElementById('weeklyRangeDisplay');
    if(rangeDisplay) rangeDisplay.textContent = `${startWeek.getMonth()+1}월 ${startWeek.getDate()}일 ~ ${endWeek.getMonth()+1}월 ${endWeek.getDate()}일`;

    const realToday = new Date(); 
    DAY_KEYS.forEach(k => {
        const col = document.getElementById(`col-${k}`);
        if(col) { col.innerHTML = ''; col.classList.remove('today-highlight'); }
    });

    for (let i = 0; i < 7; i++) {
        const loopDate = new Date(currentWeekStartDate);
        loopDate.setDate(loopDate.getDate() + i);
        const dateStr = `${loopDate.getFullYear()}-${String(loopDate.getMonth() + 1).padStart(2, '0')}-${String(loopDate.getDate()).padStart(2, '0')}`;
        const dayKey = DAY_KEYS[i]; 

        if (loopDate.getDate() === realToday.getDate() && loopDate.getMonth() === realToday.getMonth()) {
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
                if (ex.type === 'work') { isWorking = true; workTime = ex.time; isException = true; }
                else if (ex.type === 'off') isWorking = false;
            } else {
                if (s.workDays.includes(dayKey)) isWorking = true;
            }

            if (isWorking) dayWorkers.push({ staff: s, time: workTime, isException });
        });

        dayWorkers.sort((a,b) => getStartTimeValue(a.time) - getStartTimeValue(b.time));

        const col = document.getElementById(`col-${dayKey}`);
        if(col) {
            dayWorkers.forEach(w => {
                const exceptionClass = w.isException ? 'exception' : '';
                col.innerHTML += `<div class="staff-card-weekly ${exceptionClass}"><strong>${w.staff.name}</strong><span>${w.time}</span></div>`;
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
        if (currentIterDate.getDate() === realToday.getDate() && currentIterDate.getMonth() === realToday.getMonth()) {
            dayClass += ' today-highlight';
        }

        container.innerHTML += `
            <div class="calendar-day ${dayClass}" onclick="goToDailyDetail(${year}, ${month}, ${day})">
                <span class="calendar-date-num">${day}</span>
                ${count > 0 ? `<span class="calendar-staff-count">근무 ${count}명</span>` : ''}
            </div>`;
    }
}
function changeMonth(d) { calendarDate.setMonth(calendarDate.getMonth() + d); renderMonthlyView(); }
function resetToThisMonth() { calendarDate = new Date(); renderMonthlyView(); }
function goToDailyDetail(year, month, day) {
    currentDate = new Date(year, month, day);
    switchTab('daily');
}

// ==========================================
// 7. 기타 기능
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
            if (sDate) { const start = new Date(sDate); start.setHours(0,0,0,0); if (t < start) return false; }
            if (eDate) { const end = new Date(eDate); end.setHours(0,0,0,0); if (t > end) return false; }
            return true;
        };

        if (s.salaryType === 'monthly') {
            let employedDays = 0;
            for (let d = 1; d <= totalDaysInMonth; d++) {
                if (isEmployedAt(new Date(year, month, d))) employedDays++;
            }
            let finalPay = s.salary || 0;
            let statusText = '만근';
            if (employedDays < totalDaysInMonth) {
                finalPay = Math.floor((s.salary / totalDaysInMonth) * employedDays);
                statusText = `${employedDays}일 재직 (일할)`;
            }
            salaryReport.push({ name: s.name, type: '월급', workCount: statusText, totalHours: '-', amount: finalPay });
        } else {
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
                } else {
                    if (s.workDays.includes(dayKey)) isWorking = true;
                }
                if (isWorking) { workCount++; totalHours += calculateDuration(timeStr); }
            }
            salaryReport.push({ name: s.name, type: '시급', workCount: workCount + '일', totalHours: totalHours.toFixed(1) + '시간', amount: Math.floor(totalHours * (s.salary || 0)) });
        }
    });

    const tbody = document.getElementById('salaryTableBody');
    tbody.innerHTML = '';
    let totalAll = 0;
    
    salaryReport.forEach(r => {
        totalAll += r.amount;
        tbody.innerHTML += `<tr><td>${r.name}</td><td>${r.type}</td><td>${r.workCount}<br>${r.type==='시급'?'('+r.totalHours+')':''}</td><td style="text-align:right;">${r.amount.toLocaleString()}원</td></tr>`;
    });
    document.getElementById('totalSalaryAmount').textContent = `총 지출 예상: ${totalAll.toLocaleString()}원`;
    document.getElementById('salaryModal').style.display = 'flex';
}

function closeSalaryModal() { document.getElementById('salaryModal').style.display = 'none'; }

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
            if (sDate) { const start = new Date(sDate); start.setHours(0,0,0,0); if (t < start) return false; }
            if (eDate) { const end = new Date(eDate); end.setHours(0,0,0,0); if (t > end) return false; }
            return true;
        };
        if (s.salaryType === 'monthly') {
            let employedDays = 0;
            for (let d = 1; d <= totalDaysInMonth; d++) {
                if (isEmployedAt(new Date(year, month-1, d))) employedDays++;
            }
            totalPay += (employedDays === totalDaysInMonth) ? (s.salary || 0) : Math.floor((s.salary || 0) / totalDaysInMonth * employedDays);
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
                } else { if (s.workDays.includes(dayName)) isWorking = true; }
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
        if (json.success) { alert('등록되었습니다.'); loadStaffData(); } else { alert('등록 실패'); }
    } catch(e) { alert('서버 오류'); }
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
                const date = new Date(log.timestamp).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
                tbody.innerHTML += `<tr><td>${date}</td><td>${log.actor}</td><td class="log-action-${log.action}">${log.action}</td><td>${log.target}</td><td>${log.details}</td></tr>`;
            });
        }
    } catch(e) { console.error("로그 로드 실패", e); }
}