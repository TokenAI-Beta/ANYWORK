// lib/catalog.js — 目录扫描：聚合多个目录下的 agents/*.md 定义。
// 优先级：列表中靠前的目录优先；同名定义先出现者生效（后者标记 shadowed）。
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { parseAgentMd, normalizeAgentDef } from './scan.js'

/**
 * 扫描目录集合，返回 { dirs, list, defs, signature }。
 * - list：全部条目（含错误/被遮蔽的），供面板/展示；
 * - defs：可用的 name -> def（Map）；
 * - signature：目录内容指纹（文件名+mtime+size），用于变更检测。
 */
export async function scanCatalog(dirs) {
  const list = []
  const defs = new Map()
  const sigParts = []

  for (const dir of dirs) {
    let entries
    try {
      entries = await readdir(dir)
    } catch {
      continue // 目录不存在 = 正常（例如实例私有目录未创建）
    }
    entries = entries.filter((n) => n.toLowerCase().endsWith('.md') && !n.startsWith('.')).sort()
    for (const entry of entries) {
      const file = path.join(dir, entry)
      let st
      try {
        st = await stat(file)
      } catch {
        continue
      }
      if (!st.isFile()) continue
      sigParts.push(`${file}:${st.mtimeMs}:${st.size}`)

      let def
      try {
        const text = await readFile(file, 'utf8')
        const parsed = parseAgentMd(text)
        if (parsed.error) {
          def = {
            name: entry.replace(/\.md$/i, ''),
            file,
            source: dir,
            errors: [parsed.error],
            warnings: [],
          }
        } else {
          def = normalizeAgentDef({ file, source: dir, data: parsed.data, body: parsed.body, parseWarnings: parsed.warnings })
        }
      } catch (e) {
        def = { name: entry.replace(/\.md$/i, ''), file, source: dir, errors: [`读取失败：${e?.message ?? e}`], warnings: [] }
      }

      if (def.errors.length === 0 && def.name) {
        if (defs.has(def.name)) {
          def.shadowed = true
          def.warnings.push(`与 ${defs.get(def.name).file} 同名（先出现的优先，此项被忽略）`)
        } else {
          defs.set(def.name, def)
        }
      }
      list.push(def)
    }
  }

  const signature = `${dirs.join('|')}::${sigParts.join('|')}`
  return { dirs, list, defs, signature }
}
