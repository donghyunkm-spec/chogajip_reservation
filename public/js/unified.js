// unified.js - 통합분석 (사장님 전용)

// ==========================================
// 1. 전역 변수
// ==========================================
let uniDataChoga = null;
let uniDataYang = null;
let uniStaffChoga = [];
let uniStaffYang = [];
let currentUnifiedDate = new Date();

// ==========================================
// 2. 월 이동 함수
// ==========================================
function changeUnifiedMonth(delta) {
    currentUnifiedDate.setMonth(currentUnifiedDate.getMonth() + delta);
    loadUnifiedData();
}

function resetUnifiedMonth() {
    currentUnifiedDate = new Date();
    loadUnifiedData();
}

// ==========================================
// 3. 데이터 로드
// ==========================================
async function loadUnifiedData() {
    if (!currentUser || currentUser.role !== 'admin') {
        alert("사장님 전용 메뉴입니다.");
        return;
    }

    try {
        const [accChoga, accYang, staffChogaRes, staffYangRes] = await Promise.all([
            fetch('/api/accounting?store=chogazip').then(r => r.json()),
            fetch('/api/accounting?store=yangeun').then(r => r.json()),
            fetch('/api/staff?store=chogazip').then(r => r.json()),
            fetch('/api/staff?store=yangeun').then(r => r.json())
        ]);

        uniDataChoga = accChoga.data || { monthly: {}, daily: {} };
        uniDataYang = accYang.data || { monthly: {}, daily: {} };

        uniStaffChoga = staffChogaRes.data || [];
        uniStaffYang = staffYangRes.data || [];

        updateUnifiedView();
    } catch(e) {
        console.error("통합 데이터 로드 실패", e);
        alert("데이터를 불러오는데 실패했습니다.");
    }
}

// ==========================================
// 4. 서브탭 전환
// ==========================================
function switchUnifiedSubTab(subId, btn) {
    document.querySelectorAll('.uni-sub-content').forEach(el => el.style.display = 'none');
    document.getElementById(subId).style.display = 'block';

    const container = btn.parentElement;
    container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
}

