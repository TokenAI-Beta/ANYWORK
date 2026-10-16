// 门户（P2）：登录 / 登出 / 我的用量 / 成员管理 / 登录闸门 + 反代（14）
// 零依赖：node:http + 内联 HTML/CSS；会话 Cookie（httpOnly, SameSite=Lax）
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http'
import { connect as netConnect } from 'node:net'
import type { DatabaseSync } from 'node:sqlite'
import {
  createSession,
  destroySession,
  hashPassword,
  userFromSession,
  verifyPassword,
  type SessionUser,
} from './auth.ts'
import { hashToken, newVirtualKey } from './keys.ts'
import { eventCost, monthStartUtc, prices } from './pricing.ts'
import { addChannel, listChannels, removeChannel, setChannelEnabled } from './channel.ts'
import { syncInstanceModels } from './models-sync.ts'
import { kbSearch, listKbNotes, readKbNote, removeKbNote, saveKbNote } from './kb.ts'
import { listDrive, makeDir, movePath, removePath, resolveInDrive, saveToDrive, MAX_UPLOAD } from './drive.ts'
import { addNotifyRoute, addReminder, dispatchNotify, listNotifyLog, listNotifyRoutes, listReminders, listRemindersSent, readOrCreateNotifyToken, removeNotifyRoute, removeReminder, toggleNotifyRoute } from './notify.ts'
import { defaultDataDir } from './db.ts'
import { collectAgentRuns, collectAgents, collectConnectors, collectPlatforms, collectPresets, collectSkills, deleteAgent, readAgent, readSkill, saveAgent } from './panel.ts'
import { CONN_PLATFORMS, getConn, removeConn, setConn, testConn, validateConnConfig } from './conns.ts'
import { collectOps } from './ops.ts'
import { addTimer, autoStats, ensureRuleRows, listAutoLog, listAutos, removeAuto, toggleAuto, RULE_CATALOG, ruleEnabled } from './auto.ts'
import { runAutoNow, runQuickAgent, runQuickNotify } from './auto-exec.ts'
import { startWxBind, checkWxBind } from './wx-bind.ts'

/** 请求语言：?lang=en 时为英文（由工作台客户端带过来），默认中文 */
const langOf = (req: { url?: string }): string => {
  try {
    return new URL(req.url ?? '/', 'http://local').searchParams.get('lang') === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

const L = (lang: string, zh: string, en: string): string => (lang === 'en' ? en : zh)

/** 门户页面语言：cookie desk_lang > 该成员实例 settings.yaml 的 locale.preference > 浏览器语言 > 中文 */
const pageLang = (req: IncomingMessage, username?: string): string => {
  const ck = /(?:^|;\s*)desk_lang=(zh|en)/.exec(String(req.headers.cookie ?? ''))
  if (ck) return ck[1]
  if (username) {
    try {
      const m = /preference:\s*(zh|en)/.exec(readFileSync(join(userHome(username), 'settings.yaml'), 'utf8'))
      if (m) return m[1]
    } catch {
      /* 无实例或无设置文件 */
    }
  }
  const al = String(req.headers['accept-language'] ?? '')
  if (/^\s*zh/i.test(al)) return 'zh'
  return al.includes('en') ? 'en' : 'zh'
}
import { deleteSession, listUserSessions, userHome } from './session-mgr.ts'
import { instanceAuthCookie, requestAuthorityOf } from './instance-auth.ts'
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

// —— 团队共用上游（默认 DeepSeek 真 key；写入 ~/.desk/keys.env，改后需重启进程）——
function upstreamKeysPath(): string {
  return join(homedir(), '.desk', 'keys.env')
}

function readUpstreamKeyRaw(): string {
  if (process.env.DESK_REAL_KEY) return process.env.DESK_REAL_KEY
  const f = upstreamKeysPath()
  try {
    if (existsSync(f)) {
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        const m = /^(?:DEEPSEEK_API_KEY|DESK_REAL_KEY)\s*=\s*(.+)$/.exec(line.trim())
        if (m) return m[1].trim()
      }
    }
  } catch {
    // 读失败按未配置
  }
  return ''
}

function maskKey(k: string): string {
  if (!k) return ''
  if (k.length <= 10) return k.slice(0, 2) + '****'
  return k.slice(0, 5) + '****' + k.slice(-4)
}

function readUpstreamInfo(): { upstream: string; keySet: boolean; keyMasked: string; source: string; writable: boolean } {
  const raw = readUpstreamKeyRaw()
  return {
    upstream: process.env.DESK_UPSTREAM ?? 'https://api.deepseek.com',
    keySet: raw !== '',
    keyMasked: maskKey(raw),
    source: process.env.DESK_REAL_KEY ? 'env:DESK_REAL_KEY' : raw ? 'file:~/.desk/keys.env' : '未配置',
    writable: !process.env.DESK_REAL_KEY,
  }
}

// —— 通道服务商预置（「加入通道」傻瓜化：选服务商 → 贴 Key → 勾模型；随版本更新；不含任何 key）——
// 说明：model id 以各服务商官网为准；此处仅列常用款，表单支持手动补充；参考价不预置（避免过期误导）。
const CHANNEL_PRESETS = [
  {
    id: 'qwen',
    name: '阿里云百炼（通义千问）',
    nameEn: 'Alibaba Bailian (Qwen)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen3-max'],
    keyUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
    maxTokensCap: 32768,
  },
  {
    id: 'kimi',
    name: '月之暗面 Kimi',
    nameEn: 'Moonshot Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2-turbo-preview', 'kimi-k2-0905-preview', 'moonshot-v1-128k'],
    keyUrl: 'https://platform.moonshot.cn/console/api-keys',
    maxTokensCap: 32768,
  },
  {
    id: 'glm',
    name: '智谱 GLM',
    nameEn: 'Zhipu GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5.1', 'glm-4.7', 'glm-4.7-flash', 'glm-4.5'],
    keyUrl: 'https://bigmodel.cn/usercenter/apikeys',
    maxTokensCap: 32768,
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    nameEn: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen3-235B-A22B'],
    keyUrl: 'https://cloud.siliconflow.cn/account/ak',
    maxTokensCap: 32768,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    nameEn: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['deepseek/deepseek-chat', 'qwen/qwen3-235b-a22b'],
    keyUrl: 'https://openrouter.ai/settings/keys',
    maxTokensCap: 32768,
  },
]

/** 通道变更后：同步各实例模型清单并重启受影响实例（监督器 5 秒自拉，模型选择器随之刷新） */
function applyChannelChanges(db: DatabaseSync): string[] {
  const changed = syncInstanceModels(db)
  for (const username of changed) {
    try {
      const pf = join(homedir(), '.desk', 'run', `${username}.pid`)
      if (existsSync(pf)) {
        const pid = Number(readFileSync(pf, 'utf8').trim())
        if (Number.isFinite(pid) && pid > 1) process.kill(pid, 'SIGKILL')
      }
    } catch {
      /* 单个实例失败不阻断 */
    }
  }
  return changed
}

export interface PortalOptions {
  db: DatabaseSync
  port: number
  host: string
}

