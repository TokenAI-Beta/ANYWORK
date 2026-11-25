# -*- coding: utf-8 -*-
"""Docker image only: first paint loads the desk shell, then the rest.

On dsh-v0.2.1-rc.3 the host composes every web client bundle into
`/plugins/??…&rev=` combo scripts (packages/client/modules/src/index.ts).
`partitionComboRecords` splits a phase only when the combo URL exceeds
3072 bytes, and `bootInjections` preloads every `application` batch.
`bootClient` then waits until every loader entry is active. One dropped
response replaces the page with the HARNESS boot report
"Failed to load plugins".

The rc.3 web-app roster is 62 `dsh.client` packages. That URL budget is
two application preloads. The cut measured those responses at about
9MB and 4.5MB (still multi-MB gzipped). Official client source under
packages/client is about 6.42MB; the shell inject/external closure is
16 packages and about 1.82MB of that source. The other 46 packages
(about 4.60MB of source) plus third-party rows with an empty inject
list (dsh-desk-panel, dsh-client-ui-aqua, chat-import, better-sidebar)
are not needed to show the sidebar or New Session.

This patch, applied to the image's dsh clone before `pnpm build`:

- keeps bootstrap (`@deepseek-ai/dsh-client-modules`) and the shell
  closure on the first-paint path (`application` batches, still preloaded);
- marks every other row `deferred` and does not preload those batches;
- caps each combo at 768KiB uncompressed (a single plugin larger than
  that stays one request);
- mounts the desk once the shell entries are active;
- loads deferred rows after mount. A failure there is a retry bar
  (`data-dsh-plugin-retry`), not `page.fail`.

Shell items this patch does not edit: portal AC1b drawer close
(`src/portal.ts`), sidebar Usage registration (`desk-usage` /
`data-desk-usage-mount`), and More → Usage. DSH_REF stays
dsh-v0.2.1-rc.3. No Tokyo rollback path.

Cut 2026-10-30 plugin-lazy-retry (follow-up, same script):

- The retry bar calls ``activateDeferred`` again. ``retry()`` only
  reconciles, and a failed deferred row is already in ``managed``, so a
  second pass used to skip it. Non-ACTIVE deferred rows are removed from
  the loader first. ``@deepseek-ai/dsh-client-ui-settings-account`` and
  ``dsh-better-sidebar`` activate after the other deferred rows.
- Desktop onboarding art (~2.4MB of webp) is a package-local chunk,
  loaded when that overlay renders. The account entry (menu, Account)
  stays on the deferred combo and must fit under the 768KiB cap. Web
  does not mount the overlay, so the art is not a first-wave request.
  AccountMenu is not edited.

Invoked only from deploy/docker/Dockerfile with
DSH_SRC=/src/deepseek-harness. DSH_SRC is required.
"""
import os
import sys

MARKER = "cut 2026-10-30 plugin-lazy-first-paint"
RETRY_MARKER = "cut 2026-10-30 plugin-lazy-retry"

MANIFEST = "packages/client/modules/src/client/manifest.ts"
ACCOUNT = "packages/client/ui-settings-account/src/client/index.ts"
LAZY = "packages/client/ui-settings-account/src/client/LazyDesktopOnboardingEntry.tsx"
INDEX = "packages/client/modules/src/index.ts"
ENTRIES = "packages/client/modules/src/client/entries.ts"
BOOT = "packages/client/web/src/boot.ts"

PHASE_OLD = """export type WebBootBatchPhase = 'bootstrap' | 'application'"""
PHASE_NEW = """export type WebBootBatchPhase = 'bootstrap' | 'application' | 'deferred'"""

BATCH_DOC_OLD = """  /** Parser-blocking bootstrap or preloaded application scheduling. */
  phase: WebBootBatchPhase"""
BATCH_DOC_NEW = """  /** Parser-blocking bootstrap, preloaded shell, or post-entry deferred scheduling. */
  phase: WebBootBatchPhase"""

