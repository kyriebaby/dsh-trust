/**
 * dsh-trust browser half — plugin security audit tab in Web Settings.
 *
 * Registers a "安全审计" tab into the `settings.plugins.tab` slot and polls
 * the host `/trust/audit.json` endpoint (the same data the `audit_plugins`
 * tool returns). Read-only: no mutation, no install/remove actions.
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export const inject = ['slots']

type Risk = 'critical' | 'suspicious' | 'clean'

interface Finding {
  severity: 'critical' | 'suspicious'
  kind: string
  message: string
}

interface Plugin {
  name: string
  version: string
  risk: Risk
  installScripts?: string[]
  hostInject?: string[]
  clientInject?: string[]
  thirdPartyDependencyCount?: number
  patch?: { insertCount: number; disableCount: number; hasJsExpr: boolean; missing: boolean } | null
  drift?: { status: 'new' | 'unchanged' | 'drifted'; added: string[]; removed: string[]; changed: string[] }
  findings: Finding[]
  error?: string
}

interface AuditData {
  plugins: Plugin[]
  summary: { profileDir: string; total: number; critical: number; suspicious: number; clean: number }
}

const RISK_META: Record<Risk, { color: string; bg: string; label: string }> = {
  critical: { color: '#A87171', bg: 'rgba(168,113,113,0.16)', label: '高危' },
  suspicious: { color: '#B39263', bg: 'rgba(179,146,99,0.16)', label: '可疑' },
  clean: { color: '#7E9A7C', bg: 'rgba(126,154,124,0.16)', label: '干净' },
}

function riskBadge(risk: Risk): ReactNode {
  const m = RISK_META[risk]
  return (
    <span style={{ color: m.color, background: m.bg, borderRadius: 6, padding: '1px 9px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  )
}

function metaLine(text: string): ReactNode {
  return <div style={{ fontSize: 12, color: '#8a8a8a', marginTop: 3 }}>{text}</div>
}

function Panel(): ReactNode {
  const [data, setData] = useState<AuditData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/trust/audit.json', { cache: 'no-store' })
      setData(await res.json() as AuditData)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  return (
    <div style={{ padding: '16px 20px', fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>插件安全审计</span>
        <button
          type="button"
          onClick={() => { void load() }}
          style={{ marginLeft: 'auto', border: '1px solid var(--dsw-alias-border, #ccc)', background: 'transparent', borderRadius: 6, padding: '2px 12px', cursor: 'pointer', fontSize: 12 }}
        >
          刷新
        </button>
      </div>

      {loading && <div style={{ color: '#8a8a8a' }}>扫描中…</div>}

      {!loading && error !== null && <div style={{ color: '#A87171' }}>加载失败：{error}</div>}

      {!loading && error === null && data !== null && data.summary !== undefined && (
        <div style={{ color: '#8a8a8a', marginBottom: 12 }}>
          共 {data.summary.total} 个第三方插件 · {data.summary.critical} 高危 · {data.summary.suspicious} 可疑 · {data.summary.clean} 干净
        </div>
      )}

      {!loading && error === null && data !== null && data.plugins.map(p => (
        <div key={p.name} style={{ border: '1px solid var(--dsw-alias-border, #e5e5e5)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700 }}>{p.name}</span>
            <span style={{ color: '#999', fontSize: 12 }}>@{p.version}</span>
            <span style={{ marginLeft: 'auto' }}>{riskBadge(p.risk)}</span>
          </div>
          {p.error !== undefined && <div style={{ color: '#A87171', marginTop: 4 }}>{p.error}</div>}
          {p.error === undefined && (
            <>
              {(p.installScripts?.length ?? 0) > 0 && metaLine(`安装脚本：${p.installScripts!.join(', ')}`)}
              {(p.hostInject?.length ?? 0) > 0 && metaLine(`host 注入：${p.hostInject!.join(', ')}`)}
              {(p.clientInject?.length ?? 0) > 0 && metaLine(`client 注入：${p.clientInject!.join(', ')}`)}
              {p.patch !== null && p.patch !== undefined && !p.patch.missing && (
                metaLine(`patch：insert=${p.patch.insertCount} disable=${p.patch.disableCount}${p.patch.hasJsExpr ? ' ⚠️ 含 !!js' : ''}`)
              )}
              {p.drift !== undefined && p.drift.status === 'new' && metaLine('依赖漂移：新插件（已记录基线）')}
              {p.drift !== undefined && p.drift.status === 'drifted' && (
                <>
                  {p.drift.added.length > 0 && metaLine(`依赖漂移：新增 ${p.drift.added.join(', ')}`)}
                  {p.drift.removed.length > 0 && metaLine(`依赖漂移：移除 ${p.drift.removed.join(', ')}`)}
                  {p.drift.changed.length > 0 && metaLine(`依赖漂移：版本变化 ${p.drift.changed.join(', ')}`)}
                </>
              )}
              {p.findings.map((f, i) => (
                <div key={i} style={{ fontSize: 12, marginTop: 4 }}>
                  <span style={{ color: f.severity === 'critical' ? '#A87171' : '#B39263', fontWeight: 700 }}>
                    {f.severity === 'critical' ? '🔴' : '🟡'}{' '}
                  </span>
                  {f.message}
                </div>
              ))}
            </>
          )}
        </div>
      ))}

      {!loading && error === null && data !== null && data.plugins.length === 0 && (
        <div style={{ color: '#8a8a8a' }}>当前 profile 没有第三方插件。</div>
      )}
    </div>
  )
}

export function apply(ctx: {
  slots: {
    inject(name: string, register: () => unknown): unknown
    register(spec: Record<string, unknown>, component: unknown): unknown
  }
}): void {
  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'trust',
    order: 20,
    label: () => '安全审计',
    inject: () => ({}),
  }, Panel))
}
