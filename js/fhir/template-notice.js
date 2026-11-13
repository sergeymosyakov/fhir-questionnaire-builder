// Copyright notice a third-party template adds to Questionnaire.copyright when inserted.
const isOwnRepoUrl = u => { try { const { hostname, pathname } = new URL(u); return hostname === 'github.com' && pathname.startsWith('/sergeymosyakov/fhir-questionnaire-builder/'); } catch { return false; } };

/** @returns {string|null} null for templates written for this builder (nothing third-party to credit) */
export function copyrightNoticeFor(entry) {
  if (!entry.licenseUrl || isOwnRepoUrl(entry.licenseUrl)) return null;
  return `${entry.name} — ${entry.license} (${entry.licenseUrl})`;
}

/** Appends `notice` after the author's own text; unchanged when it is already there. */
export function withCopyrightNotice(existing, notice) {
  const text = existing ?? '';
  if (!notice || text.includes(notice)) return text;
  return text.trim() ? `${text.trimEnd()}\n\n${notice}` : notice;
}