PLUGIN_ROW_OLD = """  /** Stage-one prefetch tier (false when the wire omits it). */
  immediately: boolean
}"""
PLUGIN_ROW_NEW = """  /** Stage-one prefetch tier (false when the wire omits it). */
  immediately: boolean
  /**
   * True when this row's combo is fetched after the desk shell mounts.
   * Absent or false keeps the historical load-before-mount path.
   */
  deferred?: boolean
}"""

PHASE_CHECK_OLD = """  const batchUrls = new Set<string>()
  for (const value of graph.batches as unknown[]) {"""
PHASE_CHECK_NEW = """  const batchUrls = new Set<string>()
  const deferredIds = new Set<string>()
  for (const value of graph.batches as unknown[]) {"""

PHASE_THROW_OLD = """    if (phase !== 'bootstrap' && phase !== 'application') {
      throw new Error(`client-modules: boot manifest batch phase must be "bootstrap" or "application", received ${JSON.stringify(phase)}`)
    }"""
PHASE_THROW_NEW = """    if (phase !== 'bootstrap' && phase !== 'application' && phase !== 'deferred') {
      throw new Error(`client-modules: boot manifest batch phase must be "bootstrap", "application", or "deferred", received ${JSON.stringify(phase)}`)
    }"""

STAMP_OLD = """      initialUrls.set(id, batch.url)
    }
  }
  const modules = moduleFields.map((row): BootModuleRow => {"""
STAMP_NEW = """      initialUrls.set(id, batch.url)
      if (phase === 'deferred') deferredIds.add(id)
    }
  }
  for (const plugin of plugins) {
    if (deferredIds.has(plugin.id)) plugin.deferred = true
  }
  const modules = moduleFields.map((row): BootModuleRow => {"""

BODY_CAP_OLD = """/** Generated request URLs stay below conservative browser and intermediary request-target limits. */
const MAX_COMBO_URL_BYTES = 3 * 1024"""
BODY_CAP_NEW = """/** Generated request URLs stay below conservative browser and intermediary request-target limits. */
const MAX_COMBO_URL_BYTES = 3 * 1024
/**
 * Uncompressed combo body cap (cut 2026-10-30 plugin-lazy-first-paint).
 * URL-only partitioning preloaded two multi-megabyte `/plugins/??` responses.
 * 768KiB is one mobile fetch. A single plugin larger than the cap is its own request.
 */
const MAX_COMBO_BODY_BYTES = 768 * 1024"""

PARTITION_OLD = """/** Partition one phase in graph order without allowing a generated URL above the protocol limit. */
function partitionComboRecords(records: readonly WebPluginRecord[]): WebPluginRecord[][] {
  const chunks: WebPluginRecord[][] = []
  let current: WebPluginRecord[] = []
  for (const record of records) {
    const candidate = [...current, record]
    if (projectedComboUrlBytes(candidate) <= MAX_COMBO_URL_BYTES) {
      current = candidate
      continue
    }
    if (current.length === 0) {
      throw new Error(
        `client-modules: ${record.entry.id} exceeds the ${String(MAX_COMBO_URL_BYTES)}-byte combo URL limit`,
      )
    }
    chunks.push(current)
    current = [record]
    if (projectedComboUrlBytes(current) > MAX_COMBO_URL_BYTES) {
      throw new Error(
        `client-modules: ${record.entry.id} exceeds the ${String(MAX_COMBO_URL_BYTES)}-byte combo URL limit`,
      )
    }
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}"""

