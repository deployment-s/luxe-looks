/**
 * Migration: Add SEO fields to products table
 * Fields: meta_title, meta_description
 */

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./luxe_looks.db');

console.log('Adding SEO columns to products table...');

db.serialize(() => {
  // Add meta_title column if it doesn't exist
  db.run(`ALTER TABLE products ADD COLUMN meta_title TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('✓ meta_title column already exists');
      } else {
        console.error('Error adding meta_title column:', err.message);
      }
    } else {
      console.log('✓ Added meta_title column');
    }
  });

  // Add meta_description column if it doesn't exist
  db.run(`ALTER TABLE products ADD COLUMN meta_description TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('✓ meta_description column already exists');
      } else {
        console.error('Error adding meta_description column:', err.message);
      }
    } else {
      console.log('✓ Added meta_description column');
    }

    // Show final schema
    db.all(`PRAGMA table_info(products)`, (err, rows) => {
      if (err) {
        console.error('Error fetching schema:', err.message);
      } else {
        console.log('\nCurrent products table schema:');
        rows.forEach(row => {
          console.log(`${row.name} ${row.type}${row.notnull ? ' NOT NULL' : ''}${row.dflt_value ? ' DEFAULT ' + JSON.stringify(row.dflt_value) : ''}`);
        });
      }
      db.close();
    });
  });
});
