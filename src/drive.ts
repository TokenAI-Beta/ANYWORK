// 公司盘：共享文件区（列出 / 下载 / 上传；零依赖）
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, normalize, resolve, sep } from 'node:path'

export const MAX_UPLOAD = 50 * 1024 * 1024

export function driveRoot(): string {
  return process.env.DESK_DRIVE_DIR ?? join(homedir(), 'desk-data', 'drive')
}

export interface DriveEntry {
  name: string
  dir: boolean
  size: number
  mtime: string
}

export function resolveInDrive(rel: string): { abs: string } | { error: string } {
  if (rel.includes('\0')) return { error: 'bad path' }
  const root = resolve(driveRoot())
  const abs = resolve(root, normalize(rel || '.'))
  if (abs !== root && !abs.startsWith(root + sep)) return { error: 'path escapes drive' }
  return { abs }
}

function relFromRoot(abs: string): string {
  const root = resolve(driveRoot())
  const rel = abs === root ? '' : abs.slice(root.length + 1)
  return rel.split(sep).join('/')
}

export function listDrive(rel: string): { path: string; entries: DriveEntry[] } | { error: string } {
  const r = resolveInDrive(rel)
  if ('error' in r) return r
  if (!existsSync(r.abs)) return { path: relFromRoot(r.abs), entries: [] }
  let st
  try {
    st = statSync(r.abs)
  } catch {
    return { error: 'stat failed' }
  }
  if (!st.isDirectory()) return { error: 'not a directory' }
  const entries: DriveEntry[] = []
  let dirents
  try {
    dirents = readdirSync(r.abs, { withFileTypes: true })
  } catch {
    return { error: 'read failed' }
  }
  for (const e of dirents) {
    if (e.name.startsWith('.')) continue
    let size = 0
    let mtime = new Date(0).toISOString()
    try {
      const s = statSync(join(r.abs, e.name))
      size = s.isFile() ? s.size : 0
      mtime = new Date(s.mtimeMs).toISOString()
    } catch {
      continue
    }
    entries.push({ name: e.name, dir: e.isDirectory(), size, mtime })
  }
  entries.sort((a, b) => {
    if (a.dir !== b.dir) return a.dir ? -1 : 1
    return a.name.localeCompare(b.name, 'zh')
  })
  return { path: relFromRoot(r.abs), entries }
}

export function safeName(name: string): string | null {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('\0')) return null
  if (name === '.' || name === '..') return null
  if (name.length > 150) return null
  return name
}

export function saveToDrive(rel: string, name: string, data: Buffer): { ok: true; path: string; size: number } | { error: string } {
  const safe = safeName(name)
  if (!safe) return { error: 'bad name' }
  const r = resolveInDrive(rel ? rel + '/' + safe : safe)
  if ('error' in r) return r
  try {
    mkdirSync(join(r.abs, '..'), { recursive: true })
    writeFileSync(r.abs, data)
  } catch (e) {
    return { error: 'write failed: ' + String((e && e.message) || e) }
  }
  return { ok: true, path: relFromRoot(r.abs), size: data.length }
}
