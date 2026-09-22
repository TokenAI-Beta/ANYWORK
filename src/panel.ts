// 侧栏面板数据采集（只读）：助理（Agent 预设）/ 专家技能 / 连接器 / 自动化
// 说明：全部从共享区与只读状态读取，不改任何文件；供 portal.ts 的 /portal/api/panel/* 使用。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { DatabaseSync } from 'node:sqlite'
import { defaultDataDir } from './db.ts'

const PRESETS_DIR = join(defaultDataDir(), 'presets')
const SKILLS_DIR = join(defaultDataDir(), 'skills')

export interface PresetInfo {
  id: string
  name: string
  description: string
  order: number
  codex: boolean
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

export function collectPresets(): PresetInfo[] {
  let ids: string[] = []
  try {
    ids = readdirSync(PRESETS_DIR).filter((n) => {
      try {
        return statSync(join(PRESETS_DIR, n)).isDirectory()
      } catch {
        return false
      }
    })
  } catch {
    // 目录不存在按空处理
  }
  const out: PresetInfo[] = []
  for (const id of ids) {
    const meta = flatYaml(readText(join(PRESETS_DIR, id, 'preset.yml')))
    const agent = readText(join(PRESETS_DIR, id, 'agent.cordis.yml'))
    out.push({
      id,
      name: meta.name || id,
      description: meta.description || '',
      order: Number(meta.order ?? 100) || 100,
      codex: /codex/i.test(agent),
    })
  }
  out.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  return out
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

export function readSkill(id: string): { ok: true; id: string; content: string } | { error: string } {
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(id) || id.includes('..')) return { error: '名称不合法' }
  const p = join(SKILLS_DIR, id, 'SKILL.md')
  if (!existsSync(p)) return { error: '技能不存在' }
  return { ok: true, id, content: readText(p).slice(0, 80000) }
}

export interface ConnectorInfo {
  name: string
  ok: boolean | null
  detail: string
}

/** 连接器状态（只读探测）：模型网关 / 通知 / Codex / GitHub / 共享区 */
export function collectConnectors(db: DatabaseSync): ConnectorInfo[] {
  const items: ConnectorInfo[] = []

  let chNames: string[] = []
  try {
    const rows = db.prepare(`SELECT name, enabled FROM channels ORDER BY id`).all() as unknown as { name: string; enabled: number }[]
    chNames = rows.map((r) => r.name + (r.enabled ? '' : '（停用）'))
  } catch {
    // 表缺失按空处理
  }
  items.push({
    name: '模型网关',
    ok: true,
    detail: '默认 DeepSeek 网关在岗' + (chNames.length ? `；外部通道 ${chNames.length} 个：${chNames.join('、')}` : '；当前无外部通道'),
  })

  let routes: { name: string; kind: string; enabled: number }[] = []
  try {
    routes = db.prepare(`SELECT name, kind, enabled FROM notify_routes ORDER BY id`).all() as unknown as { name: string; kind: string; enabled: number }[]
  } catch {
    // 表缺失按空处理
  }
  const en = routes.filter((r) => r.enabled)
  items.push({
    name: '通知（微信 / Webhook）',
    ok: en.length > 0,
    detail: routes.length ? `路由 ${routes.length} 条，启用 ${en.length} 条` + (en.length ? '：' + en.map((r) => r.name).join('、') : '') : '未配置通知路由',
  })

  const tg = routes.filter((r) => r.kind === 'telegram')
  items.push({
    name: 'Telegram（连接器）',
    ok: tg.length ? tg.some((r) => r.enabled === 1) : null,
    detail: tg.length
      ? `Bot API · 路由 ${tg.length} 条（启用 ${tg.filter((r) => r.enabled === 1).length}）：${tg.map((r) => r.name).join('、')}`
      : '未配置 —— 设置 → 通知 添加：bot_token|chat_id（@BotFather 建机器人；直连不通可加 |api_base）',
  })
  const wa = routes.filter((r) => r.kind === 'whatsapp')
  items.push({
    name: 'WhatsApp（连接器）',
    ok: wa.length ? wa.some((r) => r.enabled === 1) : null,
    detail: wa.length
      ? `路由 ${wa.length} 条（启用 ${wa.filter((r) => r.enabled === 1).length}）：${wa.map((r) => r.name).join('、')}`
      : '未配置 —— 支持 CallMeBot（免费个人）/ green-api / UltraMsg 任一网关',
  })

  const codexCandidates = [
    join(homedir(), 'opt', 'node-v24.19.0-linux-x64', 'bin', 'codex'),
    join(homedir(), '.local', 'bin', 'codex'),
  ]
  const codexBin = codexCandidates.find((p) => existsSync(p)) || ''
  const codexAuth = existsSync(join(homedir(), '.codex', 'auth.json'))
  items.push({
    name: 'Codex（并行 / 子代理引擎）',
    ok: codexBin ? codexAuth : null,
    detail: codexBin
      ? codexAuth
        ? '已接入：可派子代理与 worktree 并行（消耗你的 Codex 账号额度）'
        : '已安装，但登录态缺失（需 codex login）'
      : '未安装（可选）',
  })

  const ghHosts = readText(join(homedir(), '.config', 'gh', 'hosts.yml'))
  const ghUser = /user:\s*(\S+)/.exec(ghHosts)?.[1] ?? ''
  items.push({ name: 'GitHub CLI', ok: ghUser ? true : null, detail: ghUser ? `已登录：${ghUser}` : '未登录（可选）' })

  const kbOk = existsSync(join(defaultDataDir(), 'kb'))
  const driveOk = existsSync(join(defaultDataDir(), 'drive'))
  items.push({
    name: '知识库 / 公司盘',
    ok: kbOk && driveOk,
    detail: `知识库 ${kbOk ? '✓' : '✗'} · 公司盘 ${driveOk ? '✓' : '✗'}（共享区，每实例软链）`,
  })

  items.push({
    name: '技能库 / Agent 预设',
    ok: true,
    detail: `共享技能 ${collectSkills().length} 个 · 预设 ${collectPresets().length} 个（改动即生效）`,
  })

  return items
}
