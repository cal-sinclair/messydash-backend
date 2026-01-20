import Database, { Database as DatabaseType } from 'better-sqlite3';
import { config } from '../config.js';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

// Ensure data directory exists
const dbDir = dirname(config.DATABASE_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Initialize database
export const db: DatabaseType = new Database(config.DATABASE_PATH);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Run schema migrations - schema is embedded as string to avoid path issues
const schema = `
-- Contacts table: stores synced contacts per API key
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    number TEXT NOT NULL,
    synced_at TEXT DEFAULT (datetime('now')),
    UNIQUE(api_key_hash, number)
);

-- Message queue: stores pending outbound messages when phone is offline
CREATE TABLE IF NOT EXISTS message_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_hash TEXT NOT NULL,
    message_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_api_key ON contacts(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_contacts_number ON contacts(api_key_hash, number);
CREATE INDEX IF NOT EXISTS idx_queue_status ON message_queue(status, api_key_hash);
`;
// Execute the schema directly - SQLite handles multiple statements
db.exec(schema);

console.log('✅ Database initialized at', config.DATABASE_PATH);

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});
