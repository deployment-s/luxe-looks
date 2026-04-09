#!/usr/bin/env node

/**
 * Initialize Admin User
 *
 * Run: node init-admin.js
 *
 * This will create the first admin user in the database.
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const DB_PATH = './luxe_looks.db';

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdmin() {
  try {
    console.log('\n=================================');
    console.log('   Luxe Looks Admin Setup');
    console.log('=================================\n');

    const username = await question('Enter admin username: ');
    const password = await question('Enter admin password: ');
    const confirm = await question('Confirm password: ');

    if (password !== confirm) {
      console.log('\n❌ Passwords do not match!');
      rl.close();
      return;
    }

    if (password.length < 6) {
      console.log('\n❌ Password must be at least 6 characters!');
      rl.close();
      return;
    }

    // Connect to database
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('\n❌ Failed to connect to database:', err.message);
        rl.close();
        return;
      }
    });

    // Wait for database connection
    await new Promise(resolve => {
      db.once('open', resolve);
    });

    // Create users table if it doesn't exist
    await new Promise((resolve, reject) => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert admin user
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [username, hashedPassword],
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              console.log('\n❌ Username already exists!');
            } else {
              console.log('\n❌ Error:', err.message);
            }
            reject(err);
          } else {
            console.log('\n✅ Admin account created successfully!');
            console.log(`   Username: ${username}`);
            console.log(`   User ID: ${this.lastID}`);
            resolve();
          }
        }
      );
    });

    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      }
      rl.close();
    });

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
    rl.close();
  }
}

createAdmin();
