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

// Validate JWT_SECRET in production
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL ERROR: JWT_SECRET is not set in production');
  process.exit(1);
}

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

// Password strength validation
function validatePasswordStrength(password) {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };
  return {
    valid: Object.values(checks).every(Boolean),
    checks
  };
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

  // Sessions table for tracking active login sessions
  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_id TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

// Activity logging helper
function logActivity(req, action, entity_type, entity_id, old_value, new_value) {
  const user_id = req.user ? req.user.id : null;
  const ip_address = req.ip || req.connection.remoteAddress || null;
  const user_agent = req.headers['user-agent'] || null;

  db.run(
    `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id,
      action,
      entity_type,
      entity_id,
      old_value ? JSON.stringify(old_value) : null,
      new_value ? JSON.stringify(new_value) : null,
      ip_address,
      user_agent
    ],
    (err) => {
      if (err) {
        console.error('Activity log error:', err.message);
      }
    }
  );
}

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

  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    const missing = Object.entries(passwordValidation.checks)
      .filter(([, ok]) => !ok)
      .map(([name]) => name);
    return res.status(400).json({
      error: 'Password does not meet requirements',
      requirements: passwordValidation.checks,
      missing
    });
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
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || '';

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    try {
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const tokenId = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const token = jwt.sign(
        { id: user.id, username: user.username, tokenId },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO sessions (user_id, token_id, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
          [user.id, tokenId, ip, userAgent, expiresAt],
          (err) => err ? reject(err) : resolve()
        );
      });

      res.json({ token, user: { id: user.id, username: user.username } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// ==================== SESSION MANAGEMENT ROUTES ====================

// Enhanced token validation middleware
const authenticateTokenWithSession = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    const tokenId = decoded?.tokenId;
    if (!tokenId) {
      return res.status(401).json({ error: 'Token missing session identifier, please re-login' });
    }

    db.get(
      'SELECT * FROM sessions WHERE token_id = ? AND expires_at > datetime("now")',
      [tokenId],
      (sessionErr, session) => {
        if (sessionErr || !session) {
          return res.status(401).json({ error: 'Session expired or revoked, please re-login' });
        }
        req.user = decoded;
        req.tokenId = tokenId;
        next();
      }
    );
  });
};

// GET /api/sessions - List active sessions for current user
app.get('/api/sessions', authenticateTokenWithSession, (req, res) => {
  db.all(
    'SELECT id, token_id, ip_address, user_agent, created_at, expires_at FROM sessions WHERE user_id = ? AND expires_at > datetime("now") ORDER BY created_at DESC',
    [req.user.id],
    (err, sessions) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const sessionList = sessions.map(s => ({
        id: s.token_id,
        sessionId: s.id,
        ip_address: s.ip_address,
        user_agent: s.user_agent,
        created_at: s.created_at,
        expires_at: s.expires_at,
        isCurrent: s.token_id === req.tokenId
      }));
      res.json({ sessions: sessionList });
    }
  );
});

// DELETE /api/sessions/:tokenId - Revoke a specific session
app.delete('/api/sessions/:tokenId', authenticateTokenWithSession, (req, res) => {
  const { tokenId } = req.params;

  db.run('DELETE FROM sessions WHERE token_id = ? AND user_id = ?', [tokenId, req.user.id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ message: 'Session revoked' });
  });
});

// DELETE /api/sessions - Revoke all sessions except current
app.delete('/api/sessions', authenticateTokenWithSession, (req, res) => {
  db.run(
    'DELETE FROM sessions WHERE user_id = ? AND token_id != ?',
    [req.user.id, req.tokenId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: `Revoked ${this.changes} other session(s)`, revoked: this.changes });
    }
  );
});

// POST /api/change-password
app.post('/api/change-password', authenticateTokenWithSession, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password required' });
  }

  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) {
    const missing = Object.entries(passwordValidation.checks)
      .filter(([, ok]) => !ok)
      .map(([name]) => name);
    return res.status(400).json({
      error: 'Password does not meet requirements',
      requirements: passwordValidation.checks,
      missing
    });
  }

  db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    try {
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id], function (updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: updateErr.message });
        }
        res.json({ message: 'Password changed successfully' });
      });
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
app.get('/api/products/export', authenticateTokenWithSession, (req, res) => {
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
    const headers = ['ID', 'Name', 'Category', 'Price', 'Description', 'Rating', 'Reviews', 'Status', 'Meta Title', 'Meta Description', 'Created At', 'Updated At'];
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
        `"${(product.meta_title || '').replace(/"/g, '""')}"`,
        `"${(product.meta_description || '').replace(/"/g, '""')}"`,
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
app.post('/api/products', authenticateTokenWithSession, upload.single('image'), (req, res) => {
  const { name, category, price, description, rating, reviews, status, existing_image, meta_title, meta_description } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : (existing_image || null);
  const price_value = parsePriceToNumber(price);

  db.run(
    `INSERT INTO products (name, category, price, price_value, description, image, rating, reviews, status, meta_title, meta_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, category, price, price_value, description, image, rating || 4.0, reviews || 0, status || 'published', meta_title || null, meta_description || null],
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
        meta_title: meta_title || null,
        meta_description: meta_description || null,
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

        logActivity(req, 'create', 'product', newProduct.id, null, newProduct);

        res.json(newProduct);
      }
  );
});

// Update product
app.put('/api/products/:id', authenticateTokenWithSession, upload.single('image'), (req, res) => {
  const { name, category, price, description, rating, reviews, status, existing_image, meta_title, meta_description } = req.body;
  console.log(`[PUT /api/products/${req.params.id}] Body:`, {
    name, category, price, description, rating, reviews, status, meta_title, meta_description
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
           image = ?, rating = ?, reviews = ?, status = ?, meta_title = ?, meta_description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, category, price, price_value, description, image, rating, reviews, status || product.status || 'published', meta_title || null, meta_description || null, productId],
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
          meta_title: meta_title || null,
          meta_description: meta_description || null,
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

        logActivity(req, 'update', 'product', parseInt(productId), product, updatedProduct);

        res.json(updatedProduct);
      }
    );
  });
});

// Delete product
app.delete('/api/products/:id', authenticateTokenWithSession, (req, res) => {
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

      logActivity(req, 'delete', 'product', parseInt(productId), product, null);

      res.json({ message: 'Product deleted successfully' });
    });
  });
});

// ==================== ADVANCED PRODUCT OPERATIONS ====================

// Bulk delete products
app.post('/api/products/bulk-delete', authenticateTokenWithSession, (req, res) => {
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

      const deletedCount = this.affectedRows;
      products.forEach(p => logActivity(req, 'delete', 'product', p.id, p, null));

      res.json({
        message: `${deletedCount} product(s) deleted successfully`,
        deletedCount
      });
    });
  });
});

// Bulk update products
app.post('/api/products/bulk-update', authenticateTokenWithSession, (req, res) => {
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

  // Fetch old products for logging
  db.all('SELECT * FROM products WHERE id IN (' + ids.map(() => '?').join(',') + ')', ids, (err, oldProducts) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    setClause.push('updated_at = CURRENT_TIMESTAMP');
    values.push(...ids);

    const sql = `UPDATE products SET ${setClause.join(', ')} WHERE id IN (${ids.map(() => '?').join(',')})`;
    db.run(sql, values, function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Fetch updated products and log
      db.all('SELECT * FROM products WHERE id IN (' + ids.map(() => '?').join(',') + ')', ids, (err, updatedProducts) => {
        if (!err && updatedProducts) {
          oldProducts.forEach(old => {
            const updated = updatedProducts.find(p => p.id === old.id);
            if (updated) {
              logActivity(req, 'update', 'product', old.id, old, updated);
            }
          });
        }
      });

      res.json({
        message: `${this.affectedRows} product(s) updated successfully`,
        updatedCount: this.affectedRows
      });
    });
  });
});

// Bulk price adjustment (percentage or fixed)
app.post('/api/products/bulk-price-adjust', authenticateTokenWithSession, (req, res) => {
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

        products.forEach(oldProduct => {
          const updated = updates.find(u => u.id === oldProduct.id);
          if (updated) {
            logActivity(req, 'update', 'product', oldProduct.id, oldProduct, updated);
          }
        });

        res.json({
          message: `${updates.length} product(s) price adjusted successfully`,
          adjustedCount: updates.length
        });
      }
    });
  });
});

// Duplicate product
app.post('/api/products/:id/duplicate', authenticateTokenWithSession, (req, res) => {
  const productId = req.params.id;

  db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
    if (err || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Insert duplicate with new name
    const newName = `${product.name} (Copy)`;
    const price_value = parsePriceToNumber(product.price);
    db.run(
      `INSERT INTO products (name, category, price, price_value, description, image, rating, reviews, status, meta_title, meta_description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newName, product.category, product.price, price_value, product.description, product.image, product.rating, product.reviews, 'draft', product.meta_title || null, product.meta_description || null, new Date().toISOString(), new Date().toISOString()],
      function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        const newProduct = {
          id: this.lastID,
          name: newName,
          category: product.category,
          price: product.price,
          description: product.description,
          image: product.image,
          rating: product.rating,
          reviews: product.reviews,
          status: 'draft',
          price_value,
          meta_title: product.meta_title || null,
          meta_description: product.meta_description || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        logActivity(req, 'create', 'product', newProduct.id, null, newProduct);
        res.json(newProduct);
      }
    );
  });
});

