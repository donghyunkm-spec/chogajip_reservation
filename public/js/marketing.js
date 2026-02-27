// marketing.js - 네이버 플레이스 순위 체커 프론트엔드

// ==========================================
// 1. 전역 변수
// ==========================================
let marketingData = null;
let marketingChart = null;
let statusPollInterval = null;

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

// 대시보드 렌더링
function renderMarketingDashboard() {
    const container = document.getElementById('marketingDashboard');
    if (!container || !marketingData) return;

    const { summary, last_updated } = marketingData;

    // 마지막 업데이트 시간 표시
    const lastUpdateEl = document.getElementById('marketingLastUpdate');
    if (lastUpdateEl && last_updated) {
        const date = new Date(last_updated);
        lastUpdateEl.textContent = `마지막 업데이트: ${date.toLocaleDateString('ko-KR')} ${date.toLocaleTimeString('ko-KR')}`;
    }

    // 키워드별 그룹화
    const keywordGroups = {};
    summary.forEach(item => {
        if (!keywordGroups[item.keyword]) {
            keywordGroups[item.keyword] = [];
        }
        keywordGroups[item.keyword].push(item);
    });

    let html = '';

    Object.keys(keywordGroups).forEach(keyword => {
        const items = keywordGroups[keyword];

        html += `
            <div class="marketing-keyword-card">
                <h4 class="keyword-title">"${keyword}"</h4>
                <div class="store-ranks">
        `;

        // 순위순 정렬
        items.sort((a, b) => {
            if (!a.rank) return 1;
            if (!b.rank) return -1;
            return a.rank - b.rank;
        });

        items.forEach(item => {
            const rankDisplay = item.rank ? `${item.rank}위` : '순위권 밖';
            const rankClass = getRankClass(item.rank);
            const changeDisplay = getChangeDisplay(item.change);
            const isMine = item.is_mine ? 'my-store' : '';

            html += `
                <div class="store-rank-item ${isMine}">
                    <div class="store-name">${item.store}</div>
                    <div class="rank-badge ${rankClass}">${rankDisplay}</div>
                    <div class="rank-change">${changeDisplay}</div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    if (summary.length === 0) {
        html = `
            <div class="marketing-empty">
                <p>아직 순위 데이터가 없습니다.</p>
                <p>아래 "순위 체크 실행" 버튼을 클릭하여 첫 번째 체크를 실행하세요.</p>
            </div>
        `;
    }

    container.innerHTML = html;
}

// 순위에 따른 클래스
function getRankClass(rank) {
    if (!rank) return 'rank-none';
    if (rank <= 3) return 'rank-top3';
    if (rank <= 10) return 'rank-top10';
    if (rank <= 20) return 'rank-top20';
    return 'rank-other';
}

// 변동 표시
function getChangeDisplay(change) {
    if (change === null || change === undefined) return '';
    if (change > 0) return `<span class="change-up">+${change}</span>`;
    if (change < 0) return `<span class="change-down">${change}</span>`;
    return '<span class="change-same">-</span>';
}

// 추이 차트 렌더링
function renderMarketingTrendChart() {
    const canvas = document.getElementById('marketingTrendChart');
    if (!canvas || !marketingData) return;

    const { summary, config } = marketingData;

    // 내 가게 데이터만 필터링
    const myStores = config.stores.filter(s => s.is_mine).map(s => s.name);
    const myData = summary.filter(s => myStores.includes(s.store));

    // 키워드별 데이터셋 생성
    const datasets = [];
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4'];
    let colorIndex = 0;

    const keywordSet = new Set();
    myData.forEach(item => keywordSet.add(item.keyword));

    // 날짜 레이블 생성 (최근 14일)
    const labels = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toISOString().split('T')[0]);
    }

    myStores.forEach(storeName => {
        keywordSet.forEach(keyword => {
            const item = myData.find(d => d.store === storeName && d.keyword === keyword);
            if (!item || !item.history) return;

            // 날짜별 순위 매핑
            const dataPoints = labels.map(date => {
                const record = item.history.find(h => h.date === date);
                return record && record.rank ? record.rank : null;
            });

            const color = colors[colorIndex % colors.length];
            colorIndex++;

            datasets.push({
                label: `${storeName} - "${keyword}"`,
                data: dataPoints,
                borderColor: color,
                backgroundColor: color + '20',
                fill: false,
                tension: 0.3,
                spanGaps: true
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
            scales: {
                y: {
                    reverse: true, // 순위는 작을수록 좋으므로 역순
                    min: 1,
                    max: 50,
                    title: { display: true, text: '순위' }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, font: { size: 11 } }
                },
                tooltip: {
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

// 설정 렌더링
function renderMarketingConfig() {
    const storeList = document.getElementById('marketingStoreList');
    const keywordList = document.getElementById('marketingKeywordList');

    if (!marketingData || !marketingData.config) return;

    const { stores } = marketingData.config;

    // 가게 목록
    if (storeList) {
        storeList.innerHTML = stores.map(s => `
            <div class="config-item">
                <span class="${s.is_mine ? 'my-store-badge' : ''}">${s.name}</span>
                ${s.is_mine ? '<span class="mine-label">내 가게</span>' : ''}
                <button onclick="removeMarketingStore('${s.name}')" class="remove-btn">X</button>
            </div>
        `).join('');
    }

    // 가게별 키워드 목록
    if (keywordList) {
        let html = '';
        stores.forEach(store => {
            const keywords = store.keywords || [];
            const isMine = store.is_mine ? 'my-store-section' : '';
            html += `
                <div class="store-keyword-section ${isMine}">
                    <div class="store-keyword-header">
                        <strong>${store.name}</strong>
                        ${store.is_mine ? '<span class="mine-badge-small">내 가게</span>' : ''}
                    </div>
                    <div class="store-keyword-list">
                        ${keywords.length > 0 ? keywords.map(k => `
                            <div class="config-item keyword-item">
                                <span>${k}</span>
                                <button onclick="removeMarketingKeyword('${store.name}', '${k}')" class="remove-btn">X</button>
                            </div>
                        `).join('') : '<div class="no-keywords">등록된 키워드 없음</div>'}
                    </div>
                    <div class="config-input-row keyword-add-row">
                        <input type="text" id="newKeyword_${store.name.replace(/\s/g, '_')}" placeholder="새 키워드 입력">
                        <button onclick="addMarketingKeyword('${store.name}')">추가</button>
                    </div>
                </div>
            `;
        });
        keywordList.innerHTML = html;
    }
}

// ==========================================
// 3. 크롤러 제어
// ==========================================
async function runMarketingCrawler() {
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
    const isMineCheckbox = document.getElementById('newStoreIsMine');

    if (!nameInput) return;

    const name = nameInput.value.trim();
    if (!name) {
        alert('가게 이름을 입력하세요.');
        return;
    }

    try {
        const res = await fetch('/api/marketing/config/store', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                is_mine: isMineCheckbox ? isMineCheckbox.checked : false
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
