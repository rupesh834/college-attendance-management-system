const router = require('express').Router();
const pool = require('../config/db');
const { HttpError, asyncHandler, clean, toInt } = require('../utils/helpers');

function readFaculty(body) {
    const f = {
        faculty_name: clean(body.faculty_name),
        department: clean(body.department),
        phone: clean(body.phone),
        email: clean(body.email)
    };
    if (!f.faculty_name) throw new HttpError(400, 'Faculty name is required.');
    if (f.phone && !/^\d{7,15}$/.test(f.phone)) throw new HttpError(400, 'Phone number must have 7 to 15 digits.');
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) throw new HttpError(400, 'Enter a valid email address.');
    return f;
}

router.get('/', asyncHandler(async (req, res) => {
    const search = clean(req.query.search);
    let sql = 'SELECT * FROM faculty';
    const params = [];
    if (search) {
        sql += ' WHERE faculty_name LIKE ? OR department LIKE ?';
        params.push('%' + search + '%', '%' + search + '%');
    }
    sql += ' ORDER BY faculty_id';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
}));

router.post('/', asyncHandler(async (req, res) => {
    const f = readFaculty(req.body);
    const [result] = await pool.query(
        'INSERT INTO faculty (faculty_name, department, phone, email) VALUES (?, ?, ?, ?)',
        [f.faculty_name, f.department, f.phone, f.email]);
    const [rows] = await pool.query('SELECT * FROM faculty WHERE faculty_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
    const id = toInt(req.params.id);
    const f = readFaculty(req.body);
    const [found] = await pool.query('SELECT faculty_id FROM faculty WHERE faculty_id = ?', [id]);
    if (!found.length) throw new HttpError(404, 'Faculty not found.');
    await pool.query(
        'UPDATE faculty SET faculty_name = ?, department = ?, phone = ?, email = ? WHERE faculty_id = ?',
        [f.faculty_name, f.department, f.phone, f.email, id]);
    const [rows] = await pool.query('SELECT * FROM faculty WHERE faculty_id = ?', [id]);
    res.json(rows[0]);
}));

// subjects taught by this faculty keep existing, their faculty becomes empty (ON DELETE SET NULL)
router.delete('/:id', asyncHandler(async (req, res) => {
    const [result] = await pool.query('DELETE FROM faculty WHERE faculty_id = ?', [toInt(req.params.id)]);
    if (!result.affectedRows) throw new HttpError(404, 'Faculty not found.');
    res.json({ message: 'Faculty deleted.' });
}));

module.exports = router;
