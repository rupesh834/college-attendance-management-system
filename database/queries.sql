-- ============================================================
-- Important queries of the project (run them one by one in MySQL Workbench)
-- ============================================================
USE college_attendance;

-- DML: UPDATE and DELETE examples ---------------------------
UPDATE students SET phone = '9199999999' WHERE student_id = 1;
UPDATE attendance SET status = 'Present' WHERE attendance_id = 3;
-- DELETE FROM attendance WHERE attendance_id = 5;

-- Q1: students with their attendance (INNER JOIN)
SELECT s.student_id, s.student_name, sub.subject_name, a.attendance_date, a.status
FROM students s
INNER JOIN attendance a ON s.student_id = a.student_id
INNER JOIN subjects sub ON a.subject_id = sub.subject_id;

-- Q2: subject-wise present count (GROUP BY, COUNT)
SELECT sub.subject_name, COUNT(*) AS present_count
FROM attendance a
JOIN subjects sub ON a.subject_id = sub.subject_id
WHERE a.status = 'Present'
GROUP BY sub.subject_name;

-- Q3: attendance percentage of each student (SUM, ROUND)
SELECT student_id,
       ROUND(SUM(status = 'Present') * 100.0 / COUNT(*), 2) AS attendance_percentage
FROM attendance
GROUP BY student_id;

-- Q4: students below the 75 percent threshold (HAVING)
SELECT student_id,
       ROUND(SUM(status = 'Present') * 100.0 / COUNT(*), 2) AS percentage
FROM attendance
GROUP BY student_id
HAVING percentage < 75;

-- Q5: subject-wise present and absent summary (LEFT JOIN)
SELECT sub.subject_name,
       SUM(a.status = 'Present') AS present_count,
       SUM(a.status = 'Absent') AS absent_count
FROM subjects sub
LEFT JOIN attendance a ON sub.subject_id = a.subject_id
GROUP BY sub.subject_name;

-- Q6: student, subject and faculty details (LEFT JOIN)
SELECT DISTINCT st.student_id, st.student_name, st.roll_no, sub.subject_name, f.faculty_name
FROM students st
JOIN attendance a ON st.student_id = a.student_id
JOIN subjects sub ON a.subject_id = sub.subject_id
LEFT JOIN faculty f ON sub.faculty_id = f.faculty_id;

-- VIEW
SELECT * FROM student_attendance_summary;

-- TRIGGER test: this insert must FAIL with "Attendance cannot be marked for a future date"
INSERT INTO attendance (student_id, subject_id, attendance_date, status)
VALUES (1, 1, DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'Present');

-- TRANSACTION: COMMIT
START TRANSACTION;
INSERT INTO attendance (student_id, subject_id, attendance_date, status)
VALUES (1, 2, '2026-09-03', 'Present'),
       (2, 2, '2026-09-03', 'Absent'),
       (3, 2, '2026-09-03', 'Present');
COMMIT;

-- TRANSACTION: ROLLBACK (undo a wrong delete)
START TRANSACTION;
DELETE FROM attendance WHERE attendance_date = '2026-09-03';
ROLLBACK;