PARTITION_NEW = """/**
 * Desk rows whose factories have to be registered before the sidebar and
 * New Session can mount. `immediately` rows and this list's inject/external
 * closure stay on the first-paint path. Every other client row is deferred.
 * Third-party packages with an empty inject list (desk-panel, aqua) are not
 * pulled in from the outside.
 */
const SHELL_ROOT_IDS = [
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-sidebar',
  '@deepseek-ai/dsh-client-ui-workspace',
  '@deepseek-ai/dsh-client-ui-session',
  '@deepseek-ai/dsh-client-ui-brand-official',
  '@deepseek-ai/dsh-client-shortcuts',
  '@deepseek-ai/dsh-client-ui-shortcuts',
] as const

function criticalEntryIds(records: readonly WebPluginRecord[]): Set<string> {
  const byId = new Map(records.map(record => [record.entry.id, record]))
  const stack: string[] = []
  for (const id of SHELL_ROOT_IDS) stack.push(id)
  for (const record of records) {
    if (record.meta.immediately) stack.push(record.entry.id)
  }
  const seen = new Set<string>()
  while (stack.length > 0) {
    const id = stack.pop()
    if (id === undefined || seen.has(id)) continue
    seen.add(id)
    const record = byId.get(id)
    if (record === undefined) continue
    for (const name of record.entry.inject ?? []) stack.push(name)
    for (const name of record.entry.external ?? []) {
      const bare = stripClientSuffix(name)
      if (byId.has(name)) stack.push(name)
      else if (byId.has(bare)) stack.push(bare)
    }
  }
  const critical = new Set<string>()
  for (const id of seen) if (byId.has(id)) critical.add(id)
  return critical
}

/** Partition one phase in graph order. URL limit and uncompressed body cap both split a combo. */
function partitionComboRecords(records: readonly WebPluginRecord[]): WebPluginRecord[][] {
  const chunks: WebPluginRecord[][] = []
  let current: WebPluginRecord[] = []
  let currentBytes = 0
  for (const record of records) {
    const bytes = record.bundle.length
    const candidate = [...current, record]
    const withinUrl = projectedComboUrlBytes(candidate) <= MAX_COMBO_URL_BYTES
    const withinBody = currentBytes + bytes <= MAX_COMBO_BODY_BYTES
    if (current.length > 0 && (!withinUrl || !withinBody)) {
      chunks.push(current)
      current = []
      currentBytes = 0
    }
    current = [...current, record]
    currentBytes += record.bundle.length
    if (current.length === 1 && projectedComboUrlBytes(current) > MAX_COMBO_URL_BYTES) {
      throw new Error(
        `client-modules: ${record.entry.id} exceeds the ${String(MAX_COMBO_URL_BYTES)}-byte combo URL limit`,
      )
    }
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}"""

COMPOSE_OLD = """    const bootstrap = PARSER_PRELOAD_IDS
      .map(id => this.table.get(id))
      .filter((record): record is WebPluginRecord => record !== undefined)
    const bootstrapIds = new Set(bootstrap.map(record => record.entry.id))
    const application = entries
      .filter(entry => !bootstrapIds.has(entry.id))
      .map(entry => this.table.get(entry.id))
      .filter((record): record is WebPluginRecord => record !== undefined)
    const artifacts: BatchArtifact[] = []
    for (const records of partitionComboRecords(bootstrap)) {
      artifacts.push(buildBatch('bootstrap', records, this.readSourceMap))
    }
    for (const records of partitionComboRecords(application)) {
      artifacts.push(buildBatch('application', records, this.readSourceMap))
    }"""

COMPOSE_NEW = """    const critical = criticalEntryIds([...this.table.values()])
    const bootstrap = PARSER_PRELOAD_IDS
      .map(id => this.table.get(id))
      .filter((record): record is WebPluginRecord => record !== undefined)
    const bootstrapIds = new Set(bootstrap.map(record => record.entry.id))
    const ordered = entries
      .map(entry => this.table.get(entry.id))
      .filter((record): record is WebPluginRecord => record !== undefined)
    const application = ordered.filter(record => !bootstrapIds.has(record.entry.id) && critical.has(record.entry.id))
    const deferred = ordered.filter(record => !bootstrapIds.has(record.entry.id) && !critical.has(record.entry.id))
    const artifacts: BatchArtifact[] = []
    for (const records of partitionComboRecords(bootstrap)) {
      artifacts.push(buildBatch('bootstrap', records, this.readSourceMap))
    }
    for (const records of partitionComboRecords(application)) {
      artifacts.push(buildBatch('application', records, this.readSourceMap))
    }
    // cut 2026-10-30 plugin-lazy-first-paint: not preloaded; fetched after mount.
    for (const records of partitionComboRecords(deferred)) {
      artifacts.push(buildBatch('deferred', records, this.readSourceMap))
    }"""

