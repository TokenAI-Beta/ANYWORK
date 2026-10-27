# -*- coding: utf-8 -*-
"""Docker image only: Decision B chat shell (cut 2026-10-27).

Bubbles, a six-token subset, one reveal/collapse surface, four role
swatches, and a short code block inside the existing Lexical composer.
Attachments stay the composer rail, marked as an embed. No Electron
titlebar, no 1130px split, no glass restyle, no alias-map edit, no
agent.cordis edit.

DSH_SRC patches the harness clone before pnpm build.
ANYWORK_SRC patches desk-panel after the use-path image script.
Neither variable has a home-directory default, so a Windows checkout
and Tokyo stay untouched. Pass one or both.
"""
import io
import os
import sys

MARKER = "cut 2026-10-27 chat-shell-ui-from-workbench"
NEED_USE_PATH = "cut 2026-10-27 features-connect-use-path"

BUBBLE_CSS = "packages/client/ui-chat/src/client/chat/MessageItem.module.css"
ASSIST_CSS = "packages/client/ui-chat/src/client/chat/AssistantMarkdown.module.css"
SHELL_CSS = "packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css"
SHELL_TSX = "packages/client/ui-conversation/src/client/skeleton/ConversationMainPanel.tsx"
LABEL_TSX = "packages/client/ui-agent-preset/src/client/AgentPresetLabel.tsx"
LABEL_CSS = "packages/client/ui-agent-preset/src/client/AgentPresetLabel.module.css"
INPUT_TSX = "packages/client/ui-conversation/src/client/skeleton/InputBar.tsx"
INPUT_CSS = "packages/client/ui-conversation/src/client/skeleton/InputBar.module.css"
EDITABLE_TSX = "packages/client/ui-conversation/src/client/input/editor/ComposerContentEditable.tsx"
RUNTIME_TS = "packages/client/ui-conversation/src/client/input/editor/runtime.ts"
PROJECT_TS = "packages/client/ui-conversation/src/client/input/editor/projection.ts"
SKILL_TSX = "packages/client/ui-skill/src/client/SkillRow.tsx"
SKILL_CSS = "packages/client/ui-skill/src/client/SkillRow.module.css"
CODE_TSX = "packages/client/ui-conversation/src/client/input/editor/composer-code-node.tsx"
CODE_CSS = "packages/client/ui-conversation/src/client/input/editor/composer-code.module.css"
DESK = "plugin/desk-panel/lib/client.js"

SWATCHES = (
    ("collab-default", "#1680f3"),
    ("research-report", "#0d9488"),
    ("formal-docs", "#7c3aed"),
    ("eng-codex", "#c2410c"),
)

OLD_BUBBLE = """.bubble {
  /* Figma's 525px cap held as a share of the width axis (525/748 ≈ 0.702) so
     the bubble widens with a user-dragged or adaptive column; percentage
     keeps narrow windows sane. */
  max-width: 100%;
  background: var(--dsw-specific-bubble);
  border-radius: var(--dsw-radius-xl);
  /* 42px single-line bubble at the default size: 22 line + 10 vertical
     padding each side; the Settings font-size preference moves size and line
     height together through the body-published axis. */
  padding: 10px 16px;
  font-size: var(--dsh-content-font-size, 14px);
  line-height: calc(22px + var(--dsh-content-font-delta, 0px));
  color: var(--dsw-alias-label-primary);
  /* The projected user text is inline runs; the bubble owns wrapping so a
     decorated single-line message stays one line. */
  white-space: pre-wrap;
  word-break: break-word;
}
"""

NEW_BUBBLE = """.bubble {
  /* ANYWORK Docker image (cut 2026-10-27 chat-shell-ui-from-workbench):
     user solid ink, white text. Block pad 7 + line 22 = 36 single-line.
     Fill stays ink. Role color is not painted here. */
  max-width: 100%;
  box-sizing: border-box;
  min-height: 36px;
  padding: 7px 14px;
  border-radius: 18px;
  background: var(--ink, #1c1c1c);
  color: var(--on-ink, #fff);
  font-size: var(--dsh-content-font-size, 14px);
  line-height: 22px;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble :global(*) {
  color: inherit;
}
"""

OLD_ASSIST = """.root {
  display: flex;
  flex-direction: column;
  font-size: var(--dsh-content-font-size, 14px);
  line-height: calc(24px + var(--dsh-content-font-delta, 0px));
  color: var(--dsw-alias-label-primary);
}
"""

NEW_ASSIST = """.root {
  /* ANYWORK Docker image (cut 2026-10-27 chat-shell-ui-from-workbench):
     assistant wash. 1px border keeps the 6% fill from smearing.
     Role color is an inset edge, not a fill. */
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-height: 36px;
  padding: 7px 14px;
  border: 1px solid #1c1c1c14;
  border-radius: 18px;
  background: #1c1c1c0f;
  box-shadow: inset 3px 0 0 var(--role-swatch, transparent);
  font-size: var(--dsh-content-font-size, 14px);
  line-height: 22px;
  color: var(--text-100, var(--ink, #1c1c1c));
}
"""

OLD_SHELL_BG = """  min-width: 0;
  background: var(--dsw-alias-bg-base);
}
"""

NEW_SHELL_BG = """  min-width: 0;
  background: var(--chrome, var(--dsw-alias-bg-base));
}
"""

