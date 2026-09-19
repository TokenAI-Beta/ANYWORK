// 服务入口：desk 网关（P1）；后续 P2 会在这里加上门户
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { defaultDataDir, openDb } from './db.ts'
import { startGateway } from './gateway.ts'

function loadRealKey(): string {
  if (process.env.DESK_REAL_KEY) return process.env.DESK_REAL_KEY
  const f = join(homedir(), '.desk', 'keys.env')
  if (existsSync(f)) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = /^(?:DEEPSEEK_API_KEY|DESK_REAL_KEY)\s*=\s*(.+)$/.exec(line.trim())
      if (m) return m[1].trim()
    }
  }
  throw new Error('未找到真 key：设置 DESK_REAL_KEY，或把 DEEPSEEK_API_KEY=… 写进 ~/.desk/keys.env')
}

const port = Number(process.env.DESK_GATEWAY_PORT ?? 8100)
const upstream = process.env.DESK_UPSTREAM ?? 'https://api.deepseek.com'
const db = openDb()
const realKey = loadRealKey()

startGateway({ db, upstream, realKey, port })
console.log(`[desk] gateway ready · data=${defaultDataDir()}`)
