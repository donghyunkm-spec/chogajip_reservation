// accounting.js - 가계부 (매출/지출/통계)

// ==========================================
// 1. 전역 변수
// ==========================================
window.accountingData = { daily: {}, monthly: {} };
let currentAccDate = new Date().toISOString().split('T')[0];
let currentDashboardDate = new Date();

// ==========================================
// 2. 월 이동 함수
// ==========================================
function changeAccMonth(delta) {
    currentDashboardDate.setMonth(currentDashboardDate.getMonth() + delta);
    loadAccountingData();
}

function resetAccMonth() {
    currentDashboardDate = new Date();
    loadAccountingData();
}

// ==========================================
// 3. 데이터 로드 및 UI 업데이트
// ==========================================
async function loadAccountingData() {
    if (!requireAuth()) { switchTab('daily'); return; }

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

// ==========================================
// 4. 일일 가계부
// ==========================================
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

        if(document.getElementById('cntBaemin')) document.getElementById('cntBaemin').value = dayData.baeminCount || 0;
        if(document.getElementById('cntYogiyo')) document.getElementById('cntYogiyo').value = dayData.yogiyoCount || 0;
        if(document.getElementById('cntCoupang')) document.getElementById('cntCoupang').value = dayData.coupangCount || 0;

    } else {
        if(document.getElementById('inpGift')) document.getElementById('inpGift').value = dayData.gift || '';
    }

    document.getElementById('inpStartCash').value = (dayData.startCash !== undefined) ? dayData.startCash : 100000;
    document.getElementById('inpCash').value = dayData.cash || '';
    document.getElementById('inpDeposit').value = dayData.bankDeposit || '';

    document.getElementById('inpFood').value = dayData.food || '';
    document.getElementById('inpMeat').value = dayData.meat || '';
    document.getElementById('inpEtc').value = dayData.etc || '';
    if(document.getElementById('inpMisc')) document.getElementById('inpMisc').value = dayData.misc || '';
    document.getElementById('inpNote').value = dayData.note || '';

    if(document.getElementById('inpReceiptCount')) document.getElementById('inpReceiptCount').value = dayData.receiptCount || 0;
    if(document.getElementById('inpDiscount')) document.getElementById('inpDiscount').value = dayData.discount || 0;
    if(document.getElementById('inpRefund')) document.getElementById('inpRefund').value = dayData.refund || 0;
    if(document.getElementById('inpVoid')) document.getElementById('inpVoid').value = dayData.void || 0;

    calcDrawerTotal();
}

