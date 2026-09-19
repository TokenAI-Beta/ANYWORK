// SQLite 打开与建表（node:sqlite 内建，零依赖）
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export function defaultDataDir(): string {
  return process.env.DESK_DATA ?? join(homedir(), 'desk-data')
}

export function openDb(path?: string): DatabaseSync {
  const file = path ?? join(defaultDataDir(), 'desk.db')
  mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL;')
  migrate(db)
  return db
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'active',
      password_hash TEXT,
      agent_port INTEGER,
      workspace TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE,
      prefix TEXT NOT NULL,
      label TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      ts TEXT NOT NULL DEFAULT (datetime('now')),
      model TEXT,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      cache_hit_tokens INTEGER NOT NULL DEFAULT 0,
      cache_miss_tokens INTEGER NOT NULL DEFAULT 0,
      estimated INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ok',
      usage_json TEXT
    );

    CREATE TABLE IF NOT EXISTS login_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_usage_user_ts ON usage_events(user_id, ts);
    CREATE INDEX IF NOT EXISTS idx_keys_hash ON api_keys(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_hash ON login_sessions(token_hash);
  `)

  // 增量列：SQLite 没有 ADD COLUMN IF NOT EXISTS，先查再加
  const cols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
  if (!cols.some((c) => c.name === 'monthly_budget_cny')) {
    db.exec('ALTER TABLE users ADD COLUMN monthly_budget_cny REAL')
  }
}
