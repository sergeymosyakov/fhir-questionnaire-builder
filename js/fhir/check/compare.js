// Compares an edited form with a reference file: the same answer sets through the saved and the current Questionnaire, calculation by calculation.
import { importQRAnswers } from '../qr-import.js';
import { planScenarios } from './reachability.js';
import { answerLines } from './report.js';
import { loadForm } from './load-form.js';
import { readReference } from './reference.js';
import { createRunner } from './scenario-runner.js';
import { rawOptsToPairs } from '../../utils.js';
import { splitCodes } from '../checklist-codec.js';

const EXAMPLES = 8; // answer sets shown per changed calculation
const TOLERANCE = 1e-9;
const SLICE_MS = 40;
const yieldToUi = () => new Promise((r) => setTimeout(r, 0));

const asText = (v) => (v && typeof v === 'object' ? String(v.value ?? v.code ?? '') : String(v)); // a quantity answers by its value
const plain = (v) => (v && typeof v === 'object' && 'code' in v && !('value' in v) ? v.code : v); // a loaded coding answers by its code (a quantity keeps its value)
const isNumber = (s) => String(Number(s)) === s; // "7", "0.5" — not "007" or "1.0", which are text
export const sameValue = (a, b) => {
  if (a === b) return true;
  if (a === null || b === null || !isNumber(a) || !isNumber(b)) return false; // text must match exactly
  return Math.abs(Number(a) - Number(b)) <= TOLERANCE; // only float noise between two numbers
};
const normalise = (expr) => String(expr ?? '').replace(/\s+/g, ' ').trim();
const titleOf = (byId, id) => byId.get(id)?.title || id;

// The answer sets the reference saved: the inputs (calculated values are not answers) and what it recorded for each calculation.
function savedScenarios(reference, calcs, tree) {
  const calcIds = new Set(calcs.map((c) => c.id));
  return reference.responses.map((qr) => {
    const values = {};
    importQRAnswers(qr, values, tree); // readReference kept only QuestionnaireResponses
    const answers = {};
    const recorded = reference.complete ? Object.fromEntries([...calcIds].map((id) => [id, null])) : {}; // saved by the check: a calculation the response lacks gave no result; a hand-made file says nothing about it
    for (const [id, list] of Object.entries(values)) {
      const v = plain(Array.isArray(list) ? list[0] : list);
      if (calcIds.has(id)) recorded[id] = v === undefined || v === null || v === '' ? null : asText(v);
      else if (v !== undefined && v !== null && v !== '') answers[id] = v;
    }
    return { answers, recorded };
  });
}

/**
 * @param {{ reference: string|object, current: string|object, fp: object, onProgress?: Function, tryGenerated?: boolean }} args
 * tryGenerated: besides the answer sets in the file, run the ones the check would try on each version
 * @returns {Promise<object>} comparison model: { scenarios, fromReference, unrunnable, drift, calcs, removedQuestions, invalidAnswers, showWhen }
 */
