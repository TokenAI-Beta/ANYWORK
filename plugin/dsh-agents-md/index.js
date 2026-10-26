/**
 * dsh-agents-md — 把 agents/*.md 子代理定义接入 dsh 的委派（subagent）体系。
 *
 * · 扫描若干目录下的 Markdown 定义（YAML frontmatter + 正文 = 子代理 persona）；
 * · 注册一个面向模型的委派工具（默认名 `agent`）：按 `subagent_type` 把任务交给
 *   定义好的子代理（独立上下文、只回最终结果）；
 * · 支持 per-def 的 model / effort / max-depth / color；正文与工具名单写进
 *   交给子代理的 prompt（rc.3 的 startActivation 请求不再带 persona / toolFilter）；
 * · 定义目录内容变化时，在下一次调用前自动重登记（描述里的目录随之更新）。
 *
 * 零依赖：不 import 任何 npm 包。引擎助手 defineTool 从“正在运行的 dsh 安装”
 * 动态加载（由 process.argv[1] 推导，config.dshRoot 可覆盖）。
 * 结算走 ctx.subagents.startActivation（delivery: 'parent'）：工具立刻返回
 * child id，完成通知由 subagent 运行时投递给父会话。
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { scanCatalog } from './lib/catalog.js'

export const name = 'dsh-agents-md'
export const inject = ['tools', 'subagents', 'systemPrompt']

// ── 配置与目录 ─────────────────────────────────────────────────────────────

function expandHome(p) {
  if (p === '~') return homedir()
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(homedir(), p.slice(2))
  return p
}

function normalizeConfig(config) {
  const cfg = config ?? {}
  return {
    toolName: typeof cfg.toolName === 'string' && cfg.toolName.trim() ? cfg.toolName.trim() : 'agent',
    dirs: Array.isArray(cfg.dirs)
      ? cfg.dirs.filter((d) => typeof d === 'string' && d.trim()).map((d) => expandHome(d.trim()))
      : [],
    provider: typeof cfg.provider === 'string' && cfg.provider.trim() ? cfg.provider.trim() : 'spawn',
    maxDepth: cfg.maxDepth === 'provider-managed'
      ? 'provider-managed'
      : (Number.isSafeInteger(cfg.maxDepth) && cfg.maxDepth >= 0 ? cfg.maxDepth : 3),
    dshRoot: typeof cfg.dshRoot === 'string' ? cfg.dshRoot : '',
    notify: cfg.notify === false ? null : {
      url: typeof cfg.notify?.url === 'string' && cfg.notify.url ? cfg.notify.url : 'http://127.0.0.1:8080/portal/api/notify',
      tokenFile: typeof cfg.notify?.tokenFile === 'string' && cfg.notify.tokenFile
        ? cfg.notify.tokenFile
        : path.join(process.env.HOME || homedir(), 'desk-data', 'notify.token'),
      routes: Array.isArray(cfg.notify?.routes) ? cfg.notify.routes.map(String) : defaultNotifyRoutes(),
      events: cfg.notify?.events === 'all' ? 'all' : 'background',
    },
  }
}

/** 默认把结算通知发给“本人”的通知路由（按实例成员名推导，如 wechat-admin001）。 */
function defaultNotifyRoutes() {
  const home = process.env.DSH_HOME ?? ''
  const member = home ? path.basename(home) : ''
  return member ? [`wechat-${member}`] : []
}

/** 解析扫描目录：显式配置优先；其次实例私有；最后团队共享。前者同名优先。 */
function resolveDirs(cfg) {
  const dirs = [...cfg.dirs]
  const dshHome = process.env.DSH_HOME
  if (dshHome) dirs.push(path.join(dshHome, 'agents'))
  dirs.push(path.join(homedir(), 'desk-data', 'agents'))
  return [...new Set(dirs)]
}

// ── 引擎助手动态加载（零依赖的关键） ───────────────────────────────────────

