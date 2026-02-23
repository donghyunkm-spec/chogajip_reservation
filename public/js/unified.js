// unified.js - 통합분석 (사장님 전용)

// ==========================================
// 1. 전역 변수
// ==========================================
let uniDataChoga = null;
let uniDataYang = null;
let uniStaffChoga = [];
let uniStaffYang = [];
let currentUnifiedDate = new Date();

// POS 분석 관련 전역 변수
let posProductsData = null;
let posReceiptsData = null;
let posChartInstances = {};
let posDataLoaded = { chogazip: false, yangeun: false };
let currentPosStore = 'chogazip'; // 현재 선택된 POS 매장

// 운영노트 관련 전역 변수
let allNotes = [];
let currentNoteFilter = 'all';

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

        // POS 데이터도 서버에서 불러오기 (현재 선택된 매장)
        if (!posDataLoaded[currentPosStore]) {
            loadPosDataFromServer(currentPosStore);
        }
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

// ==========================================
// 7. POS 분석 기능
// ==========================================

// 매장 전환 함수
function switchPosStore(store, btn) {
    // 같은 매장이면 무시
    if (currentPosStore === store) return;

    currentPosStore = store;

    // 탭 활성화 스타일
    document.querySelectorAll('.pos-store-tab').forEach(t => {
        t.classList.remove('active', 'yangeun');
    });
    btn.classList.add('active');
    if (store === 'yangeun') btn.classList.add('yangeun');

    // UI 및 데이터 초기화
    resetPosUI();

    // 해당 매장 데이터 로드 (강제 새로고침)
    posDataLoaded[store] = false;
    loadPosDataFromServer(store);
}

// POS UI 초기화
function resetPosUI() {
    posProductsData = null;
    posReceiptsData = null;

    // 파일 상태 초기화
    const productsStatus = document.getElementById('productsFileStatus');
    const receiptsStatus = document.getElementById('receiptsFileStatus');
    const productsBox = document.getElementById('productsUploadBox');
    const receiptsBox = document.getElementById('receiptsUploadBox');

    if (productsStatus) productsStatus.textContent = '';
    if (receiptsStatus) receiptsStatus.textContent = '';
    if (productsBox) productsBox.classList.remove('file-loaded');
    if (receiptsBox) receiptsBox.classList.remove('file-loaded');

    // 분석 결과 숨기기
    const resultArea = document.getElementById('posResultArea');
    if (resultArea) resultArea.style.display = 'none';

    // 차트 제거
    Object.values(posChartInstances).forEach(chart => {
        if (chart) chart.destroy();
    });
    posChartInstances = {};

    checkAnalyzeButtonState();
}

// 서버에서 저장된 POS 데이터 불러오기
async function loadPosDataFromServer(store) {
    const targetStore = store || currentPosStore;
    const requestedStore = targetStore; // 요청 시점의 매장 저장

    try {
        const res = await fetch(`/api/pos-data?store=${targetStore}`);

        // 응답 처리 전에 매장이 변경되었는지 확인 (race condition 방지)
        if (currentPosStore !== requestedStore) {
            console.log(`[POS] 매장 변경됨 (${requestedStore} → ${currentPosStore}), 응답 무시`);
            return;
        }

        const result = await res.json();

        if (result.success && result.data) {
            const { products, receipts, updatedAt } = result.data;

            if (products && products.length > 0) {
                posProductsData = products;
                const statusEl = document.getElementById('productsFileStatus');
                const boxEl = document.getElementById('productsUploadBox');
                if (statusEl) statusEl.textContent = `✓ 저장된 데이터 ${products.length}개 상품`;
                if (boxEl) boxEl.classList.add('file-loaded');
            }

            if (receipts && receipts.length > 0) {
                posReceiptsData = receipts;
                const statusEl = document.getElementById('receiptsFileStatus');
                const boxEl = document.getElementById('receiptsUploadBox');
                if (statusEl) statusEl.textContent = `✓ 저장된 데이터 ${receipts.length}건 영수증`;
                if (boxEl) boxEl.classList.add('file-loaded');
            }

            if (updatedAt) {
                const date = new Date(updatedAt);
                console.log(`[POS] ${targetStore} 저장된 데이터 로드됨 (${date.toLocaleString()})`);
            }

            checkAnalyzeButtonState();
            posDataLoaded[targetStore] = true;
        }
    } catch (e) {
        console.error('[POS] 서버 데이터 로드 실패:', e);
    }
}

