// 侧栏面板数据采集（只读）：助理（Agent 预设）/ 专家技能 / 连接器 / 自动化
// 说明：全部从共享区与只读状态读取，不改任何文件；供 portal.ts 的 /portal/api/panel/* 使用。
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { DatabaseSync } from 'node:sqlite'
import { defaultDataDir } from './db.ts'
// 与 dsh-agents-md 插件共用同一份 agents/*.md 解析/校验（纯 JS，零依赖）
import { normalizeAgentDef, parseAgentMd } from '../plugin/dsh-agents-md/lib/scan.js'
import { zstdDecompressSync } from 'node:zlib'
import { userHome } from './session-mgr.ts'

const L = (lang: string, zh: string, en: string): string => (lang === 'en' ? en : zh)

const PRESETS_DIR = join(defaultDataDir(), 'presets')
const SYSTEM_PRESETS_DIR = process.env.DESK_SYSTEM_PRESETS || '/opt/deepseek-harness/packages/preset/agent-presets/presets'
const SKILLS_DIR = join(defaultDataDir(), 'skills')

export interface PresetInfo {
  id: string
  name: string
  description: string
  order: number
  codex: boolean
  defaultHint: boolean
  trust: 'system' | 'user'
}

export interface SkillInfo {
  id: string
  name: string
  description: string
  whenToUse: string
}

function readText(p: string): string {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}

/** 扁平 YAML：只取顶层 `key: value` 行（够 preset.yml 这种简单元数据用） */
function flatYaml(src: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of src.split(/\r?\n/)) {
    if (/^\s/.test(line)) continue
    const m = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

/** SKILL.md / 预设文件的 YAML frontmatter（--- 包起来的一段） */
function frontmatter(src: string): Record<string, string> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src)
  if (!m) return {}
  const out: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const mm = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line)
    if (mm) out[mm[1]] = mm[2].trim()
  }
  return out
}

function scanPresetDir(dir: string, trust: 'system' | 'user'): PresetInfo[] {
  let ids: string[] = []
  try {
    ids = readdirSync(dir).filter((n) => {
      try {
        return statSync(join(dir, n)).isDirectory()
      } catch {
        return false
      }
    })
  } catch {
    // 目录不存在按空处理
  }
  const out: PresetInfo[] = []
  for (const id of ids) {
    const meta = flatYaml(readText(join(dir, id, 'preset.yml')))
    const agent = readText(join(dir, id, 'agent.cordis.yml'))
    out.push({
      id,
      name: meta.name || id,
      description: meta.description || '',
      order: Number(meta.order ?? 100) || 100,
      codex: meta.codex === 'true',
      defaultHint: meta.defaultHint === 'true',
      trust,
    })
  }
  out.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  return out
}

/** 团队角色（共享目录）在前 + 引擎自带模式（系统目录）在后；同名以共享目录为准。 */
export function collectPresets(): PresetInfo[] {
  const user = scanPresetDir(PRESETS_DIR, 'user')
  const seen = new Set(user.map((p) => p.id))
  const sys = scanPresetDir(SYSTEM_PRESETS_DIR, 'system').filter((p) => !seen.has(p.id))
  return [...user, ...sys]
}

export function collectSkills(): SkillInfo[] {
  let ids: string[] = []
  try {
    ids = readdirSync(SKILLS_DIR).filter((n) => existsSync(join(SKILLS_DIR, n, 'SKILL.md')))
  } catch {
    // 目录不存在按空处理
  }
  const out: SkillInfo[] = []
  for (const id of ids) {
    const fm = frontmatter(readText(join(SKILLS_DIR, id, 'SKILL.md')))
    out.push({ id, name: fm.name || id, description: fm.description || '', whenToUse: fm.whenToUse || '' })
  }
  out.sort((a, b) => a.id.localeCompare(b.id))
  return out
}

export function readSkill(id: string, lang: string = 'zh'): { ok: true; id: string; content: string } | { error: string } {
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(id) || id.includes('..')) return { error: L(lang, '名称不合法', 'Invalid name') }
  const p = join(SKILLS_DIR, id, 'SKILL.md')
  if (!existsSync(p)) return { error: L(lang, '技能不存在', 'Skill not found') }
  return { ok: true, id, content: readText(p).slice(0, 80000) }
}

export interface ConnectorInfo {
  name: string
  ok: boolean | null
  detail: string
}

/** 连接器面板卡片：消息平台（notify_routes）+ 会议 / 工作平台（platform_conns）+ 规划中。 */
export interface PlatformInfo {
  id: string
  name: string
  kind: string
  desc: string
  hint: string
  group: 'msg' | 'meet' | 'work'
  mode: 'notify' | 'conn' | 'plan' | 'wxmine'
  type: string
  connected: boolean
  routes: number
  routesEnabled: number
  display?: string
  openUrl?: string
}

