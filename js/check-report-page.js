// Form Check Report page: renders the report model the Check my form window left in sessionStorage.
import { loadReport } from './fhir/check/report-storage.js';
import { AppEvents } from './events.js';
import { highlightJson } from './utils.js';
import { runCheck } from './fhir/check/run-check.js';
import { putHandoff } from './core/questionnaire-handoff.js';
import { buildScenarioBundle, hasScenarios } from './fhir/check/scenario-bundle.js';
import { downloadJSON } from './fhir/download.js';
import { CheckUpload } from './ui/check-upload.js';

const el = (tag, className, text, testid) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  if (testid) n.dataset.testid = testid;
  return n;
};

const SHOWN = 5;
const STATUS = { ok: 'All results reachable', unreachable: 'Some results can never appear', 'no-result': 'Never produces a result', skipped: 'Not checked' };

// The answers past the first few sit behind a toggle on screen.
function moreToggle(list, hidden) {
  const btn = el('button', 'check-report-more', `Show ${hidden} more`, 'check-report-more');
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    list.querySelectorAll('.check-report-extra').forEach((li) => { li.hidden = open; });
    btn.setAttribute('aria-expanded', String(!open));
    btn.textContent = open ? `Show ${hidden} more` : 'Show fewer';
  });
  return btn;
}

function renderCalc(c) {
  const box = el('section', `check-report-calc check-report-calc--${c.status}`, null, 'check-report-calc');
  box.dataset.status = c.status;
  box.append(el('h2', 'check-report-calc-title', c.title), el('p', 'check-report-status', STATUS[c.status]));
  if (c.expression) {
    box.append(el('p', 'check-report-formula-label', 'Formula (FHIRPath)'), el('pre', 'check-report-formula', c.expression, 'check-report-formula'));
  }
  if (c.reads.length) {
    const reads = el('details', 'check-report-reads', null, 'check-report-reads');
    const sum = el('summary', null, `Reads ${c.reads.length} ${c.reads.length === 1 ? 'question' : 'questions'}`);
    sum.append(el('span', 'check-report-screen-only', ' — click to list them'));
    const list = el('ul', 'check-report-answers');
    c.reads.forEach((name) => list.append(el('li', null, name)));
    reads.append(sum, list);
    box.append(reads);
  }
  if (c.sampled?.length) box.append(el('p', 'check-report-note', `Dates, and numbers without both limits, were tried only in a range: ${c.sampled.join(', ')}.`, 'check-report-sampled'));
  if (c.reason) box.append(el('p', 'check-report-note', `Not checked: ${c.reason}.`));
  if (c.status !== 'skipped') box.append(el('p', 'check-report-seen', `Results seen: ${c.seen.join(', ')}`, 'check-report-seen'));
  for (const m of c.missed) box.append(el('p', 'check-report-missed', `Never appeared: “${m.text}” — given when ${m.when}`, 'check-report-missed'));
  return box;
}

function jsonView(questionnaire) {
  const pre = el('pre', 'fhir-json-view check-report-json', null, 'check-report-json');
  pre.innerHTML = highlightJson(JSON.stringify(questionnaire, null, 2)); // the text is escaped first, as in the builder's JSON view
  return pre;
}

function renderSource(questionnaire) {
  const box = el('details', 'check-report-source', null, 'check-report-source');
  box.append(el('summary', null, 'Questionnaire that was checked (JSON) — click to expand'), jsonView(questionnaire));
  return box;
}

function renderUnshown(unshown) {
  const box = el('section', 'check-report-calc check-report-calc--unreachable', null, 'check-report-unshown');
  box.append(el('h2', 'check-report-calc-title', 'Questions that are never shown'), el('p', 'check-report-note', 'Their Show When rule is not met by any of the answers tried, so nobody can answer them.'));
  const list = el('ul', 'check-report-answers');
  unshown.forEach((u) => list.append(el('li', null, `${u.title} — shown when ${u.when}`)));
  box.append(list);
  return box;
}

function renderTrials(report) {
  const wrap = el('section', 'check-report-trials-wrap');
  wrap.append(el('h2', 'check-report-calc-title', 'All answer sets tried'));
  const scroll = el('div', 'check-report-scroll');
  const table = el('table', 'check-report-table check-report-trials', null, 'check-report-trials');
  const thead = el('thead'); // repeats on every printed page
  const head = el('tr');
  ['#', 'Answers', ...report.calcs.map((c) => c.title)].forEach((h) => head.append(el('th', null, h)));
  thead.append(head);
  table.append(thead);
  report.trials.forEach((t, i) => {
    const row = el('tr', null, null, 'check-report-trial');
    const answers = el('td');
    if (t.answers.length) {
      const list = el('ul', 'check-report-answers');
      t.answers.forEach((line, n) => {
        const li = el('li', n >= SHOWN ? 'check-report-extra' : null, line);
        if (n >= SHOWN) li.hidden = true;
        list.append(li);
      });
      answers.append(list);
      if (t.answers.length > SHOWN) answers.append(moreToggle(list, t.answers.length - SHOWN));
    } else answers.textContent = 'no answers';
    row.append(el('td', null, String(i + 1)), answers);
    t.results.forEach((r) => row.append(el('td', r === null ? 'check-report-none' : null, r ?? '—')));
    table.append(row);
  });
  scroll.append(table);
  wrap.append(el('p', 'check-report-note', 'An answer set is one combination of answers the check tried (everything lowest, everything highest, one question at a time, questions left unanswered, and so on). “—” means the calculation gave no result.'), scroll);
  return wrap;
}

