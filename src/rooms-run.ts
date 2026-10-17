// P3 群聊编排：用户发一句 → 按 @ 或全员，串行驱动每个成员的常驻会话 → 写回房间日志/线程/活动
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { defaultDataDir } from './db.ts'
import { callInstanceRpc, userHome, userPort } from './session-mgr.ts'
import { instanceAuthCookie } from './instance-auth.ts'
import { appendRoomActivity, appendRoomEntry, getRoom, readBot } from './bots.ts'
import type { RoomInfo } from './bots.ts'
import { decodeSessionEventsFile, findSessionFileUnder } from './panel.ts'

const L = (lang: string, zh: string, en: string): string => (lang === 'en' ? en : zh)
const SESS_DIR = join(defaultDataDir(), 'room-sessions')
const TURN_TIMEOUT_MS = 180000

interface RegEntry {
  sessionId: string
  createdAt: number
}
interface RegFile {
  entries: Record<string, RegEntry>
}
interface Runner {
  running: boolean
  turn: string
  thread: string
  cancelled: boolean
  startedAt: number
}
const runners = new Map<string, Runner>()

function regPath(username: string): string | null {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(username)) return null
  return join(SESS_DIR, `${username}.json`)
}

function readReg(username: string): RegFile {
  const p = regPath(username)
  if (!p || !existsSync(p)) return { entries: {} }
  try {
    const v = JSON.parse(readFileSync(p, 'utf8')) as Partial<RegFile>
    const entries: Record<string, RegEntry> = {}
    for (const [k, e] of Object.entries(v.entries || {})) {
      if (e && typeof (e as RegEntry).sessionId === 'string') entries[k] = { sessionId: String((e as RegEntry).sessionId), createdAt: Number((e as RegEntry).createdAt ?? 0) || Date.now() }
    }
    return { entries }
  } catch {
    return { entries: {} }
  }
}

function writeReg(username: string, reg: RegFile): void {
  const p = regPath(username)
  if (!p) return
  mkdirSync(SESS_DIR, { recursive: true })
  const tmp = `${p}.tmp`
  writeFileSync(tmp, JSON.stringify({ version: 1, entries: reg.entries }, null, 2) + '\n')
  renameSync(tmp, p)
}

interface Ctx {
  port: number
  cookie: string | undefined
}

async function instanceCtx(db: DatabaseSync, username: string): Promise<Ctx | { error: string }> {
  const port = userPort(db, username)
  if (!port) return { error: L('zh', '成员未分配实例', 'Member has no instance') }
  return { port, cookie: instanceAuthCookie(userHome(username), `127.0.0.1:${port}`) }
}

function unwrap<T>(res: { status: number; body: unknown }): { ok: true; value: T } | { error: string } {
  const j = res.body as { result?: { ok?: boolean; value?: T; error?: { code?: string; message?: string } } } | undefined
  const r = j?.result
  if (r?.ok === true) return { ok: true, value: r.value as T }
  return { error: `${r?.error?.code || 'gateway/unknown'}: ${r?.error?.message || `HTTP ${res.status}`}` }
}

async function promptRaw(ctx: Ctx, sessionId: string, text: string): Promise<{ ok: true } | { error: string }> {
  const res = await callInstanceRpc(ctx.port, ctx.cookie, 'session/prompt', {
    args: {
      request: {
        requestId: `room-${randomUUID()}`,
        sessionId,
        mode: 'queue',
        content: [{ type: 'text', text }],
        clientTimeZone: 'Asia/Shanghai',
      },
    },
  })
  const u = unwrap<{ accepted?: boolean }>(res)
  return 'error' in u ? u : { ok: true }
}

async function selectModel(ctx: Ctx, sessionId: string, model: string): Promise<void> {
  try {
    const cat = await callInstanceRpc(ctx.port, ctx.cookie, 'session/modelCatalog', { args: {} })
    const u = unwrap<{ groups?: { id: string; models?: { id: string }[] }[] }>(cat)
    if ('error' in u) return
    for (const g of u.value.groups || []) {
      if ((g.models || []).some((m) => m.id === model)) {
        await callInstanceRpc(ctx.port, ctx.cookie, 'session/selectModel', { args: { request: { sessionId, provider: g.id, model } } })
        return
      }
    }
  } catch {
    // best-effort
  }
}