export function collectPlatforms(db: DatabaseSync, lang: string = 'zh', username?: string): PlatformInfo[] {
  let routes: { name: string; kind: string; enabled: number }[] = []
  try {
    routes = db.prepare(`SELECT name, kind, enabled FROM notify_routes ORDER BY id`).all() as unknown as { name: string; kind: string; enabled: number }[]
  } catch {
    // 表缺失按空处理
  }
  let conns: { platform: string; config: string; updated_at: string }[] = []
  try {
    conns = db.prepare(`SELECT platform, config, updated_at FROM platform_conns`).all() as unknown as { platform: string; config: string; updated_at: string }[]
  } catch {
    // 表缺失按空处理
  }
  const defs: { id: string; kind: string; name: string; desc: string; hint: string; group: 'msg' | 'meet' | 'work'; mode: 'notify' | 'conn' | 'plan' | 'wxmine'; type: string }[] = [
    { id: 'wx-mine', kind: '', name: L(lang, '我的微信', 'My WeChat'), desc: L(lang, '把工作台接到你的微信：团队通知直接进微信，也能像聊天一样指挥你的助理', 'Connect your WeChat: team notifications right in WeChat — and chat with your workbench assistant'), hint: '', group: 'msg', mode: 'wxmine', type: '' },
        { id: 'telegram', kind: 'telegram', name: 'Telegram', desc: L(lang, '群里 / 私聊直达（Bot API）', 'Bot API — direct to chats'), hint: L(lang, 'bot_token|chat_id（可加 |api_base）', 'bot_token|chat_id (optional |api_base)'), group: 'msg', mode: 'notify', type: '' },
    { id: 'feishu', kind: 'feishu', name: L(lang, '飞书 Feishu', 'Feishu / Lark'), desc: L(lang, '群机器人 Webhook——贴一个地址就能推', 'Custom-bot webhook — paste the URL'), hint: L(lang, '飞书群机器人 Webhook 地址', 'Feishu bot webhook URL'), group: 'msg', mode: 'notify', type: '' },
    { id: 'dingtalk', kind: 'dingtalk', name: L(lang, '钉钉', 'DingTalk'), desc: L(lang, '群机器人 Webhook，支持加签', 'Robot webhook with optional secret signing'), hint: L(lang, 'webhook地址[|加签Secret]', 'webhook URL[|secret]'), group: 'msg', mode: 'notify', type: '' },
    { id: 'wecom', kind: 'wecom', name: L(lang, '企业微信', 'WeCom'), desc: L(lang, '群机器人 Webhook——公司群里发通知', 'Group-robot webhook — notify a company group'), hint: L(lang, '企微群机器人 Webhook 地址', 'WeCom bot webhook URL'), group: 'msg', mode: 'notify', type: '' },
    { id: 'discord', kind: 'discord', name: 'Discord', desc: L(lang, '频道 Webhook——社区群里同步', 'Channel webhook — sync into a community server'), hint: L(lang, '频道 Webhook 地址', 'Channel webhook URL'), group: 'msg', mode: 'notify', type: '' },
    { id: 'slack', kind: 'slack', name: 'Slack', desc: L(lang, 'Incoming Webhook', 'Incoming webhook'), hint: L(lang, 'Incoming Webhook 地址', 'Incoming webhook URL'), group: 'msg', mode: 'notify', type: '' },
    { id: 'teams', kind: 'teams', name: 'Microsoft Teams', desc: L(lang, '频道 Incoming Webhook', 'Channel incoming webhook'), hint: L(lang, '频道 Webhook 地址', 'Channel webhook URL'), group: 'msg', mode: 'notify', type: '' },
    { id: 'whatsapp', kind: 'whatsapp', name: 'WhatsApp', desc: L(lang, '经 CallMeBot / GreenAPI / UltraMsg', 'Via CallMeBot / GreenAPI / UltraMsg'), hint: L(lang, 'callmebot|apikey|手机号（或 greenapi / ultramsg 格式）', 'callmebot|apikey|phone (or greenapi / ultramsg format)'), group: 'msg', mode: 'notify', type: '' },
    { id: 'ntfy', kind: 'ntfy', name: L(lang, 'ntfy 手机推送', 'ntfy push'), desc: L(lang, '手机装个 App 就收推送——最省事的兜底', 'Install the app and get phone push — the easiest fallback'), hint: L(lang, '主题名（如 anywork-bai）[|服务器[|Token]]', 'topic (e.g. anywork-bai) [|server[|token]]'), group: 'msg', mode: 'notify', type: '' },
    { id: 'webhook', kind: 'webhook', name: L(lang, '自定义 Webhook', 'Custom webhook'), desc: L(lang, '接你自己的系统——给个地址就发 JSON', 'Post JSON to your own endpoint'), hint: L(lang, 'http(s):// 地址', 'http(s):// URL'), group: 'msg', mode: 'notify', type: '' },
    { id: 'meeting-tencent', kind: '', name: L(lang, '腾讯会议', 'Tencent Meeting'), desc: L(lang, '存好会议链接 / 会议号——提醒和公告可以带上它', 'Keep your meeting link / number — reminders and notices can carry it'), hint: L(lang, '会议链接（https://meeting.tencent.com/dm/…）或 9~11 位会议号', 'Meeting link (https://meeting.tencent.com/dm/…) or a 9–11 digit number'), group: 'meet', mode: 'conn', type: 'link' },
    { id: 'zoom', kind: 'zoom', name: 'Zoom', desc: L(lang, '推到 Zoom 聊天（Incoming Webhook，付费版可用）', 'Push to Zoom Team Chat (incoming webhook; paid plans)'), hint: L(lang, 'Zoom 客户端 → 聊天 → 应用 → Incoming Webhook → 添加 → 复制地址', 'Zoom app → Chat → Apps → Incoming Webhook → add → copy the URL'), group: 'meet', mode: 'notify', type: '' },
    { id: 'github', kind: '', name: 'GitHub', desc: L(lang, '团队仓库联动——验证并保存令牌，为「AI 代提 issue / 看仓库」打底', 'Team repo link — store a token as groundwork for AI filing issues'), hint: L(lang, 'Personal Access Token（github.com → Settings → Developer settings → Tokens）', 'Personal access token (github.com → Settings → Developer settings → Tokens)'), group: 'work', mode: 'conn', type: 'token' },
    { id: 'notion', kind: '', name: 'Notion', desc: L(lang, '把通知 / 笔记写进 Notion——验证并保存集成 Token', 'Write notes into Notion — store an integration token'), hint: L(lang, '集成 Token（notion.so/my-integrations 新建集成后复制）', 'Integration token (create one at notion.so/my-integrations)'), group: 'work', mode: 'conn', type: 'token' },
  ]
  return defs.map((d) => {
    const base: PlatformInfo = {
      id: d.id,
      name: d.name,
      kind: d.kind,
      desc: d.desc,
      hint: d.hint,
      group: d.group,
      mode: d.mode,
      type: d.type,
      connected: false,
      routes: 0,
      routesEnabled: 0,
    }
    if (d.mode === 'wxmine') {
      try {
        base.connected = !!(username && db.prepare(`SELECT id FROM wx_chat WHERE account = ? AND enabled = 1`).get(username))
      } catch {
        base.connected = false
      }
    } else if (d.mode === 'notify') {
      const mine = routes.filter((r) => r.kind === d.kind)
      base.connected = mine.some((r) => r.enabled === 1)
      base.routes = mine.length
      base.routesEnabled = mine.filter((r) => r.enabled === 1).length
    } else if (d.mode === 'conn') {
      const row = conns.find((c) => c.platform === d.id)
      if (row) {
        base.connected = true
        if (d.type === 'link') {
          base.display = row.config
          const c = row.config.trim()
          if (/^https?:\/\//.test(c)) base.openUrl = c
        }
      }
    }
    return base
  })
}

/** 连接器状态（只读探测）：模型网关 / 通知 / Codex / GitHub / 共享区 */
export function collectConnectors(db: DatabaseSync, lang: string = 'zh'): ConnectorInfo[] {
  const items: ConnectorInfo[] = []

  let chNames: string[] = []
  try {
    const rows = db.prepare(`SELECT name, enabled FROM channels ORDER BY id`).all() as unknown as { name: string; enabled: number }[]
    chNames = rows.map((r) => r.name + (r.enabled ? '' : L(lang, '（停用）', ' (disabled)')))
  } catch {
    // 表缺失按空处理
  }
  items.push({
    name: L(lang, '模型网关', 'Model gateway'),
    ok: true,
    detail: L(lang, '默认 DeepSeek 网关在岗', 'Default DeepSeek gateway is up') + (chNames.length ? L(lang, `；外部通道 ${chNames.length} 个：${chNames.join('、')}`, `; ${chNames.length} external channel(s): ${chNames.join(', ')}`) : L(lang, '；当前无外部通道', '; no external channels yet')),
  })

  // 通知类通道（微信 / Telegram / WhatsApp / 各平台机器人）已改由「消息平台」面板呈现（collectPlatforms）

  const codexCandidates = [
    join(homedir(), 'opt', 'node-v24.19.0-linux-x64', 'bin', 'codex'),
    join(homedir(), '.local', 'bin', 'codex'),
  ]
  const codexBin = codexCandidates.find((p) => existsSync(p)) || ''
  const codexAuth = existsSync(join(homedir(), '.codex', 'auth.json'))
  items.push({
    name: L(lang, 'Codex（并行 / 子代理引擎）', 'Codex (parallel / subagent engine)'),
    ok: codexBin ? codexAuth : null,
    detail: codexBin
      ? codexAuth
        ? L(lang, '已接入：可派子代理与 worktree 并行（消耗你的 Codex 账号额度）', 'Connected: dispatch subagents and run worktree parallelism (bills your Codex account)')
        : L(lang, '已安装，但登录态缺失（需 codex login）', 'Installed, but not signed in (run codex login)')
      : L(lang, '未安装（可选）', 'Not installed (optional)'),
  })

  const ghHosts = readText(join(homedir(), '.config', 'gh', 'hosts.yml'))
  const ghUser = /user:\s*(\S+)/.exec(ghHosts)?.[1] ?? ''
  items.push({ name: 'GitHub CLI', ok: ghUser ? true : null, detail: ghUser ? L(lang, `已登录：${ghUser}`, `Signed in: ${ghUser}`) : L(lang, '未登录（可选）', 'Not signed in (optional)') })

  const kbOk = existsSync(join(defaultDataDir(), 'kb'))
  const driveOk = existsSync(join(defaultDataDir(), 'drive'))
  items.push({
    name: L(lang, '知识库 / 公司盘', 'Knowledge base / Company drive'),
    ok: kbOk && driveOk,
    detail: L(lang, `知识库 ${kbOk ? '✓' : '✗'} · 公司盘 ${driveOk ? '✓' : '✗'}（共享区，每实例软链）`, `Knowledge base ${kbOk ? '✓' : '✗'} · Company drive ${driveOk ? '✓' : '✗'} (shared area, symlinked into every instance)`),
  })

  items.push({
    name: L(lang, '技能库 / Agent 预设', 'Skills / Agent presets'),
    ok: true,
    detail: L(lang, `共享技能 ${collectSkills().length} 个 · 预设 ${collectPresets().length} 个（改动即生效）`, `${collectSkills().length} shared skills · ${collectPresets().length} presets (changes apply immediately)`),
  })

  return items
}
// —— 子代理定义（agents/*.md；与 dsh-agents-md 插件共用同一解析器） ——

export interface AgentDefInfo {
  fileName: string
  name: string
  description: string
  tools?: string[]
  disallowedTools?: string[]
  model?: string
  effort?: string
  provider?: string
  background?: boolean
  maxDepth?: number
  color?: string
  persona: string
  mtimeMs: number
  ok: boolean
  errors: string[]
  warnings: string[]
}

const AGENTS_DIR = join(defaultDataDir(), 'agents')
const AGENT_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\.md$/

function toAgentInfo(fileName: string, mtimeMs: number, text: string): AgentDefInfo {
  const parsed = parseAgentMd(text)
  if ('error' in parsed) {
    return { fileName, name: fileName.replace(/\.md$/i, ''), description: '', persona: '', mtimeMs, ok: false, errors: [parsed.error], warnings: [] }
  }
  const def = normalizeAgentDef({ file: join(AGENTS_DIR, fileName), source: AGENTS_DIR, data: parsed.data, body: parsed.body, parseWarnings: parsed.warnings })
  return {
    fileName,
    name: def.name || fileName.replace(/\.md$/i, ''),
    description: def.description || '',
    tools: def.tools,
    disallowedTools: def.disallowedTools,
    model: def.model,
    effort: def.effort,
    provider: def.provider,
    background: def.background,
    maxDepth: def.maxDepth,
    color: def.color,
    persona: (def.persona || '').slice(0, 1200),
    mtimeMs,
    ok: def.errors.length === 0,
    errors: def.errors,
    warnings: def.warnings,
  }
}

/** 列出共享目录下的全部子代理定义（含错误/告警），供面板展示。 */
export function collectAgents(): AgentDefInfo[] {
  let names: string[] = []
  try {
    names = readdirSync(AGENTS_DIR).filter((n) => n.toLowerCase().endsWith('.md') && !n.startsWith('.')).sort()
  } catch {
    // 目录不存在按空处理
  }
  const out: AgentDefInfo[] = []
  for (const n of names) {
    try {
      const st = statSync(join(AGENTS_DIR, n))
      out.push(toAgentInfo(n, st.mtimeMs, readText(join(AGENTS_DIR, n))))
    } catch {
      // 读不了就跳过
    }
  }
  return out
}

function agentPath(fileName: string): string | null {
  const n = String(fileName || '').trim()
  if (!AGENT_FILE_RE.test(n) || n.includes('..')) return null
  return join(AGENTS_DIR, n)
}

/** 读取单个定义的原文（编辑器用）。 */
export function readAgent(fileName: string, lang: string = 'zh'): { ok: true; fileName: string; content: string } | { error: string } {
  const p = agentPath(fileName)
  if (!p) return { error: L(lang, '文件名不合法（需要 <名称>.md）', 'Invalid file name (expected <name>.md)') }
  if (!existsSync(p)) return { error: L(lang, '定义不存在', 'Definition not found') }
  return { ok: true, fileName, content: readText(p).slice(0, 60000) }
}

/** 保存定义（先校验：有硬错误直接拒绝并回复原因）。 */
export function saveAgent(fileName: string, content: string, lang: string = 'zh'): { ok: true; fileName: string; def: AgentDefInfo } | { error: string } {
  const p = agentPath(fileName)
  if (!p) return { error: L(lang, '文件名不合法（需要 <名称>.md，仅字母数字 . _ -）', 'Invalid file name (expected <name>.md; letters, digits, . _ - only)') }
  const text = String(content ?? '')
  if (!text.trim()) return { error: L(lang, '内容不能为空', 'Content cannot be empty') }
  if (text.length > 60000) return { error: L(lang, '内容过长（>60KB）', 'Content too large (>60KB)') }
  const parsed = parseAgentMd(text)
  if ('error' in parsed) return { error: L(lang, '保存被拒：', 'Save rejected: ') + parsed.error }
  const def = normalizeAgentDef({ file: p, source: AGENTS_DIR, data: parsed.data, body: parsed.body, parseWarnings: parsed.warnings })
  if (def.errors.length) return { error: L(lang, '保存被拒，定义有错误：', 'Save rejected, definition has errors: ') + def.errors.join('; ') }
  try {
    mkdirSync(AGENTS_DIR, { recursive: true })
    writeFileSync(p, text.endsWith('\n') ? text : text + '\n')
  } catch (e) {
    return { error: L(lang, '写入失败：', 'Write failed: ') + String((e as Error)?.message || e) }
  }
  const st = statSync(p)
  return { ok: true, fileName, def: toAgentInfo(fileName, st.mtimeMs, text) }
}

/** 删除定义。 */
export function deleteAgent(fileName: string, lang: string = 'zh'): { ok: true } | { error: string } {
  const p = agentPath(fileName)
  if (!p) return { error: L(lang, '文件名不合法', 'Invalid file name') }
  if (!existsSync(p)) return { error: L(lang, '定义不存在', 'Definition not found') }
  try {
    unlinkSync(p)
  } catch (e) {
    return { error: L(lang, '删除失败：', 'Delete failed: ') + String((e as Error)?.message || e) }
  }
  return { ok: true }
}
// —— 子代理活动（跨成员聚合「最近委派」；含指派链与子会话工作步骤） ——

export interface AgentRunStep {
  kind: 'task' | 'tool' | 'say'
  text: string
  time: number
}

export interface AgentRunInfo {
  time: number
  user: string
  sessionId: string
  title: string
  tool: string
  type: string
  label: string
  mode: string
  childId: string
  state: 'returned' | 'background' | 'bg-done' | 'continuable' | 'running'
  ask: string
  prompt: string
  model: string
  steps: AgentRunStep[]
  result: string
  durationMs: number
}

const DELEGATE_TOOLS = new Set(['agent', 'subagent', 'subagent_fork', 'subagent_codex', 'subagent_claude_code'])

interface RunRowLite {
  time: number
  sessionId: string
  tool: string
  type: string
  label: string
  mode: string
  childId: string
  state: 'returned' | 'background' | 'continuable' | 'running'
  ask: string
  prompt: string
  result: string
}

const runFileCache = new Map<string, { key: string; sid: string; rows: RunRowLite[] }>()
const childFileCache = new Map<string, { key: string; steps: AgentRunStep[]; lastAssistant: string; lastEventTime: number }>()

function decodeSessionEventsFile(file: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  let buf: Buffer
  try {
    buf = readFileSync(file)
  } catch {
    return out
  }
  const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const idxs: number[] = []
  let i = buf.indexOf(magic)
  while (i !== -1) {
    idxs.push(i)
    i = buf.indexOf(magic, i + 1)
  }
  const parts: Buffer[] = []
  for (let k = 0; k < idxs.length; k++) {
    const end = k + 1 < idxs.length ? idxs[k + 1] : buf.length
    try {
      parts.push(zstdDecompressSync(buf.subarray(idxs[k], end)))
    } catch {
      // 跳坏帧（正在追写的尾部）
    }
  }
  for (const line of Buffer.concat(parts).toString('utf8').split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      const ev = JSON.parse(t) as unknown
      if (ev && typeof ev === 'object') out.push(ev as Record<string, unknown>)
    } catch {
      // 半行
    }
  }
  return out
}

