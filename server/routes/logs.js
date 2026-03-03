const express = require('express');
const router = express.Router();
const { readJson, getLogFile } = require('../utils/data');

router.get('/', (req, res) => {
    const file = getLogFile(req.query.store || 'chogazip');
    res.json({ success: true, data: readJson(file, []) });
});

module.exports = router;
