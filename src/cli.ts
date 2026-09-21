// desk CLI：node src/cli.ts <命令>
//   user add <username> [--admin]       建用户并发虚拟钥匙（只显示一次）
//   user list                           列出用户（含预算 / 实例端口）
//   user passwd <username> <password>   设置/重置门户登录密码
//   user budget <username> <cny|off>    设/清月度预算（CNY）
//   user agent <username> <port|off>    绑定/解绑该成员的工作台实例端口
//   user rm <username>                  删除用户（清钥匙行 + 清会话；历史账本保留；拒删最后管理员）
//   channel list                        列出外部模型通道
//   channel add <name> <base_url> <api_key> <models(逗号分隔)> [prices(JSON)]
//   channel rm <name>                   删除通道
//   channel on|off <name>               启用/停用通道
//   usage [username] [--month]          token 用量与估算费用
import { hashPassword } from './auth.ts'
import { addChannel, listChannels, removeChannel, setChannelEnabled } from './channel.ts'
import { openDb } from './db.ts'
import { hashToken, newVirtualKey } from './keys.ts'
import { eventCost, monthStartUtc, prices } from './pricing.ts'

const args = process.argv.slice(2)
const flags = args.filter((a) => a.startsWith('--'))
const [cmd, sub, a1, a2, a3, a4, a5] = args.filter((a) => !a.startsWith('--'))
const admin = flags.includes('--admin')
const month = flags.includes('--month')
const db = openDb()

function cmdUserAdd(username: string): void {
  const info = db
    .prepare(`INSERT INTO users (username, role, status) VALUES (?, ?, 'active')`)
    .run(username, admin ? 'admin' : 'member')
  const userId = Number(info.lastInsertRowid)
  const token = newVirtualKey()
  db.prepare(`INSERT INTO api_keys (user_id, token_hash, prefix, label) VALUES (?, ?, ?, 'default')`).run(
    userId,
    hashToken(token),
    token.slice(0, 16),
  )
  console.log(`已创建用户 ${username}（id=${userId}，角色=${admin ? 'admin' : 'member'}）`)
  console.log('虚拟钥匙（只显示一次，请立即保存）：')
  console.log(token)
  console.log('用法：Authorization: Bearer <key>  →  http://127.0.0.1:8100/chat/completions')
}

function cmdUserList(): void {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.role, u.status, u.monthly_budget_cny, u.agent_port, u.password_hash, u.created_at, COUNT(k.id) AS keys
       FROM users u LEFT JOIN api_keys k ON k.user_id = u.id AND k.revoked_at IS NULL
       GROUP BY u.id ORDER BY u.id`,
    )
    .all() as Record<string, unknown>[]
  if (!rows.length) {
    console.log('（暂无用户）')
    return
  }
  for (const r of rows) {
    console.log(
      `${r.id}\t${r.username}\t${r.role}\t${r.status}\t预算=${r.monthly_budget_cny ?? '不限'}\t实例=${r.agent_port ?? '-'}\t密码=${r.password_hash ? '已设' : '未设'}\tkeys=${r.keys}\t${r.created_at}`,
    )
  }
}

function cmdUserPasswd(username: string, password: string): void {
  const u = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username) as { id: number } | undefined
  if (!u) {
    console.log(`找不到用户 ${username}`)
    process.exit(1)
  }
  if (password.length < 6) {
    console.log('密码至少 6 位')
    process.exit(1)
  }
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPassword(password), u.id)
  console.log(`${username}：门户登录密码已设置`)
}

function cmdUserBudget(username: string, value: string): void {
  const u = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username) as { id: number } | undefined
  if (!u) {
    console.log(`找不到用户 ${username}`)
    process.exit(1)
  }
  if (value === 'off' || value === 'none' || value === '-') {
    db.prepare(`UPDATE users SET monthly_budget_cny = NULL WHERE id = ?`).run(u.id)
    console.log(`${username}：预算已关闭（不限）`)
  } else {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) {
      console.log(`无效预算：${value}（用数字或 off）`)
      process.exit(1)
    }
    db.prepare(`UPDATE users SET monthly_budget_cny = ? WHERE id = ?`).run(n, u.id)
    console.log(`${username}：月度预算 = ¥${n}`)
  }
}

function cmdUserAgent(username: string, value: string): void {
  const u = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username) as { id: number } | undefined
  if (!u) {
    console.log(`找不到用户 ${username}`)
    process.exit(1)
  }
  if (value === 'off' || value === 'none' || value === '-') {
    db.prepare(`UPDATE users SET agent_port = NULL WHERE id = ?`).run(u.id)
    console.log(`${username}：实例端口已解绑`)
  } else {
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1024 || n > 65535) {
      console.log(`无效端口：${value}（1024-65535 的整数，或 off）`)
      process.exit(1)
    }
    db.prepare(`UPDATE users SET agent_port = ? WHERE id = ?`).run(n, u.id)
    console.log(`${username}：工作台实例端口 = ${n}`)
  }
}

function cmdUserRm(username: string): void {
  const u = db.prepare(`SELECT id, role FROM users WHERE username = ?`).get(username) as { id: number; role: string } | undefined
  if (!u) {
    console.log(`找不到用户 ${username}`)
    return
  }
  if (u.role === 'admin') {
    const { n } = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND id != ?`).get(u.id) as { n: number }
    if (n === 0) {
      console.log('拒绝：这是最后一个管理员账户（先给其他账户 --admin，或改角色后再删）。')
      return
    }
  }
  // usage_events 保留作历史（孤儿行在报表里自然隐藏）；FK 开关包住清删
  let keysChanges = 0
  let sessChanges = 0
  db.exec('PRAGMA foreign_keys = OFF')
  try {
    keysChanges = db.prepare(`DELETE FROM api_keys WHERE user_id = ?`).run(u.id).changes as number
    sessChanges = db.prepare(`DELETE FROM login_sessions WHERE user_id = ?`).run(u.id).changes as number
    db.prepare(`DELETE FROM users WHERE id = ?`).run(u.id)
  } finally {
    db.exec('PRAGMA foreign_keys = ON')
  }
  console.log(`${username}：已删除（删除虚拟钥匙 ${keysChanges} 把、清登录会话 ${sessChanges} 条；历史用量保留在账本）`)
  console.log(`提示：若该成员还配了实例服务（desk-agent-*.service），可用 scripts/desk.sh stop 停掉对应实例。`)
}

