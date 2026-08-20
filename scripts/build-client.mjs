// dsh-trust browser-half build: esbuild bundles src/client → lib/client.js
// (react inlined as external, resolved by the harness __ModuleLoader__).
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PKG = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'))

const banner = (
  'window.__ModuleLoader__.load({\n' +
  `\tid: ${JSON.stringify(PKG.name)},\n` +
  '\tfactory: (require) => {\n' +
  '\t\tvar module = { exports: {} };\n' +
  '\t\tvar exports = module.exports;\n'
)

await build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  jsx: 'automatic',
  target: 'es2022',
  outfile: 'lib/client.js',
  legalComments: 'none',
  charset: 'utf8',
  external: ['react', 'react/jsx-runtime', 'react-dom'],
  banner: { js: banner },
  footer: { js: '\n\t\treturn module.exports;\n\t}\n});\n' },
})
console.log('client bundle → lib/client.js')
