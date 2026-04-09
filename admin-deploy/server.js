require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const { upload, isS3Configured, isSupabase, getImagePath, bucketName } = require('./s3Config');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(helmet({ contentSecurityPolicy: false }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', apiLimiter);

app.use(express.json({ limit: '10mb' }));

// === SERVE ADMIN STATIC FILES FIRST ===
const adminDistPath = path.join(__dirname, 'dist');
console.log('Admin dist path:', adminDistPath, 'exists:', fs.existsSync(adminDistPath));

app.use('/admin/assets', express.static(path.join(adminDistPath, 'assets')));
app.use('/admin/logo.png', express.static(path.join(adminDistPath, 'logo.png')));
app.use('/admin/favicon.png', express.static(path.join(adminDistPath, 'favicon.svg')));

// Admin SPA routes - must be BEFORE catch-all
app.get('/admin', (req, res) => {
  console.log('GET /admin');
  res.sendFile(path.join(adminDistPath, 'index.html'));
});
app.get('/admin/*', (req, res) => {
  console.log('GET /admin/*', req.path);
  res.sendFile(path.join(adminDistPath, 'index.html'));
});

// Database setup
const pool = new Pool({
  connectionString: process.env.RAILWAY_DB_URL || process.env.DATABASE_URL,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('DB connection error:', err.stack);
  else console.log('Connected to PostgreSQL');
});

// Create tables
pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(255) UNIQUE NOT NULL, password TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
pool.query(`CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, category VARCHAR(255) NOT NULL, price TEXT NOT NULL, price_value REAL, description TEXT, image TEXT, rating REAL DEFAULT 4.0, reviews INTEGER DEFAULT 0, status VARCHAR(50) DEFAULT 'published', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
pool.query(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, slug VARCHAR(255) UNIQUE NOT NULL, description TEXT, icon TEXT, color VARCHAR(7) DEFAULT '#D4AF37', sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
pool.query(`CREATE TABLE IF NOT EXISTS settings (key VARCHAR(255) PRIMARY KEY, value TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
pool.query(`CREATE TABLE IF NOT EXISTS sessions (id SERIAL PRIMARY KEY, user_id INTEGER, token_id VARCHAR(255) UNIQUE NOT NULL, ip_address INET, user_agent TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, expires_at TIMESTAMP NOT NULL)`);
pool.query(`CREATE TABLE IF NOT EXISTS media (id SERIAL PRIMARY KEY, filename VARCHAR(255) NOT NULL, path TEXT NOT NULL, size INTEGER DEFAULT 0, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
pool.query(`CREATE TABLE IF NOT EXISTS reviews (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, location VARCHAR(255), rating REAL DEFAULT 5, comment TEXT, status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
pool.query(`CREATE TABLE IF NOT EXISTS activity_logs (id SERIAL PRIMARY KEY, user_id INTEGER, action VARCHAR(255) NOT NULL, details TEXT, ip_address INET, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

// Default settings
pool.query(`INSERT INTO settings (key, value) VALUES ('site_name', 'Luxe Looks'), ('logo', ''), ('favicon', ''), ('whatsapp', '') ON CONFLICT (key) DO NOTHING`);

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const validPassword = await bcrypt.compare(password, result.rows[0].password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: result.rows[0].id, username: result.rows[0].username }, process.env.JWT_SECRET || 'dev-secret-key', { expiresIn: '7d' });
    res.json({ token, user: { id: result.rows[0].id, username: result.rows[0].username } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Register
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query('INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username', [username, hashedPassword]);
    const token = jwt.sign({ id: result.rows[0].id, username: result.rows[0].username }, process.env.JWT_SECRET || 'dev-secret-key', { expiresIn: '7d' });
    res.json({ token, user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: 'Username already exists' }); }
});

// Products
app.get('/api/products', async (req, res) => {
  try { const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC'); res.json(result.rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  try { const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]); res.json(result.rows[0] || null); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { name, category, price, price_value, description, status } = req.body;
    const image = req.file ? getImagePath(req.file.filename) : null;
    const result = await pool.query('INSERT INTO products (name, category, price, price_value, description, image, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [name, category, price, price_value, description, image, status || 'published']);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { name, category, price, price_value, description, status } = req.body;
    const image = req.file ? getImagePath(req.file.filename) : undefined;
    let query = 'UPDATE products SET name=$1, category=$2, price=$3, price_value=$4, description=$5, status=$6, updated_at=CURRENT_TIMESTAMP';
    const params = [name, category, price, price_value, description, status || 'published'];
    if (image) { query += ', image=$7'; params.push(image); }
    query += ' WHERE id=$' + (params.length + 1) + ' RETURNING *';
    params.push(req.params.id);
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try { await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Categories
app.get('/api/categories', async (req, res) => {
  try { const result = await pool.query('SELECT * FROM categories ORDER BY sort_order, name'); res.json(result.rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
  try { const { name, description, slug, color } = req.body; const result = await pool.query('INSERT INTO categories (name, description, slug, color) VALUES ($1, $2, $3, $4) RETURNING *', [name, description, slug || name.toLowerCase().replace(/\s+/g, '-'), color || '#D4AF37']); res.json(result.rows[0]); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
  try { const { name, description, slug, color, sort_order } = req.body; const result = await pool.query('UPDATE categories SET name=$1, description=$2, slug=$3, color=$4, sort_order=$5, updated_at=CURRENT_TIMESTAMP WHERE id=$6 RETURNING *', [name, description, slug, color, sort_order, req.params.id]); res.json(result.rows[0]); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  try { await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Settings
app.get('/api/site', async (req, res) => {
  try { const result = await pool.query('SELECT * FROM settings'); const settings = {}; result.rows.forEach(s => settings[s.key] = s.value); res.json(settings); }
  catch (err) { res.json({}); }
});

app.get('/api/settings', authenticateToken, async (req, res) => {
  try { const result = await pool.query('SELECT * FROM settings'); const settings = {}; result.rows.forEach(s => settings[s.key] = s.value); res.json(settings); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/settings', authenticateToken, async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, value]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings/upload-logo', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { type } = req.body;
    const filePath = req.file ? getImagePath(req.file.filename) : null;
    if (filePath) {
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [type, filePath]);
    }
    res.json({ [type]: filePath });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Reviews
app.get('/api/reviews', async (req, res) => {
  try { const result = await pool.query('SELECT * FROM reviews ORDER BY created_at DESC'); res.json(result.rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reviews', async (req, res) => {
  try { const { name, location, rating, comment } = req.body; const result = await pool.query('INSERT INTO reviews (name, location, rating, comment) VALUES ($1, $2, $3, $4) RETURNING *', [name, location, rating, comment]); res.json(result.rows[0]); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/reviews/:id', authenticateToken, async (req, res) => {
  try { const { status } = req.body; const result = await pool.query('UPDATE reviews SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]); res.json(result.rows[0]); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/reviews/:id', authenticateToken, async (req, res) => {
  try { await pool.query('DELETE FROM reviews WHERE id = $1', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Media
app.get('/api/media', authenticateToken, async (req, res) => {
  try { const result = await pool.query('SELECT * FROM media ORDER BY uploaded_at DESC'); res.json(result.rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/media/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const filePath = getImagePath(req.file.filename);
    const result = await pool.query('INSERT INTO media (filename, path, size) VALUES ($1, $2, $3) RETURNING *', [req.file.originalname, filePath, req.file.size]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/media/:id', authenticateToken, async (req, res) => {
  try { await pool.query('DELETE FROM media WHERE id = $1', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Dashboard stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const products = await pool.query('SELECT COUNT(*) as total FROM products');
    const categories = await pool.query('SELECT COUNT(*) as total FROM categories');
    const reviews = await pool.query('SELECT COUNT(*) as total FROM reviews');
    const pendingReviews = await pool.query("SELECT COUNT(*) as total FROM reviews WHERE status = 'pending'");
    res.json({
      products: parseInt(products.rows[0].total),
      categories: parseInt(categories.rows[0].total),
      reviews: parseInt(reviews.rows[0].total),
      pendingReviews: parseInt(pendingReviews.rows[0].total)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sessions
app.get('/api/sessions', authenticateToken, async (req, res) => {
  try { const result = await pool.query('SELECT s.*, u.username FROM sessions s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC'); res.json(result.rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/sessions/:tokenId', authenticateToken, async (req, res) => {
  try { await pool.query('DELETE FROM sessions WHERE token_id = $1', [req.params.tokenId]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Activity logs
app.get('/api/activity-logs', authenticateToken, async (req, res) => {
  try { const result = await pool.query('SELECT al.*, u.username FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT 100'); res.json(result.rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/activity-logs', authenticateToken, async (req, res) => {
  try { const { action, details } = req.body; await pool.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.user.id, action, details]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// === CATCH-ALL FOR UNHANDLED ROUTES ===
app.use((req, res) => {
  console.log('Unhandled:', req.method, req.path);
  res.status(404).send('Not found: ' + req.path);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Admin server running on port ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});