function cmdChannelList(): void {
  const chs = listChannels(db)
  if (!chs.length) {
    console.log('（暂无外部通道；默认通道 = DeepSeek 官方）')
    return
  }
  for (const c of chs) {
    console.log(
      `${c.id}\t${c.name}\t${c.enabled === 1 ? '启用' : '停用'}\t${c.base_url}\t模型=${c.models.join(',')}\t价格=${Object.keys(c.prices).length} 条\tkey=${c.api_key ? c.api_key.slice(0, 6) + '…' : '未设'}\t${c.note ?? ''}`,
    )
  }
}

function cmdChannelAdd(name: string, baseUrl: string, apiKey: string, modelsCsv: string, pricesJson?: string): void {
  let priceObj: Record<string, { in?: number; out?: number }> | undefined
  if (pricesJson) {
    try {
      priceObj = JSON.parse(pricesJson) as Record<string, { in?: number; out?: number }>
    } catch {
      console.log(`价格 JSON 解析失败：${pricesJson}`)
      process.exit(1)
    }
  }
  const models = modelsCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const r = addChannel(db, { name, base_url: baseUrl, api_key: apiKey, models, prices: priceObj })
  if ('error' in r) {
    console.log(`加入失败：${r.error}`)
    process.exit(1)
  }
  console.log(`通道 ${name} 已加入（id=${r.id}，模型：${models.join(', ')}）`)
}

function cmdChannelRemove(name: string): void {
  if (removeChannel(db, name)) {
    console.log(`通道 ${name} 已删除`)
  } else {
    console.log(`找不到通道 ${name}`)
    process.exit(1)
  }
}

function cmdChannelToggle(name: string, on: boolean): void {
  if (setChannelEnabled(db, name, on)) {
    console.log(`通道 ${name} 已${on ? '启用' : '停用'}`)
  } else {
    console.log(`找不到通道 ${name}`)
    process.exit(1)
  }
}

