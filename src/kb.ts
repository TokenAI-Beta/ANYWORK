// 企业知识库：对共享目录做零依赖全文检索（子串匹配，小团队够用）
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative } from 'node:path'

const TEXT_EXT = new Set(['.md', '.txt', '.csv', '.tsv', '.json', '.yml', '.yaml', '.log', '.html', '.psv'])
const MAX_FILE = 2 * 1024 * 1024
const MAX_HITS = 20
const MAX_DEPTH = 6

export function kbRoot(): string {
  return process.env.DESK_KB_DIR ?? join(homedir(), 'desk-data', 'kb')
}

function walk(dir: string, out: string[], depth: number): void {
  if (depth > MAX_DEPTH) return
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue
      walk(p, out, depth + 1)
    } else if (e.isFile()) {
      const dot = e.name.lastIndexOf('.')
      const ext = dot >= 0 ? e.name.slice(dot).toLowerCase() : ''
      if (TEXT_EXT.has(ext)) out.push(p)
    }
  }
}

export interface KbHit {
  file: string
  line: number
  text: string
}

export interface KbSearchResult {
  q: string
  hits: KbHit[]
  truncated: boolean
  stats: { files: number; bytes: number; updatedAt: string | null }
}

export function kbSearch(query: string): KbSearchResult {
  const root = kbRoot()
  const stats: KbSearchResult['stats'] = { files: 0, bytes: 0, updatedAt: null }
  const hits: KbHit[] = []
  let truncated = false
  if (!existsSync(root)) return { q: query, hits, truncated, stats }

  const ql = query.toLowerCase()
  const files: string[] = []
  walk(root, files, 0)

  let latest = 0
  for (const f of files) {
    let st
    try {
      st = statSync(f)
    } catch {
      continue
    }
    stats.files += 1
    stats.bytes += st.size
    if (st.mtimeMs > latest) latest = st.mtimeMs
    if (!ql || st.size > MAX_FILE) continue
    if (hits.length >= MAX_HITS) {
      truncated = true
      continue
    }
    let text = ''
    try {
      text = readFileSync(f, 'utf8')
    } catch {
      continue
    }
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (hits.length >= MAX_HITS) {
        truncated = true
        break
      }
      if (lines[i].toLowerCase().includes(ql)) {
        hits.push({ file: relative(root, f), line: i + 1, text: lines[i].trim().slice(0, 160) })
      }
    }
  }
  if (latest > 0) stats.updatedAt = new Date(latest).toISOString()
  return { q: query, hits, truncated, stats }
}
