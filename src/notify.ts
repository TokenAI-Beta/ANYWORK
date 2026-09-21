// 通知桥：把消息推给工作台外的渠道（webhook / 通知平台如微信）
// 零依赖：webhook 走全局 fetch；Hermes 走 Windows 侧 CLI（WSL interop 可直接执行）
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { eventCost, monthStartUtc } from './pricing.ts'
import type { DatabaseSync } from 'node:sqlite'

// Hermes CLI（可用 DESK_HERMES_CLI 覆盖；迁移机器时改这里）
const HERMES_CLI = process.env.DESK_HERMES_CLI || '/mnt/d/hermes/hermes-agent/venv/Scripts/hermes.exe'

export interface NotifyRoute {
  id: number
  name: string
  kind: string // 'webhook' | 'hermes'
  target: string
  enabled: number
  created_at: string
}

export interface NotifyMsg {
  title?: string
  text: string
  source?: string
}

export interface NotifyResult {
  route: string
  kind: string
  ok: boolean
  info: string
}

export function listNotifyRoutes(db: DatabaseSync): NotifyRoute[] {
  return db.prepare(`SELECT id, name, kind, target, enabled, created_at FROM notify_routes ORDER BY id`).all() as unknown as NotifyRoute[]
}

export function addNotifyRoute(db: DatabaseSync, r: { name: string; kind: string; target: string }): { ok: true } | { error: string } {
  const name = r.name.trim()
  const kind = r.kind.trim()
  const target = r.target.trim()
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(name)) return { error: '名称请用英文小写（如 wechat-me / wecom-group）' }
  if (kind !== 'webhook' && kind !== 'hermes') return { error: 'kind 只支持 webhook / hermes' }
  if (!target) return { error: '目标不能为空' }
  if (kind === 'webhook' && !/^https?:\/\//.test(target)) return { error: 'webhook 目标需为 http(s):// 开头的 URL' }
  if (db.prepare(`SELECT id FROM notify_routes WHERE name = ?`).get(name)) return { error: '同名通道已存在' }
  db.prepare(`INSERT INTO notify_routes (name, kind, target) VALUES (?, ?, ?)`).run(name, kind, target)
  return { ok: true }
}

export function removeNotifyRoute(db: DatabaseSync, name: string): void {
  db.prepare(`DELETE FROM notify_routes WHERE name = ?`).run(name)
}

export function toggleNotifyRoute(db: DatabaseSync, name: string): void {
  const r = db.prepare(`SELECT enabled FROM notify_routes WHERE name = ?`).get(name) as { enabled: number } | undefined
  if (r) db.prepare(`UPDATE notify_routes SET enabled = ? WHERE name = ?`).run(r.enabled === 1 ? 0 : 1, name)
}

function sendViaWebhook(url: string, msg: NotifyMsg): Promise<string> {
  return new Promise((resolve) => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 12000)
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: msg.title ?? '', text: msg.text, source: msg.source ?? 'workbench', ts: new Date().toISOString() }),
      signal: ctrl.signal,
    })
      .then((r) => r.text().then((b) => resolve(`HTTP ${r.status}${b ? ' ' + b.slice(0, 80) : ''}`)))
      .catch((e) => resolve(`失败：${String((e && (e as Error).message) || e).slice(0, 120)}`))
      .finally(() => clearTimeout(t))
  })
}

function sendViaHermes(target: string, msg: NotifyMsg): Promise<string> {
  return new Promise((resolve) => {
    const text = (msg.title ? `【${msg.title}】\n` : '') + msg.text
    execFile(HERMES_CLI, ['send', '-t', target, '-q', text], { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) {
        resolve(`失败：${String(err.message).slice(0, 140)}${stderr ? ' / ' + String(stderr).slice(0, 80) : ''}`)
        return
      }
      resolve(`ok${stdout ? ' ' + String(stdout).trim().slice(0, 60) : ''}`)
    })
  })
}

// 微信（hermes 通道）偶发失败（CLI 超时/限流/退桌面端抖动）：失败后 45 秒后台重试一次，并回填日志行
const HERMES_RETRY_DELAY_MS = 45_000
function scheduleHermesRetry(db: DatabaseSync, logId: number, target: string, msg: NotifyMsg): void {
  const timer = setTimeout(() => {
    void (async () => {
      try {
        const info = await sendViaHermes(target, msg)
        const ok = !/^(失败|未知)/.test(info)
        if (ok) {
          db.prepare(`UPDATE notify_log SET ok = 1, info = ? WHERE id = ?`).run('ok（45s 重试成功）', logId)
        } else {
          db.prepare(`UPDATE notify_log SET info = ? WHERE id = ?`).run(info.slice(0, 200), logId)
        }
      } catch {
        // 重试本身异常：保持原失败记录
      }
    })()
  }, HERMES_RETRY_DELAY_MS)
  if (typeof timer.unref === 'function') timer.unref()
}

export async function dispatchNotify(db: DatabaseSync, msg: NotifyMsg): Promise<NotifyResult[]> {
  const routes = listNotifyRoutes(db).filter((r) => r.enabled === 1)
  const results: NotifyResult[] = []
  for (const r of routes) {
    const info = r.kind === 'webhook' ? await sendViaWebhook(r.target, msg) : r.kind === 'hermes' ? await sendViaHermes(r.target, msg) : '未知通道类型'
    const ok = !/^(失败|未知)/.test(info)
    const ins = db.prepare(`INSERT INTO notify_log (route_id, route_name, title, text, ok, info) VALUES (?, ?, ?, ?, ?, ?)`).run(
      r.id,
      r.name,
      msg.title ?? '',
      msg.text.slice(0, 500),
      ok ? 1 : 0,
      info,
    )
    if (r.kind === 'hermes' && !ok) scheduleHermesRetry(db, Number(ins.lastInsertRowid), r.target, msg)
    results.push({ route: r.name, kind: r.kind, ok, info })
  }
  if (!routes.length) results.push({ route: '(无启用的通知通道)', kind: '-', ok: false, info: '请先在 设置 →「通知」里添加一个通道' })
  return results
}

