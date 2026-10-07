const router = require('express').Router();
const pool = require('../config/db');
const { HttpError, asyncHandler, clean, toInt } = require('../utils/helpers');

function readSubject(body) {
    const s = {
        subject_name: clean(body.subject_name),
        faculty_id: toInt(body.faculty_id),
        semester: toInt(body.semester)
    };
    if (!s.subject_name) throw new HttpError(400, 'Subject name is required.');
    if (s.semester === null || s.semester < 1 || s.semester > 8) throw new HttpError(400, 'Semester must be between 1 and 8.');
    return s;
}

const SELECT_ONE = `SELECT sub.subject_id, sub.subject_name, sub.faculty_id, sub.semester, f.faculty_name
                    FROM subjects sub LEFT JOIN faculty f ON sub.faculty_id = f.faculty_id`;

router.get('/', asyncHandler(async (req, res) => {
    const search = clean(req.query.search);
    let sql = SELECT_ONE;
    const params = [];
    if (search) {
        sql += ' WHERE sub.subject_name LIKE ? OR f.faculty_name LIKE ?';
        params.push('%' + search + '%', '%' + search + '%');
    }
    sql += ' ORDER BY sub.subject_id';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
}));

router.post('/', asyncHandler(async (req, res) => {
    const s = readSubject(req.body);
    const [result] = await pool.query(
        'INSERT INTO subjects (subject_name, faculty_id, semester) VALUES (?, ?, ?)',
        [s.subject_name, s.faculty_id, s.semester]);
    const [rows] = await pool.query(SELECT_ONE + ' WHERE sub.subject_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    const s = readSubject(req.body);
    const [found] = await pool.query('SELECT subject_id FROM subjects WHERE subject_id = ?', [id]);
    if (!found.length) throw new HttpError(404, 'Subject not found.');
    await pool.query(
        'UPDATE subjects SET subject_name = ?, faculty_id = ?, semester = ? WHERE subject_id = ?',
        [s.subject_name, s.faculty_id, s.semester, id]);
    const [rows] = await pool.query(SELECT_ONE + ' WHERE sub.subject_id = ?', [id]);
    res.json(rows[0]);
}));

// attendance rows of the subject are deleted too (ON DELETE CASCADE)
router.delete('/:id', asyncHandler(async (req, res) => {
    const [result] = await pool.query('DELETE FROM subjects WHERE subject_id = ?', [toInt(req.params.id)]);
    if (!result.affectedRows) throw new HttpError(404, 'Subject not found.');
    res.json({ message: 'Subject deleted.' });
}));

module.exports = router;
