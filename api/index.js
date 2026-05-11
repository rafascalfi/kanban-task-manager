const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'kanban-secret-2025';

// Database Setup
let db;
async function setupDb() {
    const isVercel = process.env.VERCEL;
    const dbPath = isVercel 
        ? path.join('/tmp', 'database.sqlite') 
        : path.join(__dirname, '..', 'server', 'database.sqlite');

    const database = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    await database.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            category_id INTEGER,
            title TEXT NOT NULL,
            description TEXT,
            priority TEXT CHECK(priority IN ('Baixa', 'Média', 'Urgente')),
            status TEXT CHECK(status IN ('A Fazer', 'Em Andamento', 'Revisão', 'Concluído')),
            deadline DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (category_id) REFERENCES categories (id)
        );

        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT NOT NULL,
            color TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        );

        CREATE TABLE IF NOT EXISTS task_tags (
            task_id INTEGER,
            tag_id INTEGER,
            PRIMARY KEY (task_id, tag_id),
            FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
        );
    `);
    return database;
}

// Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Ensure DB is connected
app.use(async (req, res, next) => {
    if (!db) {
        db = await setupDb();
    }
    next();
});

// Auth Routes
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const result = await db.run(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );
        const userId = result.lastID;
        
        // Default categories
        await db.run('INSERT INTO categories (user_id, name) VALUES (?, ?), (?, ?), (?, ?)', 
            [userId, 'Trabalho', userId, 'Casa', userId, 'Estudos']);
            
        res.status(201).json({ message: 'User created' });
    } catch (e) {
        res.status(400).json({ error: 'Email already exists' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET);
        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Tasks Routes
app.get('/api/tasks', authenticateToken, async (req, res) => {
    const tasks = await db.all(`
        SELECT t.*, c.name as category_name 
        FROM tasks t 
        LEFT JOIN categories c ON t.category_id = c.id 
        WHERE t.user_id = ?
        ORDER BY t.created_at DESC
    `, [req.user.id]);
    
    // Fetch tags for each task
    for (let task of tasks) {
        task.tags = await db.all(`
            SELECT tg.name 
            FROM tags tg 
            JOIN task_tags tt ON tg.id = tt.tag_id 
            WHERE tt.task_id = ?
        `, [task.id]);
    }
    
    res.json(tasks);
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
    const { title, description, priority, category_id, status, deadline, tags } = req.body;
    const result = await db.run(
        'INSERT INTO tasks (user_id, title, description, priority, category_id, status, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, title, description, priority, category_id, status || 'A Fazer', deadline]
    );
    const taskId = result.lastID;

    if (tags && tags.length > 0) {
        for (let tagName of tags) {
            let tag = await db.get('SELECT id FROM tags WHERE name = ? AND user_id = ?', [tagName, req.user.id]);
            if (!tag) {
                const tagResult = await db.run('INSERT INTO tags (user_id, name) VALUES (?, ?)', [req.user.id, tagName]);
                tag = { id: tagResult.lastID };
            }
            await db.run('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', [taskId, tag.id]);
        }
    }
    res.status(201).json({ id: taskId });
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    const { title, description, priority, category_id, status, deadline, tags } = req.body;
    await db.run(
        'UPDATE tasks SET title=?, description=?, priority=?, category_id=?, status=?, deadline=? WHERE id=? AND user_id=?',
        [title, description, priority, category_id, status, deadline, req.params.id, req.user.id]
    );

    if (tags !== undefined) {
        await db.run('DELETE FROM task_tags WHERE task_id = ?', [req.params.id]);
        for (let tagName of tags) {
            let tag = await db.get('SELECT id FROM tags WHERE name = ? AND user_id = ?', [tagName, req.user.id]);
            if (!tag) {
                const tagResult = await db.run('INSERT INTO tags (user_id, name) VALUES (?, ?)', [req.user.id, tagName]);
                tag = { id: tagResult.lastID };
            }
            await db.run('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', [req.params.id, tag.id]);
        }
    }
    res.json({ message: 'Updated' });
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    await db.run('DELETE FROM tasks WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ message: 'Deleted' });
});

app.get('/api/categories', authenticateToken, async (req, res) => {
    const categories = await db.all('SELECT * FROM categories WHERE user_id = ?', [req.user.id]);
    res.json(categories);
});

app.get('/api/stats', authenticateToken, async (req, res) => {
    const total = await db.get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?', [req.user.id]);
    const completedToday = await db.get(`
        SELECT COUNT(*) as count FROM tasks 
        WHERE user_id = ? AND status = 'Concluído' 
        AND date(created_at) = date('now')
    `, [req.user.id]);
    const late = await db.get(`
        SELECT COUNT(*) as count FROM tasks 
        WHERE user_id = ? AND status != 'Concluído' AND deadline < date('now')
    `, [req.user.id]);
    
    const byCategory = await db.all(`
        SELECT c.name, COUNT(t.id) as count 
        FROM categories c 
        LEFT JOIN tasks t ON c.id = t.category_id 
        WHERE c.user_id = ?
        GROUP BY c.id
    `, [req.user.id]);

    res.json({
        total: total.count,
        completedToday: completedToday.count,
        late: late.count,
        byCategory
    });
});

module.exports = app;
