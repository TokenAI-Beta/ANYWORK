// lib/scan.js — agents/*.md 定义解析器（frontmatter 子集 + 校验）。
// 零依赖；供 dsh-agents-md 插件使用。
//
// 支持格式（与团队文档一致）：
// ---
// name: code-reviewer            # 必填，[a-z0-9][a-z0-9._-]*
// description: 一句话描述           # 必填
// tools: [bash, read, grep]      # 可选，白名单（也支持块列表 - 形式）
// disallowed-tools: [write]      # 可选，黑名单（disallowedTools 也可）
// model: deepseek-chat           # 可选
// effort: low|medium|high        # 可选（适配器相关）
// provider: spawn|fork           # 可选，默认 spawn
// background: true|false         # 可选，本类型默认后台
// max-depth: 2                   # 可选，≥0 整数
// color: blue                    # 可选（面板配色）
// ---
// （正文 = 子代理 persona）

const NAME_RE = /^[a-z0-9][a-z0-9._-]*$/

const KEY_ALIASES = {
  'maxdepth': 'max-depth',
  'disallowedtools': 'disallowed-tools',
  'disallowed_tools': 'disallowed-tools',
}

/** 解析 frontmatter 子集：标量、行内数组、块列表；不支持的写法记 warning。 */
export function parseAgentMd(text) {
  const src = String(text).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const lines = src.split('\n')
  if (lines[0].trim() !== '---') return { error: '缺少 frontmatter（文件应以一行 --- 开头）' }
  let close = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { close = i; break }
  }
  if (close === -1) return { error: 'frontmatter 未闭合（缺少结束的 --- 行）' }
  const fmLines = lines.slice(1, close)
  const body = lines.slice(close + 1).join('\n').trim()

  const warnings = []
  const data = {}
  const parseScalar = (raw) => {
    const v = raw.trim()
    if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
      return v.slice(1, -1)
    }
    if (v === 'true') return true
    if (v === 'false') return false
    if (/^-?\d+$/.test(v)) return Number(v)
    return v
  }

  for (let i = 0; i < fmLines.length; i++) {
    const line = fmLines[i]
    if (!line.trim() || line.trim().startsWith('#')) continue
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/)
    if (!kv) {
      warnings.push(`frontmatter 第 ${i + 2} 行无法解析：${line.trim().slice(0, 80)}`)
      continue
    }
    let key = kv[1]
    const canonical = KEY_ALIASES[key.toLowerCase()]
    if (canonical) key = canonical
    const val = kv[2].trim()
    if (val === '') {
      // 空值：可能是块列表（后续缩进的 "- item" 行）
      const items = []
      let j = i + 1
      while (j < fmLines.length && /^\s+-\s+/.test(fmLines[j])) {
        items.push(parseScalar(fmLines[j].replace(/^\s+-\s+/, '')))
        j++
      }
      if (items.length > 0) { data[key] = items; i = j - 1 } else { data[key] = '' }
      continue
    }
    if (val.startsWith('[') && val.endsWith(']')) {
      const inner = val.slice(1, -1).trim()
      data[key] = inner === '' ? [] : inner.split(',').map((x) => parseScalar(x)).filter((x) => x !== '')
    } else {
      data[key] = parseScalar(val)
    }
  }
  return { data, body, warnings }
}

/** 把解析结果规范化成 AgentDef（含 errors/warnings；errors 非空 = 不可用）。 */
export function normalizeAgentDef({ file, source, data, body, parseWarnings }) {
  const errors = []
  const warnings = [...(parseWarnings ?? [])]
  const pick = (...keys) => {
    for (const k of keys) {
      const v = data[k]
      if (v !== undefined && v !== '') return v
    }
    return undefined
  }

  const rawName = pick('name')
  const name = typeof rawName === 'string' ? rawName.trim() : undefined
  if (!name) errors.push('缺少必填字段 name')
  else if (!NAME_RE.test(name)) errors.push(`name "${name}" 不符合规则（小写字母/数字开头，可含 . _ -）`)

  const rawDesc = pick('description')
  const description = typeof rawDesc === 'string' ? rawDesc.trim() : undefined
  if (!description) errors.push('缺少必填字段 description')

  const asStringList = (v, field) => {
    if (v === undefined) return undefined
    const arr = Array.isArray(v) ? v : [v]
    const out = []
    for (const item of arr) {
      if (typeof item === 'string' && item.trim()) out.push(item.trim())
      else warnings.push(`${field} 含非字符串项，已忽略`)
    }
    return out.length > 0 ? out : undefined
  }

  const tools = asStringList(pick('tools'), 'tools')
  const disallowedTools = asStringList(pick('disallowed-tools'), 'disallowed-tools')

  const model = pick('model')
  if (model !== undefined && typeof model !== 'string') errors.push('model 必须是字符串')
  const effort = pick('effort')
  if (effort !== undefined && typeof effort !== 'string') errors.push('effort 必须是字符串')
  const provider = pick('provider')
  if (provider !== undefined && provider !== 'spawn' && provider !== 'fork') {
    errors.push(`provider "${String(provider)}" 无效（可选：spawn | fork）`)
  }
  const background = pick('background')
  if (background !== undefined && typeof background !== 'boolean') errors.push('background 必须是 true/false')
  const maxDepth = pick('max-depth')
  if (maxDepth !== undefined && (!Number.isSafeInteger(maxDepth) || maxDepth < 0)) {
    errors.push('max-depth 必须是 ≥0 的整数')
  }
  const color = pick('color')
  if (color !== undefined && typeof color !== 'string') warnings.push('color 必须是字符串，已忽略')

  const known = new Set(['name', 'description', 'tools', 'disallowed-tools', 'model', 'effort', 'provider', 'background', 'max-depth', 'color'])
  for (const key of Object.keys(data)) {
    if (!known.has(key)) warnings.push(`未知字段 "${key}"（已忽略）`)
  }
  if (!body) warnings.push('正文为空（子代理将使用默认人设）')

  return {
    name,
    description,
    tools,
    disallowedTools,
    model: typeof model === 'string' ? model.trim() : undefined,
    effort: typeof effort === 'string' ? effort.trim() : undefined,
    provider: typeof provider === 'string' ? provider : undefined,
    background: typeof background === 'boolean' ? background : undefined,
    maxDepth: Number.isSafeInteger(maxDepth) ? maxDepth : undefined,
    color: typeof color === 'string' ? color : undefined,
    persona: body || undefined,
    source,
    file,
    errors,
    warnings,
  }
}
