/**
 * Migration: Create settings table
 * Simple key-value store for application settings
 */

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./luxe_looks.db');

console.log('Creating settings table...');

db.serialize(() => {
  // Create settings table
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating settings table:', err.message);
    } else {
      console.log('✓ Created settings table');

      // Insert default settings if they don't exist
      const defaultSettings = [
        { key: 'site_name', value: 'Luxe Looks' },
        { key: 'contact_email', value: 'hello@luxelooks.co.ke' },
        { key: 'phone_number', value: '+254 700 000 000' },
        { key: 'logo', value: '' },
        { key: 'favicon', value: '' },
        { key: 'facebook', value: '' },
        { key: 'instagram', value: '' },
        { key: 'whatsapp', value: 'https://chat.whatsapp.com/Gb8xGhuAacOJzY7cuMO5tK' },
        { key: 'session_timeout', value: '1440' },
        { key: 'rate_limit_requests', value: '1000' },
      ];

      const stmt = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
      defaultSettings.forEach(setting => {
        stmt.run(setting.key, setting.value);
      });
      stmt.finalize();

      console.log('✓ Inserted default settings');
    }

    // Show all settings
    db.all(`SELECT * FROM settings`, (err, rows) => {
      if (err) {
        console.error('Error fetching settings:', err.message);
      } else {
        console.log('\nCurrent settings:');
        rows.forEach(row => {
          console.log(`  ${row.key}: ${row.value}`);
        });
      }
      db.close();
    });
  });
});
