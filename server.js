import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || process.env.RAILWAY_DB_URL,
});

// Create tables if not exist
const initDB = async () => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, slug VARCHAR(255) UNIQUE NOT NULL, description TEXT, color VARCHAR(7) DEFAULT '#D4AF37', sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`).catch(() => {});
    
    await pool.query(`CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, category VARCHAR(255) NOT NULL, price TEXT NOT NULL, price_value REAL, description TEXT, image TEXT, rating REAL DEFAULT 4.0, reviews INTEGER DEFAULT 0, status VARCHAR(50) DEFAULT 'published', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`).catch(() => {});
    
    await pool.query(`CREATE TABLE IF NOT EXISTS reviews (id SERIAL PRIMARY KEY, name VARCHAR(255), rating INTEGER, comment TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'`).catch(() => {});
    
    await pool.query(`CREATE TABLE IF NOT EXISTS settings (key VARCHAR(255) PRIMARY KEY, value TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    console.log('Database tables initialized');
  } catch (err) {
    console.error('DB init error:', err.message);
  }
};
initDB();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// === PUBLIC FRONTEND API ===

// Categories (public)
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories WHERE is_active = true ORDER BY sort_order, name');
    res.json(result.rows);
  } catch (err) { 
    console.error('/api/categories error:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// Products (public - only active category products)
app.get('/api/products', async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = `
      SELECT p.* FROM products p 
      JOIN categories c ON p.category = c.name 
      WHERE c.is_active = true AND p.status = 'published'
    `;
    const params = [];
    if (search) {
      query += ' AND (p.name ILIKE $1 OR p.description ILIKE $1)';
      params.push(`%${search}%`);
    }
    if (category) {
      query += params.length ? ' AND p.category = $' + (params.length + 1) : ' AND p.category = $1';
      params.push(category);
    }
    query += ' ORDER BY p.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { 
    console.error('/api/products error:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// Reviews (public)
app.get('/api/reviews', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM reviews WHERE status = 'approved' ORDER BY created_at DESC LIMIT 20");
    res.json(result.rows);
  } catch (err) { 
    console.error('/api/reviews error:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// Site settings
app.get('/api/site', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings');
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (err) { 
    console.error('/api/site error:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// === CATCH ALL FOR SPA ===
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});