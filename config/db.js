// MySQL connection pool - settings come from the .env file
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'college_attendance',
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,        // DATE columns come back as 'YYYY-MM-DD' text, not JavaScript dates
    decimalNumbers: true      // SUM() / ROUND() come back as numbers, not text
});

module.exports = pool;