function extractRuns(events: Record<string, unknown>[], sid: string): RunRowLite[] {
  interface Call { seq: number; callId: string; name: string; type: string; desc: string; prompt: string; ask: string; time: number }
  const calls: Call[] = []
  const catalogs: { seq: number; childId: string; label: string; mode: string; createdAt: number; time: number }[] = []
  const resultText = new Map<string, string>()
  let lastUserText = ''
  for (const ev of events) {
    const type = String(ev.type ?? '')
    const data = (ev.data ?? {}) as Record<string, unknown>
    if (type === 'user/message') {
      const msg = (data.message ?? {}) as Record<string, unknown>
      const content = ((data.content ?? msg.content) ?? []) as unknown[]
      let t = ''
      for (const b of content) {
        if (b && typeof b === 'object' && (b as Record<string, unknown>).type === 'text') t += String((b as Record<string, unknown>).text ?? '')
      }
      t = t.trim().replace(/\s+/g, ' ')
      if (t && t.indexOf('<system-reminder') !== 0 && t.indexOf('Current runtime context') !== 0) lastUserText = t.slice(0, 220)
    } else if (type === 'tool/call') {
      const name = String(data.name ?? '')
      if (!DELEGATE_TOOLS.has(name)) continue
      let subagentType = ''
      let desc = ''
      let prompt = ''
      try {
        const args = JSON.parse(String(data.arguments ?? '{}')) as Record<string, unknown>
        subagentType = String(args.subagent_type ?? '')
        desc = String(args.description ?? '')
        prompt = String(args.prompt ?? '').replace(/\s+/g, ' ').slice(0, 400)
      } catch {
        // 参数不是 JSON
      }
      calls.push({ seq: Number(ev.seq ?? 0), callId: String(data.callId ?? ''), name, type: subagentType, desc, prompt, ask: lastUserText, time: Number(ev.time ?? 0) })
    } else if (type === 'subagent/catalog') {
      catalogs.push({
        seq: Number(ev.seq ?? 0),
        childId: String(data.childId ?? ''),
        label: String(data.label ?? ''),
        mode: String(data.mode ?? ''),
        createdAt: Number(data.childCreatedAt ?? 0),
        time: Number(ev.time ?? 0),
      })
    } else if (type === 'tool/result') {
      const msg = (data.message ?? {}) as Record<string, unknown>
      const source = (msg.source ?? {}) as Record<string, unknown>
      const callId = String(source.callId ?? '')
      if (!callId) continue
      const content = (msg.content ?? []) as unknown[]
      let text = ''
      for (const block of content) {
        if (!block || typeof block !== 'object') continue
        const inner = (block as Record<string, unknown>).content
        if (!Array.isArray(inner)) continue
        for (const ib of inner) {
          if (ib && typeof ib === 'object' && (ib as Record<string, unknown>).type === 'text') {
            text += String((ib as Record<string, unknown>).text ?? '')
          }
        }
      }
      resultText.set(callId, text)
    }
  }
  const rows: RunRowLite[] = []
  let ci = 0
  for (const call of calls.sort((a, b) => a.seq - b.seq)) {
    let cat: (typeof catalogs)[number] | undefined
    for (; ci < catalogs.length; ci++) {
      if (catalogs[ci].seq > call.seq) {
        cat = catalogs[ci]
        ci++
        break
      }
    }
    const res = resultText.get(call.callId)
    const state: RunRowLite['state'] = res === undefined
      ? 'running'
      : res.includes('started background agent job')
        ? 'background'
        : res.includes('started subagent')
          ? 'continuable'
          : 'returned'
    rows.push({
      time: cat?.createdAt || call.time,
      sessionId: sid,
      tool: call.name,
      type: call.type,
      label: (cat?.label || call.desc || '').slice(0, 80),
      mode: cat?.mode ?? '',
      childId: cat?.childId ?? '',
      state,
      ask: call.ask,
      prompt: call.prompt,
      result: (res ?? '').slice(0, 3000),
    })
  }
  return rows
}

