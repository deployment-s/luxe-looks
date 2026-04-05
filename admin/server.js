const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'luxe-looks-secret-key-change-in-production';

// Multer configuration for CSV import (store in memory)
const uploadCSV = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Helper function to extract numeric value from price string
function parsePriceToNumber(priceStr) {
  if (!priceStr) return null;
  // Remove non-digit characters except decimal point
  const numericStr = priceStr.toString().replace(/[^0-9.]/g, '');
  const num = parseFloat(numericStr);
  return isNaN(num) ? null : num;
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve admin panel built files from /admin (handled by catch-all route below)
// Static assets under /admin are served from the dist folder
app.use('/admin/assets', express.static(path.join(__dirname, 'dist/assets')));

// Ensure uploads directory exists
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads', { recursive: true });
}

// Database setup
const db = new sqlite3.Database('./luxe_looks.db');

// Create tables
db.serialize(() => {
  // Users table for admin authentication
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Products table
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price TEXT NOT NULL,
    price_value REAL,
    description TEXT,
    image TEXT,
    rating REAL DEFAULT 4.0,
    reviews INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Categories table
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT DEFAULT '#D4AF37',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add missing columns to existing products table (migrations)
  db.all("PRAGMA table_info(products)", (err, columns) => {
    if (err) {
      console.error('Migration ERROR checking products table:', err);
      return;
    }
    const columnNames = columns ? columns.map(c => c.name) : [];
    console.log('Products table columns:', columnNames.join(', '));

    // Add status column if missing
    if (!columnNames.includes('status')) {
      db.run(`ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'published'`, (err) => {
        if (err) {
          console.error('Migration ERROR adding status column:', err.message);
        } else {
          console.log('Migration: Added status column to products table');
        }
      });
    }

    // Add price_value column if missing
    if (!columnNames.includes('price_value')) {
      db.run(`ALTER TABLE products ADD COLUMN price_value REAL`, (err) => {
        if (err) {
          console.error('Migration ERROR adding price_value column:', err.message);
        } else {
          console.log('Migration: Added price_value column to products table');
          // Backfill price_value from price string after column is added
          backfillPriceValues();
        }
      });
    } else {
      // Backfill any NULL price_values
      backfillPriceValues();
    }
  });

  // Backfill price_value for all products that have NULL price_value
  function backfillPriceValues() {
    db.all('SELECT id, price FROM products WHERE price_value IS NULL', (err, rows) => {
      if (err) {
        console.error('Backfill ERROR:', err);
        return;
      }
      if (rows.length === 0) {
        console.log('Backfill: All products already have price_value');
        return;
      }
      console.log(`Backfill: Filling price_value for ${rows.length} products`);
      const stmt = db.prepare('UPDATE products SET price_value = ? WHERE id = ?');
      rows.forEach(row => {
        const priceVal = parsePriceToNumber(row.price);
        stmt.run(priceVal, row.id);
      });
      rows.forEach(row => {
        const priceVal = parsePriceToNumber(row.price);
        stmt.run(priceVal, row.id);
      });
      stmt.finalize();
      console.log('Backfill: Completed');
    });
  }
});

// Image upload configuration
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// ==================== AUTH ROUTES ====================

// Register admin user (one-time setup)
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username already exists' });
          }
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'Admin user created successfully' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    try {
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ token, user: { id: user.id, username: user.username } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// ==================== PRODUCT ROUTES ====================

// Get all products with filtering, pagination, and sorting
app.get('/api/products', (req, res) => {
  const {
    search,
    category,
    status,
    minPrice,
    maxPrice,
    minRating,
    maxRating,
    dateFrom,
    dateTo,
    page = 1,
    limit = 25,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const limitInt = parseInt(limit);
  const orderBy = sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Build WHERE clause
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('(name LIKE ? OR description LIKE ?)');
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
  }

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (minPrice) {
    conditions.push('price_value >= ?');
    params.push(parseFloat(minPrice));
  }

  if (maxPrice) {
    conditions.push('price_value <= ?');
    params.push(parseFloat(maxPrice));
  }

  if (minRating) {
    conditions.push('rating >= ?');
    params.push(parseFloat(minRating));
  }

  if (maxRating) {
    conditions.push('rating <= ?');
    params.push(parseFloat(maxRating));
  }

  if (dateFrom) {
    // For date range, include full day (00:00:00)
    const fromDate = new Date(dateFrom);
    fromDate.setHours(0, 0, 0, 0);
    conditions.push('created_at >= ?');
    params.push(fromDate.toISOString());
  }

  if (dateTo) {
    // Include up to end of day (23:59:59)
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    conditions.push('created_at <= ?');
    params.push(toDate.toISOString());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderByClause = `ORDER BY ${sortBy} ${orderBy}`;

  // First get total count
  const countQuery = `SELECT COUNT(*) as total FROM products ${whereClause}`;
  db.get(countQuery, params, (err, countResult) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const total = countResult.total;

    // Then get paginated results
    const dataQuery = `SELECT * FROM products ${whereClause} ${orderByClause} LIMIT ? OFFSET ?`;
    params.push(limitInt, offset);

    db.all(dataQuery, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        items: rows,
        total,
        page: parseInt(page),
        limit: limitInt,
        totalPages: Math.ceil(total / limitInt)
      });
    });
  });
});

