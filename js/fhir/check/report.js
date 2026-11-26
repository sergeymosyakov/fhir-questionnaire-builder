// "Check my form" report model (with the questionnaire JSON that was checked): one row per answer set tried, one column per calculation.
import { rawOptsToPairs } from '../../utils.js';

const NONE = 'no result';

const indexById = (tree) => {
  const byId = new Map();
  const walk = (nodes) => (nodes || []).forEach((n) => { byId.set(n.id, n); walk(n.children); });
  walk(tree);
  return byId;
};

/** An answer set in the words of the form: "Question = answer" per question. */
export function answerLines(byId, answers) {
  const name = (id) => byId.get(id)?.title || id;
  const label = (id, value) => rawOptsToPairs(byId.get(id)?._rawAnswerOptions).find((o) => o.code === value)?.display || String(value);
  return Object.entries(answers).map(([id, v]) => `${name(id)} = ${label(id, v)}`);
}

export function buildReport({ tree, result, title, questionnaire = null }) {
  const byId = indexById(tree);
  const name = (id) => byId.get(id)?.title || id;

  const calcs = result.calcs.map((c) => {
    const seen = new Set(result.trials.map((t) => t.results[c.id] ?? NONE));
    return {
      id: c.id, title: c.title, status: c.status, reason: c.reason ?? null, expression: byId.get(c.id)?._calculatedExpr ?? '',
      reads: c.reads.map(name), missed: c.details ?? [], sampled: c.sampled ?? [],
      seen: [...seen],
    };
  });
  const trials = result.trials.map((t) => ({
    answers: answerLines(byId, t.answers),
    results: result.calcs.map((c) => t.results[c.id] ?? null), // in the order of `calcs`
    qr: t.qr ?? null,
  }));
  return { title: title || 'Questionnaire', when: new Date().toISOString(), questionnaire, scenarios: result.scenarios, truncated: !!result.truncated, unshown: result.unshown ?? [], calcs, trials };
}
