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

    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT,
      models TEXT NOT NULL DEFAULT '[]',
      prices TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notify_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      kind TEXT NOT NULL,
      target TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notify_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL DEFAULT (datetime('now')),
      route_id INTEGER,
      route_name TEXT,
      title TEXT,
      text TEXT,
      ok INTEGER NOT NULL DEFAULT 0,
      info TEXT
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at_epoch INTEGER NOT NULL,
      title TEXT,
      text TEXT NOT NULL,
      source TEXT,
      sent INTEGER NOT NULL DEFAULT 0,
      sent_at TEXT,
      info TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budget_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      level INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, month, level)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      body TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      assignee TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS session_del_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      session_id TEXT NOT NULL,
      title TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      decided_by TEXT,
      decided_at TEXT
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
  const ecols = db.prepare('PRAGMA table_info(usage_events)').all() as { name: string }[]
  if (!ecols.some((c) => c.name === 'channel')) {
    db.exec('ALTER TABLE usage_events ADD COLUMN channel TEXT')
  }
  if (!ecols.some((c) => c.name === 'cost_cny')) {
    db.exec('ALTER TABLE usage_events ADD COLUMN cost_cny REAL')
  }
  // 任务评审闭环（2026-09-22）：提交/验收字段，增量列
  const tcols = db.prepare('PRAGMA table_info(tasks)').all() as { name: string }[]
  const addTaskCol = (name: string, ddl: string) => {
    if (!tcols.some((c) => c.name === name)) db.exec(`ALTER TABLE tasks ADD COLUMN ${ddl}`)
  }
  addTaskCol('review_state', `review_state TEXT NOT NULL DEFAULT 'none'`)
  addTaskCol('submitted_by', 'submitted_by TEXT')
  addTaskCol('submitted_at', 'submitted_at TEXT')
  addTaskCol('submit_note', 'submit_note TEXT')
  addTaskCol('commit_refs', 'commit_refs TEXT')
  addTaskCol('session_refs', 'session_refs TEXT')
  addTaskCol('reviewed_by', 'reviewed_by TEXT')
  addTaskCol('reviewed_at', 'reviewed_at TEXT')
  addTaskCol('review_note', 'review_note TEXT')
}