// Export products to CSV or JSON
app.get('/api/products/export', authenticateToken, (req, res) => {
  const {
    format = 'csv',
    search,
    category,
    status,
    minPrice,
    maxPrice,
    minRating,
    maxRating,
    dateFrom,
    dateTo,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = req.query;

  // Build WHERE clause (same as GET /api/products)
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('(name LIKE ? OR description LIKE ?)');
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
  }
  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (minPrice) {
    conditions.push('price_value >= ?');
    params.push(parseFloat(minPrice));
  }
  if (maxPrice) {
    conditions.push('price_value <= ?');
    params.push(parseFloat(maxPrice));
  }
  if (minRating) {
    conditions.push('rating >= ?');
    params.push(parseFloat(minRating));
  }
  if (maxRating) {
    conditions.push('rating <= ?');
    params.push(parseFloat(maxRating));
  }
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    fromDate.setHours(0, 0, 0, 0);
    conditions.push('created_at >= ?');
    params.push(fromDate.toISOString());
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    conditions.push('created_at <= ?');
    params.push(toDate.toISOString());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderByClause = `ORDER BY ${sortBy} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;

  const query = `SELECT * FROM products ${whereClause} ${orderByClause}`;

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="products-${new Date().toISOString().split('T')[0]}.json"`);
      return res.send(JSON.stringify(rows, null, 2));
    }

    // CSV export
    const headers = ['ID', 'Name', 'Category', 'Price', 'Description', 'Rating', 'Reviews', 'Status', 'Created At', 'Updated At'];
    const csvRows = [];
    csvRows.push(headers.join(','));

    rows.forEach(product => {
      const values = [
        product.id,
        `"${product.name.replace(/"/g, '""')}"`,
        `"${product.category.replace(/"/g, '""')}"`,
        `"${product.price.replace(/"/g, '""')}"`,
        `"${(product.description || '').replace(/"/g, '""')}"`,
        product.rating,
        product.reviews,
        product.status,
        product.created_at,
        product.updated_at
      ];
      csvRows.push(values.join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="products-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvRows.join('\n'));
  });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(row);
  });
});

// Create product
app.post('/api/products', authenticateToken, upload.single('image'), (req, res) => {
  const { name, category, price, description, rating, reviews, status, existing_image } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : (existing_image || null);
  const price_value = parsePriceToNumber(price);

  db.run(
    `INSERT INTO products (name, category, price, price_value, description, image, rating, reviews, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, category, price, price_value, description, image, rating || 4.0, reviews || 0, status || 'published'],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const newProduct = {
        id: this.lastID,
        name,
        category,
        price,
        description,
        image,
        rating: rating || 4.0,
        reviews: reviews || 0,
        status: status || 'published',
        price_value,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Broadcast event
      if (req.app.locals.clients) {
        const message = `event: product_created\ndata: ${JSON.stringify(newProduct)}\n\n`;
        req.app.locals.clients.forEach(client => {
          try { client.write(message); } catch (e) {}
        });
      }

      res.json(newProduct);
    }
  );
});

// Update product
app.put('/api/products/:id', authenticateToken, upload.single('image'), (req, res) => {
  const { name, category, price, description, rating, reviews, status, existing_image } = req.body;
  console.log(`[PUT /api/products/${req.params.id}] Body:`, {
    name, category, price, description, rating, reviews, status
  });
  const productId = req.params.id;

  // First get current product to check for existing image
  db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
    if (err || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const image = req.file ? `/uploads/${req.file.filename}` : (existing_image || product.image);
    const price_value = parsePriceToNumber(price);

    db.run(
      `UPDATE products
       SET name = ?, category = ?, price = ?, price_value = ?, description = ?,
           image = ?, rating = ?, reviews = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, category, price, price_value, description, image, rating, reviews, status || product.status || 'published', productId],
      function (err) {
        if (err) {
          console.error(`[PUT /api/products/${productId}] UPDATE error:`, err.message);
          return res.status(500).json({ error: err.message });
        }
        const savedStatus = status || product.status || 'published';
        console.log(`[PUT /api/products/${productId}] UPDATE successful. Status set to: ${savedStatus}`);
        const updatedProduct = {
          id: productId,
          name,
          category,
          price,
          description,
          image,
          rating: parseFloat(rating),
          reviews: parseInt(reviews),
          status: savedStatus,
          price_value,
          created_at: product.created_at,
          updated_at: new Date().toISOString()
        };

        // Broadcast event
        if (req.app.locals.clients) {
          const message = `event: product_updated\ndata: ${JSON.stringify(updatedProduct)}\n\n`;
          req.app.locals.clients.forEach(client => {
            try { client.write(message); } catch (e) {}
          });
        }

        res.json(updatedProduct);
      }
    );
  });
});

