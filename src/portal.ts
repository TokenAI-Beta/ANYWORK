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
import { costOf, monthStartUtc, prices } from './pricing.ts'

export interface PortalOptions {
  db: DatabaseSync
  port: number
  host: string
}

interface UsageRow {
  model: string | null
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
    ? `<nav><a href="/">工作台</a><a href="/portal/me">我的用量</a>${user.role === 'admin' ? '<a href="/portal/admin">成员管理</a>' : ''}<form method="post" action="/logout" class="inline"><button>退出</button></form></nav><span class="who">${esc(user.username)}</span>`
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
    a.cost += costOf(r)
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
  for (const h of ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade']) {
    delete headers[h]
  }
  const upstream = httpRequest(
    { host: '127.0.0.1', port, method: req.method, path: req.url, headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers)
      up.pipe(res)
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
          `<tr><td>${esc(bjtime(r.ts))}</td><td>${esc(r.model ?? '-')}</td><td>${r.cache_hit_tokens} / ${r.cache_miss_tokens} / ${r.completion_tokens}</td><td>¥${costOf(r).toFixed(4)}</td></tr>`,
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

  const renderAdmin = (user: SessionUser, banner = ''): string => {
    const users = db
      .prepare(`SELECT id, username, role, status, monthly_budget_cny AS budget, agent_port, created_at FROM users ORDER BY id`)
      .all() as Record<string, unknown>[]
    const mStart = monthStartUtc()
    const rows = users
      .map((u) => {
        const mrows = db
          .prepare(`SELECT * FROM usage_events WHERE user_id = ? AND ts >= ?`)
          .all(u.id as number, mStart) as unknown as UsageRow[]
        const a = aggregate(mrows)
        return `<tr><td>${u.id}</td><td>${esc(u.username)}</td><td>${esc(u.role)}</td><td>${esc(u.status)}</td><td>${u.agent_port ?? '-'}</td><td>${u.budget ?? '不限'}</td><td>${a.events}</td><td>¥${a.cost.toFixed(4)}</td><td class="muted">${esc(u.created_at)}</td></tr>`
      })
      .join('')

    const body = `
<h1>成员管理</h1>
${banner}
<div class="card">
  <h2>成员（${users.length}）</h2>
  <table><thead><tr><th>ID</th><th>用户名</th><th>角色</th><th>状态</th><th>实例端口</th><th>月预算</th><th>本月请求</th><th>本月估算</th><th>创建（UTC）</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="muted" style="margin-top:8px">预算 / 实例端口 / 换钥匙：服务器上用 <code>node src/cli.ts</code> 系列命令（后续版本进此页面）。</div>
</div>
<div class="card">
  <h2>新建成员</h2>
  <form method="post" action="/portal/admin/users">
    <label>用户名（小写字母数字，2-32 位）</label><input name="username" required pattern="[a-z0-9][a-z0-9_-]{1,31}">
    <label>初始密码（至少 6 位）</label><input name="password" type="password" required minlength="6">
    <label>月预算（CNY，可留空 = 不限）</label><input name="budget" type="number" step="0.01" min="0">
    <div style="margin-top:12px"><button>创建并生成虚拟钥匙</button></div>
  </form>
  <div class="muted" style="margin-top:8px">创建后虚拟钥匙只显示一次，请当面交给成员。</div>
</div>`
    return page('成员管理', user, body)
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
        if (user.role !== 'admin') return html(res, 403, page('无权访问', user, '<div class="card"><h1>403</h1><div class="muted">需要管理员权限。</div></div>'))
        return html(res, 200, renderAdmin(user))
      }

      if (req.method === 'POST' && path === '/portal/admin/users') {
        if (!user) return redirect(res, '/login')
        if (user.role !== 'admin') return html(res, 403, page('无权访问', user, '<div class="card"><h1>403</h1></div>'))
        const form = new URLSearchParams(await readBody(req))
        const username = (form.get('username') ?? '').trim()
        const password = form.get('password') ?? ''
        const budgetRaw = (form.get('budget') ?? '').trim()
        if (!/^[a-z0-9][a-z0-9_-]{1,31}$/.test(username)) {
          return html(res, 400, page('新建成员', user, `<div class="card"><h1>新建成员</h1><div class="err">用户名格式不对（小写字母数字，2-32 位）</div><a href="/portal/admin">返回</a></div>`))
        }
        if (password.length < 6) {
          return html(res, 400, page('新建成员', user, `<div class="card"><h1>新建成员</h1><div class="err">密码至少 6 位</div><a href="/portal/admin">返回</a></div>`))
        }
        let budget: number | null = null
        if (budgetRaw) {
          const n = Number(budgetRaw)
          if (!Number.isFinite(n) || n <= 0) {
            return html(res, 400, page('新建成员', user, `<div class="card"><h1>新建成员</h1><div class="err">预算需为正数或留空</div><a href="/portal/admin">返回</a></div>`))
          }
          budget = n
        }
        const dup = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username)
        if (dup) {
          return html(res, 409, page('新建成员', user, `<div class="card"><h1>新建成员</h1><div class="err">用户名已存在</div><a href="/portal/admin">返回</a></div>`))
        }
        const info = db
          .prepare(`INSERT INTO users (username, role, status, password_hash, monthly_budget_cny) VALUES (?, 'member', 'active', ?, ?)`)
          .run(username, hashPassword(password), budget)
        const userId = Number(info.lastInsertRowid)
        const token = newVirtualKey()
        db.prepare(`INSERT INTO api_keys (user_id, token_hash, prefix, label) VALUES (?, ?, ?, 'default')`).run(userId, hashToken(token), token.slice(0, 16))
        return html(
          res,
          200,
          page(
            '成员已创建',
            user,
            `<div class="card"><h1>成员已创建：${esc(username)}</h1>
<div class="ok">虚拟钥匙（只显示这一次，请立即交给成员）：</div>
<div class="key">${esc(token)}</div>
<div class="muted" style="margin-top:10px">成员在浏览器登录门户即可开始使用；模型调用经网关，按人计量。</div>
<div style="margin-top:14px"><a href="/portal/admin">← 返回成员管理</a></div></div>`,
          ),
        )
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