TOKEN_BLOCK = """/* ANYWORK Docker image (cut 2026-10-27 chat-shell-ui-from-workbench):
   token subset on the shell. Not a StyleX dump. */
:global(:root) {
  --ink: #1c1c1c;
  --on-ink: #ffffff;
  --chrome: #fcfcfc;
  --pane: #ffffff;
  --accent: #1680f3;
  --accent-hover: #126fd4;
  --text-100: color-mix(in srgb, var(--ink) 100%, transparent);
  --text-68: color-mix(in srgb, var(--ink) 68%, transparent);
  --text-56: color-mix(in srgb, var(--ink) 56%, transparent);
  --text-40: color-mix(in srgb, var(--ink) 40%, transparent);
}

"""

OLD_SHELL_DIV = """    <div className={css.root} data-phase={phase}>
"""

NEW_SHELL_DIV = """    <div className={css.root} data-phase={phase} data-conversation-root>
"""

OLD_LABEL_IMPORT = """import { useEffect } from 'react'
"""

NEW_LABEL_IMPORT = """import { useEffect, useRef } from 'react'
"""

OLD_LABEL_FN = """/**
 * Render this session's agent-preset name beside its title.
 * @param props - composed slot props.
 * @returns the label, or null when the session records no preset.
 */
export function AgentPresetLabel({
"""

NEW_LABEL_FN = """const ROLE_SWATCH: Readonly<Record<string, string>> = {
  // Display dots only. Does not rewrite the preset alias map.
  'collab-default': '#1680f3',
  'team-assistant': '#1680f3',
  'research-report': '#0d9488',
  'research-assistant': '#0d9488',
  'formal-docs': '#7c3aed',
  'doc-writer': '#7c3aed',
  'meeting-secretary': '#7c3aed',
  'eng-codex': '#c2410c',
  'data-organizer': '#c2410c',
  'dev-partner': '#c2410c',
}

/**
 * Render this session's agent-preset name beside its title.
 * @param props - composed slot props.
 * @returns the label, or null when the session records no preset.
 */
export function AgentPresetLabel({
"""

OLD_LABEL_TAIL = """  useEffect(() => {
    // Deployments that compose no presets never label anything, so the roster
    // is only worth a request once a session reports one.
    if (preset !== undefined) void load()
  }, [preset, load])

  if (preset === undefined) return null

  const option = options.find(entry => entry.id === preset)
  const text = option === undefined ? undefined : presetDisplayText(option, t)
  return (
    <span className={css.label} title={text?.description ?? t('headerHint')}>
      <IconAgentPresetOutlineRegular size={14} className={css.icon} />
      {text?.name ?? preset}
    </span>
  )
}
"""

NEW_LABEL_TAIL = """  useEffect(() => {
    // Deployments that compose no presets never label anything, so the roster
    // is only worth a request once a session reports one.
    if (preset !== undefined) void load()
  }, [preset, load])

  const labelRef = useRef<HTMLSpanElement | null>(null)
  const swatch = preset === undefined ? undefined : ROLE_SWATCH[preset]

  useEffect(() => {
    // ANYWORK Docker image (cut 2026-10-27 chat-shell-ui-from-workbench):
    // publish the session role as an edge color for assistant bubbles.
    const shell = labelRef.current?.closest('[data-conversation-root]')
    if (!(shell instanceof HTMLElement)) return undefined
    if (preset === undefined || swatch === undefined) {
      shell.style.removeProperty('--role-swatch')
      shell.removeAttribute('data-role')
      return undefined
    }
    shell.style.setProperty('--role-swatch', swatch)
    shell.setAttribute('data-role', preset)
    return () => {
      shell.style.removeProperty('--role-swatch')
      shell.removeAttribute('data-role')
    }
  }, [preset, swatch])

  if (preset === undefined) return null

  const option = options.find(entry => entry.id === preset)
  const text = option === undefined ? undefined : presetDisplayText(option, t)
  return (
    <span
      ref={labelRef}
      className={css.label}
      data-agent-preset={preset}
      title={text?.description ?? t('headerHint')}
    >
      {swatch === undefined ? null : (
        <span className={css.swatch} data-role-swatch={preset} style={{ background: swatch }} />
      )}
      <IconAgentPresetOutlineRegular size={14} className={css.icon} />
      {text?.name ?? preset}
    </span>
  )
}
"""

OLD_LABEL_ICON = """.icon {
  flex: none;
  opacity: 0.7;
}
"""

NEW_LABEL_ICON = """.icon {
  flex: none;
  opacity: 0.7;
}

/* ANYWORK Docker image (cut 2026-10-27 chat-shell-ui-from-workbench): avatar dot. */
.swatch {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--role-swatch, var(--accent, #1680f3));
}
"""

OLD_INPUT_IMPORT = """import clsx from 'clsx'
"""

NEW_INPUT_IMPORT = """import clsx from 'clsx'
import {
  $createParagraphNode, $getRoot, $getSelection, $isElementNode, $isRangeSelection,
} from 'lexical'
import { $createComposerCodeNode } from '../input/editor/composer-code-node.tsx'
"""

OLD_INPUT_RETURN = """        : planActive ? t('placeholder.plan') : t('placeholder.default'))

  return (
"""