PRELOAD_OLD = """  const bootstrap = graph.batches.filter(batch => batch.phase === 'bootstrap')
  const application = graph.batches.filter(batch => batch.phase === 'application')
  const rows: IndexInjection[] = [{ kind: 'script', placement: 'head', text: queue }]
  for (const batch of application) {
    rows.push({ kind: 'script-preload', src: batch.url })
  }
  for (const batch of bootstrap) {
    rows.push({ kind: 'script-src', placement: 'head', src: batch.url })
  }"""
PRELOAD_NEW = """  const bootstrap = graph.batches.filter(batch => batch.phase === 'bootstrap')
  // Deferred batches stay out of the document head (cut 2026-10-30 plugin-lazy-first-paint).
  const application = graph.batches.filter(batch => batch.phase === 'application')
  const rows: IndexInjection[] = [{ kind: 'script', placement: 'head', text: queue }]
  for (const batch of application) {
    rows.push({ kind: 'script-preload', src: batch.url })
  }
  for (const batch of bootstrap) {
    rows.push({ kind: 'script-src', placement: 'head', src: batch.url })
  }"""

START_OLD = """      await Promise.all(this.desired.plugins.map(async ({ id }) => {
        await this.create(loader, id)
      }))"""
START_NEW = """      await Promise.all(this.desired.plugins.filter(row => row.deferred !== true).map(async ({ id }) => {
        await this.create(loader, id)
      }))"""

ACTIVATE_OLD = """  private publish(snapshot: ClientEntryState): void {"""
ACTIVATE_NEW = """  /**
   * Load rows kept off the first-paint path. Per-row failures stay on
   * {@link state} and do not reject, so a dropped script cannot replace the
   * desk.
   * A later pass drops non-ACTIVE deferred rows from the loader and fetches
   * them again. {@link retry} only reconciles, and the failed row is already
   * in {@link managed}, so it would not see them. Settings-account and
   * better-sidebar run last (cut 2026-10-30 plugin-lazy-retry).
   * @returns the deferred failures still outstanding after this pass.
   */
  async activateDeferred(): Promise<readonly { readonly id: string; readonly message: string }[]> {
    const loader = this.loader
    if (loader === undefined) throw new Error('client-modules: entries have not started')
    const deferred = this.desired.plugins.filter(row => row.deferred === true)
    const pending: Array<typeof deferred[number]> = []
    for (const row of deferred) {
      const entry = this.managed.get(row.id)
      if (entry?.fiber?.state === ACTIVE) continue
      if (entry !== undefined) {
        const fiber = entry.fiber
        loader.remove(entry.id)
        this.managed.delete(row.id)
        this.revisions.delete(row.id)
        removeOwnedStyles(row.id)
        while (fiber?.inertia !== undefined) await fiber.inertia
      }
      pending.push(row)
    }
    const late = (id: string): boolean =>
      id === '@deepseek-ai/dsh-client-ui-settings-account' || id === 'dsh-better-sidebar'
    pending.sort((left, right) => Number(late(left.id)) - Number(late(right.id)))
    if (pending.length === 0) return this.snapshot.failures
    const pendingIds = new Set(pending.map(row => row.id))
    this.publish({
      syncing: true,
      failures: this.snapshot.failures.filter(failure => !pendingIds.has(failure.id)),
    })
    const failures: { id: string; message: string }[] = []
    for (const row of pending) {
      try {
        await this.modules.prefetch(row.id)
        await this.create(loader, row.id)
      } catch (error) {
        failures.push({ id: row.id, message: error instanceof Error ? error.message : String(error) })
      }
    }
    await loader.await()
    for (const row of pending) {
      if (failures.some(failure => failure.id === row.id)) continue
      const entry = this.managed.get(row.id)
      if (entry?.fiber?.state === ACTIVE) continue
      failures.push({
        id: row.id,
        message: entry?.fiber === undefined
          ? `client-modules: ${row.id} import failed`
          : `client-modules: ${row.id} did not activate`,
      })
    }
    const next = [
      ...this.snapshot.failures.filter(failure => !pendingIds.has(failure.id)),
      ...failures,
    ]
    this.publish({ syncing: false, failures: next })
    return next
  }

  private publish(snapshot: ClientEntryState): void {"""