/** 该成员在这个房间里的专用会话（与 1:1 Bot Chat 分开）。 */
async function ensureMemberSession(
  db: DatabaseSync,
  username: string,
  room: RoomInfo,
  member: string,
  lang: string,
): Promise<{ ok: true; sessionId: string } | { error: string }> {
  const key = `${room.id}:${member}`
  const reg = readReg(username)
  const cur = reg.entries[key]
  if (cur?.sessionId) return { ok: true, sessionId: cur.sessionId }
  const bot = readBot(member, lang)
  if ('error' in bot) return bot
  const ctx = await instanceCtx(db, username)
  if ('error' in ctx) return ctx
  const home = userHome(username)
  const created = await callInstanceRpc(ctx.port, ctx.cookie, 'session/create', { args: { request: { cwd: home } } })
  const cu = unwrap<{ sessionId?: string }>(created)
  if ('error' in cu || !cu.value?.sessionId) return { error: L(lang, '创建会话失败：', 'Failed to create session: ') + ('error' in cu ? cu.error : 'no sessionId') }
  const sid = cu.value.sessionId
  try {
    await callInstanceRpc(ctx.port, ctx.cookie, 'session/rename', { args: { request: { sessionId: sid, title: `Room · ${room.name} · ${member}` } } })
  } catch {
    // 标题失败不阻塞
  }
  if (bot.bot.model) await selectModel(ctx, sid, bot.bot.model)
  const persona = String(bot.bot.persona || '').trim()
  await promptRaw(
    ctx,
    sid,
    `[设定] 你是群聊「${room.name}」里的「${bot.bot.title || member}」（@${member}）。${bot.bot.description || ''}\n成员：${room.members.map((m) => '@' + m).join('、')}。\n${persona}\n规则：每次只输出一条简短的对话消息（1-3 句），不要复述设定或历史，不要自称助手。`,
  )
  reg.entries[key] = { sessionId: sid, createdAt: Date.now() }
  writeReg(username, reg)
  return { ok: true, sessionId: sid }
}

function mentionTargets(text: string, room: RoomInfo): string[] {
  const names = new Set<string>()
  for (const m of String(text).matchAll(/@([a-zA-Z0-9][a-zA-Z0-9._-]*)/g)) names.add(m[1].toLowerCase())
  if (names.has('everyone') || names.has('all')) return [...room.members]
  const picked = room.members.filter((m) => names.has(m.toLowerCase()))
  return picked.length ? picked : [...room.members]
}

function assistantTexts(file: string): string[] {
  const out: string[] = []
  for (const ev of decodeSessionEventsFile(file)) {
    if (ev.type !== 'assistant/message') continue
    const msg = ((ev.data ?? {}) as Record<string, unknown>).message as Record<string, unknown> | undefined
    let text = ''
    for (const b of ((msg?.content ?? []) as unknown[])) {
      if (b && typeof b === 'object' && (b as Record<string, unknown>).type === 'text') text += String((b as Record<string, unknown>).text ?? '')
    }
    text = text.trim()
    if (text) out.push(text)
  }
  return out
}

function buildPrompt(room: RoomInfo, member: string, userText: string): string {
  const recent = room.log.slice(-8).map((e) => `${e.from.name}: ${e.text.replace(/\s+/g, ' ').slice(0, 200)}`).join('\n')
  const others = room.members.filter((m) => m !== member)
  return `[群聊「${room.name}」] 你是 @${member}。${others.length ? `其他成员：${others.map((m) => '@' + m).join('、')}。` : ''}
你只代表 @${member} 发言：一条 1-3 句的自然回复。如果这轮没有值得补充的内容，回复“（无补充）”。
最近消息：
${recent || '（无）'}

用户刚说：${userText}`
}

async function waitForReply(
  home: string,
  sessionId: string,
  baseline: number,
  cancelled: () => boolean,
): Promise<string | null> {
  const t0 = Date.now()
  while (Date.now() - t0 < TURN_TIMEOUT_MS) {
    if (cancelled()) return null
    const file = findSessionFileUnder(join(home, 'sessions'), sessionId)
    if (file) {
      const texts = assistantTexts(file)
      if (texts.length > baseline) return texts[texts.length - 1]
    }
    await new Promise((r) => setTimeout(r, 2500))
  }
  return null
}

