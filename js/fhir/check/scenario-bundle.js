// The answer sets a check tried, as one batch Bundle of completed QuestionnaireResponses (calculated values included).
// A bare id is not a reference a server can resolve.
const asReference = (q) => (!q || /^(https?:|urn:|[A-Za-z]+\/)/.test(q) ? q : `Questionnaire/${q}`);

export function buildScenarioBundle(report) {
  const authored = new Date().toISOString();
  const entry = report.trials.filter((t) => t.qr).map((t) => ({
    fullUrl: `urn:uuid:${crypto.randomUUID()}`,
    resource: { ...t.qr, ...(t.qr.questionnaire ? { questionnaire: asReference(t.qr.questionnaire) } : {}), status: 'completed', authored },
    request: { method: 'POST', url: 'QuestionnaireResponse' },
  }));
  return { resourceType: 'Bundle', type: 'batch', entry };
}

export const hasScenarios = (report) => report.trials.some((t) => t.qr);