function calcDrawerTotal() {
    const startCash = parseInt(document.getElementById('inpStartCash').value) || 0;
    const cashSales = parseInt(document.getElementById('inpCash').value) || 0;
    const transfer = parseInt(document.getElementById('inpTransfer').value) || 0;
    const deposit = parseInt(document.getElementById('inpDeposit').value) || 0;

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
    if (!requireAuth()) return;
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
    const misc = (document.getElementById('inpMisc') ? parseInt(document.getElementById('inpMisc').value) || 0 : 0);
    const note = document.getElementById('inpNote').value || '';

    const receiptCount = parseInt(document.getElementById('inpReceiptCount').value) || 0;
    const discount = parseInt(document.getElementById('inpDiscount').value) || 0;
    const refund = parseInt(document.getElementById('inpRefund').value) || 0;
    const voidVal = parseInt(document.getElementById('inpVoid').value) || 0;

    let card = 0, gift = 0, baemin = 0, yogiyo = 0, coupang = 0;
    let baeminCount = 0, yogiyoCount = 0, coupangCount = 0;
    let totalSales = 0;

    if (currentStore === 'yangeun') {
        card = parseInt(document.getElementById('inpCard').value) || 0;
        baemin = parseInt(document.getElementById('inpBaemin').value) || 0;
        yogiyo = parseInt(document.getElementById('inpYogiyo').value) || 0;
        coupang = parseInt(document.getElementById('inpCoupang').value) || 0;
        baeminCount = parseInt(document.getElementById('cntBaemin').value) || 0;
        yogiyoCount = parseInt(document.getElementById('cntYogiyo').value) || 0;
        coupangCount = parseInt(document.getElementById('cntCoupang').value) || 0;
        totalSales = card + cash + baemin + yogiyo + coupang;
    } else {
        card = parseInt(document.getElementById('inpCard').value) || 0;
        gift = parseInt(document.getElementById('inpGift').value) || 0;
        totalSales = card + cash + gift;
    }

    const totalCost = food + meat + etc + misc;

    if (totalSales === 0 && totalCost === 0) {
        if(!confirm(`${dateStr} 입력된 금액이 없습니다 (0원).\n그래도 저장하시겠습니까?`)) return;
    }

    const data = {
        startCash, cash, bankDeposit, card, transfer,
        gift: (currentStore === 'yangeun' ? 0 : gift),
        baemin, yogiyo, coupang,
        baeminCount, yogiyoCount, coupangCount,
        sales: totalSales, food, meat, etc, misc, cost: totalCost, note: note,
        receiptCount, discount, refund, void: voidVal
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

// ==========================================
// 5. 내역 조회
// ==========================================
function applyHistoryFilter() {
    const filterKey = document.getElementById('historyFilterSelect').value;
    loadHistoryTable(filterKey);
}

function loadHistoryTable(filterKey = 'all') {
    const monthStr = getMonthStr(currentDashboardDate);
    const tbody = document.getElementById('historyTableBody');
    const summaryDiv = document.getElementById('filterResultSummary');

    if(!tbody) return;
    tbody.innerHTML = '';

    let filteredSum = 0;
    let filteredCount = 0;

    const labelMap = {
        'card': '💳 카드', 'cash': '💵 현금', 'baemin': '🛵 배민',
        'yogiyo': '🛵 요기요', 'coupang': '🛵 쿠팡', 'gift': '🎫 기타',
        'meat': (currentStore === 'yangeun' ? '🍞 SPC' : '🥩 고기'),
        'food': '🥬 삼시세끼',
        'etc': (currentStore === 'yangeun' ? '🦪 막걸리/굴' : '🍦 잡비'),
        'misc': '🍦 기타잡비'
    };

    const rows = [];

    if (accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if (!date.startsWith(monthStr)) return;

            const d = accountingData.daily[date];

            if (filterKey !== 'all') {
                const targetValue = d[filterKey] || 0;
                if (targetValue === 0) return;

                filteredSum += targetValue;
                filteredCount++;
            }

            const totalSales = (d.sales||0);
            const totalCost = (d.cost||0);

            let details = [];

            if (filterKey !== 'all') {
                const val = d[filterKey] || 0;
                const label = labelMap[filterKey] || filterKey;
                details.push(`<span style="background:#fff9c4; color:#f57f17; padding:2px 4px; font-weight:bold; border-radius:3px; border:1px solid #fbc02d;">${label}: ${val.toLocaleString()}</span>`);
            } else {
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
                if(d.etc) {
                    const etcName = (currentStore === 'yangeun') ? '막걸리/굴' : '잡비';
                    details.push(`${etcName}:${d.etc.toLocaleString()}`);
                }
                if(d.misc) details.push(`기타잡비:${d.misc.toLocaleString()}`);
            }

            if(d.note) details.push(`📝"${escapeHtml(d.note)}"`);

            rows.push({
                date: date, dayStr: `${date.substring(8)}일`,
                sales: totalSales, cost: totalCost,
                desc: details.join(' / '), type: 'daily'
            });
        });
    }

    if (filterKey === 'all' && accountingData.monthly && accountingData.monthly[monthStr]) {
        const m = accountingData.monthly[monthStr];
        const fixedTotal = (m.rent||0) + (m.utility||0) + (m.gas||0) + (m.liquor||0) + (m.beverage||0) + (m.etc_fixed||0)
                         + (m.disposable||0) + (m.businessCard||0) + (m.taxAgent||0) + (m.tax||0) + (m.foodWaste||0) + (m.tableOrder||0) + (m.liquorLoan||0)
                         + (m.deliveryFee||0) + (m.insurance||0) + (m.advertising||0);

        if (fixedTotal > 0) {
            rows.push({
                date: `${monthStr}-99`, dayStr: `월말 고정`,
                sales: 0, cost: fixedTotal,
                desc: `<span style="color:#00796b; font-weight:bold;">[월 고정비 합계]</span>`,
                type: 'fixed'
            });
        }
    }

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#999;">해당 내역이 없습니다.</td></tr>';
        if(summaryDiv) summaryDiv.style.display = 'none';
        return;
    }

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