function sessionTitleOf(home: string, sid: string): string {
  try {
    const f = join(home, 'storages', 'session_projcache', 'sessions', `${sid}.json`)
    const raw = JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>
    const rec = (raw.record ?? raw) as Record<string, unknown>
    const rows = (rec.rows ?? {}) as Record<string, unknown>
    const title = rows.title as Record<string, unknown> | undefined
    const val = title?.val as unknown
    if (typeof val === 'string') return val.slice(0, 60)
    if (val && typeof val === 'object') {
      const t = (val as Record<string, unknown>).text ?? (val as Record<string, unknown>).value
      if (typeof t === 'string') return t.slice(0, 60)
    }
  } catch {
    // 无标题
  }
  return ''
}

function findSessionFileUnder(sdir: string, sid: string): string | null {
  let buckets: string[] = []
  try {
    buckets = readdirSync(sdir)
  } catch {
    return null
  }
  for (const b of buckets) {
    const dir = join(sdir, b, sid)
    try {
      const files = readdirSync(dir)
      const cand = files.find((n) => /^session(\.v\d+)?\.jsonl\.zstd$/.test(n))
      if (cand) return join(dir, cand)
    } catch {
      // 不在这个桶
    }
  }
  return null
}

function extractChildSteps(events: Record<string, unknown>[]): { steps: AgentRunStep[]; lastAssistant: string; lastEventTime: number } {
  const steps: AgentRunStep[] = []
  let lastAssistant = ''
  let lastEventTime = 0
  for (const ev of events) {
    const t = String(ev.type ?? '')
    const d = (ev.data ?? {}) as Record<string, unknown>
    const time = Number(ev.time ?? 0)
    if (time) lastEventTime = Math.max(lastEventTime, time)
    if (t === 'tool/call') {
      const name = String(d.name ?? '')
      let argInfo = ''
      try {
        const a = JSON.parse(String(d.arguments ?? '{}')) as Record<string, unknown>
        const pick = a.path ?? a.file_path ?? a.command ?? a.query ?? a.pattern ?? a.url
        if (pick !== undefined) argInfo = String(pick).replace(/\s+/g, ' ').slice(0, 70)
      } catch {
        // 非 JSON
      }
      steps.push({ kind: 'tool', text: argInfo ? `${name}：${argInfo}` : name, time })
    } else if (t === 'assistant/message') {
      const msg = (d.message ?? {}) as Record<string, unknown>
      const content = (msg.content ?? []) as unknown[]
      let s = ''
      for (const b of content) {
        if (b && typeof b === 'object' && (b as Record<string, unknown>).type === 'text') s += String((b as Record<string, unknown>).text ?? '')
      }
      s = s.trim()
      if (s) {
        lastAssistant = s
        steps.push({ kind: 'say', text: s.replace(/\s+/g, ' ').slice(0, 140), time })
      }
    }
  }
  return { steps: steps.slice(-14), lastAssistant: lastAssistant.slice(0, 3000), lastEventTime }
}

