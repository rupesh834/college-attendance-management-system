// College Attendance Management System - Express server
require('dotenv').config();
const path = require('path');
const express = require('express');
const pool = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { asyncHandler } = require('./utils/helpers');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', asyncHandler(async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: process.env.DB_NAME || 'college_attendance' });
}));

app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/students', require('./routes/students'));
app.use('/api/faculty', require('./routes/faculty'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/reports', require('./routes/reports'));

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, async () => {
    console.log('Server running at http://localhost:' + PORT);
    try {
        await pool.query('SELECT 1');
        console.log('MySQL connected.');
    } catch (err) {
        console.log('MySQL is NOT connected (' + (err.code || err.message) + ').');
        console.log('Check .env and run "npm run setup" once. The page will show the same message.');
    }
});
