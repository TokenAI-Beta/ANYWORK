// 把标准的 persona 行替换为团队版（用于从 dsh 自带 standard 生成团队预设）
// 用法: node scripts/apply-team-persona.mjs <agent.cordis.yml>
// 兼容两代 standard 写法：
//   新版（dsh 0.1.5-rc 起）: 两字段  suffix: / prefix:
//   旧版: 单字段  text: >-
import { readFileSync, writeFileSync } from 'node:fs'

const p = process.argv[2]
if (!p) {
  console.error('用法: node scripts/apply-team-persona.mjs <agent.cordis.yml>')
  process.exit(1)
}
let s = readFileSync(p, 'utf8')
const nl = s.includes('\r\n') ? '\r\n' : '\n'

const TEAM = [
  '你是 DSH-ANYWORK 团队工作台的助理（由 {{model}} 模型驱动）。',
  '与成员协作时用中文；写材料时遵循团队规范：结论先行、数据标注来源与口径、不编造、不确定用区间。',
]
const TEAM_SUFFIX = '工作目录是 {{cwd}}。'

// 新版：suffix + prefix 两字段
const reNew = /( *)suffix: Your working directory is \{\{cwd\}\}\.\r?\n( *)prefix: >-\r?\n( *)You are a coding agent powered by the \{\{model\}\} model\./
// 旧版：单个 text 字段
const reOld = /( *)text: >-\r?\n( *)You are a coding agent powered by the \{\{model\}\} model\. Your working directory is \{\{cwd\}\}\./

let changed = false
s = s.replace(reNew, (_m, i1, i2) => {
  changed = true
  return [
    `${i1}suffix: ${TEAM_SUFFIX}`,
    `${i2}prefix: >-`,
    `${i2}  ${TEAM[0]}`,
    `${i2}  ${TEAM[1]}`,
  ].join(nl)
})
if (!changed) {
  s = s.replace(reOld, (_m, i1) => {
    changed = true
    return [
      `${i1}prefix: >-`,
      `${i1}  ${TEAM[0]}`,
      `${i1}  ${TEAM[1]}`,
      `${i1}suffix: ${TEAM_SUFFIX}`,
    ].join(nl)
  })
}
if (!changed) {
  console.error('未找到标准 persona 段（dsh 版本可能已变化，请手动检查）')
  process.exit(1)
}
writeFileSync(p, s)
console.log('persona 已替换为团队版 ✓')