// 서버에 POS 데이터 저장 (타입 지정: 'products', 'receipts', 'both')
async function savePosDataToServer(type) {
    try {
        const payload = { store: currentPosStore };

        // 명시적으로 해당 타입만 전송
        if (type === 'products') {
            payload.products = posProductsData;
        } else if (type === 'receipts') {
            payload.receipts = posReceiptsData;
        } else {
            // 'both' 또는 미지정 시 둘 다
            payload.products = posProductsData;
            payload.receipts = posReceiptsData;
        }

        const res = await fetch('/api/pos-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.success) {
            console.log(`[POS] ${currentPosStore} 서버에 ${type || 'all'} 데이터 저장 완료`);
        }
    } catch (e) {
        console.error('[POS] 서버 저장 실패:', e);
    }
}

// 엑셀 파일 업로드 처리
function handlePosFileUpload(type, input) {
    const file = input.files[0];
    if (!file) return;

    const statusEl = document.getElementById(type + 'FileStatus');
    const boxEl = document.getElementById(type + 'UploadBox');

    statusEl.textContent = '파싱 중...';
    statusEl.classList.remove('error');

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                throw new Error('데이터가 없습니다');
            }

            // "합계" 행 제외
            const filteredData = jsonData.filter(row => {
                const firstVal = String(Object.values(row)[0] || '').trim();
                return firstVal !== '합계' && firstVal !== 'total' && firstVal !== 'Total';
            });

            console.log(`[POS] ${type} 파일 파싱 완료:`, filteredData.length, '행');
            console.log('[POS] 컬럼명:', Object.keys(filteredData[0] || {}));

            if (type === 'products') {
                posProductsData = normalizeProductsData(filteredData);
                console.log('[POS] 상품 데이터 샘플:', posProductsData.slice(0, 3));
                statusEl.textContent = `✓ ${posProductsData.length}개 상품 로드됨`;
            } else {
                posReceiptsData = normalizeReceiptsData(filteredData);
                console.log('[POS] 영수증 데이터 샘플:', posReceiptsData.slice(0, 3));
                statusEl.textContent = `✓ ${posReceiptsData.length}건 영수증 로드됨`;
            }

            boxEl.classList.add('file-loaded');
            checkAnalyzeButtonState();

            // 서버에 해당 타입만 저장
            savePosDataToServer(type);

        } catch (err) {
            console.error('파일 파싱 오류:', err);
            statusEl.textContent = '❌ 파일 형식 오류';
            statusEl.classList.add('error');
            if (type === 'products') {
                posProductsData = null;
            } else {
                posReceiptsData = null;
            }
            boxEl.classList.remove('file-loaded');
            checkAnalyzeButtonState();
        }
    };
    reader.readAsArrayBuffer(file);
}

// 상품 데이터 정규화 (다양한 컬럼명 지원)
function normalizeProductsData(data) {
    return data.map(row => {
        const productName = row['상품명'] || row['product_name'] || row['메뉴명'] || row['품명'] || '';
        const category = row['대분류'] || row['카테고리'] || row['category'] || row['분류'] || '기타';
        const quantity = parseInt(row['판매수'] || row['수량'] || row['quantity'] || row['판매수량'] || row['판매량'] || 0);
        // "결제 합계" 컬럼 (공백 포함) 지원
        const sales = parseInt(row['결제 합계'] || row['결제합계'] || row['매출액'] || row['sales'] || row['금액'] || row['매출'] || 0);

        return {
            productName: String(productName).trim(),
            category: String(category).trim(),
            quantity: isNaN(quantity) ? 0 : quantity,
            sales: isNaN(sales) ? 0 : sales
        };
    }).filter(item => item.productName && item.sales > 0);
}

