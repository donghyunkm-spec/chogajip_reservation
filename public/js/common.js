// common.js - 공통 유틸, 전역변수, 로그인, 탭전환

// ==========================================
// 1. 전역 변수
// ==========================================
window.currentUser = null;

// 현재 매장 정보 파싱
const urlParams = new URLSearchParams(window.location.search);
window.currentStore = urlParams.get('store') || 'chogazip';
window.storeNameKr = window.currentStore === 'yangeun' ? '양은이네' : '초가짚';

// 요일 맵핑
window.DAY_MAP = { 'Sun':'일', 'Mon':'월', 'Tue':'화', 'Wed':'수', 'Thu':'목', 'Fri':'금', 'Sat':'토' };
window.DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ==========================================
// 2. 유틸리티 함수
// ==========================================
function getMonthStr(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

// ==========================================
// 3. 매장 설정 초기화
// ==========================================
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

        const miscDiv = document.getElementById('divMisc');
        if (miscDiv) miscDiv.style.display = '';
        const filterOptMisc = document.getElementById('filterOptMisc');
        if (filterOptMisc) filterOptMisc.style.display = '';

        const dispDiv = document.getElementById('divDisposable');
        if(dispDiv) dispDiv.style.display = 'block';
        const delivDiv = document.getElementById('divDeliveryFee');
        if(delivDiv) delivDiv.style.display = 'block';

        const salesGrid = document.getElementById('salesInputGrid');
        if (salesGrid) {
            salesGrid.innerHTML = `
                <div style="grid-column: span 2;">
                    <span class="category-label">💳 카드 매출</span>
                    <input type="number" id="inpCard" class="money-input" placeholder="0">
                </div>

                <div>
                    <span class="category-label">🛵 배민 매출</span>
                    <input type="number" id="inpBaemin" class="money-input" placeholder="0">
                </div>
                <div>
                    <span class="category-label" style="color:#00796b;">🔢 배민 건수</span>
                    <input type="number" id="cntBaemin" class="money-input" placeholder="0" style="background:#e0f2f1; color:#004d40; border:1px solid #b2dfdb;">
                </div>

                <div>
                    <span class="category-label">🛵 요기요 매출</span>
                    <input type="number" id="inpYogiyo" class="money-input" placeholder="0">
                </div>
                <div>
                    <span class="category-label" style="color:#d32f2f;">🔢 요기요 건수</span>
                    <input type="number" id="cntYogiyo" class="money-input" placeholder="0" style="background:#ffebee; color:#b71c1c; border:1px solid #ffcdd2;">
                </div>

                <div>
                    <span class="category-label">🛵 쿠팡이츠 매출</span>
                    <input type="number" id="inpCoupang" class="money-input" placeholder="0">
                </div>
                <div>
                    <span class="category-label" style="color:#1565c0;">🔢 쿠팡 건수</span>
                    <input type="number" id="cntCoupang" class="money-input" placeholder="0" style="background:#e3f2fd; color:#0d47a1; border:1px solid #bbdefb;">
                </div>
                `;
            salesGrid.style.gridTemplateColumns = "1fr 1fr";
        }
    } else {
        // 2. 초가짚 설정 (기존 유지)
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
        btn.style.color = '#333';
    } else {
        btn.innerHTML = '🥘 양은이네 관리';
        btn.style.color = '#d32f2f';
    }
}

// 2. 매장 이동 함수 (클릭 시 실행)
function moveToOtherStore() {
    const targetStore = currentStore === 'yangeun' ? 'chogazip' : 'yangeun';
    location.href = `staff.html?store=${targetStore}`;
}

// ==========================================
// 4. 탭 전환
// ==========================================

