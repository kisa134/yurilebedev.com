// Static checks that run before every deploy (CI and locally: node tools/check.mjs).
// 1. Syntax of every script. 2. No two top-level names in os/os.js (the closure is shared, a clash silently
//    replaces a function: this broke window dragging once). 3. Asset stamps match the files.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
let fail = 0;
const err = (m) => { console.error('✗ ' + m); fail = 1; };
for (const f of ['os/os.js', 'os/data.js', 'site.js', 'analytics.js']) {
  try { new vm.Script(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), { filename: f }); } catch (e) { err(`${f}: ${e.message}`); }
}
import * as acorn from 'acorn';
const src = readFileSync(new URL('../os/os.js', import.meta.url), 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 2020, locations: true });
// the whole OS is one IIFE: check the names declared directly in its body
const iife = ast.body.find((n) => n.type === 'ExpressionStatement')?.expression?.callee;
const body = iife?.body?.body || [];
const seen = new Map();
function add(name, line) { if (seen.has(name)) err(`duplicate top-level name "${name}" at os/os.js:${line} (first at line ${seen.get(name)})`); else seen.set(name, line); }
for (const st of body) {
  if (st.type === 'FunctionDeclaration') add(st.id.name, st.loc.start.line);
  if (st.type === 'VariableDeclaration') for (const d of st.declarations) if (d.id.type === 'Identifier') add(d.id.name, d.loc.start.line);
}
if (body.length < 50) err('could not find the OS closure in os/os.js');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
for (const m of html.matchAll(/(os\/[\w.-]+\.(?:js|css))\?v=([0-9a-f]+)/g)) {
  const v = createHash('md5').update(readFileSync(new URL('../' + m[1], import.meta.url))).digest('hex').slice(0, 8);
  if (v !== m[2]) err(`${m[1]} stamp is stale: run python3 tools/release.py`);
}
if (!fail) console.log('✓ static checks passed');
process.exit(fail);
