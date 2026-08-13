const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const DB_FILE = './db.json';

// ==================== AUTENTIKASI ====================
// Password admin — ubah lewat env ADMIN_PASSWORD atau default ini
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const sessions = new Map(); // token -> expiry timestamp

// Bikin token session (30 hari)
function createSession() {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 hari
    sessions.set(token, expires);
    return token;
}

// Middleware: cek token valid
function requireAuth(req, res, next) {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    const expiry = sessions.get(token);
    if (!token || !expiry || Date.now() > expiry) {
        return res.status(401).json({ error: 'Unauthorized. Silakan login dulu.' });
    }
    next();
}

// Bersihkan session expired (panggil tiap request)
function cleanupSessions() {
    const now = Date.now();
    for (const [token, exp] of sessions) {
        if (now > exp) sessions.delete(token);
    }
}

// Endpoint login
app.post('/api/login', (req, res) => {
    const { password } = req.body || {};
    if (password === ADMIN_PASSWORD) {
        const token = createSession();
        res.json({ success: true, token });
    } else {
        res.status(401).json({ error: 'Password salah!' });
    }
});

// Endpoint logout
app.post('/api/logout', (req, res) => {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    sessions.delete(token);
    res.json({ success: true });
});

// Endpoint cek status login
app.get('/api/auth/status', (req, res) => {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    const expiry = sessions.get(token);
    cleanupSessions();
    res.json({ authenticated: !!(token && expiry && Date.now() <= expiry) });
});

// Inisialisasi DB
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ transactions: [], funds: [] }));
}

