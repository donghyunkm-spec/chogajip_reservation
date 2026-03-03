// asyncHandler: async 라우트 에러 자동 캐치
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// 최종 에러 미들웨어
function errorHandler(err, req, res, _next) {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
}

module.exports = { asyncHandler, errorHandler };