// 영수증 데이터 정규화
function normalizeReceiptsData(data) {
    return data.map(row => {
        // "판매일시" 컬럼 지원 (예: "2026-02-07 19:40:58")
        const dateTimeRaw = row['판매일시'] || row['날짜'] || row['date'] || row['거래일'] || row['판매일'] || '';
        const timeRaw = row['시간'] || row['time'] || row['거래시간'] || row['판매시간'] || '';

        // 금액 - "결제 합계" 컬럼 (공백 포함)
        const amount = parseInt(row['결제 합계'] || row['결제합계'] || row['총금액'] || row['amount'] || row['결제금액'] || row['금액'] || row['판매금액'] || 0);

        // 결제수단 판단 (현금/카드 컬럼이 별도로 있는 경우)
        const cashAmount = parseInt(row['현금'] || 0);
        const cardAmount = parseInt(row['카드'] || 0);
        let paymentMethod = row['결제수단'] || row['payment_method'] || row['결제방법'] || row['지불방법'] || '';

        // 현금/카드 컬럼이 있으면 그걸로 결제수단 판단
        if (!paymentMethod && (cashAmount > 0 || cardAmount > 0)) {
            if (cardAmount > 0 && cashAmount === 0) {
                paymentMethod = '카드';
            } else if (cashAmount > 0 && cardAmount === 0) {
                paymentMethod = '현금';
            } else if (cashAmount > 0 && cardAmount > 0) {
                paymentMethod = '복합';
            }
        }
        if (!paymentMethod) paymentMethod = '기타';

        // 날짜/시간 파싱
        let dateStr = '', hour = 0;

        if (dateTimeRaw) {
            if (typeof dateTimeRaw === 'number') {
                // Excel 날짜/시간 숫자 처리
                const excelDate = new Date((dateTimeRaw - 25569) * 86400 * 1000);
                dateStr = excelDate.toISOString().split('T')[0];
                hour = excelDate.getHours();
            } else {
                const dtStr = String(dateTimeRaw);
                // "2026-02-07 19:40:58" 형식 파싱
                const parts = dtStr.split(' ');
                dateStr = parts[0] || '';
                if (parts[1]) {
                    const timeParts = parts[1].split(':');
                    hour = parseInt(timeParts[0]) || 0;
                }
            }
        }

        // 별도 시간 컬럼이 있는 경우
        if (timeRaw && hour === 0) {
            if (typeof timeRaw === 'number') {
                hour = Math.floor(timeRaw * 24);
            } else {
                const timeParts = String(timeRaw).match(/(\d+)/);
                hour = timeParts ? parseInt(timeParts[1]) : 0;
            }
        }

        // 요일 계산
        let weekday = 0;
        if (dateStr) {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                weekday = d.getDay(); // 0=일, 1=월, ...
            }
        }

        return {
            date: dateStr,
            hour: hour,
            weekday: weekday,
            paymentMethod: String(paymentMethod).trim(),
            amount: isNaN(amount) ? 0 : amount,
            cashAmount: isNaN(cashAmount) ? 0 : cashAmount,
            cardAmount: isNaN(cardAmount) ? 0 : cardAmount
        };
    }).filter(item => item.amount > 0);
}

// 분석 버튼 활성화 체크
function checkAnalyzeButtonState() {
    const btn = document.getElementById('posAnalyzeBtn');
    if (btn) {
        btn.disabled = !(posProductsData || posReceiptsData);
    }
}

// 분석 시작
function analyzePosData() {
    if (!posProductsData && !posReceiptsData) {
        alert('최소 하나의 파일을 업로드해주세요.');
        return;
    }

    document.getElementById('posResultArea').style.display = 'block';

    // 통계 계산
    const stats = {
        totalSales: 0,
        receiptCount: 0,
        avgTicket: 0,
        peakHour: 0,
        peakHourSales: 0
    };

    // 영수증 데이터 분석
    if (posReceiptsData && posReceiptsData.length > 0) {
        const receiptStats = analyzeReceipts();
        stats.totalSales = receiptStats.totalSales;
        stats.receiptCount = receiptStats.receiptCount;
        stats.avgTicket = receiptStats.avgTicket;
        stats.peakHour = receiptStats.peakHour;
        stats.peakHourSales = receiptStats.peakHourSales;
    } else if (posProductsData) {
        // 상품 데이터만 있는 경우
        stats.totalSales = posProductsData.reduce((sum, p) => sum + p.sales, 0);
    }

    // KPI 렌더링
    renderPosKPIs(stats);

    // 차트 렌더링
    if (posReceiptsData) {
        renderHourlySalesChart();
        renderPaymentMethodChart();
        renderWeekdaySalesChart();
        renderPosMonthlyTrendChart(); // 월별 매출 추이
    }

    if (posProductsData) {
        renderTopProductsChart();
        renderCategorySalesChart();
    }

    // 인사이트 생성
    generatePosInsights(stats);
}

