// prepayment.js - 선결제 장부

// ==========================================
// 1. 전역 변수
// ==========================================
window.prepayData = { customers: {}, logs: [] };

// ==========================================
// 2. 데이터 로드
// ==========================================
async function loadPrepaymentData() {
    if (!requireAuth()) return;
    document.getElementById('preDate').value = new Date().toISOString().split('T')[0];

    try {
        const res = await fetch(`/api/prepayments?store=${currentStore}`);
        const json = await res.json();
        prepayData = json.data;
        renderPrepaymentUI();
    } catch(e) { console.error(e); }
}

// ==========================================
// 3. UI 렌더링
// ==========================================
function renderPrepaymentUI() {
    if (!prepayData || !prepayData.customers || !prepayData.logs) {
        prepayData = { customers: {}, logs: [] };
    }

    const datalist = document.getElementById('customerList');
    if (datalist) {
        datalist.innerHTML = Object.keys(prepayData.customers).map(name => `<option value="${escapeHtml(name)}">`).join('');
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
                    <td style="text-align:left;"><strong>👤 ${escapeHtml(name)}</strong></td>
                    <td style="font-weight:bold; color:${info.balance < 0 ? 'red' : '#1976D2'};">${info.balance.toLocaleString()}원</td>
                    <td style="color:#666; font-size:11px;">${escapeHtml(info.lastUpdate)}</td>
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
                    <td>${escapeHtml(log.date.substring(5))}</td>
                    <td style="font-weight:bold; color:#555;">${escapeHtml(log.actor) || '-'}</td>
                    <td><strong>${escapeHtml(log.customerName)}</strong></td>
                    <td style="color:${log.type === 'charge' ? '#2e7d32' : '#d32f2f'};">${log.type === 'charge' ? '충전' : '사용'}</td>
                    <td style="text-align:right;">${log.amount.toLocaleString()}</td>
                    <td style="font-size:11px; color:#999; text-align:right;">${log.currentBalance.toLocaleString()}</td>
                    <td style="font-size:11px; text-align:left;">${escapeHtml(log.note) || '-'}</td>
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

// ==========================================
// 4. 데이터 저장/삭제
// ==========================================
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
