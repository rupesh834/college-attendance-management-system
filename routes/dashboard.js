const router = require('express').Router();
const pool = require('../config/db');
const { asyncHandler, numbers } = require('../utils/helpers');

router.get('/', asyncHandler(async (req, res) => {
    const [[totals]] = await pool.query(
        `SELECT (SELECT COUNT(*) FROM students) AS students,
                (SELECT COUNT(*) FROM faculty) AS faculty,
                (SELECT COUNT(*) FROM subjects) AS subjects,
                (SELECT COUNT(*) FROM attendance) AS records,
                (SELECT COUNT(*) FROM attendance WHERE status = 'Present') AS present`);
    const [[low]] = await pool.query(
        `SELECT COUNT(*) AS below_threshold FROM student_attendance_summary
         WHERE total_classes > 0 AND attendance_percentage < 75`);
    const [subjectRows] = await pool.query(
        `SELECT sub.subject_name,
                COALESCE(SUM(a.status = 'Present'), 0) AS present_count,
                COALESCE(SUM(a.status = 'Absent'), 0) AS absent_count
         FROM subjects sub
         LEFT JOIN attendance a ON sub.subject_id = a.subject_id
         GROUP BY sub.subject_id, sub.subject_name
         ORDER BY sub.subject_id`);
    const [recent] = await pool.query(
        `SELECT a.attendance_date, a.status, st.student_name, st.roll_no, sub.subject_name
         FROM attendance a
         JOIN students st ON a.student_id = st.student_id
         JOIN subjects sub ON a.subject_id = sub.subject_id
         ORDER BY a.attendance_date DESC, a.attendance_id DESC
         LIMIT 8`);

    const t = numbers([totals], ['students', 'faculty', 'subjects', 'records', 'present'])[0];
    res.json({
        totals: t,
        overall_percentage: t.records ? Math.round((t.present * 1000) / t.records) / 10 : null,
        below_threshold: Number(low.below_threshold),
        subjects: numbers(subjectRows, ['present_count', 'absent_count']),
        recent: recent
    });
}));

module.exports = router;
