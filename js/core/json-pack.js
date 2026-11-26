// Any JSON value as a short string for storage: gzip + base64 (plain where CompressionStream is missing).

const toBase64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

/** @returns {Promise<string>} "gz:<base64>" (or "raw:<json>" where CompressionStream is missing) */
export async function packJson(value) {
  const json = JSON.stringify(value);
  if (typeof CompressionStream === 'undefined') return `raw:${json}`;
  return `gz:${toBase64(await pipe(new TextEncoder().encode(json), new CompressionStream('gzip')))}`;
}

/** @returns {Promise<any>} */
export async function unpackJson(packed) {
  if (packed.startsWith('raw:')) return JSON.parse(packed.slice(4));
  if (!packed.startsWith('gz:')) throw new Error('unknown format');
  return JSON.parse(new TextDecoder().decode(await pipe(fromBase64(packed.slice(3)), new DecompressionStream('gzip'))));
}