// Import products from CSV
app.post('/api/products/import', authenticateTokenWithSession, uploadCSV.single('file'), async (req, res) => {
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
      const meta_title = values[idx.meta_title] || null;
      const meta_description = values[idx.meta_description] || null;

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
        `INSERT INTO products (name, category, price, description, image, rating, reviews, status, price_value, meta_title, meta_description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [name, category, priceStr, description, image, rating, reviews, status, price_value, meta_title, meta_description],
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

// Get dashboard statistics with month-over-month comparisons
app.get('/api/dashboard/stats', authenticateTokenWithSession, (req, res) => {
  // Calculate date ranges for current and previous month
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Helper to format date for SQLite
  const formatDate = (date) => date.toISOString();

  // Query all stats in parallel
  const statsQuery = `
    SELECT
      -- Current totals (all time)
      COUNT(*) as currentTotalProducts,
      -- Previous total (products that existed at start of current month)
      COUNT(CASE WHEN created_at < ? THEN 1 END) as previousTotalProducts,
      -- Categories
      (SELECT COUNT(*) FROM categories) as currentTotalCategories,
      (SELECT COUNT(*) FROM categories WHERE created_at < ?) as previousTotalCategories,
      -- Average rating (all products vs products existing at start of month)
      AVG(rating) as currentAvgRating,
      AVG(CASE WHEN created_at < ? THEN rating END) as previousAvgRating,
      -- Total reviews
      SUM(reviews) as currentTotalReviews,
      SUM(CASE WHEN created_at < ? THEN reviews END) as previousTotalReviews
    FROM products
  `;

  const params = [
    formatDate(currentMonthStart), // for previousTotalProducts
    formatDate(currentMonthStart), // for previousTotalCategories
    formatDate(currentMonthStart), // for previousAvgRating
    formatDate(currentMonthStart)  // for previousTotalReviews
  ];

  db.all(statsQuery, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const data = rows[0];

    // Calculate changes
    const previousTotalProducts = data.previousTotalProducts || 1; // avoid divide by zero
    const productsChange = ((data.currentTotalProducts - previousTotalProducts) / previousTotalProducts) * 100;

    const previousTotalCategories = data.previousTotalCategories || 1;
    const categoriesChange = data.currentTotalCategories - previousTotalCategories;

    const previousAvgRating = data.previousAvgRating || data.currentAvgRating;
    const ratingChange = (data.currentAvgRating || 0) - (previousAvgRating || 0);

    const previousTotalReviews = data.previousTotalReviews || 0;
    const reviewsChange = (data.currentTotalReviews || 0) - previousTotalReviews;

    const stats = {
      totalProducts: data.currentTotalProducts || 0,
      totalCategories: data.currentTotalCategories || 0,
      averageRating: data.currentAvgRating ? parseFloat(data.currentAvgRating).toFixed(1) : '0.0',
      totalReviews: data.currentTotalReviews || 0,
      changes: {
        products: productsChange.toFixed(1), // percentage
        categories: categoriesChange, // absolute number
        rating: ratingChange.toFixed(1), // absolute difference
        reviews: reviewsChange // absolute number
      }
    };

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

        // Transform to match frontend expected format: { name, count }
        const formattedCategoryData = categoryData.map(item => ({
          name: item.category,
          count: item.count
        }));

        res.json({
          ...stats,
          recentProducts,
          categoryData: formattedCategoryData
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
app.post('/api/categories', authenticateTokenWithSession, (req, res) => {
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
      const newCategory = {
        id: this.lastID,
        name,
        slug,
        description: description || null,
        icon: icon || null,
        color: color || '#D4AF37',
        sort_order: sort_order || 0,
        is_active: is_active !== undefined ? is_active : 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      logActivity(req, 'create', 'category', newCategory.id, null, newCategory);
      res.json(newCategory);
    }
  );
});

// Update category
app.put('/api/categories/:id', authenticateTokenWithSession, (req, res) => {
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
        const updatedCategory = {
          id: parseInt(categoryId),
          name: name || category.name,
          slug: slug || category.slug,
          description: description !== undefined ? description : category.description,
          icon: icon !== undefined ? icon : category.icon,
          color: color || category.color,
          sort_order: sort_order !== undefined ? sort_order : category.sort_order,
          is_active: is_active !== undefined ? is_active : category.is_active,
          created_at: category.created_at,
          updated_at: new Date().toISOString()
        };
        logActivity(req, 'update', 'category', parseInt(categoryId), category, updatedCategory);
        res.json(updatedCategory);
      }
    );
  });
});

// Delete category
app.delete('/api/categories/:id', authenticateTokenWithSession, (req, res) => {
  const categoryId = req.params.id;

  // Get category data before deleting for logging
  db.get('SELECT * FROM categories WHERE id = ?', [categoryId], (err, category) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if category has products
    db.get('SELECT COUNT(*) as count FROM products WHERE category = ?', [category.name], (err, row) => {
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
        logActivity(req, 'delete', 'category', parseInt(categoryId), category, null);
        res.json({ message: 'Category deleted successfully' });
      });
    });
  });
});

// Reorder categories
app.post('/api/categories/reorder', authenticateTokenWithSession, (req, res) => {
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

// ==================== SETTINGS API ====================

// Public endpoint - Get all settings (no auth required for public frontend)
app.get('/api/site', (req, res) => {
  db.all('SELECT key, value FROM settings', [], (err, rows) => {
    if (err) {
      console.error('Error fetching settings:', err.message);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  });
});

// Get all settings as key-value object (admin only)
app.get('/api/settings', authenticateTokenWithSession, (req, res) => {
  db.all('SELECT key, value FROM settings', [], (err, rows) => {
    if (err) {
      console.error('Error fetching settings:', err.message);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  });
});

// Update settings (bulk)
app.put('/api/settings', authenticateTokenWithSession, (req, res) => {
  const updates = req.body; // Expecting { key: value, ... }

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Settings object is required' });
  }

  // Get old settings for logging
  db.all('SELECT key, value FROM settings', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const oldSettings = {};
    rows.forEach(row => {
      oldSettings[row.key] = row.value;
    });

    db.serialize(() => {
      let completed = 0;
      const errors = [];
      const keys = Object.keys(updates);

      if (keys.length === 0) {
        return res.status(400).json({ error: 'No settings to update' });
      }

      keys.forEach(key => {
        const value = String(updates[key]);
        db.run(
          'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
          [key, value],
          function (err) {
            if (err) {
              errors.push(`${key}: ${err.message}`);
            }
            completed++;
            if (completed === keys.length) {
              if (errors.length > 0) {
                return res.status(500).json({ error: errors.join(', ') });
              }

              // Log each changed setting
              keys.forEach(key => {
                if (oldSettings[key] !== updates[key]) {
                  logActivity(req, 'update', 'setting', null, { [key]: oldSettings[key] }, { [key]: updates[key] });
                }
              });

              res.json({ message: 'Settings updated successfully' });
            }
          }
        );
      });
    });
  });
});

// ==================== SETTINGS API - SYSTEM ====================

// Get system status info
app.get('/api/settings/system-status', authenticateTokenWithSession, (req, res) => {
  const dbPath = path.join(__dirname, 'luxe_looks.db');
  const uploadsDir = path.join(__dirname, 'uploads');
  
  // Get database file size
  let dbSize = 0;
  try {
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      dbSize = stats.size;
    }
  } catch (e) {
    console.error('Error getting db size:', e);
  }

  // Get uploads folder size
  let uploadsSize = 0;
  try {
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      files.forEach(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        uploadsSize += stats.size;
      });
    }
  } catch (e) {
    console.error('Error getting uploads size:', e);
  }

  // Get active session count
  db.get(
    'SELECT COUNT(*) as count FROM sessions WHERE expires_at > datetime("now")',
    [],
    (err, sessionResult) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Get server start time (approximate)
      const uptime = process.uptime();
      const uptimeDays = Math.floor(uptime / 86400);
      const uptimeHours = Math.floor((uptime % 86400) / 3600);
      const uptimeMinutes = Math.floor((uptime % 3600) / 60);

      // Get SQLite version
      db.get('SELECT sqlite_version() as version', [], (err, versionResult) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // Get product count
        db.get('SELECT COUNT(*) as count FROM products', [], (err, productResult) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          res.json({
            database_size: dbSize,
            database_size_formatted: formatBytes(dbSize),
            uploads_size: uploadsSize,
            uploads_size_formatted: formatBytes(uploadsSize),
            active_sessions: sessionResult.count,
            uptime_seconds: Math.floor(uptime),
            uptime_formatted: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`,
            sqlite_version: versionResult.version,
            node_version: process.version,
            product_count: productResult.count
          });
        });
      });
    }
  );
});