// Delete product
app.delete('/api/products/:id', authenticateToken, (req, res) => {
  const productId = req.params.id;

  // Get product to delete image file
  db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
    if (err || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Delete image file if exists
    if (product.image) {
      const imagePath = path.join(__dirname, product.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    db.run('DELETE FROM products WHERE id = ?', [productId], function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Broadcast event
      if (req.app.locals.clients) {
        const message = `event: product_deleted\ndata: ${JSON.stringify({ id: productId })}\n\n`;
        req.app.locals.clients.forEach(client => {
          try { client.write(message); } catch (e) {}
        });
      }

      res.json({ message: 'Product deleted successfully' });
    });
  });
});

// ==================== ADVANCED PRODUCT OPERATIONS ====================

// Bulk delete products
app.post('/api/products/bulk-delete', authenticateToken, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }

  // Get products to delete images
  db.all('SELECT * FROM products WHERE id IN (' + ids.map(() => '?').join(',') + ')', ids, (err, products) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Delete image files
    products.forEach(product => {
      if (product.image) {
        const imagePath = path.join(__dirname, product.image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
    });

    db.run('DELETE FROM products WHERE id IN (' + ids.map(() => '?').join(',') + ')', ids, function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        message: `${this.affectedRows} product(s) deleted successfully`,
        deletedCount: this.affectedRows
      });
    });
  });
});

// Bulk update products
app.post('/api/products/bulk-update', authenticateToken, (req, res) => {
  const { ids, updates } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !updates) {
    return res.status(400).json({ error: 'ids array and updates object are required' });
  }

  // Build SET clause dynamically
  const setClause = [];
  const values = [];

  if (updates.status) {
    setClause.push('status = ?');
    values.push(updates.status);
  }
  if (updates.category) {
    setClause.push('category = ?');
    values.push(updates.category);
  }
  if (updates.price) {
    setClause.push('price = ?');
    values.push(updates.price);
    // Also update price_value if we have a price update
    const priceValue = parsePriceToNumber(updates.price);
    if (priceValue !== null) {
      setClause.push('price_value = ?');
      values.push(priceValue);
    }
  }
  // Add other updateable fields as needed

  if (setClause.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  setClause.push('updated_at = CURRENT_TIMESTAMP');
  values.push(...ids);

  const sql = `UPDATE products SET ${setClause.join(', ')} WHERE id IN (${ids.map(() => '?').join(',')})`;
  db.run(sql, values, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      message: `${this.affectedRows} product(s) updated successfully`,
      updatedCount: this.affectedRows
    });
  });
});

