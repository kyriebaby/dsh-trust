/**
 * dsh-trust — deterministic audit core for installed DSH plugins.
 *
 * Reads a profile's package.json to find user-installed bundles (any bundle
 * name not under the `@deepseek-ai/` scope), resolves each package root, then
 * derives risk signals from its package.json and cordis.patch.yml. Purely
 * filesystem-based and deterministic: no LLM, no network.
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'

/** Lifecycle scripts that run arbitrary code at install time. */
const LIFECYCLE_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepare', 'preuninstall', 'postuninstall']

/** Host-side services whose presence in a plugin's `inject` implies host reach. */
const HIGH_CAPABILITY_INJECT = ['subprocess', 'shell', 'dynamicCordisRunner', 'loader', 'sandboxPolicy', 'credentials']

/** Wide supply-chain threshold: more third-party deps than this flags a suspicious surface. */
const SUPPLY_CHAIN_WARN = 10

/**
 * Resolve the profile directory from the runtime context.
 * The harness loader sets `ctx.baseUrl` to the profile directory as a file URL
 * (see `packages/boot/app-boot`); fall back to `$DSH_HOME/profiles/<profile>`
 * or `~/.dsh/profiles/web` when absent.
 * @param ctx - the cordis context passed to `apply`.
 * @param explicitProfile - optional profile name override from tool arguments.
 */
export function profileDirFromCtx(ctx, explicitProfile) {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  if (explicitProfile) return join(home, 'profiles', explicitProfile)
  if (ctx && typeof ctx.baseUrl === 'string' && ctx.baseUrl !== '') {
    try {
      return fileURLToPath(ctx.baseUrl)
    } catch {
      // fall through to the default below
    }
  }
  return join(home, 'profiles', 'web')
}

/** Read the profile manifest's `dsh.profile.bundles` and return user-installed bundle names. */
function thirdPartyBundleNames(profileDir) {
  const manifestPath = join(profileDir, 'package.json')
  if (!existsSync(manifestPath)) return []
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const bundles = manifest.dsh?.profile?.bundles ?? []
  return bundles.filter(name => !name.startsWith('@deepseek-ai/'))
}

/** Resolve an installed package's real root via node module resolution (pnpm-symlink safe). */
function resolvePackageRoot(profileDir, packageName) {
  try {
    const rq = createRequire(join(profileDir, '__dsh_trust_probe__.js'))
    return dirname(rq.resolve(`${packageName}/package.json`))
  } catch {
    return undefined
  }
}

/** Detect `!!js` expressions and count insert/disable entries in a patch file. */
function analyzePatch(patchPath) {
  if (!existsSync(patchPath)) return { hasJsExpr: false, insertCount: 0, disableCount: 0, missing: true }
  const text = readFileSync(patchPath, 'utf8')
  return {
    // `!!js` config expressions run arbitrary code at load time (not `!js`,
    // which is the disabled-expression marker).
    hasJsExpr: /!!js/.test(text),
    insertCount: (text.match(/insert\s*:/g) ?? []).length,
    disableCount: (text.match(/disable\s*:/g) ?? []).length,
    missing: false,
  }
}

/** Baseline snapshot file (per profile): last-known-good dependency map per plugin. */
const BASELINE_FILENAME = '.dsh-trust-baseline.json'

/** Load the dependency baseline, tolerating a missing or malformed file. */
function loadBaseline(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** Persist the baseline; a failed write degrades drift detection to "new" each run, never blocks. */
function saveBaseline(path, data) {
  try {
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 })
  } catch {
    // non-fatal — drift detection falls back to treating plugins as new
  }
}

/** Diff two dependency maps; returns added / removed / version-changed names. */
function diffDeps(current, prev) {
  const added = Object.keys(current).filter(k => !(k in prev))
  const removed = Object.keys(prev).filter(k => !(k in current))
  const changed = Object.keys(current).filter(k => k in prev && current[k] !== prev[k])
  return { added, removed, changed }
}

/** Best-effort extraction of the host plugin's `inject` array from its entry module. */
function findHostInject(root, pkg) {
  const entry = pkg.main ?? pkg.exports?.['.']?.default ?? pkg.exports?.['.']?.import ?? 'lib/index.js'
  const candidates = [join(root, entry)]
  if (entry !== 'lib/index.js') candidates.push(join(root, 'lib/index.js'))
  for (const path of candidates) {
    if (!existsSync(path)) continue
    try {
      const text = readFileSync(path, 'utf8')
      const match = /inject\s*=\s*\[([^\]]*)\]/.exec(text)
      if (match) {
        return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1])
      }
    } catch {
      // unreadable entry — skip
    }
  }
  return []
}