// Download database backup
app.get('/api/settings/backup', authenticateTokenWithSession, (req, res) => {
  const dbPath = path.join(__dirname, 'luxe_looks.db');
  
  if (!fs.existsSync(dbPath)) {
    return res.status(404).json({ error: 'Database file not found' });
  }

  const backupFileName = `luxe_looks_backup_${new Date().toISOString().split('T')[0]}.db`;
  res.download(dbPath, backupFileName, (err) => {
    if (err) {
      console.error('Backup download error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download backup' });
      }
    }
  });
});

// Restore database from backup
app.post('/api/settings/restore', authenticateTokenWithSession, uploadCSV.single('backup'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No backup file uploaded' });
  }

  const dbPath = path.join(__dirname, 'luxe_looks.db');
  const backupPath = path.join(__dirname, 'luxe_looks.db.backup');
  
  try {
    // Create backup of current database first
    if (fs.existsSync(dbPath)) {
      // Remove old backup if exists
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
      fs.copyFileSync(dbPath, backupPath);
    }

    // Write the uploaded file to database path
    fs.writeFileSync(dbPath, req.file.buffer);

    logActivity(req, 'restore', 'database', null, null, { timestamp: new Date().toISOString() });

    res.json({ message: 'Database restored successfully. Please restart the server.' });
  } catch (error) {
    console.error('Restore error:', error);
    
    // Try to restore from backup
    try {
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, dbPath);
      }
    } catch (e) {
      console.error('Failed to restore backup:', e);
    }

    res.status(500).json({ error: 'Failed to restore database: ' + error.message });
  }
});

