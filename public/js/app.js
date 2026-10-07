/* ==========================================================================
   College Attendance Management System - frontend
   One page, no framework. Each menu item has a function that draws its page.
   ========================================================================== */
(function () {
    'use strict';

    const view = document.getElementById('view');
    const pageTitle = document.getElementById('page-title');
    const LOW_LIMIT = 75;          // attendance below this percentage is shown in red

    /* ---------- small helpers ---------- */
    const esc = (v) => String(v === null || v === undefined ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    function today() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function prettyDate(iso) {
        const d = new Date(iso + 'T00:00:00');
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    let toastTimer = null;
    function toast(message, isError) {
        const el = document.getElementById('toast');
        el.textContent = message;
        el.className = 'toast show' + (isError ? ' error' : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
    }

    function showError(err) {
        view.innerHTML = '<div class="error-box"><strong>Could not load this page.</strong><br>' + esc(err.message) + '</div>';
    }

    function debounce(fn, ms) {
        let t;
        return function () { const args = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, args), ms); };
    }

    const statusBadge = (s) => '<span class="badge ' + (s === 'Present' ? 'present' : 'absent') + '">' + esc(s) + '</span>';

    function percentCell(p, total) {
        if (!total) return '<span class="hint">no classes yet</span>';
        const low = p < LOW_LIMIT;
        return '<span class="bar ' + (low ? 'low' : '') + '"><i style="width:' + Math.min(100, p) + '%"></i></span>' +
            '<span class="badge ' + (low ? 'low' : 'ok') + '">' + p.toFixed(1) + '%</span>';
    }

    function table(headers, rows, emptyText) {
        if (!rows.length) return '<div class="table-wrap"><div class="empty">' + esc(emptyText || 'No records found.') + '</div></div>';
        return '<div class="table-wrap"><table><thead><tr>' +
            headers.map((h) => '<th class="' + (h.cls || '') + '">' + esc(h.label === undefined ? h : h.label) + '</th>').join('') +
            '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
    }

    /* ---------- modal form ---------- */
    function openModal(title, bodyHtml) {
        const root = document.getElementById('modal-root');
        root.innerHTML = '<div class="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
            '<div class="modal-head"><h2>' + esc(title) + '</h2><button class="modal-close" aria-label="Close" type="button">&times;</button></div>' +
            '<div class="modal-body">' + bodyHtml + '</div></div></div>';
        const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        root.querySelector('.modal-close').addEventListener('click', close);
        root.querySelector('.modal-back').addEventListener('mousedown', (e) => { if (e.target.classList.contains('modal-back')) close(); });
        return { root: root.querySelector('.modal-body'), close: close };
    }

    // fields: [{ name, label, type, required, options, full }]
    function openForm(title, fields, values, onSave) {
        const html = '<form novalidate><div class="form-grid">' + fields.map((f) => {
            const v = values && values[f.name] !== undefined && values[f.name] !== null ? values[f.name] : '';
            let input;
            if (f.type === 'select') {
                input = '<select name="' + f.name + '" id="f_' + f.name + '">' +
                    (f.blank ? '<option value="">' + esc(f.blank) + '</option>' : '') +
                    f.options.map((o) => '<option value="' + esc(o.value) + '"' + (String(o.value) === String(v) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>';
            } else {
                input = '<input type="' + (f.type || 'text') + '" name="' + f.name + '" id="f_' + f.name + '" value="' + esc(v) + '"' +
                    (f.type === 'number' ? ' min="1" max="8"' : '') + ' autocomplete="off">';
            }
            return '<div class="field' + (f.full ? ' full' : '') + '"><label class="' + (f.required ? 'req' : '') + '" for="f_' + f.name + '">' + esc(f.label) + '</label>' + input + '</div>';
        }).join('') + '</div><p class="form-error" role="alert"></p>' +
            '<div class="modal-foot"><button type="button" class="btn secondary" data-cancel>Cancel</button><button type="submit" class="btn">Save</button></div></form>';
        const modal = openModal(title, html);
        const form = modal.root.querySelector('form');
        const errorEl = form.querySelector('.form-error');
        const first = form.querySelector('input, select');
        if (first) first.focus();
        form.querySelector('[data-cancel]').addEventListener('click', modal.close);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {};
            fields.forEach((f) => { data[f.name] = form.elements[f.name].value; });
            const button = form.querySelector('button[type=submit]');
            button.disabled = true;
            errorEl.textContent = '';
            try {
                await onSave(data);
                modal.close();
            } catch (err) {
                errorEl.textContent = err.message;
                button.disabled = false;
            }
        });
    }

    /* ==================== generic table page with Add / Edit / Delete ==================== */
    function crudPage(cfg) {
        return async function render() {
            view.innerHTML = '<div class="toolbar">' +
                '<div class="field grow"><label for="search">Search</label><input type="search" id="search" placeholder="' + esc(cfg.searchHint) + '"></div>' +
                '<button class="btn" id="add">+ Add ' + esc(cfg.noun) + '</button></div><div id="list"></div>';
            const list = document.getElementById('list');
            let context = {};
            let rows = [];

            async function load() {
                const q = document.getElementById('search').value.trim();
                rows = await api.get(cfg.endpoint + (q ? '?search=' + encodeURIComponent(q) : ''));
                list.innerHTML = table(
                    cfg.columns.map((c) => ({ label: c.label, cls: c.num ? 'num' : '' })).concat([{ label: 'Actions', cls: 'actions' }]),
                    rows.map((r) => '<tr>' + cfg.columns.map((c) => '<td' + (c.num ? ' class="num"' : '') + '>' + (c.html ? c.html(r) : esc(r[c.key] === null ? '-' : r[c.key])) + '</td>').join('') +
                        '<td class="actions"><button class="btn secondary small" data-edit="' + r[cfg.idKey] + '">Edit</button>' +
                        '<button class="btn danger small" data-del="' + r[cfg.idKey] + '">Delete</button></td></tr>'),
                    'No ' + cfg.noun.toLowerCase() + ' records found.');
            }

            try {
                if (cfg.loadContext) context = await cfg.loadContext();
                await load();
            } catch (err) { return showError(err); }

            document.getElementById('search').addEventListener('input', debounce(() => load().catch((e) => toast(e.message, true)), 250));
            document.getElementById('add').addEventListener('click', () => {
                openForm('Add ' + cfg.noun, cfg.fields(context), cfg.defaults || {}, async (data) => {
                    await api.post(cfg.endpoint, data);
                    toast(cfg.noun + ' added.');
                    await load();
                });
            });
            list.addEventListener('click', async (e) => {
                const editId = e.target.getAttribute('data-edit');
                const delId = e.target.getAttribute('data-del');
                if (editId) {
                    const row = rows.find((r) => String(r[cfg.idKey]) === editId);
                    openForm('Edit ' + cfg.noun, cfg.fields(context), row, async (data) => {
                        await api.put(cfg.endpoint + '/' + editId, data);
                        toast(cfg.noun + ' updated.');
                        await load();
                    });
                }
                if (delId) {
                    const row = rows.find((r) => String(r[cfg.idKey]) === delId);
                    if (!confirm(cfg.confirmDelete(row))) return;
                    try {
                        await api.del(cfg.endpoint + '/' + delId);
                        toast(cfg.noun + ' deleted.');
                        await load();
                    } catch (err) { toast(err.message, true); }
                }
            });
        };
    }

    const semesterOptions = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: n, label: 'Semester ' + n }));

    const studentsPage = crudPage({
        endpoint: '/api/students', idKey: 'student_id', noun: 'Student', searchHint: 'Name, roll number or department',
        columns: [
            { key: 'student_id', label: 'ID', num: true }, { key: 'student_name', label: 'Name' }, { key: 'roll_no', label: 'Roll No.' },
            { key: 'gender', label: 'Gender' }, { key: 'department', label: 'Department' }, { key: 'semester', label: 'Semester', num: true },
            { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }
        ],
        defaults: { semester: 5, gender: 'Male' },
        fields: () => [
            { name: 'student_name', label: 'Student name', required: true, full: true },
            { name: 'roll_no', label: 'Roll number' },
            { name: 'gender', label: 'Gender', type: 'select', required: true, options: ['Male', 'Female', 'Other'].map((g) => ({ value: g, label: g })) },
            { name: 'department', label: 'Department', required: true },
            { name: 'semester', label: 'Semester', type: 'select', required: true, options: semesterOptions },
            { name: 'phone', label: 'Phone (digits only)' },
            { name: 'email', label: 'Email', type: 'email' }
        ],
        confirmDelete: (r) => 'Delete ' + r.student_name + '? All attendance records of this student will also be deleted.'
    });

    const facultyPage = crudPage({
        endpoint: '/api/faculty', idKey: 'faculty_id', noun: 'Faculty', searchHint: 'Name or department',
        columns: [
            { key: 'faculty_id', label: 'ID', num: true }, { key: 'faculty_name', label: 'Name' },
            { key: 'department', label: 'Department' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }
        ],
        fields: () => [
            { name: 'faculty_name', label: 'Faculty name', required: true, full: true },
            { name: 'department', label: 'Department', full: true },
            { name: 'phone', label: 'Phone (digits only)' },
            { name: 'email', label: 'Email', type: 'email' }
        ],
        confirmDelete: (r) => 'Delete ' + r.faculty_name + '? Their subjects will stay but will have no faculty assigned.'
    });

    const subjectsPage = crudPage({
        endpoint: '/api/subjects', idKey: 'subject_id', noun: 'Subject', searchHint: 'Subject or faculty name',
        loadContext: async () => ({ faculty: await api.get('/api/faculty') }),
        columns: [
            { key: 'subject_id', label: 'ID', num: true }, { key: 'subject_name', label: 'Subject' },
            { key: 'faculty_name', label: 'Faculty' }, { key: 'semester', label: 'Semester', num: true }
        ],
        defaults: { semester: 5 },
        fields: (ctx) => [
            { name: 'subject_name', label: 'Subject name', required: true, full: true },
            { name: 'faculty_id', label: 'Faculty', type: 'select', blank: '- not assigned -', options: ctx.faculty.map((f) => ({ value: f.faculty_id, label: f.faculty_name })) },
            { name: 'semester', label: 'Semester', type: 'select', required: true, options: semesterOptions }
        ],
        confirmDelete: (r) => 'Delete ' + r.subject_name + '? All attendance records of this subject will also be deleted.'
    });

    /* ==================== Dashboard ==================== */
    async function dashboardPage() {
        let d;
        try { d = await api.get('/api/dashboard'); } catch (err) { return showError(err); }
        const t = d.totals;
        view.innerHTML =
            '<div class="cards">' +
            '<div class="stat"><div class="num">' + t.students + '</div><div class="lbl">Students</div></div>' +
            '<div class="stat"><div class="num">' + t.faculty + '</div><div class="lbl">Faculty members</div></div>' +
            '<div class="stat"><div class="num">' + t.subjects + '</div><div class="lbl">Subjects</div></div>' +
            '<div class="stat"><div class="num">' + t.records + '</div><div class="lbl">Attendance records</div></div>' +
            '<div class="stat green"><div class="num">' + (d.overall_percentage === null ? '-' : d.overall_percentage + '%') + '</div><div class="lbl">Overall attendance</div></div>' +
            '<div class="stat red"><div class="num">' + d.below_threshold + '</div><div class="lbl">Students below ' + LOW_LIMIT + '%</div></div>' +
            '</div>' +
            '<div class="grid-2">' +
            '<div class="panel"><h2>Subject-wise attendance</h2>' + table(['Subject', 'Present', 'Absent', 'Present %'],
                d.subjects.map((s) => {
                    const total = s.present_count + s.absent_count;
                    return '<tr><td>' + esc(s.subject_name) + '</td><td>' + s.present_count + '</td><td>' + s.absent_count + '</td><td>' +
                        percentCell(total ? (s.present_count * 100) / total : 0, total) + '</td></tr>';
                }), 'No subjects yet.') + '</div>' +
            '<div class="panel"><h2>Recent attendance</h2>' + table(['Date', 'Student', 'Subject', 'Status'],
                d.recent.map((r) => '<tr><td>' + prettyDate(r.attendance_date) + '</td><td>' + esc(r.student_name) + '</td><td>' + esc(r.subject_name) + '</td><td>' + statusBadge(r.status) + '</td></tr>'),
                'No attendance marked yet.') + '</div></div>';
    }

    /* ==================== Mark attendance ==================== */
    async function markPage() {
        let subjects;
        try { subjects = await api.get('/api/subjects'); } catch (err) { return showError(err); }
        if (!subjects.length) { view.innerHTML = '<div class="note">Add a subject first, then you can mark attendance.</div>'; return; }

        view.innerHTML =
            '<div class="toolbar">' +
            '<div class="field grow"><label for="subject">Subject</label><select id="subject">' +
            subjects.map((s) => '<option value="' + s.subject_id + '">' + esc(s.subject_name) + ' (Semester ' + s.semester + ')</option>').join('') + '</select></div>' +
            '<div class="field"><label for="date">Date</label><input type="date" id="date" value="' + today() + '" max="' + today() + '"></div></div>' +
            '<div id="sheet"></div>';

        const sheetEl = document.getElementById('sheet');
        let students = [];
        let existing = 0;

        function counts() {
            const present = students.filter((s) => s.status === 'Present').length;
            return { present: present, absent: students.length - present };
        }

        function drawSheet() {
            const c = counts();
            sheetEl.innerHTML =
                (existing ? '<div class="note">Attendance for this subject and date is already saved. Saving again will update it.</div>' : '') +
                '<div class="summary-line"><span><strong id="c-present">' + c.present + '</strong> present</span>' +
                '<span><strong id="c-absent">' + c.absent + '</strong> absent</span>' +
                '<button class="btn secondary small" id="all-present">Mark all present</button>' +
                '<button class="btn secondary small" id="all-absent">Mark all absent</button></div>' +
                table(['Roll No.', 'Student', 'Status'], students.map((s) =>
                    '<tr><td>' + esc(s.roll_no || '-') + '</td><td>' + esc(s.student_name) + '</td><td><div class="seg" data-student="' + s.student_id + '">' +
                    '<button type="button" data-status="Present" class="' + (s.status === 'Present' ? 'on-present' : '') + '">Present</button>' +
                    '<button type="button" data-status="Absent" class="' + (s.status === 'Absent' ? 'on-absent' : '') + '">Absent</button></div></td></tr>'),
                    'No students found for this semester.') +
                (students.length ? '<p><button class="btn" id="save">Save attendance</button></p>' : '');
        }

        async function loadSheet() {
            const subjectId = document.getElementById('subject').value;
            const date = document.getElementById('date').value;
            if (!date) return;
            try {
                const data = await api.get('/api/attendance/sheet?subject_id=' + subjectId + '&date=' + date);
                existing = data.students.filter((s) => s.attendance_id).length;
                students = data.students.map((s) => ({ student_id: s.student_id, student_name: s.student_name, roll_no: s.roll_no, status: s.status || 'Present' }));
                drawSheet();
            } catch (err) {
                sheetEl.innerHTML = '<div class="error-box">' + esc(err.message) + '</div>';
            }
        }

        document.getElementById('subject').addEventListener('change', loadSheet);
        document.getElementById('date').addEventListener('change', loadSheet);

        sheetEl.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.hasAttribute('data-status')) {
                const id = Number(btn.parentElement.getAttribute('data-student'));
                const s = students.find((x) => x.student_id === id);
                s.status = btn.getAttribute('data-status');
                drawSheet();
            } else if (btn.id === 'all-present' || btn.id === 'all-absent') {
                const status = btn.id === 'all-present' ? 'Present' : 'Absent';
                students.forEach((s) => { s.status = status; });
                drawSheet();
            } else if (btn.id === 'save') {
                btn.disabled = true;
                try {
                    const result = await api.post('/api/attendance/bulk', {
                        subject_id: Number(document.getElementById('subject').value),
                        date: document.getElementById('date').value,
                        records: students.map((s) => ({ student_id: s.student_id, status: s.status }))
                    });
                    toast('Attendance saved for ' + result.saved + ' students.');
                    await loadSheet();
                } catch (err) {
                    toast(err.message, true);
                    btn.disabled = false;
                }
            }
        });

        loadSheet();
    }

    /* ==================== Attendance records ==================== */
    async function recordsPage() {
        let subjects;
        try { subjects = await api.get('/api/subjects'); } catch (err) { return showError(err); }
        view.innerHTML =
            '<div class="toolbar">' +
            '<div class="field"><label for="f-subject">Subject</label><select id="f-subject"><option value="">All subjects</option>' +
            subjects.map((s) => '<option value="' + s.subject_id + '">' + esc(s.subject_name) + '</option>').join('') + '</select></div>' +
            '<div class="field"><label for="f-date">Date</label><input type="date" id="f-date"></div>' +
            '<div class="field grow"><label for="f-search">Student</label><input type="search" id="f-search" placeholder="Name or roll number"></div>' +
            '<button class="btn secondary" id="f-clear">Clear</button></div>' +
            '<div id="list"></div><p class="hint" id="limit-note"></p>';
        const list = document.getElementById('list');
        let rows = [];

        async function load() {
            const p = new URLSearchParams();
            const sub = document.getElementById('f-subject').value;
            const date = document.getElementById('f-date').value;
            const q = document.getElementById('f-search').value.trim();
            if (sub) p.set('subject_id', sub);
            if (date) p.set('date', date);
            if (q) p.set('search', q);
            rows = await api.get('/api/attendance' + (p.toString() ? '?' + p.toString() : ''));
            list.innerHTML = table(
                ['ID', 'Date', 'Roll No.', 'Student', 'Subject', 'Status', { label: 'Actions', cls: 'actions' }],
                rows.map((r) => '<tr><td>' + r.attendance_id + '</td><td>' + prettyDate(r.attendance_date) + '</td><td>' + esc(r.roll_no || '-') + '</td><td>' + esc(r.student_name) +
                    '</td><td>' + esc(r.subject_name) + '</td><td>' + statusBadge(r.status) + '</td><td class="actions">' +
                    '<button class="btn secondary small" data-toggle="' + r.attendance_id + '">Mark ' + (r.status === 'Present' ? 'Absent' : 'Present') + '</button>' +
                    '<button class="btn danger small" data-del="' + r.attendance_id + '">Delete</button></td></tr>'),
                'No attendance records match these filters.');
            document.getElementById('limit-note').textContent = rows.length >= 300 ? 'Showing the latest 300 records. Use the filters to narrow down.' : '';
        }

        const reload = () => load().catch((e) => toast(e.message, true));
        ['f-subject', 'f-date'].forEach((id) => document.getElementById(id).addEventListener('change', reload));
        document.getElementById('f-search').addEventListener('input', debounce(reload, 250));
        document.getElementById('f-clear').addEventListener('click', () => {
            document.getElementById('f-subject').value = '';
            document.getElementById('f-date').value = '';
            document.getElementById('f-search').value = '';
            reload();
        });
        list.addEventListener('click', async (e) => {
            const toggleId = e.target.getAttribute('data-toggle');
            const delId = e.target.getAttribute('data-del');
            try {
                if (toggleId) {
                    const row = rows.find((r) => String(r.attendance_id) === toggleId);
                    await api.put('/api/attendance/' + toggleId, { status: row.status === 'Present' ? 'Absent' : 'Present' });
                    toast('Status updated.');
                    await load();
                } else if (delId) {
                    if (!confirm('Delete this attendance record?')) return;
                    await api.del('/api/attendance/' + delId);
                    toast('Attendance record deleted.');
                    await load();
                }
            } catch (err) { toast(err.message, true); }
        });
        reload();
    }

    /* ==================== Reports ==================== */
    function downloadCsv(filename, headers, rows) {
        const cell = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
        const text = [headers].concat(rows).map((r) => r.map(cell).join(',')).join('\r\n');
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    async function showReportCard(studentId) {
        try {
            const d = await api.get('/api/students/' + studentId + '/attendance');
            const body = '<p><strong>' + esc(d.student.student_name) + '</strong> &middot; ' + esc(d.student.roll_no || '-') + ' &middot; ' + esc(d.student.department) + ', Semester ' + d.student.semester + '</p>' +
                table(['Subject', 'Classes', 'Present', 'Attendance'], d.subjects.map((s) =>
                    '<tr><td>' + esc(s.subject_name) + '</td><td>' + s.total_classes + '</td><td>' + s.classes_present + '</td><td>' + percentCell(s.attendance_percentage, s.total_classes) + '</td></tr>'),
                    'No attendance recorded for this student yet.');
            openModal('Attendance report card', body);
        } catch (err) { toast(err.message, true); }
    }

    async function reportsPage() {
        view.innerHTML =
            '<div class="tabs" role="tablist">' +
            '<button class="active" data-tab="students">Student-wise percentage</button>' +
            '<button data-tab="subjects">Subject-wise summary</button>' +
            '<button data-tab="low">Low attendance</button></div>' +
            '<div id="report"></div>';
        const box = document.getElementById('report');
        let current = 'students';
        let csv = null;

        async function draw() {
            csv = null;
            try {
                if (current === 'students') {
                    const rows = await api.get('/api/reports/student-summary');
                    csv = { name: 'student_attendance_percentage.csv', headers: ['Roll No', 'Student', 'Total classes', 'Present', 'Percentage'],
                        rows: rows.map((r) => [r.roll_no, r.student_name, r.total_classes, r.classes_present, r.attendance_percentage]) };
                    box.innerHTML = '<p class="hint">Calculated by the SQL view <code>student_attendance_summary</code>. Percentages below ' + LOW_LIMIT + ' are shown in red.</p>' +
                        table(['Roll No.', 'Student', { label: 'Classes', cls: 'num' }, { label: 'Present', cls: 'num' }, 'Attendance', ''], rows.map((r) =>
                            '<tr><td>' + esc(r.roll_no || '-') + '</td><td>' + esc(r.student_name) + '</td><td class="num">' + r.total_classes + '</td><td class="num">' + (r.classes_present || 0) + '</td><td>' +
                            percentCell(r.attendance_percentage || 0, r.total_classes) + '</td><td><button class="btn secondary small" data-card="' + r.student_id + '">Report card</button></td></tr>'),
                            'No students yet.');
                } else if (current === 'subjects') {
                    const rows = await api.get('/api/reports/subject-summary');
                    csv = { name: 'subject_attendance_summary.csv', headers: ['Subject', 'Present', 'Absent'], rows: rows.map((r) => [r.subject_name, r.present_count, r.absent_count]) };
                    box.innerHTML = table(['Subject', { label: 'Present', cls: 'num' }, { label: 'Absent', cls: 'num' }, 'Present %'], rows.map((r) => {
                        const total = r.present_count + r.absent_count;
                        return '<tr><td>' + esc(r.subject_name) + '</td><td class="num">' + r.present_count + '</td><td class="num">' + r.absent_count + '</td><td>' + percentCell(total ? (r.present_count * 100) / total : 0, total) + '</td></tr>';
                    }), 'No subjects yet.');
                } else {
                    const threshold = Number((document.getElementById('threshold') || {}).value) || LOW_LIMIT;
                    const data = await api.get('/api/reports/low-attendance?threshold=' + threshold);
                    csv = { name: 'low_attendance_students.csv', headers: ['Roll No', 'Student', 'Total classes', 'Present', 'Percentage'],
                        rows: data.students.map((r) => [r.roll_no, r.student_name, r.total_classes, r.classes_present, r.attendance_percentage]) };
                    box.innerHTML = '<div class="toolbar"><div class="field"><label for="threshold">Show students below (%)</label><input type="number" id="threshold" min="1" max="100" value="' + data.threshold + '"></div>' +
                        '<button class="btn secondary" id="apply">Apply</button></div>' +
                        table(['Roll No.', 'Student', { label: 'Classes', cls: 'num' }, { label: 'Present', cls: 'num' }, 'Attendance', ''], data.students.map((r) =>
                            '<tr><td>' + esc(r.roll_no || '-') + '</td><td>' + esc(r.student_name) + '</td><td class="num">' + r.total_classes + '</td><td class="num">' + r.classes_present + '</td><td>' +
                            percentCell(r.attendance_percentage, r.total_classes) + '</td><td><button class="btn secondary small" data-card="' + r.student_id + '">Report card</button></td></tr>'),
                            'No student is below ' + data.threshold + '%.');
                }
                box.insertAdjacentHTML('beforeend', '<p style="margin-top:14px"><button class="btn secondary" id="export">Export CSV</button> <button class="btn secondary" id="print">Print</button></p>');
            } catch (err) { box.innerHTML = '<div class="error-box">' + esc(err.message) + '</div>'; }
        }

        view.querySelector('.tabs').addEventListener('click', (e) => {
            const tab = e.target.getAttribute('data-tab');
            if (!tab) return;
            current = tab;
            view.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b === e.target));
            draw();
        });
        box.addEventListener('click', (e) => {
            const card = e.target.getAttribute('data-card');
            if (card) showReportCard(card);
            else if (e.target.id === 'apply') draw();
            else if (e.target.id === 'export' && csv) downloadCsv(csv.name, csv.headers, csv.rows);
            else if (e.target.id === 'print') window.print();
        });
        draw();
    }

    /* ==================== router ==================== */
    const pages = {
        dashboard: { title: 'Dashboard', render: dashboardPage },
        students: { title: 'Students', render: studentsPage },
        faculty: { title: 'Faculty', render: facultyPage },
        subjects: { title: 'Subjects', render: subjectsPage },
        mark: { title: 'Mark Attendance', render: markPage },
        records: { title: 'Attendance Records', render: recordsPage },
        reports: { title: 'Reports', render: reportsPage }
    };

    function route() {
        let key = location.hash.replace('#/', '');
        if (!pages[key]) key = 'dashboard';
        document.querySelectorAll('.sidebar a').forEach((a) => a.classList.toggle('active', a.getAttribute('data-page') === key));
        pageTitle.textContent = pages[key].title;
        document.title = pages[key].title + ' - College Attendance Management System';
        view.innerHTML = '<p class="hint">Loading...</p>';
        pages[key].render();
    }

    document.getElementById('today').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    window.addEventListener('hashchange', route);
    route();
})();
