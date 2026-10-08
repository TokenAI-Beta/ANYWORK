// 微信桥：成员微信 ⇄ 工作台助理（双向对话，对齐 Hermes 的微信体验）
// 每个 wx_chat 行 = 一个成员的微信机器人：长轮询 getupdates 收消息 →
// 丢进该成员实例上的「微信对话」会话（session_id 常驻复用）→ 助理回复发回微信。
// 说明：
// - 与通知桥（notify_routes）独立：通知=单向推送；本桥=对话；两者可共用同一机器人凭据。
// - 只在成员主动发消息时消耗模型；机器人靠 tokenless 直发（与通知桥同一降级通道）。
// - 会话在成员工作台里可见（同一对话），成员也可以在网页里接着聊。
import type { DatabaseSync } from 'node:sqlite'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'
import { instanceAuthCookie } from './instance-auth.ts'
import { sendWeixinIlink } from './notify.ts'
import { callInstanceRpc, userHome, userPort } from './session-mgr.ts'

const BASE_DEFAULT = 'https://ilinkai.weixin.qq.com'
const LONG_POLL_MS = 35_000
const RETRY_MS = 2_000
const BACKOFF_MS = 30_000
const MAX_FAILS = 3
const SESSION_EXPIRED_PAUSE_MS = 10 * 60_000
const REPLY_WAIT_MS = 4 * 60_000
const CHUNK_MAX = 1800
const MAX_PER_HOUR = 30
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export interface WxChatRow {
  id: number
  account: string
  label: string
  openid: string
  token: string
  base_url: string
  enabled: number
  session_id: string
  last_ctx: string
  sync_buf: string
  last_msg_ts: number
  last_reply_ts: number
}

const pollers = new Map<number, { stop: boolean }>()
const queues = new Map<number, Promise<void>>()
const seen = new Map<string, number>()
let started = false

const nowSec = (): number => Math.floor(Date.now() / 1000)

function pruneSeen(): void {
  const cut = Date.now() - 10 * 60_000
  for (const [k, ts] of seen) if (ts < cut) seen.delete(k)
  if (seen.size > 2000) {
    let n = seen.size - 1500
    for (const k of seen.keys()) {
      if (n-- <= 0) break
      seen.delete(k)
    }
  }
}

// —— 会话文件解码（与 auto-exec 同源的自带副本，便于最小化部署到旧镜像）——
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

function rpcValue(body: unknown): Record<string, unknown> | undefined {
  const v = (body as { result?: { value?: unknown } } | undefined)?.result?.value
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined
}

function itemsOfLite(body: unknown): { sessionId: string; running: boolean }[] | undefined {
  const items = rpcValue(body)?.['items']
  return Array.isArray(items) ? (items as { sessionId: string; running: boolean }[]) : undefined
}

function pickText(itemList: unknown): string {
  if (!Array.isArray(itemList)) return ''
  for (const it of itemList) {
    if (it && typeof it === 'object' && (it as { type?: unknown }).type === 1) {
      const t = (it as { text_item?: { text?: unknown } }).text_item?.text
      if (typeof t === 'string' && t.trim()) return t.trim()
    }
  }
  return ''
}

function chunkText(s: string, max: number): string[] {
  if (s.length <= max) return [s]
  const out: string[] = []
  let rest = s
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max)
    if (cut < max * 0.5) cut = max
    out.push(rest.slice(0, cut))
    rest = rest.slice(cut).replace(/^\n+/, '')
  }
  if (rest) out.push(rest)
  return out
}

function getRow(db: DatabaseSync, id: number): WxChatRow | undefined {
  return db.prepare(`SELECT * FROM wx_chat WHERE id = ?`).get(id) as unknown as WxChatRow | undefined
}

function logMsg(db: DatabaseSync, chatId: number, dir: 'in' | 'out', text: string, ok?: boolean, info?: string): void {
  db.prepare(`INSERT INTO wx_chat_log (chat_id, dir, text, ok, info, ts) VALUES (?, ?, ?, ?, ?, ?)`).run(
    chatId,
    dir,
    text.slice(0, 2000),
    ok == null ? null : ok ? 1 : 0,
    info ?? null,
    nowSec(),
  )
}

