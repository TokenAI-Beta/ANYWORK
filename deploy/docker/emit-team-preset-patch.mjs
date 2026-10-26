/**
 * Emit the four team preset cards and the Docker-only registry patch.
 *
 * One composition (dsh-v0.2.1-rc.3 standard plugins, plus the Codex tool row)
 * is written to presets-template/<id>/agent.cordis.yml and indented into
 * plugin/dsh-team-presets/cordis.patch.yml. The directory file is what
 * 功能与连接 and refresh-shipped-presets.sh ship. The patch is what the
 * engine mounts. Run: node deploy/docker/emit-team-preset-patch.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ALIAS = {
  'team-assistant': 'collab-default',
  'research-assistant': 'research-report',
  'doc-writer': 'formal-docs',
  'meeting-secretary': 'formal-docs',
  'data-organizer': 'eng-codex',
  'dev-partner': 'eng-codex',
}

export const CARDS = [
  {
    id: 'collab-default',
    name: '协作默认',
    description: '日常协作默认：中文优先，跟团队写作与数据规范；开场、杂事、跨角色协调用它。',
    order: 10,
    defaultHint: true,
    codex: false,
    whenToUse: 'team-report-style；日常协作、开场、协调',
    personaLine: '团队默认协作助手；先问清目标再动手；遵循团队写作与数据规范。',
    skillLine: '推荐技能 team-report-style。触发：日常协作、开场、协调。',
    codexDisabled: true,
    denyHeavy: false,
  },
  {
    id: 'research-report',
    name: '调研报告',
    description: '一手信源、行业调研：来源带链接、结论先行、影响分层——交付可核对来源的报告。',
    order: 20,
    defaultHint: false,
    codex: false,
    whenToUse: '检索/报告类；调研、竞品、信源分层',
    personaLine: '研究助理：一手信源优先、每条结论带链接、影响分层；不擅自改代码仓库。',
    skillLine: '推荐：检索/报告类。触发：调研、竞品、信源分层。',
    codexDisabled: true,
    denyHeavy: true,
  },
  {
    id: 'formal-docs',
    name: '正式文书',
    description: '合同、函件、纪要、周报：公文口吻、数字逐项核对、待办带责任人——正式出稿用它。',
    order: 30,
    defaultHint: false,
    codex: false,
    whenToUse: '文书/纪要模板；合同、函件、会议纪要、周报',
    personaLine: '正式文书+会议秘书：公文口吻、数字核对、纪要→待办→责任人；不跑 ralph/编码重流程。',
    skillLine: '推荐：文书/纪要模板。触发：合同、函件、会议纪要、周报。',
    codexDisabled: true,
    denyHeavy: true,
  },
  {
    id: 'eng-codex',
    name: '工程 Codex',
    description: '读仓改功能、本地验证与提交流程；表格/CSV 清洗与口径核对也走这里；批量可开 Codex 并行。',
    order: 40,
    defaultHint: false,
    codex: true,
    whenToUse: 'codex-parallel-worktrees；改代码、PR、本地验证、CSV/报表/口径',
    personaLine: '工程搭档：读仓改功能、本地验证、PR；表格脏数据先列清单再清洗；可用 Codex 并行。',
    skillLine: '推荐技能 codex-parallel-worktrees。触发：改代码、PR、本地验证、CSV/报表/口径。',
    codexDisabled: false,
    denyHeavy: false,
  },
]

const SHARED_BEFORE_DELEGATION = "- id: agent-instructions\n  name: '@deepseek-ai/dsh-agent-instructions'\n  config:\n    maxBytes: 65536\n- id: time-context\n  name: '@deepseek-ai/dsh-time-context'\n- id: tool-bash\n  name: '@deepseek-ai/dsh-tool-bash'\n  disabled: !!js process.platform === 'win32'\n- id: tool-pwsh\n  name: '@deepseek-ai/dsh-tool-pwsh'\n  disabled: !!js process.platform !== 'win32'\n- id: tool-fs\n  name: '@deepseek-ai/dsh-tool-fs'\n- id: tool-fs-search\n  name: '@deepseek-ai/dsh-tool-fs-search'\n  config:\n    sampleOverCapGlobResults: false\n- id: tool-jobs\n  name: '@deepseek-ai/dsh-tool-jobs'\n- id: tool-schedule\n  name: '@deepseek-ai/dsh-tool-schedule'\n- id: skill-filesystem\n  name: '@deepseek-ai/dsh-skill-filesystem'\n- id: tool-skill\n  name: '@deepseek-ai/dsh-tool-skill'\n- id: command-goal\n  name: '@deepseek-ai/dsh-command-goal'\n- id: tool-goal\n  name: '@deepseek-ai/dsh-tool-goal'\n- id: planning\n  name: cordis:group\n  group: true\n  isolate:\n    planMode: true\n  config:\n    - id: plan-mode\n      name: '@deepseek-ai/dsh-plan-mode'\n      config:\n        section: |\n          You are in plan mode. Stay in plan mode until the user approves your plan through exit_plan_mode or switches the session mode. Imperative language to implement changes means plan the implementation, not execute it. A user's conversational agreement \u2014 including an answer confirming something you asked \u2014 approves nothing and does not end plan mode; fold the confirmed decision into the plan and submit it through exit_plan_mode.\n\n          Explore first. Use non-mutating reads, searches, static analysis, and checks to ground the plan in the actual repository. Do not edit or write files, change configuration, run formatters or code generation that rewrites tracked files, commit, or otherwise carry out the plan. Prefer existing functions and patterns over new machinery.\n\n          The tool catalog stays the same across modes for request-cache stability. These plan-mode rules override any later tool description or guidance that suggests using mutation tools; those tools remain listed to keep the tool catalog unchanged. Do not use todo_write to track this planning phase: it tracks implementation after an approved plan, while the plan itself belongs in exit_plan_mode.\n\n          Resolve discoverable facts by inspection. Use ask_user_question only for user-owned choices or material ambiguity that inspection cannot answer. Do not ask the user where code lives or how current behavior works when you can find out.\n\n          Make the plan decision-complete: state the goal and success criteria; group implementation changes by subsystem; identify public API, schema, and data-flow changes; cover edge cases, failure modes, tests, acceptance criteria, and explicit assumptions. Keep it concise enough to review but detailed enough that another engineer can implement it without making design decisions.\n\n          When ready, call exit_plan_mode with the complete plan markdown, starting with a # title. Make exit_plan_mode the only and final tool call in that assistant response: it presents the plan for approval, and implementation begins only in a later step after approval. Do not paste the final plan as a plain reply or ask \"should I proceed?\" through prose or ask_user_question. If review rejects it, incorporate the feedback and present again. If the review channel is unavailable or aborted, stay in plan mode and ask the user to switch modes manually; do not proceed with implementation.\n- id: compaction\n  name: cordis:group\n  group: true\n  isolate:\n    compaction: true\n    toolResultPruner: true\n  config:\n    - id: compaction-basic\n      name: '@deepseek-ai/dsh-compaction-basic'\n    - id: command-compact\n      name: '@deepseek-ai/dsh-command-compact'\n    - id: tool-result-pruner\n      name: '@deepseek-ai/dsh-compaction-tool-result-pruner'\n      config:\n        thresholdChars: 8192\n        headChars: 4096\n        tailChars: 1024"
const SHARED_AFTER_DELEGATION = "- id: tool-ask-user\n  name: '@deepseek-ai/dsh-tool-ask-user'\n- id: tool-todo\n  name: '@deepseek-ai/dsh-tool-todo'\n  config:\n    allowParallelInProgress: true\n- id: tool-web\n  name: '@deepseek-ai/dsh-tool-web'\n  config:\n    fetch: true\n    searchTimeoutMs: 60000\n- id: present\n  name: '@deepseek-ai/dsh-tool-present'\n- id: tool-plugin-manager\n  name: '@deepseek-ai/dsh-plugin-manager/tools'\n  disabled: true\n- id: tool-plugin-market\n  name: '@deepseek-ai/dsh-plugin-market/tools'\n  disabled: true"

function persona(card) {
  return [
    '- id: persona',
    "  name: '@deepseek-ai/dsh-persona'",
    '  config:',
    '    prefix: >-',
    `      你是 DSH-ANYWORK 团队工作台的${card.name}角色（由 {{model}} 模型驱动）。`,
    `      ${card.personaLine}`,
    `      ${card.skillLine}`,
    '    suffix: 工作目录是 {{cwd}}。',
  ].join('\n')
}

function delegation(card) {
  const codexFlag = card.codexDisabled ? '\n      disabled: true' : ''
  const heavyFlag = card.denyHeavy ? '\n      disabled: true' : ''
  const note = card.denyHeavy
    ? [
        '    # Deny tool-ralph: omitted. @deepseek-ai/dsh-tool-ralph is not a web-profile',
        '    # dependency on dsh-v0.2.1-rc.3; a disabled row that fails to resolve marks',
        '    # the preset broken. Omission is the deny.',
        '    # Deny workflow-worker-thread: that id is not a package on this pin.',
        '    # The loader row is workflow-ptc, disabled below, with tool-workflow.',
      ].join('\n')
    : [
        '    # Codex provider stays the host singleton. This row is only the tool.',
        '    # Do not add a second registration of the provider name codex.',
      ].join('\n')
  return [
    '- id: delegation',
    '  name: cordis:group',
    '  group: true',
    '  isolate:',
    '    workflowEngine: true',
    '  config:',
    '    - id: tool-subagent-control',
    "      name: '@deepseek-ai/dsh-tool-subagent-control'",
    '    - id: tool-subagent-list-agents',
    "      name: '@deepseek-ai/dsh-tool-subagent-control/list-agents'",
    '    - id: tool-subagent',
    "      name: '@deepseek-ai/dsh-tool-subagent'",
    '      config:',
    '        provider: spawn',
    '        toolName: subagent',
    '        modelSelectionSettings: true',
    '    - id: tool-subagent-fork',
    "      name: '@deepseek-ai/dsh-tool-subagent'",
    '      config:',
    '        provider: fork',
    '        toolName: subagent_fork',
    note,
    '    - id: tool-subagent-codex',
    "      name: '@deepseek-ai/dsh-tool-subagent'" + codexFlag,
    '      config:',
    '        provider: codex',
    '        toolName: subagent_codex',
    '        enableRunInBackground: false',
    '        maxDepth: provider-managed',
    '    - id: workflow-ptc',
    "      name: '@deepseek-ai/dsh-workflow-ptc'" + heavyFlag,
    '      config:',
    '        provider: spawn',
    '    - id: tool-workflow',
    "      name: '@deepseek-ai/dsh-tool-workflow'" + heavyFlag,
  ].join('\n')
}

export function agentBody(card) {
  return [
    '# Team preset composition for dsh-v0.2.1-rc.3.',
    '# plugin/dsh-team-presets/cordis.patch.yml registers this list on the Docker image.',
    '# 功能与连接 reads preset.yml. setup.sh does not install the registry plugin.',
    persona(card),
    SHARED_BEFORE_DELEGATION,
    delegation(card),
    SHARED_AFTER_DELEGATION,
  ].join('\n') + '\n'
}

export function presetYml(card) {
  return [
    `name: ${card.name}`,
    `description: ${card.description}`,
    `order: ${card.order}`,
    `defaultHint: ${card.defaultHint ? 'true' : 'false'}`,
    `codex: ${card.codex ? 'true' : 'false'}`,
    `whenToUse: ${card.whenToUse}`,
    '',
  ].join('\n')
}

function indent(text, spaces) {
  const pad = ' '.repeat(spaces)
  return text.replace(/\s+$/, '').split('\n').map((line) => (line.length ? pad + line : line)).join('\n')
}

export function aliasMapYml() {
  const lines = [
    '# read-old → write-new. The panel lists only the four targets.',
    '# Blank and team-assistant become collab-default when that preset is registered.',
    '# An explicit standard choice is not rewritten.',
  ]
  for (const [from, to] of Object.entries(ALIAS)) lines.push(`${from}: ${to}`)
  return lines.join('\n') + '\n'
}

export function cordisPatch() {
  const rows = CARDS.map((card) => {
    const plugins = indent(agentBody(card), 10)
    return [
      `    - id: preset-${card.id}`,
      "      name: '@deepseek-ai/dsh-agent-preset'",
      '      config:',
      `        id: ${card.id}`,
      `        name: ${card.name}`,
      `        description: ${card.description}`,
      `        order: ${card.order}`,
      '        plugins:',
      plugins,
    ].join('\n')
  })
  return [
    '# dsh-team-presets: four named team templates (cut 2026-10-27 presets-template-redesign).',
    '# Built-in engine modes stay unnamed (标准 / PTC / 极简 / 创造).',
    '# Docker image only. Do not register the Codex provider again.',
    '- insert:',
    rows.join('\n'),
    '',
  ].join('\n')
}

export function renderAll() {
  const files = {
    'presets-template/alias-map.yml': aliasMapYml(),
    'plugin/dsh-team-presets/cordis.patch.yml': cordisPatch(),
  }
  for (const card of CARDS) {
    files[`presets-template/${card.id}/preset.yml`] = presetYml(card)
    files[`presets-template/${card.id}/agent.cordis.yml`] = agentBody(card)
  }
  return files
}

function repoRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..')
}

if (process.argv[1] && process.argv[1].endsWith('emit-team-preset-patch.mjs')) {
  const root = process.argv[2] || repoRoot()
  for (const [rel, body] of Object.entries(renderAll())) {
    const path = join(root, rel)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, body)
  }
}
