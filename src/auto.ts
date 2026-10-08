// 自动化（automations / auto_log）——数据层 + 校验 + 下次执行时间
// 计划时间一律按北京时间（UTC+8）计算，与容器时区无关
import type { DatabaseSync } from 'node:sqlite'

export type AutoViewer = { username: string; role: string }

export type AutoRow = {
  id: number
  owner: string
  scope: string
  name: string
  type: string
  schedule: string | null
  trigger: string | null
  action: string
  enabled: number
  created_at: string
  last_run_at: string | null
  last_result: string | null
  next_run_at: number | null
  runs: number
}

// 内置触发规则目录（团队级；执行侧接线在 server 调度器里）
export const RULE_CATALOG = [
  { key: 'task_review', zh: '任务提交验收 → 通知创建人', en: 'Task submitted for review → notify creator' },
  { key: 'budget80', zh: '本月用量到 80% → 提醒管理员', en: 'Monthly usage reaches 80% → alert admin' },
  { key: 'session_del', zh: '会话删除申请 → 通知管理员', en: 'Session deletion request → notify admin' },
  { key: 'feedback', zh: '新意见反馈 → 通知管理员', en: 'New feedback → notify admin' },
] as const

export const AUTO_LIMIT_PER_USER = 20

/** 解析并规范化 'daily:HH:MM' / 'weekly:D:HH:MM'（D：1=周一…7=周日）；非法返回 null */
export function normalizeSchedule(raw: string): string | null {
  const s = String(raw ?? '').trim()
  let m = /^daily:(\d{1,2}):(\d{2})$/.exec(s)
  if (m) {
    const h = Number(m[1])
    const min = Number(m[2])
    if (h > 23 || min > 59) return null
    return `daily:${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }
  m = /^weekly:([1-7]):(\d{1,2}):(\d{2})$/.exec(s)
  if (m) {
    const d = Number(m[1])
    const h = Number(m[2])
    const min = Number(m[3])
    if (h > 23 || min > 59) return null
    return `weekly:${d}:${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }
  return null
}

/** 下一次触发时刻（epoch 秒，北京时间语义）。非法 schedule 返回 null */
export function computeNextRun(schedule: string, fromMs = Date.now()): number | null {
  const norm = normalizeSchedule(schedule)
  if (!norm) return null
  const shift = 8 * 3600_000
  const bj = new Date(fromMs + shift) // UTC 字段读数 = 北京时间墙钟
  const y = bj.getUTCFullYear()
  const mo = bj.getUTCMonth()
  const da = bj.getUTCDate()
  const md = /^daily:(\d{2}):(\d{2})$/.exec(norm)
  if (md) {
    let t = Date.UTC(y, mo, da, Number(md[1]), Number(md[2]), 0) - shift
    if (t <= fromMs) t += 86400_000
    return Math.floor(t / 1000)
  }
  const mw = /^weekly:([1-7]):(\d{2}):(\d{2})$/.exec(norm)
  if (mw) {
    const target = Number(mw[1]) % 7 // 1=Mon→1 … 7=Sun→0（与 JS getUTCDay 对齐）
    let t = Date.UTC(y, mo, da, Number(mw[2]), Number(mw[3]), 0) - shift
    const cur = new Date(t + shift).getUTCDay()
    t += ((target - cur + 7) % 7) * 86400_000
    if (t <= fromMs) t += 7 * 86400_000
    return Math.floor(t / 1000)
  }
  return null
}

/** action 校验：{kind:'notify', title?, text} 或 {kind:'agent', prompt, assistant?} */
export function validateAction(action: unknown): { ok: true; json: string } | { error: string } {
  if (!action || typeof action !== 'object') return { error: 'action 不合法' }
  const a = action as Record<string, unknown>
  const kind = String(a.kind ?? '')
  if (kind === 'notify') {
    const text = String(a.text ?? '').trim()
    if (!text) return { error: '通知内容不能为空' }
    if (text.length > 2000) return { error: '通知内容过长（≤2000 字）' }
    return { ok: true, json: JSON.stringify({ kind, title: String(a.title ?? '').trim().slice(0, 120), text }) }
  }
  if (kind === 'agent') {
    const prompt = String(a.prompt ?? '').trim()
    if (!prompt) return { error: '任务指令不能为空' }
    if (prompt.length > 4000) return { error: '任务指令过长（≤4000 字）' }
    return { ok: true, json: JSON.stringify({ kind, prompt, assistant: String(a.assistant ?? '').trim().slice(0, 60) }) }
  }
  return { error: 'action.kind 只支持 notify / agent' }
}

/** 种子：把内置规则写进表（存在则不动） */
export function ensureRuleRows(db: DatabaseSync): void {
  const ins = db.prepare(
    `INSERT OR IGNORE INTO automations (owner, scope, name, type, trigger, action, enabled, next_run_at)
     VALUES ('', 'team', ?, 'rule', ?, '{}', 1, NULL)`,
  )
  for (const r of RULE_CATALOG) ins.run(r.zh, r.key)
}

/** 规则开关查询（执行侧用；行缺失视为开启，保持默认行为） */
export function ruleEnabled(db: DatabaseSync, key: string): boolean {
  const row = db.prepare(`SELECT enabled FROM automations WHERE type = 'rule' AND trigger = ? AND scope = 'team'`).get(key) as
    | { enabled: number }
    | undefined
  if (!row) return true
  return row.enabled !== 0
}

/** 可见列表：自己的 + 团队规则 */
export function listAutos(db: DatabaseSync, viewer: AutoViewer): AutoRow[] {
  return db
    .prepare(`SELECT * FROM automations WHERE scope = 'team' OR owner = ? ORDER BY (type = 'timer') DESC, id DESC`)
    .all(viewer.username) as unknown as AutoRow[]
}

export function addTimer(
  db: DatabaseSync,
  owner: string,
  input: { name: string; schedule: string; action: unknown },
): { ok: true; id: number; nextRunAt: number } | { error: string } {
  const name = String(input.name ?? '').trim()
  if (!name || name.length > 40) return { error: '名称不能为空（≤40 字）' }
  const schedule = normalizeSchedule(String(input.schedule ?? ''))
  if (!schedule) return { error: '时间格式不对（daily:HH:MM / weekly:D:HH:MM）' }
  const act = validateAction(input.action)
  if ('error' in act) return { error: act.error }
  const n = (db.prepare(`SELECT COUNT(*) AS c FROM automations WHERE owner = ? AND type = 'timer'`).get(owner) as { c: number }).c
  if (n >= AUTO_LIMIT_PER_USER) return { error: `每人最多 ${AUTO_LIMIT_PER_USER} 条自动化` }
  const next = computeNextRun(schedule)
  const r = db
    .prepare(
      `INSERT INTO automations (owner, scope, name, type, schedule, action, enabled, next_run_at)
       VALUES (?, 'user', ?, 'timer', ?, ?, 1, ?)`,
    )
    .run(owner, name, schedule, act.json, next)
  return { ok: true, id: Number(r.lastInsertRowid), nextRunAt: next ?? 0 }
}

export function removeAuto(db: DatabaseSync, viewer: AutoViewer, id: number): { ok: true } | { error: string } {
  const row = db.prepare(`SELECT * FROM automations WHERE id = ?`).get(id) as AutoRow | undefined
  if (!row) return { error: '不存在' }
  if (row.scope === 'team') return { error: '内置规则不能删除' }
  if (row.owner !== viewer.username && viewer.role !== 'admin') return { error: '只能删自己的自动化' }
  db.prepare(`DELETE FROM automations WHERE id = ?`).run(id)
  return { ok: true }
}

export function toggleAuto(
  db: DatabaseSync,
  viewer: AutoViewer,
  id: number,
): { ok: true; enabled: number; nextRunAt?: number | null } | { error: string } {
  const row = db.prepare(`SELECT * FROM automations WHERE id = ?`).get(id) as AutoRow | undefined
  if (!row) return { error: '不存在' }
  if (row.scope === 'team' && viewer.role !== 'admin') return { error: '团队规则只有管理员能改' }
  if (row.scope === 'user' && row.owner !== viewer.username && viewer.role !== 'admin') return { error: '只能改自己的自动化' }
  const enabled = row.enabled ? 0 : 1
  let nextRunAt: number | null = row.next_run_at
  if (row.type === 'timer') nextRunAt = enabled && row.schedule ? computeNextRun(row.schedule) : null
  db.prepare(`UPDATE automations SET enabled = ?, next_run_at = ? WHERE id = ?`).run(enabled, nextRunAt, id)
  return { ok: true, enabled, nextRunAt }
}

export function listAutoLog(db: DatabaseSync, limit = 20): Record<string, unknown>[] {
  return db.prepare(`SELECT id, auto_id, auto_name, ts, ok, info FROM auto_log ORDER BY id DESC LIMIT ?`).all(limit) as unknown as Record<
    string,
    unknown
  >[]
}

export function autoStats(db: DatabaseSync): { active: number; weekRuns: number; weekFails: number } {
  const active = (db.prepare(`SELECT COUNT(*) AS c FROM automations WHERE enabled = 1`).get() as { c: number }).c
  const weekRuns = (db.prepare(`SELECT COUNT(*) AS c FROM auto_log WHERE ts >= datetime('now', '-7 days')`).get() as { c: number }).c
  const weekFails = (
    db.prepare(`SELECT COUNT(*) AS c FROM auto_log WHERE ts >= datetime('now', '-7 days') AND ok = 0`).get() as { c: number }
  ).c
  return { active, weekRuns, weekFails }
}

/** 执行器回写（server 调度器用） */
export function markAutoRun(db: DatabaseSync, id: number, ok: boolean, info: string, nextRunAt: number | null): void {
  db.prepare(`UPDATE automations SET last_run_at = datetime('now'), last_result = ?, runs = runs + 1, next_run_at = ? WHERE id = ?`).run(
    ok ? `ok ${info}`.slice(0, 300) : `fail ${info}`.slice(0, 300),
    nextRunAt,
    id,
  )
  db.prepare(`INSERT INTO auto_log (auto_id, auto_name, ok, info) SELECT id, name, ?, ? FROM automations WHERE id = ?`).run(
    ok ? 1 : 0,
    String(info).slice(0, 300),
    id,
  )
}

/** 快捷动作的执行记录（无 auto_id） */
export function logQuickAction(db: DatabaseSync, name: string, ok: boolean, info: string): void {
  db.prepare(`INSERT INTO auto_log (auto_id, auto_name, ok, info) VALUES (NULL, ?, ?, ?)`).run(
    String(name).slice(0, 60),
    ok ? 1 : 0,
    String(info).slice(0, 300),
  )
}

/** 只追加一条执行记录（不增 runs / 不动计划） */
export function appendAutoLog(db: DatabaseSync, id: number, ok: boolean, info: string): void {
  db.prepare(`INSERT INTO auto_log (auto_id, auto_name, ok, info) SELECT id, name, ?, ? FROM automations WHERE id = ?`).run(
    ok ? 1 : 0,
    String(info).slice(0, 300),
    id,
  )
}
