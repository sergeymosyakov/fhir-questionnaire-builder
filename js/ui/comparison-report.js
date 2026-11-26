// The comparison report: per calculation whether it still gives the same results, what changed in the questions, and the answers that show it.
// data-testid registry: check-report-reset-btn, compare-summary, compare-calc (data-status), compare-example, compare-formula-note, compare-drift, compare-questions, compare-broken, compare-truncated
import { AppEvents } from '../events.js';
import { el } from './el.js';

const STATUS = {
  same: (c) => `Unchanged on all ${c.total} answer sets`,
  changed: (c) => `Changed on ${c.changed} of ${c.total} answer sets`,
  removed: () => 'Removed: the form no longer calculates this',
  added: () => 'New: not in the reference file',
};
const CLASS = { same: 'ok', changed: 'unreachable', removed: 'unreachable', added: 'ok' };
const shown = (v) => (v === null ? 'no result' : `“${v}”`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function renderCalc(c) {
  const box = el('section', `check-report-calc check-report-calc--${CLASS[c.status]}`, null, 'compare-calc');
  box.dataset.status = c.status;
  box.append(el('h2', 'check-report-calc-title', c.title), el('p', 'check-report-status', STATUS[c.status](c)));
  if (c.formulaChanged) {
    const note = el('details', 'check-report-reads', null, 'compare-formula-note');
    note.append(el('summary', null, c.changed ? 'The formula was edited' : 'The formula was edited, the results stayed the same'),
      el('p', 'check-report-formula-label', 'Before'), el('pre', 'check-report-formula', c.expressionBefore),
      el('p', 'check-report-formula-label', 'Now'), el('pre', 'check-report-formula', c.expressionAfter));
    box.append(note);
  }
  if (c.drift) {
    box.append(el('p', 'check-report-note', `For ${plural(c.drift, 'answer set', 'answer sets')} the result in the reference file differs from what the saved form gives today: the formula may depend on the date (today, now), or the file was written by hand.`, 'compare-drift'));
  }
  for (const ex of c.examples) {
    const row = el('details', 'check-report-reads', null, 'compare-example');
    row.append(el('summary', null, `was ${shown(ex.expected)} → now ${shown(ex.actual)}`));
    const list = el('ul', 'check-report-answers');
    (ex.answers.length ? ex.answers : ['no answers']).forEach((line) => list.append(el('li', null, line)));
    row.append(list);
    box.append(row);
  }
  if (c.changed > c.examples.length) box.append(el('p', 'check-report-note', `…and ${c.changed - c.examples.length} more answer sets.`));
  return box;
}

function renderQuestions(report) {
  const { removedQuestions, invalidAnswers, showWhen } = report;
  const lines = [
    ...removedQuestions.map((q) => `“${q.title}” was removed: its answers were left out of ${plural(q.count, 'answer set', 'answer sets')} from the reference file.`),
    ...invalidAnswers.map((q) => `“${q.title}” no longer offers ${q.codes.map((x) => `“${x}”`).join(', ')}.`),
    ...showWhen.noLongerAsked.map((q) => `“${q.title}” is no longer asked in ${plural(q.count, 'answer set', 'answer sets')} (its Show When rule changed).`),
    ...showWhen.nowAsked.map((q) => `“${q.title}” is now asked in ${plural(q.count, 'answer set', 'answer sets')} where it was not before.`),
  ];
  if (!lines.length) return null;
  const box = el('section', 'check-report-calc check-report-calc--unreachable', null, 'compare-questions');
  const list = el('ul', 'check-report-answers');
  lines.forEach((line) => list.append(el('li', null, line)));
  box.append(el('h2', 'check-report-calc-title', 'Changes to the questions'), list);
  return box;
}

/** @returns {HTMLElement[]} the sections of the report, ready to put into the page */
export function renderComparison(report) {
  const changed = report.calcs.filter((c) => c.status === 'changed' || c.status === 'removed').length;
  const compared = report.calcs.filter((c) => c.status === 'changed' || c.status === 'same').length;
  const sets = `${report.ran} answer sets (${report.fromReference} from the reference file${report.savedAt ? `, saved ${new Date(report.savedAt).toLocaleString()}` : ''}${report.ran > report.fromReference ? `, ${report.ran - report.fromReference} more generated` : ''})`;
  const summary = compared || changed
    ? `${plural(compared, 'calculation', 'calculations')} compared on ${sets}; ${changed ? `${changed} changed or removed` : 'none changed'}.`
    : `Nothing to compare: no calculation exists in both versions. ${sets} were run.`;
  const reset = el('button', 'qdoc-btn', 'Clear', 'check-report-reset-btn');
  reset.type = 'button';
  reset.addEventListener('click', () => document.dispatchEvent(new CustomEvent(AppEvents.CHECK_RESET)));
  const actions = el('div', 'check-report-actions qdoc-no-print');
  actions.append(reset);
  const out = [
    actions,
    el('h2', 'check-report-form', `Comparison: ${report.title}`),
    el('p', 'check-report-summary', summary, 'compare-summary'),
  ];
  if (report.truncated) out.push(el('p', 'check-report-note', 'A very large form: not every generated answer combination was tried.', 'compare-truncated'));
  if (report.brokenNow) out.push(el('p', 'check-report-note', `${plural(report.brokenNow, 'answer set', 'answer sets')} that ran on the saved form can no longer be run on the current one.`, 'compare-broken'));
  if (report.unrunnable) out.push(el('p', 'check-report-note', `${plural(report.unrunnable, 'answer set', 'answer sets')} could not be run and ${report.unrunnable === 1 ? 'is' : 'are'} left out.`));
  const questions = renderQuestions(report);
  const order = { changed: 0, removed: 1, added: 2, same: 3 };
  [...report.calcs].sort((a, b) => order[a.status] - order[b.status]).forEach((c) => out.push(renderCalc(c)));
  if (questions) out.splice(3, 0, questions);
  return out;
}
