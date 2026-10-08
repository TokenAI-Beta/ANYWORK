// 自动化执行器：定时任务到点执行 + 「立即运行」
// - notify 类：直接走通知桥（18 通道）
// - agent 类：在成员实例上开会话下指令；会话跑完后解码会话文件，把助理回复推给通知桥
import type { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'
import { dispatchNotify } from './notify.ts'
import { appendAutoLog, computeNextRun, markAutoRun, type AutoRow, type AutoViewer } from './auto.ts'
import { callInstanceRpc, userHome, userPort } from './session-mgr.ts'
import { instanceAuthCookie } from './instance-auth.ts'

const running = new Set<number>()
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function parseAction(row: AutoRow): Record<string, unknown> {
  try {
    const v = JSON.parse(row.action || '{}') as unknown
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function shortJson(v: unknown): string {
  try {
    return JSON.stringify(v).slice(0, 180)
  } catch {
    return String(v).slice(0, 180)
  }
}

function rpcValue(body: unknown): Record<string, unknown> | undefined {
  const v = (body as { result?: { value?: unknown } } | undefined)?.result?.value
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined
}

function itemsOfLite(body: unknown): { sessionId: string; running: boolean }[] | undefined {
  const items = rpcValue(body)?.['items']
  return Array.isArray(items) ? (items as { sessionId: string; running: boolean }[]) : undefined
}

/** 解码一个会话文件（zstd 多帧）→ 最后一条助理文本 + 是否已收尾（turn/end） */
function decodeSessionText(home: string, sid: string): { text: string; ended: boolean } | null {
  try {
    const sdir = join(home, 'sessions')
    if (!existsSync(sdir)) return null
    let file: string | null = null
    for (const bucket of readdirSync(sdir)) {
      const d = join(sdir, bucket, sid)
      if (!existsSync(d)) continue
      for (const f of readdirSync(d)) if (f.endsWith('.jsonl.zstd')) file = join(d, f)
    }
    if (!file) return null
    const buf = readFileSync(file)
    const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
    const idxs: number[] = []
    let i = buf.indexOf(magic)
    while (i !== -1) {
      idxs.push(i)
      i = buf.indexOf(magic, i + 1)
    }
    let out = Buffer.alloc(0)
    for (let k = 0; k < idxs.length; k++) {
      const end = k + 1 < idxs.length ? idxs[k + 1] : buf.length
      try {
        out = Buffer.concat([out, zstdDecompressSync(buf.subarray(idxs[k], end))])
      } catch {
        // 跳坏帧
      }
    }
    let text = ''
    let ended = false
    for (const line of out.toString('utf8').split('\n')) {
      const t = line.trim()
      if (!t) continue
      let ev: { type?: string; data?: { message?: { content?: unknown } } }
      try {
        ev = JSON.parse(t) as typeof ev
      } catch {
        continue
      }
      if (ev.type === 'assistant/message') {
        const content = ev.data?.message?.content
        if (Array.isArray(content)) {
          const txt = content
            .filter(
              (p) =>
                !!p &&
                typeof p === 'object' &&
                (p as { type?: string }).type === 'text' &&
                typeof (p as { text?: unknown }).text === 'string',
            )
            .map((p) => String((p as { text?: unknown }).text))
            .join('\n')
            .trim()
          if (txt) text = txt
        }
      }
      if (ev.type === 'turn/end') ended = true
      if (ev.type === 'user/message' || ev.type === 'turn/start') {
        ended = false
        text = ''
      }
    }
    return { text, ended }
  } catch {
    return null
  }
}

async function execOnce(db: DatabaseSync, row: AutoRow): Promise<{ ok: boolean; info: string; sid?: string }> {
  const a = parseAction(row)
  const kind = String(a['kind'] ?? '')
  if (kind === 'notify') {
    const text = String(a['text'] ?? '').trim()
    if (!text) return { ok: false, info: '内容为空' }
    const results = await dispatchNotify(db, { title: String(a['title'] ?? '').trim() || row.name, text, source: 'auto' })
    if (results.length === 0) return { ok: false, info: '没有已启用的通知通道' }
    const okN = results.filter((r) => r.ok).length
    const names = results.map((r) => `${r.route}:${r.ok ? 'ok' : 'fail'}`).join('，')
    return { ok: okN > 0, info: `${okN}/${results.length} 通道成功（${names}）`.slice(0, 250) }
  }
  if (kind === 'agent') {
    const promptText = String(a['prompt'] ?? '').trim()
    if (!promptText) return { ok: false, info: '指令为空' }
    const port = userPort(db, row.owner)
    if (!port) return { ok: false, info: `成员 ${row.owner} 未分配实例` }
    const home = userHome(row.owner)
    const authCookie = instanceAuthCookie(home, `127.0.0.1:${port}`)
    const created = await callInstanceRpc(port, authCookie, 'session/create', { args: { request: {} } })
    const sid = String(rpcValue(created.body)?.['sessionId'] ?? '')
    if (!sid) return { ok: false, info: `创建会话失败：${shortJson(created.body)}` }
    const rid = `session-request-${randomUUID()}`
    const pr = await callInstanceRpc(port, authCookie, 'session/prompt', {
      args: {
        request: {
          requestId: rid,
          sessionId: sid,
          mode: 'queue',
          content: [{ type: 'text', text: promptText }],
          clientTimeZone: 'Asia/Shanghai',
        },
      },
    })
    if (rpcValue(pr.body)?.['accepted'] !== true) return { ok: false, info: `下指令失败：${shortJson(pr.body)}` }
    return { ok: true, info: `会话 ${sid} 已开始`, sid }
  }
  return { ok: false, info: `未知 action.kind：${kind || '(空)'}` }
}

/** agent 类跑完后：等会话收尾 → 解码回复 → 推送通知桥 + 记录 */
async function captureAndForward(db: DatabaseSync, row: AutoRow, sid: string): Promise<void> {
  const port = userPort(db, row.owner)
  if (!port) return
  const home = userHome(row.owner)
  const authCookie = instanceAuthCookie(home, `127.0.0.1:${port}`)
  const deadline = Date.now() + 8 * 60_000
  while (Date.now() < deadline) {
    await sleep(10_000)
    try {
      const list = await callInstanceRpc(port, authCookie, 'session/list', { args: { _request: {} } })
      const items = itemsOfLite(list.body)
      const s = items?.find((x) => x.sessionId === sid)
      if (s && s.running === true) continue
      const got = decodeSessionText(home, sid)
      if (got && got.text) {
        const r = await dispatchNotify(db, { title: `自动化《${row.name}》`, text: got.text.slice(0, 3500), source: 'auto' })
        const delivered = r.some((x) => x.ok)
        appendAutoLog(
          db,
          row.id,
          delivered,
          delivered ? `结果已推送（${sid}）` : `结果已生成，但通知通道均不可用（见会话 ${sid}）`,
        )
        return
      }
    } catch {
      // 继续等
    }
  }
  appendAutoLog(db, row.id, false, `结果未捕获（超时，见会话 ${sid}）`)
}

async function executeWithRetry(db: DatabaseSync, row: AutoRow, nextRunAt: number | null): Promise<void> {
  let ok = false
  let info = ''
  let sid: string | undefined
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await execOnce(db, row)
      ok = r.ok
      info = r.info
      sid = r.sid
      if (ok) {
        if (attempt > 1) info = `第 1 次失败，重试成功（${info}）`
        break
      }
    } catch (e) {
      ok = false
      info = String((e as Error)?.message || e).slice(0, 200)
    }
    if (attempt === 1) await sleep(15_000)
    else info = `重试仍失败：${info}`
  }
  markAutoRun(db, row.id, ok, info, nextRunAt)
  if (ok && sid) void captureAndForward(db, row, sid).catch(() => {})
}

/** 定时巡查：到点的任务执行（启动时补跑错过的，之后每 30 秒一次） */
export async function checkAutos(db: DatabaseSync): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const due = db
    .prepare(`SELECT * FROM automations WHERE type = 'timer' AND enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?`)
    .all(now) as unknown as AutoRow[]
  for (const row of due) {
    if (running.has(row.id)) continue
    running.add(row.id)
    const next = row.schedule ? computeNextRun(row.schedule) : null
    db.prepare(`UPDATE automations SET next_run_at = ? WHERE id = ?`).run(next, row.id)
    void executeWithRetry(db, row, next)
      .catch(() => {})
      .finally(() => running.delete(row.id))
  }
}

/** 「立即运行」：跑一次但不动原有计划 */
export function runAutoNow(db: DatabaseSync, viewer: AutoViewer, id: number): { ok: true } | { error: string } {
  const row = db.prepare(`SELECT * FROM automations WHERE id = ?`).get(id) as AutoRow | undefined
  if (!row) return { error: '不存在' }
  if (row.type !== 'timer') return { error: '规则卡由事件触发，暂不支持手动运行' }
  if (row.scope === 'user' && row.owner !== viewer.username && viewer.role !== 'admin') return { error: '只能运行自己的自动化' }
  if (running.has(row.id)) return { error: '正在运行中' }
  running.add(row.id)
  void executeWithRetry(db, row, row.next_run_at)
    .catch(() => {})
    .finally(() => running.delete(row.id))
  return { ok: true }
}
