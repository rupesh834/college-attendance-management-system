const router = require('express').Router();
const pool = require('../config/db');
const { asyncHandler, toInt, numbers } = require('../utils/helpers');

// Student-wise attendance percentage (uses the VIEW student_attendance_summary)
router.get('/student-summary', asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM student_attendance_summary ORDER BY roll_no');
    res.json(numbers(rows, ['total_classes', 'classes_present', 'attendance_percentage']));
}));

// Subject-wise present / absent counts (LEFT JOIN keeps subjects that have no attendance yet)
router.get('/subject-summary', asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
        `SELECT sub.subject_id, sub.subject_name,
                COALESCE(SUM(a.status = 'Present'), 0) AS present_count,
                COALESCE(SUM(a.status = 'Absent'), 0) AS absent_count
         FROM subjects sub
         LEFT JOIN attendance a ON sub.subject_id = a.subject_id
         GROUP BY sub.subject_id, sub.subject_name
         ORDER BY sub.subject_id`);
    res.json(numbers(rows, ['present_count', 'absent_count']));
}));

// Students below the attendance threshold (default 75 percent)
router.get('/low-attendance', asyncHandler(async (req, res) => {
    let threshold = toInt(req.query.threshold);
    if (threshold === null || threshold < 1 || threshold > 100) threshold = 75;
    const [rows] = await pool.query(
        `SELECT * FROM student_attendance_summary
         WHERE total_classes > 0 AND attendance_percentage < ?
         ORDER BY attendance_percentage, roll_no`, [threshold]);
    res.json({ threshold: threshold, students: numbers(rows, ['total_classes', 'classes_present', 'attendance_percentage']) });
}));

module.exports = router;
