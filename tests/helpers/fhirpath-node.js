// Loads the browser fhirpath UMD bundle in node behind a window shim, so parse
// round-trip tests can use the real parser without adding a dependency.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runInThisContext } from 'node:vm';

let cached = null;

export function loadFhirpath() {
  if (cached) return cached;
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '..', '..', 'lib', 'fhirpath.min.js'), 'utf8');
  const g = globalThis;
  g.window = g;
  g.self = g;
  // runInThisContext (not new Function) so a bare top-level `var` from an esbuild
  // --global-name IIFE hoists onto globalThis, same as a real browser <script> tag.
  runInThisContext(src, { filename: 'lib/fhirpath.min.js' });
  cached = g.fhirpath || g.window.fhirpath;
  return cached;
}