function readDB() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ==================== DANA (Funds Management) ====================
app.post('/api/fund/add', requireAuth, (req, res) => {
    try {
        const { name, target, icon, limit } = req.body;
        const data = readDB();
        if (!data.funds) data.funds = [];
        data.funds.push({
            id: Date.now(),
            name: name || 'Dana Baru',
            target: parseFloat(target) || 0,
            limit: parseFloat(limit) || 0,
            icon: icon || '💰',
            balance: 0,
            archived: false,
            created: new Date().toISOString()
        });
        writeDB(data);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/funds', (req, res) => {
    const data = readDB();
    if (!data.funds) data.funds = [];
    res.json(data.funds);
});

app.put('/api/fund/:id', requireAuth, (req, res) => {
    try {
        const data = readDB();
        const idx = data.funds.findIndex(f => f.id == req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'Not found' });
        Object.assign(data.funds[idx], req.body);
        writeDB(data);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/fund/:id', requireAuth, (req, res) => {
    const data = readDB();
    data.funds = (data.funds || []).filter(f => f.id != req.params.id);
    writeDB(data);
    res.json({ success: true });
});

// ==================== TRANSAKSI ====================
app.post('/api/add', requireAuth, (req, res) => {
    try {
        const { type, amount, category, note, fund, date } = req.body;
        const data = readDB();
        const tx = {
            id: Date.now(),
            type, amount: parseFloat(amount) || 0,
            category: category || 'Umum',
            note: note || '-',
            fund: fund || '',
            date: date || new Date().toISOString()
        };
        data.transactions.push(tx);

        // Update dana balance & check limit
        let budgetWarning = null;
        if (fund && data.funds) {
            const f = data.funds.find(f => f.name === fund || f.id == fund);
            if (f) {
                if (type === 'in') f.balance = (f.balance || 0) + tx.amount;
                else {
                    f.balance = (f.balance || 0) - tx.amount;
                    if (f.limit > 0 && Math.abs(f.balance) > f.limit) {
                        budgetWarning = `⚠️ Anggaran "${f.name}" melebihi limit! (Rp ${Math.abs(f.balance).toLocaleString('id-ID')} / Rp ${f.limit.toLocaleString('id-ID')})`;
                    }
                }
            }
        }

        writeDB(data);
        res.json({ success: true, transaction: tx, budgetWarning });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/transactions', (req, res) => {
    try {
        const data = readDB();
        let list = [...data.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Filter by month/year
        if (req.query.month || req.query.year) {
            const m = parseInt(req.query.month);
            const y = parseInt(req.query.year);
            list = list.filter(t => {
                const d = new Date(t.date);
                return (!m || d.getMonth() + 1 === m) && (!y || d.getFullYear() === y);
            });
        }
        // Filter by type
        if (req.query.type) list = list.filter(t => t.type === req.query.type);
        // Filter by category
        if (req.query.category) list = list.filter(t => t.category.toLowerCase().includes(req.query.category.toLowerCase()));
        // Search
        if (req.query.search) {
            const s = req.query.search.toLowerCase();
            list = list.filter(t => t.note.toLowerCase().includes(s) || t.category.toLowerCase().includes(s));
        }

        const total = list.reduce((sum, t) => t.type === 'in' ? sum + t.amount : sum - t.amount, 0);
        res.json({ transactions: list, total });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/transaction/:id', requireAuth, (req, res) => {
    try {
        const data = readDB();
        const idx = data.transactions.findIndex(t => t.id == req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'Not found' });

        const old = data.transactions[idx];
        Object.assign(data.transactions[idx], req.body);

        // Update fund balances (simple: recalc all)
        if (data.funds) {
            data.funds.forEach(f => f.balance = 0);
            data.transactions.forEach(t => {
                if (t.fund) {
                    const f = data.funds.find(f => f.name === t.fund || f.id == t.fund);
                    if (f) {
                        if (t.type === 'in') f.balance += t.amount;
                        else f.balance -= t.amount;
                    }
                }
            });
        }

        writeDB(data);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/transaction/:id', requireAuth, (req, res) => {
    try {
        const data = readDB();
        const tx = data.transactions.find(t => t.id == req.params.id);
        data.transactions = data.transactions.filter(t => t.id != req.params.id);

        // Recalc fund balances
        if (tx && tx.fund && data.funds) {
            data.funds.forEach(f => f.balance = 0);
            data.transactions.forEach(t => {
                if (t.fund) {
                    const f = data.funds.find(f => f.name === t.fund || f.id == t.fund);
                    if (f) {
                        if (t.type === 'in') f.balance += t.amount;
                        else f.balance -= t.amount;
                    }
                }
            });
        }

        writeDB(data);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== SUMMARY ====================
app.get('/api/summary/monthly', (req, res) => {
    try {
        const data = readDB();
        const monthly = {};

        data.transactions.forEach(t => {
            const d = new Date(t.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthly[key]) monthly[key] = { month: key, total_in: 0, total_out: 0, count: 0 };
            if (t.type === 'in') monthly[key].total_in += t.amount;
            else monthly[key].total_out += t.amount;
            monthly[key].count++;
        });

        const sorted = Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month));
        res.json(sorted);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/summary/category', (req, res) => {
    try {
        const data = readDB();
        const cats = {};

        data.transactions.forEach(t => {
            const key = t.category || 'Umum';
            if (!cats[key]) cats[key] = { category: key, total_in: 0, total_out: 0, count: 0 };
            if (t.type === 'in') cats[key].total_in += t.amount;
            else cats[key].total_out += t.amount;
            cats[key].count++;
        });

        res.json(Object.values(cats));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== EXPORT ====================
app.get('/api/export/excel', (req, res) => {
    try {
        const data = readDB();
        const fundFilter = req.query.fund ? req.query.fund.trim() : null;
        const txs = fundFilter
            ? data.transactions.filter(t => t.fund === fundFilter)
            : data.transactions;
        let csv = 'Tanggal,Jenis,Kategori,Catatan,Jumlah,Dana\n';
        txs.forEach(t => {
            const date = new Date(t.date).toLocaleDateString('id-ID');
            const amount = t.type === 'in' ? t.amount : -t.amount;
            csv += `"${date}","${t.type}","${t.category}","${t.note}",${amount},"${t.fund}"\n`;
        });
        const suffix = fundFilter ? `_${fundFilter.replace(/\s+/g,'_')}` : '';
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="keuangan${suffix}_${new Date().toISOString().slice(0,10)}.csv"`);
        res.send(csv);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/export/pdf', (req, res) => {
    try {
        const data = readDB();
        const fundFilter = req.query.fund ? req.query.fund.trim() : null;
        const allTxs = data.transactions || [];
        const txs = fundFilter ? allTxs.filter(t => t.fund === fundFilter) : allTxs;
        const totalIn = txs.filter(t=>t.type==='in').reduce((s,t)=>s+t.amount,0);
        const totalOut = txs.filter(t=>t.type==='out').reduce((s,t)=>s+t.amount,0);
        const balance = totalIn - totalOut;

        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="laporan_keuangan_${new Date().toISOString().slice(0,10)}.pdf"`);
        doc.pipe(res);

        // Header
        doc.fontSize(20).fillColor('#7c6cf0').text(`Laporan Keuangan ${fundFilter ? fundFilter : ''}`, { align: 'center' });
        doc.moveDown();

        // Stats (Box style)
        doc.rect(30, doc.y, 535, 60).fillAndStroke('#f8f7fc', '#eeebff');
        doc.fillColor('#2d2a4a').fontSize(10).text('Saldo', 40, doc.y - 50);
        doc.fontSize(16).fillColor('#7c6cf0').text(`Rp ${balance.toLocaleString('id-ID')}`, 40, doc.y - 2);
        
        doc.fillColor('#2d2a4a').fontSize(10).text('Masuk', 220, 85);
        doc.fontSize(16).fillColor('#5bb87a').text(`Rp ${totalIn.toLocaleString('id-ID')}`, 220, 100);
        
        doc.fillColor('#2d2a4a').fontSize(10).text('Keluar', 400, 85);
        doc.fontSize(16).fillColor('#e57a7a').text(`Rp ${totalOut.toLocaleString('id-ID')}`, 400, 100);
        doc.moveDown(4);

        // Table Header
        doc.fontSize(12).fillColor('#7c6cf0').text('Daftar Transaksi Terbaru:', 30);
        doc.moveDown(0.5);
        
        const tableTop = doc.y;
        doc.fontSize(10).fillColor('#9b95b8');
        doc.text('Tanggal', 30, tableTop);
        doc.text('Kategori', 100, tableTop);
        doc.text('Catatan', 220, tableTop);
        doc.text('Jumlah', 450, tableTop, { align: 'right' });
        doc.moveTo(30, tableTop + 15).lineTo(560, tableTop + 15).stroke('#e8e5f0');

        let y = tableTop + 25;
        [...txs].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,20).forEach(t => {
            const date = new Date(t.date).toLocaleDateString('id-ID');
            const amtColor = t.type === 'in' ? '#5bb87a' : '#e57a7a';
            const amt = (t.type === 'in' ? '+' : '−') + ' Rp ' + t.amount.toLocaleString('id-ID');
            
            doc.fillColor('#2d2a4a').text(date, 30, y);
            doc.text(t.category, 100, y);
            doc.text(t.note.substring(0, 30), 220, y);
            doc.fillColor(amtColor).text(amt, 450, y, { align: 'right', width: 100 });
            y += 20;
        });

        doc.end();
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server Pengelola Keuangan AI aktif di port ${PORT}`));
