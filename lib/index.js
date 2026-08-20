/**
 * dsh-trust — audit the plugins installed in this DeepSeek Harness profile.
 *
 * Registers the `audit_plugins` tool: deterministically enumerates the
 * profile's user-installed bundles and reports risk signals per plugin
 * (install-time scripts, `!!js` config expressions, inject capability surface,
 * third-party dependency count). Static and deterministic — no LLM, no network.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { enumeratePlugins, profileDirFromCtx } from './audit.js'
import { registerAuditRoute } from './route.js'

export const name = 'dsh-trust'
export const inject = ['tools']

function flag(risk) {
  return risk === 'critical' ? '🔴' : risk === 'suspicious' ? '🟡' : '🟢'
}

function renderText(result) {
  const { plugins, summary } = result
  const lines = [
    `Audited ${summary.total} third-party plugin(s) — critical: ${summary.critical}, suspicious: ${summary.suspicious}, clean: ${summary.clean}`,
    `profile: ${summary.profileDir}`,
  ]
  for (const p of plugins) {
    lines.push('')
    if (p.error) {
      lines.push(`${flag(p.risk)} ${p.name} — ${p.error}`)
      continue
    }
    lines.push(`${flag(p.risk)} ${p.name}@${p.version} [${p.risk}]`)
    if (p.installScripts.length > 0) lines.push(`  install-scripts: ${p.installScripts.join(', ')}`)
    if (p.hostInject.length > 0) lines.push(`  host-inject: ${p.hostInject.join(', ')}`)
    if (p.clientInject.length > 0) lines.push(`  client-inject: ${p.clientInject.join(', ')}`)
    if (p.patch) {
      const patchDesc = p.patch.missing
        ? 'missing'
        : `insert=${p.patch.insertCount} disable=${p.patch.disableCount} jsExpr=${p.patch.hasJsExpr}`
      lines.push(`  patch: ${patchDesc}`)
    }
    if (p.thirdPartyDependencyCount > 0) lines.push(`  third-party deps: ${p.thirdPartyDependencyCount}`)
    if (p.drift) {
      if (p.drift.status === 'new') lines.push('  drift: new (baseline recorded)')
      else if (p.drift.status === 'drifted') {
        if (p.drift.added.length > 0) lines.push(`  drift: added ${p.drift.added.join(', ')}`)
        if (p.drift.removed.length > 0) lines.push(`  drift: removed ${p.drift.removed.join(', ')}`)
        if (p.drift.changed.length > 0) lines.push(`  drift: version-changed ${p.drift.changed.join(', ')}`)
      }
    }
    for (const f of p.findings) {
      lines.push(`  ${f.severity === 'critical' ? '🔴' : '🟡'} ${f.message}`)
    }
  }
  return lines.join('\n')
}

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'audit_plugins',
    description:
      'Audit the third-party plugins currently installed in this DeepSeek Harness profile. Deterministically ' +
      'reads each bundle\'s package.json and cordis.patch.yml and reports risk signals: install-time scripts, ' +
      '`!!js` config expressions (arbitrary code at load time), host/client inject capability surface, and ' +
      'third-party dependency count. Returns a risk level (critical / suspicious / clean) per plugin. ' +
      'Static and deterministic — no LLM, no network.',
    parameters: {
      profile: {
        type: 'string',
        description: 'Optional profile name to audit instead of the current one (e.g. "web" or "headless").',
      },
      updateBaseline: {
        type: 'boolean',
        description: 'When true, re-baseline every plugin to its current dependencies (accept any drift as the new known-good state). Default false.',
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: renderText(value) }],
    },
    execute: async args => {
      const profileDir = profileDirFromCtx(ctx, args?.profile)
      const plugins = enumeratePlugins(profileDir, { updateBaseline: args?.updateBaseline === true })
      const count = risk => plugins.filter(p => p.risk === risk).length
      return {
        plugins,
        summary: {
          profileDir,
          total: plugins.length,
          critical: count('critical'),
          suspicious: count('suspicious'),
          clean: count('clean'),
        },
      }
    },
  }))
  registerAuditRoute(ctx)
}
