// ── JSON download utility ─────────────────────────────────────────────────────
// Isolated DOM side-effect: creates an <a> tag, clicks it, revokes the blob URL.
// Used by export.js and qr-export.js to keep FHIR logic modules DOM-free.

export function downloadJSON(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName || 'download.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