async function loadHelpers(cfg) {
  const roots = []
  const push = (r) => {
    if (r && !roots.includes(r)) roots.push(r)
  }
  push(cfg.dshRoot)
  const argv1 = (process.argv[1] ?? '').replace(/\\/g, '/')
  const m = argv1.match(/^(.*)\/apps\/cli\/lib\/bin\.js$/)
  if (m && m[1]) push(m[1])
  push('/opt/deepseek-harness')
  push(path.join(homedir(), 'deepseek-harness'))

  let lastError
  for (const root of roots) {
    try {
      const toolsUrl = pathToFileURL(path.join(root, 'packages', 'core', 'tools', 'lib', 'index.js')).href
      const toolsMod = await import(toolsUrl)
      if (typeof toolsMod.defineTool !== 'function') throw new Error('dsh-tools 导出缺 defineTool')
      return { defineTool: toolsMod.defineTool, root }
    } catch (e) {
      lastError = e
    }
  }
  throw new Error(`无法从任何候选安装根加载 dsh 助手（试过：${roots.join('、')}）。最后一个错误：${lastError?.message ?? lastError}`)
}

/**
 * rc.3 的 activation 请求没有 persona / toolFilter 字段（这两项改由 agent preset
 * 组合拥有）。定义正文和工具名单因此放进交给子代理的 prompt，随 startActivation
 * 的 request.prompt 送出。工具名单在这里是指令，不是 tools.restrict。
 */
function childPrompt(def, promptText) {
  const chunks = []
  if (def.persona) chunks.push(def.persona)
  const limits = []
  if (Array.isArray(def.tools) && def.tools.length > 0) {
    limits.push(`Only use these tools: ${def.tools.join(', ')}.`)
  }
  if (Array.isArray(def.disallowedTools) && def.disallowedTools.length > 0) {
    limits.push(`Do not use these tools: ${def.disallowedTools.join(', ')}.`)
  }
  if (limits.length > 0) chunks.push(limits.join('\n'))
  chunks.push(promptText)
  return chunks.join('\n\n')
}

// ── 工具描述（目录写进描述，供模型选择） ────────────────────────────────────

function buildToolDescription(cfg, scan) {
  const lines = []
  if (scan) {
    for (const def of scan.list) {
      if (def.shadowed) continue
      if (def.errors && def.errors.length > 0) {
        lines.push(`- ${def.name ?? '(未命名)'}: 定义有错误，不可用`)
        continue
      }
      const bits = []
      if (def.tools) bits.push(`tools: ${def.tools.join(',')}`)
      if (def.model) bits.push(`model: ${def.model}`)
      if (def.provider === 'fork') bits.push('fork=继承当前对话')
      lines.push(`- ${def.name}: ${def.description}${bits.length ? `（${bits.join('；')}）` : ''}`)
    }
  }
  const capped = lines.length > 40 ? [...lines.slice(0, 40), `…（共 ${lines.length} 个）`] : lines
  const catalog = capped.length > 0
    ? capped.join('\n')
    : '（暂无定义——请让管理员向 agents/ 目录添加 *.md 定义）'
  return [
    "Delegate a self-contained task to one of the team's predefined agents. Each runs in its own isolated context and returns only its final result — use it to offload focused, independent work without consuming this conversation's context.",
    'Route by name: when the user points at a subagent in plain language (「让 code-reviewer 审一下 demo/app.py」「交给 researcher 查…」「@probe-lite 看下」), call this tool with subagent_type set to exactly that name — never a near guess.',
    'Give a complete, standalone prompt: by default the subagent does NOT see this conversation (fork definitions inherit it).',
    'Example: subagent_type="code-reviewer", prompt="审查 demo/order_stats.py：读出文件，找出 bug 与安全隐患，按严重度排序并给出修改建议".',
    'The call starts a managed activation and returns the child id immediately. This conversation receives a completion notice when that activation settles.',
    '',
    'Available agents:',
    catalog,
  ].join('\n')
}

// ── 结算通知（子代理跑完 → 通知桥） ─────────────────────────────────────────