TOTAL_OLD = """      this.page.setTotal(this.manifest.plugins.length)"""
TOTAL_NEW = """      this.page.setTotal(this.manifest.plugins.filter(row => row.deferred !== true).length)"""

MOUNT_OLD = """      await mountClient(ctx, this.container)
    } catch (reason) {
      console.error(reason)
      if (onFailure !== undefined) onFailure(reason)
      else this.page.fail(reason instanceof Error ? reason.message : String(reason))
    }"""
MOUNT_NEW = """      await mountClient(ctx, this.container)
      // cut 2026-10-30 plugin-lazy-first-paint: shell is up. Deferred loads
      // must not reject into page.fail.
      void this.finishDeferred()
    } catch (reason) {
      console.error(reason)
      if (onFailure !== undefined) onFailure(reason)
      else this.page.fail(reason instanceof Error ? reason.message : String(reason))
    }"""

DISPOSE_OLD = """  /** Dispose the client plugin tree and whichever page owns the mount point. */
  async dispose(): Promise<void> {"""
DISPOSE_NEW = """  /** Fetch deferred plugins after the desk is mounted. Failures become a retry bar. */
  private async finishDeferred(): Promise<void> {
    try {
      const failures = await this.modules.entries.activateDeferred()
      if (failures.length > 0) this.showPluginRetry()
    } catch (error) {
      console.error(error)
      this.showPluginRetry()
    }
  }

  /** One retry bar. Not the HARNESS boot page: the desk stays mounted. */
  private showPluginRetry(): void {
    const doc = this.container.ownerDocument
    if (doc.getElementById('dsh-plugin-retry') !== null) return
    const bar = doc.createElement('div')
    bar.id = 'dsh-plugin-retry'
    bar.setAttribute('data-dsh-plugin-retry', '')
    bar.setAttribute('role', 'status')
    bar.style.cssText = 'position:fixed;z-index:80;left:12px;right:12px;bottom:12px;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:10px;background:#3a2a1a;color:#f4efe6;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)'
    const text = doc.createElement('span')
    text.textContent = 'Some plugins did not finish loading.'
    const button = doc.createElement('button')
    button.type = 'button'
    button.textContent = 'Retry'
    button.style.cssText = 'height:32px;padding:0 12px;border:0;border-radius:8px;background:#f4efe6;color:#3a2a1a;font:inherit;cursor:pointer'
    button.addEventListener('click', () => {
      button.disabled = true
      // cut 2026-10-30 plugin-lazy-retry: retry() only reconciles. Deferred
      // failures are already in managed, so the bar must activateDeferred again.
      void this.modules.entries.activateDeferred().then(left => {
        if (left.length === 0) bar.remove()
        else button.disabled = false
      }, () => {
        button.disabled = false
      })
    })
    bar.append(text, button)
    const body = doc.body
    if (body === null) return
    body.append(bar)
  }

  /** Dispose the client plugin tree and whichever page owns the mount point. */
  async dispose(): Promise<void> {"""

# Value import pulls the onboarding webp into client.js. Type-only stays erased.
ACCOUNT_IMPORT_OLD = """import { DesktopOnboardingEntry, type DesktopOnboardingInjected } from './DesktopOnboardingEntry.tsx'"""
ACCOUNT_IMPORT_NEW = """import type { DesktopOnboardingInjected } from './DesktopOnboardingEntry.tsx'
import { LazyDesktopOnboardingEntry } from './LazyDesktopOnboardingEntry.tsx'"""

ACCOUNT_REGISTER_OLD = """}, DesktopOnboardingEntry))"""
ACCOUNT_REGISTER_NEW = """}, LazyDesktopOnboardingEntry))"""

