// Bots（常驻身份）与 Rooms（群聊房间）存储 —— P1 数据层
// 与 agents/*.md 共用同一套共享区（defaultDataDir()），不改任何成员实例。
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { defaultDataDir } from './db.ts'

const L = (lang: string, zh: string, en: string): string => (lang === 'en' ? en : zh)

export interface BotAvatar {
  shape: string // squircle | blobatar | circle | org
  color?: string
  image?: string
}

export interface BotInfo {
  name: string
  title: string
  description: string
  persona: string
  model: string
  tools: string[]
  avatar: BotAvatar
  createdAt: number
  updatedAt: number
  ok: boolean
  errors: string[]
}

export interface RoomEntry {
  id: string
  from: { kind: 'user' | 'member'; name: string }
  text: string
  at: number
  thread?: string
  images?: unknown[]
}

export interface RoomInfo {
  id: string
  name: string
  members: string[]
  log: RoomEntry[]
  revision: number
  createdAt: number
  updatedAt: number
}

const BOTS_DIR = join(defaultDataDir(), 'bots')
const ROOMS_FILE = join(defaultDataDir(), 'rooms.json')
const BOT_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\.md$/
const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const TOOL_RE = /^[A-Za-z0-9_.:-]{1,40}$/
const SHAPES = new Set(['squircle', 'blobatar', 'circle', 'org'])

function readText(p: string): string {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}

/** frontmatter + 正文（够 bots/<name>.md 用） */
function splitFrontmatter(src: string): { meta: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src)
  if (!m) return { meta: {}, body: src }
  const meta: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const mm = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line)
    if (!mm) continue
    let v = mm[2].trim()
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1)
    meta[mm[1]] = v
  }
  return { meta, body: src.slice(m[0].length) }
}

function botFilePath(name: string): string | null {
  const n = String(name || '').trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(n) || n.includes('..') || n.includes('/') || n.includes('\\')) return null
  return join(BOTS_DIR, `${n}.md`)
}

function toBotInfo(fileName: string, mtimeMs: number): BotInfo {
  const raw = readText(join(BOTS_DIR, fileName))
  const { meta, body } = splitFrontmatter(raw)
  const name = meta.name || fileName.replace(/\.md$/i, '')
  const tools = String(meta.tools || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((t) => TOOL_RE.test(t))
  const avatar: BotAvatar = {
    shape: SHAPES.has(meta.avatarShape) ? meta.avatarShape : 'blobatar',
    ...(meta.avatarColor ? { color: meta.avatarColor } : {}),
    ...(meta.avatarImage ? { image: meta.avatarImage } : {}),
  }
  const errors: string[] = []
  if (!raw.trim()) errors.push(L('zh', '文件为空', 'File is empty'))
  return {
    name,
    title: meta.title || '',
    description: meta.description || '',
    persona: body.trim(),
    model: meta.model || '',
    tools,
    avatar,
    createdAt: Number(meta.createdAt || 0) || Math.round(mtimeMs),
    updatedAt: Number(meta.updatedAt || 0) || Math.round(mtimeMs),
    ok: errors.length === 0,
    errors,
  }
}

/** 列出全部 Bot（共享定义）。 */
export function collectBots(): BotInfo[] {
  let names: string[] = []
  try {
    names = readdirSync(BOTS_DIR).filter((n) => BOT_FILE_RE.test(n) && !n.startsWith('.'))
  } catch {
    return []
  }
  const out: BotInfo[] = []
  for (const n of names) {
    try {
      const st = statSync(join(BOTS_DIR, n))
      out.push(toBotInfo(n, st.mtimeMs))
    } catch {
      // 读不了就跳过
    }
  }
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || a.name.localeCompare(b.name))
  return out
}