NEW_INPUT_RETURN = """        : planActive ? t('placeholder.plan') : t('placeholder.default'))

  const onInsertCode = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    if (editor === null) return
    editor.focus()
    editor.update(() => {
      const code = $createComposerCodeNode('')
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        selection.insertNodes([code])
        return
      }
      const root = $getRoot()
      if (root.getChildrenSize() === 0) root.append($createParagraphNode())
      const last = root.getLastChild()
      if ($isElementNode(last)) {
        last.append(code)
        last.selectEnd()
      }
    })
  }

  return (
"""

OLD_ATTACH = """        {renderSlot('conversation.input.attachments', {
          attachments,
          canAcceptDrop,
          onAddFiles: intakeFiles,
          onRemoveAttachment: (id) => { removeAttachment?.(id) },
          uploads,
          onRetryFile: (id) => { retryFileUpload?.(id) },
          dropLimits: imageLimits === undefined ? undefined : {
            count: imageLimits.maxImagesPerMessage,
            size: imageSizeText(imageLimits.maxImageBytes),
          },
        })}
"""

NEW_ATTACH = """        <div className={css.embeds} data-composer-embed="attachment">
          {renderSlot('conversation.input.attachments', {
            attachments,
            canAcceptDrop,
            onAddFiles: intakeFiles,
            onRemoveAttachment: (id) => { removeAttachment?.(id) },
            uploads,
            onRetryFile: (id) => { retryFileUpload?.(id) },
            dropLimits: imageLimits === undefined ? undefined : {
              count: imageLimits.maxImagesPerMessage,
              size: imageSizeText(imageLimits.maxImageBytes),
            },
          })}
        </div>
"""

OLD_PLUS = """                <IconPlusOutlineMedium size={14} />
              </button>
            </Tooltip>
            <input
"""

NEW_PLUS = """                <IconPlusOutlineMedium size={14} />
              </button>
            </Tooltip>
            <button
              type="button"
              className={css.add}
              aria-label="插入短代码块"
              title="插入短代码块"
              disabled={editor === null || editorDisabled}
              onMouseDown={keepFocus}
              onClick={onInsertCode}
            >
              <span aria-hidden>{'</>'}</span>
            </button>
            <input
"""

OLD_SEND = """                className={css.primary}
                aria-label={primaryLabel}
                disabled={primaryDisabled}
"""

NEW_SEND = """                className={css.primary}
                aria-label={primaryLabel}
                data-send-state={empty ? 'empty' : 'ready'}
                disabled={primaryDisabled}
"""

OLD_CARD_BG = """  background: var(--dsw-specific-input-major);
"""

NEW_CARD_BG = """  background: var(--pane, var(--dsw-specific-input-major));
"""

OLD_PLACEHOLDER_COLOR = """.placeholder {
  position: absolute;
  inset: 4px 8px auto 14px;
  color: var(--dsw-alias-label-caption);
"""

NEW_PLACEHOLDER_COLOR = """.placeholder {
  position: absolute;
  inset: 4px 8px auto 14px;
  color: var(--text-40, var(--dsw-alias-label-caption));
"""

OLD_PRIMARY_BG = """  background: var(--dsw-alias-button-info-fill);
"""

NEW_PRIMARY_BG = """  background: var(--accent, var(--dsw-alias-button-info-fill));
"""

OLD_PRIMARY_HOVER = """  background: var(--dsw-alias-button-info-hover);
"""

NEW_PRIMARY_HOVER = """  background: var(--accent-hover, var(--dsw-alias-button-info-hover));
"""

INPUT_EXTRA = """
/* ANYWORK Docker image (cut 2026-10-27 chat-shell-ui-from-workbench):
   attachment embed sits in the card; send CTA is empty vs ready.
   The contenteditable already grows with its text (.scroll caps it). */
.embeds:empty { display: none; }
.embeds:not(:empty) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 2px 14px 0;
}
.primary[data-send-state='empty'] {
  background: var(--accent, #1680f3);
  opacity: 0.4;
}
.primary[data-send-state='ready'] {
  background: var(--accent, #1680f3);
}
.primary[data-send-state='ready']:hover:not(:disabled) {
  background: var(--accent-hover, #126fd4);
}
.primary[data-send-state='ready']:disabled {
  opacity: 0.4;
}
"""

OLD_EDITABLE = """      data-composer-input
"""

NEW_EDITABLE = """      data-composer-input
      data-autoresize="content"
"""

OLD_RUNTIME_IMPORT = """import { CommandChipNode, $createCommandChipNode, registerCommandChipSeat } from './command-chip-node.tsx'
"""

NEW_RUNTIME_IMPORT = """import { CommandChipNode, $createCommandChipNode, registerCommandChipSeat } from './command-chip-node.tsx'
import { ComposerCodeNode, bindComposerCodeEditor } from './composer-code-node.tsx'
"""

OLD_RUNTIME_NODES = """      nodes: [ReferenceChipNode, CommandChipNode, TextRefNode],
      onError: (error) => { throw error },
    })
"""

NEW_RUNTIME_NODES = """      nodes: [ReferenceChipNode, CommandChipNode, TextRefNode, ComposerCodeNode],
      onError: (error) => { throw error },
    })
    bindComposerCodeEditor(this.editor)
"""

OLD_PROJECT_IMPORT = """import { $isCommandChipNode } from './command-chip-node.tsx'
"""

NEW_PROJECT_IMPORT = """import { $isCommandChipNode } from './command-chip-node.tsx'
import { $isComposerCodeNode } from './composer-code-node.tsx'
"""