// Bulk price adjustment (percentage or fixed)
app.post('/api/products/bulk-price-adjust', authenticateToken, (req, res) => {
  const { ids, adjustment } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !adjustment) {
    return res.status(400).json({ error: 'ids array and adjustment object are required' });
  }

  const { type, value, operation } = adjustment; // type: 'percent' | 'fixed', operation: 'increase' | 'decrease'
  if (type !== 'percent' && type !== 'fixed') {
    return res.status(400).json({ error: 'Invalid adjustment type' });
  }
  if (typeof value !== 'number') {
    return res.status(400).json({ error: 'Invalid adjustment value' });
  }

  // Fetch all selected products
  db.all('SELECT * FROM products WHERE id IN (' + ids.map(() => '?').join(',') + ')', ids, async (err, products) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const updates = [];
    for (const product of products) {
      let currentPriceNum = product.price_value;
      if (currentPriceNum == null) {
        const numericStr = product.price.replace(/[^0-9.]/g, '');
        currentPriceNum = parseFloat(numericStr) || 0;
      }

      let newPriceNum;
      if (type === 'percent') {
        const multiplier = operation === 'increase' ? (1 + value / 100) : (1 - value / 100);
        newPriceNum = currentPriceNum * multiplier;
      } else {
        newPriceNum = operation === 'increase' ? currentPriceNum + value : currentPriceNum - value;
      }
      if (newPriceNum < 0) newPriceNum = 0;

      // Format price string: keep original prefix if exists
      const currencyMatch = product.price.match(/^[^\d]+/);
      const prefix = currencyMatch ? currencyMatch[0].trim() : 'KSh';
      const formattedPrice = `${prefix} ${newPriceNum.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

      updates.push({
        id: product.id,
        price: formattedPrice,
        price_value: newPriceNum
      });
    }

    // Perform updates in a transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare('UPDATE products SET price = ?, price_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      let errorOccurred = false;
      for (const u of updates) {
        stmt.run(u.price, u.price_value, u.id, (err) => {
          if (err) {
            errorOccurred = true;
            console.error(`Bulk price adjust error for product ${u.id}:`, err.message);
          }
        });
      }
      stmt.finalize();
      if (errorOccurred) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: 'One or more updates failed' });
      } else {
        db.run('COMMIT');
        res.json({
          message: `${updates.length} product(s) price adjusted successfully`,
          adjustedCount: updates.length
        });
      }
    });
  });
});

// Duplicate product
app.post('/api/products/:id/duplicate', authenticateToken, (req, res) => {
  const productId = req.params.id;

  db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
    if (err || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Insert duplicate with new name
    const newName = `${product.name} (Copy)`;
    db.run(
      `INSERT INTO products (name, category, price, description, image, rating, reviews, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newName, product.category, product.price, product.description, product.image, product.rating, product.reviews, 'draft', new Date().toISOString(), new Date().toISOString()],
      function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({
          id: this.lastID,
          name: newName,
          category: product.category,
          price: product.price,
          description: product.description,
          image: product.image,
          rating: product.rating,
          reviews: product.reviews,
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    );
  });
});