function render(report) {
  const root = document.getElementById('checkReportRoot');
  root.innerHTML = '';
  const bad = report.calcs.filter((c) => c.status === 'unreachable' || c.status === 'no-result').length + (report.unshown?.length ?? 0);
  const actions = el('div', 'check-report-actions qdoc-no-print');
  if (report.questionnaire) {
    const open = el('button', 'qdoc-btn', '\u270E Open in builder', 'check-report-open-btn');
    open.type = 'button';
    open.addEventListener('click', () => openInBuilder(report));
    actions.append(open);
  }
  if (hasScenarios(report)) {
    const exp = el('button', 'qdoc-btn', '\u2B07 Export scenarios (FHIR Bundle)', 'check-report-export-btn');
    exp.type = 'button';
    exp.addEventListener('click', () => downloadJSON(buildScenarioBundle(report), 'form-check-scenarios.bundle.json'));
    actions.append(exp);
  }
  if (actions.childElementCount) root.append(actions);
  root.append(
    el('h2', 'check-report-form', report.title),
    el('p', 'check-report-summary', `${report.calcs.length} calculations, ${report.scenarios} answer combinations tried${report.truncated ? ' (a very large form, so not all were)' : ''}; ${bad ? `${bad} need attention (calculations and questions that are never shown)` : 'no problems found'}. ${new Date(report.when).toLocaleString()}`, 'check-report-summary'),
  );
  if (report.questionnaire) root.append(renderSource(report.questionnaire));
  if (report.unshown?.length) root.append(renderUnshown(report.unshown));
  report.calcs.forEach((c) => root.append(renderCalc(c)));
  root.append(renderTrials(report));
}

// A text cell starting with = + - @ would run as a formula in a spreadsheet: a leading ' keeps it text (numbers stay numbers).
const csvCell = (v) => {
  let text = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(text) && !(text.trim() !== '' && Number.isFinite(Number(text)))) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
function downloadCsv(report) {
  const rows = [['#', 'Answers', ...report.calcs.map((c) => c.title)], ...report.trials.map((t, i) => [i + 1, t.answers.join('\n'), ...t.results.map((r) => r ?? '')])];
  const blob = new Blob([`\uFEFF${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = el('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = 'form-check-answer-sets.csv';
  document.body.append(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000); // not at once: some browsers start the download later
}

// Print always lists the questions each calculation reads: open the lists for printing, then put them back.
const readLists = () => [...document.querySelectorAll('details.check-report-reads')];
window.addEventListener('beforeprint', () => readLists().forEach((d) => { d.dataset.wasOpen = d.open ? '1' : ''; d.open = true; }));
window.addEventListener('afterprint', () => readLists().forEach((d) => { d.open = d.dataset.wasOpen === '1'; delete d.dataset.wasOpen; }));

document.querySelector('[data-testid="check-report-print-btn"]').addEventListener('click', () => window.print());

const reportRoot = document.getElementById('checkReportRoot');
const emptyState = reportRoot.firstElementChild; // the page's own "nothing checked yet" paragraph
const csvBtn = document.querySelector('[data-testid="check-report-csv-btn"]');
let current = null;

function show(report) {
  current = report;
  render(report);
  csvBtn.hidden = false;
}
csvBtn.addEventListener('click', () => current && downloadCsv(current));
async function openInBuilder(report) {
  const tab = window.open('', '_blank'); // opened at once, while the click still counts; pointed at the builder once the questionnaire is stored
  if (!tab) { fail('The browser blocked the new tab. Allow pop-ups for this page and try again.'); return; }
  const id = await putHandoff(report.questionnaire);
  if (!id) { tab.close(); fail('The questionnaire is too large to hand over to the builder from this tab.'); return; }
  tab.location.href = `./?handoff=${id}`;
}

const fail = (message) => document.dispatchEvent(new CustomEvent(AppEvents.CHECK_FAILED, { detail: { message } }));

document.addEventListener(AppEvents.CHECK_REPORT_READY, (e) => show(e.detail.report));
document.addEventListener(AppEvents.CHECK_SOURCE_PROVIDED, async (e) => {
  current = null; // a failed run must not leave the previous form's report, and its buttons, standing
  csvBtn.hidden = true;
  reportRoot.replaceChildren(emptyState);
  try {
    const report = await runCheck(e.detail.text, {
      fp: window.fhirpath,
      onProgress: (done, total) => document.dispatchEvent(new CustomEvent(AppEvents.CHECK_PROGRESS, { detail: { done, total } })),
    });
    document.dispatchEvent(new CustomEvent(AppEvents.CHECK_REPORT_READY, { detail: { report } }));
  } catch (err) { fail(`The check could not run: ${err.message}`); }
});

new CheckUpload();

loadReport() // left by the builder's Check my form window
  .then((report) => { if (report) document.dispatchEvent(new CustomEvent(AppEvents.CHECK_REPORT_READY, { detail: { report } })); })
  .catch(() => { /* storage unavailable or invalid: the page keeps its empty state */ });
