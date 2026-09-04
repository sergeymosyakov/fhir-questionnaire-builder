// ── JSON/text download utilities ──────────────────────────────────────────────
// Isolated DOM side-effect: creates an <a> tag, clicks it, revokes the blob URL.
// Used by export.js/qr-export.js/doc-generator callers to keep FHIR logic DOM-free.

function _downloadBlob(blob, fileName) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export function downloadJSON(data, fileName) {
  _downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), fileName || 'download.json');
}

export function downloadText(content, fileName) {
  _downloadBlob(new Blob([content], { type: 'text/plain' }), fileName || 'download.txt');
}