// ==========================================
// 6. 월 고정비
// ==========================================
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
    if(document.getElementById('fixInsurance')) document.getElementById('fixInsurance').value = mData.insurance || '';
    if(document.getElementById('fixAdvertising')) document.getElementById('fixAdvertising').value = mData.advertising || '';

    if(document.getElementById('fixAlcoholSales')) document.getElementById('fixAlcoholSales').value = mData.alcoholSales || '';
    if(document.getElementById('fixBeverageSales')) document.getElementById('fixBeverageSales').value = mData.beverageSales || '';
}

async function saveFixedCost() {
    if (!requireAuth()) return;
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
    const insurance = parseInt(document.getElementById('fixInsurance').value) || 0;
    const advertising = parseInt(document.getElementById('fixAdvertising').value) || 0;

    const alcoholSales = parseInt(document.getElementById('fixAlcoholSales').value) || 0;
    const beverageSales = parseInt(document.getElementById('fixBeverageSales').value) || 0;

    if(!confirm(`${monthStr} 고정 지출 및 매출 설정을 저장하시겠습니까?`)) return;

    const data = {
        rent, utility, gas, liquor, makgeolli, beverage, etc_fixed,
        disposable, businessCard, taxAgent, tax, foodWaste, tableOrder, liquorLoan, deliveryFee,
        insurance, advertising,
        alcoholSales, beverageSales
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

// ==========================================
// 7. 분석 및 통계
// ==========================================
function generateDetailAnalysisHtml(totalSales, varCost, deliverySales,
                                    alcSales, bevSales, alcCost, bevCost, delivCost,
                                    hallSales, hallCount, deliveryCount) {

    let html = `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">`;

    const hallAvg = hallCount > 0 ? Math.floor(hallSales / hallCount) : 0;
    const delivAvg = deliveryCount > 0 ? Math.floor(deliverySales / deliveryCount) : 0;

    html += createAnalysisCard('🍽️ 홀(매장) 평균단가',
        `홀 매출: ${hallSales.toLocaleString()}`,
        `테이블 수: ${hallCount}팀`,
        `객단가: <strong style="color:#1565c0; font-size:15px;">${hallAvg.toLocaleString()}원</strong>`, '#e3f2fd');

    if (currentStore === 'yangeun') {
        html += createAnalysisCard('🛵 배달 평균단가',
            `배달 매출: ${deliverySales.toLocaleString()}`,
            `주문 건수: ${deliveryCount}건`,
            `건단가: <strong style="color:#00695c; font-size:15px;">${delivAvg.toLocaleString()}원</strong>`, '#e0f2f1');
    } else {
         html += createAnalysisCard('📊 매출 분석',
            `총 매출: ${totalSales.toLocaleString()}`,
            `원가 합계: ${varCost.toLocaleString()}`,
            `-`, '#f5f5f5');
    }
    html += `</div>`;

    html += `<h4 style="color:#00796b; margin-bottom:10px; border-top:1px solid #eee; padding-top:15px;">🕵️ 유형별 원가/마진 분석</h4>`;
    html += `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">`;

    if (currentStore === 'yangeun') {
        const delRatio = deliverySales > 0 ? ((delivCost / deliverySales) * 100).toFixed(1) : '0.0';
        html += createAnalysisCard('🛵 배달 수수료 효율',
            `배달매출: ${deliverySales.toLocaleString()}`,
            `대행/수수료: ${delivCost.toLocaleString()}`,
            `비중: <strong>${delRatio}%</strong>`, '#e0f7fa');
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

    if (today.getFullYear() === currentYear && (today.getMonth() + 1) === currentMonth) {
        appliedDay = today.getDate();
        const todayStr = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        const todayData = (accountingData.daily && accountingData.daily[todayStr]) ? accountingData.daily[todayStr] : {};
        const todaySales = todayData.sales || 0;

        if (todaySales === 0 && appliedDay > 0) {
            appliedDay = appliedDay - 1;
        }
        ratio = appliedDay / lastDayOfThisMonth;
    } else if (new Date(currentYear, currentMonth - 1, 1) > today) {
        appliedDay = 0; ratio = 0;
    }

    const ratioText = `${appliedDay}/${lastDayOfThisMonth}`;
    if(document.getElementById('predDateRatio')) document.getElementById('predDateRatio').textContent = ratioText;
    if(document.getElementById('predCostText')) document.getElementById('predCostText').textContent = `(일할/실비 구분적용)`;

    const mData = (accountingData.monthly && accountingData.monthly[monthStr]) ? accountingData.monthly[monthStr] : {};

    let sales = { card: 0, cash: 0, delivery: 0, gift: 0, total: 0 };
    let variableCostTotal = 0;
    let deliverySalesTotal = 0;

    let totalReceiptCount = 0;
    let totalDeliveryCount = 0;

    if (accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if (date.startsWith(monthStr)) {
                const d = accountingData.daily[date];

                sales.card += (d.card || 0);
                sales.cash += (d.cash || 0);
                sales.gift += (d.gift || 0);

                const dayDelivery = (d.baemin || 0) + (d.yogiyo || 0) + (d.coupang || 0);
                sales.delivery += dayDelivery;

                variableCostTotal += (d.cost || 0);

                totalReceiptCount += (d.receiptCount || 0);
                totalDeliveryCount += (d.baeminCount || 0) + (d.yogiyoCount || 0) + (d.coupangCount || 0);
            }
        });
    }
    sales.total = sales.card + sales.cash + sales.delivery + sales.gift;
    deliverySalesTotal = sales.delivery;

    const timeBasedFixedRaw = (mData.rent||0) + (mData.utility||0) + (mData.gas||0)
                            + (mData.etc_fixed||0) + (mData.disposable||0) + (mData.businessCard||0)
                            + (mData.taxAgent||0) + (mData.tax||0) + (mData.foodWaste||0) + (mData.tableOrder||0)
                            + (mData.insurance||0) + (mData.advertising||0);

    const actualBasedFixed = (mData.liquor||0) + (mData.makgeolli||0) + (mData.beverage||0)
                           + (mData.liquorLoan||0) + (mData.deliveryFee||0);

    const estimatedStaffCostFull = getEstimatedStaffCost(monthStr);
    const appliedStaffCost = Math.floor(estimatedStaffCostFull * ratio);
    const appliedTimeBased = Math.floor(timeBasedFixedRaw * ratio);

    const totalCurrentCost = variableCostTotal + appliedTimeBased + actualBasedFixed + appliedStaffCost;
    const netProfit = sales.total - totalCurrentCost;
    const margin = sales.total > 0 ? ((netProfit / sales.total) * 100).toFixed(1) : 0;

    document.getElementById('predTotalSales').textContent = sales.total.toLocaleString() + '원';
    document.getElementById('predTotalCost').textContent = totalCurrentCost.toLocaleString() + '원';

    const profitEl = document.getElementById('predNetProfit');
    profitEl.textContent = netProfit.toLocaleString() + '원';
    profitEl.style.color = netProfit >= 0 ? '#fff' : '#ffab91';
    document.getElementById('predMargin').textContent = `보정 마진율: ${margin}%`;

    renderGroupedSalesChart('predSalesChart', sales);
    renderPredictionCostList('predCostList', {
        meat: getVariableCostSum(monthStr, 'meat'),
        food: getVariableCostSum(monthStr, 'food'),
        etc: getVariableCostSum(monthStr, 'etc'),
        rent: Math.floor((mData.rent||0) * ratio),
        staff: appliedStaffCost,
        delivery: mData.deliveryFee || 0,
        liquor: (mData.liquor||0) + (mData.makgeolli||0) + (mData.beverage||0) + (mData.liquorLoan||0),
        utility: Math.floor(((mData.utility||0) + (mData.gas||0)) * ratio),
        insurance: Math.floor((mData.insurance||0) * ratio),
        advertising: Math.floor((mData.advertising||0) * ratio),
        others: Math.floor(((mData.businessCard||0) + (mData.taxAgent||0) + (mData.tax||0) + (mData.tableOrder||0) + (mData.etc_fixed||0) + (mData.foodWaste||0) + (mData.disposable||0)) * ratio)
    }, sales.total, totalCurrentCost);

    const analysisContainer = document.getElementById('predDetailAnalysis');
    if (analysisContainer) {
        const alcoholSales = mData.alcoholSales || 0;
        const beverageSales = mData.beverageSales || 0;

        const liquorCost = (mData.liquor||0) + (mData.makgeolli||0);

        const beverageCost = mData.beverage || 0;
        const deliveryFee = mData.deliveryFee || 0;

        analysisContainer.innerHTML = generateDetailAnalysisHtml(
            sales.total, variableCostTotal, deliverySalesTotal,
            alcoholSales, beverageSales,
            liquorCost, beverageCost, deliveryFee,
            sales.card + sales.cash,
            totalReceiptCount,
            totalDeliveryCount
        );
    }
}

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

function renderPredictionCostList(containerId, costs, salesTotal, totalCost) {
    const el = document.getElementById(containerId);
    if(!el) return;

    const meatLabel = (currentStore === 'yangeun') ? '🍞 SPC유통' : '🥩 한강유통';
    const items = [
        { label: meatLabel, val: costs.meat, color: '#ef5350' },
        { label: '🥬 삼시세끼', val: costs.food, color: '#8d6e63' },
        { label: '🛵 배달수수료', val: costs.delivery, color: '#00bcd4' },
        { label: '🍶 주류/대출', val: costs.liquor, color: '#ce93d8' },
        { label: '👥 인건비(N)', val: costs.staff, color: '#ba68c8' },
        { label: '🏠 임대료(N)', val: costs.rent, color: '#ab47bc' },
        { label: '🛡️ 4대보험(N)', val: costs.insurance || 0, color: '#7e57c2' },
        { label: '📢 광고비(N)', val: costs.advertising || 0, color: '#26a69a' },
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

function renderDashboardStats() {
    const monthStr = getMonthStr(currentDashboardDate);
    const mData = (accountingData.monthly && accountingData.monthly[monthStr]) ? accountingData.monthly[monthStr] : {};

    let sales = { card:0, cash:0, delivery:0, gift:0, total:0 };
    let variableCostTotal = 0;

    let totalReceiptCount = 0;
    let totalDeliveryCount = 0;

    if (accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if (date.startsWith(monthStr)) {
                const d = accountingData.daily[date];
                sales.card += (d.card||0);
                sales.cash += (d.cash||0);
                sales.gift += (d.gift||0);

                const dayDelivery = (d.baemin||0) + (d.yogiyo||0) + (d.coupang||0);
                sales.delivery += dayDelivery;

                variableCostTotal += (d.cost || 0);

                totalReceiptCount += (d.receiptCount || 0);
                totalDeliveryCount += (d.baeminCount || 0) + (d.yogiyoCount || 0) + (d.coupangCount || 0);
            }
        });
    }
    sales.total = sales.card + sales.cash + sales.delivery + sales.gift;

    const staffCost = getEstimatedStaffCost(monthStr);
    const fixedTotal = (mData.rent||0) + (mData.utility||0) + (mData.gas||0) + (mData.liquor||0) + (mData.makgeolli||0)
                     + (mData.beverage||0) + (mData.etc_fixed||0) + staffCost
                     + (mData.disposable||0) + (mData.businessCard||0) + (mData.taxAgent||0)
                     + (mData.tax||0) + (mData.foodWaste||0) + (mData.tableOrder||0) + (mData.liquorLoan||0)
                     + (mData.deliveryFee||0) + (mData.insurance||0) + (mData.advertising||0);

    const totalCost = fixedTotal + variableCostTotal;
    const netProfit = sales.total - totalCost;
    const margin = sales.total > 0 ? ((netProfit / sales.total) * 100).toFixed(1) : 0;

    document.getElementById('dashTotalSales').textContent = sales.total.toLocaleString() + '원';
    document.getElementById('dashTotalCost').textContent = totalCost.toLocaleString() + '원';

    const profitEl = document.getElementById('dashNetProfit');
    profitEl.textContent = netProfit.toLocaleString() + '원';
    profitEl.style.color = netProfit >= 0 ? '#fff' : '#ffab91';
    document.getElementById('dashMargin').textContent = `순이익률: ${margin}%`;
    document.getElementById('dashStaffCost').textContent = staffCost.toLocaleString();

    let bepMsg = netProfit > 0 ? `🎉 흑자 달성! (+${netProfit.toLocaleString()}원)` : `⚠️ 손익분기까지 ${Math.abs(netProfit).toLocaleString()}원 남음`;
    document.getElementById('dashBreakEven').textContent = bepMsg;

    renderGroupedSalesChart('salesBreakdownChart', sales);
    renderCostList('costBreakdownList', mData, staffCost, 1.0, sales.total, totalCost, monthStr);

    const analysisContainer = document.getElementById('dashDetailAnalysis');
    if (analysisContainer) {
        const alcoholSales = mData.alcoholSales || 0;
        const beverageSales = mData.beverageSales || 0;

        const liquorCost = (mData.liquor || 0) + (mData.makgeolli || 0);

        const beverageCost = mData.beverage || 0;
        const deliveryFee = mData.deliveryFee || 0;

        analysisContainer.innerHTML = generateDetailAnalysisHtml(
            sales.total, variableCostTotal, sales.delivery,
            alcoholSales, beverageSales,
            liquorCost, beverageCost, deliveryFee,
            sales.card + sales.cash,
            totalReceiptCount,
            totalDeliveryCount
        );
    }
}

function renderCostList(containerId, mData, staffCost, ratio, salesTotal, totalCost, monthStr) {
    const el = document.getElementById(containerId);
    if(!el) return;

    if(totalCost === 0) { el.innerHTML = '<div style="text-align:center; padding:10px; color:#999;">데이터 없음</div>'; return; }

    let cMeat = 0, cFood = 0, cEtc = 0, cMisc = 0;
    if (accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if (date.startsWith(monthStr)) {
                cMeat += (accountingData.daily[date].meat||0);
                cFood += (accountingData.daily[date].food||0);
                cEtc += (accountingData.daily[date].etc||0);
                cMisc += (accountingData.daily[date].misc||0);
            }
        });
    }

    const fRent = Math.floor((mData.rent||0) * ratio);
    const fStaff = Math.floor(staffCost * ratio);
    const fLiquor = Math.floor(((mData.liquor||0) + (mData.makgeolli||0) + (mData.beverage||0)) * ratio);
    const fUtility = Math.floor(((mData.utility||0) + (mData.gas||0)) * ratio);
    const fLoan = Math.floor((mData.liquorLoan||0) * ratio);
    const fDelivery = Math.floor((mData.deliveryFee||0) * ratio);
    const fInsurance = Math.floor((mData.insurance||0) * ratio);
    const fAdvertising = Math.floor((mData.advertising||0) * ratio);
    const fOthers = Math.floor(((mData.businessCard||0) + (mData.taxAgent||0) + (mData.tax||0) + (mData.tableOrder||0) + (mData.etc_fixed||0) + (mData.disposable||0) + (mData.foodWaste||0)) * ratio);

    const meatLabel = (currentStore === 'yangeun') ? '🍞 SPC유통' : '🥩 한강유통';
    const etcLabel = (currentStore === 'yangeun') ? '🦪 막걸리/굴' : '🍦 일일잡비';

    const items = [
        { label: meatLabel, val: cMeat, color: '#ef5350' },
        { label: '🥬 삼시세끼', val: cFood, color: '#8d6e63' },
        { label: etcLabel, val: cEtc, color: '#78909c' },
        { label: '🍦 기타잡비', val: cMisc, color: '#9e9e9e' },
        { label: '🏠 임대료', val: fRent, color: '#ab47bc' },
        { label: '👥 인건비', val: fStaff, color: '#ba68c8' },
        { label: '🛡️ 4대보험', val: fInsurance, color: '#7e57c2' },
        { label: '📢 광고비', val: fAdvertising, color: '#26a69a' },
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

function renderDashboardCharts(sales, totalCost, mData, staffCost, variableCostTotal, monthStr) {
    const chartEl = document.getElementById('salesBreakdownChart');
    if(chartEl) {
        if(sales.total === 0) chartEl.innerHTML = '<div style="text-align:center; color:#999;">데이터 없음</div>';
        else {
            const renderBar = (l, v, c) => v > 0 ? `<div class="bar-row"><div class="bar-label">${l}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max((v/sales.total)*100,1)}%; background:${c};"></div></div><div class="bar-value">${v.toLocaleString()}</div></div>` : '';

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
// 8. 회계 로그
// ==========================================
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
                        <td>${escapeHtml(log.actor)}</td>
                        <td class="log-action-${escapeHtml(log.action)}">${escapeHtml(log.action)}</td>
                        <td>${escapeHtml(log.target)}</td>
                        <td>${escapeHtml(log.details)}</td>
                    </tr>`;
            });
        }
    } catch(e) { console.error("회계 로그 로드 실패", e); }
}
