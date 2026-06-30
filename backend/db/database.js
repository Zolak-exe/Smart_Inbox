import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production, main.js sets DATABASE_URL to ~/.config/aegis-inbox/mail_tracker.db
const dbPath = process.env.DATABASE_URL || path.join(__dirname, '../data', 'mail_tracker.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    // ─── 1. CREATE TABLES (toutes en premier, sans dépendances entre elles) ──
    db.run(`
      CREATE TABLE IF NOT EXISTS email_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        imap_host TEXT NOT NULL,
        imap_port TEXT NOT NULL DEFAULT '993',
        imap_user TEXT NOT NULL,
        imap_password TEXT NOT NULL,
        imap_tls TEXT NOT NULL DEFAULT 'true',
        is_active INTEGER DEFAULT 1,
        last_sync TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS job_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT NOT NULL,
        position TEXT NOT NULL,
        location TEXT,
        date_applied TEXT,
        status TEXT CHECK( status IN ('en cours', 'entretien', 'refusé', 'accepté') ) DEFAULT 'en cours',
        notes TEXT,
        link_to_offer TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS spam_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL UNIQUE,
        pattern_type TEXT NOT NULL DEFAULT 'domain',
        label TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS app_config (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        account_id INTEGER,
        uid INTEGER,
        sender TEXT,
        recipient TEXT,
        subject TEXT,
        body TEXT,
        date TEXT,
        category TEXT DEFAULT 'Autre',
        job_application_id INTEGER,
        ai_explanation TEXT,
        is_read INTEGER DEFAULT 0,
        FOREIGN KEY(account_id) REFERENCES email_accounts(id) ON DELETE CASCADE,
        FOREIGN KEY(job_application_id) REFERENCES job_applications(id) ON DELETE SET NULL
      )
    `);

    // ─── 2. MIGRATIONS (ALTER TABLE — ignore l'erreur si déjà présente) ─────
    db.run('ALTER TABLE email_accounts ADD COLUMN is_alias_of INTEGER', () => {});

    // ─── 3. SEEDS ────────────────────────────────────────────────────────────
    const defaultAccounts = [
      { email: 'clement.noel.28@proton.me', host: '127.0.0.1', port: '1143', user: 'clement.noel.28@proton.me', password: '8BzrrGWiYeoT_fOVrBVk9w', tls: 'false' },
      { email: 'chagamings@gmail.com', host: 'imap.gmail.com', port: '993', user: 'chagamings@gmail.com', password: 'mrswnljzkbwtliwm', tls: 'true' },
      { email: '28.clement.noel@gmail.com', host: 'imap.gmail.com', port: '993', user: '28.clement.noel@gmail.com', password: '2556011@Kk/Aa', tls: 'true' },
      { email: 'clement.noel.alternance@proton.me', host: '127.0.0.1', port: '1143', user: 'clement.noel.alternance@proton.me', password: '8BzrrGWiYeoT_fOVrBVk9w', tls: 'false' }
    ];
    const accStmt = db.prepare('INSERT OR IGNORE INTO email_accounts (email, imap_host, imap_port, imap_user, imap_password, imap_tls) VALUES (?, ?, ?, ?, ?, ?)');
    for (const a of defaultAccounts) accStmt.run(a.email, a.host, a.port, a.user, a.password, a.tls);
    accStmt.finalize();

    const defaultSpamRules = [
      { pattern: 'mym.fans',    type: 'domain', label: 'MYM' },
      { pattern: 'mym.link',    type: 'domain', label: 'MYM' },
      { pattern: 'mymcontent.', type: 'domain', label: 'MYM' },
    ];
    const spamStmt = db.prepare('INSERT OR IGNORE INTO spam_rules (pattern, pattern_type, label) VALUES (?, ?, ?)');
    for (const r of defaultSpamRules) spamStmt.run(r.pattern, r.type, r.label);
    spamStmt.finalize();

    const defaultConfig = [
      { key: 'ai_enabled', value: 'false' },
      { key: 'ai_model',   value: 'qwen2.5:1.5b' }
    ];
    const cfgStmt = db.prepare('INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)');
    for (const c of defaultConfig) cfgStmt.run(c.key, c.value);
    cfgStmt.finalize();

    // ─── 4. POST-SEED : marquer les alias + ré-attribuer les emails ─────────
    // (s'exécute après les seeds grâce au serialize)
    db.run(`
      UPDATE email_accounts
      SET is_alias_of = (SELECT id FROM email_accounts WHERE email = 'clement.noel.28@proton.me')
      WHERE email = 'clement.noel.alternance@proton.me'
        AND is_alias_of IS NULL
    `, () => {});

    db.run(`
      UPDATE emails
      SET account_id = (
        SELECT ea.id FROM email_accounts ea
        WHERE LOWER(ea.email) = LOWER(emails.recipient)
          AND ea.is_alias_of IS NOT NULL
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1 FROM email_accounts ea
        WHERE LOWER(ea.email) = LOWER(emails.recipient)
          AND ea.is_alias_of IS NOT NULL
      )
    `, (err) => {
      if (err) console.error('[DB migration] UPDATE emails alias échec :', err.message);
      else console.log('[DB migration] Alias migration OK');
    });
  });
}

// Promisified database operations helper functions
export const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export { dbPath };
export default db;
