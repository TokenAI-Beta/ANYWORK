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
import { kbSearch, listKbNotes, readKbNote, removeKbNote, saveKbNote } from './kb.ts'
import { listDrive, resolveInDrive, saveToDrive, MAX_UPLOAD } from './drive.ts'
import { addNotifyRoute, addReminder, dispatchNotify, listNotifyLog, listNotifyRoutes, listReminders, listRemindersSent, readOrCreateNotifyToken, removeNotifyRoute, removeReminder, toggleNotifyRoute } from './notify.ts'
import { defaultDataDir } from './db.ts'
import { collectConnectors, collectPresets, collectSkills, readSkill } from './panel.ts'
import { collectOps } from './ops.ts'
import { deleteSession, listUserSessions, userHome } from './session-mgr.ts'
import { instanceAuthCookie, requestAuthorityOf } from './instance-auth.ts'
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
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
`

function page(title: string, user: SessionUser | null, body: string): string {
  const nav = user
    ? `<nav><a href="/">工作台</a><a href="/portal/me">我的用量</a><form method="post" action="/logout" class="inline"><button>退出</button></form></nav><span class="who">${esc(user.username)}</span>`
    : ''
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="manifest" href="/portal.webmanifest"><link rel="icon" type="image/svg+xml" href="/portal-icon.svg"><meta name="theme-color" content="#1c1e21"><title>${esc(title)} · DSH-ANYWORK</title><style>${STYLE}</style></head>
<body>
<header><span class="brand">DSH-ANYWORK</span><span class="muted">团队工作台</span>${nav}</header>
<main>${body}</main>
<footer>DSH-ANYWORK · 自托管团队工作台 · 数据留在本机</footer>
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

function aggLine(a: Agg): string {
  return `请求 ${a.events} 次 · 命中 ${a.hit} / 未命中 ${a.miss} / 输出 ${a.out} tokens`
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
function proxyHttp(req: IncomingMessage, res: ServerResponse, port: number, authCookie?: string): void {
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
          const body = injectUsageWidget(Buffer.concat(chunks).toString('utf8'))
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
      html(res, 502, page('502', null, '<div class="card"><h1>502</h1><div class="muted">工作台实例未响应（可能未启动）。稍后再试或联系管理员。</div></div>'))
    } else {
      res.destroy()
    }
  })
  req.pipe(upstream)
}

const USAGE_WIDGET_TAG =
  '<link rel="manifest" href="/portal.webmanifest"><link rel="icon" type="image/svg+xml" href="/portal-icon.svg"><meta name="theme-color" content="#1c1e21"><script src="/portal/static/desk-usage.js" defer></script>'

/** PWA / 桌面端图标（SVG；浏览器「安装应用」与标签页图标共用） */
const PORTAL_ICON_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
  '<rect width="512" height="512" rx="112" fill="#1c1e21"/>',
  '<rect x="56" y="56" width="400" height="400" rx="80" fill="none" stroke="#4f7cf7" stroke-width="14"/>',
  '<text x="256" y="318" font-family="Arial, sans-serif" font-size="172" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="6">DSH</text>',
  '</svg>',
].join('')

/** 往 dsh 工作台的 HTML 里注入"用量"悬浮小组件（不改 dsh 源码） */
function injectUsageWidget(body: string): string {
  if (body.includes(USAGE_WIDGET_TAG)) return body
  const idx = body.lastIndexOf('</body>')
  if (idx === -1) return body + USAGE_WIDGET_TAG
  return body.slice(0, idx) + USAGE_WIDGET_TAG + body.slice(idx)
}

/** 工作台内的"用量"小组件脚本（纯 JS；避免反引号与模板占位符，方便内嵌） */
const DESK_USAGE_JS = `
(function () {
  if (document.getElementById('desk-usage-fab')) return
  var css = document.createElement('style')
  css.textContent =
    '#desk-usage-fab{position:fixed;right:18px;bottom:18px;z-index:2147483000;border:1px solid #e4e6eb;border-radius:999px;padding:10px 16px;background:#ffffff;color:#1c1e21;font-size:13.5px;cursor:pointer;box-shadow:0 6px 20px rgba(16,24,40,.12);font-family:system-ui,"Microsoft YaHei",sans-serif;transition:box-shadow .15s ease}'
    + '#desk-usage-fab:hover{box-shadow:0 8px 26px rgba(16,24,40,.18)}'
    + '#desk-usage-panel{position:fixed;right:18px;bottom:64px;z-index:2147483000;width:324px;max-height:70vh;overflow:auto;background:#fff;color:#1c1e21;border:1px solid #e9ebee;border-radius:14px;box-shadow:0 16px 44px rgba(16,24,40,.18);padding:14px 16px;font-family:system-ui,"Microsoft YaHei",sans-serif;font-size:13px;display:none}'
    + '#desk-usage-panel h3{margin:0 0 8px;font-size:15px}'
    + '#desk-usage-panel .big{font-size:22px;font-weight:700}'
    + '#desk-usage-panel .muted{color:#65676b;font-size:12px}'
    + '#desk-usage-panel table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}'
    + '#desk-usage-panel td{padding:3px 4px;border-bottom:1px solid #f0f1f3}'
    + '#desk-usage-panel .row{display:flex;justify-content:space-between;margin:6px 0}'
    + '#desk-usage-panel .bar{background:#eef0f3;border-radius:6px;height:8px;overflow:hidden;margin-top:4px}'
    + '#desk-usage-panel .bar i{display:block;height:100%;background:#4f7cf7}'
    + '#desk-usage-panel .pnl-foot{margin-top:10px;display:flex;justify-content:space-between;align-items:center}'
    + '#desk-usage-panel a{color:#1c1e21}'
  document.head.appendChild(css)
  var fab = document.createElement('button')
  fab.id = 'desk-usage-fab'
  fab.textContent = '📊 用量'
  document.body.appendChild(fab)
  var panel = document.createElement('div')
  panel.id = 'desk-usage-panel'
  document.body.appendChild(panel)
  var loadedAt = 0
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
  function fmt(n) { return '¥' + Number(n).toFixed(4) }
  function render(d) {
    var h = '<h3>我的用量</h3>'
    h += '<div class="big">' + fmt(d.month.cost) + '</div>'
    h += '<div class="muted">本月 · 请求 ' + d.month.events + ' 次 · 未命中 ' + d.month.miss + ' / 输出 ' + d.month.out + ' tokens</div>'
    if (d.budget != null) {
      var pct = Math.min(100, (d.month.cost / d.budget) * 100)
      h += '<div class="muted" style="margin-top:8px">预算 ¥' + d.budget + (d.month.cost >= d.budget ? '（已超限）' : '') + '</div>'
      h += '<div class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>'
    }
    h += '<div class="row"><span class="muted">今日</span><span>' + fmt(d.day.cost) + ' · ' + d.day.events + ' 次</span></div>'
    h += '<table>'
    for (var i = 0; i < d.recent.length; i++) {
      h += '<tr><td class="muted">' + esc(d.recent[i].time) + '</td><td>' + esc(d.recent[i].model) + (d.recent[i].channel ? ' <span class="muted">@' + esc(d.recent[i].channel) + '</span>' : '') + '</td><td style="text-align:right">' + fmt(d.recent[i].cost) + '</td></tr>'
    }
    if (!d.recent.length) h += '<tr><td class="muted">暂无记录</td></tr>'
    h += '</table>'
    h += '<div class="pnl-foot"><a href="/portal/me" target="_blank">详细 / 管理</a>'
    h += '<form method="post" action="/logout" style="margin:0"><button style="border:0;background:none;color:#c0392b;cursor:pointer;font-size:12px;padding:0">退出登录</button></form></div>'
    panel.innerHTML = h
  }
  function load() {
    fetch('/portal/api/usage')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
      .then(function (d) { loadedAt = Date.now(); render(d) })
      .catch(function (e) {
        panel.innerHTML = '<h3>我的用量</h3><div class="muted">加载失败（' + esc(e.message) + '）· <a href="/portal/me" target="_blank">打开完整页</a></div>'
      })
  }
  fab.addEventListener('click', function () {
    var show = panel.style.display !== 'block'
    panel.style.display = show ? 'block' : 'none'
    if (show && Date.now() - loadedAt > 15000) load()
  })
})()
`

export function startPortal(opts: PortalOptions) {
  const db = opts.db

  const agentPortOf = (userId: number): number | null => {
    const row = db.prepare(`SELECT agent_port AS port FROM users WHERE id = ?`).get(userId) as
      | { port: number | null }
      | undefined
    return row?.port ?? null
  }

  const renderMe = (user: SessionUser): string => {
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

    let budgetHtml = '<span class="muted">预算：不限</span>'
    if (urow.budget != null) {
      const pct = Math.min(100, (month.cost / urow.budget) * 100)
      const over = month.cost >= urow.budget
      budgetHtml = `<div class="muted">预算 ¥${urow.budget} · 已用 ¥${month.cost.toFixed(4)}${over ? '（⚠️ 已超限，请求将被拒）' : ` · 剩余 ¥${(urow.budget - month.cost).toFixed(4)}`}</div>
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
      ? `<div>实例运行中（127.0.0.1:${agentPort}） · <a href="/">进入我的工作台 →</a></div>`
      : '<div class="muted">尚未分配工作台实例（P3 提供自动管理；当前请联系管理员）。</div>'

    const body = `
<h1>我的用量</h1>
<div class="card">
  <div>账户：<strong>${esc(user.username)}</strong>（${esc(user.role)}） · 创建于 ${esc(urow.created_at)}（UTC）</div>
  <div class="muted">虚拟钥匙：${keyCount.n} 把（${keyPrefix ? esc(keyPrefix.prefix) + '…' : '无'}） · 密钥仅存哈希，如需重发请在服务器上用 CLI 轮换</div>
</div>
<div class="card">
  <h2>我的工作台</h2>
  ${workstationCard}
</div>
<div class="grid">
  <div class="card">
    <h2>本月（估算）</h2>
    <div class="big">¥${month.cost.toFixed(4)}</div>
    <div class="muted">${aggLine(month)}</div>
    <div style="margin-top:10px">${budgetHtml}</div>
  </div>
  <div class="card">
    <h2>今日（北京时间）</h2>
    <div class="big">¥${day.cost.toFixed(4)}</div>
    <div class="muted">${aggLine(day)}</div>
  </div>
</div>
<div class="card">
  <h2>最近请求</h2>
  <table><thead><tr><th>时间（北京）</th><th>模型</th><th>命中/未命中/输出</th><th>估算</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">暂无记录</td></tr>'}</tbody></table>
</div>
<div class="muted">口径：费用按请求发生时刻的峰谷价估算（价格表快照 ${esc(prices.captured_at)}）；本月按 UTC 月初计。</div>`
    return page('我的用量', user, body)
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

      // —— 工作台内小组件：脚本 + 用量 JSON ——
      if (req.method === 'GET' && path === '/portal/static/desk-usage.js') {
        res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' })
        return res.end(DESK_USAGE_JS)
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
        res.writeHead('ok' in r ? 200 : /不存在/.test(r.error) ? 404 : 400, { 'content-type': 'application/json; charset=utf-8' })
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
          return res.end(JSON.stringify({ error: 'text 不能为空' }))
        }
        const results = await dispatchNotify(db, { title: String(body.title ?? '').trim(), text, source: String(body.source ?? 'agent') })
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
          return res.end(JSON.stringify({ error: '公告内容不能为空' }))
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
          return res.end(JSON.stringify({ error: '反馈内容不能为空' }))
        }
        db.prepare(`INSERT INTO feedback (user_id, username, text) VALUES (?, ?, ?)`).run(user.id, user.username, ftext)
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
        return res.end(JSON.stringify(readSkill(url.searchParams.get('name') ?? '')))
      }
      if (req.method === 'GET' && path === '/portal/api/panel/connectors') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true, items: collectConnectors(db) }))
      }
      if (req.method === 'GET' && path === '/portal/api/panel/auto') {
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true, role: user.role, reminders: listReminders(db), recent: listRemindersSent(db, 5) }))
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
        if (!/^session-[0-9a-fA-F-]{8,64}$/.test(sessionId)) return reply({ error: '会话 ID 不合法' })
        const dup = db
          .prepare(`SELECT id FROM session_del_requests WHERE user_id = ? AND session_id = ? AND status = 'pending'`)
          .get(user.id, sessionId)
        if (dup) return reply({ error: '该会话已有一条待审批的申请' })
        db.prepare(`INSERT INTO session_del_requests (user_id, username, session_id, title) VALUES (?, ?, ?, ?)`).run(
          user.id,
          user.username,
          sessionId,
          title || null,
        )
        dispatchNotify(db, {
          title: '会话删除申请',
          text: `成员 ${user.username} 请求删除会话「${title || sessionId}」——到 工作台 设置 → 会话管理 审批。`,
          source: 'session-mgr',
        }).catch(() => {})
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
          return res.end(JSON.stringify({ error: '任务标题不能为空' }))
        }
        if (assignee) {
          const known = db.prepare(`SELECT username FROM users WHERE username = ?`).get(assignee)
          if (!known) {
            res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: '指派对象不存在' }))
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
          return res.end(JSON.stringify({ error: '任务不存在' }))
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
              return res.end(JSON.stringify({ error: '指派对象不存在' }))
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
          return res.end(JSON.stringify({ error: '没有可更新的字段' }))
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
          return res.end(JSON.stringify({ error: '任务不存在' }))
        }
        const allowed = user.role === 'admin' || task.assignee === user.username || task.created_by === user.username
        if (!allowed) {
          res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: 'not allowed' }))
        }
        if (task.review_state === 'submitted') {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: '已有待验收的提交（可先撤回）' }))
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
        dispatchNotify(db, {
          title: '任务待验收',
          text: `成员 ${user.username} 提交任务 #${task.id}「${task.title}」待验收${extra ? '（' + extra + '）' : ''}——到 工作台 设置 → 任务板 处理。`,
          source: 'task-review',
        }).catch(() => {})
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
          return res.end(JSON.stringify({ error: '任务不存在' }))
        }
        if (task.review_state !== 'submitted') {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: '当前没有待验收的提交' }))
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
            return res.end(JSON.stringify({ error: '打回必须填写理由' }))
          }
          if (action === 'accept') {
            db.prepare(
              `UPDATE tasks SET review_state = 'accepted', reviewed_by = ?, reviewed_at = datetime('now'),
                 review_note = ?, status = 'done', updated_at = datetime('now') WHERE id = ?`,
            ).run(user.username, note || null, rid)
            dispatchNotify(db, {
              title: '任务验收通过',
              text: `任务 #${task.id}「${task.title}」已由 ${user.username} 验收通过${note ? '（' + note + '）' : ''}。`,
              source: 'task-review',
            }).catch(() => {})
          } else {
            db.prepare(
              `UPDATE tasks SET review_state = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'),
                 review_note = ?, status = 'doing', updated_at = datetime('now') WHERE id = ?`,
            ).run(user.username, note, rid)
            dispatchNotify(db, {
              title: '任务被打回',
              text: `任务 #${task.id}「${task.title}」被 ${user.username} 打回，理由：${note}——请处理后重新提交验收。`,
              source: 'task-review',
            }).catch(() => {})
          }
        } else if (action === 'cancel') {
          if (task.submitted_by !== user.username) {
            res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: '只有提交人可以撤回' }))
          }
          db.prepare(
            `UPDATE tasks SET review_state = 'none', submitted_by = NULL, submitted_at = NULL, submit_note = NULL,
               commit_refs = NULL, session_refs = NULL, reviewed_by = NULL, reviewed_at = NULL, review_note = NULL,
               updated_at = datetime('now') WHERE id = ?`,
          ).run(rid)
        } else {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: 'action 仅支持 accept / reject / cancel' }))
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
          return res.end(JSON.stringify({ error: '任务不存在' }))
        }
        if (user.role !== 'admin' && task.created_by !== user.username) {
          res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ error: 'not allowed' }))
        }
        db.prepare(`DELETE FROM tasks WHERE id = ?`).run(did)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ ok: true }))
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
          if (!/^[a-z0-9][a-z0-9_-]{1,31}$/.test(username)) return jerr(400, '用户名格式不对（小写字母数字，2-32 位）')
          if (password.length < 6) return jerr(400, '密码至少 6 位')
          let budget: number | null = null
          if (budgetRaw) {
            const n = Number(budgetRaw)
            if (!Number.isFinite(n) || n <= 0) return jerr(400, '预算需为正数或留空')
            budget = n
          }
          if (db.prepare(`SELECT id FROM users WHERE username = ?`).get(username)) return jerr(409, '用户名已存在')
          const info = db
            .prepare(`INSERT INTO users (username, role, status, password_hash, monthly_budget_cny) VALUES (?, 'member', 'active', ?, ?)`)
            .run(username, hashPassword(password), budget)
          const userId = Number(info.lastInsertRowid)
          const token = newVirtualKey()
          db.prepare(`INSERT INTO api_keys (user_id, token_hash, prefix, label) VALUES (?, ?, ?, 'default')`).run(userId, hashToken(token), token.slice(0, 16))
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ username, key: token }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/member-delete') {
          const body = await readJsonBody()
          const username = String(body.username ?? '').trim()
          const target = db.prepare(`SELECT id, role FROM users WHERE username = ?`).get(username) as { id: number; role: string } | undefined
          if (!target) {
            res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: '找不到该成员' }))
          }
          if (target.role === 'admin') {
            const other = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND id != ?`).get(target.id) as { n: number }
            if (other.n === 0) {
              res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
              return res.end(JSON.stringify({ error: '不能删除唯一的管理员账户' }))
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
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ username }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/channel-create') {
          const body = await readJsonBody()
          const name = String(body.name ?? '').trim()
          const baseUrl = String(body.base_url ?? '').trim()
          const apiKey = String(body.api_key ?? '').trim()
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
          })
          if ('error' in r) {
            res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: r.error }))
          }
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ name }))
        }
        if (req.method === 'POST' && (path === '/portal/api/admin/channel-toggle' || path === '/portal/api/admin/channel-delete')) {
          const body = await readJsonBody()
          const name = String(body.name ?? '').trim()
          if (path === '/portal/api/admin/channel-delete') {
            removeChannel(db, name)
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ name }))
          }
          const cur = listChannels(db).find((c) => c.name === name)
          if (cur) setChannelEnabled(db, name, cur.enabled !== 1)
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ name, enabled: cur ? cur.enabled !== 1 : false }))
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
          if (action !== 'approve' && action !== 'reject') return reply({ error: 'action 仅支持 approve / reject' })
          const row = db.prepare(`SELECT * FROM session_del_requests WHERE id = ? AND status = 'pending'`).get(id) as
            | { username: string; session_id: string }
            | undefined
          if (!row) return reply({ error: '申请不存在或已处理' })
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
          if (!/^[a-z0-9_-]{1,32}$/.test(target)) return reply({ error: '用户名不合法' })
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
          if (!exists) return reply({ error: '成员不存在' })
          const r = deleteSession(target, sessionId)
          if ('error' in r) return reply({ error: r.error })
          return reply({ ok: true, killed: r.killed })
        }
        if (req.method === 'GET' && path === '/portal/api/admin/upstream') {
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ ok: true, ...readUpstreamInfo() }))
        }
        if (req.method === 'POST' && path === '/portal/api/admin/upstream-set') {
          const body = await readJsonBody()
          const raw = String(body.api_key ?? '').trim()
          const info = readUpstreamInfo()
          const reply = (obj: Record<string, unknown>): void => {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(obj))
          }
          if (!info.writable) return reply({ error: '当前 key 来自环境变量 DESK_REAL_KEY，需在服务环境里修改' })
          if (!/^[\x21-\x7e]{16,200}$/.test(raw)) return reply({ error: '格式不合法：应为 sk- 开头、16-200 位可打印字符' })
          const cur = readUpstreamKeyRaw()
          if (cur === raw) return reply({ ok: true, unchanged: true, keyMasked: maskKey(raw) })
          writeFileSync(upstreamKeysPath(), `DEEPSEEK_API_KEY=${raw}\n`, { mode: 0o600 })
          reply({ ok: true, restarted: true, keyMasked: maskKey(raw) })
          // 先回响应，再退出进程让 systemd（Restart=always）拉起新进程加载新 key
          setTimeout(() => process.exit(0), 800)
          return
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
          const r = addNotifyRoute(db, { name: String(body.name ?? ''), kind: String(body.kind ?? ''), target: String(body.target ?? '') })
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
          const title = String(body.title ?? '工作台通知测试').trim()
          const text = String(body.text ?? '这是一条来自 DSH-ANYWORK 的测试通知，收到即通。').trim()
          const results = await dispatchNotify(db, { title, text, source: 'admin-test' })
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ results }))
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
          const body = await collectOps(db, defaultDataDir())
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
            name: 'DSH 团队工作台',
            short_name: 'DSH 工作台',
            description: 'DSH-ANYWORK · 自托管团队工作台',
            start_url: '/',
            scope: '/',
            display: 'standalone',
            background_color: '#101418',
            theme_color: '#1c1e21',
            icons: [{ src: '/portal-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
          }),
        )
      }
      if (req.method === 'GET' && path === '/portal-icon.svg') {
        res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'max-age=86400' })
        return res.end(PORTAL_ICON_SVG)
      }

      // —— 登录 ——
      if (req.method === 'GET' && path === '/login') {
        if (user) return redirect(res, '/')
        const err = url.searchParams.get('err')
        const msg = err === '1' ? '<div class="err">用户名或密码错误</div>' : err === '2' ? '<div class="err">尝试次数过多，请稍后再试</div>' : ''
        return html(
          res,
          200,
          page(
            '登录',
            null,
            `<div class="login-wrap"><div class="card"><img src="/portal-icon.svg" width="42" height="42" alt="DSH" style="border-radius:10px;display:block;margin:0 0 12px">
<h1>登录 DSH-ANYWORK</h1>${msg}
<form method="post" action="/login">
<label>用户名</label><input name="username" required autofocus>
<label>密码</label><input name="password" type="password" required>
<div style="margin-top:14px"><button style="width:100%">登录</button></div>
</form></div></div>`,
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
        return html(res, 200, renderMe(user))
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
            '工作台未分配',
            user,
            '<div class="card"><h1>你的工作台还没有分配实例</h1><div class="muted">当前由管理员在服务器上分配（P3 起提供自动管理）。<br>可以先去 <a href="/portal/me">我的用量</a> 看看账本。</div></div>',
          ),
        )
      }
      const authAuthority = requestAuthorityOf(req.headers.host)
      const authCookie =
        authAuthority === undefined ? undefined : instanceAuthCookie(userHome(user.username), authAuthority)
      proxyHttp(req, res, port, authCookie)
    } catch (err) {
      console.log(`[portal] unhandled: ${String(err)}`)
      try {
        html(res, 500, page('500', null, '<div class="card"><h1>500</h1><div class="muted">服务器内部错误。</div></div>'))
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