interface UsageRow {
  model: string | null
  channel?: string | null
  cost_cny?: number | null
  ts: string
  prompt_tokens: number
  completion_tokens: number
  cache_hit_tokens: number
  cache_miss_tokens: number
  status: string
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** UTC 'YYYY-MM-DD HH:MM:SS' → 北京时间显示 */
function bjtime(tsUtc: string): string {
  const d = new Date(tsUtc.replace(' ', 'T') + 'Z')
  return new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')
}

/** 北京时间“今天零点”→ UTC 字符串（喂给 SQL 比较） */
function beijingDayStartUtc(): string {
  const now = new Date()
  const bj = new Date(now.getTime() + 8 * 3600e3)
  bj.setUTCHours(0, 0, 0, 0)
  return new Date(bj.getTime() - 8 * 3600e3).toISOString().slice(0, 19).replace('T', ' ')
}

const STYLE = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif; background: #f6f7f9; color: #1c1e21; }
header { display: flex; align-items: center; gap: 16px; padding: 12px 24px; background: #fff; border-bottom: 1px solid #e4e6eb; }
header .brand { font-weight: 700; }
header nav { display: flex; gap: 14px; align-items: center; margin-left: auto; }
header a { color: #1c1e21; text-decoration: none; font-size: 14px; }
header a:hover { text-decoration: underline; }
header .who { color: #65676b; font-size: 14px; }
main { max-width: 860px; margin: 24px auto; padding: 0 16px; }
.card { background: #fff; border: 1px solid #e4e6eb; border-radius: 10px; padding: 18px 20px; margin-bottom: 16px; }
h1 { font-size: 20px; margin: 0 0 12px; }
h2 { font-size: 15px; margin: 0 0 10px; color: #65676b; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #f0f1f3; }
th { color: #65676b; font-weight: 500; }
.muted { color: #65676b; font-size: 13px; }
.big { font-size: 24px; font-weight: 700; }
.grid { display: flex; gap: 16px; flex-wrap: wrap; }
.grid .card { flex: 1 1 260px; }
.bar { background: #eef0f3; border-radius: 6px; height: 10px; overflow: hidden; margin-top: 8px; }
.bar > i { display: block; height: 100%; background: #4f7cf7; }
.err { color: #c0392b; margin: 8px 0; font-size: 14px; }
.ok { color: #1e874b; margin: 8px 0; font-size: 14px; }
input { padding: 8px 10px; border: 1px solid #ccd0d5; border-radius: 8px; font-size: 14px; width: 100%; }
label { display: block; font-size: 13px; color: #65676b; margin: 10px 0 4px; }
button { padding: 8px 14px; border: 0; border-radius: 8px; background: #1c1e21; color: #fff; font-size: 14px; cursor: pointer; }
form.inline { display: inline; }
footer { text-align: center; color: #8a8d91; font-size: 12px; padding: 24px 0 32px; }
.login-wrap { max-width: 380px; margin: 8vh auto; }
.key { font-family: ui-monospace, Consolas, monospace; background: #f0f1f3; border-radius: 8px; padding: 12px; word-break: break-all; font-size: 14px; }
code { background: #f0f1f3; border-radius: 5px; padding: 1px 5px; font-family: ui-monospace, Consolas, monospace; font-size: 13px; }

/* —— v2 视觉打磨（2026-09-21）—— */
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; background: #f4f5f7; -webkit-font-smoothing: antialiased; }
header { height: 56px; padding: 0 24px; gap: 14px; border-bottom: 1px solid #e8eaed; box-shadow: 0 1px 2px rgba(16,24,40,.03); position: sticky; top: 0; z-index: 10; }
header .brand { font-size: 15px; letter-spacing: .2px; }
header nav { gap: 18px; }
header a { padding: 6px 2px; }
header a:hover { text-decoration: none; color: #4f7cf7; }
header form.inline button { background: transparent; color: #6b7078; border: 1px solid #dcdfe4; padding: 5px 12px; font-size: 13px; }
header form.inline button:hover { color: #d64545; border-color: #f0b4b4; background: #fdf3f3; }
main { max-width: 880px; margin: 28px auto 0; padding: 0 16px; }
.card { border-radius: 14px; border: 1px solid #e9ebee; padding: 20px 22px; box-shadow: 0 4px 16px rgba(16,24,40,.05); }
h1 { font-size: 19px; letter-spacing: .1px; }
h2 { font-size: 13px; letter-spacing: .3px; }
table { font-size: 13.5px; }
th { font-size: 12.5px; padding: 8px; border-bottom: 1px solid #e9ebee; }
td { padding: 8px; border-bottom: 1px solid #f2f3f5; }
input, select, textarea { padding: 10px 12px; border: 1px solid #d4d7dc; border-radius: 9px; font-size: 14px; background: #fff; transition: border-color .15s, box-shadow .15s; }
input:focus, select:focus, textarea:focus { outline: none; border-color: #4f7cf7; box-shadow: 0 0 0 3px rgba(79,124,247,.14); }
label { margin: 12px 0 5px; }
button { background: #4f7cf7; border-radius: 9px; padding: 9px 16px; font-weight: 500; transition: background .15s; }
button:hover { background: #3f6be6; }
form[action="/login"] button { width: 100%; padding: 11px; font-size: 14.5px; font-weight: 600; margin-top: 6px; }
.key { border: 1px solid #e9ebee; }
.muted { color: #70757d; }
footer { font-size: 12.5px; color: #9aa0a6; padding: 28px 0 36px; }
.bar { height: 8px; border-radius: 999px; }
.login-wrap { max-width: 396px; margin: 9vh auto; }
.login-wrap .card { padding: 30px 28px 26px; }
.login-wrap h1 { margin-bottom: 4px; font-size: 20px; }

/* —— v3 主题（2026-10-14：统一设计令牌）—— */
:root { --acc:#577da8; --acc2:#43658e; --accT:rgba(87,125,168,.16);
  /* 强调色：浅色主题=雾蓝 #577DA8；深色主题=松绿 #93B78A（供工作台主题使用） */
  --page:#faf9f5; --surface:#fff; --oat:#f0eee6; --warm-border:#dedcd1; --warm-border-soft:#e9e6dd;
  --ink:#302f2c; --ink2:#6b6a63; --ink3:#9b9894;
  --serif:"Copernicus","Tiempos Headline",Georgia,"Source Han Serif SC","Noto Serif SC","Songti SC","SimSun","宋体",serif; }
body { background: var(--page); color: var(--ink); }
header { background: var(--page); border-bottom: 1px solid var(--warm-border-soft); box-shadow: 0 1px 0 rgba(48,47,44,.02); }
header .brand::before { content: "✳ "; color: var(--acc); }
header a { color: var(--ink2); }
header a:hover { color: var(--acc); }
header .who { color: var(--ink3); }
header form.inline button { background: transparent; color: var(--ink2); border: 1px solid var(--warm-border); }
header form.inline button:hover { color: var(--acc2); border-color: #eccfbf; background: #fdf6f1; }
h1 { font-family: var(--serif); font-weight: 600; font-size: 22px; }
h2 { color: var(--ink2); }
.card { border: 1px solid var(--warm-border); border-radius: 14px; box-shadow: 0 1px 2px rgba(48,47,44,.05), 0 10px 28px rgba(48,47,44,.05); }
th { color: var(--ink2); border-bottom-color: var(--warm-border-soft); }
td { border-bottom-color: #f3f1ea; }
.muted { color: var(--ink3); }
.bar { background: var(--oat); }
.bar > i { background: var(--acc); }
input, select, textarea { border-color: var(--warm-border); }
input:focus, select:focus, textarea:focus { border-color: var(--acc); box-shadow: 0 0 0 3px var(--accT); }
label { color: var(--ink2); }
button { background: var(--acc); border-radius: 10px; }
button:hover { background: var(--acc2); }
a { color: var(--acc); }
a:hover { color: var(--acc2); }
.key, code { background: var(--oat); color: var(--ink); }
.key { border-color: var(--warm-border); }
.err { color: #b3402e; }
.ok { color: #557a4f; }
footer { color: var(--ink3); }
.login-wrap { margin: 7vh auto; }
.login-wrap .card { padding: 34px 30px 28px; }
.login-wrap h1 { font-size: 24px; margin-bottom: 6px; }
`

function page(title: string, user: SessionUser | null, body: string, lang: string = 'zh'): string {
  const nav = user
    ? `<nav><a href="/">${L(lang, '工作台', 'Workbench')}</a><a href="/portal/me">${L(lang, '我的用量', 'My usage')}</a><a href="/portal/lang?set=${lang === 'en' ? 'zh' : 'en'}&back=/portal/me">${lang === 'en' ? '中文' : 'EN'}</a><form method="post" action="/logout" class="inline"><button>${L(lang, '退出', 'Sign out')}</button></form></nav><span class="who">${esc(user.username)}</span>`
    : ''
  return `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'zh-CN'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="manifest" href="/portal.webmanifest"><link rel="icon" type="image/svg+xml" href="/portal-icon.svg"><meta name="theme-color" content="#faf9f5"><title>${esc(title)} · DSH-ANYWORK</title><style>${STYLE}</style></head>
<body>
<header><span class="brand">DSH-ANYWORK</span><span class="muted">${L(lang, '团队工作台', 'Team workbench')}</span>${nav}</header>
<main>${body}</main>
<footer>DSH-ANYWORK · ${L(lang, '自托管团队工作台 · 数据留在本机', 'Self-hosted team workbench · your data stays on this machine')}</footer>
</body></html>`
}

// —— 用量聚合 ——
interface Agg {
  events: number
  hit: number
  miss: number
  out: number
  cost: number
}

function aggregate(rows: UsageRow[]): Agg {
  const a: Agg = { events: 0, hit: 0, miss: 0, out: 0, cost: 0 }
  for (const r of rows) {
    a.events += 1
    a.hit += r.cache_hit_tokens
    a.miss += r.cache_miss_tokens
    a.out += r.completion_tokens
    a.cost += eventCost(r)
  }
  return a
}

function aggLine(a: Agg, lang: string = 'zh'): string {
  return L(
    lang,
    `请求 ${a.events} 次 · 命中 ${a.hit} / 未命中 ${a.miss} / 输出 ${a.out} tokens`,
    `${a.events} requests · cache-hit ${a.hit} / miss ${a.miss} / output ${a.out} tokens`,
  )
}

// —— 登录尝试限速（内存） ——
const fails = new Map<string, { n: number; until: number }>()

async function readBody(req: IncomingMessage, limit = 10240): Promise<string> {
  let s = ''
  for await (const chunk of req) {
    s += chunk
    if (s.length > limit) break
  }
  return s
}

function redirect(res: ServerResponse, location: string, cookie?: string): void {
  const headers: Record<string, string> = { location }
  if (cookie) headers['set-cookie'] = cookie
  res.writeHead(302, headers)
  res.end()
}

function html(res: ServerResponse, code: number, body: string): void {
  res.writeHead(code, { 'content-type': 'text/html; charset=utf-8' })
  res.end(body)
}

/** 反代：HTTP 请求 → 该成员实例（Host/Origin 原样透传，实例用 --trusted-host 信任门户 authority） */
function proxyHttp(req: IncomingMessage, res: ServerResponse, port: number, authCookie?: string, lang: string = 'zh'): void {
  const headers: Record<string, unknown> = { ...req.headers }
  for (const h of ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade', 'accept-encoding']) {
    delete headers[h]
  }
  // dsh 0.1.5+：实例对页面/API 要求浏览器会话 cookie（browser-auth）——门户服务端注入，成员无感知
  if (authCookie !== undefined) {
    const existing = typeof headers['cookie'] === 'string' ? (headers['cookie'] as string) : ''
    headers['cookie'] = existing.length > 0 ? `${existing}; ${authCookie}` : authCookie
  }
  const upstream = httpRequest(
    { host: '127.0.0.1', port, method: req.method, path: req.url, headers },
    (up) => {
      const ctype = String(up.headers['content-type'] ?? '')
      if (ctype.startsWith('text/html')) {
        // HTML（工作台 shell）缓冲后注入"用量"小组件再下发
        const chunks: Buffer[] = []
        up.on('data', (c) => chunks.push(Buffer.from(c)))
        up.on('end', () => {
          const body = injectUsageWidget(Buffer.concat(chunks).toString('utf8'), lang)
          const outHeaders = { ...up.headers }
          delete outHeaders['content-encoding']
          delete outHeaders['content-length']
          delete outHeaders['transfer-encoding']
          res.writeHead(up.statusCode ?? 502, outHeaders)
          res.end(Buffer.from(body, 'utf8'))
        })
        up.on('error', () => {
          try {
            res.destroy()
          } catch {
            // 已断开
          }
        })
      } else {
        res.writeHead(up.statusCode ?? 502, up.headers)
        up.pipe(res)
      }
    },
  )
  upstream.on('error', () => {
    if (!res.headersSent) {
      html(res, 502, page('502', null, `<div class="card"><h1>502</h1><div class="muted">${L(lang, '工作台实例未响应（可能未启动）。稍后再试或联系管理员。', 'The workbench instance is not responding (it may be down). Try again later or contact your admin.')}</div></div>`, lang))
    } else {
      res.destroy()
    }
  })
  req.pipe(upstream)
}

/** 移动端适配样式（≤820px 生效；由 usageWidgetTag 注入到所有工作台页面；不改 dsh 源码） */
const DESK_MOBILE_CSS = `
@media (max-width: 820px) {
  body [class*="LVqHyW_overlay"] { padding: 0 !important; margin: 0 !important; }
  body [class*="LVqHyW_panel"] {
    width: 100vw !important; max-width: 100vw !important; height: 100% !important;
    max-height: 100dvh !important; margin: 0 !important; border-radius: 0 !important;
    flex-direction: column !important;
  }
  [class*="LVqHyW_nav"] { width: 100% !important; flex: none !important; }
  [class*="LVqHyW_navTitle"] { display: none !important; }
  [class*="LVqHyW_navList"] {
    width: 100% !important; flex-direction: row !important; overflow-x: auto !important;
    gap: 6px !important; padding: 10px 12px !important; scrollbar-width: none;
  }
  [class*="LVqHyW_navList"]::-webkit-scrollbar { display: none; }
  [class*="LVqHyW_navCell"] {
    width: auto !important; flex: 0 0 auto !important; min-height: 42px !important;
    padding: 0 14px !important; white-space: nowrap !important; font-size: 13px !important;
    gap: 6px !important;
  }
  [class*="LVqHyW_navCell"] svg { width: 16px !important; height: 16px !important; flex: 0 0 auto !important; }
  [class*="LVqHyW_navCell"] [class*="LVqHyW_navLabel"] {
    width: auto !important; flex: 0 0 auto !important; white-space: nowrap !important;
  }
  [class*="LVqHyW_content"] {
    width: 100% !important; flex: 1 1 0 !important; min-width: 0 !important;
    min-height: 0 !important; overflow: hidden !important;
  }
  [class*="LVqHyW_options"] {
    padding: 12px 14px 24px !important; overflow-y: auto !important; min-height: 0 !important;
    overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
  }
  [class*="LVqHyW_header"] { padding: 4px 8px 4px 14px !important; }
  [class*="LVqHyW_header"] [class*="LVqHyW_actions"] { display: none !important; }
  [class*="LVqHyW_close"] { width: 40px !important; height: 40px !important; margin-left: 8px !important; }
  /* 侧边栏抽屉化：展开时覆盖在内容上（不再压扁主内容）；不压暗、点右侧不自动收起（边看运行边用侧栏；关闭用收起钮/收起侧边栏） */
  [data-desk-frame]:not([data-desk-collapsed="true"]) { grid-template-columns: 0px minmax(0px, 1fr) 0px !important; }
  [data-desk-frame]:not([data-desk-collapsed="true"]) [class*="centerCol"] { grid-column: 2 !important; width: 100% !important; }
  [data-desk-frame]:not([data-desk-collapsed="true"]) [class*="sidebarCol"] { position: fixed !important; left: 12px !important; top: 12px !important; bottom: 12px !important; margin: 0 !important; box-sizing: border-box !important; width: min(64vw, 280px) !important; height: auto !important; z-index: 70 !important; border-radius: 14px !important; box-shadow: 0 18px 60px rgba(8,12,20,.42) !important; }
  [data-desk-frame]:not([data-desk-collapsed="true"]) [class*="handle"] { display: none !important; }
  /* 主界面微调（第 4 项）：触控尺寸 / 输入字号 */
  [class*="CtUWPa_row"] button { min-width: 38px !important; min-height: 38px !important; }
  button[aria-label="发送消息"], button[aria-label="send message" i] { min-width: 44px !important; min-height: 44px !important; }
  [class*="CtUWPa_"] [contenteditable="true"] { font-size: 16px !important; }
  [class*="sidebarCol"] button { min-width: 42px !important; min-height: 42px !important; }
  [class*="sidebarCol"] [class*="headerActions"] { margin-right: 8px !important; }
  [data-desk-frame] [class*="sidebarCol"] { -webkit-text-size-adjust: 100% !important; text-size-adjust: 100% !important; }
  [data-desk-frame] [class*="sidebarCol"] button { font-size: 13px !important; }
  [data-desk-frame] [class*="sidebarCol"] [class*="title"] { font-size: 13px !important; }
  [data-desk-frame] [class*="sidebarCol"] [class*="sectionHeader"] { font-size: 12.5px !important; }
  [data-desk-frame] [class*="sidebarCol"] [class*="logoRow"] { font-size: 13px !important; }
  body { --dsw-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif !important; }
  [data-dsh-float] [role="treeitem"], [data-dsh-float] [role="dialog"] h2 { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif !important; }
  [role="tooltip"] { display: none !important; }
  /* 侧边栏从上往下缩：顶边把手拖拽 + clip 裁切（底边固定，最底部一行常驻）；打字（键盘弹起）时近扁平状态自动让位 */
  [data-desk-frame][data-desk-sbshrink] [class*="sidebarCol"] { bottom: 12px !important; height: auto !important; overflow: hidden !important; transition: opacity .18s ease !important; }
  html.desk-sb-typing [data-desk-frame]:not([data-desk-collapsed="true"]) [class*="sidebarCol"] { opacity: 0 !important; pointer-events: none !important; }
  html.desk-sb-typing #desk-sb-grip { opacity: 0 !important; pointer-events: none !important; }
  #desk-sb-grip { position: fixed; height: 34px; z-index: 75; align-items: center; justify-content: center; touch-action: none; cursor: grab; }
  #desk-sb-grip > span { width: 46px; height: 20px; border-radius: 10px; background: #2c3340; border: 1px solid #475063; color: #9aa4b8; font-size: 11px; line-height: 18px; text-align: center; user-select: none; -webkit-user-select: none; letter-spacing: 1px; box-shadow: 0 2px 10px rgba(0,0,0,.4); }
}
`

const DESK_SB_SCRIPT = `(function(){try{
document.documentElement.setAttribute('data-desk-wb','1');
if(!window.matchMedia||!document.addEventListener)return;
if(!Element.prototype.closest){Element.prototype.closest=function(s){var el=this;while(el&&el.nodeType===1){if(el.matches&&el.matches(s))return el;el=el.parentElement||el.parentNode;}return null;};}
var mq=window.matchMedia('(max-width:820px)');
var fe=null,sc=null,g=null,cut=0,maxCut=0,minVis=80,scH=820,rootH=0,focused=false,focusAt=0,smallSince=0,wasSmall=false,pp=null,mo=null,root=null,tries=0,tick=0,lastTap=null,lastTapAt=0,lastBlur=null,lastBlurAt=0,sw=null;
function setP(el,k,v){if(!el)return;try{el.style.setProperty(k,v,'important');}catch(e){try{el.style[k]=v;}catch(e2){}}}
function remP(el,k){if(!el)return;try{el.style.removeProperty(k);}catch(e){try{el.style[k]='';}catch(e2){}}}
function getRoot(){if(!sc)return null;if(root&&root.isConnected)return root;root=null;
var walk=function(el,dep){if(!el||dep>4)return null;var kids=el.children;for(var i=0;i<kids.length;i++){var k=kids[i];var c;
try{c=getComputedStyle(k);}catch(e){continue;}
if(c.display==='contents'){var r=walk(k,dep+1);if(r)return r;continue;}
if(c.position==='absolute')continue;
return k;}return null;};
root=walk(sc,0);return root;}
function find(){try{
if(!sc||!sc.isConnected){sc=document.querySelector('[class*="sidebarCol"]');root=null;rootH=0;}
if(!sc)return false;
var f=sc.closest('[class*="frame"]')||sc.parentElement;
if(f&&f!==fe){fe=f;try{if(mo)mo.disconnect();mo=new MutationObserver(sync);
mo.observe(fe,{attributes:true,attributeFilter:['data-sidebar-collapsed']});}catch(_){}}
if(fe&&fe.getAttribute('data-desk-frame')!=='1')fe.setAttribute('data-desk-frame','1');
return !!fe;}catch(e){return false;}}
function ex(){return !!fe&&fe.getAttribute('data-desk-collapsed')!=='true';}
function measure(){if(!sc)return;var r=sc.getBoundingClientRect();
scH=Math.round(r.height)+(cut>4?cut:0);
if(cut<=4){var rt=getRoot();if(rt){var rr=rt.getBoundingClientRect();if(rr.height>150)rootH=Math.round(rr.height);}}
var bs=sc.querySelectorAll('button');var lb=bs.length?bs[bs.length-1]:null;var mv=80;
if(lb){var lr=lb.getBoundingClientRect();mv=Math.round(r.bottom-lr.bottom+lr.height+12);}
minVis=Math.max(60,Math.min(mv,scH-40));maxCut=Math.max(0,Math.round(scH-minVis));}
function setTop(v){if(!sc)return;if(v>0){setP(sc,'top',(12+v)+'px');}else{remP(sc,'top');}}
function sync(){try{tick++;if(tick%7===0)stripTitles();
if(!find())return;
var col=fe.getAttribute('data-sidebar-collapsed')==='true';
if(col&&cut>0){cut=0;}
if(col){if(fe.getAttribute('data-desk-collapsed')!=='true')fe.setAttribute('data-desk-collapsed','true');}
else{if(fe.hasAttribute('data-desk-collapsed'))fe.removeAttribute('data-desk-collapsed');}
if(mq.matches&&!col)measure();
apply();}catch(e){}}
function kbOpen(){try{if(window.visualViewport&&window.innerHeight-window.visualViewport.height>120)return true;}catch(e){}return false;}
function hide(){var isSmall=cut>4&&(scH-cut)<240;if(isSmall&&!wasSmall)smallSince=Date.now();wasSmall=isSmall;return isSmall&&(kbOpen()||(focused&&focusAt>=smallSince));}
function apply(){try{if(!fe)return;
if(cut>4&&ex()){if(fe.getAttribute('data-desk-sbshrink')!=='1')fe.setAttribute('data-desk-sbshrink','1');
try{document.documentElement.style.setProperty('--desk-sb-cut',cut+'px');}catch(e){}
setTop(cut);
var rt=getRoot();if(rt){var rh=rootH>150?rootH:Math.max(200,scH-26);
setP(rt,'margin-top','-'+cut+'px');setP(rt,'height',Math.round(rh)+'px');}}
else{if(fe.hasAttribute('data-desk-sbshrink'))fe.removeAttribute('data-desk-sbshrink');
try{document.documentElement.style.removeProperty('--desk-sb-cut');}catch(e){}
setTop(0);
var rt2=getRoot();if(rt2){remP(rt2,'margin-top');remP(rt2,'height');}}
document.documentElement.classList.toggle('desk-sb-typing',hide());paint();}catch(e){}}
function paint(){try{if(!g)return;
var show=!!(mq.matches&&sc&&sc.isConnected&&ex());
if(!show){if(g.style.display!=='none')g.style.display='none';return;}
var r=sc.getBoundingClientRect();
g.style.display='flex';g.style.left=Math.round(r.left)+'px';g.style.width=Math.round(r.width)+'px';
g.style.top=Math.max(2,Math.round(r.top-17))+'px';}catch(e){}}
function setCut(v,sn){measure();var m=Math.round(v);if(m<0)m=0;if(m>maxCut)m=maxCut;
if(sn){if(m<90)m=0;else if(m>maxCut-50)m=maxCut;}
cut=m;apply();}
function wireDrag(){
function getY(e){if(e.touches&&e.touches.length)return e.touches[0].clientY;
if(e.changedTouches&&e.changedTouches.length)return e.changedTouches[0].clientY;
return e.clientY;}
function down(e){if(!ex())return;pp={y:getY(e),c0:cut,moved:false};
if(window.PointerEvent&&e.pointerId!==undefined){try{g.setPointerCapture(e.pointerId);}catch(_){}}
if(e.cancelable)e.preventDefault();}
function move(e){if(!pp)return;var dy=getY(e)-pp.y;
if(!pp.moved&&Math.abs(dy)>3)pp.moved=true;
if(pp.moved){setCut(pp.c0+dy,false);if(e.cancelable)e.preventDefault();}}
function up(){if(!pp)return;var m=pp.moved;pp=null;
if(m){setCut(cut,true);}else{setCut(cut>4?0:Math.max(20,maxCut),true);}}
if(window.PointerEvent){
g.addEventListener('pointerdown',down);g.addEventListener('pointermove',move);
g.addEventListener('pointerup',up);g.addEventListener('pointercancel',up);}
else{
try{g.addEventListener('touchstart',down,{passive:false});}catch(_){g.addEventListener('touchstart',down);}
try{g.addEventListener('touchmove',move,{passive:false});}catch(_){g.addEventListener('touchmove',move);}
g.addEventListener('touchend',up);g.addEventListener('touchcancel',up);
g.addEventListener('mousedown',down);
document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);}
}
function openSb(){try{var bs=document.querySelectorAll('button[aria-label]');
for(var i=0;i<bs.length;i++){var al=bs[i].getAttribute('aria-label')||'';
if(/open sidebar|打开侧边栏/i.test(al)){bs[i].click();return true;}}}catch(e){}return false;}
function tapOnEditor(){try{if(!lastTap||Date.now()-lastTapAt>1000)return false;var t=lastTap;
if(t.closest&&(t.closest('[contenteditable="true"]')||t.closest('[class*="CtUWPa"]')))return true;
return false;}catch(e){return false;}}
function stripTitles(){try{if(!mq.matches)return;var els=document.querySelectorAll('[title]');
for(var i=0;i<els.length;i++){var e=els[i],t=e.getAttribute('title');
if(t){e.setAttribute('data-desk-t',t);e.removeAttribute('title');}}}catch(e){}}
function wireMobileUx(){try{
document.addEventListener('touchstart',function(e){try{lastTap=e.target;lastTapAt=Date.now();
if(!mq.matches||ex())return;var t=e.touches&&e.touches[0];if(!t)return;
if(t.clientX<=24)sw={x:t.clientX,y:t.clientY,ok:true};}catch(x){}},true);
document.addEventListener('mousedown',function(e){lastTap=e.target;lastTapAt=Date.now();},true);
document.addEventListener('touchmove',function(e){try{if(!sw||!sw.ok)return;var t=e.touches&&e.touches[0];if(!t)return;
var dx=t.clientX-sw.x,dy=t.clientY-sw.y;
if(dy>70&&dy>Math.abs(dx)){sw.ok=false;return;}
if(dx>55){sw.ok=false;openSb();}}catch(x){}},true);
document.addEventListener('touchend',function(){sw=null;},true);
document.addEventListener('touchcancel',function(){sw=null;},true);
document.addEventListener('focusin',function(e){try{if(!mq.matches)return;var t=e.target;
if(!(t&&t.closest&&t.closest('[contenteditable="true"]')))return;
if(tapOnEditor())return;
if(lastBlur===t&&Date.now()-lastBlurAt<400)return;
setTimeout(function(){try{lastBlur=t;lastBlurAt=Date.now();t.blur();}catch(x){}},0);}catch(x){}},true);
stripTitles();}catch(e){}}
function boot(){if(!find())return false;
if(!g){g=document.createElement('div');g.id='desk-sb-grip';g.innerHTML='<span>\u22ef</span>';
g.style.display='none';document.body.appendChild(g);wireDrag();}
if(!boot.__wired){boot.__wired=1;
wireMobileUx();

function wireRowClose(){try{
if(!window.matchMedia||!matchMedia('(max-width:820px)').matches)return;
if(window.__deskRowClose)return;window.__deskRowClose=1;
function deskCloseDrawer(n){try{
if(n>240)return;
var f2=document.querySelector('[data-desk-frame]');
if(!f2||f2.getAttribute('data-desk-collapsed')==='true')return;
if(document.querySelector('.ddp.fv')){setTimeout(function(){deskCloseDrawer(n+1);},500);return;}
var bs=document.querySelectorAll('button'),b=null;
for(var i=0;i<bs.length;i++){var a=bs[i].getAttribute('aria-label')||'';if(a==='收起侧边栏'||a==='Collapse sidebar'){b=bs[i];break;}}
if(b)b.click();
}catch(_){}}
document.addEventListener('click',function(ev){try{
var t=ev.target;if(!t||!t.closest)return;
var fr=document.querySelector('[data-desk-frame]');
if(!fr||fr.getAttribute('data-desk-collapsed')==='true')return;
if(!t.closest('[class*=sidebarCol]'))return;
var hit=t.closest('[class*=sessionRow]')||t.closest('[class*=newSession]')||t.closest('[class*=footerActions]')||t.closest('[class*=settingsArea]');
if(!hit)return;
setTimeout(function(){deskCloseDrawer(0);},260);
}catch(_){}},true);
}catch(_){}}
wireRowClose();
function deskDark(){try{
if(!window.matchMedia||!matchMedia('(max-width:820px)').matches)return;
if(document.body&&!document.body.hasAttribute('data-ds-dark-theme'))document.body.setAttribute('data-ds-dark-theme','');
}catch(_){}}
if(document.body)deskDark();else document.addEventListener('DOMContentLoaded',deskDark);
setInterval(deskDark,1500);



document.addEventListener('focusin',function(e){var t=e.target;
focused=!!(t&&t.closest&&t.closest('[contenteditable="true"]'));if(focused)focusAt=Date.now();apply();});
document.addEventListener('focusout',function(){setTimeout(function(){var a=document.activeElement;
focused=!!(a&&a.closest&&a.closest('[contenteditable="true"]'));apply();},140);});
window.addEventListener('resize',function(){if(!mq.matches){cut=0;}sync();});
try{if(window.visualViewport)window.visualViewport.addEventListener('resize',function(){setTimeout(sync,50);});}catch(_){}
setInterval(sync,700);}
sync();return true;}
var t=setInterval(function(){tries++;if(boot()||tries>75){clearInterval(t);}},400);
}catch(e){}})();`;

const usageWidgetTag = (lang: string): string =>
  `<script>window.__DSH_HOST_PERSISTENCE__=true;window.__DESK_LANG=${lang === 'en' ? "'en'" : "'zh'"};${DESK_SB_SCRIPT}</script><link rel="manifest" href="/portal.webmanifest"><link rel="icon" type="image/svg+xml" href="/portal-icon.svg"><meta name="theme-color" content="#faf9f5"><link rel="stylesheet" href="/portal/static/desk-mobile.css">`

/** PWA / 桌面端图标（SVG；浏览器「安装应用」与标签页图标共用） */
const PORTAL_ICON_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
  '<rect width="512" height="512" rx="112" fill="#577da8"/>',
  '<rect x="56" y="56" width="400" height="400" rx="80" fill="none" stroke="#faf9f5" stroke-width="14" opacity="0.92"/>',
  '<text x="256" y="318" font-family="Arial, sans-serif" font-size="172" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="6">DSH</text>',
  '</svg>',
].join('')

/** PWA 位图图标（安卓安装/启动图要求 PNG；由品牌 SVG 渲染并调色板优化，base64 内嵌） */
const PORTAL_ICON_PNG_192 = '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'
const PORTAL_ICON_PNG_512 = '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'

/** 工作台启动闪屏（仅手机；缓解慢网下长时间"黑屏"——应用挂载后自动淡出） */
const bootSplashTag = (lang: string): string => `
<style>#desk-boot{position:fixed;inset:0;z-index:2147483001;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#262624;color:#c0bdb6;font-family:system-ui,"Microsoft YaHei",sans-serif;transition:opacity .35s ease}</style>
<div id="desk-boot"><img src="/portal-icon.svg" width="96" height="96" alt=""><div style="font-size:15px;font-weight:600">${L(lang, '正在加载工作台…', 'Loading workbench…')}</div><div style="font-size:12px;opacity:.55">${L(lang, '网络较慢时首次打开可能需要 30~60 秒', 'First load may take 30-60s on a slow network')}</div></div>
<script>(function(){var el=document.getElementById('desk-boot');if(!el)return;if(!window.matchMedia||!window.matchMedia('(max-width:820px)').matches){el.parentNode&&el.parentNode.removeChild(el);return;}function hide(){var e=document.getElementById('desk-boot');if(!e)return;e.style.opacity='0';setTimeout(function(){e.parentNode&&e.parentNode.removeChild(e)},420);}var iv=setInterval(function(){if(document.querySelector('[class*="ddb"]')){clearInterval(iv);hide();}},300);setTimeout(function(){clearInterval(iv);hide();},60000);})();</script>`

/** 往 dsh 工作台的 HTML 里注入"用量"悬浮小组件（不改 dsh 源码） */
function injectUsageWidget(body: string, lang: string = 'zh'): string {
  const tag = bootSplashTag(lang) + usageWidgetTag(lang)
  if (body.includes('desk-mobile.css')) return body
  const idx = body.lastIndexOf('</body>')
  if (idx === -1) return body + tag
  return body.slice(0, idx) + tag + body.slice(idx)
}


export function startPortal(opts: PortalOptions) {
  const db = opts.db

  const agentPortOf = (userId: number): number | null => {
    const row = db.prepare(`SELECT agent_port AS port FROM users WHERE id = ?`).get(userId) as
      | { port: number | null }
      | undefined
    return row?.port ?? null
  }

  const renderMe = (user: SessionUser, lang: string): string => {
    const urow = db
      .prepare(`SELECT created_at, monthly_budget_cny AS budget FROM users WHERE id = ?`)
      .get(user.id) as { created_at: string; budget: number | null }
    const keyCount = db
      .prepare(`SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ? AND revoked_at IS NULL`)
      .get(user.id) as { n: number }
    const keyPrefix = db
      .prepare(`SELECT prefix FROM api_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY id LIMIT 1`)
      .get(user.id) as { prefix: string } | undefined

    const monthRows = db
      .prepare(`SELECT * FROM usage_events WHERE user_id = ? AND ts >= ?`)
      .all(user.id, monthStartUtc()) as unknown as UsageRow[]
    const dayRows = db
      .prepare(`SELECT * FROM usage_events WHERE user_id = ? AND ts >= ?`)
      .all(user.id, beijingDayStartUtc()) as unknown as UsageRow[]
    const recent = db
      .prepare(`SELECT * FROM usage_events WHERE user_id = ? ORDER BY id DESC LIMIT 10`)
      .all(user.id) as unknown as UsageRow[]

    const month = aggregate(monthRows)
    const day = aggregate(dayRows)

    let budgetHtml = '<span class="muted">' + L(lang, '预算：不限', 'Budget: unlimited') + '</span>'
    if (urow.budget != null) {
      const pct = Math.min(100, (month.cost / urow.budget) * 100)
      const over = month.cost >= urow.budget
      budgetHtml = `<div class="muted">${L(lang, '预算 ¥', 'Budget ¥')}${urow.budget}${L(lang, ' · 已用 ¥', ' · used ¥')}${month.cost.toFixed(4)}${over ? L(lang, '（⚠️ 已超限，请求将被拒）', ' (⚠️ over limit — requests will be rejected)') : L(lang, ' · 剩余 ¥', ' · remaining ¥') + `${(urow.budget - month.cost).toFixed(4)}`}</div>
        <div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div>`
    }

    const rows = recent
      .map(
        (r) =>
          `<tr><td>${esc(bjtime(r.ts))}</td><td>${esc(r.model ?? '-')}${r.channel ? ' <span class="muted">@' + esc(r.channel) + '</span>' : ''}</td><td>${r.cache_hit_tokens} / ${r.cache_miss_tokens} / ${r.completion_tokens}</td><td>¥${eventCost(r).toFixed(4)}</td></tr>`,
      )
      .join('')

    const agentPort = agentPortOf(user.id)
    const workstationCard = agentPort
      ? L(lang, `<div>实例运行中（127.0.0.1:${agentPort}） · <a href="/">进入我的工作台 →</a></div>`, `<div>Instance running (127.0.0.1:${agentPort}) · <a href="/">Open my workbench →</a></div>`)
      : L(lang, '<div class="muted">尚未分配工作台实例（P3 提供自动管理；当前请联系管理员）。</div>', '<div class="muted">No workbench instance assigned yet (ask your admin).</div>')

    const body = `
<h1>${L(lang, '我的用量', 'My usage')}</h1>
<div class="card">
  <div>${L(lang, '账户：', 'Account: ')}<strong>${esc(user.username)}</strong>（${esc(user.role)}）${L(lang, ' · 创建于 ', ' · created ')}${esc(urow.created_at)}${L(lang, '（UTC）', ' (UTC)')}</div>
  <div class="muted">${L(lang, `虚拟钥匙：${keyCount.n} 把（${keyPrefix ? esc(keyPrefix.prefix) + '…' : '无'}） · 密钥仅存哈希，如需重发请在服务器上用 CLI 轮换`, `Virtual keys: ${keyCount.n} (${keyPrefix ? esc(keyPrefix.prefix) + '…' : 'none'}) · keys are stored hashed — rotate via CLI on the server to reissue`)}</div>
</div>
<div class="card">
  <h2>${L(lang, '我的工作台', 'My workbench')}</h2>
  ${workstationCard}
</div>
<div class="grid">
  <div class="card">
    <h2>${L(lang, '本月（估算）', 'This month (est.)')}</h2>
    <div class="big">¥${month.cost.toFixed(4)}</div>
    <div class="muted">${aggLine(month, lang)}</div>
    <div style="margin-top:10px">${budgetHtml}</div>
  </div>
  <div class="card">
    <h2>${L(lang, '今日（北京时间）', 'Today (Beijing time)')}</h2>
    <div class="big">¥${day.cost.toFixed(4)}</div>
    <div class="muted">${aggLine(day, lang)}</div>
  </div>
</div>
<div class="card">
  <h2>${L(lang, '最近请求', 'Recent requests')}</h2>
  <table><thead><tr><th>${L(lang, '时间（北京）', 'Time (Beijing)')}</th><th>${L(lang, '模型', 'Model')}</th><th>${L(lang, '命中/未命中/输出', 'hit/miss/output')}</th><th>${L(lang, '估算', 'Est.')}</th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="muted">${L(lang, '暂无记录', 'No records yet')}</td></tr>`}</tbody></table>
</div>
<div class="muted">${L(lang, `口径：费用按请求发生时刻的峰谷价估算（价格表快照 ${esc(prices.captured_at)}）；本月按 UTC 月初计。`, `Notes: cost is estimated with peak/off-peak prices at request time (price snapshot ${esc(prices.captured_at)}); the month follows UTC.`)}</div>`
    return page(L(lang, '我的用量', 'My usage'), user, body, lang)
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://desk')
    const path = url.pathname
    const cookie = req.headers['cookie']
    const user = userFromSession(db, cookie)
    try {
      if (path === '/healthz') {
        res.writeHead(200, { 'content-type': 'application/json' })
        return res.end(JSON.stringify({ ok: true, service: 'dsh-anywork-portal' }))
      }

      // —— 工作台内小组件：移动端样式 + 用量 JSON ——
      if (req.method === 'GET' && path === '/portal/static/desk-mobile.css') {
        res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-cache' })
        return res.end(DESK_MOBILE_CSS + CLAUDE_M_CSS)
      }
      if (req.method === 'GET' && path === '/portal/api/usage') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        const monthRows = db
          .prepare(`SELECT * FROM usage_events WHERE user_id = ? AND ts >= ?`)
          .all(user.id, monthStartUtc()) as unknown as UsageRow[]
        const dayRows = db
          .prepare(`SELECT * FROM usage_events WHERE user_id = ? AND ts >= ?`)
          .all(user.id, beijingDayStartUtc()) as unknown as UsageRow[]
        const recent = db
          .prepare(`SELECT * FROM usage_events WHERE user_id = ? ORDER BY id DESC LIMIT 5`)
          .all(user.id) as unknown as UsageRow[]
        const urow = db
          .prepare(`SELECT monthly_budget_cny AS budget FROM users WHERE id = ?`)
          .get(user.id) as { budget: number | null } | undefined
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(
          JSON.stringify({
            username: user.username,
            month: aggregate(monthRows),
            day: aggregate(dayRows),
            budget: urow?.budget ?? null,
            recent: recent.map((r) => ({ time: bjtime(r.ts), model: r.model ?? '-', channel: r.channel ?? null, cost: eventCost(r) })),
          }),
        )
      }
      if (req.method === 'GET' && path === '/portal/api/kb/search') {
        const kbTok = String(req.headers['x-desk-notify-token'] ?? '')
        const kbTokOk = kbTok !== '' && kbTok === readOrCreateNotifyToken(defaultDataDir())
        if (!user && !kbTokOk) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        const q = (url.searchParams.get('q') ?? '').slice(0, 100)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify(kbSearch(q)))
      }
      if (req.method === 'GET' && path === '/portal/api/kb/list') {
        const token = String(req.headers['x-desk-notify-token'] ?? '')
        const tokenOk = token !== '' && token === readOrCreateNotifyToken(defaultDataDir())
        if (!user && !tokenOk) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ notes: listKbNotes(30), role: user ? user.role : 'agent' }))
      }
      if (req.method === 'GET' && path === '/portal/api/kb/note') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        const r = readKbNote(url.searchParams.get('name') ?? '')
        res.writeHead('ok' in r ? 200 : /不存在|not found/.test(r.error) ? 404 : 400, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify(r))
      }
      if (path === '/portal/api/kb/save' && req.method === 'POST') {
        const token = String(req.headers['x-desk-notify-token'] ?? '')
        const tokenOk = token !== '' && token === readOrCreateNotifyToken(defaultDataDir())
        if (!user && !tokenOk) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        let kbody: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') kbody = v as Record<string, unknown>
        } catch {
          kbody = {}
        }
        const author = user ? user.username : String(kbody.author ?? 'agent').trim().slice(0, 64) || 'agent'
        const r = saveKbNote({ title: String(kbody.title ?? ''), content: String(kbody.content ?? ''), tags: String(kbody.tags ?? ''), author })
        res.writeHead('ok' in r ? 200 : 400, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify(r))
      }
      if (path === '/portal/api/kb/rm' && req.method === 'POST') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        if (user.role !== 'admin') {
          res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: 'admin only' }))
        }
        let rbody: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') rbody = v as Record<string, unknown>
        } catch {
          rbody = {}
        }
        const r = removeKbNote(rbody.name)
        res.writeHead('ok' in r ? 200 : 404, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify(r))
      }
      if (path === '/portal/api/drive/list' && req.method === 'GET') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        const r = listDrive(url.searchParams.get('path') ?? '')
        res.writeHead('error' in r ? 400 : 200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify(r))
      }
      if (path === '/portal/api/drive/download' && req.method === 'GET') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        const r = resolveInDrive(url.searchParams.get('path') ?? '')
        if ('error' in r || !existsSync(r.abs)) {
          res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: 'not found' }))
        }
        let st
        try {
          st = statSync(r.abs)
        } catch {
          res.writeHead(404)
          return res.end()
        }
        if (!st.isFile()) {
          res.writeHead(404)
          return res.end()
        }
        const fname = r.abs.split('/').pop() ?? 'download'
        res.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': st.size,
          'content-disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(fname),
        })
        return createReadStream(r.abs).pipe(res)
      }
      if (path === '/portal/api/drive/upload' && req.method === 'POST') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        const rel = url.searchParams.get('path') ?? ''
        const name = url.searchParams.get('name') ?? ''
        const chunks: Buffer[] = []
        let size = 0
        let tooBig = false
        req.on('data', (c: Buffer) => {
          size += c.length
          if (size > MAX_UPLOAD) {
            tooBig = true
            res.writeHead(413, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ error: 'file too large (max 50MB)' }))
            req.destroy()
            return
          }
          chunks.push(c)
        })
        req.on('end', () => {
          if (tooBig) return
          const saved = saveToDrive(rel, name, Buffer.concat(chunks))
          res.writeHead('error' in saved ? 400 : 200, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify(saved))
        })
        req.on('error', () => {
          if (!tooBig && !res.headersSent) {
            res.writeHead(400)
            res.end()
          }
        })
        return
      }
      // —— 公司盘：文件夹与分类（2026-09-29 团队资料面板）——
      if (path === '/portal/api/drive/mkdir' && req.method === 'POST') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        let b: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') b = v as Record<string, unknown>
        } catch {
          b = {}
        }
        const r = makeDir(String(b.path ?? ''), String(b.name ?? ''))
        res.writeHead('error' in r ? 400 : 200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify(r))
      }
      if (path === '/portal/api/drive/rm' && req.method === 'POST') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        let b: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') b = v as Record<string, unknown>
        } catch {
          b = {}
        }
        const r = removePath(String(b.path ?? ''))
        res.writeHead('error' in r ? 400 : 200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify(r))
      }
      if (path === '/portal/api/drive/mv' && req.method === 'POST') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        let b: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') b = v as Record<string, unknown>
        } catch {
          b = {}
        }
        const r = movePath(String(b.from ?? ''), String(b.to ?? ''))
        res.writeHead('error' in r ? 400 : 200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify(r))
      }
      // —— 通知桥：agent 侧入口（desk-notify 脚本；令牌认证，不走登录会话）——
      if (path === '/portal/api/notify' && req.method === 'POST') {
        const token = String(req.headers['x-desk-notify-token'] ?? '')
        const expect = readOrCreateNotifyToken(defaultDataDir())
        if (!token || token !== expect) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'invalid notify token' }))
        }
        let body: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') body = v as Record<string, unknown>
        } catch {
          body = {}
        }
        const text = String(body.text ?? '').trim()
        if (!text) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: L(langOf(req), 'text 不能为空', 'text cannot be empty') }))
        }
        const routeFilter = Array.isArray(body.routes) ? (body.routes as unknown[]).map((x) => String(x)) : []
        const results = await dispatchNotify(
          db,
          { title: String(body.title ?? '').trim(), text, source: String(body.source ?? 'agent') },
          routeFilter.length ? { routes: routeFilter } : undefined,
        )
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ results }))
      }
      // —— 通知桥：定时提醒（agent 侧，令牌认证）——
      if ((path === '/portal/api/remind' || path === '/portal/api/remind/rm') && (req.method === 'GET' || req.method === 'POST')) {
        const token = String(req.headers['x-desk-notify-token'] ?? '')
        const expect = readOrCreateNotifyToken(defaultDataDir())
        if (!token || token !== expect) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'invalid notify token' }))
        }
        if (path === '/portal/api/remind' && req.method === 'GET') {
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ pending: listReminders(db) }))
        }
        let rbody: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') rbody = v as Record<string, unknown>
        } catch {
          rbody = {}
        }
        if (path === '/portal/api/remind/rm') {
          removeReminder(db, Number(rbody.id ?? 0))
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ ok: true }))
        }
        const added = addReminder(db, {
          atEpoch: Number(rbody.at_epoch ?? 0),
          title: String(rbody.title ?? ''),
          text: String(rbody.text ?? ''),
          source: String(rbody.source ?? 'agent'),
        })
        if ('error' in added) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: added.error }))
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true, id: added.id, at_epoch: added.atEpoch }))
      }
      // —— 公告板 + 意见反馈（登录会话即可；管理操作需 admin）——
      if (path === '/portal/api/announcements' && req.method === 'GET') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        const announcements = db.prepare(`SELECT id, title, body, created_by, created_at FROM announcements ORDER BY id DESC LIMIT 50`).all()
        const feedback =
          user.role === 'admin'
            ? db.prepare(`SELECT id, username, text, created_at FROM feedback ORDER BY id DESC LIMIT 50`).all()
            : db.prepare(`SELECT id, username, text, created_at FROM feedback WHERE user_id = ? ORDER BY id DESC LIMIT 10`).all(user.id)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ role: user.role, announcements, feedback }))
      }
      if (path === '/portal/api/announcements/post' && req.method === 'POST') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        if (user.role !== 'admin') {
          res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: 'admin only' }))
        }
        let abody: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') abody = v as Record<string, unknown>
        } catch {
          abody = {}
        }
        const title = String(abody.title ?? '').trim().slice(0, 80)
        const bodyText = String(abody.body ?? '').trim().slice(0, 2000)
        if (!bodyText) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: L(langOf(req), '公告内容不能为空', 'Announcement content cannot be empty') }))
        }
        const info = db.prepare(`INSERT INTO announcements (title, body, created_by) VALUES (?, ?, ?)`).run(title || null, bodyText, user.username)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true, id: Number(info.lastInsertRowid) }))
      }
      if (path === '/portal/api/announcements/rm' && req.method === 'POST') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        if (user.role !== 'admin') {
          res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: 'admin only' }))
        }
        let rmid = 0
        try {
          const v = JSON.parse(await readBody(req)) as Record<string, unknown>
          rmid = Number(v?.id ?? 0)
        } catch {
          rmid = 0
        }
        db.prepare(`DELETE FROM announcements WHERE id = ?`).run(rmid)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true }))
      }
      if (path === '/portal/api/feedback' && req.method === 'POST') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        let fbody: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') fbody = v as Record<string, unknown>
        } catch {
          fbody = {}
        }
        const ftext = String(fbody.text ?? '').trim().slice(0, 1000)
        if (!ftext) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: L(langOf(req), '反馈内容不能为空', 'Feedback content cannot be empty') }))
        }
        db.prepare(`INSERT INTO feedback (user_id, username, text) VALUES (?, ?, ?)`).run(user.id, user.username, ftext)
        if (ruleEnabled(db, 'feedback')) {
          dispatchNotify(db, {
            title: '新意见反馈',
            text: `成员 ${user.username} 提交了反馈：${ftext.slice(0, 120)}${ftext.length > 120 ? '…' : ''}`,
            source: 'feedback',
          }).catch(() => {})
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true }))
      }
      if (path === '/portal/api/feedback/rm' && req.method === 'POST') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        if (user.role !== 'admin') {
          res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: 'admin only' }))
        }
        let frmid = 0
        try {
          const v = JSON.parse(await readBody(req)) as Record<string, unknown>
          frmid = Number(v?.id ?? 0)
        } catch {
          frmid = 0
        }
        db.prepare(`DELETE FROM feedback WHERE id = ?`).run(frmid)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true }))
      }
      // —— 任务板（登录会话；管理员 / 创建人 / 当前指派人可改，任何人可接领无主任务）——
      // —— 侧栏面板：助理 / 技能·连接器 / 自动化（团队版扩展）——
      if (req.method === 'GET' && path === '/portal/api/panel/presets') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true, presets: collectPresets() }))
      }
      if (req.method === 'GET' && path === '/portal/api/panel/skills') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true, skills: collectSkills() }))
      }
      if (req.method === 'GET' && path === '/portal/api/panel/skill') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify(readSkill(url.searchParams.get('name') ?? '', langOf(req))))
      }
      if (req.method === 'GET' && path === '/portal/api/panel/connectors') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true, role: user.role, items: collectConnectors(db, langOf(req)), platforms: collectPlatforms(db, langOf(req), user.username) }))
      }
      // —— 我的微信（成员自助绑定：出码 → 扫码确认 → 自动接入微信桥与通知）——
      if (req.method === 'POST' && path === '/portal/api/wx/bind-start') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        const r = await startWxBind(user.username)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify(r))
      }
      if (req.method === 'GET' && path === '/portal/api/wx/bind-status') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        const r = await checkWxBind(db, user.username, url.searchParams.get('id') || '')
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify(r))
      }
      if (req.method === 'GET' && path === '/portal/api/wx/mine') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        let bound = false
        try {
          bound = !!db.prepare(`SELECT id FROM wx_chat WHERE account = ? AND enabled = 1`).get(user.username)
        } catch {
          bound = false
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true, bound }))
      }
      if (req.method === 'GET' && path === '/portal/api/panel/auto') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true, role: user.role, reminders: listReminders(db), recent: listRemindersSent(db, 5) }))
      }
      // —— 子代理（agents/*.md 定义管理）——
      if (req.method === 'GET' && path === '/portal/api/panel/agents') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true, role: user.role, items: collectAgents() }))
      }
      if (req.method === 'GET' && path === '/portal/api/panel/agent') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify(readAgent(url.searchParams.get('file') ?? '', langOf(req))))
      }
      if (req.method === 'GET' && path === '/portal/api/panel/agent-runs') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true, items: collectAgentRuns(db, 30, user.role === 'admin' ? undefined : { user: String(user.username) }) }))
      }
      // —— 自动化（成员自建定时任务 + 团队规则卡）——
      if (req.method === 'GET' && path === '/portal/api/auto') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        ensureRuleRows(db)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(
          JSON.stringify({
            ok: true,
            role: user.role,
            items: listAutos(db, { username: user.username, role: String(user.role) }),
            logs: listAutoLog(db, 20),
            stats: autoStats(db),
            rules: RULE_CATALOG,
          }),
        )
      }
      if (
        req.method === 'POST' &&
        (path === '/portal/api/auto/add' ||
          path === '/portal/api/auto/rm' ||
          path === '/portal/api/auto/toggle' ||
          path === '/portal/api/auto/run' ||
          path === '/portal/api/auto/quick')
      ) {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        let ab: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') ab = v as Record<string, unknown>
        } catch {
          ab = {}
        }
        const viewer = { username: user.username, role: String(user.role) }
        if (path === '/portal/api/auto/add') {
          const r = addTimer(db, user.username, {
            name: String(ab.name ?? ''),
            schedule: String(ab.schedule ?? ''),
            action: ab.action,
          })
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify('error' in r ? { error: r.error } : { ok: true, id: r.id, next_run_at: r.nextRunAt }))
        }
        if (path === '/portal/api/auto/rm') {
          const r = removeAuto(db, viewer, Number(ab.id ?? 0))
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify(r))
        }
        if (path === '/portal/api/auto/run') {
          const r = runAutoNow(db, viewer, Number(ab.id ?? 0))
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify(r))
        }
        if (path === '/portal/api/auto/quick') {
          const kind = String(ab.kind ?? '')
          const reply = (obj: Record<string, unknown>): void => {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(obj))
          }
          if (kind === 'briefing') {
            const r = await runQuickAgent(
              db,
              user.username,
              L(langOf(req), '今日简报', 'Daily briefing'),
              L(
                langOf(req),
                '把今天（截至现在）我在工作台里的会话要点与进展汇总成一份简报，5 条以内，直接输出内容本身，不要多余客套。',
                "Summarize today's key points and progress from my workspace sessions into a briefing of at most 5 bullets. Output the content itself, no pleasantries.",
              ),
            )
            return reply(
              'error' in r
                ? { error: r.error }
                : {
                    ok: true,
                    msg: L(
                      langOf(req),
                      '已开始：助理正在汇总，跑完会自动推到通知通道（见执行记录）',
                      'Started — the assistant is summarizing; results will be pushed to your channels (see run history).',
                    ),
                  },
            )
          }
          if (kind === 'progress') {
            const rows = db.prepare(`SELECT status, COUNT(*) AS c FROM tasks GROUP BY status`).all() as unknown as { status: string; c: number }[]
            const by: Record<string, number> = {}
            for (const r2 of rows) by[r2.status] = r2.c
            const pending = db.prepare(`SELECT id, title FROM tasks WHERE review_state = 'submitted' ORDER BY id`).all() as unknown as { id: number; title: string }[]
            const text = `${L(langOf(req), '任务进度', 'Task progress')}：${L(langOf(req), '待办', 'todo')} ${by['todo'] ?? 0} · ${L(langOf(req), '进行中', 'doing')} ${by['doing'] ?? 0} · ${L(langOf(req), '已完成', 'done')} ${by['done'] ?? 0}${pending.length ? '；' + L(langOf(req), '待验收', 'awaiting review') + '：' + pending.map((t2) => `#${t2.id} ${t2.title}`).join('、') : ''}`
            const r = await runQuickNotify(db, L(langOf(req), '任务进度汇总', 'Task progress digest'), L(langOf(req), '任务进度', 'Task progress'), text)
            return reply(r.ok ? { ok: true, msg: text } : { error: r.info + '：' + text })
          }
          if (kind === 'remind') {
            if (String(user.role) !== 'admin') return reply({ error: L(langOf(req), '给全员发提醒仅管理员可用', 'Admin only') })
            const text = String(ab.text ?? '').trim().slice(0, 600)
            if (!text) return reply({ error: L(langOf(req), '内容不能为空', 'Message cannot be empty') })
            const r = await runQuickNotify(db, L(langOf(req), '全员提醒', 'Team reminder'), L(langOf(req), '团队提醒', 'Team reminder'), text)
            return reply(r.ok ? { ok: true, msg: L(langOf(req), '已发送', 'Sent') } : { error: r.info })
          }
          return reply({ error: 'unknown quick kind' })
        }
        const r = toggleAuto(db, viewer, Number(ab.id ?? 0))
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify(r))
      }
      // —— 会话管理（成员：申请删除 / 撤销；管理员审批见 /admin 区）——
      if (req.method === 'GET' && path === '/portal/api/session-mgr/mine') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        const reqs = db
          .prepare(`SELECT id, session_id, title, status, created_at, decided_by, decided_at FROM session_del_requests WHERE user_id = ? ORDER BY id DESC LIMIT 50`)
          .all(user.id)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true, requests: reqs }))
      }
      if (req.method === 'POST' && path === '/portal/api/session-mgr/request') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        let sbody: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') sbody = v as Record<string, unknown>
        } catch {
          sbody = {}
        }
        const sessionId = String(sbody.session_id ?? '').trim()
        const title = String(sbody.title ?? '').trim().slice(0, 160)
        const reply = (obj: Record<string, unknown>): void => {
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify(obj))
        }
        if (!/^session-[0-9a-fA-F-]{8,64}$/.test(sessionId)) return reply({ error: L(langOf(req), '会话 ID 不合法', 'Invalid session ID') })
        const dup = db
          .prepare(`SELECT id FROM session_del_requests WHERE user_id = ? AND session_id = ? AND status = 'pending'`)
          .get(user.id, sessionId)
        if (dup) return reply({ error: L(langOf(req), '该会话已有一条待审批的申请', 'This session already has a pending request') })
        db.prepare(`INSERT INTO session_del_requests (user_id, username, session_id, title) VALUES (?, ?, ?, ?)`).run(
          user.id,
          user.username,
          sessionId,
          title || null,
        )
        if (ruleEnabled(db, 'session_del')) {
          dispatchNotify(db, {
            title: '会话删除申请',
            text: `成员 ${user.username} 请求删除会话「${title || sessionId}」——到 工作台 设置 → 会话管理 审批。`,
            source: 'session-mgr',
          }).catch(() => {})
        }
        return reply({ ok: true })
      }
      if (req.method === 'POST' && path === '/portal/api/session-mgr/cancel') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        let cbody: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') cbody = v as Record<string, unknown>
        } catch {
          cbody = {}
        }
        const id = Number(cbody.id ?? 0)
        db.prepare(`UPDATE session_del_requests SET status = 'cancelled', decided_at = datetime('now') WHERE id = ? AND user_id = ? AND status = 'pending'`).run(id, user.id)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true }))
      }
      if (path === '/portal/api/tasks' && req.method === 'GET') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        const tasks = db
          .prepare(
            `SELECT id, title, note, status, assignee, created_by, created_at, updated_at,
                    review_state, submitted_by, submitted_at, submit_note, commit_refs, session_refs,
                    reviewed_by, reviewed_at, review_note FROM tasks
             ORDER BY CASE status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END, id DESC LIMIT 200`,
          )
          .all()
        const members = (db.prepare(`SELECT username FROM users ORDER BY id`).all() as unknown as { username: string }[]).map((m) => m.username)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ role: user.role, me: user.username, members, tasks }))
      }
      if (path === '/portal/api/tasks/create' && req.method === 'POST') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        let cbody: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') cbody = v as Record<string, unknown>
        } catch {
          cbody = {}
        }
        const title = String(cbody.title ?? '').trim().slice(0, 120)
        const note = String(cbody.note ?? '').trim().slice(0, 1000)
        const assignee = String(cbody.assignee ?? '').trim().slice(0, 64)
        if (!title) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: L(langOf(req), '任务标题不能为空', 'Task title cannot be empty') }))
        }
        if (assignee) {
          const known = db.prepare(`SELECT username FROM users WHERE username = ?`).get(assignee)
          if (!known) {
            res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: L(langOf(req), '指派对象不存在', 'Assignee does not exist') }))
          }
        }
        const info = db.prepare(`INSERT INTO tasks (title, note, status, assignee, created_by) VALUES (?, ?, 'todo', ?, ?)`).run(title, note || null, assignee || null, user.username)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true, id: Number(info.lastInsertRowid) }))
      }
      if (path === '/portal/api/tasks/update' && req.method === 'POST') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        let ubody: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') ubody = v as Record<string, unknown>
        } catch {
          ubody = {}
        }
        const tid = Number(ubody.id ?? 0)
        const task = db.prepare(`SELECT id, title, note, status, assignee, created_by FROM tasks WHERE id = ?`).get(tid) as
          | { id: number; title: string; note: string | null; status: string; assignee: string | null; created_by: string | null }
          | undefined
        if (!task) {
          res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: L(langOf(req), '任务不存在', 'Task not found') }))
        }
        const newStatus = typeof ubody.status === 'string' ? String(ubody.status) : ''
        const hasAssignee = Object.prototype.hasOwnProperty.call(ubody, 'assignee')
        const newAssignee = hasAssignee ? String(ubody.assignee ?? '').trim().slice(0, 64) : ''
        const claiming = hasAssignee && !task.assignee && newAssignee === user.username
        const isOwner = user.role === 'admin' || task.created_by === user.username || (!!task.assignee && task.assignee === user.username)
        if (!isOwner && !claiming) {
          res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: 'not allowed' }))
        }
        const sets: string[] = []
        const vals: (string | null)[] = []
        if (newStatus && ['todo', 'doing', 'done'].includes(newStatus)) {
          sets.push('status = ?')
          vals.push(newStatus)
        }
        if (hasAssignee) {
          if (newAssignee) {
            const known = db.prepare(`SELECT username FROM users WHERE username = ?`).get(newAssignee)
            if (!known) {
              res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
              return res.end(JSON.stringify({ error: L(langOf(req), '指派对象不存在', 'Assignee does not exist') }))
            }
            sets.push('assignee = ?')
            vals.push(newAssignee)
          } else {
            sets.push('assignee = NULL')
          }
        }
        if (typeof ubody.title === 'string' && String(ubody.title).trim()) {
          sets.push('title = ?')
          vals.push(String(ubody.title).trim().slice(0, 120))
        }
        if (typeof ubody.note === 'string') {
          sets.push('note = ?')
          vals.push(String(ubody.note).trim().slice(0, 1000) || null)
        }
        if (!sets.length) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: L(langOf(req), '没有可更新的字段', 'No fields to update') }))
        }
        sets.push(`updated_at = datetime('now')`)
        db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals, tid)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true }))
      }
      // —— 任务：提交验收（指派/创建人）——
      if (path === '/portal/api/tasks/submit' && req.method === 'POST') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        let sbody: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') sbody = v as Record<string, unknown>
        } catch {
          sbody = {}
        }
        const sid = Number(sbody.id ?? 0)
        const task = db
          .prepare(`SELECT id, title, status, assignee, created_by, review_state FROM tasks WHERE id = ?`)
          .get(sid) as
          | { id: number; title: string; status: string; assignee: string | null; created_by: string | null; review_state: string }
          | undefined
        if (!task) {
          res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: L(langOf(req), '任务不存在', 'Task not found') }))
        }
        const allowed = user.role === 'admin' || task.assignee === user.username || task.created_by === user.username
        if (!allowed) {
          res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: 'not allowed' }))
        }
        if (task.review_state === 'submitted') {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: L(langOf(req), '已有待验收的提交（可先撤回）', 'A submission is already awaiting review (withdraw it first)') }))
        }
        const submitNote = typeof sbody.note === 'string' ? String(sbody.note).trim().slice(0, 500) : ''
        const commitRefs = typeof sbody.commits === 'string' ? String(sbody.commits).trim().slice(0, 2000) : ''
        const sessionId = typeof sbody.session_id === 'string' ? String(sbody.session_id).trim().slice(0, 128) : ''
        const sessionRefs = sessionId ? JSON.stringify([{ id: sessionId }]) : null
        db.prepare(
          `UPDATE tasks SET review_state = 'submitted', submitted_by = ?, submitted_at = datetime('now'),
             submit_note = ?, commit_refs = ?, session_refs = ?,
             reviewed_by = NULL, reviewed_at = NULL, review_note = NULL,
             status = CASE WHEN status = 'todo' THEN 'doing' ELSE status END,
             updated_at = datetime('now') WHERE id = ?`,
        ).run(user.username, submitNote || null, commitRefs || null, sessionRefs, sid)
        const extra = [commitRefs ? '含提交链接' : '', sessionId ? '含关联会话' : ''].filter(Boolean).join('、')
        if (ruleEnabled(db, 'task_review')) {
          dispatchNotify(db, {
            title: '任务待验收',
            text: `成员 ${user.username} 提交任务 #${task.id}「${task.title}」待验收${extra ? '（' + extra + '）' : ''}——到 工作台 设置 → 任务板 处理。`,
            source: 'task-review',
          }).catch(() => {})
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true }))
      }
      // —— 任务：评审（创建人/管理员：通过·打回；提交人：撤回）——
      if (path === '/portal/api/tasks/review' && req.method === 'POST') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        let rbody: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') rbody = v as Record<string, unknown>
        } catch {
          rbody = {}
        }
        const rid = Number(rbody.id ?? 0)
        const action = String(rbody.action ?? '')
        const task = db
          .prepare(`SELECT id, title, assignee, created_by, review_state, submitted_by FROM tasks WHERE id = ?`)
          .get(rid) as
          | { id: number; title: string; assignee: string | null; created_by: string | null; review_state: string; submitted_by: string | null }
          | undefined
        if (!task) {
          res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: L(langOf(req), '任务不存在', 'Task not found') }))
        }
        if (task.review_state !== 'submitted') {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: L(langOf(req), '当前没有待验收的提交', 'No submission is awaiting review') }))
        }
        const note = typeof rbody.note === 'string' ? String(rbody.note).trim().slice(0, 500) : ''
        if (action === 'accept' || action === 'reject') {
          const canReview = user.role === 'admin' || task.created_by === user.username
          if (!canReview) {
            res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: 'not allowed' }))
          }
          if (action === 'reject' && !note) {
            res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: L(langOf(req), '打回必须填写理由', 'A return reason is required') }))
          }
          if (action === 'accept') {
            db.prepare(
              `UPDATE tasks SET review_state = 'accepted', reviewed_by = ?, reviewed_at = datetime('now'),
                 review_note = ?, status = 'done', updated_at = datetime('now') WHERE id = ?`,
            ).run(user.username, note || null, rid)
            if (ruleEnabled(db, 'task_review')) {
              dispatchNotify(db, {
                title: '任务验收通过',
                text: `任务 #${task.id}「${task.title}」已由 ${user.username} 验收通过${note ? '（' + note + '）' : ''}。`,
                source: 'task-review',
              }).catch(() => {})
            }
          } else {
            db.prepare(
              `UPDATE tasks SET review_state = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'),
                 review_note = ?, status = 'doing', updated_at = datetime('now') WHERE id = ?`,
            ).run(user.username, note, rid)
            if (ruleEnabled(db, 'task_review')) {
              dispatchNotify(db, {
                title: '任务被打回',
                text: `任务 #${task.id}「${task.title}」被 ${user.username} 打回，理由：${note}——请处理后重新提交验收。`,
                source: 'task-review',
              }).catch(() => {})
            }
          }
        } else if (action === 'cancel') {
          if (task.submitted_by !== user.username) {
            res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: L(langOf(req), '只有提交人可以撤回', 'Only the submitter can withdraw') }))
          }
          db.prepare(
            `UPDATE tasks SET review_state = 'none', submitted_by = NULL, submitted_at = NULL, submit_note = NULL,
               commit_refs = NULL, session_refs = NULL, reviewed_by = NULL, reviewed_at = NULL, review_note = NULL,
               updated_at = datetime('now') WHERE id = ?`,
          ).run(rid)
        } else {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: L(langOf(req), 'action 仅支持 accept / reject / cancel', 'action must be accept / reject / cancel') }))
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true }))
      }
      if (path === '/portal/api/tasks/delete' && req.method === 'POST') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        let dbody: Record<string, unknown> = {}
        try {
          const v = JSON.parse(await readBody(req)) as unknown
          if (v && typeof v === 'object') dbody = v as Record<string, unknown>
        } catch {
          dbody = {}
        }
        const did = Number(dbody.id ?? 0)
        const task = db.prepare(`SELECT id, created_by FROM tasks WHERE id = ?`).get(did) as { id: number; created_by: string | null } | undefined
        if (!task) {
          res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: L(langOf(req), '任务不存在', 'Task not found') }))
        }
        if (user.role !== 'admin' && task.created_by !== user.username) {
          res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: 'not allowed' }))
        }
        db.prepare(`DELETE FROM tasks WHERE id = ?`).run(did)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true }))
      }
      // —— 团队模型目录（全员：只列模型名与来源，不含任何 key；模型页「团队共用模型」模块用）——
      if (req.method === 'GET' && path === '/portal/api/models-catalog') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        const seenModel = new Set<string>()
        const models: { name: string; source: string }[] = []
        try {
          for (const c of listChannels(db)) {
            if (c.enabled !== 1) continue
            for (const m of c.models) {
              if (!m || seenModel.has(m)) continue
              seenModel.add(m)
              models.push({ name: m, source: c.name })
            }
          }
        } catch { /* 通道读取失败不致命 */ }
        try {
          for (const m of Object.keys(prices.models ?? {})) {
            if (seenModel.has(m)) continue
            seenModel.add(m)
            models.push({ name: m, source: 'default' })
          }
        } catch { /* 价格表读取失败不致命 */ }
        const upHost = (process.env.DESK_UPSTREAM ?? 'https://api.deepseek.com').replace(/^https?:\/\//, '')
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true, upstream: upHost, models }))
      }
      // —— 管理 API（工作台 设置 →「成员管理」插件调用；仅管理员）——
      if (path.startsWith('/portal/api/admin/')) {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        if (user.role !== 'admin') {
          res.writeHead(403, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'admin only' }))
        }
        const readJsonBody = async (): Promise<Record<string, unknown>> => {
          try {
            const v = JSON.parse(await readBody(req)) as unknown
            return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
          } catch {
            return {}
          }
        }
        if (req.method === 'GET' && path === '/portal/api/admin/overview') {
          const memberRows = db
            .prepare(`SELECT id, username, role, status, monthly_budget_cny AS budget, agent_port AS port, created_at, last_login_at FROM users ORDER BY id`)
            .all() as Record<string, unknown>[]
          const mStart = monthStartUtc()
          const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 19).replace('T', ' ')
          const members = memberRows.map((u) => {
            const mrows = db
              .prepare(`SELECT * FROM usage_events WHERE user_id = ? AND ts >= ?`)
              .all(u.id as number, mStart) as unknown as UsageRow[]
            const a = aggregate(mrows)
            const wrows = db
              .prepare(`SELECT * FROM usage_events WHERE user_id = ? AND ts >= ?`)
              .all(u.id as number, weekAgo) as unknown as UsageRow[]
            let week7 = 0
            for (const r of wrows) week7 += eventCost(r)
            const sess = db
              .prepare(`SELECT COUNT(*) AS n FROM login_sessions WHERE user_id = ? AND expires_at > datetime('now')`)
              .get(u.id as number) as { n: number }
            return {
              id: u.id,
              username: u.username,
              role: u.role,
              status: u.status,
              port: u.port,
              budget: u.budget,
              monthEvents: a.events,
              monthCost: a.cost,
              week7,
              lastLogin: u.last_login_at,
              online: sess.n > 0,
              createdAt: u.created_at,
            }
          })
          // 近 7 天（北京）团队用量趋势
          const trendRows = db.prepare(`SELECT * FROM usage_events WHERE ts >= ?`).all(weekAgo) as unknown as UsageRow[]
          const dayMap = new Map<string, number>()
          for (const r of trendRows) {
            const bj = new Date(new Date(String(r.ts).replace(' ', 'T') + 'Z').getTime() + 8 * 3600 * 1000)
            const key = bj.toISOString().slice(0, 10)
            dayMap.set(key, (dayMap.get(key) ?? 0) + eventCost(r))
          }
          const trend: { d: string; s: number }[] = []
          for (let i = 6; i >= 0; i--) {
            const bj = new Date(Date.now() + 8 * 3600 * 1000 - i * 86400 * 1000)
            const key = bj.toISOString().slice(0, 10)
            trend.push({ d: key.slice(5), s: Number((dayMap.get(key) ?? 0).toFixed(4)) })
          }
          const channels = listChannels(db).map((c) => ({
            id: c.id,
            name: c.name,
            baseUrl: c.base_url,
            models: c.models,
            enabled: c.enabled === 1,
            keyPrefix: c.api_key ? c.api_key.slice(0, 6) + '…' : '',
            prices: Object.keys(c.prices).length,
            note: c.note ?? '',
            maxTokensCap: c.max_tokens_cap,
          }))
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ members, channels, trend }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/member-create') {
          const body = await readJsonBody()
          const username = String(body.username ?? '').trim()
          const password = String(body.password ?? '')
          const budgetRaw = String(body.budget ?? '').trim()
          const jerr = (code: number, message: string) => {
            res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: message }))
          }
          if (!/^[a-z0-9][a-z0-9_-]{1,31}$/.test(username)) return jerr(400, L(langOf(req), '用户名格式不对（小写字母数字，2-32 位）', 'Invalid username format (lowercase letters/digits, 2-32)'))
          if (password.length < 6) return jerr(400, L(langOf(req), '密码至少 6 位', 'Password must be at least 6 characters'))
          let budget: number | null = null
          if (budgetRaw) {
            const n = Number(budgetRaw)
            if (!Number.isFinite(n) || n <= 0) return jerr(400, L(langOf(req), '预算需为正数或留空', 'Budget must be a positive number or empty'))
            budget = n
          }
          if (db.prepare(`SELECT id FROM users WHERE username = ?`).get(username)) return jerr(409, L(langOf(req), '用户名已存在', 'Username already exists'))
          const info = db
            .prepare(`INSERT INTO users (username, role, status, password_hash, monthly_budget_cny) VALUES (?, 'member', 'active', ?, ?)`)
            .run(username, hashPassword(password), budget)
          const userId = Number(info.lastInsertRowid)
          const token = newVirtualKey()
          db.prepare(`INSERT INTO api_keys (user_id, token_hash, prefix, label) VALUES (?, ?, ?, 'default')`).run(userId, hashToken(token), token.slice(0, 16))
          // 自动配实例（2026-09-26）：① 写钥匙文件（agent-run.sh 硬检查；明文仅此刻可得）
          // ② 分配实例端口（容器内监督器据此自动完成插件配置并拉起该成员的工作台）
          try {
            const deskHome = process.env.HOME || '/data'
            mkdirSync(join(deskHome, '.desk', 'agents'), { recursive: true })
            writeFileSync(join(deskHome, '.desk', 'agents', `${username}.key`), token, { mode: 0o600 })
          } catch {
            /* 忽略：不阻塞建号 */
          }
          try {
            const row = db.prepare(`SELECT agent_port FROM users WHERE username = ?`).get(username) as { agent_port: number | null } | undefined
            if (!row?.agent_port) {
              const used = new Set((db.prepare(`SELECT agent_port FROM users WHERE agent_port IS NOT NULL`).all() as { agent_port: number }[]).map((x) => x.agent_port))
              let port = 3301
              while (used.has(port)) port++
              db.prepare(`UPDATE users SET agent_port = ? WHERE username = ?`).run(port, username)
            }
          } catch {
            /* 忽略：不阻塞建号 */
          }
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ username, key: token, autoProvision: true }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/member-delete') {
          const body = await readJsonBody()
          const username = String(body.username ?? '').trim()
          const target = db.prepare(`SELECT id, role FROM users WHERE username = ?`).get(username) as { id: number; role: string } | undefined
          if (!target) {
            res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: L(langOf(req), '找不到该成员', 'Member not found') }))
          }
          if (target.role === 'admin') {
            const other = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND id != ?`).get(target.id) as { n: number }
            if (other.n === 0) {
              res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
              return res.end(JSON.stringify({ error: L(langOf(req), '不能删除唯一的管理员账户', 'Cannot delete the sole administrator account') }))
            }
          }
          // usage_events 保留作历史（孤儿行在报表里自然隐藏）；FK 开关包住清删
          db.exec('PRAGMA foreign_keys = OFF')
          try {
            db.prepare(`DELETE FROM api_keys WHERE user_id = ?`).run(target.id)
            db.prepare(`DELETE FROM login_sessions WHERE user_id = ?`).run(target.id)
            db.prepare(`DELETE FROM users WHERE id = ?`).run(target.id)
          } finally {
            db.exec('PRAGMA foreign_keys = ON')
          }
          // 自动回收工作台（2026-09-26）：立即停掉该成员实例；实例目录与残留文件由容器内监督器下一轮对账回收
          try {
            const deskHome = process.env.HOME || '/data'
            const pid = Number(readFileSync(`${deskHome}/.desk/run/${username}.pid`, 'utf8').trim())
            if (pid > 1) {
              try {
                const env = readFileSync(`/proc/${pid}/environ`, 'utf8')
                const isMine = env.includes(`DSH_HOME=${deskHome}/desk-test/${username}`) || readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes('agent-run')
                if (isMine) process.kill(pid, 'SIGKILL')
              } catch {
                /* 目标进程已退出 */
              }
            }
          } catch {
            /* 无实例或文件缺失：交给监督器兜底 */
          }
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ username }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/channel-create') {
          const body = await readJsonBody()
          const name = String(body.name ?? '').trim()
          const baseUrl = String(body.base_url ?? '').trim()
          const apiKey = String(body.api_key ?? '').trim()
          const capRaw = Number(body.max_tokens_cap ?? NaN)
          const maxTokensCap = Number.isFinite(capRaw) && capRaw > 0 ? Math.floor(capRaw) : undefined
          const models = (Array.isArray(body.models) ? (body.models as unknown[]) : String(body.models ?? '').split(','))
            .map((s) => String(s).trim())
            .filter(Boolean)
          let priceObj: Record<string, { in?: number; out?: number }> | undefined
          if (body.prices && typeof body.prices === 'object' && !Array.isArray(body.prices)) priceObj = body.prices as Record<string, { in?: number; out?: number }>
          const r = addChannel(db, {
            name,
            base_url: baseUrl,
            api_key: apiKey || undefined,
            models,
            prices: priceObj,
            note: String(body.note ?? '').trim() || undefined,
            max_tokens_cap: maxTokensCap,
          })
          if ('error' in r) {
            res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: r.error }))
          }
          const syncedCreate = applyChannelChanges(db)
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ name, modelsSynced: syncedCreate }))
        }
        if (req.method === 'POST' && (path === '/portal/api/admin/channel-toggle' || path === '/portal/api/admin/channel-delete')) {
          const body = await readJsonBody()
          const name = String(body.name ?? '').trim()
          if (path === '/portal/api/admin/channel-delete') {
            removeChannel(db, name)
            const syncedDel = applyChannelChanges(db)
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ name, modelsSynced: syncedDel }))
          }
          const cur = listChannels(db).find((c) => c.name === name)
          if (cur) setChannelEnabled(db, name, cur.enabled !== 1)
          const syncedTog = applyChannelChanges(db)
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ name, enabled: cur ? cur.enabled !== 1 : false, modelsSynced: syncedTog }))
        }
        if (req.method === 'GET' && path === '/portal/api/admin/session-mgr') {
          const pending = db
            .prepare(`SELECT id, user_id, username, session_id, title, status, created_at FROM session_del_requests WHERE status = 'pending' ORDER BY id DESC`)
            .all()
          const recent = db
            .prepare(`SELECT id, username, session_id, title, status, created_at, decided_by, decided_at FROM session_del_requests WHERE status != 'pending' ORDER BY id DESC LIMIT 20`)
            .all()
          const members = db.prepare(`SELECT username, agent_port FROM users WHERE status = 'active' ORDER BY id`).all()
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ ok: true, me: user.username, pending, recent, members }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/session-mgr/decide') {
          const body = await readJsonBody()
          const id = Number(body.id ?? 0)
          const action = String(body.action ?? '')
          const reply = (obj: Record<string, unknown>): void => {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(obj))
          }
          if (action !== 'approve' && action !== 'reject') return reply({ error: L(langOf(req), 'action 仅支持 approve / reject', 'action must be approve / reject') })
          const row = db.prepare(`SELECT * FROM session_del_requests WHERE id = ? AND status = 'pending'`).get(id) as
            | { username: string; session_id: string }
            | undefined
          if (!row) return reply({ error: L(langOf(req), '申请不存在或已处理', 'Request not found or already handled') })
          if (action === 'approve') {
            const r = deleteSession(row.username, row.session_id)
            if ('error' in r) return reply({ error: r.error })
            db.prepare(`UPDATE session_del_requests SET status = 'approved', decided_by = ?, decided_at = datetime('now') WHERE id = ?`).run(user.username, id)
            return reply({ ok: true, deleted: true })
          }
          db.prepare(`UPDATE session_del_requests SET status = 'rejected', decided_by = ?, decided_at = datetime('now') WHERE id = ?`).run(user.username, id)
          return reply({ ok: true, rejected: true })
        }
        if (req.method === 'GET' && path === '/portal/api/admin/session-mgr/list') {
          const target = String(url.searchParams.get('user') ?? '').trim()
          const reply = (obj: Record<string, unknown>): void => {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(obj))
          }
          if (!/^[a-z0-9_-]{1,32}$/.test(target)) return reply({ error: L(langOf(req), '用户名不合法', 'Invalid username') })
          const r = await listUserSessions(db, target)
          if ('error' in r) return reply({ error: r.error })
          return reply({ ok: true, sessions: r.sessions })
        }
        if (req.method === 'POST' && path === '/portal/api/admin/session-mgr/delete') {
          const body = await readJsonBody()
          const target = String(body.user ?? '').trim()
          const sessionId = String(body.session_id ?? '').trim()
          const reply = (obj: Record<string, unknown>): void => {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(obj))
          }
          const exists = db.prepare(`SELECT username FROM users WHERE username = ?`).get(target)
          if (!exists) return reply({ error: L(langOf(req), '成员不存在', 'Member not found') })
          const r = deleteSession(target, sessionId)
          if ('error' in r) return reply({ error: r.error })
          return reply({ ok: true, killed: r.killed })
        }
        if (req.method === 'GET' && path === '/portal/api/admin/upstream') {
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          const info = readUpstreamInfo()
          if (info.source === '未配置') info.source = L(langOf(req), '未配置', 'Not configured')
          return res.end(JSON.stringify({ ok: true, ...info }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/upstream-set') {
          const body = await readJsonBody()
          const raw = String(body.api_key ?? '').trim()
          const info = readUpstreamInfo()
          const reply = (obj: Record<string, unknown>): void => {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(obj))
          }
          if (!info.writable) return reply({ error: L(langOf(req), '当前 key 来自环境变量 DESK_REAL_KEY，需在服务环境里修改', 'The current key comes from the DESK_REAL_KEY environment variable; change it in the service environment') })
          if (!/^[\x21-\x7e]{16,200}$/.test(raw)) return reply({ error: L(langOf(req), '格式不合法：应为 sk- 开头、16-200 位可打印字符', 'Invalid format: must start with sk- and be 16-200 printable characters') })
          const cur = readUpstreamKeyRaw()
          if (cur === raw) return reply({ ok: true, unchanged: true, keyMasked: maskKey(raw) })
          writeFileSync(upstreamKeysPath(), `DEEPSEEK_API_KEY=${raw}\n`, { mode: 0o600 })
          reply({ ok: true, restarted: true, keyMasked: maskKey(raw) })
          // 先回响应，再退出进程让 systemd（Restart=always）拉起新进程加载新 key
          setTimeout(() => process.exit(0), 800)
          return
        }
        if (req.method === 'POST' && path === '/portal/api/admin/agent-save') {
          const body = await readJsonBody()
          const reply = (obj: Record<string, unknown>): void => {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(obj))
          }
          return reply(saveAgent(String(body.file ?? '').trim(), String(body.content ?? ''), langOf(req)))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/agent-delete') {
          const body = await readJsonBody()
          const reply = (obj: Record<string, unknown>): void => {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(obj))
          }
          return reply(deleteAgent(String(body.file ?? '').trim(), langOf(req)))
        }

        if (req.method === 'GET' && path === '/portal/api/admin/channel-presets') {
          const presetsOut = CHANNEL_PRESETS.map((p) => ({ ...p, name: langOf(req) === 'en' ? p.nameEn : p.name }))
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ ok: true, presets: presetsOut }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/channel-test') {
          const body = await readJsonBody()
          const chName = String(body.name ?? '').trim()
          const reply = (obj: Record<string, unknown>): void => {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(obj))
          }
          const chT = listChannels(db).find((c) => c.name === chName)
          if (!chT) return reply({ error: L(langOf(req), '通道不存在', 'Channel not found') })
          if (!chT.api_key) return reply({ error: L(langOf(req), '该通道还没有填 API Key', 'This channel has no API key') })
          const testModel = chT.models[0]
          if (!testModel) return reply({ error: L(langOf(req), '该通道还没有配置模型', 'No models configured for this channel') })
          const t0 = Date.now()
          try {
            const r = await fetch(chT.base_url.replace(/\/+$/, '') + '/chat/completions', {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${chT.api_key}` },
              body: JSON.stringify({ model: testModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1, stream: false }),
              signal: AbortSignal.timeout(12000),
            })
            const ms = Date.now() - t0
            if (r.ok) return reply({ ok: true, ms, model: testModel })
            let detail = ''
            try { detail = (await r.text()).slice(0, 160) } catch { /* ignore */ }
            let hint = ''
            if (r.status === 401) hint = L(langOf(req), 'API Key 无效（检查是否贴错/贴漏，或国内/国际站混用）', 'Invalid API key (check for typos or wrong region)')
            else if (r.status === 403) hint = L(langOf(req), '无权限（服务商侧未开通该模型或欠费）', 'Forbidden (model not enabled / no balance)')
            else if (r.status === 404) hint = L(langOf(req), '模型不存在或 Base URL 不对', 'Model not found or wrong Base URL')
            else if (r.status === 429) hint = L(langOf(req), '服务商侧限流（稍后再试）', 'Rate limited (try later)')
            else hint = L(langOf(req), '服务商返回错误', 'Provider returned an error')
            return reply({ error: `HTTP ${r.status} · ${hint}${detail ? ' · ' + detail.slice(0, 120) : ''}` })
          } catch (e) {
            const msg = String(e)
            const hint = /timeout|Timeout|abort/i.test(msg)
              ? L(langOf(req), '连接超时（检查网络，或这个服务商在当前网络不可达）', 'Connection timed out (check network reachability)')
              : msg.slice(0, 200)
            return reply({ error: hint })
          }
        }
        if (req.method === 'GET' && path === '/portal/api/admin/channels') {
          const channels = listChannels(db).map((c) => ({
            id: c.id,
            name: c.name,
            baseUrl: c.base_url,
            models: c.models,
            enabled: c.enabled === 1,
            keyPrefix: c.api_key ? c.api_key.slice(0, 6) + '…' : '',
            prices: Object.keys(c.prices).length,
            note: c.note ?? '',
            maxTokensCap: c.max_tokens_cap,
          }))
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ ok: true, channels }))
        }
        if (req.method === 'GET' && path === '/portal/api/admin/notify') {
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(
            JSON.stringify({
              routes: listNotifyRoutes(db),
              log: listNotifyLog(db, 12),
              reminders: { pending: listReminders(db), recent: listRemindersSent(db, 5) },
            }),
          )
        }
        if (req.method === 'POST' && path === '/portal/api/admin/notify/route-add') {
          const body = await readJsonBody()
          const r = addNotifyRoute(db, { name: String(body.name ?? ''), kind: String(body.kind ?? ''), target: String(body.target ?? ''), lang: langOf(req) })
          if ('error' in r) {
            res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: r.error }))
          }
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ ok: true }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/notify/route-delete') {
          const body = await readJsonBody()
          removeNotifyRoute(db, String(body.name ?? '').trim())
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ ok: true }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/notify/route-toggle') {
          const body = await readJsonBody()
          toggleNotifyRoute(db, String(body.name ?? '').trim())
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ ok: true }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/notify-test') {
          const body = await readJsonBody()
          const tlang = langOf(req)
          const title = String(body.title ?? L(tlang, '工作台通知测试', 'Workbench test notice')).trim()
          const text = String(body.text ?? L(tlang, '这是一条来自 DSH-ANYWORK 的测试通知，收到即通。', 'A test notification from DSH-ANYWORK — if you can read this, it works.')).trim()
          const kind = String(body.kind ?? '').trim()
          const results = await dispatchNotify(db, { title, text, source: 'admin-test' }, { ...(kind ? { kind } : {}), lang: tlang })
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ results }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/conn/add') {
          const body = await readJsonBody()
          const platform = String(body.platform ?? '').trim()
          const config = String(body.config ?? '').trim()
          if (!CONN_PLATFORMS.has(platform)) {
            res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: L(langOf(req), '未知平台', 'Unknown platform') }))
          }
          const err = validateConnConfig(platform, config, langOf(req))
          if (err) {
            res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: err }))
          }
          setConn(db, platform, config)
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ ok: true }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/conn/rm') {
          const body = await readJsonBody()
          removeConn(db, String(body.platform ?? '').trim())
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ ok: true }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/conn/test') {
          const body = await readJsonBody()
          const platform = String(body.platform ?? '').trim()
          const row = getConn(db, platform)
          if (!row) {
            res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: L(langOf(req), '这个平台还没有连接', 'This platform is not connected yet') }))
          }
          const result = await testConn(platform, row.config, langOf(req))
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ ok: true, result }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/reminders/add') {
          const body = await readJsonBody()
          const r = addReminder(db, {
            atEpoch: Number(body.at_epoch ?? 0),
            title: String(body.title ?? '').trim(),
            text: String(body.text ?? ''),
            source: 'portal-panel',
          })
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify(r.error ? { error: r.error } : { ok: true, id: r.id, atEpoch: r.atEpoch }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/reminders/rm') {
          const body = await readJsonBody()
          removeReminder(db, Number(body.id ?? 0))
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ ok: true }))
        }
        if (req.method === 'GET' && path === '/portal/api/admin/ops') {
          const body = await collectOps(db, defaultDataDir(), langOf(req))
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify(body))
        }
        res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ error: 'unknown admin api' }))
      }
      if (path === '/favicon.ico') {
        res.writeHead(204)
        return res.end()
      }
      if (req.method === 'GET' && path === '/portal.webmanifest') {
        res.writeHead(200, { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'no-cache' })
        return res.end(
          JSON.stringify({
            name: L(pageLang(req), 'DSH 团队工作台', 'DSH-ANYWORK Team Workbench'),
            short_name: L(pageLang(req), 'DSH 工作台', 'DSH-ANYWORK'),
            description: L(pageLang(req), 'DSH-ANYWORK · 自托管团队工作台', 'DSH-ANYWORK · self-hosted team workbench'),
            start_url: '/',
            scope: '/',
            display: 'standalone',
            background_color: '#faf9f5',
            theme_color: '#faf9f5',
            icons: [
              { src: '/portal-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
              { src: '/portal-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
              { src: '/portal-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            ],
          }),
        )
      }
      if (req.method === 'GET' && path === '/portal-icon.svg') {
        res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'max-age=86400' })
        return res.end(PORTAL_ICON_SVG)
      }

      if (req.method === 'GET' && path === '/portal-icon-192.png') {
        res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'max-age=86400' })
        return res.end(Buffer.from(PORTAL_ICON_PNG_192, 'base64'))
      }
      if (req.method === 'GET' && path === '/portal-icon-512.png') {
        res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'max-age=86400' })
        return res.end(Buffer.from(PORTAL_ICON_PNG_512, 'base64'))
      }

      // —— 语言切换（写 cookie 后跳回） ——
      if (req.method === 'GET' && path === '/portal/lang') {
        const set = url.searchParams.get('set') === 'en' ? 'en' : 'zh'
        const back = String(url.searchParams.get('back') ?? '/')
        return redirect(res, back.startsWith('/') ? back : '/', `desk_lang=${set}; Path=/; Max-Age=31536000; SameSite=Lax`)
      }

      // —— 登录 ——
      if (req.method === 'GET' && path === '/login') {
        if (user) return redirect(res, '/')
        const lang = pageLang(req)
        const err = url.searchParams.get('err')
        const msg = err === '1' ? `<div class="err">${L(lang, '用户名或密码错误', 'Wrong username or password')}</div>` : err === '2' ? `<div class="err">${L(lang, '尝试次数过多，请稍后再试', 'Too many attempts — try again later')}</div>` : ''
        return html(
          res,
          200,
          page(
            L(lang, '登录', 'Sign in'),
            null,
            `<div class="login-wrap"><div class="card"><img src="/portal-icon.svg" width="44" height="44" alt="DSH" style="border-radius:11px;display:block;margin:0 0 16px">
<h1>${L(lang, '欢迎回来', 'Welcome back')}</h1>
<div class="muted" style="margin:2px 0 4px">${L(lang, '登录你的团队工作台', 'Sign in to your team workbench')}</div>${msg}
<form method="post" action="/login">
<label>${L(lang, '用户名', 'Username')}</label><input name="username" required autofocus>
<label>${L(lang, '密码', 'Password')}</label><input name="password" type="password" required>
<div style="margin-top:14px"><button style="width:100%">${L(lang, '登录', 'Sign in')}</button></div>
</form><div style="margin-top:12px;font-size:12px"><a href="/portal/lang?set=${lang === 'en' ? 'zh' : 'en'}&back=/login">${lang === 'en' ? '中文' : 'English'}</a></div></div></div>`,
            lang,
          ),
        )
      }

      if (req.method === 'POST' && path === '/login') {
        const body = await readBody(req)
        const form = new URLSearchParams(body)
        const username = (form.get('username') ?? '').trim()
        const password = form.get('password') ?? ''
        const ip = req.socket.remoteAddress ?? '?'
        const lockKey = `${username}|${ip}`
        const f = fails.get(lockKey)
        if (f && f.until > Date.now()) return redirect(res, '/login?err=2')
        const urow = db
          .prepare(`SELECT id, password_hash AS ph FROM users WHERE username = ? AND status = 'active'`)
          .get(username) as { id: number; ph: string | null } | undefined
        if (!urow || !verifyPassword(password, urow.ph)) {
          const nf = fails.get(lockKey) ?? { n: 0, until: 0 }
          nf.n += 1
          if (nf.n >= 5) {
            nf.until = Date.now() + 60_000
            nf.n = 0
          }
          fails.set(lockKey, nf)
          return redirect(res, '/login?err=1')
        }
        fails.delete(lockKey)
        const token = createSession(db, urow.id, ip, req.headers['user-agent'])
        db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).run(urow.id)
        return redirect(res, '/', `desk_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`)
      }

      if (path === '/logout') {
        destroySession(db, cookie)
        return redirect(res, '/login', 'desk_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
      }

      // —— 门户页 ——
      if (path === '/portal' || path === '/portal/') {
        return redirect(res, user ? '/portal/me' : '/login')
      }

      if (req.method === 'GET' && path === '/portal/me') {
        if (!user) return redirect(res, '/login')
        return html(res, 200, renderMe(user, pageLang(req, user.username)))
      }

      if (req.method === 'GET' && path === '/portal/admin') {
        if (!user) return redirect(res, '/login')
        // 管理功能已迁入工作台「设置 → 成员管理」（desk-panel 插件页）；此地址不再提供页面
        return redirect(res, '/')
      }







      // —— 登录闸门 + 反代：其余一切路径 → 该成员的 dsh 实例 ——
      if (!user) return redirect(res, '/login')
      const port = agentPortOf(user.id)
      if (!port) {
        return html(
          res,
          200,
          page(
            L(pageLang(req, user.username), '工作台未分配', 'Workbench not assigned'),
            user,
            L(pageLang(req, user.username), '<div class="card"><h1>你的工作台还没有分配实例</h1><div class="muted">当前由管理员在服务器上分配（P3 起提供自动管理）。<br>可以先去 <a href="/portal/me">我的用量</a> 看看账本。</div></div>', '<div class="card"><h1>Your workbench has no instance yet</h1><div class="muted">Your admin assigns instances on the server.<br>Meanwhile you can check <a href="/portal/me">My usage</a>.</div></div>'),
            pageLang(req, user.username),
          ),
        )
      }
      const authAuthority = requestAuthorityOf(req.headers.host)
      const authCookie =
        authAuthority === undefined ? undefined : instanceAuthCookie(userHome(user.username), authAuthority)
      proxyHttp(req, res, port, authCookie, pageLang(req, user.username))
    } catch (err) {
      console.log(`[portal] unhandled: ${String(err)}`)
      try {
        html(res, 500, page('500', null, `<div class="card"><h1>500</h1><div class="muted">${L(pageLang(req), '服务器内部错误。', 'Internal server error.')}</div></div>`, pageLang(req)))
      } catch {
        // 响应已开始
      }
    }
  })

  // —— WebSocket 升级透传（dsh 的 /api/events.* 等）——
  server.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url ?? '/', 'http://desk')
      if (!url.pathname.startsWith('/api/')) {
        socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      const user = userFromSession(db, req.headers['cookie'])
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      const port = agentPortOf(user.id)
      if (!port) {
        socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      const upAuthority = requestAuthorityOf(req.headers.host)
      const upCookie = upAuthority === undefined ? undefined : instanceAuthCookie(userHome(user.username), upAuthority)
      const target = netConnect(port, '127.0.0.1')
      target.on('connect', () => {
        const lines = [`GET ${req.url} HTTP/1.1`]
        for (const [k, v] of Object.entries(req.headers)) {
          if (v === undefined) continue
          if (k.toLowerCase() === 'cookie' && upCookie !== undefined) {
            lines.push(`${k}: ${String(v)}; ${upCookie}`)
            continue
          }
          if (Array.isArray(v)) {
            for (const vv of v) lines.push(`${k}: ${vv}`)
          } else {
            lines.push(`${k}: ${v}`)
          }
        }
        target.write(lines.join('\r\n') + '\r\n\r\n')
        if (head && head.length > 0) target.write(head)
        target.pipe(socket)
        socket.pipe(target)
      })
      target.on('error', () => {
        try {
          socket.destroy()
        } catch {
          // 已断开
        }
      })
      socket.on('error', () => {
        try {
          target.destroy()
        } catch {
          // 已断开
        }
      })
    } catch (err) {
      console.log(`[portal] upgrade error: ${String(err)}`)
      try {
        socket.destroy()
      } catch {
        // 已断开
      }
    }
  })

  server.listen(opts.port, opts.host)
  console.log(`[portal] listening on http://${opts.host}:${opts.port}`)
  return server
}

