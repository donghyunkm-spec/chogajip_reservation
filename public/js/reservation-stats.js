// ==========================================
// 예약 통계 분석 모듈 (reservation-stats.js)
// ==========================================

// 현재 선택된 월
let statsCurrentMonth = new Date();
let reservationStatsData = null;
let allCustomersData = [];

// 월 변경 함수
function changeStatsMonth(delta) {
    statsCurrentMonth.setMonth(statsCurrentMonth.getMonth() + delta);
    updateStatsMonthTitle();
    loadReservationStats();
}

function resetStatsMonth() {
    statsCurrentMonth = new Date();
    updateStatsMonthTitle();
    loadReservationStats();
}

function updateStatsMonthTitle() {
    const year = statsCurrentMonth.getFullYear();
    const month = statsCurrentMonth.getMonth() + 1;
    const el = document.getElementById('statsMonthTitle');
    if (el) el.textContent = `${year}년 ${month}월`;
}

// 서브 탭 전환
function switchStatsSubTab(tabId, btn) {
    document.querySelectorAll('.stats-sub-content').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    const target = document.getElementById(tabId);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block';
    }

    // 버튼 active 상태 변경
    if (btn) {
        btn.closest('.tabs').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
    }
}

// 예약 통계 데이터 로드
async function loadReservationStats() {
    const year = statsCurrentMonth.getFullYear();
    const month = String(statsCurrentMonth.getMonth() + 1).padStart(2, '0');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(year, statsCurrentMonth.getMonth() + 1, 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    try {
        const res = await fetch(`/api/reservations/stats?startDate=${startDate}&endDate=${endDate}`);
        const json = await res.json();
        if (json.success) {
            reservationStatsData = json.data;
            allCustomersData = json.data.allCustomers || [];
            renderStatsOverview();
            renderTimeStats();
            renderCustomerStats();
            renderTrendStats();
        }
    } catch (err) {
        console.error('예약 통계 로드 실패:', err);
    }
}

// 총괄 현황 렌더링
function renderStatsOverview() {
    const data = reservationStatsData;
    if (!data) return;

    // 상단 요약 카드
    document.getElementById('statsTotalCount').textContent = `${data.total.toLocaleString()}건`;
    document.getElementById('statsTotalPeople').textContent = `${data.totalPeople.toLocaleString()}명`;
    const avg = data.total > 0 ? (data.totalPeople / data.total).toFixed(1) : 0;
    document.getElementById('statsAvgPeople').textContent = `${avg}명`;

    // 일자별 테이블
    const tbody = document.getElementById('statsDailyBody');
    if (tbody) {
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dates = Object.keys(data.byDate).sort().reverse();

        tbody.innerHTML = dates.map(date => {
            const d = new Date(date);
            const dayIdx = d.getDay();
            const dayName = dayNames[dayIdx];
            const dayStyle = dayIdx === 0 ? 'color:red;' : dayIdx === 6 ? 'color:blue;' : '';
            const info = data.byDate[date];
            return `
                <tr>
                    <td style="text-align:left;">${date}</td>
                    <td style="text-align:center;${dayStyle}">${dayName}</td>
                    <td style="text-align:right; font-weight:bold;">${info.count}건</td>
                    <td style="text-align:right;">${info.people}명</td>
                </tr>
            `;
        }).join('');
    }

    // 좌석 선호도 차트
    renderBarChart('statsSeatPrefChart', data.bySeatPref, {
        '룸': '#e91e63',
        '홀': '#2196F3',
        '관계없음': '#9e9e9e'
    });

    // 인원수별 분포
    renderBarChart('statsPartySizeChart', data.byPartySize, {
        '1-2명': '#4caf50',
        '3-4명': '#8bc34a',
        '5-6명': '#ffc107',
        '7-10명': '#ff9800',
        '11명+': '#f44336'
    });

    // 예약 방법
    renderBarChart('statsMethodChart', data.byMethod, {
        '전화': '#673ab7',
        '네이버': '#4caf50',
        '워크인': '#ff9800',
        '기타': '#9e9e9e'
    });
}

// 바 차트 렌더링 함수
function renderBarChart(containerId, data, colors) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const total = Object.values(data).reduce((sum, v) => sum + v, 0);
    if (total === 0) {
        container.innerHTML = '<p style="color:#999; text-align:center; padding:20px;">데이터가 없습니다</p>';
        return;
    }

    const maxVal = Math.max(...Object.values(data));

    container.innerHTML = Object.entries(data).map(([label, value]) => {
        const pct = ((value / maxVal) * 100).toFixed(0);
        const ratio = ((value / total) * 100).toFixed(1);
        const color = colors[label] || '#607d8b';
        return `
            <div class="stats-bar-row">
                <div class="stats-bar-label">${label}</div>
                <div class="stats-bar-track">
                    <div class="stats-bar-fill" style="width:${pct}%; background:${color};">
                        ${ratio}%
                    </div>
                </div>
                <div class="stats-bar-value">${value}건</div>
            </div>
        `;
    }).join('');
}

