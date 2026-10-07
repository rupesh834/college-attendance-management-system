-- ============================================================
-- College Attendance Management System - database schema
-- Needs MySQL 8.0.16 or newer (CHECK constraints are enforced from 8.0.16).
-- WARNING: this script DROPS and recreates the database college_attendance.
-- Run it in MySQL Workbench (File > Open SQL Script > Execute) or with: npm run setup
-- ============================================================

DROP DATABASE IF EXISTS college_attendance;
CREATE DATABASE college_attendance;
USE college_attendance;

-- 1. faculty ------------------------------------------------
CREATE TABLE faculty (
    faculty_id   INT PRIMARY KEY AUTO_INCREMENT,
    faculty_name VARCHAR(100) NOT NULL,
    department   VARCHAR(100),
    phone        VARCHAR(15) UNIQUE,
    email        VARCHAR(100) UNIQUE
);

-- 2. students -----------------------------------------------
CREATE TABLE students (
    student_id   INT PRIMARY KEY AUTO_INCREMENT,
    student_name VARCHAR(100) NOT NULL,
    roll_no      VARCHAR(20) UNIQUE,
    gender       ENUM('Male','Female','Other') NOT NULL,
    phone        VARCHAR(15) UNIQUE,
    email        VARCHAR(100) UNIQUE,
    department   VARCHAR(100) NOT NULL,
    semester     INT CHECK (semester BETWEEN 1 AND 8)
);

-- 3. subjects (each subject is taught by one faculty member) -
CREATE TABLE subjects (
    subject_id   INT PRIMARY KEY AUTO_INCREMENT,
    subject_name VARCHAR(100) NOT NULL,
    faculty_id   INT,
    semester     INT CHECK (semester BETWEEN 1 AND 8),
    FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

-- 4. attendance (connects a student with a subject on one date) -
CREATE TABLE attendance (
    attendance_id   INT PRIMARY KEY AUTO_INCREMENT,
    student_id      INT NOT NULL,
    subject_id      INT NOT NULL,
    attendance_date DATE NOT NULL,
    status          ENUM('Present','Absent') NOT NULL DEFAULT 'Present',
    FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE (student_id, subject_id, attendance_date)
);

-- 5. view: attendance percentage of every student ------------
CREATE OR REPLACE VIEW student_attendance_summary AS
SELECT s.student_id,
       s.student_name,
       s.roll_no,
       COUNT(a.attendance_id) AS total_classes,
       SUM(a.status = 'Present') AS classes_present,
       ROUND(SUM(a.status = 'Present') * 100.0
             / NULLIF(COUNT(a.attendance_id), 0), 2) AS attendance_percentage
FROM students s
LEFT JOIN attendance a ON s.student_id = a.student_id
GROUP BY s.student_id, s.student_name, s.roll_no;

-- 6. trigger: attendance cannot be marked for a future date --
DELIMITER //
CREATE TRIGGER trg_block_future_attendance
BEFORE INSERT ON attendance
FOR EACH ROW
BEGIN
    IF NEW.attendance_date > CURDATE() THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Attendance cannot be marked for a future date';
    END IF;
END //
DELIMITER ;
