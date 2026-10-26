# -*- coding: utf-8 -*-
"""Docker image only: alias the six old team preset ids onto the four cards.

dsh-v0.2.1-rc.3 resolves a session's stored agentPreset through
AgentPresetRegistry. Directory names are not scanned. This patch maps the
old ids at resolve / retain / read / select / defaultId so an existing
session keeps running, while list() still returns only presets that were
registered (the four named cards plus the unnamed engine modes).

Blank selectedDefault, and team-assistant, become collab-default when that
preset is registered. The other five old ids follow the same map. An
explicit standard (or any id that is not one of the six) is left as-is.
If the target card is not registered, defaultId falls back to config.default
so a profile without the team plugin still starts.

Runs after dsh-agent-preset-mode-hint.py and before pnpm build.
DSH_SRC is required. There is no home-directory default.
"""
import io
import os
import sys

MARKER = "cut 2026-10-27 presets-template-redesign"
TARGET = "packages/preset/agent-preset-registry/src/index.ts"

OLD_DEFAULT = """  /** Default preset for a subsequently created session. */
  get defaultId(): string { return this.config.selectedDefault.get() ?? this.config.default }
"""

NEW_DEFAULT = """  /** Old shipped preset ids. Read-time remap; list() stays the registered cards.
   * cut 2026-10-27 presets-template-redesign
   */
  private canonPreset(id: string): string {
    const alias: Readonly<Record<string, string>> = {
      'team-assistant': 'collab-default',
      'research-assistant': 'research-report',
      'doc-writer': 'formal-docs',
      'meeting-secretary': 'formal-docs',
      'data-organizer': 'eng-codex',
      'dev-partner': 'eng-codex',
    }
    return alias[id] ?? id
  }

  /** Default preset for a subsequently created session.
   * Blank becomes collab-default when that card is registered.
   * The six old ids follow canonPreset. explicit standard stays standard.
   */
  get defaultId(): string {
    const selected = this.config.selectedDefault.get()
    const raw = selected == null || String(selected).trim() === '' ? '' : String(selected).trim()
    if (raw === '') return this.definitions.has('collab-default') ? 'collab-default' : this.config.default
    const mapped = this.canonPreset(raw)
    if (mapped !== raw && !this.definitions.has(mapped)) return this.config.default
    return mapped
  }
"""

OLD_RESOLVE = """  async resolve(id?: string): Promise<AgentPreset> {
    const wanted = id ?? this.defaultId
"""
NEW_RESOLVE = """  async resolve(id?: string): Promise<AgentPreset> {
    const wanted = this.canonPreset(id ?? this.defaultId)
"""

OLD_RETAIN = """  private async retain(id?: string): Promise<Generation> {
    const wanted = id ?? this.defaultId
"""
NEW_RETAIN = """  private async retain(id?: string): Promise<Generation> {
    const wanted = this.canonPreset(id ?? this.defaultId)
"""

OLD_READ = """  readDocument(agentPreset: string): Promise<AgentPresetDocument> {
    const record = this.definitions.get(agentPreset)
    if (record === undefined) {
      return Promise.reject(new RemoteError('agent-preset/not-found', `Unknown agent preset: ${agentPreset}`,
        { agentPreset, available: [...this.definitions.keys()] }))
    }
"""
NEW_READ = """  readDocument(agentPreset: string): Promise<AgentPresetDocument> {
    const wanted = this.canonPreset(agentPreset)
    const record = this.definitions.get(wanted)
    if (record === undefined) {
      return Promise.reject(new RemoteError('agent-preset/not-found', `Unknown agent preset: ${wanted}`,
        { agentPreset: wanted, available: [...this.definitions.keys()] }))
    }
"""

OLD_SELECT = """      const current = this.definitions.get(agentPreset)?.generation
      if (current !== undefined && this.generationFor(agent.ctx) === current
        && this.owner.sessionProjections.stateOf(agent.session, 'agentPreset') === agentPreset) return agentPreset
      const preset = await this.recompose(agent.ctx, agentPreset)
"""
NEW_SELECT = """      const wanted = this.canonPreset(agentPreset)
      const current = this.definitions.get(wanted)?.generation
      if (current !== undefined && this.generationFor(agent.ctx) === current
        && this.owner.sessionProjections.stateOf(agent.session, 'agentPreset') === wanted) return wanted
      const preset = await this.recompose(agent.ctx, wanted)
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


def _ok(text):
    if text.count("private canonPreset(id: string)") != 1:
        return False
    if text.count("this.canonPreset(id ?? this.defaultId)") != 2:
        return False
    if text.count("this.canonPreset(agentPreset)") != 2:
        return False
    if text.count("this.canonPreset(raw)") != 1:
        return False
    if text.count("this.definitions.has('collab-default')") != 1:
        return False
    if "const wanted = id ?? this.defaultId" in text:
        return False
    for pair in (
        "'team-assistant': 'collab-default'",
        "'research-assistant': 'research-report'",
        "'doc-writer': 'formal-docs'",
        "'meeting-secretary': 'formal-docs'",
        "'data-organizer': 'eng-codex'",
        "'dev-partner': 'eng-codex'",
    ):
        if pair not in text:
            return False
    if "'standard':" in text:
        return False
    return MARKER in text


def main():
    root = os.environ.get("DSH_SRC", "").strip()
    if not root:
        sys.exit(
            "DSH_SRC is required. Docker image build sets it to the clone inside the image. "
            "This patch does not target a native install."
        )
    path = os.path.join(root, TARGET)
    text = _read(path)
    if MARKER in text:
        if not _ok(text):
            sys.exit("marker present but preset alias is incomplete")
        print("skip（已打）:", TARGET)
        return
    text = _replace_one(text, OLD_DEFAULT, NEW_DEFAULT, "defaultId")
    text = _replace_one(text, OLD_RESOLVE, NEW_RESOLVE, "resolve")
    text = _replace_one(text, OLD_RETAIN, NEW_RETAIN, "retain")
    text = _replace_one(text, OLD_READ, NEW_READ, "readDocument")
    text = _replace_one(text, OLD_SELECT, NEW_SELECT, "select")
    if not _ok(text):
        sys.exit("preset alias failed its own check")
    io.open(path, "w", encoding="utf-8").write(text)
    print("ok:", TARGET)


if __name__ == "__main__":
    main()