OLD_PROJECT_WALK = """      } else if ($isLineBreakNode(kid)) {
        pushLeaf('linebreak', kid, '\\n', '\\n')
      } else if ($isElementNode(kid)) {
"""

NEW_PROJECT_WALK = """      } else if ($isLineBreakNode(kid)) {
        pushLeaf('linebreak', kid, '\\n', '\\n')
      } else if ($isComposerCodeNode(kid)) {
        // Short code block. clipboardText is what submit sends.
        const text = kid.getTextContent()
        pushLeaf('text', kid, text, text)
      } else if ($isElementNode(kid)) {
"""

OLD_SUMMARY = """.summary {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--dsh-content-font-size-secondary, 13px);
  line-height: calc(24px + var(--dsh-content-font-delta, 0px));
}
"""

NEW_SUMMARY = """.summary {
  /* ANYWORK Docker image (cut 2026-10-27 chat-shell-ui-from-workbench):
     hover grows the label by max-width, a size animation. */
  flex: 0 1 auto;
  min-width: 0;
  max-width: 9em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--dsh-content-font-size-secondary, 13px);
  line-height: calc(24px + var(--dsh-content-font-delta, 0px));
  color: var(--text-56, var(--dsw-alias-label-tertiary));
  transition: max-width 180ms ease;
}

.card:hover .summary,
.row:focus-visible .summary {
  max-width: 28em;
}
"""

OLD_TITLE = """.title {
  flex: none;
  font-size: var(--dsh-content-font-size-secondary, 13px);
  line-height: calc(24px + var(--dsh-content-font-delta, 0px));
}
"""

NEW_TITLE = """.title {
  flex: none;
  font-size: var(--dsh-content-font-size-secondary, 13px);
  line-height: calc(24px + var(--dsh-content-font-delta, 0px));
  color: var(--text-68, inherit);
}
"""

OLD_BODY = """.bodyWrap {
  display: flex;
  flex-direction: column;
}
"""

NEW_BODY = """.bodyWrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 180ms ease;
}

.bodyWrap[data-open='true'] {
  grid-template-rows: 1fr;
}

.bodyWrap:not([data-open='true']) {
  pointer-events: none;
}

.bodyInner {
  min-height: 0;
  overflow: hidden;
}
"""

OLD_HEADER_COLOR = """  color: var(--dsw-alias-label-caption);
  text-transform: uppercase;
"""

NEW_HEADER_COLOR = """  color: var(--text-40, var(--dsw-alias-label-caption));
  text-transform: uppercase;
"""

OLD_MOTION = """@media (prefers-reduced-motion: reduce) {
  .row,
  .iconIdle,
  .chevronHover,
  .inspectButton {
    transition: none;
  }
}
"""

NEW_MOTION = """@media (prefers-reduced-motion: reduce) {
  .row,
  .iconIdle,
  .chevronHover,
  .inspectButton,
  .summary,
  .bodyWrap {
    transition: none;
  }
}
"""

OLD_SKILL_BODY = """      {open ? (
        <div className={css.bodyWrap}>
          <section className={css.instructionsCard} aria-label={t('row.instructions')}>
            <div className={css.instructionsHeader}>{t('row.instructions')}</div>
            <pre className={css.instructions} data-error={model.state === 'error' || undefined}>{model.output}</pre>
          </section>
          {inspect !== undefined ? (
            <button type="button" className={css.inspectButton} onClick={inspect}>
              <IconInspectOutlineRegular />
              {t('row.inspect')}
            </button>
          ) : null}
        </div>
      ) : null}
"""

NEW_SKILL_BODY = """      {expandable ? (
        <div className={css.bodyWrap} data-open={open ? 'true' : 'false'} aria-hidden={open ? undefined : true}>
          <div className={css.bodyInner}>
            <section className={css.instructionsCard} aria-label={t('row.instructions')}>
              <div className={css.instructionsHeader}>{t('row.instructions')}</div>
              <pre className={css.instructions} data-error={model.state === 'error' || undefined}>{model.output}</pre>
            </section>
            {inspect !== undefined ? (
              <button type="button" className={css.inspectButton} onClick={inspect}>
                <IconInspectOutlineRegular />
                {t('row.inspect')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
"""

