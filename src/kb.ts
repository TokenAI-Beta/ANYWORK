// 企业知识库：对共享目录做零依赖全文检索（子串匹配，小团队够用）
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'

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


// —— 知识沉淀：笔记（kb/notes/，由 设置→知识库 的「沉淀」或 desk-kb 命令写入）——

export function kbNotesDir(): string {
  return join(kbRoot(), 'notes')
}

function pad2(x: number): string {
  return String(x).padStart(2, '0')
}

function localStamp(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function safeNoteName(name: unknown): string | null {
  const n = String(name ?? '')
  if (!n || n !== basename(n) || n.startsWith('.') || !/\.md$/i.test(n)) return null
  return n
}

export interface KbNoteMeta {
  name: string
  title: string
  author: string
  size: number
  mtime: string
}

export function listKbNotes(limit = 30): KbNoteMeta[] {
  const dir = kbNotesDir()
  let names: string[] = []
  try {
    names = readdirSync(dir).filter((n) => /\.md$/i.test(n) && !n.startsWith('.') && !/^readme/i.test(n))
  } catch {
    return []
  }
  const out: KbNoteMeta[] = []
  for (const n of names) {
    try {
      const st = statSync(join(dir, n))
      const head = readFileSync(join(dir, n), 'utf8').slice(0, 400)
      const title = /^title:\s*(.+)$/m.exec(head)?.[1]?.trim() || n.replace(/\.md$/i, '')
      const author = /^author:\s*(.+)$/m.exec(head)?.[1]?.trim() || ''
      out.push({ name: n, title, author, size: st.size, mtime: localStamp(new Date(st.mtimeMs)) })
    } catch {
      // 跳过读不到的
    }
  }
  out.sort((a, b) => (a.mtime < b.mtime ? 1 : -1))
  return out.slice(0, limit)
}

export function saveKbNote(input: { title?: string; content?: string; tags?: string; author?: string }): { ok: true; name: string } | { error: string } {
  const title = String(input.title ?? '').trim().slice(0, 120)
  const content = String(input.content ?? '').trim()
  if (!content) return { error: '内容不能为空' }
  if (content.length > 100_000) return { error: '内容过长（上限 10 万字符）' }
  const dir = kbNotesDir()
  mkdirSync(dir, { recursive: true })
  const now = new Date()
  const stamp = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}`
  const slugRaw = (title || 'note').replace(/[\/\\:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  const slug = slugRaw || 'note'
  let name = `${stamp}-${slug}.md`
  let i = 2
  while (existsSync(join(dir, name))) {
    name = `${stamp}-${slug}-${i}.md`
    i += 1
  }
  const tags = String(input.tags ?? '').trim().slice(0, 120)
  const head = `---\ntitle: ${title || slug}\nauthor: ${String(input.author || 'unknown').slice(0, 64)}\ntime: ${localStamp(now)}${tags ? `\ntags: ${tags}` : ''}\n---\n\n`
  writeFileSync(join(dir, name), head + content + '\n', { encoding: 'utf8', mode: 0o644 })
  return { ok: true, name }
}

export function readKbNote(name: unknown): { ok: true; name: string; content: string } | { error: string } {
  const n = safeNoteName(name)
  if (!n) return { error: '名称不合法' }
  const base = resolve(kbNotesDir())
  const full = resolve(base, n)
  if (!full.startsWith(base + '/')) return { error: '路径不合法' }
  try {
    const content = readFileSync(full, 'utf8').slice(0, 200_000)
    return { ok: true, name: n, content }
  } catch {
    return { error: '笔记不存在' }
  }
}

export function removeKbNote(name: unknown): { ok: true } | { error: string } {
  const n = safeNoteName(name)
  if (!n) return { error: '名称不合法' }
  try {
    unlinkSync(join(kbNotesDir(), n))
    return { ok: true }
  } catch {
    return { error: '笔记不存在' }
  }
}
