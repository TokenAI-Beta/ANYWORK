// 侧栏面板数据采集（只读）：助理（Agent 预设）/ 专家技能 / 连接器 / 自动化
// 说明：全部从共享区与只读状态读取，不改任何文件；供 portal.ts 的 /portal/api/panel/* 使用。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { DatabaseSync } from 'node:sqlite'
import { defaultDataDir } from './db.ts'

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
  mode: 'notify' | 'conn' | 'plan'
  type: string
  connected: boolean
  routes: number
  routesEnabled: number
  display?: string
  openUrl?: string
}

export function collectPlatforms(db: DatabaseSync, lang: string = 'zh'): PlatformInfo[] {
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
  const defs: { id: string; kind: string; name: string; desc: string; hint: string; group: 'msg' | 'meet' | 'work'; mode: 'notify' | 'conn' | 'plan'; type: string }[] = [
    { id: 'wechat', kind: 'hermes', name: L(lang, '微信（Hermes 桥）', 'WeChat (Hermes bridge)'), desc: L(lang, '推到你的微信——经 Hermes 转送', 'Push to WeChat via the Hermes bridge'), hint: L(lang, '微信目标（如 weixin）——需宿主 Hermes 在岗', 'WeChat target (e.g. weixin) — needs Hermes on the host'), group: 'msg', mode: 'notify', type: '' },
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
    { id: 'wps', kind: '', name: L(lang, 'WPS / 金山文档', 'WPS / Kingsoft Docs'), desc: L(lang, '规划中——开放平台可做在线编辑 / 转换，需申请接入', 'Planned — the open platform does online edit/convert, needs onboarding'), hint: '', group: 'work', mode: 'plan', type: '' },
    { id: 'canva', kind: '', name: L(lang, 'Canva 可画', 'Canva'), desc: L(lang, '规划中——需要 Canva 开发者应用 + OAuth 授权', 'Planned — needs a Canva developer app + OAuth'), hint: '', group: 'work', mode: 'plan', type: '' },
    { id: 'tiktok', kind: '', name: 'TikTok', desc: L(lang, '规划中——内容发布 API 需开发者应用审核', 'Planned — the content-posting API needs app review'), hint: '', group: 'work', mode: 'plan', type: '' },
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
    if (d.mode === 'notify') {
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
