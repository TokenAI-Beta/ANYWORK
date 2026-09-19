// 密码散列（scrypt，内建）与会话管理（P2）
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEYLEN = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const n = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const salt = Buffer.from(parts[4], 'base64')
  const expected = Buffer.from(parts[5], 'base64')
  const actual = scryptSync(password, salt, expected.length, { N: n, r, p })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSession(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface SessionUser {
  id: number
  username: string
  role: string
}

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim())
  }
  return undefined
}

export function createSession(db: DatabaseSync, userId: number, ip: string | undefined, ua: string | undefined): string {
  const token = newSessionToken()
  const expiresAt = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 19).replace('T', ' ')
  db.prepare(
    `INSERT INTO login_sessions (user_id, token_hash, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?)`,
  ).run(userId, hashSession(token), expiresAt, ip ?? null, ua ? ua.slice(0, 200) : null)
  return token
}

export function userFromSession(db: DatabaseSync, cookieHeader: string | undefined): SessionUser | undefined {
  const token = parseCookie(cookieHeader, 'desk_session')
  if (!token) return undefined
  const row = db
    .prepare(
      `SELECT u.id AS id, u.username AS username, u.role AS role
       FROM login_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.status = 'active'`,
    )
    .get(hashSession(token)) as SessionUser | undefined
  return row ?? undefined
}

export function destroySession(db: DatabaseSync, cookieHeader: string | undefined): void {
  const token = parseCookie(cookieHeader, 'desk_session')
  if (!token) return
  db.prepare(`DELETE FROM login_sessions WHERE token_hash = ?`).run(hashSession(token))
}