// ==================== ACTIVITY LOGS API ====================

// Get activity logs with filtering and pagination
app.get('/api/activity-logs', authenticateTokenWithSession, (req, res) => {
  const {
    user_id,
    action,
    entity_type,
    dateFrom,
    dateTo,
    page = 1,
    limit = 50
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const limitInt = parseInt(limit);

  const conditions = [];
  const params = [];

  if (user_id) {
    conditions.push('al.user_id = ?');
    params.push(parseInt(user_id));
  }
  if (action) {
    conditions.push('al.action = ?');
    params.push(action);
  }
  if (entity_type) {
    conditions.push('al.entity_type = ?');
    params.push(entity_type);
  }
  if (dateFrom) {
    conditions.push('al.created_at >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('al.created_at <= ?');
    params.push(dateTo);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM activity_logs al ${whereClause}`;
  db.get(countQuery, params, (err, countResult) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const total = countResult.total;

    // Get paginated logs with user info
    const dataQuery = `
      SELECT
        al.*,
        u.username
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limitInt, offset);

    db.all(dataQuery, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const logs = rows.map(row => ({
        ...row,
        old_value: row.old_value ? JSON.parse(row.old_value) : null,
        new_value: row.new_value ? JSON.parse(row.new_value) : null
      }));

      res.json({
        items: logs,
        total,
        page: parseInt(page),
        limit: limitInt,
        totalPages: Math.ceil(total / limitInt)
      });
    });
  });
});

