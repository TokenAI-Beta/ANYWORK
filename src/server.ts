// 服务入口：网关（:8100 回环）+ 门户（:8080，P2）
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { defaultDataDir, openDb } from './db.ts'
import { startGateway } from './gateway.ts'
import { readOrCreateNotifyToken } from './notify.ts'
import { startPortal } from './portal.ts'

function loadRealKey(): string {
  if (process.env.DESK_REAL_KEY) return process.env.DESK_REAL_KEY
  const f = join(homedir(), '.desk', 'keys.env')
  if (existsSync(f)) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = /^(?:DEEPSEEK_API_KEY|DESK_REAL_KEY)\s*=\s*(.+)$/.exec(line.trim())
      if (m) return m[1].trim()
    }
  }
  throw new Error('未找到真 key：请设置 DESK_REAL_KEY 或写入 ~/.desk/keys.env（DEEPSEEK_API_KEY=...）')
}

const gatewayPort = Number(process.env.DESK_GATEWAY_PORT ?? 8100)
const portalPort = Number(process.env.DESK_PORTAL_PORT ?? 8080)
const portalHost = process.env.DESK_PORTAL_HOST ?? '0.0.0.0'
const upstream = process.env.DESK_UPSTREAM ?? 'https://api.deepseek.com'

const db = openDb()
readOrCreateNotifyToken(defaultDataDir()) // 通知桥令牌：首启生成，agent 侧 desk-notify 读取
const realKey = loadRealKey()
startGateway({ db, upstream, realKey, port: gatewayPort })
startPortal({ db, port: portalPort, host: portalHost })
console.log(`[desk] portal on http://${portalHost}:${portalPort} · gateway on http://127.0.0.1:${gatewayPort} · data=${defaultDataDir()}`)