/** Analyze one installed plugin package and return its risk card. */
export function analyzePlugin(root, fallbackName) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const name = pkg.name ?? fallbackName
  const version = pkg.version ?? 'unknown'

  const installScripts = LIFECYCLE_SCRIPTS.filter(s => typeof pkg.scripts?.[s] === 'string')

  const bundle = pkg.dsh?.bundle
  const client = pkg.dsh?.client

  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) }
  const thirdPartyDeps = Object.keys(deps).filter(d => !d.startsWith('@deepseek-ai/'))

  const patch = bundle?.patch ? analyzePatch(join(root, bundle.patch)) : null
  const hostInject = findHostInject(root, pkg)

  const findings = []
  if (patch?.hasJsExpr) {
    findings.push({ severity: 'critical', kind: 'js-expr', message: 'cordis.patch.yml uses !!js — arbitrary code runs at plugin load time' })
  }
  const runtimeInstallScripts = installScripts.filter(s => s === 'install' || s === 'postinstall' || s === 'preinstall')
  if (runtimeInstallScripts.length > 0) {
    findings.push({ severity: 'critical', kind: 'install-script', message: `install-time scripts run: ${runtimeInstallScripts.join(', ')}` })
  } else if (installScripts.includes('prepare')) {
    findings.push({ severity: 'suspicious', kind: 'prepare-script', message: 'prepare script runs at install time' })
  }
  const high = hostInject.filter(s => HIGH_CAPABILITY_INJECT.includes(s))
  if (high.length > 0) {
    findings.push({ severity: 'suspicious', kind: 'high-capability-inject', message: `host inject includes: ${high.join(', ')}` })
  }
  if (thirdPartyDeps.length > SUPPLY_CHAIN_WARN) {
    findings.push({ severity: 'suspicious', kind: 'wide-supply-chain', message: `${thirdPartyDeps.length} third-party dependencies` })
  }

  const risk = findings.some(f => f.severity === 'critical') ? 'critical'
    : findings.some(f => f.severity === 'suspicious') ? 'suspicious'
      : 'clean'

  return {
    name,
    version,
    isThirdParty: true,
    hasBundle: bundle !== undefined && bundle !== null,
    clientInject: Array.isArray(client?.inject) ? client.inject : [],
    installScripts,
    thirdPartyDependencyCount: thirdPartyDeps.length,
    thirdPartyDependencies: thirdPartyDeps,
    dependencies: { ...(pkg.dependencies ?? {}) },
    hostInject,
    patch: patch === null ? null : {
      hasJsExpr: patch.hasJsExpr,
      insertCount: patch.insertCount,
      disableCount: patch.disableCount,
      missing: patch.missing,
    },
    findings,
    risk,
  }
}

/**
 * Enumerate and audit every user-installed plugin in a profile.
 * @param profileDir - absolute profile directory.
 * @param options - `{ updateBaseline }`: when true, re-baselines every plugin to
 *   its current dependency set (accepting any drift as the new known-good state).
 * @returns one risk card per third-party bundle, each with a `drift` field.
 */
export function enumeratePlugins(profileDir, options = {}) {
  const updateBaseline = options.updateBaseline === true
  const baselinePath = join(profileDir, BASELINE_FILENAME)
  const baseline = loadBaseline(baselinePath)
  let baselineChanged = false

  const names = thirdPartyBundleNames(profileDir)
  const cards = names.map(name => {
    const root = resolvePackageRoot(profileDir, name)
    if (root === undefined) {
      return { name, version: 'unknown', error: 'could not resolve package root', risk: 'suspicious', findings: [{ severity: 'suspicious', kind: 'unresolvable', message: 'listed in dsh.profile.bundles but package root could not be resolved' }] }
    }
    let card
    try {
      card = analyzePlugin(root, name)
    } catch (err) {
      return { name, version: 'unknown', error: String(err), risk: 'suspicious', findings: [{ severity: 'suspicious', kind: 'analysis-error', message: String(err) }] }
    }

    const currentDeps = card.dependencies ?? {}
    const prev = baseline[name]
    if (updateBaseline) {
      baseline[name] = { version: card.version, deps: { ...currentDeps } }
      baselineChanged = true
      card.drift = { status: 'unchanged', added: [], removed: [], changed: [] }
    } else if (prev === undefined) {
      // First observation of this plugin: record baseline, no drift to report.
      baseline[name] = { version: card.version, deps: { ...currentDeps } }
      baselineChanged = true
      card.drift = { status: 'new', added: Object.keys(currentDeps), removed: [], changed: [] }
    } else {
      const d = diffDeps(currentDeps, prev.deps ?? {})
      card.drift = (d.added.length > 0 || d.removed.length > 0 || d.changed.length > 0)
        ? { status: 'drifted', ...d }
        : { status: 'unchanged', added: [], removed: [], changed: [] }
      if (d.added.length > 0) {
        card.findings.push({ severity: 'suspicious', kind: 'dependency-drift', message: `dependencies added since last audit: ${d.added.join(', ')}` })
      }
    }

    card.risk = card.findings.some(f => f.severity === 'critical') ? 'critical'
      : card.findings.some(f => f.severity === 'suspicious') ? 'suspicious' : 'clean'
    return card
  })

  if (baselineChanged) saveBaseline(baselinePath, baseline)
  return cards
}