// Export activity logs to CSV
app.get('/api/activity-logs/export', authenticateTokenWithSession, (req, res) => {
  const { dateFrom, dateTo } = req.query;

  const conditions = [];
  const params = [];

  if (dateFrom) {
    conditions.push('al.created_at >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('al.created_at <= ?');
    params.push(dateTo);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT
      al.id,
      u.username,
      al.action,
      al.entity_type,
      al.entity_id,
      al.ip_address,
      al.created_at
    FROM activity_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ${whereClause}
    ORDER BY al.created_at DESC
  `;

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const headers = ['ID', 'User', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'Date'];
    const csvRows = [];
    csvRows.push(headers.join(','));

    rows.forEach(log => {
      const values = [
        log.id,
        `"${(log.username || 'System').replace(/"/g, '""')}"`,
        log.action,
        log.entity_type,
        log.entity_id || '',
        log.ip_address || '',
        log.created_at
      ];
      csvRows.push(values.join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="activity-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvRows.join('\n'));
  });
});

// Cleanup old activity logs
app.delete('/api/activity-logs/cleanup', authenticateTokenWithSession, (req, res) => {
  const days = parseInt(req.query.days) || 90;

  db.run(
    `DELETE FROM activity_logs WHERE created_at < datetime('now', '-${days} days')`,
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        message: `Deleted ${this.changes} old log entries`,
        deletedCount: this.changes
      });
    }
  );
});

