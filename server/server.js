require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { setupDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-kanban';

app.use(cors());
app.use(express.json());

let db;

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Token não fornecido' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido' });
        req.user = user;
        next();
    });
};

// Routes
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.run(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );
        const userId = result.lastID;
        
        // Criar categorias padrão
        const defaultCategories = ['Trabalho', 'Casa', 'Estudos'];
        for (const cat of defaultCategories) {
            await db.run('INSERT INTO categories (user_id, name) VALUES (?, ?)', [userId, cat]);
        }

        res.status(201).json({ id: userId, name, email });
    } catch (error) {
        res.status(400).json({ message: 'Erro ao registrar usuário. E-mail já existe?' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// Tasks Endpoints
app.get('/api/tasks', authenticateToken, async (req, res) => {
    const tasks = await db.all(
        `SELECT t.*, c.name as category_name, 
         (SELECT GROUP_CONCAT(name) FROM tags JOIN task_tags ON tags.id = task_tags.tag_id WHERE task_tags.task_id = t.id) as tags
         FROM tasks t 
         LEFT JOIN categories c ON t.category_id = c.id 
         WHERE t.user_id = ?`, 
        [req.user.id]
    );
    // Converter string de tags em array
    const formattedTasks = tasks.map(t => ({
        ...t,
        tags: t.tags ? t.tags.split(',') : []
    }));
    res.json(formattedTasks);
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
    const { title, description, status, priority, deadline, category_id, tags } = req.body;
    try {
        const result = await db.run(
            `INSERT INTO tasks (user_id, title, description, status, priority, deadline, category_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, title, description, status || 'A Fazer', priority || 'Média', deadline, category_id]
        );
        const taskId = result.lastID;

        if (tags && Array.isArray(tags)) {
            for (const tagName of tags) {
                // Inserir tag se não existir
                await db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [tagName]);
                const tag = await db.get('SELECT id FROM tags WHERE name = ?', [tagName]);
                await db.run('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', [taskId, tag.id]);
            }
        }

        res.status(201).json({ id: taskId, ...req.body });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao criar tarefa' });
    }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    const { title, description, status, priority, deadline, category_id, tags } = req.body;
    try {
        await db.run(
            `UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, deadline = ?, category_id = ? 
             WHERE id = ? AND user_id = ?`,
            [title, description, status, priority, deadline, category_id, req.params.id, req.user.id]
        );

        if (tags && Array.isArray(tags)) {
            // Limpar tags antigas
            await db.run('DELETE FROM task_tags WHERE task_id = ?', [req.params.id]);
            for (const tagName of tags) {
                await db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [tagName]);
                const tag = await db.get('SELECT id FROM tags WHERE name = ?', [tagName]);
                await db.run('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', [req.params.id, tag.id]);
            }
        }

        res.json({ message: 'Tarefa atualizada' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar tarefa' });
    }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    await db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Tarefa removida' });
});

// Stats for Dashboard
app.get('/api/stats', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const total = await db.get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?', [userId]);
    const completedToday = await db.get(
        "SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = 'Concluído' AND date(deadline) = date('now')",
        [userId]
    );
    const late = await db.get(
        "SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status != 'Concluído' AND deadline < date('now')",
        [userId]
    );

    const byCategory = await db.all(
        `SELECT c.name, COUNT(t.id) as count 
         FROM categories c 
         LEFT JOIN tasks t ON c.id = t.category_id AND t.user_id = ?
         WHERE c.user_id = ?
         GROUP BY c.id`,
        [userId, userId]
    );

    res.json({
        total: total.count,
        completedToday: completedToday.count,
        late: late.count,
        byCategory
    });
});

// Categories
app.get('/api/categories', authenticateToken, async (req, res) => {
    const categories = await db.all('SELECT * FROM categories WHERE user_id = ?', [req.user.id]);
    res.json(categories);
});

app.post('/api/categories', authenticateToken, async (req, res) => {
    const { name } = req.body;
    const result = await db.run('INSERT INTO categories (user_id, name) VALUES (?, ?)', [req.user.id, name]);
    res.json({ id: result.lastID, name });
});

// Start Server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    setupDb().then(database => {
        db = database;
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    });
} else {
    // No Vercel, inicializamos o banco na primeira requisição se necessário
    setupDb().then(database => {
        db = database;
    });
}

module.exports = app;
