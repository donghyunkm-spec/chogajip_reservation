const express = require('express');
const router = express.Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234!';
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD || 'chogazip1234';
const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD || 'chrkwlv1234!';

router.post('/', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) res.json({ success: true, role: 'admin', name: '사장님' });
    else if (password === MANAGER_PASSWORD) res.json({ success: true, role: 'manager', name: '점장님' });
    else if (password === VIEWER_PASSWORD) res.json({ success: true, role: 'viewer', name: '직원' });
    else res.status(401).json({ success: false });
});

module.exports = router;
