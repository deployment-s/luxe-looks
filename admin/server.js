require('dotenv').config({ path: __dirname + '/.env' });

// console.log('AWS Endpoint:', process.env.AWS_S3_ENDPOINT_URL);
// console.log('S3 Bucket:', process.env.BUCKET_NAME);

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

// Load S3 config AFTER dotenv
const { upload, isS3Configured, isSupabase, getImagePath, bucketName } = require('./s3Config');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'luxe-looks-secret-key-change-in-production';

// Validate JWT_SECRET in production
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL ERROR: JWT_SECRET is not set in production');
  process.exit(1);
}

// Multer configuration for CSV import (store in memory) - not affected by S3
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

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());

// Security headers (helmet)
app.use(helmet({
  contentSecurityPolicy: false,
}));

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // stricter limit for auth endpoints
  message: { error: 'Too many login attempts, please try again later' },
});

app.use('/api/', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);

// Request logging for production
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'production') {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

app.use(express.json({ limit: '10mb' }));

// Serve admin static files FIRST (before SPA fallback)
app.use('/admin/assets', express.static(path.join(__dirname, 'dist/assets')));
app.use('/admin/logo.png', express.static(path.join(__dirname, 'dist/logo.png')));

// Serve admin index.html for /admin routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Serve main frontend static files (from luxe-looks/dist)
const frontendPath = path.join(__dirname, '../luxe-looks/dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  // Serve frontend index.html for all non-API and non-admin routes (SPA fallback)
  app.get(/^(?!\/api\/)(?!\/admin).*/, (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Serve uploads folder only if not using S3
if (!isS3Configured()) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Ensure uploads directory exists
  if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads', { recursive: true });
  }
}

// Database setup
const pool = new Pool({
  connectionString: process.env.RAILWAY_DB_URL || process.env.DATABASE_URL,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Connected to PostgreSQL database');
  }
});

// Create tables
pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

pool.query(`
  CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    price TEXT NOT NULL,
    price_value REAL,
    description TEXT,
    image TEXT,
    rating REAL DEFAULT 4.0,
    reviews INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

pool.query(`
  CREATE TABLE IF NOT EXISTS media (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

pool.query(`
  CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    subtitle TEXT,
    icon TEXT,
    color VARCHAR(7) DEFAULT '#D4AF37',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

pool.query(`
  CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_id VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

pool.query(`
  CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Insert default settings if not exists
pool.query(`
  INSERT INTO settings (key, value) VALUES 
    ('site_name', 'Luxe Looks'),
    ('logo', ''),
    ('favicon', ''),
    ('whatsapp', 'https://chat.whatsapp.com/Gb8xGhuAacOJzY7cuMO5tK')
  ON CONFLICT (key) DO NOTHING
`);

pool.query(`
  CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    rating INTEGER DEFAULT 5,
    text TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT true,
    avatar VARCHAR(10),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => {
  // Insert default reviews after table is created
  return pool.query(`
    INSERT INTO reviews (name, location, rating, text, is_verified, avatar, sort_order) VALUES 
      ('Jane Wairimu', 'Nairobi', 5, 'Absolutely love Luxe Looks! The perfumes are long-lasting and the quality is unmatched. Fast delivery and excellent customer service. My go-to for luxury beauty products in Kenya.', true, 'JW', 1),
      ('Titus Muthiani', 'Mombasa', 5, 'Premium quality human hair at an amazing price. The team is very helpful on WhatsApp and answered all my questions. Delivery was super fast. Highly recommend!', true, 'TM', 2),
      ('Sarah K.', 'Kisumu', 5, 'Finally found authentic designer perfumes in Kenya! The oil-based fragrances last all day. Luxe Looks has exceeded my expectations. Will definitely be ordering again.', true, 'SK', 3)
    ON CONFLICT DO NOTHING
  `);
});

// Activity logging helper
function logActivity(req, action, entity_type, entity_id, old_value, new_value) {
  const user_id = req.user ? req.user.id : null;
  const ip_address = req.ip || req.connection.remoteAddress || null;
  const user_agent = req.headers['user-agent'] || null;

  pool.query(
    `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
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

// Backfill price_value for all products that have NULL price_value
async function backfillPriceValues() {
  try {
    const { rows } = await pool.query('SELECT id, price FROM products WHERE price_value IS NULL');
    if (rows.length === 0) {
      // console.log('Backfill: All products already have price_value');
      return;
    }
    // console.log(`Backfill: Filling price_value for ${rows.length} products`);

    for (const row of rows) {
      const priceVal = parsePriceToNumber(row.price);
      await pool.query('UPDATE products SET price_value = $1 WHERE id = $2', [priceVal, row.id]);
    }
    // console.log('Backfill: Completed');
  } catch (err) {
    console.error('Backfill ERROR:', err);
  }
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
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
      [username, hashedPassword]
    );
    res.status(201).json({ message: 'Admin user created successfully' });
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || '';

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate a unique tokenId for session tracking
    const tokenId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const token = jwt.sign({ id: user.id, username: user.username, tokenId }, JWT_SECRET, {
      expiresIn: '7d'
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await pool.query(
      'INSERT INTO sessions (user_id, token_id, ip_address, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [user.id, tokenId, ip, userAgent, expiresAt]
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email || ''
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== SESSION MANAGEMENT ROUTES ====================

// Enhanced token validation middleware
const authenticateTokenWithSession = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    const tokenId = decoded?.tokenId;
    if (!tokenId) {
      return res.status(401).json({ error: 'Token missing session identifier, please re-login' });
    }

    try {
      const { rows } = await pool.query(
        'SELECT * FROM sessions WHERE token_id = $1 AND expires_at > NOW()',
        [tokenId]
      );
      const session = rows[0];

      if (!session) {
        return res.status(401).json({ error: 'Session expired or revoked, please re-login' });
      }
      req.user = decoded;
      req.tokenId = tokenId;
      next();
    } catch (error) {
      console.error('Session validation error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
};

// GET /api/sessions - List active sessions for current user
app.get('/api/sessions', authenticateTokenWithSession, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, token_id, ip_address, user_agent, created_at, expires_at FROM sessions WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC',
      [req.user.id]
    );
    const sessionList = result.rows.map(s => ({
      id: s.token_id,
      sessionId: s.id,
      ip_address: s.ip_address,
      user_agent: s.user_agent,
      created_at: s.created_at,
      expires_at: s.expires_at,
      isCurrent: s.token_id === req.tokenId
    }));
    res.json({ sessions: sessionList });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:tokenId - Revoke a specific session
app.delete('/api/sessions/:tokenId', authenticateTokenWithSession, async (req, res) => {
  const { tokenId } = req.params;

  await pool.query('DELETE FROM sessions WHERE token_id = $1 AND user_id = $2', [tokenId, req.user.id]);
  res.json({ message: 'Session revoked' });
});

// ==================== USER MANAGEMENT API ====================

// Get all users (admin only)
app.get('/api/users', authenticateTokenWithSession, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Create new user (admin only)
app.post('/api/users', authenticateTokenWithSession, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
      [username, hashedPassword]
    );
    logActivity(req, 'create', 'user', result.rows[0].id, null, { username });
    res.json({ id: result.rows[0].id, username, message: 'User created successfully' });
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update user password (admin only)
app.put('/api/users/:id/password', authenticateTokenWithSession, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  // Check if user exists
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  const user = rows[0];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
    logActivity(req, 'update', 'user', parseInt(id), { username: user.username }, { password: '***' });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user (admin only)
app.delete('/api/users/:id', authenticateTokenWithSession, async (req, res) => {
  const { id } = req.params;

  // Prevent deleting yourself
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const user = rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [id]);
    logActivity(req, 'delete', 'user', parseInt(id), { username: user.username }, null);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Password Reset - Request (generates reset code stored in memory)
const resetCodes = new Map();

app.post('/api/users/reset-request', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const { rows } = await pool.query(
    'SELECT id, username FROM users WHERE username = $1',
    [username]
  );
  const user = rows[0];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Generate 6-digit reset code
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Store code with 10 minute expiry
  resetCodes.set(username, {
    code: resetCode,
    expires: Date.now() + 10 * 60 * 1000
  });

  // In production, send via email - for now, return code (for testing)
  res.json({
    message: 'Reset code generated',
    // Remove this in production - code should be sent via email
    debugCode: resetCode
  });
});

app.post('/api/users/reset-password', async (req, res) => {
  const { username, resetCode, newPassword } = req.body;

  if (!username || !resetCode || !newPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const stored = resetCodes.get(username);

  if (!stored) {
    return res.status(400).json({ error: 'No reset request found' });
  }

  if (Date.now() > stored.expires) {
    resetCodes.delete(username);
    return res.status(400).json({ error: 'Reset code expired' });
  }

  if (stored.code !== resetCode) {
    return res.status(400).json({ error: 'Invalid reset code' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query('UPDATE users SET password = $1 WHERE username = $2', [hashedPassword, username]);

    resetCodes.delete(username);
    await pool.query('DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = $1)', [username]);

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions - Revoke all sessions except current
app.delete('/api/sessions', authenticateTokenWithSession, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM sessions WHERE user_id = $1 AND token_id != $2',
      [req.user.id, req.tokenId]
    );
    res.json({ message: `Revoked ${result.rowCount} other session(s)`, revoked: result.rowCount });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
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

  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = rows[0];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PRODUCT ROUTES ====================

// Get all products with filtering, pagination, and sorting
app.get('/api/products', async (req, res) => {
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
  let paramIndex = 1;

  if (search) {
    conditions.push(`(name LIKE $${paramIndex} OR description LIKE $${paramIndex + 1})`);
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
    paramIndex += 2;
  }

  if (category) {
    conditions.push(`category = $${paramIndex}`);
    params.push(category);
    paramIndex++;
  }

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (minPrice) {
    conditions.push(`price_value >= $${paramIndex}`);
    params.push(parseFloat(minPrice));
    paramIndex++;
  }

  if (maxPrice) {
    conditions.push(`price_value <= $${paramIndex}`);
    params.push(parseFloat(maxPrice));
    paramIndex++;
  }

  if (minRating) {
    conditions.push(`rating >= $${paramIndex}`);
    params.push(parseFloat(minRating));
    paramIndex++;
  }

  if (maxRating) {
    conditions.push(`rating <= $${paramIndex}`);
    params.push(parseFloat(maxRating));
    paramIndex++;
  }

  if (dateFrom) {
    // For date range, include full day (00:00:00)
    const fromDate = new Date(dateFrom);
    fromDate.setHours(0, 0, 0, 0);
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(fromDate.toISOString());
    paramIndex++;
  }

  if (dateTo) {
    // Include up to end of day (23:59:59)
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(toDate.toISOString());
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderByClause = `ORDER BY ${sortBy} ${orderBy}`;

  try {
    // First get total count
    const countQuery = `SELECT COUNT(*) as total FROM products ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = countResult.rows[0].total;

    // Then get paginated results
    const dataQuery = `SELECT * FROM products ${whereClause} ${orderByClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    // Note: params array already contains WHERE condition values
    // We need to add limit and offset at the end for the LIMIT/OFFSET clauses
    params.push(limitInt, offset);

    const result = await pool.query(dataQuery, params);

    res.json({
      items: result.rows,
      total,
      page: parseInt(page),
      limit: limitInt,
      totalPages: Math.ceil(total / limitInt)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Export products to CSV or JSON
app.get('/api/products/export', authenticateTokenWithSession, async (req, res) => {
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
  let paramIndex = 1;

  if (search) {
    conditions.push(`(name LIKE $${paramIndex} OR description LIKE $${paramIndex + 1})`);
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
    paramIndex += 2;
  }
  if (category) {
    conditions.push(`category = $${paramIndex}`);
    params.push(category);
    paramIndex++;
  }
  if (status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }
  if (minPrice) {
    conditions.push(`price_value >= $${paramIndex}`);
    params.push(parseFloat(minPrice));
    paramIndex++;
  }
  if (maxPrice) {
    conditions.push(`price_value <= $${paramIndex}`);
    params.push(parseFloat(maxPrice));
    paramIndex++;
  }
  if (minRating) {
    conditions.push(`rating >= $${paramIndex}`);
    params.push(parseFloat(minRating));
    paramIndex++;
  }
  if (maxRating) {
    conditions.push(`rating <= $${paramIndex}`);
    params.push(parseFloat(maxRating));
    paramIndex++;
  }
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    fromDate.setHours(0, 0, 0, 0);
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(fromDate.toISOString());
    paramIndex++;
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(`created_at <= $${paramIndex}`);
    params.push(toDate.toISOString());
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderByClause = `ORDER BY ${sortBy} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;

  try {
    const query = `SELECT * FROM products ${whereClause} ${orderByClause}`;
    const result = await pool.query(query, params);
    const rows = result.rows;

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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    const row = result.rows[0];

    if (!row) {
      return res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create product
app.post('/api/products', authenticateTokenWithSession, upload.single('image'), async (req, res) => {
  // console.log('[POST /api/products] Upload debug:', {
  //   hasFile: !!req.file,
  //   file: req.file ? { filename: req.file.filename, location: req.file.location, mimetype: req.file.mimetype } : null,
  //   bodyKeys: Object.keys(req.body),
  //   isS3: isS3Configured(),
  //   isSupabase: isSupabase()
  // });
  const { name, category, price, description, rating, reviews, status, existing_image, meta_title, meta_description } = req.body;
  const image = getImagePath(req.file, existing_image);
  // console.log('[POST /api/products] Final image URL:', image);
  const price_value = parsePriceToNumber(price);

  try {
    const result = await pool.query(
      `INSERT INTO products (name, category, price, price_value, description, image, rating, reviews, status, meta_title, meta_description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [name, category, price, price_value, description, image, rating || 4.0, reviews || 0, status || 'published', meta_title || null, meta_description || null]
    );
    const newProduct = result.rows[0];

    // Broadcast event
    if (req.app.locals.clients) {
      const message = `event: product_created\ndata: ${JSON.stringify(newProduct)}\n\n`;
      req.app.locals.clients.forEach(client => {
        try { client.write(message); } catch (e) { }
      });
    }

    logActivity(req, 'create', 'product', newProduct.id, null, newProduct);

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product
app.put('/api/products/:id', authenticateTokenWithSession, upload.single('image'), async (req, res) => {
  const { name, category, price, description, rating, reviews, status, existing_image, meta_title, meta_description } = req.body;
  const productId = req.params.id;

  // First get current product to check for existing image
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
  const product = rows[0];

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const image = getImagePath(req.file, existing_image || product.image);
  const price_value = parsePriceToNumber(price);

  const result = await pool.query(
    `UPDATE products
     SET name = $1, category = $2, price = $3, price_value = $4, description = $5,
         image = $6, rating = $7, reviews = $8, status = $9, meta_title = $10, meta_description = $11, updated_at = CURRENT_TIMESTAMP
     WHERE id = $12
     RETURNING *`,
    [name, category, price, price_value, description, image, rating, reviews, status || product.status || 'published', meta_title || null, meta_description || null, productId]
  );

  const savedStatus = status || product.status || 'published';
  // console.log(`[PUT /api/products/${productId}] UPDATE successful. Status set to: ${savedStatus}`);
  const updatedProduct = result.rows[0];

  // Broadcast event
  if (req.app.locals.clients) {
    const message = `event: product_updated\ndata: ${JSON.stringify(updatedProduct)}\n\n`;
    req.app.locals.clients.forEach(client => {
      try { client.write(message); } catch (e) { }
    });
  }

  logActivity(req, 'update', 'product', parseInt(productId), product, updatedProduct);

  res.json(updatedProduct);
});

// Delete product
app.delete('/api/products/:id', authenticateTokenWithSession, async (req, res) => {
  const productId = req.params.id;

  // Get product to delete image file
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
  const product = rows[0];

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Delete image file if exists
  if (product.image) {
    const imagePath = path.join(__dirname, product.image);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }

  await pool.query('DELETE FROM products WHERE id = $1', [productId]);

  // Broadcast event
  if (req.app.locals.clients) {
    const message = `event: product_deleted\ndata: ${JSON.stringify({ id: productId })}\n\n`;
    req.app.locals.clients.forEach(client => {
      try { client.write(message); } catch (e) { }
    });
  }

  logActivity(req, 'delete', 'product', parseInt(productId), product, null);

  res.json({ message: 'Product deleted successfully' });
});

// ==================== ADVANCED PRODUCT OPERATIONS ====================

// Bulk delete products
app.post('/api/products/bulk-delete', authenticateTokenWithSession, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }

  try {
    // Get products to delete images
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
    const { rows: products } = await pool.query(
      `SELECT * FROM products WHERE id IN (${placeholders})`,
      ids
    );

    // Delete image files
    products.forEach(product => {
      if (product.image) {
        const imagePath = path.join(__dirname, product.image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
    });

    await pool.query(
      `DELETE FROM products WHERE id IN (${placeholders})`,
      ids
    );

    const deletedCount = products.length;
    products.forEach(p => logActivity(req, 'delete', 'product', p.id, p, null));

    res.json({
      message: `${deletedCount} product(s) deleted successfully`,
      deletedCount
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Bulk update products
app.post('/api/products/bulk-update', authenticateTokenWithSession, async (req, res) => {
  const { ids, updates } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !updates) {
    return res.status(400).json({ error: 'ids array and updates object are required' });
  }

  // Build SET clause dynamically
  const setClause = [];
  const values = [];
  let paramIndex = 1;

  if (updates.status) {
    setClause.push(`status = $${paramIndex}`);
    values.push(updates.status);
    paramIndex++;
  }
  if (updates.category) {
    setClause.push(`category = $${paramIndex}`);
    values.push(updates.category);
    paramIndex++;
  }
  if (updates.price) {
    setClause.push(`price = $${paramIndex}`);
    values.push(updates.price);
    paramIndex++;
    // Also update price_value if we have a price update
    const priceValue = parsePriceToNumber(updates.price);
    if (priceValue !== null) {
      setClause.push(`price_value = $${paramIndex}`);
      values.push(priceValue);
      paramIndex++;
    }
  }
  // Add other updateable fields as needed

  if (setClause.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  // Fetch old products for logging
  try {
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
    const { rows: oldProducts } = await pool.query(
      `SELECT * FROM products WHERE id IN (${placeholders})`,
      ids
    );

    setClause.push('updated_at = CURRENT_TIMESTAMP');
    values.push(...ids);

    const sql = `UPDATE products SET ${setClause.join(', ')} WHERE id IN (${placeholders})`;
    await pool.query(sql, values);

    // Fetch updated products and log
    const { rows: updatedProducts } = await pool.query(
      `SELECT * FROM products WHERE id IN (${placeholders})`,
      ids
    );

    if (updatedProducts) {
      oldProducts.forEach(old => {
        const updated = updatedProducts.find(p => p.id === old.id);
        if (updated) {
          logActivity(req, 'update', 'product', old.id, old, updated);
        }
      });
    }

    res.json({
      message: `${values.length / (setClause.length)} product(s) updated successfully`,
      updatedCount: values.length / (setClause.length)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Bulk price adjustment (percentage or fixed)
app.post('/api/products/bulk-price-adjust', authenticateTokenWithSession, async (req, res) => {
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
  try {
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
    const { rows: products } = await pool.query(
      `SELECT * FROM products WHERE id IN (${placeholders})`,
      ids
    );

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
    await pool.query('BEGIN');
    try {
      for (const u of updates) {
        await pool.query(
          'UPDATE products SET price = $1, price_value = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          [u.price, u.price_value, u.id]
        );
      }
      await pool.query('COMMIT');

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
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Duplicate product
app.post('/api/products/:id/duplicate', authenticateTokenWithSession, async (req, res) => {
  const productId = req.params.id;

  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
  const product = rows[0];

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Insert duplicate with new name
  const newName = `${product.name} (Copy)`;
  const price_value = parsePriceToNumber(product.price);

  const result = await pool.query(
    `INSERT INTO products (name, category, price, price_value, description, image, rating, reviews, status, meta_title, meta_description, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
    [newName, product.category, product.price, price_value, product.description, product.image, product.rating, product.reviews, 'draft', product.meta_title || null, product.meta_description || null, new Date().toISOString(), new Date().toISOString()]
  );

  const newProduct = result.rows[0];
  logActivity(req, 'create', 'product', newProduct.id, null, newProduct);
  res.json(newProduct);
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
      try {
        await pool.query(
          `INSERT INTO products (name, category, price, description, image, rating, reviews, status, price_value, meta_title, meta_description, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
          [name, category, priceStr, description, image, rating, reviews, status, price_value, meta_title, meta_description]
        );
        results.imported++;
      } catch (err) {
        results.errors.push({ row: i, error: err.message });
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

    // Handle case where all rows were empty
    if (results.total === 0) {
      res.status(400).json({ error: 'No valid data rows found' });
    }
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product preview
app.get('/api/products/:id/preview', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    const product = result.rows[0];

    if (!product) {
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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==================== DASHBOARD API ====================

// Get dashboard statistics with month-over-month comparisons
app.get('/api/dashboard/stats', authenticateTokenWithSession, async (req, res) => {
  try {
    // Calculate date ranges for current and previous month
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Helper to format date for PostgreSQL
    const formatDate = (date) => date.toISOString();

    // Query all stats in parallel
    const statsQuery = `
      SELECT
        COUNT(*) as currentTotalProducts,
        COUNT(CASE WHEN created_at < $1 THEN 1 END) as previousTotalProducts,
        (SELECT COUNT(*) FROM categories) as currentTotalCategories,
        (SELECT COUNT(*) FROM categories WHERE created_at < $2) as previousTotalCategories,
        AVG(rating) as currentAvgRating,
        AVG(CASE WHEN created_at < $3 THEN rating END) as previousAvgRating,
        SUM(reviews) as currentTotalReviews,
        SUM(CASE WHEN created_at < $4 THEN reviews END) as previousTotalReviews
      FROM products
    `;

    const params = [
      formatDate(currentMonthStart),
      formatDate(currentMonthStart),
      formatDate(currentMonthStart),
      formatDate(currentMonthStart)
    ];

    const result = await pool.query(statsQuery, params);
    const data = result.rows[0];

    // PostgreSQL returns lowercase column names
    const currentTotalProducts = parseInt(data.currenttotalproducts) || 0;
    const previousTotalProducts = parseInt(data.previoustotalproducts) || 0;
    const productsChange = previousTotalProducts > 0
      ? ((currentTotalProducts - previousTotalProducts) / previousTotalProducts) * 100
      : (currentTotalProducts > 0 ? 100 : 0);

    const currentTotalCategories = parseInt(data.currenttotalcategories) || 0;
    const previousTotalCategories = parseInt(data.previoustotalcategories) || 0;
    const categoriesChange = currentTotalCategories - previousTotalCategories;

    const currentAvgRating = parseFloat(data.currentavgrating) || 0;
    const previousAvgRating = parseFloat(data.previousavgrating) || currentAvgRating;
    const ratingChange = currentAvgRating - previousAvgRating;

    const currentTotalReviews = parseInt(data.currenttotalreviews) || 0;
    const previousTotalReviews = parseInt(data.previoustotalreviews) || 0;
    const reviewsChange = currentTotalReviews - previousTotalReviews;

    const stats = {
      totalProducts: currentTotalProducts,
      totalCategories: currentTotalCategories,
      averageRating: currentAvgRating.toFixed(1),
      totalReviews: currentTotalReviews,
      changes: {
        products: productsChange.toFixed(1),
        categories: categoriesChange,
        rating: ratingChange.toFixed(1),
        reviews: reviewsChange
      }
    };

    // Get recent products
    const recentResult = await pool.query('SELECT * FROM products ORDER BY created_at DESC LIMIT 5');
    const recentProducts = recentResult.rows;

    // Get products by category
    const categoryResult = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM products
      GROUP BY category
      ORDER BY count DESC
    `);
    const categoryData = categoryResult.rows;

    // Transform to match frontend expected format: { name, count }
    const formattedCategoryData = categoryData.map(item => ({
      name: item.category,
      count: parseInt(item.count) || 0
    }));

    res.json({
      ...stats,
      recentProducts,
      categoryData: formattedCategoryData
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==================== CATEGORIES API ====================

// Get all categories with product counts
app.get('/api/categories', async (req, res) => {
  try {
    const { active } = req.query;
    let query = `
      SELECT
        c.*,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.name = p.category
    `;
    const params = [];

    if (active === 'true') {
      query += ' WHERE c.is_active = true';
    }

    query += ' GROUP BY c.id ORDER BY c.sort_order ASC, c.name ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get single category with product count
app.get('/api/categories/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.*,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.name = p.category
      WHERE c.id = $1
      GROUP BY c.id
    `, [req.params.id]);

    const rows = result.rows;
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Create category
app.post('/api/categories', authenticateTokenWithSession, async (req, res) => {
  const { name, slug, description, subtitle, icon, color, sort_order, is_active } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: 'Name and slug are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO categories (name, slug, description, subtitle, icon, color, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, slug, description || null, subtitle || null, icon || null, color || '#D4AF37', sort_order || 0, is_active !== undefined ? is_active : 1]
    );
    const newCategory = result.rows[0];
    logActivity(req, 'create', 'category', newCategory.id, null, newCategory);
    res.json(newCategory);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Category with this name or slug already exists' });
    }
    return res.status(500).json({ error: err.message });
  }
});

// Update category
app.put('/api/categories/:id', authenticateTokenWithSession, async (req, res) => {
  const { name, slug, description, subtitle, icon, color, sort_order, is_active } = req.body;
  const categoryId = req.params.id;

  const { rows } = await pool.query('SELECT * FROM categories WHERE id = $1', [categoryId]);
  const category = rows[0];

  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  try {
    const result = await pool.query(
      `UPDATE categories
        SET name = $1, slug = $2, description = $3, subtitle = $4, icon = $5, color = $6, sort_order = $7, is_active = $8, updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
        RETURNING *`,
      [
        name || category.name,
        slug || category.slug,
        description !== undefined ? description : category.description,
        subtitle !== undefined ? subtitle : category.subtitle,
        icon !== undefined ? icon : category.icon,
        color || category.color,
        sort_order !== undefined ? sort_order : category.sort_order,
        is_active !== undefined ? is_active : category.is_active,
        categoryId
      ]
    );
    const updatedCategory = result.rows[0];
    logActivity(req, 'update', 'category', parseInt(categoryId), category, updatedCategory);
    res.json(updatedCategory);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Category with this name or slug already exists' });
    }
    return res.status(500).json({ error: err.message });
  }
});

// Delete category
app.delete('/api/categories/:id', authenticateTokenWithSession, async (req, res) => {
  const categoryId = req.params.id;

  try {
    // Get category data before deleting for logging
    const { rows } = await pool.query('SELECT * FROM categories WHERE id = $1', [categoryId]);
    const category = rows[0];

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if category has products
    const { rows: countRows } = await pool.query('SELECT COUNT(*) as count FROM products WHERE category = $1', [category.name]);
    const countResult = countRows[0];

    if (countResult.count > 0) {
      return res.status(400).json({ error: `Cannot delete category with ${countResult.count} product(s). Reassign products first.` });
    }

    await pool.query('DELETE FROM categories WHERE id = $1', [categoryId]);
    logActivity(req, 'delete', 'category', parseInt(categoryId), category, null);
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Reorder categories
app.post('/api/categories/reorder', authenticateTokenWithSession, async (req, res) => {
  const { categoryOrders } = req.body; // Array of { id, sort_order }

  if (!Array.isArray(categoryOrders)) {
    return res.status(400).json({ error: 'categoryOrders array is required' });
  }

  try {
    let completed = 0;
    const errors = [];

    for (const order of categoryOrders) {
      await pool.query(
        'UPDATE categories SET sort_order = $1 WHERE id = $2',
        [order.sort_order || completed, order.id]
      );
      completed++;
    }

    if (errors.length > 0) {
      return res.status(500).json({ error: errors.join(', ') });
    }
    res.json({ message: 'Categories reordered successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==================== REVIEWS API ====================

// Get all reviews (public)
app.get('/api/reviews', async (req, res) => {
  try {
    const { active } = req.query;
    let query = 'SELECT * FROM reviews';
    const params = [];

    if (active === 'true') {
      query += ' WHERE is_active = true';
    }

    query += ' ORDER BY sort_order ASC, created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get single review
app.get('/api/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM reviews WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Create review
app.post('/api/reviews', authenticateTokenWithSession, async (req, res) => {
  const { name, location, rating, text, is_verified, avatar, sort_order, is_active } = req.body;

  if (!name || !text) {
    return res.status(400).json({ error: 'Name and review text are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO reviews (name, location, rating, text, is_verified, avatar, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, location || null, rating || 5, text, is_verified !== undefined ? is_verified : true, avatar || name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2), sort_order || 0, is_active !== undefined ? is_active : true]
    );
    const newReview = result.rows[0];
    logActivity(req, 'create', 'review', newReview.id, null, newReview);
    res.json(newReview);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Update review
app.put('/api/reviews/:id', authenticateTokenWithSession, async (req, res) => {
  const { id } = req.params;
  const { name, location, rating, text, is_verified, avatar, sort_order, is_active } = req.body;

  try {
    const result = await pool.query(
      `UPDATE reviews
       SET name = $1, location = $2, rating = $3, text = $4, is_verified = $5, avatar = $6, sort_order = $7, is_active = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [name, location, rating, text, is_verified, avatar, sort_order, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const updatedReview = result.rows[0];
    logActivity(req, 'update', 'review', parseInt(id), null, updatedReview);
    res.json(updatedReview);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete review
app.delete('/api/reviews/:id', authenticateTokenWithSession, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM reviews WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    logActivity(req, 'delete', 'review', parseInt(id), result.rows[0], null);
    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==================== SETTINGS API ====================

// Public endpoint - Get all settings (no auth required for public frontend)
app.get('/api/site', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err.message);
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get all settings as key-value object (admin only)
app.get('/api/settings', authenticateTokenWithSession, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err.message);
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings (bulk)
app.put('/api/settings', authenticateTokenWithSession, async (req, res) => {
  const updates = req.body; // Expecting { key: value, ... }

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Settings object is required' });
  }

  try {
    // Get old settings for logging
    const { rows } = await pool.query('SELECT key, value FROM settings');
    const oldSettings = {};
    rows.forEach(row => {
      oldSettings[row.key] = row.value;
    });

    let completed = 0;
    const errors = [];
    const keys = Object.keys(updates);

    if (keys.length === 0) {
      return res.status(400).json({ error: 'No settings to update' });
    }

    for (const key of keys) {
      const value = String(updates[key]);
      try {
        await pool.query(
          'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
          [key, value]
        );
        completed++;
      } catch (err) {
        errors.push(`${key}: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      return res.status(500).json({ error: errors.join(', ') });
    }

    // Log each changed setting
    for (const key of keys) {
      if (oldSettings[key] !== updates[key]) {
        logActivity(req, 'update', 'setting', null, { [key]: oldSettings[key] }, { [key]: updates[key] });
      }
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==================== SETTINGS API - SYSTEM ====================

// Upload logo or favicon
app.post('/api/settings/upload-logo', authenticateTokenWithSession, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const type = req.body.type || 'logo';
  const image = getImagePath(req.file);

  // Update settings with the file path
  try {
    await pool.query(
      'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
      [type, image]
    );
    logActivity(req, 'update', 'setting', null, null, { [type]: image });
    res.json({ [type]: image, message: `${type} uploaded successfully` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get system status info
app.get('/api/settings/system-status', authenticateTokenWithSession, async (req, res) => {
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
  try {
    const sessionResult = await pool.query('SELECT COUNT(*) as count FROM sessions WHERE expires_at > NOW()');

    // Get server start time (approximate)
    const uptime = process.uptime();
    const uptimeDays = Math.floor(uptime / 86400);
    const uptimeHours = Math.floor((uptime % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);

    // Get PostgreSQL version
    const versionResult = await pool.query('SELECT version()');

    // Get product count
    const productResult = await pool.query('SELECT COUNT(*) as count FROM products');

    res.json({
      database_size: dbSize,
      database_size_formatted: formatBytes(dbSize),
      uploads_size: uploadsSize,
      uploads_size_formatted: formatBytes(uploadsSize),
      active_sessions: sessionResult.rows[0].count,
      uptime_seconds: Math.floor(uptime),
      uptime_formatted: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`,
      sqlite_version: versionResult.rows[0].version, // Note: This will be PostgreSQL version, not SQLite
      node_version: process.version,
      product_count: productResult.rows[0].count
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
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
app.get('/api/activity-logs', authenticateTokenWithSession, async (req, res) => {
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

  let paramIndex = 1;
  if (user_id) {
    conditions.push(`al.user_id = $${paramIndex}`);
    params.push(parseInt(user_id));
    paramIndex++;
  }
  if (action) {
    conditions.push(`al.action = $${paramIndex}`);
    params.push(action);
    paramIndex++;
  }
  if (entity_type) {
    conditions.push(`al.entity_type = $${paramIndex}`);
    params.push(entity_type);
    paramIndex++;
  }
  if (dateFrom) {
    conditions.push(`al.created_at >= $${paramIndex}`);
    params.push(dateFrom);
    paramIndex++;
  }
  if (dateTo) {
    conditions.push(`al.created_at <= $${paramIndex}`);
    params.push(dateTo);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  let countQuery = `SELECT COUNT(*) as total FROM activity_logs al`;
  if (whereClause) {
    countQuery += ` ${whereClause}`;
  }
  const countResult = await new Promise((resolve, reject) => {
    pool.query(countQuery, params, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.rows[0]);
      }
    });
  });
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
       LIMIT $1 OFFSET $2
     `;

  // Add limit and offset to params for the query
  const queryParams = [...params, limitInt, offset];
  const dataResult = await new Promise((resolve, reject) => {
    pool.query(dataQuery, queryParams, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });

  const logs = dataResult.rows.map(row => ({
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

// Export activity logs to CSV
app.get('/api/activity-logs/export', authenticateTokenWithSession, async (req, res) => {
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

  const exportResult = await new Promise((resolve, reject) => {
    pool.query(query, params, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });

  const rows = exportResult.rows;

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

// Cleanup old activity logs
app.delete('/api/activity-logs/cleanup', authenticateTokenWithSession, async (req, res) => {
  const days = parseInt(req.query.days) || 90;
  const deleteResult = await new Promise((resolve, reject) => {
    pool.query(
      `DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '${days} days'`,
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }
    );
  });

  res.json({
    message: `Deleted ${deleteResult.rowCount} old log entries`,
    deletedCount: deleteResult.rowCount
  });
});

// ==================== MEDIA API ====================

// Get all media (from media table, products, and local uploads)
app.get('/api/media', authenticateTokenWithSession, async (req, res) => {
  const uniqueImages = new Map();

  // 1. Get images from media table (uploaded directly to media library)
  const mediaFromDb = await new Promise((resolve, reject) => {
    pool.query('SELECT * FROM media ORDER BY uploaded_at DESC', (err, result) => {
      if (err) {
        console.error('Error fetching media from DB:', err);
        resolve([]);
      } else {
        resolve(result.rows || []);
      }
    });
  });

  mediaFromDb.forEach(row => {
    uniqueImages.set(row.path, {
      id: row.id,
      filename: row.filename,
      path: row.path,
      size: row.size,
      size_formatted: formatBytes(row.size),
      uploaded_at: row.uploaded_at,
      product_count: 0
    });
  });

  // 2. Get images from products (that might not be in media table)
  const mediaFromProducts = await new Promise((resolve, reject) => {
    pool.query("SELECT DISTINCT image, created_at FROM products WHERE image IS NOT NULL AND image != '' ORDER BY created_at DESC", (err, result) => {
      if (err) {
        console.error('Error fetching media from products:', err);
        resolve([]);
      } else {
        resolve(result.rows || []);
      }
    });
  });

  let productImageCounter = 10000;
  const uniqueProductImages = new Map();
  mediaFromProducts.forEach(row => {
    if (row.image && !uniqueProductImages.has(row.image)) {
      uniqueProductImages.set(row.image, {
        id: productImageCounter++,
        filename: row.image.split('/').pop(),
        path: row.image,
        size: 0,
        size_formatted: 'S3',
        uploaded_at: row.created_at,
        product_count: 1
      });
    }
  });

  // Merge into uniqueImages (media table images take precedence)
  uniqueProductImages.forEach((value, key) => {
    if (!uniqueImages.has(key)) {
      uniqueImages.set(key, value);
    }
  });

  // 3. Get images from local uploads folder (if not using S3)
  if (!isS3Configured()) {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const localFiles = await new Promise((resolve) => {
        fs.readdir(uploadsDir, (err, files) => {
          if (err || !files) {
            resolve([]);
          } else {
            resolve(files);
          }
        });
      });

      localFiles.forEach(filename => {
        const ext = path.extname(filename).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
          const filePath = path.join(uploadsDir, filename);
          const stats = fs.statSync(filePath);
          const localPath = `/uploads/${filename}`;
          if (!uniqueImages.has(localPath)) {
            uniqueImages.set(localPath, {
              filename,
              path: localPath,
              size: stats.size,
              size_formatted: formatBytes(stats.size),
              uploaded_at: stats.mtime.toISOString(),
              product_count: 0
            });
          }
        }
      });
    }
  }

  // Get product counts for each image
  const finalList = await Promise.all(
    Array.from(uniqueImages.values()).map(async (media) => {
      const productCount = await new Promise((resolve, reject) => {
        pool.query('SELECT COUNT(*) as count FROM products WHERE image = $1', [media.path], (err, result) => {
          if (err) {
            console.error('Error counting products for image:', err);
            resolve(0);
          } else {
            resolve(result.rows[0]?.count || 0);
          }
        });
      });
      return { ...media, product_count: productCount };
    })
  );

  res.json(finalList);
});

// Delete media file
app.delete('/api/media/:id', authenticateTokenWithSession, async (req, res) => {
  const id = parseInt(req.params.id);

  // Check if this is a product image (ID >= 10000)
  if (id >= 10000) {
    // Get all distinct product images
    const rows = await new Promise((resolve, reject) => {
      pool.query("SELECT DISTINCT image FROM products WHERE image IS NOT NULL AND image != '' ORDER BY created_at", (err, result) => {
        if (err) {
          console.error('Error fetching distinct product images:', err);
          reject(err);
        } else {
          resolve(result.rows || []);
        }
      });
    });

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Calculate the index from ID
    const index = id - 10000;

    // Build unique images map like in GET
    const uniqueImages = new Map();
    rows.forEach(row => {
      if (row.image) {
        uniqueImages.set(row.image, true);
      }
    });

    const imagesList = Array.from(uniqueImages.keys());

    if (index < 0 || index >= imagesList.length) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const imagePath = imagesList[index];
    if (!imagePath) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Check if other products use this image
    const productCountResult = await new Promise((resolve, reject) => {
      pool.query('SELECT COUNT(*) as count FROM products WHERE image = $1', [imagePath], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.rows[0]);
        }
      });
    });

    if (productCountResult && productCountResult.count > 0) {
      return res.status(400).json({ error: `Cannot delete image used by ${productCountResult.count} product(s). Remove from products first.` });
    }

    // Update the product to remove this image
    await new Promise((resolve, reject) => {
      pool.query("UPDATE products SET image = NULL WHERE image = $1", [imagePath], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });

    res.json({ message: 'Media deleted successfully' });
    return;
  }

  // Media from media table
  const mediaResult = await new Promise((resolve, reject) => {
    pool.query('SELECT * FROM media WHERE id = $1', [id], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.rows[0]);
      }
    });
  });

  if (!mediaResult) {
    return res.status(404).json({ error: 'Media not found' });
  }

  const media = mediaResult;

  // Check if file is used by any product
  const productCountResult = await new Promise((resolve, reject) => {
    pool.query('SELECT COUNT(*) as count FROM products WHERE image = $1', [media.path], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.rows[0]);
      }
    });
  });

  if (productCountResult && productCountResult.count > 0) {
    return res.status(400).json({ error: `Cannot delete image used by ${productCountResult.count} product(s). Remove from products first.` });
  }

  // Delete from media table
  await new Promise((resolve, reject) => {
    pool.query('DELETE FROM media WHERE id = $1', [id], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });

  if (!media.path.startsWith('http')) {
    const filePath = path.join(__dirname, 'uploads', media.filename);
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        console.error('Error deleting local file:', err);
      }
    });
  }

  logActivity(req, 'delete', 'media', null, { filename: media.filename, path: media.path }, null);
  res.json({ message: 'Media deleted successfully' });
});

// Upload media (bulk) - using the shared upload config
app.post('/api/media/upload', authenticateTokenWithSession, (req, res) => {
  upload.array('images', 10)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Save to database and return saved records
    const uploadedFiles = [];

    for (const file of req.files) {
      let filePath;
      if (isS3Configured() && isSupabase() && file.key) {
        const endpoint = process.env.AWS_S3_ENDPOINT_URL;
        const projectId = endpoint?.split('.')[0]?.replace('https://', '') || 'mhjxymdsjgtlikmjdiqk';
        const s3Bucket = process.env.BUCKET_NAME || process.env.AWS_STORAGE_BUCKET_NAME || 'luxe-looks-bucket';
        filePath = `https://${projectId}.supabase.co/storage/v1/object/public/${s3Bucket}/${file.key}`;
      } else if (isS3Configured() && file.location) {
        filePath = file.location;
      } else {
        filePath = `/uploads/${file.filename}`;
      }

      const filename = file.key || file.filename;

      // Insert into media table
      const result = await new Promise((resolve, reject) => {
        pool.query(
          'INSERT INTO media (filename, path, size, uploaded_at) VALUES ($1, $2, $3, $4) RETURNING *',
          [filename, filePath, file.size, new Date().toISOString()],
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          }
        );
      });

      uploadedFiles.push({
        id: result.rows[0].id,
        filename: filename,
        path: filePath,
        size: file.size,
        size_formatted: formatBytes(file.size),
        uploaded_at: result.rows[0].uploaded_at
      });
    }

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
      pool.query('SELECT COUNT(*) as count FROM products WHERE image = $1', [imagePath], (err, result) => {
        if (!err && (!result.rows[0] || result.rows[0].count === 0)) {
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

// Serve admin client SPA - check authentication
const checkAdminAuth = (req, res, next) => {
  next(); // Let frontend handle routing protection
};

app.use('/admin', checkAdminAuth);

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ==================== PRODUCTION IMPROVEMENTS ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  pool.end(() => {
    console.log('Database connections closed');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const isProduction = process.env.NODE_ENV === 'production';
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
  console.log(`API: http://localhost:${PORT}/api`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
});

module.exports = app;
  console.log(`API endpoint: http://localhost:${PORT}/api/products`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