// 영수증 통계 분석
function analyzeReceipts() {
    const hourlyData = {};
    let totalSales = 0;

    posReceiptsData.forEach(r => {
        totalSales += r.amount;
        if (!hourlyData[r.hour]) {
            hourlyData[r.hour] = { sales: 0, count: 0 };
        }
        hourlyData[r.hour].sales += r.amount;
        hourlyData[r.hour].count += 1;
    });

    // 피크 타임 찾기
    let peakHour = 0;
    let peakHourSales = 0;
    Object.keys(hourlyData).forEach(h => {
        if (hourlyData[h].sales > peakHourSales) {
            peakHour = parseInt(h);
            peakHourSales = hourlyData[h].sales;
        }
    });

    return {
        totalSales: totalSales,
        receiptCount: posReceiptsData.length,
        avgTicket: Math.round(totalSales / posReceiptsData.length),
        peakHour: peakHour,
        peakHourSales: peakHourSales
    };
}

// KPI 렌더링
function renderPosKPIs(stats) {
    document.getElementById('posTotalSales').textContent = stats.totalSales.toLocaleString() + '원';
    document.getElementById('posReceiptCount').textContent = stats.receiptCount.toLocaleString() + '건';
    document.getElementById('posAvgTicket').textContent = stats.avgTicket.toLocaleString() + '원';
    document.getElementById('posPeakTime').textContent = stats.peakHour ? `${stats.peakHour}시` : '-';
}

// 시간대별 매출 차트 (Bar + Line 복합)
function renderHourlySalesChart() {
    const ctx = document.getElementById('posHourlyChart');
    if (!ctx) return;

    // 기존 차트 제거
    if (posChartInstances.hourly) {
        posChartInstances.hourly.destroy();
    }

    // 시간대별 집계
    const hourlyData = {};
    for (let i = 0; i < 24; i++) {
        hourlyData[i] = { sales: 0, count: 0 };
    }

    posReceiptsData.forEach(r => {
        if (hourlyData[r.hour]) {
            hourlyData[r.hour].sales += r.amount;
            hourlyData[r.hour].count += 1;
        }
    });

    const labels = [];
    const salesData = [];
    const countData = [];

    // 영업시간대만 표시 (10시~24시)
    for (let i = 10; i < 24; i++) {
        labels.push(`${i}시`);
        salesData.push(hourlyData[i].sales);
        countData.push(hourlyData[i].count);
    }

    posChartInstances.hourly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '매출액',
                    data: salesData,
                    backgroundColor: 'rgba(33, 150, 243, 0.7)',
                    borderColor: '#2196f3',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: '건수',
                    data: countData,
                    type: 'line',
                    borderColor: '#ff9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.2)',
                    borderWidth: 2,
                    fill: false,
                    yAxisID: 'y1',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === '매출액') {
                                return `매출: ${context.raw.toLocaleString()}원`;
                            }
                            return `건수: ${context.raw}건`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: '매출액 (원)' },
                    ticks: {
                        callback: function(value) {
                            return (value / 10000).toFixed(0) + '만';
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: '건수' },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

// TOP 10 상품 차트
function renderTopProductsChart() {
    const ctx = document.getElementById('posTopProductsChart');
    if (!ctx) return;

    if (posChartInstances.topProducts) {
        posChartInstances.topProducts.destroy();
    }

    // 매출 기준 정렬
    const sorted = [...posProductsData].sort((a, b) => b.sales - a.sales).slice(0, 10);

    posChartInstances.topProducts = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(p => p.productName.length > 10 ? p.productName.slice(0, 10) + '...' : p.productName),
            datasets: [{
                label: '매출액',
                data: sorted.map(p => p.sales),
                backgroundColor: [
                    '#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1',
                    '#1e88e5', '#5e35b1', '#8e24aa', '#d81b60', '#6d4c41'
                ]
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const product = sorted[context.dataIndex];
                            return [`매출: ${context.raw.toLocaleString()}원`, `수량: ${product.quantity}개`];
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        callback: function(value) {
                            return (value / 10000).toFixed(0) + '만';
                        }
                    }
                }
            }
        }
    });
}