// Import products from CSV
app.post('/api/products/import', authenticateToken, uploadCSV.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const results = {
    total: 0,
    imported: 0,
    errors: [],
  };

  try {
    // Parse CSV from buffer
    const csvData = req.file.buffer.toString('utf-8');
    const rows = csvData.split('\n').filter(line => line.trim());

    if (rows.length <= 1) {
      return res.status(400).json({ error: 'CSV file is empty or has no data rows' });
    }

    // Parse header
    const headers = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

    // Required columns
    const requiredColumns = ['name', 'category', 'price'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: `Missing required columns: ${missingColumns.join(', ')}`,
        requiredColumns,
      });
    }

    // Get column indices
    const idx = {};
    headers.forEach((header, i) => { idx[header] = i; });

    // Process each data row
    for (let i = 1; i < rows.length; i++) {
      results.total++;
      const row = rows[i];
      if (!row.trim()) continue; // Skip empty rows

      // Simple CSV split (handles basic cases, not quoted fields with commas)
      const values = row.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));

      const name = values[idx.name];
      const category = values[idx.category];
      const priceStr = values[idx.price];
      const description = values[idx.description] || '';
      const image = values[idx.image] || null;
      const rating = values[idx.rating] ? parseFloat(values[idx.rating]) : 0;
      const reviews = values[idx.reviews] ? parseInt(values[idx.reviews]) : 0;
      const status = values[idx.status] || 'draft';

      // Validate required fields
      if (!name || !category || !priceStr) {
        results.errors.push({ row: i, error: 'Missing required fields (name, category, or price)' });
        continue;
      }

      // Parse price to number
      const price_value = parsePriceToNumber(priceStr);
      if (price_value === null) {
        results.errors.push({ row: i, error: `Invalid price: ${priceStr}` });
        continue;
      }

      // Insert into database
      db.run(
        `INSERT INTO products (name, category, price, description, image, rating, reviews, status, price_value, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [name, category, priceStr, description, image, rating, reviews, status, price_value],
        function(err) {
          if (err) {
            results.errors.push({ row: i, error: err.message });
          } else {
            results.imported++;
          }

          // Check if this was the last row
          if (i === rows.length - 1) {
            const success = results.imported > 0;
            const message = `Import completed: ${results.imported}/${results.total} products imported successfully`;
            res.status(success ? 200 : 207).json({
              success,
              message,
              results,
            });
          }
        }
      );
    }

    // Handle case where all rows were empty
    if (results.total === 0) {
      res.status(400).json({ error: 'No valid data rows found' });
    }
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to process CSV file', details: error.message });
  }
});

// Get product preview
app.get('/api/products/:id/preview', (req, res) => {
  db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, product) => {
    if (err || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({
      product,
      html: `
        <div class="product-preview">
          <h3>${product.name}</h3>
          <p class="price">${product.price}</p>
          <p class="description">${product.description || ''}</p>
          ${product.image ? `<img src="${product.image}" alt="${product.name}" />` : ''}
        </div>
      `
    });
  });
});

// ==================== DASHBOARD API ====================

// Get dashboard statistics
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  db.all(`
    SELECT
      (SELECT COUNT(*) FROM products) as totalProducts,
      (SELECT COUNT(*) FROM categories) as totalCategories,
      (SELECT AVG(rating) FROM products) as averageRating,
      (SELECT SUM(reviews) FROM products) as totalReviews
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const stats = rows[0];

    // Get recent products
    db.all('SELECT * FROM products ORDER BY created_at DESC LIMIT 5', (err, recentProducts) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Get products by category
      db.all(`
        SELECT category, COUNT(*) as count
        FROM products
        GROUP BY category
        ORDER BY count DESC
      `, (err, categoryData) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        res.json({
          totalProducts: stats.totalProducts || 0,
          totalCategories: stats.totalCategories || 0,
          averageRating: stats.averageRating ? parseFloat(stats.averageRating).toFixed(1) : 0,
          totalReviews: stats.totalReviews || 0,
          recentProducts,
          productsByCategory: categoryData
        });
      });
    });
  });
});

// ==================== CATEGORIES API ====================

