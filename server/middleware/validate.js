// 필수 필드 검증
function validateRequired(fields) {
    return (req, res, next) => {
        for (const field of fields) {
            if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
                return res.status(400).json({ success: false, error: `Missing required field: ${field}` });
            }
        }
        next();
    };
}

// 기본 XSS 방지 (서버 사이드)
function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

module.exports = { validateRequired, sanitizeString };
