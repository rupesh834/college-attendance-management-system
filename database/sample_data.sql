-- Sample records used in the project report
USE college_attendance;

INSERT INTO faculty (faculty_name, department, phone, email) VALUES
('Rahul Sharma', 'Computer Science', '9000000001', 'rahul.sharma@college.edu'),
('Priya Patil', 'Computer Science', '9000000002', 'priya.patil@college.edu'),
('Amit Verma', 'E&TC', '9000000003', 'amit.verma@college.edu');

INSERT INTO students (student_name, roll_no, gender, phone, email, department, semester) VALUES
('Aarav Joshi', 'CS101', 'Male', '9100000001', 'aarav@college.edu', 'Computer Science', 5),
('Sneha Kulkarni', 'CS102', 'Female', '9100000002', 'sneha@college.edu', 'Computer Science', 5),
('Rohan Patil', 'ET103', 'Male', '9100000003', 'rohan@college.edu', 'E&TC', 5),
('Ananya Deshmukh', 'DS104', 'Female', '9100000004', 'ananya@college.edu', 'Data Science', 5),
('Vivek Singh', 'CS105', 'Male', '9100000005', 'vivek@college.edu', 'Computer Science', 5);

INSERT INTO subjects (subject_name, faculty_id, semester) VALUES
('DBMS', 1, 5),
('Computer Networks', 2, 5),
('Operating Systems', 3, 5);

INSERT INTO attendance (student_id, subject_id, attendance_date, status) VALUES
(1, 1, '2026-09-01', 'Present'),
(2, 1, '2026-09-01', 'Present'),
(3, 2, '2026-09-01', 'Absent'),
(4, 1, '2026-09-02', 'Present'),
(5, 2, '2026-09-02', 'Present');