// 메인 탭 전환
function switchTab(tabName) {
    // 메인 탭 버튼만 active 해제 (서브탭은 유지)
    const targetBtn = document.querySelector(`.tabs > button[onclick="switchTab('${tabName}')"]`);
    if (targetBtn) {
        targetBtn.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        targetBtn.classList.add('active');
    }
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    const contentId = (tabName === 'attendance') ? 'attendance-content' : `${tabName}-content`;
    const content = document.getElementById(contentId);
    if(content) content.classList.add('active');

    if(tabName === 'attendance') {
        const activeSub = document.querySelector('.att-sub-content.active');
        if(!activeSub || activeSub.id === 'att-daily') renderDailyView();
        else if(activeSub.id === 'att-weekly') renderWeeklyView();
        else if(activeSub.id === 'att-monthly') renderMonthlyView();
        else if(activeSub.id === 'att-manage') {
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
    if(tabName === 'reservation-stats' && typeof loadReservationStats === 'function') {
        loadReservationStats();
        if (typeof loadAllTimeStats === 'function') loadAllTimeStats();
    }
    if(tabName === 'marketing' && typeof loadMarketingData === 'function') {
        loadMarketingData();
    }
}

// 근무관리 내부 서브탭 전환
function switchAttSubTab(subId, btn) {
    document.querySelectorAll('.att-sub-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });

    const parentTabs = btn.parentElement;
    parentTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    const targetDiv = document.getElementById(subId);
    if(targetDiv) {
        targetDiv.style.display = 'block';
        targetDiv.classList.add('active');
    }

    if(subId === 'att-daily') renderDailyView();
    else if(subId === 'att-weekly') renderWeeklyView();
    else if(subId === 'att-monthly') renderMonthlyView();
    else if(subId === 'att-manage') {
        setTimeout(() => renderManageList(), 50);
    }
    else if(subId === 'att-logs') loadLogs();
}

// 가계부 내부 서브탭 전환
function switchAccSubTab(subTabId, btnElement) {
    document.querySelectorAll('.acc-sub-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });

    if(btnElement) {
        const siblings = btnElement.parentElement.querySelectorAll('.tab');
        siblings.forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    } else {
        const accContent = document.getElementById('accounting-content');
        if(accContent) {
            accContent.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
            const targetBtn = accContent.querySelector(`button[onclick*="${subTabId}"]`);
            if(targetBtn) targetBtn.classList.add('active');
        }
    }

    const targetDiv = document.getElementById(subTabId);
    if(targetDiv) {
        targetDiv.style.display = 'block';
        targetDiv.classList.add('active');

        if (subTabId === 'acc-history') loadHistoryTable();
        else if (subTabId === 'acc-prediction') renderPredictionStats();
        else if (subTabId === 'acc-dashboard') renderDashboardStats();
        else if (subTabId === 'acc-monthly') loadMonthlyForm();
        else if (subTabId === 'acc-prepayment') {
            loadPrepaymentData();
        }
        else if (subTabId === 'acc-logs') loadAccountingLogs();
    }
}

// ==========================================
// 5. 로그인 및 권한 관리
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
            const sessionData = {
                ...data,
                loginTime: new Date().getTime()
            };

            localStorage.setItem('staffUser', JSON.stringify(sessionData));
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

async function onLoginSuccess(user) {
    currentUser = user;

    const loginBtn = document.getElementById('loginBtn');
    if(loginBtn) loginBtn.style.display = 'none';

    const userInfoDiv = document.getElementById('userInfo');
    if(userInfoDiv) {
        userInfoDiv.style.display = 'block';
        userInfoDiv.innerHTML = `${escapeHtml(user.name)} (${user.role === 'admin' ? '사장' : user.role === 'manager' ? '점장' : '직원'})`;
    }

    if (user.role === 'admin' || user.role === 'manager') {
        const switchBtn = document.getElementById('switchStoreBtn');
        if(switchBtn) switchBtn.style.display = 'inline-block';
    }

    if (user.role === 'admin') {
        const bulkSection = document.getElementById('bulkSection');
        if(bulkSection) bulkSection.style.display = 'block';

        const salarySection = document.getElementById('salarySection');
        if(salarySection) salarySection.style.display = 'block';

        const backupBtn = document.getElementById('adminBackupBtn');
        if(backupBtn) backupBtn.style.display = 'block';

        const unifiedBtn = document.getElementById('unifiedTabBtn');
        if(unifiedBtn) unifiedBtn.style.display = 'inline-block';

        const marketingBtn = document.getElementById('marketingTabBtn');
        if(marketingBtn) marketingBtn.style.display = 'inline-block';

        try { await loadLogs(); } catch(e) {}
    }

    const activeTab = document.querySelector('.tab-content.active');
    if(activeTab && activeTab.id === 'accounting-content') {
        try { await loadAccountingData(); } catch(e) {}
    }
    try { renderManageList(); } catch(e) {}
}

// ==========================================
// 6. 페이지 초기화
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.title = `${storeNameKr} 관리자 모드`;

    // 매장별 테마 적용
    if (currentStore === 'yangeun') {
        document.body.classList.add('theme-yangeun');
        document.body.classList.remove('theme-chogazip');
    } else {
        document.body.classList.add('theme-chogazip');
        document.body.classList.remove('theme-yangeun');
    }

    // 헤더 텍스트 변경
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

    // 초기 데이터 로드
    loadStaffData();

    // 매장 전환 버튼 텍스트 설정
    initSwitchStoreButton();

    // 로그인 유지 확인 (localStorage + 3시간 타임아웃)
    const savedUserStr = localStorage.getItem('staffUser');

    if (savedUserStr) {
        try {
            const savedUser = JSON.parse(savedUserStr);
            const now = new Date().getTime();
            const threeHours = 3 * 60 * 60 * 1000;

            if (savedUser.loginTime && (now - savedUser.loginTime < threeHours)) {
                currentUser = savedUser;
                onLoginSuccess(currentUser);
            } else {
                console.log('⌛ 로그인 세션이 만료되었습니다. (3시간 경과)');
                localStorage.removeItem('staffUser');
                currentUser = null;
            }
        } catch (e) {
            console.error('로그인 정보 파싱 오류', e);
            localStorage.removeItem('staffUser');
        }
    }
});
