// desk CLI：node src/cli.ts <命令>
//   user add <username> [--admin]   建用户并发虚拟钥匙（只显示一次）
//   user list                       列出用户
//   usage [username] [--month]      token 用量与估算费用（本月 / 全部）
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb } from './db.ts'
import { hashToken, newVirtualKey } from './keys.ts'

const args = process.argv.slice(2)
const flags = args.filter((a) => a.startsWith('--'))
const [cmd, sub, arg] = args.filter((a) => !a.startsWith('--'))
const admin = flags.includes('--admin')
const month = flags.includes('--month')
const here = dirname(fileURLToPath(import.meta.url))
const prices = JSON.parse(readFileSync(join(here, '..', 'config', 'prices.json'), 'utf8'))
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
  console.log('用法：Authorization: Bearer <钥匙>  →  http://127.0.0.1:8100/chat/completions')
}

function cmdUserList(): void {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.role, u.status, u.created_at, COUNT(k.id) AS keys
       FROM users u LEFT JOIN api_keys k ON k.user_id = u.id AND k.revoked_at IS NULL
       GROUP BY u.id ORDER BY u.id`,
    )
    .all() as Record<string, unknown>[]
  if (!rows.length) {
    console.log('（暂无用户）')
    return
  }
  for (const r of rows) console.log(`${r.id}\t${r.username}\t${r.role}\t${r.status}\tkeys=${r.keys}\t${r.created_at}`)
}

function resolveModel(m: string): string {
  return prices.aliases[m] ?? m
}

function tierOf(ts: string): 'peak' | 'off_peak' {
  const d = new Date(ts.replace(' ', 'T') + 'Z')
  const day = d.getUTCDay()
  const h = d.getUTCHours()
  const peak = day >= 1 && day <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10))
  return peak ? 'peak' : 'off_peak'
}

function costOf(e: Record<string, number> & { model?: string; ts: string }): number {
  const mp = prices.models[resolveModel(e.model ?? '')]
  if (!mp) return 0
  const p = mp[tierOf(e.ts)]
  return (e.cache_hit_tokens * p.cache_hit + e.cache_miss_tokens * p.cache_miss + e.completion_tokens * p.output) / 1e6
}

function cmdUsage(name?: string): void {
  let since = '1970-01-01 00:00:00'
  if (month) {
    const now = new Date()
    since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 19).replace('T', ' ')
  }
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
    const key = (e.model as string) ?? '(unknown)'
    const cur = byModel.get(key) ?? { hit: 0, miss: 0, out: 0, events: 0, estimated: 0, cost: 0 }
    cur.hit += e.cache_hit_tokens
    cur.miss += e.cache_miss_tokens
    cur.out += e.completion_tokens
    cur.events += 1
    cur.estimated += e.estimated ? 1 : 0
    const c = costOf(e as any)
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
  console.log(`  ── 合计估算：¥${total.toFixed(4)}（口径：按请求发生时刻的峰谷价；价格表快照 ${prices.captured_at}）`)
}

if (cmd === 'user' && sub === 'add' && arg) cmdUserAdd(arg)
else if (cmd === 'user' && sub === 'list') cmdUserList()
else if (cmd === 'usage') cmdUsage(arg)
else {
  console.log('用法：')
  console.log('  node src/cli.ts user add <username> [--admin]')
  console.log('  node src/cli.ts user list')
  console.log('  node src/cli.ts usage [username] [--month]')
  process.exit(1)
}