// ==========================================
// 5. 통합 뷰 업데이트
// ==========================================
function updateUnifiedView() {
    const mode = document.getElementById('unifiedStoreSelect').value;
    const today = currentUnifiedDate;
    const monthStr = getMonthStr(today);

    const titleEl = document.getElementById('unifiedMonthTitle');
    if (titleEl) {
        titleEl.textContent = `${today.getFullYear()}년 ${today.getMonth() + 1}월`;
    }

    const datasets = [];
    if (mode === 'combined' || mode === 'chogazip') datasets.push({ acc: uniDataChoga, staff: uniStaffChoga, type: 'choga' });
    if (mode === 'combined' || mode === 'yangeun') datasets.push({ acc: uniDataYang, staff: uniStaffYang, type: 'yang' });

    let predStats = { meat:0, food:0, rent:0, utility:0, liquor:0, loan:0, delivery:0, staff:0, etc:0, insurance:0, advertising:0 };
    let totalSales = 0;

    let fullStats = { meat:0, food:0, rent:0, utility:0, liquor:0, loan:0, delivery:0, staff:0, etc:0, insurance:0, advertising:0 };

    const realToday = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    let appliedDay = lastDay;

    if (realToday.getFullYear() === currentYear && (realToday.getMonth() + 1) === currentMonth) {
        appliedDay = realToday.getDate();

        const todayKey = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(appliedDay).padStart(2,'0')}`;

        let todayTotalSales = 0;
        if (uniDataChoga && uniDataChoga.daily && uniDataChoga.daily[todayKey]) {
            todayTotalSales += (uniDataChoga.daily[todayKey].sales || 0);
        }
        if (uniDataYang && uniDataYang.daily && uniDataYang.daily[todayKey]) {
            todayTotalSales += (uniDataYang.daily[todayKey].sales || 0);
        }

        if (todayTotalSales === 0 && appliedDay > 1) {
            appliedDay = appliedDay - 1;
        }
    } else if (new Date(currentYear, currentMonth - 1, 1) > realToday) {
        appliedDay = 0;
    }

    const ratio = appliedDay / lastDay;

    datasets.forEach(ds => {
        const d = ds.acc;

        if (d.daily) {
            Object.keys(d.daily).forEach(date => {
                if(date.startsWith(monthStr)) {
                    const day = d.daily[date];
                    totalSales += (day.sales || 0);

                    const vMeat = (day.meat || 0);
                    const vFood = (day.food || 0);
                    const vEtc = (day.etc || 0);

                    predStats.meat += vMeat; predStats.food += vFood; predStats.etc += vEtc;
                    fullStats.meat += vMeat; fullStats.food += vFood; fullStats.etc += vEtc;
                }
            });
        }

        const staffFull = getEstimatedStaffCost(monthStr, ds.staff);
        const staffPred = Math.floor(staffFull * ratio);

        predStats.staff += staffPred;
        fullStats.staff += staffFull;

        if (d.monthly && d.monthly[monthStr]) {
            const m = d.monthly[monthStr];

            const vRent = (m.rent||0);
            const vUtil = (m.utility||0) + (m.gas||0) + (m.tableOrder||0) + (m.foodWaste||0);
            const vLiq = (m.liquor||0) + (m.beverage||0) + (m.makgeolli||0);
            const vLoan = (m.liquorLoan||0);
            const vDel = (m.deliveryFee||0);
            const vEtcFix = (m.businessCard||0) + (m.taxAgent||0) + (m.tax||0) + (m.etc_fixed||0) + (m.disposable||0);
            const vInsurance = (m.insurance||0);
            const vAdvertising = (m.advertising||0);

            predStats.liquor += vLiq;
            predStats.loan += vLoan;
            predStats.delivery += vDel;

            predStats.rent += Math.floor(vRent * ratio);
            predStats.utility += Math.floor(vUtil * ratio);
            predStats.etc += Math.floor(vEtcFix * ratio);
            predStats.insurance += Math.floor(vInsurance * ratio);
            predStats.advertising += Math.floor(vAdvertising * ratio);

            fullStats.rent += vRent;
            fullStats.utility += vUtil;
            fullStats.liquor += vLiq;
            fullStats.loan += vLoan;
            fullStats.delivery += vDel;
            fullStats.etc += vEtcFix;
            fullStats.insurance += vInsurance;
            fullStats.advertising += vAdvertising;
        }
    });

    // 예상 순익 렌더링
    const predCostTotal = Object.values(predStats).reduce((a,b)=>a+b, 0);
    const predProfit = totalSales - predCostTotal;
    const predMargin = totalSales > 0 ? ((predProfit / totalSales) * 100).toFixed(1) : 0;

    document.getElementById('uniPredSales').textContent = totalSales.toLocaleString() + '원';
    document.getElementById('uniPredCost').textContent = predCostTotal.toLocaleString() + '원';
    const predEl = document.getElementById('uniPredProfit');
    predEl.textContent = predProfit.toLocaleString() + '원';
    predEl.style.color = predProfit >= 0 ? '#fff' : '#ffab91';

    document.getElementById('uniPredMargin').innerHTML = `마진율: ${predMargin}% <span style="font-size:11px; opacity:0.7;">(${appliedDay}/${lastDay}일 기준)</span>`;

    renderDetailedCostChart('uniPredCostList', predStats, totalSales, predCostTotal);

    // 월간 분석 렌더링
    const fullCostTotal = Object.values(fullStats).reduce((a,b)=>a+b, 0);
    const fullProfit = totalSales - fullCostTotal;
    const fullMargin = totalSales > 0 ? ((fullProfit / totalSales) * 100).toFixed(1) : 0;

    document.getElementById('uniDashSales').textContent = totalSales.toLocaleString() + '원';
    document.getElementById('uniDashCost').textContent = fullCostTotal.toLocaleString() + '원';
    const dashEl = document.getElementById('uniDashProfit');
    dashEl.textContent = fullProfit.toLocaleString() + '원';
    dashEl.style.color = fullProfit >= 0 ? '#333' : 'red';
    document.getElementById('uniDashMargin').textContent = `실질마진: ${fullMargin}%`;

    let dashListEl = document.getElementById('uniDashCostList');
    if (!dashListEl) {
        const chartArea = document.getElementById('uniSalesChart');
        if(chartArea) {
            dashListEl = document.createElement('div');
            dashListEl.id = 'uniDashCostList';
            dashListEl.className = 'cost-list';
            dashListEl.style.marginBottom = '20px';
            chartArea.parentNode.insertBefore(dashListEl, chartArea);

            const title = document.createElement('h3');
            title.className = 'chart-title';
            title.textContent = '📉 전체 비용 구조 (고정비 100% 반영)';
            chartArea.parentNode.insertBefore(title, dashListEl);
        }
    }

    if(dashListEl) {
        renderDetailedCostChart('uniDashCostList', fullStats, totalSales, fullCostTotal);
    }
}

// ==========================================
// 6. 차트 렌더링
// ==========================================
function renderDetailedCostChart(containerId, stats, salesTotal, totalCost) {
    const el = document.getElementById(containerId);
    if(!el) return;

    const items = [
        { label: '🥩 고기/SPC', val: stats.meat, color: '#ef5350' },
        { label: '🥬 삼시세끼', val: stats.food, color: '#8d6e63' },
        { label: '🏠 임대료', val: stats.rent, color: '#ab47bc' },
        { label: '👥 인건비', val: stats.staff, color: '#ba68c8' },
        { label: '🛡️ 4대보험', val: stats.insurance || 0, color: '#7e57c2' },
        { label: '📢 광고비', val: stats.advertising || 0, color: '#26a69a' },
        { label: '💡 관리/공과', val: stats.utility, color: '#5c6bc0' },
        { label: '🍶 주류대출', val: stats.loan, color: '#ff9800' },
        { label: '🍺 주류/음료', val: stats.liquor, color: '#ce93d8' },
        { label: '🛵 배달수수료', val: stats.delivery, color: '#00bcd4' },
        { label: '🎸 기타통합', val: stats.etc, color: '#90a4ae' }
    ].sort((a,b) => b.val - a.val);

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

function renderUnifiedCostList(containerId, costs, ratio, salesTotal, totalCost) {
    const el = document.getElementById(containerId);
    if(!el) return;

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

function renderUnifiedSalesChart(types, total) {
    const el = document.getElementById('uniSalesChart');
    if(!el) return;

    if(total === 0) { el.innerHTML = '<div style="text-align:center; color:#999;">데이터 없음</div>'; return; }

    const renderBar = (l, v, c) => v > 0 ? `<div class="bar-row"><div class="bar-label">${l}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max((v/total)*100,1)}%; background:${c};"></div></div><div class="bar-value">${v.toLocaleString()}</div></div>` : '';

    el.innerHTML = `
        ${renderBar('💳 카드', types.card, '#42a5f5')}
        ${renderBar('📱 배달앱', types.app, '#2ac1bc')}
        ${renderBar('💵 현금', types.cash, '#66bb6a')}
        ${renderBar('🎫 기타', types.etc, '#ffa726')}
    `;
}
