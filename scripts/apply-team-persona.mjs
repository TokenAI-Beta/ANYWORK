// 把标准的 persona 行替换为团队版（用于从 dsh 自带 standard 生成团队预设）
// 用法: node scripts/apply-team-persona.mjs <agent.cordis.yml>
import { readFileSync, writeFileSync } from 'node:fs'

const p = process.argv[2]
if (!p) {
  console.error('用法: node scripts/apply-team-persona.mjs <agent.cordis.yml>')
  process.exit(1)
}
let s = readFileSync(p, 'utf8')
const re = /text: >-\n      You are a coding agent powered by the \{\{model\}\} model\. Your working directory is \{\{cwd\}\}\./
const team = [
  'text: >-',
  '      你是 DSH-ANYWORK 团队工作台的助理（由 {{model}} 模型驱动），工作目录是 {{cwd}}。',
  '      与成员协作时用中文；写材料时遵循团队规范：结论先行、数据标注来源与口径、不编造、不确定用区间。',
].join('\n')
if (!re.test(s)) {
  console.error('未找到标准 persona 段（dsh 版本可能已变化，请手动检查）')
  process.exit(1)
}
s = s.replace(re, team)
writeFileSync(p, s)
console.log('persona 已替换为团队版 ✓')
