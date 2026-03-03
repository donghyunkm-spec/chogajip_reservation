const express = require('express');
const fs = require('fs');
const router = express.Router();
const { readJson, writeJson, NOTES_FILE } = require('../utils/data');

// 초기화
if (!fs.existsSync(NOTES_FILE)) {
    fs.writeFileSync(NOTES_FILE, JSON.stringify([], null, 2));
}

// 조회
router.get('/', (req, res) => {
    const notes = readJson(NOTES_FILE, []);
    res.json({ success: true, data: notes });
});

// 추가
router.post('/', (req, res) => {
    const { title, content, category, author } = req.body;

    let notes = readJson(NOTES_FILE, []);
    if (!Array.isArray(notes)) notes = [];

    const newNote = {
        id: Date.now(),
        title: title || '',
        content: content || '',
        category: category || '기타',
        author: author || '익명',
        createdAt: new Date().toISOString(),
        comments: []
    };

    notes.unshift(newNote);

    if (writeJson(NOTES_FILE, notes)) {
        console.log(`📝 운영노트 추가: ${title} (${author})`);
        res.json({ success: true, data: newNote });
    } else {
        res.status(500).json({ success: false });
    }
});

// 댓글 추가
router.post('/:id/comment', (req, res) => {
    const noteId = parseInt(req.params.id);
    const { content, author } = req.body;

    let notes = readJson(NOTES_FILE, []);
    const note = notes.find(n => n.id === noteId);

    if (!note) {
        return res.status(404).json({ success: false, error: 'Note not found' });
    }

    if (!note.comments) note.comments = [];
    note.comments.push({
        id: Date.now(),
        content: content || '',
        author: author || '익명',
        createdAt: new Date().toISOString()
    });

    if (writeJson(NOTES_FILE, notes)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

// 삭제
router.delete('/:id', (req, res) => {
    const noteId = parseInt(req.params.id);

    let notes = readJson(NOTES_FILE, []);
    notes = notes.filter(n => n.id !== noteId);

    if (writeJson(NOTES_FILE, notes)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

module.exports = router;
