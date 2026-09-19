// 虚拟钥匙工具：生成 sk-desk-…；库里只存 sha256
import { createHash, randomBytes } from 'node:crypto'

export function newVirtualKey(): string {
  return 'sk-desk-' + randomBytes(24).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
