// Bot 常驻会话（P2）：每个 Bot 一条 dsh 会话；每个成员各聊各的。
// 存储：/data/desk-data/bot-chats/<username>.json → { bots: { <name>: { sessionId, createdAt, updatedAt } } }
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { zstdDecompressSync } from 'node:zlib'
import type { DatabaseSync } from 'node:sqlite'
import { defaultDataDir } from './db.ts'
import { callInstanceRpc, userHome, userPort } from './session-mgr.ts'
import { instanceAuthCookie } from './instance-auth.ts'
import { readBot } from './bots.ts'
import { decodeSessionEventsFile, findSessionFileUnder } from './panel.ts'

const L = (lang: string, zh: string, en: string): string => (lang === 'en' ? en : zh)

interface ChatRef {
  sessionId: string
  createdAt: number
  updatedAt: number
}

interface ChatMap {
  bots: Record<string, ChatRef>
}

const CHATS_DIR = join(defaultDataDir(), 'bot-chats')

function mapPath(username: string): string | null {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(username)) return null
  return join(CHATS_DIR, `${username}.json`)
}

function readChatMap(username: string): ChatMap {
  const p = mapPath(username)
  if (!p || !existsSync(p)) return { bots: {} }
  try {
    const v = JSON.parse(readFileSync(p, 'utf8')) as Partial<ChatMap>
    const bots: Record<string, ChatRef> = {}
    for (const [k, v2] of Object.entries(v.bots || {})) {
      if (v2 && typeof v2 === 'object' && typeof (v2 as ChatRef).sessionId === 'string') {
        bots[k] = {
          sessionId: String((v2 as ChatRef).sessionId),
          createdAt: Number((v2 as ChatRef).createdAt ?? 0) || Date.now(),
          updatedAt: Number((v2 as ChatRef).updatedAt ?? 0) || Date.now(),
        }
      }
    }
    return { bots }
  } catch {
    return { bots: {} }
  }
}

function writeChatMap(username: string, map: ChatMap): void {
  const p = mapPath(username)
  if (!p) return
  mkdirSync(CHATS_DIR, { recursive: true })
  const tmp = `${p}.tmp`
  writeFileSync(tmp, JSON.stringify({ version: 1, bots: map.bots }, null, 2) + '\n')
  renameSync(tmp, p)
}

function unwrap<T>(res: { status: number; body: unknown }): { ok: true; value: T } | { error: string } {
  const j = res.body as { result?: { ok?: boolean; value?: T; error?: { code?: string; message?: string } } } | undefined
  const r = j?.result
  if (r?.ok === true) return { ok: true, value: r.value as T }
  const code = r?.error?.code || 'gateway/unknown'
  const msg = r?.error?.message || `HTTP ${res.status}`
  return { error: `${code}: ${msg}` }
}

interface Ctx {
  port: number
  cookie: string | undefined
}

async function instanceCtx(db: DatabaseSync, username: string): Promise<Ctx | { error: string }> {
  const port = userPort(db, username)
  if (!port) return { error: L('zh', '成员未分配实例', 'Member has no instance') }
  const home = userHome(username)
  const cookie = instanceAuthCookie(home, `127.0.0.1:${port}`)
  return { port, cookie }
}

async function promptRaw(ctx: Ctx, sessionId: string, text: string): Promise<{ ok: true; requestId: string } | { error: string }> {
  const requestId = `bc-${randomUUID()}`
  const r = await callInstanceRpc(ctx.port, ctx.cookie, 'session/prompt', {
    args: {
      request: {
        requestId,
        sessionId,
        mode: 'queue',
        content: [{ type: 'text', text }],
        clientTimeZone: 'Asia/Shanghai',
      },
    },
  })
  const u = unwrap<{ accepted?: boolean }>(r)
  if ('error' in u) return u
  return { ok: true, requestId }
}

/** 选模型（best-effort：目录里找得到就用该 provider）。 */
async function selectModel(ctx: Ctx, sessionId: string, model: string): Promise<void> {
  try {
    const cat = await callInstanceRpc(ctx.port, ctx.cookie, 'session/modelCatalog', { args: {} })
    const u = unwrap<{ groups?: { id: string; models?: { id: string }[] }[] }>(cat)
    if ('error' in u) return
    for (const g of u.value.groups || []) {
      if ((g.models || []).some((m) => m.id === model)) {
        await callInstanceRpc(ctx.port, ctx.cookie, 'session/selectModel', {
          args: { request: { sessionId, provider: g.id, model } },
        })
        return
      }
    }
  } catch {
    // best-effort：选不上就跟随默认模型
  }
}