const CLAUDE_M_CSS = `
/* ===== Claude 移动端风格（暖黑 + 陶土）· 2026-10-15 =====
   仅作用于 ≤820px（手机/窄屏）；令牌对齐 dsh 的 --dsw-alias-*；
   作用域挂在 html[data-desk-wb]（工作台专有标记），门户页不受影响。
   参考来源：统一设计令牌 + 手机视口验证（390×844）。 */
@media (max-width: 820px) {
html[data-desk-wb] body {
  --dsw-alias-bg-base: #151515 !important;
  --dsw-alias-bg-layer-1: #1E1E1D !important;
  --dsw-alias-bg-layer-2: #262625 !important;
  --dsw-alias-bg-layer-3: #2E2D2B !important;
  --dsw-alias-bg-module-platform: #1A1A19 !important;
  --dsw-alias-bg-multi-select: #262625 !important;
  --dsw-alias-bg-skeleton: rgba(255,255,255,0.06) !important;
  --dsw-alias-label-primary: #F0EFEC !important;
  --dsw-alias-label-primary-dimmed: #DDDBD3 !important;
  --dsw-alias-label-primary-bluish: #DDDBD3 !important;
  --dsw-alias-label-secondary: #A8A69D !important;
  --dsw-alias-label-caption: #A19E95 !important;
  --dsw-alias-label-primary-inverted: #FFFFFF !important;
  --dsw-alias-border-l1: rgba(255,255,255,0.08) !important;
  --dsw-alias-border-l2: rgba(255,255,255,0.14) !important;
  --dsw-alias-border-l4: rgba(255,255,255,0.28) !important;
  --dsw-alias-border-inverted: rgba(255,255,255,0.08) !important;
  --dsw-alias-border-inverted2: rgba(255,255,255,0.08) !important;
  --dsw-alias-border-l2-darkmode-thin: rgba(255,255,255,0.10) !important;
  --dsw-alias-button-primary-fill: #D97757 !important;
  --dsw-alias-button-primary-hover: #E08A6A !important;
  --dsw-alias-button-primary-dimmed: #4A2E22 !important;
  --dsw-alias-brand-primary-new-colorprimary-new-color: #D97757 !important;
  --dsw-alias-brand-primary: #F0EFEC !important;
  --dsw-alias-interactive-bg-hover: rgba(255,255,255,0.07) !important;
  --dsw-alias-interactive-bg-active: rgba(255,255,255,0.12) !important;
  --dsw-alias-interactive-bg-hover-solid: #232322 !important;
  --dsw-alias-interactive-bg-hover-accent: rgba(217,119,87,0.18) !important;
  --dsw-alias-sidebar-nav-item-active-accent: #D97757 !important;
  --dsw-specific-sidebar-nav-item-active-accent: #D97757 !important;
  --dsw-alias-button-elevated-fill: #1E1E1D !important;
  --dsw-alias-button-floating-fill: #1E1E1D !important;
  --dsw-alias-tooltip-bg: #2E2D2B !important;
  --dsw-alias-toast-bg: #2E2D2B !important;
  --dsw-alias-bg-mask-1: rgba(0,0,0,0.55) !important;
  --dsw-alias-bg-mask-2: rgba(0,0,0,0.35) !important;
  --dsw-alias-bg-mask-3: rgba(0,0,0,0.55) !important;
  --dsw-alias-bg-mask-drop: rgba(21,21,21,0.72) !important;
  --dsw-alias-button-ghost-active-border: rgba(255,255,255,0.30) !important;
  --dsw-elevation-stroke-color: rgba(255,255,255,0.16) !important;
  --dsh-aqua-spot-color: hsla(15, 63%, 60%, 0.10) !important;
  --dsw-alias-scrollbar-bg-l1: rgba(255,255,255,0.15) !important;
  --dsw-alias-scrollbar-bg-l2: rgba(255,255,255,0.25) !important;
  --dsw-alias-button-tool-bar-fill: rgba(38,38,37,0.65) !important;
  --dsw-alias-button-tool-bar-fill-invisible: rgba(38,38,37,0.35) !important;
  --dsw-alias-state-business-primary: #D97757 !important;
  --dsw-alias-button-info-fill: #D97757 !important;
  background: #151515 !important;
}
/* 隐藏 aqua 玻璃视觉层（渐变/网格/粒子都画在 canvas 上）——仅玻璃开时存在，故保持 aqua 作用域，避免误伤其他 canvas（终端/图表等） */
html[data-dsh-aqua] canvas { display: none !important; }
/* 输入卡片：暖深灰 + 白 12% 边框 */
[class*="CtUWPa_card"] { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.12) !important; }
[class*="CtUWPa_placeholder"] { color: #A19E95 !important; }
[class*="CtUWPa_add"] { background: rgba(255,255,255,0.07) !important; color: #C9C6BD !important; }
[class*="gb7XDG_chevron"], [class*="vtjdUa_triggerEffort"] { color: #A19E95 !important; }
/* 发送按钮：陶土圆钮 */
[class*="CtUWPa_card"] button[aria-label*="发送"], [class*="CtUWPa_card"] button[aria-label*="send" i] {
  background: #D97757 !important; border-color: #D97757 !important; color: #FFFFFF !important;
}
[class*="CtUWPa_card"] [class*="CtUWPa_primary"] {
  background: #D97757 !important; border-color: #D97757 !important; color: #FFFFFF !important;
}


/* 全宽抽屉 v2（≤820px 打开态覆盖）— 全部加 html[data-desk-wb] 提权
   规则对1：这是主因——旧 DESK_MOBILE_CSS 抽屉规则同权重且 !important，必须提权才能赢 */
html[data-desk-wb] [data-desk-frame]:not([data-desk-collapsed="true"]) [class*="sidebarCol"] {
  left: 0 !important; top: 0 !important; bottom: 0 !important;
  width: 100% !important; max-width: none !important;
  border-radius: 0 !important; box-shadow: none !important;
  background: #111111 !important;
}
html[data-desk-wb] [data-desk-frame]:not([data-desk-collapsed="true"]) [class*="sidebarCol"] .haTdLq_root,
html[data-desk-wb] [data-desk-frame]:not([data-desk-collapsed="true"]) [class*="sidebarCol"] > div {
  background: transparent !important; border: 0 !important; box-shadow: none !important;
  backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
}
html[data-desk-wb] [data-desk-frame]:not([data-desk-collapsed="true"]) [class*="sidebarCol"] .haTdLq_root {
  padding: 0 20px !important;
}
/* 顶部：品牌 + 收起钮 */
html[data-desk-wb] .haTdLq_brandIdentity .haTdLq_brandName {
  font-size: 17px !important; font-weight: 600 !important; color: #F0EFEC !important;
}
html[data-desk-wb] .haTdLq_toggle svg { width: 18px !important; height: 18px !important; }
/* 新会话 = Claude「新建」风格 */
html[data-desk-wb] .haTdLq_newSession {
  width: 100% !important; height: 46px !important; border-radius: 12px !important;
  background: rgba(255,255,255,0.07) !important; border: 0 !important;
  color: #F0EFEC !important; font-size: 15px !important;
}
html[data-desk-wb] .haTdLq_newSession:hover { background: rgba(255,255,255,0.10) !important; }
/* 分组标题 */
html[data-desk-wb] ._4ccpTW_sectionHeader { font-size: 13px !important; color: #A8A69D !important; }
/* 会话列表行 */
html[data-desk-wb] ._root_1b2ny_3 {
  min-height: 40px !important; border-radius: 10px !important;
  font-size: 15px !important; color: #D9D7D0 !important;
}
html[data-desk-wb] ._root_1b2ny_3:hover { background: rgba(255,255,255,0.05) !important; }
/* 底部功能行 */
html[data-desk-wb] .haTdLq_footerActions > div > button,
html[data-desk-wb] .haTdLq_footerActions > div > div {
  width: 100% !important; height: 44px !important; border-radius: 10px !important;
  font-size: 15px !important; color: #D9D7D0 !important;
}
html[data-desk-wb] .haTdLq_footerActions > div > button:hover,
html[data-desk-wb] .haTdLq_footerActions > div > div:hover { background: rgba(255,255,255,0.05) !important; }
/* 设置行 */
html[data-desk-wb] .LVqHyW_triggerRow { border-radius: 10px !important; height: 48px !important; }
/* ===== v3 ===== */
/* 选中态：去橙色竖条（陶土 2px 内嵌线）与冷蓝光晕 → 轻背景 */
html[data-desk-wb] ._9USomq_sessionRow { box-shadow: none !important; }
html[data-desk-wb] ._9USomq_sessionRow._9USomq_selected,
html[data-desk-wb] ._9USomq_sessionRow._9USomq_sel {
  background: rgba(255,255,255,0.10) !important;
  box-shadow: none !important;
  border-radius: 10px !important;
}
/* 顶部：【✕ + 品牌名】—— 只改打开态 */
html[data-desk-wb] [data-desk-frame]:not([data-desk-collapsed="true"]) .haTdLq_root:not(.haTdLq_collapsed) .haTdLq_logoRow { flex-direction: row-reverse !important; justify-content: flex-end !important; gap: 6px !important; }
html[data-desk-wb] [data-desk-frame]:not([data-desk-collapsed="true"]) .haTdLq_root:not(.haTdLq_collapsed) .haTdLq_toggle svg { display: none !important; }
html[data-desk-wb] [data-desk-frame]:not([data-desk-collapsed="true"]) .haTdLq_root:not(.haTdLq_collapsed) .haTdLq_toggle::after {
  content: "✕"; font-size: 17px; line-height: 1; color: #E8E6DE;
}
/* 拖拽把手：全宽模式下无意义，隐藏（≤820px） */
html[data-desk-wb] #desk-sb-grip { display: none !important; }
/* 触屏打点强化（2026-10-15）：禁双击缩放判定与点击高亮延迟——
   iOS Safari 上"点两次才进"多半是第一下的 tap 被双击缩放/悬停判定吃掉 */
html[data-desk-wb] [class*="sidebarCol"],
html[data-desk-wb] [class*="sidebarCol"] button,
html[data-desk-wb] ._9USomq_sessionRow,
html[data-desk-wb] ._9USomq_projectRow,
html[data-desk-wb] ._root_1b2ny_3,
html[data-desk-wb] .haTdLq_newSession {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
/* 触摸设备上屏蔽悬停态残留（iOS 首触=hover 的第二触问题） */
@media (hover: none) {
  html[data-desk-wb] ._root_1b2ny_3:hover { background: transparent !important; }
  html[data-desk-wb] .haTdLq_newSession:hover { background: rgba(255,255,255,0.07) !important; }
  html[data-desk-wb] .haTdLq_footerActions > div > button:hover,
  html[data-desk-wb] .haTdLq_footerActions > div > div:hover { background: transparent !important; }
}
/* 玻璃关时的浅色残留兜底（dsh 原生=浅色主题；JS 盖 data-ds-dark-theme 章之前的过渡期也不闪白） */
html[data-desk-wb]:not([data-dsh-aqua]) [class*="sidebarCol"] { background: #111111 !important; }
html[data-desk-wb]:not([data-dsh-aqua]) [class*="bubble"] { background: rgba(255,255,255,0.10) !important; }
html[data-desk-wb]:not([data-dsh-aqua]) pre,
html[data-desk-wb]:not([data-dsh-aqua]) code { background: rgba(255,255,255,0.08) !important; }
}

`;
