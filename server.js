const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка базы данных SQLite
const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) console.error('Ошибка подключения к БД', err.message);
    else console.log('Подключено к базе данных SQLite.');
});

// Создание таблиц
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS admin (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        object TEXT,
        date TEXT,
        time TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'Новая'
    )`);

    // Инициализация администратора (логин: prob1, пароль: prob999)
    db.get(`SELECT * FROM admin WHERE username = ?`, ['prob1'], async (err, row) => {
        if (!row) {
            const hashedPassword = await bcrypt.hash('prob999', 10);
            db.run(`INSERT INTO admin (username, password) VALUES (?, ?)`, ['prob1', hashedPassword]);
            console.log('Создан первоначальный администратор (prob1 / prob999)');
        }
    });

    // Инициализация базовых настроек, если пусто
    const defaultSettings = {
        name: 'Макар Сапоженко Артурович',
        position: 'Риэлтор в Краснодаре',
        about: 'Профессиональный риэлтор, который знает рынок Краснодара, внимательно относится к клиентам и сопровождает процесс подбора недвижимости.',
        phone: '+7 (900) 000-00-00',
        whatsapp: 'https://wa.me/',
        telegram: 'https://t.me/',
        primary_color: '#111111',
        accent_color: '#c5a059',
        bg_color: '#f9f9f9'
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
        db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
    }
});

// Настройка Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
    secret: 'makar_secret_key_999',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// Конфигурация загрузки фото
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Проверка авторизации
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.isAdmin) return next();
    res.status(401).json({ error: 'Необходима авторизация' });
};

// --- API РОУТЫ ---

// Авторизация
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM admin WHERE username = ?`, [username], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Неверный логин или пароль' });

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.isAdmin = true;
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Неверный логин или пароль' });
        }
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// Получение публичных настроек для сайта
app.get('/api/settings', (req, res) => {
    db.all(`SELECT * FROM settings`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    });
});

// Сохранение настроек (админка)
app.post('/api/settings', isAuthenticated, (req, res) => {
    const settings = req.body;
    db.serialize(() => {
        const stmt = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
        for (const [key, value] of Object.entries(settings)) {
            stmt.run(key, value);
        }
        stmt.finalize();
        res.json({ success: true });
    });
});

// Изменение логина и пароля админа
app.post('/api/admin/credentials', isAuthenticated, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`UPDATE admin SET username = ?, password = ? WHERE id = 1`, [username, hashedPassword], (err) => {
            if (err) return res.status(500).json({ error: 'Ошибка обновления учетных данных' });
            res.json({ success: true });
        });
    } catch (e) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Загрузка фото
app.post('/api/upload', isAuthenticated, upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const photoUrl = `/uploads/${req.file.filename}`;
    db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, ['photo', photoUrl], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, url: photoUrl });
    });
});

// Создание заявки клиентом
app.post('/api/leads', (req, res) => {
    const { name, phone, object, date, time } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Укажите имя и телефон' });

    db.run(`INSERT INTO leads (name, phone, object, date, time, status) VALUES (?, ?, ?, ?, ?, 'Новая')`,
        [name, phone, object, date, time], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// Получение заявок (админка)
app.get('/api/leads', isAuthenticated, (req, res) => {
    db.all(`SELECT * FROM leads ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Изменение статуса заявки
app.patch('/api/leads/:id', isAuthenticated, (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE leads SET status = ? WHERE id = ?`, [status, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Удаление заявки
app.delete('/api/leads/:id', isAuthenticated, (req, res) => {
    db.run(`DELETE FROM leads WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