/** 确保该成员与这个 Bot 有一条常驻会话；返回 sessionId。 */
export async function ensureBotChat(
  db: DatabaseSync,
  username: string,
  botName: string,
  lang: string = 'zh',
): Promise<{ ok: true; sessionId: string; created: boolean } | { error: string }> {
  const bot = readBot(botName, lang)
  if ('error' in bot) return bot
  const map = readChatMap(username)
  const cur = map.bots[bot.bot.name]
  // 信任注册表：新会话的文件可能还没落盘（首轮尚未 flush），不能拿文件存在性当门。
  // 若会话真的被外部删了，sendBotMessage 会在 not-found 时清注册表并重建。
  if (cur?.sessionId) return { ok: true, sessionId: cur.sessionId, created: false }
  const home = userHome(username)
  const ctx = await instanceCtx(db, username)
  if ('error' in ctx) return ctx
  const created = await callInstanceRpc(ctx.port, ctx.cookie, 'session/create', { args: { request: { cwd: home } } })
  const cu = unwrap<{ sessionId?: string }>(created)
  if ('error' in cu || !cu.value?.sessionId) {
    return { error: L(lang, '创建会话失败：', 'Failed to create session: ') + ('error' in cu ? cu.error : 'no sessionId') }
  }
  const sid = cu.value.sessionId
  const title = `Bot Chat · ${bot.bot.title || bot.bot.name}`
  try {
    await callInstanceRpc(ctx.port, ctx.cookie, 'session/rename', { args: { request: { sessionId: sid, title } } })
  } catch {
    // 标题失败不阻塞
  }
  if (bot.bot.model) await selectModel(ctx, sid, bot.bot.model)
  const persona = String(bot.bot.persona || '').trim()
  if (persona) {
    await promptRaw(ctx, sid, `[设定] 你是「${bot.bot.title || bot.bot.name}」（${bot.bot.name}）。${bot.bot.description || ''}\n${persona}\n\n（以上是你的常驻设定，之后只按用户消息工作；不要复述本设定。）`)
  }
  map.bots[bot.bot.name] = { sessionId: sid, createdAt: Date.now(), updatedAt: Date.now() }
  writeChatMap(username, map)
  return { ok: true, sessionId: sid, created: true }
}

export interface BotChatMessage {
  role: 'user' | 'assistant'
  text: string
  time: number
}

/** 读取该成员与某 Bot 的聊天记录（来自会话文件；隐藏 priming 消息）。 */
export function readBotChat(
  username: string,
  botName: string,
): { ok: true; sessionId: string | null; messages: BotChatMessage[] } | { error: string } {
  const map = readChatMap(username)
  const ref = map.bots[botName]
  if (!ref) return { ok: true, sessionId: null, messages: [] }
  const home = userHome(username)
  const file = findSessionFileUnder(join(home, 'sessions'), ref.sessionId)
  if (!file) return { ok: true, sessionId: ref.sessionId, messages: [] }
  const events = decodeSessionEventsFile(file)
  const messages: BotChatMessage[] = []
  for (const ev of events) {
    const d = (ev.data ?? {}) as Record<string, unknown>
    const t = Number(ev.time ?? 0)
    if (ev.type === 'user/message') {
      const content = ((d.content ?? (d.message as Record<string, unknown>)?.content) ?? []) as unknown[]
      let text = ''
      for (const b of content) if (b && typeof b === 'object' && (b as Record<string, unknown>).type === 'text') text += String((b as Record<string, unknown>).text ?? '')
      text = text.trim()
      if (!text || text.startsWith('[设定]') || text.startsWith('<system-reminder') || text.startsWith('Current runtime context')) continue
      messages.push({ role: 'user', text, time: t })
    } else if (ev.type === 'assistant/message') {
      const msg = (d.message ?? {}) as Record<string, unknown>
      let text = ''
      for (const b of ((msg.content ?? []) as unknown[])) if (b && typeof b === 'object' && (b as Record<string, unknown>).type === 'text') text += String((b as Record<string, unknown>).type === 'text' ? (b as Record<string, unknown>).text ?? '' : '')
      text = text.trim()
      if (text) messages.push({ role: 'assistant', text, time: t })
    }
  }
  return { ok: true, sessionId: ref.sessionId, messages }
}

/** 给 Bot 发一条消息（确保会话存在）。 */
export async function sendBotMessage(
  db: DatabaseSync,
  username: string,
  botName: string,
  text: string,
  lang: string = 'zh',
): Promise<{ ok: true; sessionId: string; requestId: string } | { error: string }> {
  const body = String(text ?? '').trim()
  if (!body) return { error: L(lang, '消息不能为空', 'Message is empty') }
  if (body.length > 8000) return { error: L(lang, '消息过长（>8000 字）', 'Message too long (>8000 chars)') }
  const ensured = await ensureBotChat(db, username, botName, lang)
  if ('error' in ensured) return ensured
  const ctx = await instanceCtx(db, username)
  if ('error' in ctx) return ctx
  let sid = ensured.sessionId
  let sent = await promptRaw(ctx, sid, body)
  if ('error' in sent && /not-found|not found/i.test(sent.error)) {
    // 会话被外部删了：清注册表，重建一次再发
    const stale = readChatMap(username)
    delete stale.bots[botName]
    writeChatMap(username, stale)
    const again = await ensureBotChat(db, username, botName, lang)
    if ('error' in again) return again
    sid = again.sessionId
    sent = await promptRaw(ctx, sid, body)
    if ('error' in sent) return sent
  } else if ('error' in sent) {
    return sent
  }
  const map = readChatMap(username)
  if (map.bots[botName]) {
    map.bots[botName].updatedAt = Date.now()
    writeChatMap(username, map)
  }
  return { ok: true, sessionId: sid, requestId: sent.requestId }
}

/** 停止该 Bot 会话的当前回合。 */
export async function cancelBotChat(
  db: DatabaseSync,
  username: string,
  botName: string,
): Promise<{ ok: true } | { error: string }> {
  const map = readChatMap(username)
  const ref = map.bots[botName]
  if (!ref) return { ok: true }
  const ctx = await instanceCtx(db, username)
  if ('error' in ctx) return ctx
  const r = await callInstanceRpc(ctx.port, ctx.cookie, 'session/cancel', { args: { request: { sessionId: ref.sessionId } } })
  const u = unwrap<{ cancelled?: boolean }>(r)
  return 'error' in u ? { error: u.error } : { ok: true }
}