/** 运维/测试：登记一个微信机器人绑定；返回 id */
export function wxChatAdd(
  db: DatabaseSync,
  r: { account: string; openid: string; token: string; label?: string; base_url?: string; enabled?: number },
): number {
  const res = db
    .prepare(`INSERT INTO wx_chat (account, label, openid, token, base_url, enabled) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(r.account, r.label ?? '', r.openid, r.token, r.base_url || BASE_DEFAULT, r.enabled ?? 1)
  return Number(res.lastInsertRowid)
}

export function wxChatList(db: DatabaseSync): WxChatRow[] {
  return db.prepare(`SELECT * FROM wx_chat ORDER BY id`).all() as unknown as WxChatRow[]
}

async function getUpdates(
  base: string,
  token: string,
  buf: string,
): Promise<{ ret?: number; errcode?: number; errmsg?: string; msgs?: unknown[]; get_updates_buf?: string; longpolling_timeout_ms?: number }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), LONG_POLL_MS + 12_000)
  try {
    const r = await fetch((base || BASE_DEFAULT).replace(/\/+$/, '') + '/ilink/bot/getupdates', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        AuthorizationType: 'ilink_bot_token',
        Authorization: 'Bearer ' + token,
        'iLink-App-Id': 'bot',
        'iLink-App-ClientVersion': '131584',
        'X-WECHAT-UIN': Buffer.from(String(Math.floor(Math.random() * 4294967296))).toString('base64'),
      },
      body: JSON.stringify({ get_updates_buf: buf }),
      signal: ctrl.signal,
    })
    const raw = await r.text()
    try {
      return JSON.parse(raw) as ReturnType<typeof JSON.parse>
    } catch {
      return { ret: -1, errmsg: 'bad json: ' + raw.slice(0, 80) }
    }
  } finally {
    clearTimeout(t)
  }
}

/** 一个绑定的长轮询循环（enabled=1 期间常驻；停用/删除后自动退出） */
async function pollOne(db: DatabaseSync, id: number): Promise<void> {
  console.log(`[wx-bridge] poller start id=${id}`)
  let fails = 0
  while (!pollers.get(id)?.stop) {
    const row = getRow(db, id)
    if (!row || !row.enabled) break
    try {
      const res = await getUpdates(row.base_url, row.token, row.sync_buf || '')
      if ((res.ret ?? 0) !== 0 || (res.errcode ?? 0) !== 0) {
        if (res.ret === -14 || res.errcode === -14) {
          console.log(`[wx-bridge] id=${id} session expired; pause ${SESSION_EXPIRED_PAUSE_MS / 60000}min`)
          fails = 0
          await sleep(SESSION_EXPIRED_PAUSE_MS)
          continue
        }
        fails += 1
        console.log(`[wx-bridge] id=${id} getupdates ret=${res.ret} errcode=${res.errcode} ${String(res.errmsg || '').slice(0, 100)}`)
        await sleep(fails >= MAX_FAILS ? BACKOFF_MS : RETRY_MS)
        if (fails >= MAX_FAILS) fails = 0
        continue
      }
      fails = 0
      if (res.get_updates_buf && res.get_updates_buf !== row.sync_buf) {
        db.prepare(`UPDATE wx_chat SET sync_buf = ? WHERE id = ?`).run(String(res.get_updates_buf), id)
      }
      for (const m of res.msgs || []) void handleInbound(db, id, m).catch(() => {})
    } catch {
      fails += 1
      await sleep(fails >= MAX_FAILS ? BACKOFF_MS : RETRY_MS)
      if (fails >= MAX_FAILS) fails = 0
    }
  }
  pollers.delete(id)
  console.log(`[wx-bridge] poller stop id=${id}`)
}

/** 收到一条消息：校验 → 去重 → 限速 → 入队（每绑定串行） */
export async function handleInbound(db: DatabaseSync, id: number, rawMsg: unknown): Promise<void> {
  const row = getRow(db, id)
  if (!row) return
  const m = rawMsg as { from_user_id?: unknown; message_id?: unknown; context_token?: unknown; item_list?: unknown }
  const from = String(m.from_user_id || '').trim()
  if (!from || from !== row.openid) return
  const ctx = String(m.context_token || '').trim()
  if (ctx) db.prepare(`UPDATE wx_chat SET last_ctx = ? WHERE id = ?`).run(ctx, id)
  const text = pickText(m.item_list)
  if (!text) return
  pruneSeen()
  const mid = String(m.message_id || '').trim()
  const fp = from + ':' + createHash('md5').update(text).digest('hex')
  if ((mid && seen.has('id:' + mid)) || seen.has('fp:' + fp)) return
  if (mid) seen.set('id:' + mid, Date.now())
  seen.set('fp:' + fp, Date.now())
  const hourAgo = nowSec() - 3600
  const cnt = db.prepare(`SELECT COUNT(*) AS c FROM wx_chat_log WHERE chat_id = ? AND dir = 'in' AND ts >= ?`).get(id, hourAgo) as
    | { c: number }
    | undefined
  if ((cnt?.c ?? 0) >= MAX_PER_HOUR) return
  logMsg(db, id, 'in', text)
  db.prepare(`UPDATE wx_chat SET last_msg_ts = ? WHERE id = ?`).run(nowSec(), id)
  const prev = queues.get(id) || Promise.resolve()
  const next = prev
    .then(() => respond(db, id, text))
    .catch(() => {})
  queues.set(id, next)
  next.finally(() => {
    if (queues.get(id) === next) queues.delete(id)
  })
}

/** 让工作台助理回复一条消息（复用常驻会话；新会话自动登记） */
async function chatTurn(
  db: DatabaseSync,
  row: WxChatRow,
  text: string,
): Promise<{ ok: boolean; reply?: string; info: string; sid?: string }> {
  try {
    const owner = row.account
    const port = userPort(db, owner)
    if (!port) return { ok: false, info: `成员 ${owner} 未分配实例` }
    const home = userHome(owner)
    const auth = instanceAuthCookie(home, `127.0.0.1:${port}`)
    let sid = row.session_id
    if (sid) {
      const list = await callInstanceRpc(port, auth, 'session/list', { args: { _request: {} } })
      const items = itemsOfLite(list.body)
      if (items && !items.some((x) => x.sessionId === sid)) sid = ''
    }
    if (!sid) {
      const created = await callInstanceRpc(port, auth, 'session/create', { args: { request: {} } })
      sid = String(rpcValue(created.body)?.['sessionId'] ?? '')
      if (!sid) return { ok: false, info: '创建会话失败' }
      db.prepare(`UPDATE wx_chat SET session_id = ? WHERE id = ?`).run(sid, row.id)
    }
    const prevText = decodeSessionText(home, sid)?.text ?? ''
    const pr = await callInstanceRpc(port, auth, 'session/prompt', {
      args: {
        request: {
          requestId: `wx-${randomUUID()}`,
          sessionId: sid,
          mode: 'queue',
          content: [{ type: 'text', text }],
          clientTimeZone: 'Asia/Shanghai',
        },
      },
    })
    if (rpcValue(pr.body)?.['accepted'] !== true) return { ok: false, info: '下指令失败', sid }
    const start = Date.now()
    let sawRunning = false
    let reply = ''
    while (Date.now() < start + REPLY_WAIT_MS) {
      await sleep(2500)
      let running = false
      try {
        const list = await callInstanceRpc(port, auth, 'session/list', { args: { _request: {} } })
        running = itemsOfLite(list.body)?.find((x) => x.sessionId === sid)?.running === true
      } catch {
        // 忽略，继续等
      }
      if (running) sawRunning = true
      const got = decodeSessionText(home, sid)
      if (!running && got && got.text && (sawRunning || got.text !== prevText)) {
        reply = got.text
        break
      }
      if (!sawRunning && !running && Date.now() > start + 45_000) break
    }
    if (!reply) return { ok: false, info: '等待回复超时', sid }
    return { ok: true, reply, info: 'ok', sid }
  } catch (e) {
    return { ok: false, info: String((e as Error)?.message || e).slice(0, 200) }
  }
}

async function respond(db: DatabaseSync, id: number, text: string): Promise<void> {
  const row = getRow(db, id)
  if (!row || !row.enabled) return
  const r = await chatTurn(db, row, text)
  const outText = r.ok && r.reply ? r.reply : '（助理暂时没有响应，请稍后再试）'
  let ok = true
  let info = ''
  const chunks = chunkText(outText, CHUNK_MAX)
  for (const c of chunks) {
    const raw = getRow(db, id)
    const res = await sendWeixinIlink(raw?.base_url || row.base_url, row.token, row.openid, c, raw?.last_ctx || undefined)
    ok = ok && res.ok
    info = res.info
    if (!res.ok) break
    if (chunks.length > 1) await sleep(400)
  }
  logMsg(db, id, 'out', outText, ok, info)
  db.prepare(`UPDATE wx_chat SET last_reply_ts = ? WHERE id = ?`).run(nowSec(), id)
}

/** 启动微信桥（服务启动时调用一次）：每 15 秒巡检绑定表，起/停轮询循环 */
export function startWxBridge(db: DatabaseSync): void {
  if (started) return
  started = true
  const tick = (): void => {
    try {
      const rows = db.prepare(`SELECT id FROM wx_chat WHERE enabled = 1`).all() as unknown as { id: number }[]
      const ids = new Set(rows.map((r) => r.id))
      for (const [id, p] of pollers) if (!ids.has(id)) p.stop = true
      for (const { id } of rows) {
        if (pollers.has(id)) continue
        pollers.set(id, { stop: false })
        void pollOne(db, id).catch(() => pollers.delete(id))
      }
    } catch {
      // 表未就绪等：下轮再试
    }
  }
  tick()
  setInterval(tick, 15_000)
  console.log('[wx-bridge] started')
}