// Get all categories with product counts
app.get('/api/categories', (req, res) => {
  db.all(`
    SELECT
      c.*,
      COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON c.name = p.category
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get single category with product count
app.get('/api/categories/:id', (req, res) => {
  db.all(`
    SELECT
      c.*,
      COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON c.name = p.category
    WHERE c.id = ?
    GROUP BY c.id
  `, [req.params.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(row);
  });
});

// Create category
app.post('/api/categories', authenticateToken, (req, res) => {
  const { name, slug, description, icon, color, sort_order, is_active } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: 'Name and slug are required' });
  }

  db.run(
    `INSERT INTO categories (name, slug, description, icon, color, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, slug, description || null, icon || null, color || '#D4AF37', sort_order || 0, is_active !== undefined ? is_active : 1],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Category with this name or slug already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({
        id: this.lastID,
        name,
        slug,
        description,
        icon,
        color: color || '#D4AF37',
        sort_order: sort_order || 0,
        is_active: is_active !== undefined ? is_active : 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  );
});

// Update category
app.put('/api/categories/:id', authenticateToken, (req, res) => {
  const { name, slug, description, icon, color, sort_order, is_active } = req.body;
  const categoryId = req.params.id;

  db.get('SELECT * FROM categories WHERE id = ?', [categoryId], (err, category) => {
    if (err || !category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    db.run(
      `UPDATE categories
       SET name = ?, slug = ?, description = ?, icon = ?, color = ?, sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name || category.name,
        slug || category.slug,
        description !== undefined ? description : category.description,
        icon !== undefined ? icon : category.icon,
        color || category.color,
        sort_order !== undefined ? sort_order : category.sort_order,
        is_active !== undefined ? is_active : category.is_active,
        categoryId
      ],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Category with this name or slug already exists' });
          }
          return res.status(500).json({ error: err.message });
        }
        res.json({
          id: categoryId,
          name: name || category.name,
          slug: slug || category.slug,
          description: description !== undefined ? description : category.description,
          icon: icon !== undefined ? icon : category.icon,
          color: color || category.color,
          sort_order: sort_order !== undefined ? sort_order : category.sort_order,
          is_active: is_active !== undefined ? is_active : category.is_active,
          created_at: category.created_at,
          updated_at: new Date().toISOString()
        });
      }
    );
  });
});

// Delete category
app.delete('/api/categories/:id', authenticateToken, (req, res) => {
  const categoryId = req.params.id;

  // Check if category has products
  db.get('SELECT COUNT(*) as count FROM products WHERE category = (SELECT name FROM categories WHERE id = ?)', [categoryId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (row && row.count > 0) {
      return res.status(400).json({ error: `Cannot delete category with ${row.count} product(s). Reassign products first.` });
    }

    db.run('DELETE FROM categories WHERE id = ?', [categoryId], function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Category deleted successfully' });
    });
  });
});

// Reorder categories
app.post('/api/categories/reorder', authenticateToken, (req, res) => {
  const { categoryOrders } = req.body; // Array of { id, sort_order }

  if (!Array.isArray(categoryOrders)) {
    return res.status(400).json({ error: 'categoryOrders array is required' });
  }

  db.serialize(() => {
    let completed = 0;
    const errors = [];

    categoryOrders.forEach((order, index) => {
      db.run(
        'UPDATE categories SET sort_order = ? WHERE id = ?',
        [order.sort_order || index, order.id],
        function (err) {
          if (err) {
            errors.push(`Category ${order.id}: ${err.message}`);
          }
          completed++;
          if (completed === categoryOrders.length) {
            if (errors.length > 0) {
              return res.status(500).json({ error: errors.join(', ') });
            }
            res.json({ message: 'Categories reordered successfully' });
          }
        }
      );
    });
  });
});

// ==================== MEDIA API ====================

// Get all media (images from uploads folder)
app.get('/api/media', authenticateToken, (req, res) => {
  const uploadsDir = path.join(__dirname, 'uploads');

  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });

    const mediaList = imageFiles.map(filename => {
      const filePath = path.join(uploadsDir, filename);
      const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
      const size = stats ? stats.size : 0;
      const uploadDate = stats ? stats.mtime.toISOString() : '';

      // Get product count that uses this image
      const imagePath = `/uploads/${filename}`;
      // We'll count synchronously for simplicity
      let productCount = 0;
      db.get('SELECT COUNT(*) as count FROM products WHERE image = ?', [imagePath], (err, row) => {
        if (!err && row) productCount = row.count;
      });

      return {
        filename,
        path: imagePath,
        size,
        size_formatted: formatBytes(size),
        uploaded_at: uploadDate,
        product_count: productCount
      };
    });

    res.json(mediaList);
  });
});

// Delete media file
app.delete('/api/media/:filename', authenticateToken, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  // Check if file is used by any product
  const imagePath = `/uploads/${filename}`;
  db.get('SELECT COUNT(*) as count FROM products WHERE image = ?', [imagePath], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (row && row.count > 0) {
      return res.status(400).json({ error: `Cannot delete image used by ${row.count} product(s). Remove from products first.` });
    }

    fs.unlink(filePath, (err) => {
      if (err) {
        if (err.code === 'ENOENT') {
          return res.status(404).json({ error: 'File not found' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Media deleted successfully' });
    });
  });
});

// Upload media (bulk)
const uploadMultiple = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
}).array('images', 10); // Up to 10 images at once

app.post('/api/media/upload', authenticateToken, (req, res) => {
  uploadMultiple(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map((file) => ({
      filename: file.filename,
      path: `/uploads/${file.filename}`,
      size: file.size,
      size_formatted: formatBytes(file.size),
      uploaded_at: new Date().toISOString(),
      product_count: 0
    }));

    res.json({
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles
    });
  });
});

// Get unused images
app.get('/api/media/unused', authenticateToken, (req, res) => {
  const uploadsDir = path.join(__dirname, 'uploads');

  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });

    // Check which files are used in products
    const unusedFiles = [];
    let checked = 0;

    if (imageFiles.length === 0) {
      return res.json({ unused: [] });
    }

    const checkUsage = (filename) => {
      const imagePath = `/uploads/${filename}`;
      db.get('SELECT COUNT(*) as count FROM products WHERE image = ?', [imagePath], (err, row) => {
        if (!err && (!row || row.count === 0)) {
          unusedFiles.push(filename);
        }
        checked++;
        if (checked === imageFiles.length) {
          res.json({ unused: unusedFiles });
        }
      });
    };

    imageFiles.forEach(checkUsage);
  });
});

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Serve admin client SPA for both /admin and /admin/*
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Admin server running on http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/products`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