CODE_TSX_BODY = r'''/** Short code block embedded in the Lexical composer.
 * ANYWORK Docker image (cut 2026-10-27 chat-shell-ui-from-workbench).
 * getTextContent is a fence so the existing clipboard/submit projection
 * sends the code. Empty fences contribute nothing. Cap is a short block.
 */
import type { JSX } from 'react'
import type {
  EditorConfig, LexicalEditor, LexicalNode, NodeKey, SerializedLexicalNode, Spread,
} from 'lexical'
import { $getNodeByKey, DecoratorNode } from 'lexical'
import css from './composer-code.module.css'

export type SerializedComposerCodeNode = Spread<{
  code: string
}, SerializedLexicalNode>

let activeEditor: LexicalEditor | null = null

export function bindComposerCodeEditor(editor: LexicalEditor | null): void {
  activeEditor = editor
}

function capCode(code: string): string {
  return code.split('\n').slice(0, 12).join('\n').slice(0, 800)
}

function CodeEmbed({ code, nodeKey }: { code: string; nodeKey: NodeKey }): JSX.Element {
  return (
    <span className={css.block} data-composer-code="">
      <span className={css.kicker}>code</span>
      <textarea
        className={css.area}
        rows={Math.min(8, Math.max(2, code.split('\n').length))}
        value={code}
        spellCheck={false}
        aria-label="短代码块"
        onMouseDown={(event) => { event.stopPropagation() }}
        onKeyDown={(event) => { event.stopPropagation() }}
        onChange={(event) => {
          event.stopPropagation()
          const next = event.target.value
          activeEditor?.update(() => {
            const node = $getNodeByKey(nodeKey)
            if ($isComposerCodeNode(node)) node.setCode(next)
          })
        }}
      />
    </span>
  )
}

export class ComposerCodeNode extends DecoratorNode<JSX.Element> {
  __code: string

  static override getType(): string {
    return 'composer-code'
  }

  static override clone(node: ComposerCodeNode): ComposerCodeNode {
    return new ComposerCodeNode(node.__code, node.__key)
  }

  static override importJSON(json: SerializedComposerCodeNode): ComposerCodeNode {
    return new ComposerCodeNode(json.code)
  }

  constructor(code = '', key?: NodeKey) {
    super(key)
    this.__code = capCode(code)
  }

  override exportJSON(): SerializedComposerCodeNode {
    return {
      ...super.exportJSON(),
      type: 'composer-code',
      version: 1,
      code: this.__code,
    }
  }

  override createDOM(_config: EditorConfig): HTMLElement {
    const el = document.createElement('span')
    el.setAttribute('data-composer-code', '')
    el.setAttribute('contenteditable', 'false')
    return el
  }

  override updateDOM(): boolean {
    return false
  }

  override isInline(): boolean {
    return true
  }

  override isKeyboardSelectable(): boolean {
    return false
  }

  override getTextContent(): string {
    const body = this.__code.replace(/\s+$/u, '')
    if (body.trim() === '') return ''
    return '\n```\n' + body + '\n```\n'
  }

  setCode(code: string): void {
    const writable = this.getWritable()
    writable.__code = capCode(code)
  }

  override decorate(): JSX.Element {
    return <CodeEmbed code={this.getLatest().__code} nodeKey={this.__key} />
  }
}

export function $createComposerCodeNode(code = ''): ComposerCodeNode {
  return new ComposerCodeNode(code)
}

export function $isComposerCodeNode(node: LexicalNode | null | undefined): node is ComposerCodeNode {
  return node instanceof ComposerCodeNode
}
'''

CODE_CSS_BODY = """/* ANYWORK Docker image (cut 2026-10-27 chat-shell-ui-from-workbench): short code embed. */
.block {
  display: inline-block;
  vertical-align: bottom;
  max-width: 100%;
  margin: 4px 0;
  padding: 7px 10px;
  border: 1px solid #1c1c1c14;
  border-radius: 12px;
  background: var(--pane, #fff);
  color: var(--text-100, var(--ink, #1c1c1c));
}

.kicker {
  display: block;
  margin-bottom: 4px;
  color: var(--text-40, #1c1c1c66);
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.area {
  display: block;
  width: 18em;
  max-width: 100%;
  min-height: 44px;
  max-height: 8.5em;
  margin: 0;
  padding: 0;
  border: 0;
  resize: none;
  overflow: auto;
  background: transparent;
  color: inherit;
  font: 12px/18px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  outline: none;
}
"""

OLD_ROLE_ICON = """    function roleIcon(id) { return ROLE_ICON[id] || "assist"; }
"""

NEW_ROLE_ICON = """    // ANYWORK Docker image (cut 2026-10-27 chat-shell-ui-from-workbench):
    // edge/dot colors for the four cards. Not the registry alias map.
    function roleSwatch(id) {
      var map = {
        "collab-default": "#1680f3",
        "team-assistant": "#1680f3",
        "research-report": "#0d9488",
        "research-assistant": "#0d9488",
        "formal-docs": "#7c3aed",
        "doc-writer": "#7c3aed",
        "meeting-secretary": "#7c3aed",
        "eng-codex": "#c2410c",
        "data-organizer": "#c2410c",
        "dev-partner": "#c2410c"
      };
      return map[String(id || "")] || "";
    }
    function roleIcon(id) { return ROLE_ICON[id] || "assist"; }
"""

OLD_CARD = """            var liveDefault = p.isDefault === true || (st.roster !== "ready" && p.defaultHint);
            var locked = act.busy === p.id;
            return h("div", { key: "fnp" + p.id, className: "rolecard" },
              h("div", { className: "rc-top" },
                h("span", { className: "rc-ico" }, dicon(roleIcon(p.id), 16)),
"""

NEW_CARD = """            var liveDefault = p.isDefault === true || (st.roster !== "ready" && p.defaultHint);
            var locked = act.busy === p.id;
            var swatch = roleSwatch(p.id);
            return h("div", { key: "fnp" + p.id, className: "rolecard", "data-role": p.id, style: swatch ? { boxShadow: "inset 3px 0 0 " + swatch } : null },
              h("div", { className: "rc-top" },
                swatch ? h("span", { className: "role-dot", "data-role-swatch": p.id, style: { background: swatch } }) : null,
                h("span", { className: "rc-ico" }, dicon(roleIcon(p.id), 16)),
"""

