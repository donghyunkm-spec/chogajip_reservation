// marketing.js - 네이버 플레이스 순위 체커 프론트엔드

// ==========================================
// 1. 전역 변수
// ==========================================
let marketingData = null;
let marketingChart = null;
let statusPollInterval = null;
let currentStoreFilter = 'all'; // 'all', 'chogazip', 'yangeun'
let selectedChartKeywords = new Set();

// ==========================================
// 2. 데이터 로드 및 렌더링
// ==========================================
async function loadMarketingData() {
    try {
        const res = await fetch('/api/marketing/summary');
        const result = await res.json();

        if (result.success) {
            marketingData = result.data;
            renderMarketingDashboard();
            renderMarketingTrendChart();
            renderMarketingConfig();
        }
    } catch (e) {
        console.error('마케팅 데이터 로드 실패:', e);
    }
}

// 가게 필터 전환
function filterMarketingByStore(filter, btn) {
    currentStoreFilter = filter;

    // 탭 활성화 상태 변경
    document.querySelectorAll('.mkt-store-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // 대시보드 및 차트 다시 렌더링
    renderMarketingDashboard();
    renderMarketingTrendChart();
}

// 대시보드 렌더링 (새로운 디자인)
function renderMarketingDashboard() {
    const container = document.getElementById('marketingDashboard');
    if (!container || !marketingData) return;

    const { summary, last_updated, config } = marketingData;
    const stores = config.stores || [];

    // 마지막 업데이트 시간 표시
    const lastUpdateEl = document.getElementById('marketingLastUpdate');
    if (lastUpdateEl && last_updated) {
        const date = new Date(last_updated);
        lastUpdateEl.textContent = `마지막: ${date.toLocaleDateString('ko-KR')} ${date.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}`;
    }

    // 필터링
    const filteredStores = stores.filter(s => {
        if (currentStoreFilter === 'all') return true;
        return s.category === currentStoreFilter;
    });

    const filteredSummary = summary.filter(item => {
        const storeConfig = stores.find(s => s.name === item.store);
        if (!storeConfig) return false;
        if (currentStoreFilter === 'all') return true;
        return storeConfig.category === currentStoreFilter;
    });

    if (filteredStores.length === 0) {
        container.innerHTML = `
            <div class="marketing-empty">
                <div class="marketing-empty-icon">📊</div>
                <p>아직 등록된 가게가 없습니다.</p>
                <p style="font-size:13px; color:#999;">설정 탭에서 모니터링할 가게를 추가하세요.</p>
            </div>
        `;
        return;
    }

    // 내 가게와 경쟁업체 분리
    const myStores = filteredStores.filter(s => s.is_mine);
    const competitors = filteredStores.filter(s => !s.is_mine);

    let html = '';

    // 내 가게 요약 카드
    if (myStores.length > 0) {
        html += '<div class="mkt-summary-grid">';
        myStores.forEach(store => {
            const storeData = filteredSummary.filter(s => s.store === store.name);
            const cardClass = store.category === 'chogazip' ? 'chogazip-card' : 'yangeun-card';
            const categoryLabel = store.category === 'chogazip' ? '고기집' : '탕/보쌈';

            html += `
                <div class="mkt-my-store-card ${cardClass}">
                    <div class="mkt-my-store-header">
                        <div class="mkt-my-store-name">${store.name}</div>
                        <div class="mkt-my-store-badge">${categoryLabel}</div>
                    </div>
                    <div class="mkt-keyword-ranks">
            `;

            if (storeData.length === 0) {
                html += `<div class="mkt-keyword-row"><span style="opacity:0.7;">등록된 키워드 없음</span></div>`;
            } else {
                storeData.forEach(item => {
                    const rankDisplay = item.rank ? item.rank : '-';
                    const changeHtml = getChangeHtml(item.change);
                    html += `
                        <div class="mkt-keyword-row">
                            <div class="mkt-keyword-name">"${item.keyword}"</div>
                            <div class="mkt-rank-display">
                                ${changeHtml}
                                <span class="mkt-rank-num">${rankDisplay}</span>
                                <span class="mkt-rank-suffix">${item.rank ? '위' : ''}</span>
                            </div>
                        </div>
                    `;
                });
            }

            html += `
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }

    // 키워드별 경쟁업체 비교 테이블
    const keywordSet = new Set();
    filteredSummary.forEach(item => keywordSet.add(item.keyword));

    keywordSet.forEach(keyword => {
        const keywordData = filteredSummary.filter(s => s.keyword === keyword);

        // 순위순 정렬 (순위 없는 것은 마지막)
        keywordData.sort((a, b) => {
            if (!a.rank && !b.rank) return 0;
            if (!a.rank) return 1;
            if (!b.rank) return -1;
            return a.rank - b.rank;
        });

        html += `
            <div class="mkt-competitor-section">
                <div class="mkt-competitor-header">
                    <div class="mkt-competitor-title">
                        <span>순위 비교</span>
                        <span class="mkt-keyword-tag">${keyword}</span>
                    </div>
                </div>
                <table class="mkt-rank-table">
                    <thead>
                        <tr>
                            <th style="width:40%">가게명</th>
                            <th style="width:30%">순위</th>
                            <th style="width:30%">변동</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        keywordData.forEach((item, idx) => {
            const isMyStore = item.is_mine;
            const rowClass = isMyStore ? 'my-store-row' : '';
            const rankClass = getRankPositionClass(item.rank, idx);
            const rankDisplay = item.rank ? item.rank : '-';
            const changeHtml = getChangeBadge(item.change);

            html += `
                <tr class="${rowClass}">
                    <td>${item.store}${isMyStore ? ' ⭐' : ''}</td>
                    <td><span class="mkt-rank-position ${rankClass}">${rankDisplay}</span></td>
                    <td>${changeHtml}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
    });

    if (keywordSet.size === 0 && myStores.length === 0) {
        html = `
            <div class="marketing-empty">
                <div class="marketing-empty-icon">📊</div>
                <p>아직 순위 데이터가 없습니다.</p>
                <p style="font-size:13px; color:#999;">"순위 체크 실행" 버튼을 클릭하여 첫 번째 체크를 실행하세요.</p>
            </div>
        `;
    }

    container.innerHTML = html;
}

// 순위에 따른 클래스
function getRankPositionClass(rank, idx) {
    if (!rank) return 'rank-other';
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    if (rank <= 10) return 'rank-top10';
    if (rank <= 20) return 'rank-top20';
    return 'rank-other';
}

// 변동 표시 (카드용)
function getChangeHtml(change) {
    if (change === null || change === undefined) return '';
    if (change > 0) return `<span class="mkt-rank-change up">+${change}</span>`;
    if (change < 0) return `<span class="mkt-rank-change down">${change}</span>`;
    return '';
}

// 변동 배지 (테이블용)
function getChangeBadge(change) {
    if (change === null || change === undefined) return '<span class="mkt-change-badge same">-</span>';
    if (change > 0) return `<span class="mkt-change-badge up">▲ ${change}</span>`;
    if (change < 0) return `<span class="mkt-change-badge down">▼ ${Math.abs(change)}</span>`;
    return '<span class="mkt-change-badge same">-</span>';
}

// 추이 차트 렌더링
function renderMarketingTrendChart() {
    const canvas = document.getElementById('marketingTrendChart');
    const filterContainer = document.getElementById('mktChartFilters');
    if (!canvas || !marketingData) return;

    const { summary, config } = marketingData;
    const stores = config.stores || [];

    // 필터에 맞는 내 가게 데이터만
    const filteredStores = stores.filter(s => {
        if (!s.is_mine) return false;
        if (currentStoreFilter === 'all') return true;
        return s.category === currentStoreFilter;
    });

    const myStoreNames = filteredStores.map(s => s.name);
    const myData = summary.filter(s => myStoreNames.includes(s.store));

    // 키워드 필터 버튼 생성
    if (filterContainer) {
        const uniqueKeywords = [...new Set(myData.map(d => d.keyword))];

        // 초기화: 모든 키워드 선택
        if (selectedChartKeywords.size === 0) {
            uniqueKeywords.forEach(k => selectedChartKeywords.add(k));
        }

        let filterHtml = '';
        uniqueKeywords.forEach(keyword => {
            const isActive = selectedChartKeywords.has(keyword);
            filterHtml += `
                <button class="mkt-chart-filter-btn ${isActive ? 'active' : ''}"
                        onclick="toggleChartKeyword('${keyword}', this)">
                    ${keyword}
                </button>
            `;
        });
        filterContainer.innerHTML = filterHtml;
    }

    // 날짜 레이블 생성 (최근 14일)
    const labels = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toISOString().split('T')[0]);
    }

    // 데이터셋 생성
    const datasets = [];
    const colorPalettes = {
        chogazip: ['#d32f2f', '#e91e63', '#ff5722', '#ff9800'],
        yangeun: ['#388e3c', '#00897b', '#00acc1', '#1e88e5']
    };
    let colorIndexes = { chogazip: 0, yangeun: 0 };

    filteredStores.forEach(storeConfig => {
        const storeName = storeConfig.name;
        const category = storeConfig.category || 'chogazip';
        const palette = colorPalettes[category];

        myData.filter(d => d.store === storeName && selectedChartKeywords.has(d.keyword)).forEach(item => {
            if (!item.history) return;

            const dataPoints = labels.map(date => {
                const record = item.history.find(h => h.date === date);
                return record && record.rank ? record.rank : null;
            });

            const colorIdx = colorIndexes[category] % palette.length;
            const color = palette[colorIdx];
            colorIndexes[category]++;

            datasets.push({
                label: `${storeName} - "${item.keyword}"`,
                data: dataPoints,
                borderColor: color,
                backgroundColor: color + '20',
                fill: false,
                tension: 0.3,
                spanGaps: true,
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            });
        });
    });

    // 기존 차트 파괴
    if (marketingChart) {
        marketingChart.destroy();
    }

    // 새 차트 생성
    marketingChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels.map(d => d.slice(5)), // MM-DD 형식
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                y: {
                    reverse: true,
                    min: 1,
                    max: Math.max(30, ...datasets.flatMap(d => d.data.filter(v => v !== null))),
                    title: { display: true, text: '순위', font: { size: 12 } },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 },
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + (context.raw ? context.raw + '위' : '순위권 밖');
                        }
                    }
                }
            }
        }
    });
}

// 차트 키워드 필터 토글
function toggleChartKeyword(keyword, btn) {
    if (selectedChartKeywords.has(keyword)) {
        selectedChartKeywords.delete(keyword);
        btn.classList.remove('active');
    } else {
        selectedChartKeywords.add(keyword);
        btn.classList.add('active');
    }
    renderMarketingTrendChart();
}

// 설정 렌더링
function renderMarketingConfig() {
    const storeList = document.getElementById('marketingStoreList');
    const keywordList = document.getElementById('marketingKeywordList');

    if (!marketingData || !marketingData.config) return;

    const { stores } = marketingData.config;

    // 가게 목록 (카테고리별 그룹화)
    if (storeList) {
        const chogazipStores = stores.filter(s => s.category === 'chogazip' || !s.category);
        const yangeunStores = stores.filter(s => s.category === 'yangeun');

        let html = '';

        if (chogazipStores.length > 0) {
            html += '<div style="margin-bottom:10px;font-weight:bold;color:#c62828;">🥩 초가짚 (고기)</div>';
            html += chogazipStores.map(s => renderStoreConfigItem(s, 'chogazip')).join('');
        }

        if (yangeunStores.length > 0) {
            html += '<div style="margin-bottom:10px;margin-top:15px;font-weight:bold;color:#2e7d32;">🍲 양은이네 (탕/보쌈)</div>';
            html += yangeunStores.map(s => renderStoreConfigItem(s, 'yangeun')).join('');
        }

        if (stores.length === 0) {
            html = '<div style="color:#999;text-align:center;padding:20px;">등록된 가게가 없습니다.</div>';
        }

        storeList.innerHTML = html;
    }

    // 가게별 키워드 목록
    if (keywordList) {
        let html = '';

        // 카테고리별 그룹화
        const chogazipStores = stores.filter(s => s.category === 'chogazip' || !s.category);
        const yangeunStores = stores.filter(s => s.category === 'yangeun');

        if (chogazipStores.length > 0) {
            html += '<div style="margin-bottom:10px;font-weight:bold;color:#c62828;">🥩 초가짚 계열</div>';
            chogazipStores.forEach(store => {
                html += renderStoreKeywordSection(store, 'chogazip');
            });
        }

        if (yangeunStores.length > 0) {
            html += '<div style="margin-bottom:10px;margin-top:20px;font-weight:bold;color:#2e7d32;">🍲 양은이네 계열</div>';
            yangeunStores.forEach(store => {
                html += renderStoreKeywordSection(store, 'yangeun');
            });
        }

        keywordList.innerHTML = html;
    }
}

function renderStoreConfigItem(store, category) {
    const categoryClass = `category-${category}`;
    const categoryLabel = category === 'chogazip' ? '고기' : '탕/보쌈';

    return `
        <div class="config-item">
            <span class="${store.is_mine ? 'my-store-badge' : ''}">${store.name}</span>
            <div style="display:flex;align-items:center;gap:8px;">
                ${store.is_mine ? '<span class="mine-label">내 가게</span>' : ''}
                <span class="category-label ${categoryClass}">${categoryLabel}</span>
                <button onclick="removeMarketingStore('${store.name}')" class="remove-btn">X</button>
            </div>
        </div>
    `;
}

function renderStoreKeywordSection(store, category) {
    const keywords = store.keywords || [];
    const isMine = store.is_mine ? 'my-store-section' : '';
    const categorySection = `${category}-section`;

    return `
        <div class="store-keyword-section ${isMine} ${categorySection}">
            <div class="store-keyword-header">
                <strong>${store.name}</strong>
                ${store.is_mine ? '<span class="mine-badge-small" style="background:#4CAF50;color:white;font-size:10px;padding:2px 6px;border-radius:10px;margin-left:5px;">내 가게</span>' : '<span style="font-size:10px;color:#999;margin-left:5px;">경쟁업체</span>'}
            </div>
            <div class="store-keyword-list">
                ${keywords.length > 0 ? keywords.map(k => `
                    <div class="config-item keyword-item">
                        <span>${k}</span>
                        <button onclick="removeMarketingKeyword('${store.name}', '${k}')" class="remove-btn">X</button>
                    </div>
                `).join('') : '<div style="color:#999;font-size:12px;padding:8px;">등록된 키워드 없음</div>'}
            </div>
            <div class="config-input-row keyword-add-row">
                <input type="text" id="newKeyword_${store.name.replace(/\s/g, '_')}" placeholder="새 키워드 입력">
                <button onclick="addMarketingKeyword('${store.name}')">추가</button>
            </div>
        </div>
    `;
}

// ==========================================
// 3. 크롤러 제어
// ==========================================
async function runMarketingCrawler() {
    // 비밀번호 확인
    const password = prompt('순위 체크 실행을 위한 비밀번호를 입력하세요:');
    if (password !== '1234') {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }

    const btn = document.getElementById('runCrawlerBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '실행 중...';
    }

    try {
        const res = await fetch('/api/marketing/run', { method: 'POST' });
        const result = await res.json();

        if (result.success) {
            alert('순위 체크를 시작했습니다. 완료까지 몇 분 정도 소요됩니다.');
            startStatusPolling();
        } else {
            alert(result.message || '실행 실패');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '순위 체크 실행';
            }
        }
    } catch (e) {
        console.error('크롤러 실행 오류:', e);
        alert('실행 중 오류가 발생했습니다.');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '순위 체크 실행';
        }
    }
}

// 상태 폴링
function startStatusPolling() {
    if (statusPollInterval) clearInterval(statusPollInterval);

    const statusEl = document.getElementById('marketingStatus');

    statusPollInterval = setInterval(async () => {
        try {
            const res = await fetch('/api/marketing/status');
            const result = await res.json();

            if (result.success) {
                const { running, progress } = result.data;

                if (statusEl) {
                    if (running) {
                        statusEl.innerHTML = `
                            <div class="status-running">
                                <span class="spinner"></span>
                                <span>검색 중: "${progress.keyword}" (${progress.current}/${progress.total})</span>
                            </div>
                        `;
                    } else {
                        statusEl.innerHTML = '';
                    }
                }

                if (!running) {
                    clearInterval(statusPollInterval);
                    statusPollInterval = null;

                    const btn = document.getElementById('runCrawlerBtn');
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = '순위 체크 실행';
                    }

                    // 데이터 새로고침
                    loadMarketingData();
                }
            }
        } catch (e) {
            console.error('상태 조회 오류:', e);
        }
    }, 2000);
}

// ==========================================
// 4. 설정 관리
// ==========================================
async function addMarketingStore() {
    const nameInput = document.getElementById('newStoreName');
    const categorySelect = document.getElementById('newStoreCategory');
    const isMineCheckbox = document.getElementById('newStoreIsMine');

    if (!nameInput) return;

    const name = nameInput.value.trim();
    if (!name) {
        alert('가게 이름을 입력하세요.');
        return;
    }

    const category = categorySelect ? categorySelect.value : 'chogazip';

    try {
        const res = await fetch('/api/marketing/config/store', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                is_mine: isMineCheckbox ? isMineCheckbox.checked : false,
                category
            })
        });
        const result = await res.json();

        if (result.success) {
            nameInput.value = '';
            if (isMineCheckbox) isMineCheckbox.checked = false;
            loadMarketingData();
        } else {
            alert(result.message || '추가 실패');
        }
    } catch (e) {
        console.error('가게 추가 오류:', e);
        alert('추가 중 오류가 발생했습니다.');
    }
}

async function removeMarketingStore(name) {
    if (!confirm(`"${name}" 가게를 삭제하시겠습니까?\n(기록된 순위 데이터도 함께 삭제됩니다)`)) return;

    try {
        const res = await fetch('/api/marketing/config/store', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const result = await res.json();

        if (result.success) {
            loadMarketingData();
        } else {
            alert('삭제 실패');
        }
    } catch (e) {
        console.error('가게 삭제 오류:', e);
    }
}

async function addMarketingKeyword(storeName) {
    const inputId = `newKeyword_${storeName.replace(/\s/g, '_')}`;
    const input = document.getElementById(inputId);
    if (!input) return;

    const keyword = input.value.trim();
    if (!keyword) {
        alert('키워드를 입력하세요.');
        return;
    }

    try {
        const res = await fetch('/api/marketing/config/keyword', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword, storeName })
        });
        const result = await res.json();

        if (result.success) {
            input.value = '';
            loadMarketingData();
        } else {
            alert(result.message || '추가 실패');
        }
    } catch (e) {
        console.error('키워드 추가 오류:', e);
        alert('추가 중 오류가 발생했습니다.');
    }
}

async function removeMarketingKeyword(storeName, keyword) {
    if (!confirm(`"${storeName}"의 "${keyword}" 키워드를 삭제하시겠습니까?`)) return;

    try {
        const res = await fetch('/api/marketing/config/keyword', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword, storeName })
        });
        const result = await res.json();

        if (result.success) {
            loadMarketingData();
        } else {
            alert('삭제 실패');
        }
    } catch (e) {
        console.error('키워드 삭제 오류:', e);
    }
}

// ==========================================
// 5. 서브탭 전환
// ==========================================
function switchMarketingSubTab(subId, btn) {
    // 서브탭 컨텐츠 숨기기
    document.querySelectorAll('.mkt-sub-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });

    // 버튼 활성화 상태 변경
    if (btn) {
        const parentTabs = btn.parentElement;
        parentTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
    }

    // 대상 서브탭 표시
    const targetDiv = document.getElementById(subId);
    if (targetDiv) {
        targetDiv.style.display = 'block';
        targetDiv.classList.add('active');
    }

    // 차트 리사이즈 (캔버스가 숨겨졌다가 보여질 때 필요)
    if (subId === 'mkt-trend' && marketingChart) {
        setTimeout(() => marketingChart.resize(), 100);
    }
}