// ==================== MEDIA API ====================

// Get all media (images from uploads folder)
app.get('/api/media', authenticateTokenWithSession, async (req, res) => {
  const uploadsDir = path.join(__dirname, 'uploads');

  fs.readdir(uploadsDir, async (err, files) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });

    // Build media list with product counts in parallel
    const mediaList = await Promise.all(
      imageFiles.map(async (filename) => {
        const filePath = path.join(uploadsDir, filename);
        const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
        const size = stats ? stats.size : 0;
        const uploadDate = stats ? stats.mtime.toISOString() : '';
        const imagePath = `/uploads/${filename}`;

        // Get product count that uses this image
        const productCount = await new Promise((resolve) => {
          db.get('SELECT COUNT(*) as count FROM products WHERE image = ?', [imagePath], (err, row) => {
            if (err) {
              console.error('Error counting products for', filename, err);
              resolve(0);
            } else {
              resolve(row ? row.count : 0);
            }
          });
        });

        return {
          filename,
          path: imagePath,
          size,
          size_formatted: formatBytes(size),
          uploaded_at: uploadDate,
          product_count: productCount
        };
      })
    );

    res.json(mediaList);
  });
});

// Delete media file
app.delete('/api/media/:filename', authenticateTokenWithSession, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  const imagePath = `/uploads/${filename}`;

  // Check if file is used by any product
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
      logActivity(req, 'delete', 'media', null, { filename, path: imagePath }, null);
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

app.post('/api/media/upload', authenticateTokenWithSession, (req, res) => {
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

    // Log each uploaded file
    uploadedFiles.forEach(file => {
      logActivity(req, 'upload', 'media', null, null, { filename: file.filename, path: file.path, size: file.size });
    });

    res.json({
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles
    });
  });
});

// Get unused images
app.get('/api/media/unused', authenticateTokenWithSession, (req, res) => {
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
