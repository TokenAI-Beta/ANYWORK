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
import { kbSearch } from './kb.ts'
import { listDrive, resolveInDrive, saveToDrive, MAX_UPLOAD } from './drive.ts'
import { addNotifyRoute, dispatchNotify, listNotifyLog, listNotifyRoutes, readOrCreateNotifyToken, removeNotifyRoute, toggleNotifyRoute } from './notify.ts'
import { defaultDataDir } from './db.ts'
import { createReadStream, existsSync, statSync } from 'node:fs'

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
`

function page(title: string, user: SessionUser | null, body: string): string {
  const nav = user
    ? `<nav><a href="/">工作台</a><a href="/portal/me">我的用量</a><form method="post" action="/logout" class="inline"><button>退出</button></form></nav><span class="who">${esc(user.username)}</span>`
    : ''
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} · DSH-ANYWORK</title><style>${STYLE}</style></head>
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
function proxyHttp(req: IncomingMessage, res: ServerResponse, port: number): void {
  const headers: Record<string, unknown> = { ...req.headers }
  for (const h of ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade', 'accept-encoding']) {
    delete headers[h]
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

const USAGE_WIDGET_TAG = '<script src="/portal/static/desk-usage.js" defer></script>'

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
    '#desk-usage-fab{position:fixed;right:18px;bottom:18px;z-index:2147483000;border:0;border-radius:999px;padding:10px 16px;background:#1c1e21;color:#fff;font-size:14px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);font-family:system-ui,"Microsoft YaHei",sans-serif}'
    + '#desk-usage-panel{position:fixed;right:18px;bottom:64px;z-index:2147483000;width:320px;max-height:70vh;overflow:auto;background:#fff;color:#1c1e21;border:1px solid #e4e6eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:14px 16px;font-family:system-ui,"Microsoft YaHei",sans-serif;font-size:13px;display:none}'
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
        if (!user) {
          res.writeHead(401, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'login required' }))
        }
        const q = (url.searchParams.get('q') ?? '').slice(0, 100)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify(kbSearch(q)))
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
            .prepare(`SELECT id, username, role, status, monthly_budget_cny AS budget, agent_port AS port, created_at FROM users ORDER BY id`)
            .all() as Record<string, unknown>[]
          const mStart = monthStartUtc()
          const members = memberRows.map((u) => {
            const mrows = db
              .prepare(`SELECT * FROM usage_events WHERE user_id = ? AND ts >= ?`)
              .all(u.id as number, mStart) as unknown as UsageRow[]
            const a = aggregate(mrows)
            return {
              id: u.id,
              username: u.username,
              role: u.role,
              status: u.status,
              port: u.port,
              budget: u.budget,
              monthEvents: a.events,
              monthCost: a.cost,
              createdAt: u.created_at,
            }
          })
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
          return res.end(JSON.stringify({ members, channels }))
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
        if (req.method === 'GET' && path === '/portal/api/admin/notify') {
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          return res.end(JSON.stringify({ routes: listNotifyRoutes(db), log: listNotifyLog(db, 12) }))
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
        res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
        return res.end(JSON.stringify({ error: 'unknown admin api' }))
      }
      if (path === '/favicon.ico') {
        res.writeHead(204)
        return res.end()
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
            `<div class="login-wrap"><div class="card"><h1>登录 DSH-ANYWORK</h1>${msg}
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
      proxyHttp(req, res, port)
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
      const target = netConnect(port, '127.0.0.1')
      target.on('connect', () => {
        const lines = [`GET ${req.url} HTTP/1.1`]
        for (const [k, v] of Object.entries(req.headers)) {
          if (v === undefined) continue
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
