// Creates the database, tables, view, trigger and sample data.
//   npm run setup         -> report data only
//   npm run setup:demo    -> report data + extra attendance for realistic percentages
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Splits an SQL file into statements. Understands the "DELIMITER //" lines used for the trigger.
function splitSql(text) {
    const statements = [];
    let delimiter = ';';
    let buffer = '';
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (/^DELIMITER\s+/i.test(line)) { delimiter = line.split(/\s+/)[1]; continue; }
        if (line === '' || line.startsWith('--')) continue;
        buffer += raw + '\n';
        if (line.endsWith(delimiter)) {
            statements.push(buffer.trim().slice(0, -delimiter.length).trim());
            buffer = '';
        }
    }
    if (buffer.trim()) statements.push(buffer.trim());
    return statements.filter(Boolean);
}

async function runFile(conn, file) {
    const text = fs.readFileSync(path.join(__dirname, '..', 'database', file), 'utf8');
    const statements = splitSql(text);
    for (const sql of statements) await conn.query(sql);
    console.log('  ' + file + ': ' + statements.length + ' statements done');
}

async function main() {
    const withDemo = process.argv.includes('--demo');
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });
    console.log('Connected to MySQL. Creating the database...');
    await runFile(conn, 'schema.sql');
    await runFile(conn, 'sample_data.sql');
    if (withDemo) await runFile(conn, 'extra_demo_data.sql');

    const [[counts]] = await conn.query(
        `SELECT (SELECT COUNT(*) FROM students) AS students,
                (SELECT COUNT(*) FROM faculty) AS faculty,
                (SELECT COUNT(*) FROM subjects) AS subjects,
                (SELECT COUNT(*) FROM attendance) AS attendance`);
    console.log('Done:', counts.students, 'students,', counts.faculty, 'faculty,',
        counts.subjects, 'subjects,', counts.attendance, 'attendance records.');
    console.log('Now run: npm start');
    await conn.end();
}

main().catch((err) => {
    console.error('\nSetup failed: ' + (err.sqlMessage || err.message));
    if (err.code === 'ER_ACCESS_DENIED_ERROR') console.error('Wrong MySQL user or password. Fix DB_USER / DB_PASSWORD in the .env file.');
    if (err.code === 'ECONNREFUSED') console.error('MySQL is not running. Start the MySQL service and try again.');
    process.exit(1);
});
