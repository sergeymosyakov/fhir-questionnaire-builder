// The reference file of a check: the Questionnaire that was checked plus every answer set tried, as one `collection` Bundle (nothing to execute, so entry order carries no meaning).
export const REFERENCE_TAG = { system: 'https://fhir-qb.app/bundle-kind', code: 'check-reference', display: 'Form Check reference' };
const REFERENCE_ID_SYSTEM = 'https://fhir-qb.app/check-reference';

// A bare id is not a reference a server can resolve.
const asReference = (q) => (!q || /^(https?:|urn:|[A-Za-z]+\/)/.test(q) ? q : `Questionnaire/${q}`);

export function buildReferenceBundle(report) {
  const timestamp = new Date().toISOString(); // also the "today" the calculated values were worked out on
  const answers = report.trials.filter((t) => t.qr).map((t) => ({
    fullUrl: `urn:uuid:${crypto.randomUUID()}`,
    resource: { ...t.qr, ...(t.qr.questionnaire ? { questionnaire: asReference(t.qr.questionnaire) } : {}), status: 'completed', authored: timestamp },
  }));
  return {
    resourceType: 'Bundle',
    meta: { tag: [REFERENCE_TAG] },
    identifier: { system: REFERENCE_ID_SYSTEM, value: crypto.randomUUID() },
    type: 'collection',
    timestamp,
    entry: [{ fullUrl: `urn:uuid:${crypto.randomUUID()}`, resource: report.questionnaire }, ...answers],
  };
}

export const hasReference = (report) => !!report.questionnaire && report.trials.some((t) => t.qr);
