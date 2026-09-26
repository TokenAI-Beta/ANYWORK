// 实例模型清单同步：把「已启用通道」的模型并入各实例 settings.yaml 的 llm-deepseek.models。
// 背景：工作区「模型选择」的数据源 = 各实例自己的 settings.yaml（不是网关的动态 /models 列表）；
// 通道变更后必须（1）写入清单（2）重启实例，模型才会出现在成员的选择器里。
// 原则：只增删「由本同步管理」的条目（记录于 ~/.desk/run/<u>.models-added.json），绝不触碰手动添加的模型。
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { DatabaseSync } from 'node:sqlite'
import { listChannels } from './channel.ts'
import { userHome } from './session-mgr.ts'

/** 已启用通道的模型 id（按通道顺序去重） */
export function enabledChannelModels(db: DatabaseSync): string[] {
  const out: string[] = []
  for (const c of listChannels(db)) {
    if (c.enabled !== 1) continue
    for (const m of c.models) if (m && !out.includes(m)) out.push(m)
  }
  return out
}

function sidecarPath(username: string): string {
  return join(homedir(), '.desk', 'run', username + '.models-added.json')
}

export function readManaged(username: string): string[] {
  try {
    const v = JSON.parse(readFileSync(sidecarPath(username), 'utf8')) as unknown
    return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeManaged(username: string, ids: string[]): void {
  try {
    writeFileSync(sidecarPath(username), JSON.stringify(ids), { mode: 0o600 })
  } catch {
    /* ignore */
  }
}

/** 定位 llm-deepseek.models 块。返回现有 id、插入位置与各条目的行区间（0-based，[start,end)）。 */
function locateModels(lines: string[]): { ids: string[]; insertAt: number; items: Array<{ id: string; start: number; end: number }>; needsKey?: boolean } | null {
  let top = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^llm-deepseek:/.test(lines[i])) { top = i; break }
  }
  if (top < 0) return null
  let blockEnd = lines.length
  for (let i = top + 1; i < lines.length; i++) {
    const ln = lines[i]
    if (ln.trim() === '') continue
    if (/^[^ ]/.test(ln)) { blockEnd = i; break }
  }
  let models = -1
  for (let i = top + 1; i < blockEnd; i++) {
    if (/^ {2}models:\s*$/.test(lines[i])) { models = i; break }
  }
  if (models < 0) return { ids: [], insertAt: blockEnd, items: [], needsKey: true }
  const starts: Array<{ id: string; start: number }> = []
  let insertAt = models + 1
  for (let i = models + 1; i < blockEnd; i++) {
    const m = /^ {4}- id:\s*(\S+)\s*$/.exec(lines[i])
    if (m) { starts.push({ id: m[1], start: i }); insertAt = i + 1; continue }
    if (starts.length > 0 && /^ {6,}/.test(lines[i])) { insertAt = i + 1; continue }
    if (lines[i].trim() === '') continue
    break
  }
  const items = starts.map((s, k) => ({ id: s.id, start: s.start, end: k + 1 < starts.length ? starts[k + 1].start : insertAt }))
  return { ids: starts.map((s) => s.id), insertAt, items }
}

/** 同步单个实例，返回 'changed' | 'none' | 'error' */
export function syncOne(username: string, channelIds: string[]): 'changed' | 'none' | 'error' {
  const sf = join(userHome(username), 'settings.yaml')
  if (!existsSync(sf)) return 'none'
  let text: string
  try {
    text = readFileSync(sf, 'utf8')
  } catch {
    return 'error'
  }
  let lines = text.split('\n')
  let loc = locateModels(lines)
  if (!loc) return 'none'
  const managed = readManaged(username)
  const add = channelIds.filter((id) => !loc.ids.includes(id))
  const rm = managed.filter((id) => !channelIds.includes(id) && loc.ids.includes(id))
  if (add.length === 0 && rm.length === 0) return 'none'
  // 1) 删除（按行号降序）
  if (rm.length > 0) {
    const ranges = loc.items.filter((r) => rm.includes(r.id)).sort((a, b) => b.start - a.start)
    for (const r of ranges) lines = lines.slice(0, r.start).concat(lines.slice(r.end))
    loc = locateModels(lines)
    if (!loc) return 'error'
  }
  // 2) 插入（保持通道顺序；若原本没有 models 键则先补建，防 YAML 破损）
  if (add.length > 0) {
    const block: string[] = []
    if (loc.needsKey) block.push('  models:')
    for (const id of add) block.push('    - id: ' + id, '      name: ' + id)
    lines = lines.slice(0, loc.insertAt).concat(block, lines.slice(loc.insertAt))
  }
  try {
    writeFileSync(sf, lines.join('\n'))
  } catch {
    return 'error'
  }
  const newManaged = channelIds.filter((id) => managed.includes(id) || add.includes(id))
  writeManaged(username, newManaged)
  return 'changed'
}

/** 同步全部实例；返回发生变化的用户名列表 */
export function syncInstanceModels(db: DatabaseSync): string[] {
  const channelIds = enabledChannelModels(db)
  const users = db.prepare(`SELECT username FROM users WHERE status = 'active' ORDER BY id`).all() as Array<{ username: string }>
  const changed: string[] = []
  for (const u of users) {
    if (syncOne(u.username, channelIds) === 'changed') changed.push(u.username)
  }
  return changed
}
