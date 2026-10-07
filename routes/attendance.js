const router = require('express').Router();
const pool = require('../config/db');
const { HttpError, asyncHandler, clean, toInt, todayString, isValidDate } = require('../utils/helpers');

const STATUSES = ['Present', 'Absent'];

function checkDate(date) {
    if (!isValidDate(date)) throw new HttpError(400, 'Choose a valid date.');
    if (date > todayString()) throw new HttpError(400, 'Attendance cannot be marked for a future date.');
}

// Attendance records with filters
router.get('/', asyncHandler(async (req, res) => {
    const where = [];
    const params = [];
    const subjectId = toInt(req.query.subject_id);
    const date = clean(req.query.date);
    const search = clean(req.query.search);
    if (subjectId !== null) { where.push('a.subject_id = ?'); params.push(subjectId); }
    if (date) { where.push('a.attendance_date = ?'); params.push(date); }
    if (search) {
        where.push('(st.student_name LIKE ? OR st.roll_no LIKE ?)');
        params.push('%' + search + '%', '%' + search + '%');
    }
    const [rows] = await pool.query(
        `SELECT a.attendance_id, a.attendance_date, a.status,
                st.student_id, st.student_name, st.roll_no,
                sub.subject_id, sub.subject_name
         FROM attendance a
         JOIN students st ON a.student_id = st.student_id
         JOIN subjects sub ON a.subject_id = sub.subject_id
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY a.attendance_date DESC, a.attendance_id DESC
         LIMIT 300`, params);
    res.json(rows);
}));

// Class list for one subject and date (students of the subject's semester) with any status already saved
router.get('/sheet', asyncHandler(async (req, res) => {
    const subjectId = toInt(req.query.subject_id);
    const date = clean(req.query.date);
    if (subjectId === null) throw new HttpError(400, 'Choose a subject.');
    checkDate(date);
    const [subjects] = await pool.query(
        'SELECT subject_id, subject_name, semester FROM subjects WHERE subject_id = ?', [subjectId]);
    if (!subjects.length) throw new HttpError(404, 'Subject not found.');
    const [students] = await pool.query(
        `SELECT st.student_id, st.student_name, st.roll_no, a.attendance_id, a.status
         FROM students st
         LEFT JOIN attendance a
                ON a.student_id = st.student_id AND a.subject_id = ? AND a.attendance_date = ?
         WHERE st.semester = ?
         ORDER BY st.roll_no`, [subjectId, date, subjects[0].semester]);
    res.json({ subject: subjects[0], date: date, students: students });
}));

// Save a whole class in one transaction (all rows are saved, or none)
router.post('/bulk', asyncHandler(async (req, res) => {
    const subjectId = toInt(req.body.subject_id);
    const date = clean(req.body.date);
    const records = Array.isArray(req.body.records) ? req.body.records : [];
    if (subjectId === null) throw new HttpError(400, 'Choose a subject.');
    checkDate(date);
    if (!records.length) throw new HttpError(400, 'There are no students to save.');
    records.forEach((r) => {
        if (toInt(r.student_id) === null || !STATUSES.includes(r.status)) {
            throw new HttpError(400, 'Every student needs a status of Present or Absent.');
        }
    });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (const r of records) {
            await conn.query(
                `INSERT INTO attendance (student_id, subject_id, attendance_date, status)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status = VALUES(status)`,
                [toInt(r.student_id), subjectId, date, r.status]);
        }
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
    res.json({ message: 'Attendance saved.', saved: records.length });
}));

// Correct one status
router.put('/:id', asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    const status = clean(req.body.status);
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Status must be Present or Absent.');
    const [found] = await pool.query('SELECT attendance_id FROM attendance WHERE attendance_id = ?', [id]);
    if (!found.length) throw new HttpError(404, 'Attendance record not found.');
    await pool.query('UPDATE attendance SET status = ? WHERE attendance_id = ?', [status, id]);
    res.json({ message: 'Status updated.' });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    const [result] = await pool.query('DELETE FROM attendance WHERE attendance_id = ?', [toInt(req.params.id)]);
    if (!result.affectedRows) throw new HttpError(404, 'Attendance record not found.');
    res.json({ message: 'Attendance record deleted.' });
}));

module.exports = router;