OLD_LINKISH = """.ddp .ft .linkish { display:inline-block; margin-top:4px; border:0; background:transparent; padding:0; color:#4f7cf7; font:inherit; cursor:pointer; text-decoration:underline; }"""

NEW_LINKISH = OLD_LINKISH + """
.ddp .role-dot { width:8px; height:8px; border-radius:50%; flex:0 0 auto; display:inline-block; }"""

OLD_TX = """      ".bts-e .tx{font-size:12.3px;line-height:1.55;color:var(--dsw-alias-label-secondary,#4a5058);white-space:pre-wrap;word-break:break-word}",
"""

NEW_TX = """      ".bts-e .tx{font-size:12.3px;line-height:1.55;color:var(--dsw-alias-label-secondary,#4a5058);white-space:pre-wrap;word-break:break-word}",
      ".bts-e .role-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;display:inline-block}",
      ".bts-e .tx[data-bubble=user]{background:#1c1c1c;color:#fff;border-radius:18px;padding:7px 14px;line-height:22px;min-height:36px;box-sizing:border-box}",
      ".bts-e .tx[data-bubble=assistant]{background:#1c1c1c0f;color:#1c1c1c;border:1px solid #1c1c1c14;border-radius:18px;padding:7px 14px;line-height:22px;min-height:36px;box-sizing:border-box;box-shadow:inset 3px 0 0 var(--role-swatch, transparent)}",
"""

OLD_BOT_MSG = """            logKids.push(h("div", { key: "m" + i, className: "bts-e", style: you ? { alignItems: "flex-end" } : null },
              h("div", { className: "em" }, h("span", { className: "nm" + (you ? " you" : "") }, you ? tr("bts.you") : ((b && (b.title || b.name)) || st.botName)), h("span", { className: "tm" }, btsTime(mm.time))),
              h("div", { className: "tx", style: you ? { background: "rgba(127,127,127,.08)", borderRadius: "9px", padding: "6px 9px" } : null }, mm.text)
            ));
"""

NEW_BOT_MSG = """            var roleColor = you ? "" : roleSwatch(st.botName);
            var dot = you ? "" : (roleColor || btsColor(st.botName));
            logKids.push(h("div", { key: "m" + i, className: "bts-e", style: you ? { alignItems: "flex-end" } : null },
              h("div", { className: "em" },
                dot ? h("span", { className: "role-dot", "data-role-swatch": roleColor ? st.botName : "bot", style: { background: dot } }) : null,
                h("span", { className: "nm" + (you ? " you" : "") }, you ? tr("bts.you") : ((b && (b.title || b.name)) || st.botName)),
                h("span", { className: "tm" }, btsTime(mm.time))
              ),
              h("div", { className: "tx", "data-bubble": you ? "user" : "assistant", style: roleColor ? { "--role-swatch": roleColor } : null }, mm.text)
            ));
"""

OLD_ROOM_MSG = """            logKids.push(h("div", { key: "e" + idx, className: "bts-e" },
              h("div", { className: "em" },
                h("span", { className: "nm" + (you ? " you" : "") }, you ? tr("bts.you") : ((b && (b.title || b.name)) || e2.from.name)),
                h("span", { className: "tm" }, btsTime(e2.at))
              ),
              h("div", { className: "tx" }, e2.text)
            ));
"""

NEW_ROOM_MSG = """            var who = you ? "" : e2.from.name;
            var roleColor = roleSwatch(who);
            var dot = you ? "" : (roleColor || btsColor(who));
            logKids.push(h("div", { key: "e" + idx, className: "bts-e", style: you ? { alignItems: "flex-end" } : null },
              h("div", { className: "em" },
                dot ? h("span", { className: "role-dot", "data-role-swatch": roleColor ? who : "bot", style: { background: dot } }) : null,
                h("span", { className: "nm" + (you ? " you" : "") }, you ? tr("bts.you") : ((b && (b.title || b.name)) || e2.from.name)),
                h("span", { className: "tm" }, btsTime(e2.at))
              ),
              h("div", { className: "tx", "data-bubble": you ? "user" : "assistant", style: roleColor ? { "--role-swatch": roleColor } : null }, e2.text)
            ));
"""


def _read(path):
    if not os.path.isfile(path):
        sys.exit("missing %s" % path)
    return io.open(path, encoding="utf-8").read()


def _replace_one(text, old, new, label):
    count = text.count(old)
    if count != 1:
        sys.exit("anchor count=%d in %s (expect 1)" % (count, label))
    return text.replace(old, new, 1)


def _write(path, text):
    parent = os.path.dirname(path)
    if parent and not os.path.isdir(parent):
        os.makedirs(parent)
    io.open(path, "w", encoding="utf-8").write(text)