// 카테고리별 매출 차트 (도넛)
function renderCategorySalesChart() {
    const ctx = document.getElementById('posCategoryChart');
    if (!ctx) return;

    if (posChartInstances.category) {
        posChartInstances.category.destroy();
    }

    // 카테고리별 집계
    const categoryData = {};
    posProductsData.forEach(p => {
        if (!categoryData[p.category]) {
            categoryData[p.category] = 0;
        }
        categoryData[p.category] += p.sales;
    });

    const sorted = Object.entries(categoryData).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((sum, [, val]) => sum + val, 0);

    posChartInstances.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sorted.map(([cat]) => cat),
            datasets: [{
                data: sorted.map(([, val]) => val),
                backgroundColor: [
                    '#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1',
                    '#1e88e5', '#5e35b1', '#8e24aa', '#d81b60', '#6d4c41'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { boxWidth: 12, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const pct = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${context.raw.toLocaleString()}원 (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 결제수단별 차트 (파이)
function renderPaymentMethodChart() {
    const ctx = document.getElementById('posPaymentChart');
    if (!ctx) return;

    if (posChartInstances.payment) {
        posChartInstances.payment.destroy();
    }

    // 결제수단별 집계 - 현금/카드 금액이 별도로 있으면 그걸 사용
    const paymentData = { '카드': 0, '현금': 0, '기타': 0 };

    posReceiptsData.forEach(r => {
        // 현금/카드 금액이 별도로 있는 경우
        if (r.cardAmount > 0 || r.cashAmount > 0) {
            paymentData['카드'] += r.cardAmount || 0;
            paymentData['현금'] += r.cashAmount || 0;
            // 기타 = 총액 - 카드 - 현금
            const etc = r.amount - (r.cardAmount || 0) - (r.cashAmount || 0);
            if (etc > 0) paymentData['기타'] += etc;
        } else {
            // 결제수단 텍스트로 판단
            const method = normalizePaymentMethod(r.paymentMethod);
            if (!paymentData[method]) {
                paymentData[method] = 0;
            }
            paymentData[method] += r.amount;
        }
    });

    // 0인 항목 제거
    const filtered = Object.entries(paymentData).filter(([, val]) => val > 0);
    const sorted = filtered.sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((sum, [, val]) => sum + val, 0);

    posChartInstances.payment = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: sorted.map(([method]) => method),
            datasets: [{
                data: sorted.map(([, val]) => val),
                backgroundColor: ['#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#607d8b']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { boxWidth: 12, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const pct = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${context.raw.toLocaleString()}원 (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 결제수단 정규화
function normalizePaymentMethod(method) {
    const m = method.toLowerCase();
    if (m.includes('카드') || m.includes('card') || m.includes('신용')) return '카드';
    if (m.includes('현금') || m.includes('cash')) return '현금';
    if (m.includes('배민') || m.includes('배달의민족')) return '배민';
    if (m.includes('요기요')) return '요기요';
    if (m.includes('쿠팡') || m.includes('coupang')) return '쿠팡이츠';
    if (m.includes('계좌') || m.includes('이체')) return '계좌이체';
    return '기타';
}

// 요일별 매출 차트
function renderWeekdaySalesChart() {
    const ctx = document.getElementById('posWeekdayChart');
    if (!ctx) return;

    if (posChartInstances.weekday) {
        posChartInstances.weekday.destroy();
    }

    // 요일별 집계
    const weekdayData = [0, 0, 0, 0, 0, 0, 0]; // 일~토
    const weekdayCount = [0, 0, 0, 0, 0, 0, 0];

    posReceiptsData.forEach(r => {
        weekdayData[r.weekday] += r.amount;
        weekdayCount[r.weekday] += 1;
    });

    const labels = ['일', '월', '화', '수', '목', '금', '토'];
    const colors = weekdayData.map((_, i) => {
        if (i === 0) return '#e53935'; // 일요일 빨강
        if (i === 6) return '#1e88e5'; // 토요일 파랑
        return '#78909c'; // 평일 회색
    });

    posChartInstances.weekday = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '매출액',
                data: weekdayData,
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const idx = context.dataIndex;
                            const avg = weekdayCount[idx] > 0 ? Math.round(weekdayData[idx] / weekdayCount[idx]) : 0;
                            return [
                                `총 매출: ${context.raw.toLocaleString()}원`,
                                `일 평균: ${avg.toLocaleString()}원`,
                                `영업일: ${weekdayCount[idx]}일`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: function(value) {
                            return (value / 10000).toFixed(0) + '만';
                        }
                    }
                }
            }
        }
    });
}

// 월별 매출 추이 차트
function renderPosMonthlyTrendChart() {
    const ctx = document.getElementById('posMonthlyTrendChart');
    if (!ctx) return;

    if (posChartInstances.monthlyTrend) {
        posChartInstances.monthlyTrend.destroy();
    }

    // 날짜별 매출 집계
    const dailyData = {};
    posReceiptsData.forEach(r => {
        if (r.date) {
            if (!dailyData[r.date]) {
                dailyData[r.date] = { sales: 0, count: 0 };
            }
            dailyData[r.date].sales += r.amount;
            dailyData[r.date].count += 1;
        }
    });

    // 월별로 집계
    const monthlyData = {};
    Object.keys(dailyData).forEach(date => {
        const monthKey = date.substring(0, 7); // YYYY-MM
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { sales: 0, count: 0, days: 0 };
        }
        monthlyData[monthKey].sales += dailyData[date].sales;
        monthlyData[monthKey].count += dailyData[date].count;
        monthlyData[monthKey].days += 1;
    });

    // 정렬
    const sortedMonths = Object.keys(monthlyData).sort();

    if (sortedMonths.length === 0) {
        ctx.parentElement.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">월별 데이터가 없습니다</div>';
        return;
    }

    // 라벨 포맷 (YYYY-MM -> M월)
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        return `${parseInt(month)}월`;
    });

    const salesData = sortedMonths.map(m => monthlyData[m].sales);
    const countData = sortedMonths.map(m => monthlyData[m].count);
    const avgTicketData = sortedMonths.map(m =>
        monthlyData[m].count > 0 ? Math.round(monthlyData[m].sales / monthlyData[m].count) : 0
    );

    posChartInstances.monthlyTrend = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '월 매출',
                    data: salesData,
                    backgroundColor: 'rgba(76, 175, 80, 0.7)',
                    borderColor: '#4caf50',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: '객단가',
                    data: avgTicketData,
                    type: 'line',
                    borderColor: '#ff9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.2)',
                    borderWidth: 3,
                    fill: false,
                    yAxisID: 'y1',
                    tension: 0.3,
                    pointRadius: 5,
                    pointBackgroundColor: '#ff9800'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const monthKey = sortedMonths[context.dataIndex];
                            const data = monthlyData[monthKey];
                            if (context.dataset.label === '월 매출') {
                                return [
                                    `매출: ${context.raw.toLocaleString()}원`,
                                    `영수증: ${data.count.toLocaleString()}건`,
                                    `영업일: ${data.days}일`
                                ];
                            }
                            return `객단가: ${context.raw.toLocaleString()}원`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: '월 매출 (원)' },
                    ticks: {
                        callback: function(value) {
                            if (value >= 10000000) {
                                return (value / 10000000).toFixed(0) + '천만';
                            }
                            return (value / 10000).toFixed(0) + '만';
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: '객단가 (원)' },
                    grid: { drawOnChartArea: false },
                    ticks: {
                        callback: function(value) {
                            return (value / 1000).toFixed(0) + '천';
                        }
                    }
                }
            }
        }
    });
}

