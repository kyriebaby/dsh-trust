# dsh-trust

> A security audit tool for DeepSeek Harness plugins: see what a third-party plugin will actually do to your machine before you run it.

[中文](README.md)

## What it is

`dsh-trust` is a third-party security plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`).

`dsh` is designed around "everything is a plugin" — installing a plugin effectively means running **arbitrary third-party code** on your machine. The tool-approval chain can gate an agent's actions, but it cannot gate the plugin's own code. `dsh-trust` surfaces that "invisible risk" through deterministic static analysis.

## What problems it solves

- **No pre-install visibility**: nothing tells you, before `dsh plugin add xxx`, which files a plugin reads, whether it can reach the network, or whether it executes code at install time.
- **No post-install visibility**: an audit is a point-in-time snapshot, but dependencies keep changing. A plugin that silently pulls in a malicious dependency on update goes unnoticed.
- **Scattered security signals**: existing tooling expects users to run checks themselves and interpret the results — hostile to ordinary users.

## Key benefits

| Benefit | Description |
|---------|-------------|
| 🔍 **Permission transparency** | Enumerates every third-party plugin and surfaces inject capability surface, install scripts, `!!js` config, and more |
| 🛡️ **Supply-chain protection** | Dependency-drift detection: records a baseline on first audit, then flags added/removed/changed dependencies |
| 🎯 **Trustworthy results** | Filesystem-only, deterministic — no LLM in the loop, no network, reproducible |
| 🕊️ **Zero intrusion** | Read-only, advisory only — never modifies plugins or config |
| 🧩 **Two surfaces** | In-chat `audit_plugins` tool + a "安全审计" (Security Audit) tab in Web Settings |

## Install

```sh
# from npm
dsh plugin --profile web add dsh-trust

# or from GitHub (pin to a commit for a more controlled supply chain)
dsh plugin --profile web add github:<your-account>/dsh-trust#<commit>
```

Restart `dsh web` to activate.

## Usage

### Option 1: the `audit_plugins` tool

Just ask the agent:

> Audit the installed plugins for security risks.

The agent calls `audit_plugins` and returns a per-plugin risk card (level + details).

Optional parameters:

| Parameter | Description |
|-----------|-------------|
| `profile` | Audit a specific profile (defaults to the current one, e.g. `web` / `headless`) |
| `updateBaseline` | When `true`, accept the current dependencies as the new baseline (clears drift warnings) |

### Option 2: the "安全审计" Web panel

Open **Settings → Plugins → 安全审计**. The panel shows each third-party plugin's risk badge, inject capability surface, patch summary, and dependency-drift status. It is read-only.

## Risk signals

| Signal | How it's detected | Level |
|--------|-------------------|-------|
| `!!js` config expression | `!!js` appears in `cordis.patch.yml` (arbitrary code at load time) | 🔴 critical |
| Install scripts | `install` / `postinstall` / `preinstall` present | 🔴 critical |
| `prepare` script | `prepare` present (build-time, usually benign) | 🟡 suspicious |
| High-capability host inject | Injects `subprocess` / `shell` / `dynamicCordisRunner` / `loader` / `sandboxPolicy` / `credentials` | 🟡 suspicious |
| Dependency drift | Dependencies added relative to baseline | 🟡 suspicious |
| Wide supply chain | More than 10 third-party dependencies | 🟡 suspicious |

## Dependency drift

Dependency drift means a plugin's dependency set changed between the last audit and the current one, without the user knowing.

1. **First audit** records each plugin's dependency list to a baseline snapshot (`.dsh-trust-baseline.json` in the profile directory).
2. **Subsequent audits** diff current dependencies against the baseline, splitting into added / removed / version-changed.
3. **Added dependencies** raise the plugin to suspicious and emit a warning.
4. **Once verified**, pass `updateBaseline: true` to `audit_plugins` to accept the current state as the new baseline.

## Design limits

- **Deterministic heuristics, not full static analysis**: it reads `package.json` + `cordis.patch.yml` and greps the entry module for `inject`; it does not parse every source file, follow obfuscation, or query a vulnerability database.
- **Advisory only**: it warns but never blocks an install or a running plugin. Install sources you trust.
- **Hard interception is out of scope**: `dsh plugin add` forwards straight to pnpm with no pre-install hook, so a bundle cannot force a block at install time (that requires changing the official CLI or integrating into a plugin market's install dialog).

## Project structure

```text
dsh-trust/
├── lib/
│   ├── index.js       # host entry: registers the audit_plugins tool + route
│   ├── audit.js       # audit core: enumeration, parsing, risk scoring, dependency drift
│   └── route.js       # /trust/audit.json HTTP data channel
├── src/client/index.tsx  # browser half: the "安全审计" settings panel
├── scripts/build-client.mjs  # esbuild client bundle
├── cordis.patch.yml  # bundle mount layer
└── package.json      # manifest (dsh.bundle + dsh.client)
```

## License

[MIT](LICENSE)
