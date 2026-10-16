const Database = require("better-sqlite3");
const path = require("node:path");
const fs = require("node:fs");

const databaseFile = process.env.DATABASE_FILE || "./data/support-desk.db";
const resolvedFile = path.resolve(databaseFile);
fs.mkdirSync(path.dirname(resolvedFile), { recursive: true });

const database = new Database(resolvedFile);
database.pragma("foreign_keys = ON");
database.pragma("journal_mode = WAL");
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    requester TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const ticketColumns = database.prepare("PRAGMA table_info(tickets)").all();
const userIdColumn = ticketColumns.find((column) => column.name === "user_id");
if (userIdColumn && userIdColumn.notnull) {
  database.pragma("foreign_keys = OFF");
  database.exec(`
    ALTER TABLE tickets RENAME TO tickets_with_user_ownership;
    CREATE TABLE tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      requester TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    INSERT INTO tickets (id, user_id, title, requester, category, priority, description, status, created_at)
      SELECT id, user_id, title, requester, category, priority, description, status, created_at
      FROM tickets_with_user_ownership;
    DROP TABLE tickets_with_user_ownership;
  `);
  database.pragma("foreign_keys = ON");
}

module.exports = database;
