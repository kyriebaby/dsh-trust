/**
 * dsh-trust — HTTP data channel for the web UI risk panel.
 *
 * Registers a GET route `/trust/audit.json` on the optional `webServer`
 * service that returns the same audit payload the `audit_plugins` tool
 * produces. The web client polls this endpoint to render the settings tab.
 */

import { enumeratePlugins, profileDirFromCtx } from './audit.js'

function writeJson(res, code, body) {
  if (res.writableEnded) return
  try {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(body))
  } catch {
    // connection already gone — never propagate
  }
}

function auditPayload(ctx) {
  const profileDir = profileDirFromCtx(ctx)
  const plugins = enumeratePlugins(profileDir)
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
}

/**
 * Register the audit route, retrying until `webServer` is ready (it can boot
 * after this plugin). In non-web profiles `webServer` never appears and the
 * waiter is disposed with the fiber.
 * @param ctx - the cordis context passed to `apply`.
 */
export function registerAuditRoute(ctx) {
  const tryRegister = () => {
    let ws
    try {
      ws = ctx.get('webServer')
    } catch {
      ws = undefined
    }
    if (ws === undefined) return false
    ctx.effect(() => ws.register({
      kind: 'prefix',
      path: '/trust',
      handler: (req, res) => {
        const pathname = (req.url ?? '').split('?')[0]
        if (req.method !== 'GET' || !pathname.endsWith('/trust/audit.json')) {
          writeJson(res, 404, { ok: false, note: 'not found' })
          return
        }
        try {
          writeJson(res, 200, auditPayload(ctx))
        } catch (err) {
          writeJson(res, 500, { ok: false, error: String(err) })
        }
      },
    }), 'dsh-trust: audit route')
    return true
  }
  if (tryRegister()) return
  const timer = setInterval(() => {
    if (tryRegister()) clearInterval(timer)
  }, 400)
  if (timer.unref) timer.unref()
  ctx.effect(() => () => clearInterval(timer), 'dsh-trust: audit route waiter')
}