/** POST 一条结算通知到 desk-server 通知桥（令牌文件认证；按成员路由）。 */
async function sendSettleNotify(cfg, info, meta) {
  let token = ''
  try {
    token = readFileSync(cfg.notify.tokenFile, 'utf8').trim()
  } catch {
    console.error(`[dsh-agents-md] notify token unreadable: ${cfg.notify.tokenFile}`)
    return
  }
  if (!token) return
  const STOP_TEXT = { completed: '完成', aborted: '已取消', error: '失败', 'max-tokens': '达输出上限', refusal: '拒绝任务' }
  const stop = STOP_TEXT[info?.stopReason] ?? String(info?.stopReason ?? '结束')
  let snippet = ''
  if (Array.isArray(info?.lastAssistantMessage)) {
    snippet = info.lastAssistantMessage
      .filter((b) => b && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('')
      .trim()
  }
  if (snippet.length > 280) snippet = `${snippet.slice(0, 280)}…`
  const text = `🔧 子代理「${meta.label}」(${meta.type}) ${stop}${snippet ? `：${snippet}` : ''}`
  const res = await fetch(cfg.notify.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-desk-notify-token': token },
    body: JSON.stringify({ title: '子代理结算', text, source: 'agent-md', ...(cfg.notify.routes.length ? { routes: cfg.notify.routes } : {}) }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) console.error(`[dsh-agents-md] notify dispatch HTTP ${res.status}`)
}

// ── 插件本体 ────────────────────────────────────────────────────────────────

export function apply(ctx, config) {
  const cfg = normalizeConfig(config)
  if (typeof ctx.subagents?.startActivation !== 'function') {
    throw new Error('dsh-agents-md requires ctx.subagents.startActivation')
  }
  const state = {
    helpers: null,
    scan: null,
    signature: '',
    disposeTool: null,
    labelByRun: new Map(),
    toolLimitNoted: new Set(),
  }

  const logInfo = (msg) => { console.log(`[dsh-agents-md] ${msg}`) }
  const logError = (msg) => { console.error(`[dsh-agents-md] ${msg}`) }

  // —— 自然语言路由（系统提示词 section）：把点名短语精准映射到 subagent_type ——
  try {
    ctx.systemPrompt.section({
      name: 'tool:agent',
      order: ctx.systemPrompt.getSectionOrder('TOOL_SUBAGENT') - 50,
      text: [
        "The `agent` tool delegates to the team's named subagents (its description holds the catalog). Users usually ask in plain language: 「让 code-reviewer 审一下 demo/app.py」/「交给 researcher 查…」/「派 probe-lite 去…」/「@code-reviewer 看下这个文件」/「委派给 writer：…」.",
        'When the user names a subagent or asks to hand work off:',
        '1. Call `agent` with `subagent_type` set to EXACTLY that catalog name (never an approximate one).',
        '2. Write a complete, standalone `prompt` — paths, scope, expected output; the subagent cannot see this conversation unless its definition is a fork type.',
        '3. If the requested name is missing from the catalog or the intent is ambiguous, ask ONE short clarifying question — never guess and never silently substitute the built-in `subagent` tool.',
        '4. The tool returns a child id immediately. When the completion notice arrives, name the agent and relay the result.',
      ].join('\n'),
    })
  } catch (err) {
    logError(`systemPrompt section registration failed: ${err?.message ?? err}`)
  }

  ctx.effect(() => () => {
    if (state.timer) clearInterval(state.timer)
    const old = state.disposeTool
    state.disposeTool = null
    if (old) {
      try { old() } catch { /* noop */ }
    }
  })

  function buildTool() {
    return state.helpers.defineTool({
      name: cfg.toolName,
      description: buildToolDescription(cfg, state.scan),
      parameters: {
        subagent_type: {
          type: 'string',
          required: true,
          description: "The subagent to delegate to — one of the names listed in this tool's description.",
        },
        description: {
          type: 'string',
          description: 'Optional short label (3-5 words) for task lists; derived from the task text when omitted.',
        },
        prompt: {
          type: 'string',
          required: true,
          description: "The complete, standalone task for the subagent. It does not share this conversation's context (fork-type definitions excepted), so include everything it needs.",
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            kind: { type: 'string', required: true, const: 'activation' },
            subagentId: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: `started subagent ${value.subagentId}`,
        }],
      },
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        // 定义目录可能刚被编辑：有变化则重登记（本次调用用下面最新扫描结果）
        try { await refresh(false) } catch { /* 保持旧目录继续服务 */ }

        const scan = state.scan
        const typeName = String(args.subagent_type ?? '').trim()
        const def = scan?.defs.get(typeName)
        if (!def) {
          const available = scan ? [...scan.defs.keys()] : []
          throw new Error(`unknown subagent_type "${typeName}". Available: ${available.length ? available.join(', ') : '(none — ask the operator to add agents/*.md definitions)'}`)
        }
        if (def.errors.length > 0) {
          throw new Error(`agent definition "${typeName}" has errors and cannot be used: ${def.errors.join('; ')}`)
        }

        const parent = exec.agent
        if (!parent) throw new Error('the agent tool requires a calling agent (exec.agent was undefined)')

        const providerName = def.provider ?? cfg.provider
        const provider = ctx.subagents.getProvider(providerName)
        if (!provider) throw new Error(`subagent provider "${providerName}" is not registered (agent definition "${typeName}" requires it)`)

        const agentOptions = {}
        if (def.model) agentOptions.model = def.model
        if (def.effort) agentOptions.reasoningEffort = def.effort
        const hasAgentOptions = Object.keys(agentOptions).length > 0
        if (hasAgentOptions && !provider.capabilities?.agentOptions) {
          throw new Error(`provider "${providerName}" does not support child model/effort overrides (agentOptions capability missing)`)
        }
        if ((def.tools || def.disallowedTools) && !state.toolLimitNoted.has(typeName)) {
          state.toolLimitNoted.add(typeName)
          logInfo(`agent "${typeName}": startActivation does not apply a tool filter; tools/disallowed-tools are instructions inside the child prompt`)
        }
        const maxDepth = def.maxDepth ?? cfg.maxDepth
        if (typeof maxDepth === 'number' && !provider.capabilities?.depthLimit) {
          throw new Error(`provider "${providerName}" cannot enforce maxDepth (depthLimit capability missing)`)
        }

        const promptText = String(args.prompt ?? '').trim()
        if (!promptText) throw new Error('prompt must be a non-empty, standalone task description')
        const label = String(args.description ?? '').trim()
          || `${typeName}: ${promptText.replace(/\s+/g, ' ').slice(0, 48)}`
        const request = {
          prompt: [{ type: 'text', text: childPrompt(def, promptText) }],
          parent,
          ...(hasAgentOptions ? { agentOptions } : {}),
          ...(typeof maxDepth === 'number' ? { maxDepth } : {}),
        }

        const started = await ctx.subagents.startActivation({
          provider: providerName,
          label,
          request,
          signal: exec.signal,
          delivery: 'parent',
        })
        const subagentId = String(started?.childId ?? '')
        if (!subagentId) throw new Error('startActivation returned no childId')
        state.labelByRun.set(subagentId, { type: typeName, label, mode: 'activation' })
        return { kind: 'activation', subagentId }
      },
    })
  }

  async function refresh(force) {
    const scan = await scanCatalog(resolveDirs(cfg))
    if (!force && scan.signature === state.signature) return
    state.scan = scan
    state.signature = scan.signature
    const definition = buildTool()
    try {
      const next = ctx.tools.register(definition)
      const old = state.disposeTool
      state.disposeTool = next
      if (old) {
        try { old() } catch { /* noop */ }
      }
    } catch (err) {
      // 旧登记还在（重名冲突）→ 先撤旧再登
      const old = state.disposeTool
      if (!old) throw err
      state.disposeTool = null
      old()
      state.disposeTool = ctx.tools.register(definition)
    }
    const broken = scan.list.length - scan.defs.size
    logInfo(`registered tool "${cfg.toolName}": ${scan.defs.size} agent definition(s) usable${broken > 0 ? `, ${broken} broken/shadowed` : ''} — dirs: ${scan.dirs.join(', ')}`)
  }

  // —— 结算通知：子代理结束 → 通知桥（按成员路由；默认推我们启动的 activation）——
  if (cfg.notify) {
    ctx.on('subagent/end', (info) => {
      try {
        // 事件里 runId 是每次观测新建的不透明 uuid；子会话 id 在 info.id，
        // 与 startActivation 返回的 childId 一致。
        const rid = String(info?.id ?? '')
        const meta = state.labelByRun.get(rid)
        if (!meta) return
        state.labelByRun.delete(rid)
        if (cfg.notify.events !== 'all' && meta.mode !== 'activation') return
        void sendSettleNotify(cfg, info, meta).catch((err) => logError(`settle notify failed: ${err?.message ?? err}`))
      } catch (err) {
        logError(`notify hook error: ${err}`)
      }
    })
  }

  const bootstrap = (async () => {
    state.helpers = await loadHelpers(cfg)
    logInfo(`dsh helpers loaded from ${state.helpers.root}`)
    await refresh(true)
    // 定时摘查目录变化 → 重登记（编辑定义后无需任何工具调用即生效）
    const timer = setInterval(() => { void refresh(false).catch(() => {}) }, 20000)
    if (typeof timer.unref === 'function') timer.unref()
    state.timer = timer
  })().catch((err) => {
    logError(`initialization failed: ${err?.stack ?? err}`)
  })

  // 供调试/测试观察（不影响引擎行为）
  state.ready = bootstrap
}

// 测试辅助：允许单测直接引用（不被引擎消费）
export const __internals = { normalizeConfig, resolveDirs, childPrompt }
