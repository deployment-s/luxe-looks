#!/usr/bin/env node

/**
 * Quick Setup - Create admin user and initialize database
 * Run: node setup-db.js
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DB_PATH = './luxe_looks.db';
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'Admin@2024';

async function setup() {
  console.log('\n=================================');
  console.log('   Luxe Looks Database Setup');
  console.log('=================================\n');

  // Connect to database
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('❌ Failed to connect to database:', err.message);
      process.exit(1);
    }
  });

  await new Promise(resolve => db.once('open', resolve));

  console.log('✅ Connected to database');

  // Create tables
  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price TEXT NOT NULL,
        description TEXT,
        image TEXT,
        rating REAL DEFAULT 4.0,
        reviews INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  console.log('✅ Tables created');

  // Check if admin user exists
  const existingAdmin = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [DEFAULT_USERNAME], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (existingAdmin) {
    console.log(`✅ Admin user '${DEFAULT_USERNAME}' already exists (ID: ${existingAdmin.id})`);
  } else {
    // Create default admin
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [DEFAULT_USERNAME, hashedPassword],
        function (err) {
          if (err) reject(err);
          else {
            console.log(`✅ Admin user created:`);
            console.log(`   Username: ${DEFAULT_USERNAME}`);
            console.log(`   Password: ${DEFAULT_PASSWORD}`);
            console.log(`   User ID: ${this.lastID}`);
            resolve();
          }
        }
      );
    });
  }

  // Check if products exist
  const productCount = await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
      if (err) reject(err);
      else resolve(row.count);
    });
  });

  console.log(`✅ Database status:`);
  console.log(`   Users: 1 admin account`);
  console.log(`   Products: ${productCount} product(s)`);

  if (productCount === 0) {
    console.log('\n💡 Tip: Add products via the admin panel at http://localhost:3001/admin');
  }

  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('\n✅ Setup complete!');
      console.log('\nNext steps:');
      console.log('1. Ensure admin server is running: npm start (in admin folder)');
      console.log('2. Open http://localhost:3001/admin in your browser');
      console.log('3. Login with the credentials shown above');
      console.log('\n⚠️  IMPORTANT: Change the default password after first login!');
      console.log('   You can do this by editing the database or adding a password reset feature.\n');
    }
  });
}

setup().catch(console.error);
