// Loads the browser fhirpath UMD bundle in node behind a window shim, so parse
// round-trip tests can use the real parser without adding a dependency.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let cached = null;

export function loadFhirpath() {
  if (cached) return cached;
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '..', '..', 'lib', 'fhirpath.min.js'), 'utf8');
  const g = globalThis;
  g.window = g;
  g.self = g;
  const mod = { exports: {} };
  new Function('module', 'exports', 'window', 'self', 'globalThis', src)(mod, mod.exports, g, g, g);
  cached = mod.exports && mod.exports.parse ? mod.exports : (g.fhirpath || g.window.fhirpath);
  return cached;
}
