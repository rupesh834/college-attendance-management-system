// Turns database and validation errors into short, readable messages for the page

const FRIENDLY_KEYS = {
    roll_no: 'Roll number',
    phone: 'Phone number',
    email: 'Email'
};

function duplicateMessage(err) {
    const text = err.sqlMessage || err.message || '';
    if (/attendance/i.test(text) && /student_id|subject_id/i.test(text)) {
        return 'Attendance for this student, subject and date is already recorded.';
    }
    const m = text.match(/for key '([^']+)'/);
    const key = m ? m[1].split('.').pop() : '';
    for (const name of Object.keys(FRIENDLY_KEYS)) {
        if (key.includes(name)) return FRIENDLY_KEYS[name] + ' already exists. Please enter a different one.';
    }
    return 'This record already exists.';
}

function errorHandler(err, req, res, next) {      // eslint-disable-line no-unused-vars
    if (err.status) return res.status(err.status).json({ error: err.message });

    switch (err.code) {
        case 'ER_DUP_ENTRY':
            return res.status(409).json({ error: duplicateMessage(err) });
        case 'ER_NO_REFERENCED_ROW_2':
        case 'ER_NO_REFERENCED_ROW':
            return res.status(400).json({ error: 'The selected student, subject or faculty does not exist.' });
        case 'ER_CHECK_CONSTRAINT_VIOLATED':
            return res.status(400).json({ error: 'A value is outside the allowed range (semester must be 1 to 8).' });
        case 'ER_SIGNAL_EXCEPTION':               // raised by the trigger
            return res.status(400).json({ error: err.sqlMessage || err.message });
        case 'ECONNREFUSED':
        case 'ER_ACCESS_DENIED_ERROR':
        case 'ER_BAD_DB_ERROR':
        case 'ER_NO_SUCH_TABLE':
        case 'PROTOCOL_CONNECTION_LOST':
        case 'ENOTFOUND':
            return res.status(503).json({
                error: 'Cannot reach the database. Check that MySQL is running, the .env password is correct, and "npm run setup" has been run.'
            });
        default:
            console.error(err);
            return res.status(500).json({ error: 'Something went wrong on the server.' });
    }
}

module.exports = errorHandler;