async function runLoop(
  db: DatabaseSync,
  username: string,
  roomId: string,
  runner: Runner,
  targets: string[],
  userText: string,
  lang: string,
): Promise<void> {
  try {
    const home = userHome(username)
    for (const member of targets) {
      if (runner.cancelled) return
      runner.turn = member
      appendRoomActivity(roomId, { kind: 'working', member, thread: runner.thread })
      const roomNow = getRoom(roomId)
      if ('error' in roomNow) return
      const sess = await ensureMemberSession(db, username, roomNow.room, member, lang)
      const ctx = await instanceCtx(db, username)
      if ('error' in sess || 'error' in ctx) {
        appendRoomActivity(roomId, { kind: 'error', member, text: 'error' in sess ? sess.error : (ctx as { error: string }).error })
        continue
      }
      const file0 = findSessionFileUnder(join(home, 'sessions'), sess.sessionId)
      const baseline = file0 ? assistantTexts(file0).length : 0
      const sent = await promptRaw(ctx, sess.sessionId, buildPrompt(roomNow.room, member, userText))
      if ('error' in sent) {
        appendRoomActivity(roomId, { kind: 'error', member, text: sent.error.slice(0, 200) })
        continue
      }
      const reply = await waitForReply(home, sess.sessionId, baseline, () => runner.cancelled)
      if (runner.cancelled) return
      if (reply && !/^[（(]无补充[）)]$/.test(reply.trim())) {
        appendRoomEntry(roomId, { from: { kind: 'member', name: member }, text: reply, thread: runner.thread })
        appendRoomActivity(roomId, { kind: 'reply', member, thread: runner.thread })
      } else if (!reply) {
        appendRoomActivity(roomId, { kind: 'error', member, text: 'timeout' })
      }
    }
    if (!runner.cancelled) appendRoomActivity(roomId, { kind: 'done', thread: runner.thread })
  } finally {
    runner.running = false
    runner.turn = ''
    runners.delete(roomId)
  }
}

export async function startRoomTurn(
  db: DatabaseSync,
  username: string,
  roomId: string,
  text: string,
  lang: string = 'zh',
): Promise<{ ok: true; thread: string; targets: string[]; queued?: boolean } | { error: string }> {
  const body = String(text ?? '').trim()
  if (!body) return { error: L(lang, '消息不能为空', 'Message is empty') }
  if (body.length > 8000) return { error: L(lang, '消息过长（>8000 字）', 'Message too long (>8000 chars)') }
  const room = getRoom(roomId, lang)
  if ('error' in room) return room
  const thread = `th-${randomBytes(4).toString('hex')}`
  const active = runners.get(roomId)
  if (active?.running) {
    // 运行中来新消息：先落日志，本轮结束后不自动再跑（P4 可做队列）
    const app0 = appendRoomEntry(roomId, { from: { kind: 'user', name: 'You' }, text: body, thread })
    if ('error' in app0) return app0
    return { ok: true, thread, targets: [], queued: true }
  }
  const targets = mentionTargets(body, room.room)
  const appended = appendRoomEntry(roomId, { from: { kind: 'user', name: 'You' }, text: body, thread })
  if ('error' in appended) return appended
  const runner: Runner = { running: true, turn: '', thread, cancelled: false, startedAt: Date.now() }
  runners.set(roomId, runner)
  void runLoop(db, username, roomId, runner, targets, body, lang)
  return { ok: true, thread, targets }
}

export function roomSnapshot(roomId: string): { running: boolean; turn: string; thread: string } {
  const r = runners.get(roomId)
  return r ? { running: r.running, turn: r.turn, thread: r.thread } : { running: false, turn: '', thread: '' }
}

export async function stopRoom(
  db: DatabaseSync,
  username: string,
  roomId: string,
  lang: string = 'zh',
): Promise<{ ok: true; stopped: boolean } | { error: string }> {
  const r = runners.get(roomId)
  if (!r?.running) return { ok: true, stopped: false }
  r.cancelled = true
  if (r.turn) {
    const reg = readReg(username)
    const entry = reg.entries[`${roomId}:${r.turn}`]
    if (entry?.sessionId) {
      const ctx = await instanceCtx(db, username)
      if (!('error' in ctx)) {
        try {
          await callInstanceRpc(ctx.port, ctx.cookie, 'session/cancel', { args: { request: { sessionId: entry.sessionId } } })
        } catch {
          // 取消尽力而为
        }
      }
    }
  }
  appendRoomActivity(roomId, { kind: 'stopped', thread: r.thread })
  return { ok: true, stopped: true }
}
