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

// Serve at root (Railway deploys at root, not /admin)
app.use('/assets', express.static(path.join(adminDistPath, 'assets')));
app.use('/admin/assets', express.static(path.join(adminDistPath, 'assets')));
app.use('/logo.png', express.static(path.join(adminDistPath, 'logo.png')));
app.use('/favicon.png', express.static(path.join(adminDistPath, 'favicon.svg')));
app.use('/favicon.svg', express.static(path.join(adminDistPath, 'favicon.svg')));

// Admin SPA at root (for Railway)
app.get('/', (req, res) => {
  console.log('GET /');
  res.sendFile(path.join(adminDistPath, 'index.html'));
});

// Admin SPA at /admin (for local development)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(adminDistPath, 'index.html'));
});
app.get('/admin/*', (req, res) => {
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
pool.query(`CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, category VARCHAR(255) NOT NULL, price TEXT NOT NULL, price_value REAL, description TEXT, image TEXT, rating REAL DEFAULT 4.0, reviews INTEGER DEFAULT 0, status VARCHAR(50) DEFAULT 'published', is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
pool.query(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, slug VARCHAR(255) UNIQUE NOT NULL, description TEXT, icon TEXT, color VARCHAR(7) DEFAULT '#D4AF37', sort_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
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
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const search = req.query.search || '';
    const category = req.query.category || '';
    const status = req.query.status || '';
    const active = req.query.active; // for public frontend - filter by category's is_active

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (category) {
      whereClause += ` AND p.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    if (status) {
      whereClause += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (active === 'true') {
      whereClause += ` AND c.is_active = true`;
    }

    const allowedSortFields = ['name', 'category', 'price', 'rating', 'created_at', 'status'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

    const countQuery = active === 'true' 
      ? `SELECT COUNT(*) FROM products p JOIN categories c ON p.category = c.name ${whereClause}`
      : `SELECT COUNT(*) FROM products p ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const selectQuery = active === 'true'
      ? `SELECT p.* FROM products p JOIN categories c ON p.category = c.name ${whereClause} ORDER BY p.${safeSortBy} ${sortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
      : `SELECT p.* FROM products p ${whereClause} ORDER BY p.${safeSortBy} ${sortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    const result = await pool.query(selectQuery, [...params, limit, offset]);

    res.json({
      items: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  }
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
    const { name, category, price, price_value, description, status, is_active } = req.body;
    const image = req.file ? getImagePath(req.file.filename) : undefined;
    let query = 'UPDATE products SET name=$1, category=$2, price=$3, price_value=$4, description=$5, status=$6, updated_at=CURRENT_TIMESTAMP';
    const params = [name, category, price, price_value, description, status || 'published'];
    if (image) { query += ', image=$7'; params.push(image); }
    if (is_active !== undefined) { query += ', is_active=$' + (params.length + 1); params.push(is_active === true || is_active === 'true'); }
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

// Bulk delete
app.post('/api/products/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids array' });
    }
    await pool.query('DELETE FROM products WHERE id = ANY($1)', [ids]);
    res.json({ message: `Deleted ${ids.length} products` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Duplicate product
app.post('/api/products/:id/duplicate', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = result.rows[0];
    const newResult = await pool.query(
      'INSERT INTO products (name, category, price, price_value, description, image, rating, reviews, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [product.name + ' (Copy)', product.category, product.price, product.price_value, product.description, product.image, product.rating, product.reviews, 'draft']
    );
    res.json(newResult.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk update
app.post('/api/products/bulk-update', authenticateToken, async (req, res) => {
  try {
    const { ids, updates } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids array' });
    }
    const setClauses = [];
    const params = [];
    let paramIndex = 1;
    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
    params.push(ids);
    await pool.query(`UPDATE products SET ${setClauses.join(', ')} WHERE id = ANY($${paramIndex})`, params);
    res.json({ message: `Updated ${ids.length} products`, updatedCount: ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk price adjust
app.post('/api/products/bulk-price-adjust', authenticateToken, async (req, res) => {
  try {
    const { ids, adjustment } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids array' });
    }
    const { type, value, operation } = adjustment;
    let operator = operation === 'increase' ? '+' : '-';
    let newValue;
    if (type === 'percent') {
      newValue = `(price_value ${operator} (price_value * ${value} / 100))`;
    } else {
      newValue = `(price_value ${operator} ${value})`;
    }
    await pool.query(`UPDATE products SET price_value = ${newValue} WHERE id = ANY($1)`, [ids]);
    res.json({ message: `Adjusted prices for ${ids.length} products`, adjustedCount: ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Categories
app.get('/api/categories', async (req, res) => {
  try {
    const activeOnly = req.query.active === 'true';
    let query = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM products p WHERE p.category = c.name) as product_count 
      FROM categories c
    `;
    
    if (activeOnly) {
      query += ' WHERE c.is_active = true';
    }
    
    query += ' ORDER BY c.sort_order, c.name';
    
    const result = await pool.query(query);
    res.json(result.rows);
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
  try { 
    const { name, description, slug, color, is_active = true } = req.body; 
    const result = await pool.query('INSERT INTO categories (name, description, slug, color, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *', [name, description, slug || name.toLowerCase().replace(/\s+/g, '-'), color || '#D4AF37', is_active]); 
    res.json(result.rows[0]); 
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
  try { 
    const { name, description, slug, color, sort_order, is_active } = req.body; 
    
    // Get the category's current is_active status before update
    const oldCategory = await pool.query('SELECT name, is_active FROM categories WHERE id = $1', [req.params.id]);
    const oldName = oldCategory.rows[0]?.name;
    const wasActive = oldCategory.rows[0]?.is_active;
    
    // Update category
    const result = await pool.query(
      'UPDATE categories SET name=$1, description=$2, slug=$3, color=$4, sort_order=$5, is_active=$6, updated_at=CURRENT_TIMESTAMP WHERE id=$7 RETURNING *', 
      [name, description, slug, color, sort_order, is_active, req.params.id]
    );
    
    // If category is being marked inactive, also mark all its products as inactive
    if (wasActive !== false && is_active === false) {
      await pool.query('UPDATE products SET is_active = false WHERE category = $1', [oldName]);
    }
    
    // If category is being marked active, also mark all its products as active
    if ((wasActive === false || wasActive === undefined) && is_active === true) {
      await pool.query('UPDATE products SET is_active = true WHERE category = $1', [name]);
    }
    
    res.json(result.rows[0]); 
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  try { await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Reorder categories
app.post('/api/categories/reorder', authenticateToken, async (req, res) => {
  try {
    const { categoryOrders } = req.body;
    for (const order of categoryOrders) {
      await pool.query('UPDATE categories SET sort_order = $1 WHERE id = $2', [order.sort_order, order.id]);
    }
    res.json({ message: 'Categories reordered' });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
    console.log('Fetching dashboard stats for user:', req.user?.id);
    const products = await pool.query('SELECT COUNT(*) as total FROM products').catch(e => ({ rows: [{ total: 0 }] }));
    const categories = await pool.query('SELECT COUNT(*) as total FROM categories').catch(e => ({ rows: [{ total: 0 }] }));
    const reviews = await pool.query('SELECT COUNT(*) as total FROM reviews').catch(e => ({ rows: [{ total: 0 }] }));
    const pendingReviews = await pool.query("SELECT COUNT(*) as total FROM reviews WHERE status = 'pending'").catch(e => ({ rows: [{ total: 0 }] }));
    
    const productsByCategory = await pool.query(`
      SELECT category, COUNT(*) as count 
      FROM products 
      GROUP BY category 
      ORDER BY count DESC
    `).catch(e => ({ rows: [] }));
    
    const recentProducts = await pool.query(`
      SELECT id, name, category, price, image, created_at 
      FROM products 
      ORDER BY created_at DESC 
      LIMIT 5
    `).catch(e => ({ rows: [] }));
    
    const avgRating = await pool.query(`
      SELECT AVG(rating) as avg FROM products WHERE rating > 0
    `).catch(e => ({ rows: [{ avg: 0 }] }));
    
    const productCount = parseInt(products.rows[0]?.total || 0);
    const categoryCount = parseInt(categories.rows[0]?.total || 0);
    const reviewCount = parseInt(reviews.rows[0]?.total || 0);
    const avgRatingVal = parseFloat(avgRating.rows[0]?.avg || 0).toFixed(1);
    
    res.json({
      totalProducts: productCount,
      totalCategories: categoryCount,
      totalReviews: reviewCount,
      pendingReviews: parseInt(pendingReviews.rows[0]?.total || 0),
      averageRating: avgRatingVal,
      changes: {
        products: '0',
        categories: 0,
        rating: '0',
        reviews: 0
      },
      recentProducts: recentProducts.rows,
      categoryData: productsByCategory.rows.map(r => ({ name: r.category, count: parseInt(r.count) }))
    });
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
    res.status(200).json({
      totalProducts: 0,
      totalCategories: 0,
      totalReviews: 0,
      pendingReviews: 0,
      averageRating: '0.0',
      changes: { products: '0', categories: 0, rating: '0', reviews: 0 },
      recentProducts: [],
      categoryData: []
    });
  }
});

// Sessions
app.get('/api/sessions', authenticateToken, async (req, res) => {
  try { const result = await pool.query('SELECT s.*, u.username FROM sessions s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC'); res.json({ sessions: result.rows }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/sessions/:tokenId', authenticateToken, async (req, res) => {
  try { await pool.query('DELETE FROM sessions WHERE token_id = $1', [req.params.tokenId]); res.json({ message: 'Session revoked' }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const currentToken = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(currentToken, process.env.JWT_SECRET || 'dev-secret-key');
    const result = await pool.query('DELETE FROM sessions WHERE user_id = $1 AND token_id != $2 RETURNING id', [decoded.id, currentToken]);
    res.json({ message: 'Sessions revoked', revoked: result.rowCount || 0 });
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Activity logs
app.get('/api/activity-logs', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
    const dateFrom = req.query.dateFrom || '';
    const dateTo = req.query.dateTo || '';

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (dateFrom) {
      whereClause += ` AND al.created_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      whereClause += ` AND al.created_at <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM activity_logs al ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT al.*, u.username FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id ${whereClause} ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    res.json({
      items: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/activity-logs/export', authenticateToken, async (req, res) => {
  try {
    const dateFrom = req.query.dateFrom || '';
    const dateTo = req.query.dateTo || '';

    let whereClause = 'WHERE 1=1';
    const params = [];
    if (dateFrom) { whereClause += ' AND created_at >= $1'; params.push(dateFrom); }
    if (dateTo) { whereClause += params.length + 1 + ' AND created_at <= $' + (params.length + 1); params.push(dateTo); }

    const result = await pool.query(`SELECT al.*, u.username FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id ${whereClause} ORDER BY al.created_at DESC`, params);

    const csv = 'ID,User,Action,Details,IP Address,Created At\n' + result.rows.map(r => 
      `${r.id},${r.username || 'N/A'},${r.action || ''},${(r.details || '').replace(/,/g, ';')},${r.ip_address || ''},${r.created_at}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=activity-logs.csv');
    res.send(csv);
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/activity-logs/cleanup', authenticateToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const result = await pool.query('DELETE FROM activity_logs WHERE created_at < $1', [cutoffDate]);
    res.json({ message: 'Cleanup completed', deletedCount: result.rowCount || 0 });
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/activity-logs', authenticateToken, async (req, res) => {
  try { const { action, details } = req.body; await pool.query('INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)', [req.user.id, action, details]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// === 404 FOR UNHANDLED API ROUTES ===
// Serve SPA for any other route (React Router handles client-side routing)
app.use((req, res) => {
  console.log('Route:', req.method, req.path);
  res.sendFile(path.join(adminDistPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Admin server running on port ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});