/** 读取单个 Bot。 */
export function readBot(name: string, lang: string = 'zh'): { ok: true; bot: BotInfo } | { error: string } {
  const p = botFilePath(name)
  if (!p) return { error: L(lang, '名称不合法（小写字母/数字，可含 . _ -）', 'Invalid name (lowercase letters, digits, . _ -)') }
  if (!existsSync(p)) return { error: L(lang, 'Bot 不存在', 'Bot not found') }
  try {
    const st = statSync(p)
    return { ok: true, bot: toBotInfo(`${String(name).trim()}.md`, st.mtimeMs) }
  } catch (e) {
    return { error: L(lang, '读取失败：', 'Read failed: ') + String((e as Error)?.message || e) }
  }
}

export interface BotSaveInput {
  name?: unknown
  title?: unknown
  description?: unknown
  persona?: unknown
  model?: unknown
  tools?: unknown
  avatarShape?: unknown
  avatarColor?: unknown
  avatarImage?: unknown
}

/** 新建或更新一个 Bot（原子写）。 */
export function saveBot(input: BotSaveInput, lang: string = 'zh'): { ok: true; bot: BotInfo } | { error: string } {
  const name = String(input.name ?? '').trim().toLowerCase()
  if (!NAME_RE.test(name)) return { error: L(lang, '名称不合法：小写字母/数字开头，可含 . _ -，最长 64', 'Invalid name: lowercase letters/digits, dot/underscore/dash, max 64') }
  const title = String(input.title ?? '').trim().slice(0, 80)
  const description = String(input.description ?? '').trim().slice(0, 400)
  const persona = String(input.persona ?? '').trim().slice(0, 30000)
  const model = String(input.model ?? '').trim()
  if (model && !MODEL_RE.test(model)) return { error: L(lang, '模型名不合法', 'Invalid model id') }
  const shape = String(input.avatarShape ?? 'blobatar').trim()
  if (!SHAPES.has(shape)) return { error: L(lang, '头像形状不合法（squircle/blobatar/circle/org）', 'Invalid avatar shape (squircle/blobatar/circle/org)') }
  const color = String(input.avatarColor ?? '').trim()
  if (color && !/^#[0-9a-fA-F]{3,8}$/.test(color)) return { error: L(lang, '颜色需为 #rrggbb', 'Color must be #rrggbb') }
  const image = String(input.avatarImage ?? '').trim()
  if (image && image.length > 400000) return { error: L(lang, '头像图片过大（>400KB）', 'Avatar image too large (>400KB)') }
  const toolsRaw = Array.isArray(input.tools) ? input.tools : String(input.tools ?? '').split(',')
  const tools = [...new Set(toolsRaw.map((t) => String(t).trim().toLowerCase()).filter(Boolean))]
  for (const t of tools) if (!TOOL_RE.test(t)) return { error: L(lang, `工具名不合法：${t}`, `Invalid tool name: ${t}`) }
  if (!title && !description && !persona) return { error: L(lang, '至少填一项：头衔 / 简介 / 人设', 'Fill at least one: title, description, or persona') }

  const p = botFilePath(name)
  if (!p) return { error: L(lang, '名称不合法', 'Invalid name') }
  const prev = existsSync(p) ? toBotInfo(`${name}.md`, Date.now()) : null
  const now = Date.now()
  const created = prev?.createdAt || now
  const lines = [
    '---',
    `name: ${name}`,
    `title: ${title}`,
    `description: ${description.replace(/\r?\n/g, ' ')}`,
    ...(model ? [`model: ${model}`] : []),
    ...(tools.length ? [`tools: ${tools.join(', ')}`] : []),
    `avatarShape: ${shape}`,
    ...(color ? [`avatarColor: ${color}`] : []),
    ...(image ? [`avatarImage: ${image}`] : []),
    `createdAt: ${created}`,
    `updatedAt: ${now}`,
    '---',
    '',
    persona,
    '',
  ]
  try {
    mkdirSync(BOTS_DIR, { recursive: true })
    const tmp = `${p}.tmp`
    writeFileSync(tmp, lines.join('\n'))
    renameSync(tmp, p)
  } catch (e) {
    return { error: L(lang, '写入失败：', 'Write failed: ') + String((e as Error)?.message || e) }
  }
  return { ok: true, bot: toBotInfo(`${name}.md`, now) }
}

/** 删除 Bot，并从所有房间成员里摘掉。 */
export function deleteBot(name: string, lang: string = 'zh'): { ok: true; removedFromRooms: number } | { error: string } {
  const p = botFilePath(name)
  if (!p) return { error: L(lang, '名称不合法', 'Invalid name') }
  if (!existsSync(p)) return { error: L(lang, 'Bot 不存在', 'Bot not found') }
  try {
    unlinkSync(p)
  } catch (e) {
    return { error: L(lang, '删除失败：', 'Delete failed: ') + String((e as Error)?.message || e) }
  }
  let removed = 0
  const data = readRoomsRaw()
  let changed = false
  for (const r of data.rooms) {
    const before = r.members.length
    r.members = r.members.filter((m) => m !== name)
    if (r.members.length !== before) {
      removed += before - r.members.length
      r.revision += 1
      r.updatedAt = Date.now()
      changed = true
    }
  }
  if (changed) writeRoomsRaw(data)
  return { ok: true, removedFromRooms: removed }
}

// —— Rooms（群聊房间）——

interface RoomsFile {
  version: number
  rooms: RoomInfo[]
}

function readRoomsRaw(): RoomsFile {
  const raw = readText(ROOMS_FILE)
  if (!raw.trim()) return { version: 1, rooms: [] }
  try {
    const v = JSON.parse(raw) as Partial<RoomsFile>
    const rooms = Array.isArray(v.rooms) ? v.rooms : []
    return {
      version: Number(v.version ?? 1),
      rooms: rooms
        .filter((r) => r && typeof r === 'object' && typeof (r as RoomInfo).id === 'string')
        .map((r) => normalizeRoom(r as RoomInfo)),
    }
  } catch {
    return { version: 1, rooms: [] }
  }
}

function normalizeRoom(r: RoomInfo): RoomInfo {
  const log = Array.isArray(r.log) ? r.log.filter((e) => e && typeof e === 'object' && typeof e.id === 'string') : []
  return {
    id: String(r.id),
    name: String(r.name || '').slice(0, 80),
    members: Array.isArray(r.members) ? [...new Set(r.members.map((m) => String(m)))] : [],
    log: log.map((e) => ({
      id: String(e.id),
      from: { kind: e.from?.kind === 'user' ? 'user' : 'member', name: String(e.from?.name || '') },
      text: String(e.text ?? '').slice(0, 12000),
      at: Number(e.at ?? 0) || Date.now(),
      ...(e.thread ? { thread: String(e.thread) } : {}),
      ...(Array.isArray(e.images) && e.images.length ? { images: e.images } : {}),
    })),
    revision: Number(r.revision ?? 0) || 0,
    createdAt: Number(r.createdAt ?? 0) || Date.now(),
    updatedAt: Number(r.updatedAt ?? 0) || Date.now(),
  }
}

function writeRoomsRaw(data: RoomsFile): { ok: true } | { error: string } {
  try {
    mkdirSync(defaultDataDir(), { recursive: true })
    const tmp = `${ROOMS_FILE}.tmp`
    writeFileSync(tmp, JSON.stringify({ version: 1, rooms: data.rooms }, null, 2) + '\n')
    renameSync(tmp, ROOMS_FILE)
    return { ok: true }
  } catch (e) {
    return { error: String((e as Error)?.message || e) }
  }
}

/** 列出全部房间。 */
export function collectRooms(): RoomInfo[] {
  return readRoomsRaw().rooms.slice().sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 读取单个房间。 */
export function getRoom(id: string, lang: string = 'zh'): { ok: true; room: RoomInfo } | { error: string } {
  const room = readRoomsRaw().rooms.find((r) => r.id === String(id || '').trim())
  return room ? { ok: true, room } : { error: L(lang, '房间不存在', 'Room not found') }
}

export interface RoomSaveInput {
  id?: unknown
  name?: unknown
  members?: unknown
}

/** 新建或更新房间（成员必须是已存在的 Bot，≥2）。 */
export function saveRoom(input: RoomSaveInput, lang: string = 'zh'): { ok: true; room: RoomInfo } | { error: string } {
  const id = String(input.id ?? '').trim()
  const name = String(input.name ?? '').trim().slice(0, 80)
  if (!name) return { error: L(lang, '群聊名称不能为空', 'Room name is required') }
  const membersRaw = Array.isArray(input.members) ? input.members : []
  const members = [...new Set(membersRaw.map((m) => String(m).trim().toLowerCase()).filter(Boolean))]
  if (members.length < 2) return { error: L(lang, '至少选 2 个 Bot 才能建群聊', 'Pick at least 2 bots to create a group chat') }
  const known = new Set(collectBots().map((b) => b.name))
  const missing = members.filter((m) => !known.has(m))
  if (missing.length) return { error: L(lang, `这些 Bot 不存在：${missing.join('、')}`, `These bots do not exist: ${missing.join(', ')}`) }
  const data = readRoomsRaw()
  const now = Date.now()
  if (id) {
    const room = data.rooms.find((r) => r.id === id)
    if (!room) return { error: L(lang, '房间不存在', 'Room not found') }
    room.name = name
    room.members = members
    room.revision += 1
    room.updatedAt = now
    const w = writeRoomsRaw(data)
    if ('error' in w) return { error: L(lang, '写入失败：', 'Write failed: ') + w.error }
    return { ok: true, room }
  }
  const dup = data.rooms.find((r) => r.name === name)
  if (dup) return { error: L(lang, '同名群聊已存在', 'A room with this name already exists') }
  const room: RoomInfo = {
    id: `r${randomBytes(6).toString('hex')}`,
    name,
    members,
    log: [],
    revision: 1,
    createdAt: now,
    updatedAt: now,
  }
  data.rooms.push(room)
  const w = writeRoomsRaw(data)
  if ('error' in w) return { error: L(lang, '写入失败：', 'Write failed: ') + w.error }
  return { ok: true, room }
}

/** 删除房间。 */
export function deleteRoom(id: string, lang: string = 'zh'): { ok: true } | { error: string } {
  const data = readRoomsRaw()
  const idx = data.rooms.findIndex((r) => r.id === String(id || '').trim())
  if (idx === -1) return { error: L(lang, '房间不存在', 'Room not found') }
  data.rooms.splice(idx, 1)
  const w = writeRoomsRaw(data)
  if ('error' in w) return { error: L(lang, '写入失败：', 'Write failed: ') + w.error }
  return { ok: true }
}

export interface RoomEntryInput {
  from: { kind: 'user' | 'member'; name: string }
  text: string
  thread?: string
  images?: unknown[]
}

/** 追加一条房间消息（P3 群聊轮转用；P1 只落存储）。 */
export function appendRoomEntry(id: string, input: RoomEntryInput, lang: string = 'zh'): { ok: true; room: RoomInfo; entry: RoomEntry } | { error: string } {
  const data = readRoomsRaw()
  const room = data.rooms.find((r) => r.id === String(id || '').trim())
  if (!room) return { error: L(lang, '房间不存在', 'Room not found') }
  const text = String(input.text ?? '').trim().slice(0, 12000)
  if (!text) return { error: L(lang, '消息不能为空', 'Message is empty') }
  const entry: RoomEntry = {
    id: randomBytes(8).toString('hex'),
    from: { kind: input.from?.kind === 'user' ? 'user' : 'member', name: String(input.from?.name || '') },
    text,
    at: Date.now(),
    ...(input.thread ? { thread: String(input.thread) } : {}),
    ...(Array.isArray(input.images) && input.images.length ? { images: input.images.slice(0, 6) } : {}),
  }
  room.log.push(entry)
  room.revision += 1
  room.updatedAt = entry.at
  const w = writeRoomsRaw(data)
  if ('error' in w) return { error: L(lang, '写入失败：', 'Write failed: ') + w.error }
  return { ok: true, room, entry }
}
