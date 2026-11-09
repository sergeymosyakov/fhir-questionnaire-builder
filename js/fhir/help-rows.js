// Static table rows for help.html (so crawlers see the field reference without running its script) — same markup the page renders.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** @param {{cat: string, field: string, desc: string, where: string, how: string}[]} data */
export function renderHelpRows(data) {
  let lastCat = null;
  const rows = [];
  for (const row of data) {
    if (row.cat !== lastCat) {
      rows.push(`        <tr class="help-cat-sep"><td colspan="4"><span class="help-cat-badge">${esc(row.cat)}</span></td></tr>`);
      lastCat = row.cat;
    }
    rows.push(`        <tr><td class="col-field" data-label="FHIR Field / Extension"><code>${esc(row.field)}</code></td><td class="col-desc" data-label="Description">${esc(row.desc)}</td><td class="col-where" data-label="Where in UI">${esc(row.where)}</td><td class="col-how" data-label="How to access">${esc(row.how)}</td></tr>`);
  }
  return rows.join('\n');
}

/** The HELP_DATA array literal of help.html, evaluated. */
export function helpDataFrom(html) {
  const start = html.indexOf('const HELP_DATA = [');
  const end = html.indexOf('\n  ];', start);
  if (start < 0 || end < 0) throw new Error('HELP_DATA not found in help.html');
  return new Function(`return ${html.slice(start + 'const HELP_DATA = '.length, end + 4)};`)();
}

const BODY_RE = /(<tbody id="helpBody">)[\s\S]*?(<\/tbody>)/;

/** help.html with its table body pre-rendered. */
export function withStaticRows(html) {
  return html.replace(BODY_RE, `$1\n${renderHelpRows(helpDataFrom(html))}\n      $2`);
}