LAZY_BODY = """/** Load desktop onboarding art only when that overlay renders.
 * cut 2026-10-30 plugin-lazy-retry
 */
import { lazy, Suspense, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { DesktopOnboardingInjected } from './DesktopOnboardingEntry.tsx'

const LoadedDesktopOnboardingEntry = lazy(async () => ({
  default: (await import('./DesktopOnboardingEntry.tsx')).DesktopOnboardingEntry,
}))

/**
 * Suspend while the package-local onboarding chunk arrives.
 * Web never mounts this, so the ~2.4MB webp stay off the deferred combo.
 * @param props - shell overlay bindings and account-owned actions.
 * @returns the deferred desktop introduction.
 */
export function LazyDesktopOnboardingEntry(
  props: PropsRuntime<'shell.overlay'> & PropsLocale<'settings.account'> & InjectFace<DesktopOnboardingInjected>,
): ReactNode {
  return <Suspense fallback={null}><LoadedDesktopOnboardingEntry {...props} /></Suspense>
}
"""

EDITS = [
    (MANIFEST, PHASE_OLD, PHASE_NEW),
    (MANIFEST, BATCH_DOC_OLD, BATCH_DOC_NEW),
    (MANIFEST, PLUGIN_ROW_OLD, PLUGIN_ROW_NEW),
    (MANIFEST, PHASE_CHECK_OLD, PHASE_CHECK_NEW),
    (MANIFEST, PHASE_THROW_OLD, PHASE_THROW_NEW),
    (MANIFEST, STAMP_OLD, STAMP_NEW),
    (INDEX, BODY_CAP_OLD, BODY_CAP_NEW),
    (INDEX, PARTITION_OLD, PARTITION_NEW),
    (INDEX, COMPOSE_OLD, COMPOSE_NEW),
    (INDEX, PRELOAD_OLD, PRELOAD_NEW),
    (ENTRIES, START_OLD, START_NEW),
    (ENTRIES, ACTIVATE_OLD, ACTIVATE_NEW),
    (BOOT, TOTAL_OLD, TOTAL_NEW),
    (BOOT, MOUNT_OLD, MOUNT_NEW),
    (BOOT, DISPOSE_OLD, DISPOSE_NEW),
    (ACCOUNT, ACCOUNT_IMPORT_OLD, ACCOUNT_IMPORT_NEW),
    (ACCOUNT, ACCOUNT_REGISTER_OLD, ACCOUNT_REGISTER_NEW),
]


def require_src():
    src = os.environ.get("DSH_SRC", "").strip()
    if not src:
        sys.exit("DSH_SRC is required (the deepseek-harness checkout to patch)")
    if not os.path.isdir(src):
        sys.exit(f"DSH_SRC is not a directory: {src}")
    return src


def apply_edit(src, rel, old, new):
    path = os.path.join(src, rel)
    if not os.path.isfile(path):
        sys.exit(f"missing {rel}")
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        sys.exit(f"{rel}: expected 1 anchor for edit, found {count}")
    text = text.replace(old, new, 1)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)


def read(src, rel):
    with open(os.path.join(src, rel), encoding="utf-8") as handle:
        return handle.read()


def write_lazy(src):
    path = os.path.join(src, LAZY)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    current = ""
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as handle:
            current = handle.read()
    if current == LAZY_BODY:
        return
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(LAZY_BODY)


def check_account_bundle(src):
    """Fail the image build if the account entry is still one multi-MB deferred script."""
    lib = os.path.join(src, "packages/client/ui-settings-account/lib")
    entry = os.path.join(lib, "client.js")
    if not os.path.isfile(entry):
        sys.exit(f"missing {entry}")
    cap = 768 * 1024
    size = os.path.getsize(entry)
    with open(entry, encoding="utf-8", errors="replace") as handle:
        text = handle.read()
    if size > cap:
        sys.exit(
            f"settings-account client.js is {size} bytes, over the {cap}-byte deferred combo cap"
        )
    if "data:image/webp;base64," in text:
        sys.exit("settings-account client.js still inlines onboarding webp")
    art = []
    if os.path.isdir(lib):
        for name in sorted(os.listdir(lib)):
            if name == "client.js" or not name.endswith(".js") or not name.startswith("client."):
                continue
            path = os.path.join(lib, name)
            with open(path, encoding="utf-8", errors="replace") as handle:
                if "data:image/webp;base64," in handle.read():
                    art.append(name)
    if not art:
        sys.exit("settings-account onboarding art chunk was not emitted")
    print(f"settings-account client.js is {size} bytes; onboarding art is a separate chunk")


