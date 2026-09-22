// 实例浏览器会话 cookie（dsh 0.1.5+ 的 browser-auth）：
// 0.1.5 起，实例对页面与 /api 都要求一个绑定 authority 的签名 cookie（否则 401）。
// 签名密钥持久化在实例家目录的 .credentials.yaml（client-connection/browser-session 记录）——
// 门户据此自行铸造 cookie，注入到转发给实例的请求里（HTTP 与 WS 升级），成员浏览器无感知。
// cookie 格式（见 dsh packages/client/connection/src/browser-auth.ts）：
//   name  = dsh-auth-<b64url(sha256(authority))>
//   value = v1.<b64url(json{version:1,authority,issuedAt,expiresAt})>.<b64url(hmac_sha256(secret, body))>
import { createHash, createHmac } from 'node:crypto'
import { statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

interface CacheEntry {
  mtimeMs: number
  value: string
  expiresAt: number
}

const cookieCache = new Map<string, CacheEntry>()

function b64url(buf: Buffer): string {
  return buf.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

/** 读取 browser-session 持久密钥（无记录时返回 undefined——旧版引擎/未初始化） */
function readBrowserSecret(home: string): string | undefined {
  try {
    const txt = readFileSync(join(home, '.credentials.yaml'), 'utf8')
    const lines = txt.split('\n')
    let inBlock = false
    for (const line of lines) {
      if (/^\s{0,4}client-connection\/browser-session:\s*$/u.test(line)) {
        inBlock = true
        continue
      }
      if (inBlock) {
        const m = line.match(/secret:\s*([A-Za-z0-9_-]+)/u)
        if (m) return m[1]
        if (/^\S/u.test(line)) break
      }
    }
  } catch {
    // 文件不存在或不可读
  }
  return undefined
}

/** 规范化请求 authority（与 dsh 服务端 new URL(`http://${host}`).host 一致） */
export function requestAuthorityOf(host: string | undefined): string | undefined {
  if (host === undefined || host.length === 0) return undefined
  try {
    return new URL(`http://${host}`).host
  } catch {
    return undefined
  }
}

/**
 * 生成（带缓存）某实例在指定 authority 下的会话 cookie 的 "name=value" 串。
 * @param home - 实例 DSH_HOME
 * @param authority - 浏览器实际访问的 authority（如 192.168.0.171:8080）
 * @returns cookie 串；实例未初始化（无 browser-session 记录）时返回 undefined
 */
export function instanceAuthCookie(home: string, authority: string): string | undefined {
  const credPath = join(home, '.credentials.yaml')
  let mtimeMs: number
  try {
    mtimeMs = statSync(credPath).mtimeMs
  } catch {
    return undefined
  }
  const key = `${home}\u0000${authority}`
  const hit = cookieCache.get(key)
  if (hit !== undefined && hit.mtimeMs === mtimeMs && hit.expiresAt - Date.now() > 3600_000) {
    return hit.value
  }
  const secret = readBrowserSecret(home)
  if (secret === undefined) return undefined
  const secretBytes = Buffer.from(
    secret.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (secret.length % 4)) % 4),
    'base64',
  )
  const issuedAt = Date.now()
  const expiresAt = issuedAt + 30 * 24 * 3600 * 1000
  const body = b64url(Buffer.from(JSON.stringify({ version: 1, authority, issuedAt, expiresAt }), 'utf8'))
  const sig = b64url(createHmac('sha256', secretBytes).update(body).digest())
  const name = 'dsh-auth-' + b64url(createHash('sha256').update(authority).digest())
  const value = `${name}=v1.${body}.${sig}`
  cookieCache.set(key, { mtimeMs, value, expiresAt })
  return value
}