// 인사이트 생성
function generatePosInsights(stats) {
    const container = document.getElementById('posInsightsContent');
    if (!container) return;

    const insights = [];

    // 피크 타임 인사이트
    if (stats.peakHour) {
        insights.push({
            type: 'positive',
            title: '🔥 피크 타임 분석',
            text: `${stats.peakHour}시가 가장 바쁜 시간대입니다. 이 시간대에 충분한 인력 배치가 필요합니다.`
        });
    }

    // 객단가 분석
    if (stats.avgTicket > 0) {
        const ticketLevel = stats.avgTicket >= 50000 ? '높은' : stats.avgTicket >= 30000 ? '적정한' : '다소 낮은';
        insights.push({
            type: stats.avgTicket >= 30000 ? 'positive' : 'warning',
            title: '👤 객단가 분석',
            text: `평균 객단가 ${stats.avgTicket.toLocaleString()}원으로 ${ticketLevel} 수준입니다.`
        });
    }

    // 상품 분석
    if (posProductsData && posProductsData.length > 0) {
        const topProduct = [...posProductsData].sort((a, b) => b.sales - a.sales)[0];
        insights.push({
            type: 'default',
            title: '🏆 베스트 메뉴',
            text: `'${topProduct.productName}'이(가) ${topProduct.sales.toLocaleString()}원으로 가장 많이 팔렸습니다.`
        });

        // 수량 기준 분석
        const topByQty = [...posProductsData].sort((a, b) => b.quantity - a.quantity)[0];
        if (topByQty.productName !== topProduct.productName) {
            insights.push({
                type: 'default',
                title: '📦 주문 수량 1위',
                text: `'${topByQty.productName}'이(가) ${topByQty.quantity}개로 가장 많이 주문되었습니다.`
            });
        }
    }

    // 요일 분석
    if (posReceiptsData && posReceiptsData.length > 0) {
        const weekdayData = [0, 0, 0, 0, 0, 0, 0];
        posReceiptsData.forEach(r => {
            weekdayData[r.weekday] += r.amount;
        });

        const maxDay = weekdayData.indexOf(Math.max(...weekdayData));
        const minDay = weekdayData.indexOf(Math.min(...weekdayData.filter(d => d > 0)));
        const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

        insights.push({
            type: 'default',
            title: '📅 요일별 패턴',
            text: `${dayNames[maxDay]}이 가장 매출이 높고, ${dayNames[minDay]}이 가장 낮습니다.`
        });

        // 월별 추이 분석
        const monthlyData = {};
        posReceiptsData.forEach(r => {
            if (r.date) {
                const monthKey = r.date.substring(0, 7);
                if (!monthlyData[monthKey]) monthlyData[monthKey] = 0;
                monthlyData[monthKey] += r.amount;
            }
        });

        const months = Object.keys(monthlyData).sort();
        if (months.length >= 2) {
            const lastMonth = months[months.length - 1];
            const prevMonth = months[months.length - 2];
            const lastSales = monthlyData[lastMonth];
            const prevSales = monthlyData[prevMonth];
            const diff = lastSales - prevSales;
            const diffPct = prevSales > 0 ? ((diff / prevSales) * 100).toFixed(1) : 0;

            const lastMonthLabel = `${parseInt(lastMonth.split('-')[1])}월`;
            const prevMonthLabel = `${parseInt(prevMonth.split('-')[1])}월`;

            if (diff > 0) {
                insights.push({
                    type: 'positive',
                    title: '📈 월별 추이',
                    text: `${prevMonthLabel} 대비 ${lastMonthLabel} 매출이 ${Math.abs(diff).toLocaleString()}원(+${diffPct}%) 증가했습니다.`
                });
            } else if (diff < 0) {
                insights.push({
                    type: 'warning',
                    title: '📉 월별 추이',
                    text: `${prevMonthLabel} 대비 ${lastMonthLabel} 매출이 ${Math.abs(diff).toLocaleString()}원(${diffPct}%) 감소했습니다.`
                });
            }
        }
    }

    // 렌더링
    container.innerHTML = insights.map(insight => `
        <div class="insight-card ${insight.type}">
            <div class="insight-title">${insight.title}</div>
            <div class="insight-text">${insight.text}</div>
        </div>
    `).join('');
}