def _dsh_ok(files):
    bubble = files[BUBBLE_CSS]
    assist = files[ASSIST_CSS]
    shell = files[SHELL_CSS]
    label = files[LABEL_TSX]
    runtime = files[RUNTIME_TS]
    project = files[PROJECT_TS]
    skill_css = files[SKILL_CSS]
    skill = files[SKILL_TSX]
    code = files[CODE_TSX]
    editable = files[EDITABLE_TSX]
    input_tsx = files[INPUT_TSX]
    input_css = files[INPUT_CSS]
    if bubble.count("background: var(--ink, #1c1c1c)") != 1:
        return False
    if "color: var(--on-ink, #fff)" not in bubble or "border-radius: 18px" not in bubble:
        return False
    if "padding: 7px 14px" not in bubble or "line-height: 22px" not in bubble:
        return False
    if "min-height: 36px" not in bubble:
        return False
    if "#c2410c" in bubble or "#7c3aed" in bubble or "#0d9488" in bubble:
        return False
    if "background: #1c1c1c0f" not in assist or "border: 1px solid #1c1c1c14" not in assist:
        return False
    if "inset 3px 0 0 var(--role-swatch, transparent)" not in assist:
        return False
    if "--accent: #1680f3" not in shell or "--accent-hover: #126fd4" not in shell:
        return False
    for token in ("--ink:", "--on-ink:", "--chrome:", "--pane:", "--text-100:", "--text-68:", "--text-56:", "--text-40:"):
        if token not in shell:
            return False
    if "100%" not in shell or "68%" not in shell or "56%" not in shell or "40%" not in shell:
        return False
    if "data-conversation-root" not in files[SHELL_TSX]:
        return False
    if "data-role-swatch" not in label or "ROLE_SWATCH" not in label:
        return False
    if "grid-template-rows: 0fr" not in skill_css or "grid-template-rows: 1fr" not in skill_css:
        return False
    if "transition: max-width 180ms ease" not in skill_css:
        return False
    if "data-open={open ? 'true' : 'false'}" not in skill:
        return False
    if "ComposerCodeNode" not in runtime or "bindComposerCodeEditor" not in runtime:
        return False
    if "$isComposerCodeNode" not in project:
        return False
    if "data-composer-code" not in code or "getTextContent" not in code:
        return False
    if "slice(0, 12)" not in code or "slice(0, 800)" not in code:
        return False
    if 'data-autoresize="content"' not in editable:
        return False
    if 'data-composer-embed="attachment"' not in input_tsx or "onInsertCode" not in input_tsx:
        return False
    if "data-send-state={empty ? 'empty' : 'ready'}" not in input_tsx:
        return False
    if "data-send-state='empty'" not in input_css or "data-send-state='ready'" not in input_css:
        return False
    if MARKER not in shell or MARKER not in code:
        return False
    return True


def _desk_ok(text):
    if text.count(MARKER) < 1:
        return False
    if NEED_USE_PATH not in text:
        return False
    if "function roleSwatch(" not in text:
        return False
    for preset_id, color in SWATCHES:
        if '"%s": "%s"' % (preset_id, color) not in text:
            return False
    if 'data-role-swatch' not in text or 'data-bubble' not in text:
        return False
    if "inset 3px 0 0 " not in text:
        return False
    if 'tr("asst.newSession")' not in text or 'tr("asst.setDefault")' not in text:
        return False
    if "background:#1c1c1c0f" not in text or "border:1px solid #1c1c1c14" not in text:
        return False
    if "canonPreset" in text:
        return False
    return True