export function listNotifyLog(db: DatabaseSync, limit = 10): Record<string, unknown>[] {
  return db.prepare(`SELECT ts, route_name, title, text, ok, info FROM notify_log ORDER BY id DESC LIMIT ?`).all(limit) as unknown as Record<string, unknown>[]
}

// —— 令牌（agent 侧 desk-notify 脚本用；仅本机文件，无外部暴露）——
export function notifyTokenPath(dataDir: string): string {
  return join(dataDir, 'notify.token')
}

export function readOrCreateNotifyToken(dataDir: string): string {
  const p = notifyTokenPath(dataDir)
  try {
    if (existsSync(p)) {
      const t = readFileSync(p, 'utf8').trim()
      if (t) return t
    }
  } catch {
    // 读失败按不存在处理
  }
  const t = randomBytes(24).toString('hex')
  try {
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(p, t + '\n', { mode: 0o600 })
  } catch {
    // 写失败时返回内存令牌（重启后更换）
  }
  return t
}

// —— 定时提醒（到点经通知桥推送）——

export interface Reminder {
  id: number
  at_epoch: number
  title: string | null
  text: string
  source: string | null
  sent: number
  sent_at: string | null
  info: string | null
  created_at: string
}

export function addReminder(
  db: DatabaseSync,
  r: { atEpoch: number; title?: string; text: string; source?: string },
): { ok: true; id: number; atEpoch: number } | { error: string } {
  const at = Math.floor(Number(r.atEpoch))
  if (!Number.isFinite(at) || at < Math.floor(Date.now() / 1000) - 60) return { error: '时间无效或已过去' }
  const text = r.text.trim()
  if (!text) return { error: '内容不能为空' }
  const info = db
    .prepare(`INSERT INTO reminders (at_epoch, title, text, source) VALUES (?, ?, ?, ?)`)
    .run(at, (r.title ?? '').trim() || null, text, r.source ?? null)
  return { ok: true, id: Number(info.lastInsertRowid), atEpoch: at }
}

export function listReminders(db: DatabaseSync): Reminder[] {
  return db.prepare(`SELECT id, at_epoch, title, text, source, sent, sent_at, info, created_at FROM reminders WHERE sent = 0 ORDER BY at_epoch LIMIT 50`).all() as unknown as Reminder[]
}

export function listRemindersSent(db: DatabaseSync, limit = 5): Reminder[] {
  return db.prepare(`SELECT id, at_epoch, title, text, source, sent, sent_at, info, created_at FROM reminders WHERE sent = 1 ORDER BY id DESC LIMIT ?`).all(limit) as unknown as Reminder[]
}

export function removeReminder(db: DatabaseSync, id: number): void {
  db.prepare(`DELETE FROM reminders WHERE id = ?`).run(id)
}

export async function checkReminders(db: DatabaseSync): Promise<number> {
  const due = db
    .prepare(`SELECT id, at_epoch, title, text, source FROM reminders WHERE sent = 0 AND at_epoch <= ? ORDER BY at_epoch`)
    .all(Math.floor(Date.now() / 1000)) as unknown as Reminder[]
  for (const r of due) {
    const results = await dispatchNotify(db, { title: r.title || '到点提醒', text: r.text, source: r.source || 'reminder' })
    const info = results
      .map((x) => `${x.route}:${x.ok ? 'ok' : x.info}`)
      .join('; ')
      .slice(0, 200)
    db.prepare(`UPDATE reminders SET sent = 1, sent_at = datetime('now'), info = ? WHERE id = ?`).run(info, r.id)
  }
  return due.length
}

// —— 预算告警（本月用量跨过 80% / 100% 时经通知桥提醒管理员；每月每档只发一次）——
function fmtCny(n: number): string {
  return n >= 0.01 ? n.toFixed(2) : n.toFixed(6)
}

export async function maybeBudgetAlert(db: DatabaseSync, userId: number): Promise<void> {
  const u = db.prepare(`SELECT username, monthly_budget_cny AS budget FROM users WHERE id = ?`).get(userId) as
    | { username: string; budget: number | null }
    | undefined
  if (!u || u.budget == null || u.budget <= 0) return
  const start = monthStartUtc()
  const rows = db.prepare(`SELECT * FROM usage_events WHERE user_id = ? AND ts >= ?`).all(userId, start) as unknown as Parameters<typeof eventCost>[0][]
  let sum = 0
  for (const r of rows) sum += eventCost(r)
  const pct = sum / u.budget
  const level = pct >= 1 ? 100 : pct >= 0.8 ? 80 : 0
  if (level === 0) return
  const month = start.slice(0, 7)
  const ins = db.prepare(`INSERT OR IGNORE INTO budget_alerts (user_id, month, level) VALUES (?, ?, ?)`).run(userId, month, level)
  if (ins.changes === 0) return
  await dispatchNotify(db, {
    title: '预算提醒',
    text: `成员 ${u.username} 本月用量已到预算的 ${level}%（¥${fmtCny(sum)} / ¥${u.budget}）。`,
    source: 'budget',
  })
}