// ==========================================
// 8. 운영노트 기능
// ==========================================

// 노트 목록 로드
async function loadOperationNotes() {
    try {
        const res = await fetch('/api/notes');
        const result = await res.json();

        if (result.success) {
            allNotes = result.data || [];
            renderNotes();
        }
    } catch (e) {
        console.error('[운영노트] 로드 실패:', e);
    }
}

// 노트 등록
async function submitNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    const category = document.getElementById('noteCategory').value;

    if (!title || !content) {
        alert('제목과 내용을 모두 입력해주세요.');
        return;
    }

    try {
        const res = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                content,
                category,
                author: currentUser?.name || '익명'
            })
        });

        const result = await res.json();
        if (result.success) {
            // 입력 필드 초기화
            document.getElementById('noteTitle').value = '';
            document.getElementById('noteContent').value = '';

            // 목록 새로고침
            loadOperationNotes();
        }
    } catch (e) {
        console.error('[운영노트] 등록 실패:', e);
        alert('등록에 실패했습니다.');
    }
}

// 노트 필터링
function filterNotes(category, btn) {
    currentNoteFilter = category;

    // 버튼 활성화 상태 변경
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    renderNotes();
}

// 노트 렌더링
function renderNotes() {
    const container = document.getElementById('notesListContainer');
    if (!container) return;

    let filtered = allNotes;
    if (currentNoteFilter !== 'all') {
        filtered = allNotes.filter(n => n.category === currentNoteFilter);
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:#999;">
                <div style="font-size:40px; margin-bottom:10px;">📝</div>
                <div>등록된 노트가 없습니다.</div>
                <div style="font-size:13px; margin-top:5px;">위에서 새로운 아이디어를 등록해보세요!</div>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(note => {
        const date = new Date(note.createdAt);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

        const categoryEmoji = {
            '메뉴개선': '🍽️',
            '마케팅': '📢',
            '서비스': '💁',
            '비용절감': '💰',
            '인력관리': '👥',
            '기타': '📌'
        };

        // 댓글 렌더링
        let commentsHtml = '';
        if (note.comments && note.comments.length > 0) {
            commentsHtml = note.comments.map(c => {
                const cDate = new Date(c.createdAt);
                const cDateStr = `${cDate.getMonth() + 1}/${cDate.getDate()}`;
                return `
                    <div class="comment-item">
                        <span class="comment-author">${c.author}</span>
                        <span class="comment-date">${cDateStr}</span>
                        <div class="comment-text">${c.content}</div>
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="note-card category-${note.category}">
                <div class="note-header">
                    <div>
                        <span class="note-category-badge">${categoryEmoji[note.category] || '📌'} ${note.category}</span>
                        <h4 class="note-title">${note.title}</h4>
                    </div>
                    <div class="note-meta">${note.author} · ${dateStr}</div>
                </div>
                <div class="note-content">${note.content}</div>

                <div class="note-comments">
                    ${commentsHtml}
                    <div class="comment-form">
                        <input type="text" class="comment-input" id="comment-${note.id}" placeholder="의견 남기기...">
                        <button class="comment-submit-btn" onclick="submitComment(${note.id})">등록</button>
                    </div>
                </div>

                <div class="note-actions">
                    <button class="note-action-btn" onclick="toggleComments(${note.id})">💬 댓글 ${note.comments?.length || 0}</button>
                    ${currentUser?.role === 'admin' ? `<button class="note-action-btn delete" onclick="deleteNote(${note.id})">🗑️ 삭제</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// 댓글 등록
async function submitComment(noteId) {
    const input = document.getElementById(`comment-${noteId}`);
    const content = input.value.trim();

    if (!content) return;

    try {
        const res = await fetch(`/api/notes/${noteId}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content,
                author: currentUser?.name || '익명'
            })
        });

        const result = await res.json();
        if (result.success) {
            input.value = '';
            loadOperationNotes();
        }
    } catch (e) {
        console.error('[댓글] 등록 실패:', e);
    }
}

// 노트 삭제
async function deleteNote(noteId) {
    if (!confirm('이 노트를 삭제하시겠습니까?')) return;

    try {
        const res = await fetch(`/api/notes/${noteId}`, {
            method: 'DELETE'
        });

        const result = await res.json();
        if (result.success) {
            loadOperationNotes();
        }
    } catch (e) {
        console.error('[노트] 삭제 실패:', e);
    }
}