function cmdUsage(name?: string): void {
  const since = month ? monthStartUtc() : '1970-01-01 00:00:00'
  const rows = (name
    ? db
        .prepare(
          `SELECT e.* FROM usage_events e JOIN users u ON u.id = e.user_id WHERE u.username = ? AND e.ts >= ? ORDER BY e.ts`,
        )
        .all(name, since)
    : db
        .prepare(`SELECT e.* FROM usage_events e JOIN users u ON u.id = e.user_id WHERE e.ts >= ? ORDER BY e.ts`)
        .all(since)) as Record<string, any>[]

  const byModel = new Map<string, { hit: number; miss: number; out: number; events: number; estimated: number; cost: number }>()
  let total = 0
  for (const e of rows) {
    const key = ((e.model as string) ?? '(unknown)') + (e.channel ? ` @${e.channel}` : '')
    const cur = byModel.get(key) ?? { hit: 0, miss: 0, out: 0, events: 0, estimated: 0, cost: 0 }
    cur.hit += e.cache_hit_tokens
    cur.miss += e.cache_miss_tokens
    cur.out += e.completion_tokens
    cur.events += 1
    cur.estimated += e.estimated ? 1 : 0
    const c = eventCost(e as any)
    cur.cost += c
    total += c
    byModel.set(key, cur)
  }
  console.log(`${name ? `用户 ${name}` : '全部用户'} · ${month ? '本月' : '全部时间'}（共 ${rows.length} 次请求）`)
  for (const [m, v] of byModel) {
    console.log(
      `  ${m}: 请求 ${v.events} · 命中 ${v.hit} / 未命中 ${v.miss} / 输出 ${v.out} tokens · 估算 ¥${v.cost.toFixed(4)}${v.estimated ? `（${v.estimated} 条为估算）` : ''}`,
    )
  }
  console.log(`  ── 合计估算：¥${total.toFixed(4)}（口径：DeepSeek 按峰谷价；外部通道按通道价目表；价格表快照 ${prices.captured_at}）`)

  if (name) {
    const u = db.prepare(`SELECT monthly_budget_cny AS budget FROM users WHERE username = ?`).get(name) as
      | { budget: number | null }
      | undefined
    if (u?.budget != null) {
      const monthRows = db
        .prepare(
          `SELECT e.* FROM usage_events e JOIN users u2 ON u2.id = e.user_id WHERE u2.username = ? AND e.ts >= ?`,
        )
        .all(name, monthStartUtc()) as Record<string, any>[]
      let spent = 0
      for (const e of monthRows) spent += eventCost(e as any)
      console.log(`  本月：已用 ¥${spent.toFixed(4)} / 预算 ¥${u.budget}${spent >= u.budget ? '  ⚠️ 已超限（请求将被拒）' : ''}`)
    }
  }
}

if (cmd === 'user' && sub === 'add' && a1) cmdUserAdd(a1)
else if (cmd === 'user' && sub === 'list') cmdUserList()
else if (cmd === 'user' && sub === 'passwd' && a1 && a2) cmdUserPasswd(a1, a2)
else if (cmd === 'user' && sub === 'budget' && a1 && a2) cmdUserBudget(a1, a2)
else if (cmd === 'user' && sub === 'agent' && a1 && a2) cmdUserAgent(a1, a2)
else if (cmd === 'user' && sub === 'rm' && a1) cmdUserRm(a1)
else if (cmd === 'channel' && sub === 'list') cmdChannelList()
else if (cmd === 'channel' && sub === 'add' && a1 && a2 && a3 && a4) cmdChannelAdd(a1, a2, a3, a4, a5)
else if (cmd === 'channel' && sub === 'rm' && a1) cmdChannelRemove(a1)
else if (cmd === 'channel' && sub === 'on' && a1) cmdChannelToggle(a1, true)
else if (cmd === 'channel' && sub === 'off' && a1) cmdChannelToggle(a1, false)
else if (cmd === 'usage') cmdUsage(sub)
else {
  console.log('用法：')
  console.log('  node src/cli.ts user add <username> [--admin]')
  console.log('  node src/cli.ts user list')
  console.log('  node src/cli.ts user passwd <username> <password>')
  console.log('  node src/cli.ts user budget <username> <cny|off>')
  console.log('  node src/cli.ts user agent <username> <port|off>')
  console.log('  node src/cli.ts user rm <username>')
  console.log('  node src/cli.ts channel list')
  console.log('  node src/cli.ts channel add <name> <base_url> <api_key> <models(逗号分隔)> [prices(JSON)]')
  console.log('  node src/cli.ts channel rm <name>')
  console.log('  node src/cli.ts channel on|off <name>')
  console.log('  node src/cli.ts usage [username] [--month]')
  process.exit(1)
}
