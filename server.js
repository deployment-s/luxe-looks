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
    console.log('Fetching categories from database...');
    try {
      await pool.query('SELECT is_active FROM categories LIMIT 1');
      const result = await pool.query('SELECT * FROM categories WHERE is_active = true ORDER BY sort_order, name');
      console.log('Found active categories:', result.rows.length, result.rows.map(r => ({ name: r.name, is_active: r.is_active })));
      res.json({ items: result.rows });
    } catch {
      console.log('is_active column not found, fetching all categories');
      const result = await pool.query('SELECT * FROM categories ORDER BY sort_order, name');
      res.json({ items: result.rows });
    }
  } catch (err) { 
    console.error('/api/categories error:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// Products (public - only active category products and active products)
app.get('/api/products', async (req, res) => {
  try {
    console.log('Fetching products from database...');
    
    // Check if is_active columns exist
    let useActiveFilter = true;
    try {
      await pool.query('SELECT is_active FROM categories LIMIT 1');
      await pool.query('SELECT is_active FROM products LIMIT 1');
    } catch {
      useActiveFilter = false;
    }

    const category = req.query.category;
    
    let query;
    let params = [];
    
    if (useActiveFilter) {
      let whereClause = "WHERE p.status = 'published' AND p.is_active = true AND c.is_active = true";
      if (category) {
        whereClause += " AND p.category ILIKE $1";
        params = [category];
      }
      query = `SELECT p.* FROM products p 
               JOIN categories c ON p.category = c.name 
               ${whereClause}
               ORDER BY p.created_at DESC`;
    } else {
      let whereClause = "WHERE status = 'published'";
      if (category) {
        whereClause += " AND category ILIKE $1";
        params = [category];
      }
      query = `SELECT * FROM products ${whereClause} ORDER BY created_at DESC`;
    }
    
    const result = await pool.query(query, params);
    console.log('Found products:', result.rows.length);
    res.json({ items: result.rows });
  } catch (err) { 
    console.error('/api/products error:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// Reviews (public)
app.get('/api/reviews', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM reviews ORDER BY created_at DESC LIMIT 20");
    res.json(result.rows);
  } catch (err) { 
    console.error('/api/reviews error:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// Create review (public)
app.post('/api/reviews', async (req, res) => {
  try {
    const { name, rating, comment } = req.body;
    const result = await pool.query(
      "INSERT INTO reviews (name, rating, comment, status) VALUES ($1, $2, $3, 'pending') RETURNING *",
      [name, rating, comment]
    );
    res.json(result.rows[0]);
  } catch (err) { 
    console.error('/api/reviews POST error:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// Update review (admin)
app.put('/api/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, rating, comment, status } = req.body;
    const result = await pool.query(
      "UPDATE reviews SET name = $1, rating = $2, comment = $3, status = $4 WHERE id = $5 RETURNING *",
      [name, rating, comment, status || 'pending', id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }
    res.json(result.rows[0]);
  } catch (err) { 
    console.error('/api/reviews PUT error:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// Delete review (admin)
app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM reviews WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) { 
    console.error('/api/reviews DELETE error:', err.message);
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