// 시간/요일 통계 렌더링
function renderTimeStats() {
    const data = reservationStatsData;
    if (!data) return;

    // 시간대별 차트
    const hourlyContainer = document.getElementById('statsHourlyChart');
    if (hourlyContainer) {
        const total = Object.values(data.byHour).reduce((sum, h) => sum + h.count, 0);
        const maxCount = Math.max(...Object.values(data.byHour).map(h => h.count));

        hourlyContainer.innerHTML = Object.entries(data.byHour).map(([hour, info]) => {
            const pct = maxCount > 0 ? ((info.count / maxCount) * 100).toFixed(0) : 0;
            const ratio = total > 0 ? ((info.count / total) * 100).toFixed(1) : 0;
            // 피크 시간대는 빨간색으로 표시
            const isPeak = info.count === maxCount && maxCount > 0;
            const color = isPeak ? '#e91e63' : '#2196F3';
            return `
                <div class="stats-bar-row">
                    <div class="stats-bar-label">${hour}시</div>
                    <div class="stats-bar-track">
                        <div class="stats-bar-fill" style="width:${pct}%; background:${color};">
                            ${info.count > 0 ? `${ratio}%` : ''}
                        </div>
                    </div>
                    <div class="stats-bar-value">${info.count}건 (${info.people}명)</div>
                </div>
            `;
        }).join('');
    }

    // 요일별 차트
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayColors = ['#e53935', '#78909c', '#78909c', '#78909c', '#78909c', '#78909c', '#1e88e5'];
    const dayContainer = document.getElementById('statsDayOfWeekChart');
    if (dayContainer) {
        const total = Object.values(data.byDayOfWeek).reduce((sum, v) => sum + v, 0);
        const maxVal = Math.max(...Object.values(data.byDayOfWeek));

        dayContainer.innerHTML = Object.entries(data.byDayOfWeek).map(([day, count]) => {
            const pct = maxVal > 0 ? ((count / maxVal) * 100).toFixed(0) : 0;
            const ratio = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
            return `
                <div class="stats-bar-row">
                    <div class="stats-bar-label" style="color:${dayColors[day]}">${dayNames[day]}요일</div>
                    <div class="stats-bar-track">
                        <div class="stats-bar-fill" style="width:${pct}%; background:${dayColors[day]};">
                            ${count > 0 ? `${ratio}%` : ''}
                        </div>
                    </div>
                    <div class="stats-bar-value">${count}건</div>
                </div>
            `;
        }).join('');
    }

    // 피크 타임 분석
    const peakContainer = document.getElementById('statsPeakAnalysis');
    if (peakContainer) {
        // 시간대별 피크
        const hourEntries = Object.entries(data.byHour).filter(([h, info]) => info.count > 0);
        const peakHour = hourEntries.length > 0
            ? hourEntries.reduce((a, b) => a[1].count > b[1].count ? a : b)
            : null;

        // 요일별 피크
        const dayEntries = Object.entries(data.byDayOfWeek).filter(([d, count]) => count > 0);
        const peakDay = dayEntries.length > 0
            ? dayEntries.reduce((a, b) => a[1] > b[1] ? a : b)
            : null;

        peakContainer.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                <div style="background:#fce4ec; padding:20px; border-radius:10px; text-align:center;">
                    <div style="font-size:14px; color:#c2185b; margin-bottom:5px;">가장 바쁜 시간</div>
                    <div style="font-size:28px; font-weight:bold; color:#880e4f;">
                        ${peakHour ? `${peakHour[0]}시` : '-'}
                    </div>
                    <div style="font-size:12px; color:#666;">
                        ${peakHour ? `${peakHour[1].count}건 / ${peakHour[1].people}명` : '데이터 없음'}
                    </div>
                </div>
                <div style="background:#e3f2fd; padding:20px; border-radius:10px; text-align:center;">
                    <div style="font-size:14px; color:#1565c0; margin-bottom:5px;">가장 바쁜 요일</div>
                    <div style="font-size:28px; font-weight:bold; color:#0d47a1;">
                        ${peakDay ? `${dayNames[peakDay[0]]}요일` : '-'}
                    </div>
                    <div style="font-size:12px; color:#666;">
                        ${peakDay ? `${peakDay[1]}건` : '데이터 없음'}
                    </div>
                </div>
            </div>
        `;
    }
}

// 단골 분석 렌더링
function renderCustomerStats() {
    const data = reservationStatsData;
    if (!data) return;

    // VIP 단골 테이블
    const regularsBody = document.getElementById('statsRegularsBody');
    if (regularsBody) {
        const regulars = data.regulars.slice(0, 20);

        if (regulars.length === 0) {
            regularsBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding:30px; color:#999;">
                        아직 2회 이상 방문한 단골 고객이 없습니다
                    </td>
                </tr>
            `;
        } else {
            regularsBody.innerHTML = regulars.map((c, idx) => {
                const rank = idx + 1;
                let rankClass = 'rank-other';
                if (rank === 1) rankClass = 'rank-1';
                else if (rank === 2) rankClass = 'rank-2';
                else if (rank === 3) rankClass = 'rank-3';

                const phoneDisplay = c.phone ?
                    c.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3') : '-';

                const vipBadge = c.count >= 5 ? '<span class="vip-badge">VIP</span>' : '';

                return `
                    <tr class="regular-row">
                        <td style="text-align:center;">
                            <span class="rank-badge ${rankClass}">${rank}</span>
                        </td>
                        <td style="text-align:left; font-weight:bold;">
                            ${escapeHtml(c.name)}${vipBadge}
                        </td>
                        <td style="text-align:center; color:#666; font-size:12px;">${escapeHtml(phoneDisplay)}</td>
                        <td style="text-align:right; font-weight:bold; color:#e91e63;">${c.count}회</td>
                        <td style="text-align:right;">${c.totalPeople}명</td>
                        <td style="text-align:center; font-size:12px;">${escapeHtml(c.lastVisit || '-')}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 전체 고객 테이블
    renderAllCustomersTable(allCustomersData);
}

// 전체 고객 목록 렌더링
function renderAllCustomersTable(customers) {
    const tbody = document.getElementById('statsAllCustomersBody');
    if (!tbody) return;

    if (customers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:30px; color:#999;">
                    예약 데이터가 없습니다
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = customers.map(c => {
        const phoneDisplay = c.phone ?
            c.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3') : '-';
        const countStyle = c.count >= 3 ? 'color:#e91e63; font-weight:bold;' : '';

        return `
            <tr>
                <td style="text-align:left;">${escapeHtml(c.name)}</td>
                <td style="text-align:center; color:#666; font-size:12px;">${escapeHtml(phoneDisplay)}</td>
                <td style="text-align:right; ${countStyle}">${c.count}회</td>
                <td style="text-align:right;">${c.totalPeople}명</td>
                <td style="text-align:center; font-size:12px;">${escapeHtml(c.lastVisit || '-')}</td>
            </tr>
        `;
    }).join('');
}

// 고객 검색 필터
function filterCustomerList() {
    const query = document.getElementById('customerSearchInput').value.toLowerCase().trim();

    if (!query) {
        renderAllCustomersTable(allCustomersData);
        return;
    }

    const filtered = allCustomersData.filter(c =>
        c.name.toLowerCase().includes(query) ||
        (c.phone && c.phone.includes(query))
    );
    renderAllCustomersTable(filtered);
}

// 월별 추이 렌더링
function renderTrendStats() {
    const data = reservationStatsData;
    if (!data || !data.byMonth) return;

    // 월별 테이블
    const tbody = document.getElementById('statsMonthlyBody');
    if (tbody) {
        const months = Object.keys(data.byMonth).sort().reverse();

        if (months.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:30px; color:#999;">
                        데이터가 없습니다
                    </td>
                </tr>
            `;
            return;
        }

        let prevCount = 0;
        tbody.innerHTML = months.map((month, idx) => {
            const info = data.byMonth[month];
            const avg = info.count > 0 ? (info.people / info.count).toFixed(1) : 0;

            let changeText = '-';
            let changeStyle = '';
            if (idx < months.length - 1) {
                const prevMonth = months[idx + 1];
                const prevInfo = data.byMonth[prevMonth];
                if (prevInfo && prevInfo.count > 0) {
                    const change = info.count - prevInfo.count;
                    const pct = ((change / prevInfo.count) * 100).toFixed(1);
                    if (change > 0) {
                        changeText = `+${change}건 (+${pct}%)`;
                        changeStyle = 'color:#4caf50;';
                    } else if (change < 0) {
                        changeText = `${change}건 (${pct}%)`;
                        changeStyle = 'color:#f44336;';
                    } else {
                        changeText = '동일';
                        changeStyle = 'color:#666;';
                    }
                }
            }

            return `
                <tr>
                    <td style="text-align:left; font-weight:bold;">${month}</td>
                    <td style="text-align:right;">${info.count}건</td>
                    <td style="text-align:right;">${info.people}명</td>
                    <td style="text-align:right;">${avg}명</td>
                    <td style="text-align:right; ${changeStyle}">${changeText}</td>
                </tr>
            `;
        }).join('');
    }

    // 월별 추이 차트 (Chart.js 사용)
    renderMonthlyTrendChart(data.byMonth);
}

// 월별 추이 차트 렌더링
function renderMonthlyTrendChart(byMonth) {
    const canvas = document.getElementById('statsMonthlyTrendChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const months = Object.keys(byMonth).sort();
    const counts = months.map(m => byMonth[m].count);
    const people = months.map(m => byMonth[m].people);

    // 기존 차트 제거
    if (window.statsMonthlyChart) {
        window.statsMonthlyChart.destroy();
    }

    window.statsMonthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(m => {
                const [year, month] = m.split('-');
                return `${month}월`;
            }),
            datasets: [
                {
                    label: '예약 건수',
                    data: counts,
                    backgroundColor: 'rgba(233, 30, 99, 0.7)',
                    borderColor: '#c2185b',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: '총 인원',
                    data: people,
                    type: 'line',
                    borderColor: '#1976D2',
                    backgroundColor: 'rgba(25, 118, 210, 0.1)',
                    tension: 0.3,
                    yAxisID: 'y1',
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: '예약 건수'
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: {
                        display: true,
                        text: '총 인원'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// 전체 기간 통계 로드 (월별 추이용)
async function loadAllTimeStats() {
    try {
        const res = await fetch('/api/reservations/stats');
        const json = await res.json();
        if (json.success && json.data.byMonth) {
            renderMonthlyTrendChart(json.data.byMonth);
        }
    } catch (err) {
        console.error('전체 통계 로드 실패:', err);
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    updateStatsMonthTitle();
});