export async function compareToReference({ reference, current, fp, onProgress, tryGenerated = false }) {
  if (!fp) throw new Error('the FHIRPath engine is not loaded');
  const ref = readReference(reference);
  const oldForm = loadForm(ref.questionnaire);
  const newForm = loadForm(current);
  const oldRun = createRunner({ ...oldForm, fp });
  const newRun = createRunner({ ...newForm, fp });

  const scenarios = [];
  const seen = new Set();
  const add = (answers, recorded, fromFile = false) => {
    const key = JSON.stringify(Object.entries(answers).sort(([a], [b]) => (a < b ? -1 : 1)));
    if (seen.has(key)) return false;
    seen.add(key);
    scenarios.push({ answers, recorded, fromFile });
    return true;
  };
  const saved = savedScenarios(ref, oldRun.calcs, oldForm.tree);
  saved.forEach((s) => add(s.answers, s.recorded, true)); // the same answers twice are one check
  let truncated = false;
  if (tryGenerated) { // what the check itself would try on each version: its limits, thresholds and Show When values
    for (const form of [newRun, oldRun]) {
      const { scenarios: planned } = planScenarios(form === newRun ? newForm.tree : oldForm.tree, form.byId, form.calcs);
      truncated ||= !!planned.truncated;
      planned.forEach((a) => add(a, null));
    }
  }

  const oldIds = new Set(oldRun.calcs.map((c) => c.id));
  const newIds = new Set(newRun.calcs.map((c) => c.id));
  const stats = new Map([...new Set([...oldIds, ...newIds])].map((id) => [id, { id, total: 0, changed: 0, drift: 0, examples: [] }]));
  const removedQuestions = new Map();
  const invalidAnswers = new Map();
  const noLongerAsked = new Map();
  const nowAsked = new Map();
  const bump = (map, id) => map.set(id, (map.get(id) || 0) + 1);
  let unrunnable = 0;
  let brokenNow = 0; // ran on the saved form, cannot be built on the current one
  let ran = 0;
  let ranFromFile = 0;

  onProgress?.(0, scenarios.length);
  let sliceStart = Date.now();
  for (let i = 0; i < scenarios.length; i++) {
    if (Date.now() - sliceStart > SLICE_MS) { onProgress?.(i, scenarios.length); await yieldToUi(); sliceStart = Date.now(); }
    const { answers, recorded, fromFile: inFileSet } = scenarios[i];
    const o = oldRun.run(answers);
    const n = newRun.run(answers);
    if (!o || !n) { if (o) brokenNow++; else unrunnable++; continue; } // brokenNow: only the current form cannot build it
    ran++;
    if (inFileSet) ranFromFile++;
    for (const [id, v] of inFileSet ? Object.entries(answers) : []) { // what the file's own answers meet in the current form
      const node = newRun.byId.get(id);
      if (!node) { bump(removedQuestions, id); continue; }
      const options = rawOptsToPairs(node._rawAnswerOptions).map((p) => p.code);
      if (!options.length || node.itemType === 'open-choice' || !['string', 'number'].includes(typeof v)) continue;
      for (const code of node.itemType === 'checklist' ? splitCodes(v) : [String(v)]) { // a checklist keeps its selections in one encoded value
        if (!options.includes(code)) invalidAnswers.set(id, (invalidAnswers.get(id) ?? new Set()).add(code));
      }
    }
    for (const id of Object.keys(o.answers)) if (oldRun.byId.has(id) && newRun.byId.has(id) && !Object.hasOwn(n.answers, id)) bump(noLongerAsked, id);
    for (const id of Object.keys(n.answers)) if (oldRun.byId.has(id) && !Object.hasOwn(o.answers, id)) bump(nowAsked, id);
    for (const id of oldIds) {
      if (!newIds.has(id)) continue; // gone: reported as removed
      const st = stats.get(id);
      st.total++;
      const inFile = !!recorded && Object.hasOwn(recorded, id);
      if (inFile && !sameValue(recorded[id], o.gave[id])) st.drift++; // the file and today's run of the same saved form disagree: the result depends on the day (or the file was written by hand)
      const expected = inFile ? recorded[id] : o.gave[id]; // what the file says wins; otherwise the saved form run today
      if (sameValue(expected, n.gave[id])) continue;
      st.changed++;
      if (st.examples.length < EXAMPLES) st.examples.push({ answers: answerLines(newRun.byId, n.answers), expected, actual: n.gave[id] });
    }
  }
  onProgress?.(scenarios.length, scenarios.length);
  if (!ran) throw new Error('None of the answer sets could be run on both versions, so nothing was compared.');

  const calcs = [...stats.values()].map((st) => {
    const [was, now] = [oldRun.byId.get(st.id), newRun.byId.get(st.id)];
    const inOld = oldIds.has(st.id);
    const inNew = newIds.has(st.id);
    const status = !inNew ? 'removed' : !inOld ? 'added' : st.changed ? 'changed' : 'same';
    return {
      id: st.id, title: titleOf(newRun.byId.has(st.id) ? newRun.byId : oldRun.byId, st.id), status,
      total: st.total, changed: st.changed, drift: st.drift, examples: st.examples,
      expressionBefore: was?._calculatedExpr ?? '', expressionAfter: now?._calculatedExpr ?? '',
      formulaChanged: inOld && inNew && normalise(was._calculatedExpr) !== normalise(now._calculatedExpr),
    };
  });
  const named = (map, byId) => [...map].map(([id, count]) => ({ id, title: titleOf(byId, id), count }));
  return {
    title: newForm.title || 'Questionnaire', savedAt: Number.isNaN(Date.parse(ref.timestamp)) ? null : ref.timestamp, when: new Date().toISOString(),
    scenarios: scenarios.length, ran, truncated, fromReference: ranFromFile, generated: tryGenerated, unrunnable, brokenNow,
    calcs,
    removedQuestions: named(removedQuestions, oldRun.byId),
    invalidAnswers: [...invalidAnswers].map(([id, codes]) => ({ id, title: titleOf(newRun.byId, id), codes: [...codes] })),
    showWhen: { noLongerAsked: named(noLongerAsked, newRun.byId), nowAsked: named(nowAsked, newRun.byId) },
  };
}
