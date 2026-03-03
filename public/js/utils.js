// utils.js - 프론트엔드 공통 유틸리티

// XSS 방지용 HTML 이스케이프
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// 숫자 포맷 (천단위 콤마)
function formatMoney(n) {
    return Number(n || 0).toLocaleString();
}

// 로그인 체크 공통화
function requireAuth() {
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        openLoginModal();
        return false;
    }
    return true;
}

// 날짜 문자열 포맷 (YYYY-MM-DD)
function getDateStr(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
