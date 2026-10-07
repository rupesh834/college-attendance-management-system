const router = require('express').Router();
const pool = require('../config/db');
const { HttpError, asyncHandler, clean, toInt, numbers } = require('../utils/helpers');

const GENDERS = ['Male', 'Female', 'Other'];

function readStudent(body) {
    const s = {
        student_name: clean(body.student_name),
        roll_no: clean(body.roll_no),
        gender: clean(body.gender),
        phone: clean(body.phone),
        email: clean(body.email),
        department: clean(body.department),
        semester: toInt(body.semester)
    };
    if (!s.student_name) throw new HttpError(400, 'Student name is required.');
    if (!GENDERS.includes(s.gender)) throw new HttpError(400, 'Please select a gender.');
    if (!s.department) throw new HttpError(400, 'Department is required.');
    if (s.semester === null || s.semester < 1 || s.semester > 8) throw new HttpError(400, 'Semester must be between 1 and 8.');
    if (s.phone && !/^\d{7,15}$/.test(s.phone)) throw new HttpError(400, 'Phone number must have 7 to 15 digits.');
    if (s.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) throw new HttpError(400, 'Enter a valid email address.');
    return s;
}

const COLUMNS = '(student_name, roll_no, gender, phone, email, department, semester)';

router.get('/', asyncHandler(async (req, res) => {
    const search = clean(req.query.search);
    let sql = 'SELECT * FROM students';
    const params = [];
    if (search) {
        sql += ' WHERE student_name LIKE ? OR roll_no LIKE ? OR department LIKE ?';
        params.push('%' + search + '%', '%' + search + '%', '%' + search + '%');
    }
    sql += ' ORDER BY student_id';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
}));

// subject-wise attendance of one student (used by the report card)
router.get('/:id/attendance', asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    const [student] = await pool.query('SELECT * FROM students WHERE student_id = ?', [id]);
    if (!student.length) throw new HttpError(404, 'Student not found.');
    const [rows] = await pool.query(
        `SELECT sub.subject_name,
                COUNT(*) AS total_classes,
                SUM(a.status = 'Present') AS classes_present,
                ROUND(SUM(a.status = 'Present') * 100.0 / COUNT(*), 2) AS attendance_percentage
         FROM attendance a
         JOIN subjects sub ON a.subject_id = sub.subject_id
         WHERE a.student_id = ?
         GROUP BY sub.subject_id, sub.subject_name
         ORDER BY sub.subject_name`, [id]);
    res.json({ student: student[0], subjects: numbers(rows, ['total_classes', 'classes_present', 'attendance_percentage']) });
}));

router.post('/', asyncHandler(async (req, res) => {
    const s = readStudent(req.body);
    const [result] = await pool.query(
        'INSERT INTO students ' + COLUMNS + ' VALUES (?, ?, ?, ?, ?, ?, ?)',
        [s.student_name, s.roll_no, s.gender, s.phone, s.email, s.department, s.semester]);
    const [rows] = await pool.query('SELECT * FROM students WHERE student_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    const s = readStudent(req.body);
    const [found] = await pool.query('SELECT student_id FROM students WHERE student_id = ?', [id]);
    if (!found.length) throw new HttpError(404, 'Student not found.');
    await pool.query(
        `UPDATE students SET student_name = ?, roll_no = ?, gender = ?, phone = ?, email = ?, department = ?, semester = ?
         WHERE student_id = ?`,
        [s.student_name, s.roll_no, s.gender, s.phone, s.email, s.department, s.semester, id]);
    const [rows] = await pool.query('SELECT * FROM students WHERE student_id = ?', [id]);
    res.json(rows[0]);
}));

// attendance rows of the student are deleted too (ON DELETE CASCADE)
router.delete('/:id', asyncHandler(async (req, res) => {
    const [result] = await pool.query('DELETE FROM students WHERE student_id = ?', [toInt(req.params.id)]);
    if (!result.affectedRows) throw new HttpError(404, 'Student not found.');
    res.json({ message: 'Student deleted.' });
}));

module.exports = router;
