// Small helpers shared by all route files

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Express 4 does not catch errors thrown inside async handlers, so wrap them.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// trim text; empty text becomes null (important for UNIQUE columns such as phone and email)
function clean(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text === '' ? null : text;
}

function toInt(value) {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isInteger(n) ? n : null;
}

function todayString() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
}

// 'YYYY-MM-DD' and a real calendar date
function isValidDate(text) {
    if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const d = new Date(text + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

// make sure aggregate columns are real numbers
function numbers(rows, keys) {
    return rows.map((row) => {
        const copy = Object.assign({}, row);
        keys.forEach((k) => { if (copy[k] !== null && copy[k] !== undefined) copy[k] = Number(copy[k]); });
        return copy;
    });
}

module.exports = { HttpError, asyncHandler, clean, toInt, todayString, isValidDate, numbers };
