// Static SoT gates for dsh-client-ui-aqua@1.4.1 against dsh-v0.2.1-rc.3.
// Does not install the plugin and does not talk to Docker.
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const client = readFileSync(join(root, 'lib/client.js'), 'utf8')
const index = readFileSync(join(root, 'lib/index.js'), 'utf8')
const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
const names = readdirSync(root, { recursive: true }).map(String)

const failures = []
const fail = (message) => { failures.push(message) }

if (pkg.name !== 'dsh-client-ui-aqua') fail(`name is ${pkg.name}`)
if (pkg.version !== '1.4.1') fail(`version is ${pkg.version}`)
if (typeof pkg.engines?.dsh !== 'string') fail('engines.dsh is not a string')
if (pkg.engines?.dsh !== '>=0.2.1-rc.3 <0.3.0') fail(`engines.dsh is ${pkg.engines?.dsh}`)
if (pkg.peerDependencies && Object.hasOwn(pkg.peerDependencies, '@deepseek-ai/dsh-invariants')) {
  fail('peerDependencies includes @deepseek-ai/dsh-invariants')
}
if (pkg.exports && Object.hasOwn(pkg.exports, './invariant')) fail('exports ./invariant')
if (names.some((name) => name.endsWith('invariant.js') || name.endsWith('invariant.d.ts'))) {
  fail(`invariant file shipped: ${names.filter((name) => name.includes('invariant')).join(', ')}`)
}

const sources = `${client}\n${index}\n${patch}\n${JSON.stringify(pkg)}`
if (sources.includes('@deepseek-ai/dsh-invariants')) fail('source still names @deepseek-ai/dsh-invariants')
if (sources.includes("['invariants']") || sources.includes('["invariants"]')) {
  fail("source still has inject: ['invariants']")
}
if (client.includes('settings.plugin.item') || patch.includes('settings.plugin.item') || JSON.stringify(pkg).includes('settings.plugin.item')) {
  fail('settings.plugin.item is still registered or declared')
}
if (!client.includes('name: "settings.general.item"')) fail('master/knobs row is not on settings.general.item')
if (!client.includes('id: "aqua-toggle"')) fail('master switch id aqua-toggle missing')

const activity = 'data-composer-stat=\\"activity\\"'
const usage = 'data-composer-stat=\\"usage\\"'
if (!client.includes(activity) || !client.includes(usage)) {
  fail('glass CSS/seam does not name activity and usage controls')
}
const obsolete = '[data-slot=\\"conversation.composer.dock\\"] [class*=\\"root\\"]'
if (client.includes(obsolete)) fail('obsolete dock root selector still present')
if (!client.includes('[data-slot=\\"conversation.composer.dock\\"]')) {
  fail('dock slot selector missing')
}

if (failures.length > 0) {
  for (const message of failures) console.error(`fail: ${message}`)
  process.exit(1)
}

// rc.3 shell seed keys (dsh-client-web PLATFORM_MODULES). require() must hit
// these exact strings. A trailing /client is NOT folded onto a seed.
const PLATFORM_MODULES = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  'zod',
  '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])
const requires = [...client.matchAll(/require\((["'])([^"']+)\1\)/g)].map((match) => match[2])
if (requires.length === 0) fail('client bundle has no require() calls')
for (const spec of requires) {
  if (!PLATFORM_MODULES.has(spec)) fail(`require("${spec}") is not an rc.3 platform seed`)
}
if (requires.includes('@deepseek-ai/dsh-client-runtime/client')) {
  fail('still requires @deepseek-ai/dsh-client-runtime/client')
}
if (!requires.includes('@deepseek-ai/dsh-client-store')) fail('defineStore seed @deepseek-ai/dsh-client-store is not required')
if (client.includes('@deepseek-ai/dsh-client-runtime')) fail('client still names dsh-client-runtime')
const inject = pkg.dsh?.client?.inject
if (!Array.isArray(inject) || inject.length !== 0) fail(`dsh.client.inject should be [] like desk-panel, got ${JSON.stringify(inject)}`)
if (pkg.dsh?.client?.external !== undefined) fail('seed requires must not be listed in dsh.client.external')

console.log('ac0 ok dsh-client-ui-aqua@1.4.1 engines.dsh=' + pkg.engines.dsh + ' requires=' + requires.join(','))