def patch_dsh(root):
    rels = (
        BUBBLE_CSS, ASSIST_CSS, SHELL_CSS, SHELL_TSX, LABEL_TSX, LABEL_CSS,
        INPUT_TSX, INPUT_CSS, EDITABLE_TSX, RUNTIME_TS, PROJECT_TS, SKILL_TSX, SKILL_CSS,
    )
    paths = {rel: os.path.join(root, rel) for rel in rels}
    files = {rel: _read(path) for rel, path in paths.items()}
    code_path = os.path.join(root, CODE_TSX)
    if os.path.isfile(code_path):
        files[CODE_TSX] = _read(code_path)
    else:
        files[CODE_TSX] = ""
    if any(MARKER in text for text in files.values()):
        if not _dsh_ok(files):
            sys.exit("marker present but chat shell ui is incomplete")
        print("skip（已打）: dsh chat shell")
        return
    files[BUBBLE_CSS] = _replace_one(files[BUBBLE_CSS], OLD_BUBBLE, NEW_BUBBLE, BUBBLE_CSS)
    files[ASSIST_CSS] = _replace_one(files[ASSIST_CSS], OLD_ASSIST, NEW_ASSIST, ASSIST_CSS)
    files[SHELL_CSS] = TOKEN_BLOCK + _replace_one(files[SHELL_CSS], OLD_SHELL_BG, NEW_SHELL_BG, SHELL_CSS)
    files[SHELL_TSX] = _replace_one(files[SHELL_TSX], OLD_SHELL_DIV, NEW_SHELL_DIV, SHELL_TSX)
    files[LABEL_TSX] = _replace_one(files[LABEL_TSX], OLD_LABEL_IMPORT, NEW_LABEL_IMPORT, LABEL_TSX + " import")
    files[LABEL_TSX] = _replace_one(files[LABEL_TSX], OLD_LABEL_FN, NEW_LABEL_FN, LABEL_TSX + " fn")
    files[LABEL_TSX] = _replace_one(files[LABEL_TSX], OLD_LABEL_TAIL, NEW_LABEL_TAIL, LABEL_TSX + " tail")
    files[LABEL_CSS] = _replace_one(files[LABEL_CSS], OLD_LABEL_ICON, NEW_LABEL_ICON, LABEL_CSS)
    files[INPUT_TSX] = _replace_one(files[INPUT_TSX], OLD_INPUT_IMPORT, NEW_INPUT_IMPORT, INPUT_TSX + " import")
    files[INPUT_TSX] = _replace_one(files[INPUT_TSX], OLD_INPUT_RETURN, NEW_INPUT_RETURN, INPUT_TSX + " insert")
    files[INPUT_TSX] = _replace_one(files[INPUT_TSX], OLD_ATTACH, NEW_ATTACH, INPUT_TSX + " attach")
    files[INPUT_TSX] = _replace_one(files[INPUT_TSX], OLD_PLUS, NEW_PLUS, INPUT_TSX + " plus")
    files[INPUT_TSX] = _replace_one(files[INPUT_TSX], OLD_SEND, NEW_SEND, INPUT_TSX + " send")
    files[INPUT_CSS] = _replace_one(files[INPUT_CSS], OLD_CARD_BG, NEW_CARD_BG, INPUT_CSS + " pane")
    files[INPUT_CSS] = _replace_one(files[INPUT_CSS], OLD_PLACEHOLDER_COLOR, NEW_PLACEHOLDER_COLOR, INPUT_CSS + " placeholder")
    files[INPUT_CSS] = _replace_one(files[INPUT_CSS], OLD_PRIMARY_BG, NEW_PRIMARY_BG, INPUT_CSS + " accent")
    files[INPUT_CSS] = _replace_one(files[INPUT_CSS], OLD_PRIMARY_HOVER, NEW_PRIMARY_HOVER, INPUT_CSS + " hover")
    if not files[INPUT_CSS].endswith("\n"):
        files[INPUT_CSS] += "\n"
    files[INPUT_CSS] += INPUT_EXTRA
    files[EDITABLE_TSX] = _replace_one(files[EDITABLE_TSX], OLD_EDITABLE, NEW_EDITABLE, EDITABLE_TSX)
    files[RUNTIME_TS] = _replace_one(files[RUNTIME_TS], OLD_RUNTIME_IMPORT, NEW_RUNTIME_IMPORT, RUNTIME_TS + " import")
    files[RUNTIME_TS] = _replace_one(files[RUNTIME_TS], OLD_RUNTIME_NODES, NEW_RUNTIME_NODES, RUNTIME_TS + " nodes")
    files[PROJECT_TS] = _replace_one(files[PROJECT_TS], OLD_PROJECT_IMPORT, NEW_PROJECT_IMPORT, PROJECT_TS + " import")
    files[PROJECT_TS] = _replace_one(files[PROJECT_TS], OLD_PROJECT_WALK, NEW_PROJECT_WALK, PROJECT_TS + " walk")
    files[SKILL_CSS] = _replace_one(files[SKILL_CSS], OLD_SUMMARY, NEW_SUMMARY, SKILL_CSS + " summary")
    files[SKILL_CSS] = _replace_one(files[SKILL_CSS], OLD_TITLE, NEW_TITLE, SKILL_CSS + " title")
    files[SKILL_CSS] = _replace_one(files[SKILL_CSS], OLD_BODY, NEW_BODY, SKILL_CSS + " body")
    files[SKILL_CSS] = _replace_one(files[SKILL_CSS], OLD_HEADER_COLOR, NEW_HEADER_COLOR, SKILL_CSS + " header")
    files[SKILL_CSS] = _replace_one(files[SKILL_CSS], OLD_MOTION, NEW_MOTION, SKILL_CSS + " motion")
    files[SKILL_TSX] = _replace_one(files[SKILL_TSX], OLD_SKILL_BODY, NEW_SKILL_BODY, SKILL_TSX)
    files[CODE_TSX] = CODE_TSX_BODY
    files[CODE_CSS] = CODE_CSS_BODY
    if not _dsh_ok(files):
        sys.exit("chat shell ui failed its own check")
    for rel, text in files.items():
        _write(os.path.join(root, rel), text)
    print("ok: dsh chat shell")


def patch_desk(root):
    path = os.path.join(root, DESK)
    text = _read(path)
    if MARKER in text:
        if not _desk_ok(text):
            sys.exit("marker present but role swatches are incomplete")
        print("skip（已打）: desk role swatches")
        return
    if NEED_USE_PATH not in text:
        sys.exit("use path is missing; run dsh-features-connect-use-path.py first")
    text = _replace_one(text, OLD_ROLE_ICON, NEW_ROLE_ICON, DESK + " swatch")
    text = _replace_one(text, OLD_CARD, NEW_CARD, DESK + " card")
    text = _replace_one(text, OLD_LINKISH, NEW_LINKISH, DESK + " dot css")
    text = _replace_one(text, OLD_TX, NEW_TX, DESK + " bubble css")
    text = _replace_one(text, OLD_BOT_MSG, NEW_BOT_MSG, DESK + " bot msg")
    text = _replace_one(text, OLD_ROOM_MSG, NEW_ROOM_MSG, DESK + " room msg")
    if not _desk_ok(text):
        sys.exit("role swatches failed their own check")
    _write(path, text)
    print("ok: desk role swatches")


def main():
    dsh = os.environ.get("DSH_SRC", "").strip()
    anywork = os.environ.get("ANYWORK_SRC", "").strip()
    if not dsh and not anywork:
        sys.exit(
            "DSH_SRC or ANYWORK_SRC is required. Docker image build sets one per stage. "
            "This patch does not target a native install."
        )
    if dsh:
        patch_dsh(dsh)
    if anywork:
        patch_desk(anywork)


if __name__ == "__main__":
    main()