// —— 主对话默认模型（按成员读 settings.yaml 的 agent-default-model 段） ——

export interface MainModelInfo {
  provider: string
  model: string
  reasoningEffort?: string
}

export function readMainModel(username: string): MainModelInfo | null {
  try {
    const f = join(userHome(username), 'settings.yaml')
    const text = readFileSync(f, 'utf8')
    const m = /agent-default-model:\s*\n((?:[ \t]+[^\n]*\n?)+)/.exec(text)
    const block = m ? m[1] : ''
    if (!block) return null
    const provider = (/^\s*provider:\s*([^\s#]+)/m.exec(block) ?? [])[1] ?? ''
    const model = (/^\s*model:\s*([^\s#]+)/m.exec(block) ?? [])[1] ?? ''
    if (!model) return null
    const eff = (/^\s*reasoningEffort:\s*([^\s#]+)/m.exec(block) ?? [])[1]
    return { provider, model, ...(eff ? { reasoningEffort: eff } : {}) }
  } catch {
    return null
  }
}

/** 只改定义里的 model 字段（快速指派；传空 = 移除该字段 → 跟随对话）。 */
export function setAgentModel(fileName: string, model: string, lang: string = 'zh'): { ok: true; fileName: string; model: string } | { error: string } {
  const p = agentPath(fileName)
  if (!p) return { error: L(lang, '文件名不合法', 'Invalid file name') }
  if (!existsSync(p)) return { error: L(lang, '定义不存在', 'Definition not found') }
  const val = String(model ?? '').trim()
  if (val && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(val)) return { error: L(lang, '模型名不合法', 'Invalid model id') }
  let text = ''
  try {
    text = readText(p)
  } catch (e) {
    return { error: L(lang, '读取失败：', 'Read failed: ') + String((e as Error)?.message || e) }
  }
  const lines = text.split('\n')
  let close = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      close = i
      break
    }
  }
  if (close === -1) return { error: L(lang, 'frontmatter 未闭合（先修好定义再改模型）', 'frontmatter is not closed') }
  let idx = -1
  for (let i = 1; i < close; i++) {
    if (/^model\s*:/.test(lines[i])) {
      idx = i
      break
    }
  }
  if (val) {
    const line = `model: ${val}`
    if (idx >= 0) lines[idx] = line
    else lines.splice(close, 0, line)
  } else if (idx >= 0) {
    lines.splice(idx, 1)
  }
  try {
    writeFileSync(p, lines.join('\n'))
  } catch (e) {
    return { error: L(lang, '写入失败：', 'Write failed: ') + String((e as Error)?.message || e) }
  }
  return { ok: true, fileName, model: val }
}

/** 聚合各成员最近 7 天的子代理委派（按发起时间倒序；含指派链/步骤/结果）。 */
export function collectAgentRuns(db: DatabaseSync, limit = 30, viewer?: { user: string }): AgentRunInfo[] {
  let members: { username: string }[] = []
  try {
    members = db.prepare(`SELECT username FROM users WHERE agent_port IS NOT NULL ORDER BY id`).all() as unknown as { username: string }[]
  } catch {
    return []
  }
  if (viewer) members = members.filter((m) => m.username === viewer.user)
  const defsByName = new Map<string, AgentDefInfo>()
  try {
    for (const d of collectAgents()) if (d.name) defsByName.set(d.name, d)
  } catch {
    // 忽略定义扫描失败
  }
  const cutoff = Date.now() - 7 * 86400 * 1000
  const titleCache = new Map<string, string>()
  const all: AgentRunInfo[] = []
  for (const m of members) {
    const home = userHome(m.username)
    const sdir = join(home, 'sessions')
    let buckets: string[] = []
    try {
      buckets = readdirSync(sdir)
    } catch {
      continue
    }
    const files: { file: string; sid: string; mtime: number; size: number }[] = []
    for (const b of buckets) {
      const bd = join(sdir, b)
      let sids: string[] = []
      try {
        sids = readdirSync(bd)
      } catch {
        continue
      }
      for (const sid of sids) {
        const sd = join(bd, sid)
        let fs: string[] = []
        try {
          fs = readdirSync(sd)
        } catch {
          continue
        }
        for (const f of fs) {
          if (!/^session(\.v\d+)?\.jsonl\.zstd$/.test(f)) continue
          const full = join(sd, f)
          try {
            const st = statSync(full)
            if (st.mtimeMs >= cutoff) files.push({ file: full, sid, mtime: st.mtimeMs, size: st.size })
          } catch {
            // 跳过
          }
        }
      }
    }
    files.sort((a, b) => b.mtime - a.mtime)
    for (const f of files.slice(0, 40)) {
      const key = `${f.size}:${f.mtime}`
      const cached = runFileCache.get(f.file)
      let rows: RunRowLite[]
      if (cached && cached.key === key) {
        rows = cached.rows
      } else {
        rows = extractRuns(decodeSessionEventsFile(f.file), f.sid)
        runFileCache.set(f.file, { key, sid: f.sid, rows })
        if (runFileCache.size > 800) {
          const first = runFileCache.keys().next().value
          if (first !== undefined) runFileCache.delete(first)
        }
      }
      for (const r of rows) {
        let title = titleCache.get(f.sid)
        if (title === undefined) {
          title = sessionTitleOf(home, f.sid)
          titleCache.set(f.sid, title)
        }
        let state: AgentRunInfo['state'] = r.state
        let steps: AgentRunStep[] = []
        let result = r.result
        let durationMs = 0
        let childMtime = 0
        if (r.childId) {
          const cf = findSessionFileUnder(sdir, r.childId)
          if (cf) {
            try {
              const st = statSync(cf)
              childMtime = st.mtimeMs
              const ckey = `${st.size}:${st.mtimeMs}`
              let ch = childFileCache.get(cf)
              if (!ch || ch.key !== ckey) {
                ch = { key: ckey, ...extractChildSteps(decodeSessionEventsFile(cf)) }
                childFileCache.set(cf, ch)
                if (childFileCache.size > 300) {
                  const first = childFileCache.keys().next().value
                  if (first !== undefined) childFileCache.delete(first)
                }
              }
              steps = ch.steps
              if ((state === 'background' || state === 'bg-done') && ch.lastAssistant) result = ch.lastAssistant
              if (ch.lastEventTime && r.time) durationMs = Math.max(0, ch.lastEventTime - r.time)
            } catch {
              // 跳过子会话
            }
          }
          if (state === 'background' && childMtime && Date.now() - childMtime > 90000) state = 'bg-done'
        }
        const def = defsByName.get(r.type)
        all.push({ ...r, state, steps, result, durationMs, user: m.username, title, model: def?.model ?? '' })
      }
    }
  }
  all.sort((a, b) => b.time - a.time)
  return all.slice(0, limit)
}