def verify(src):
    manifest = read(src, MANIFEST)
    index = read(src, INDEX)
    entries = read(src, ENTRIES)
    boot = read(src, BOOT)
    account = read(src, ACCOUNT)
    lazy = read(src, LAZY)
    checks = [
        (manifest, "export type WebBootBatchPhase = 'bootstrap' | 'application' | 'deferred'"),
        (manifest, "deferred?: boolean"),
        (manifest, "const deferredIds = new Set<string>()"),
        (manifest, "if (phase === 'deferred') deferredIds.add(id)"),
        (manifest, "phase !== 'deferred'"),
        (index, "const MAX_COMBO_BODY_BYTES = 768 * 1024"),
        (index, "'@deepseek-ai/dsh-client-ui-workspace'"),
        (index, "'@deepseek-ai/dsh-client-ui-sidebar'"),
        (index, "function criticalEntryIds("),
        (index, "buildBatch('deferred', records, this.readSourceMap)"),
        (index, "critical.has(record.entry.id)"),
        (index, "batch.phase === 'application'"),
        (entries, "row.deferred !== true"),
        (entries, "async activateDeferred()"),
        (boot, "row.deferred !== true"),
        (boot, "void this.finishDeferred()"),
        (boot, "data-dsh-plugin-retry"),
        (boot, "Some plugins did not finish loading."),
        (boot, MARKER),
        (boot, RETRY_MARKER),
        (entries, "loader.remove(entry.id)"),
        (entries, "entry?.fiber?.state === ACTIVE"),
        (entries, "'@deepseek-ai/dsh-client-ui-settings-account'"),
        (entries, "'dsh-better-sidebar'"),
        (entries, RETRY_MARKER),
        (account, "LazyDesktopOnboardingEntry"),
        (lazy, "import('./DesktopOnboardingEntry.tsx')"),
        (lazy, RETRY_MARKER),
    ]
    for text, needle in checks:
        if needle not in text:
            sys.exit(f"patched tree is missing {needle!r}")
    if "dsh-desk-panel" in index or "data-desk-usage-mount" in index:
        sys.exit("lazy-load patch must not special-case desk usage")
    finish = boot.split("private async finishDeferred()", 1)[1].split("private showPluginRetry()", 1)[0]
    if "page.fail" in finish:
        sys.exit("deferred loader calls page.fail")
    if "this.page.fail(" not in boot:
        sys.exit("critical boot failure no longer reaches the HARNESS page")
    if "for (const batch of application)" not in index:
        sys.exit("shell batches are no longer preloaded")
    preload_loop = index.split("for (const batch of application)", 1)[1].split("for (const batch of bootstrap)", 1)[0]
    if "deferred" in preload_loop:
        sys.exit("application preload loop mentions deferred batches")
    click = boot.split("button.addEventListener('click'", 1)[1].split("bar.append", 1)[0]
    if ".retry()" in click:
        sys.exit("plugin retry bar still calls retry()")
    if "activateDeferred()" not in click:
        sys.exit("plugin retry bar does not call activateDeferred")
    if "import { DesktopOnboardingEntry" in account:
        sys.exit("settings-account still statically imports the onboarding art graph")
    if "dsh-better-sidebar" in index or "ui-settings-account" in index:
        sys.exit("lazy-load patch must not pull account or better-sidebar into the shell closure")


def main():
    src = require_src()
    if "--check-account-bundle" in sys.argv:
        check_account_bundle(src)
        return
    for rel, old, new in EDITS:
        apply_edit(src, rel, old, new)
    write_lazy(src)
    verify(src)
    print(f"{MARKER}: shell combos stay on first paint; other plugins load after mount")
    print(f"{RETRY_MARKER}: retry re-activates deferred rows; account art is its own chunk")


if __name__ == "__main__":
    main()
