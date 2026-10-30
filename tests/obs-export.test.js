// ── Unit tests: js/fhir/obs-export.js ────────────────────────────────────────
// Collaborators (builder, QR builder, extractor, download) are mocked so only
// the QR metadata wiring and profile option are exercised.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../js/fhir/export.js',     () => ({ buildFHIRObject: vi.fn() }));
vi.mock('../js/fhir/qr-builder.js', () => ({ buildQR: vi.fn() }));
vi.mock('../js/fhir/extract.js',    () => ({ extractObservations: vi.fn() }));
vi.mock('../js/fhir/download.js',   () => ({ downloadJSON: vi.fn() }));

import { exportObservations } from '../js/fhir/obs-export.js';
import { buildFHIRObject } from '../js/fhir/export.js';
import { buildQR } from '../js/fhir/qr-builder.js';
import { extractObservations } from '../js/fhir/extract.js';
import { downloadJSON } from '../js/fhir/download.js';
import { AppEvents, EventState } from '../js/events.js';
import { FHIR } from '../js/fhir/urls/fhir.js';

const FIXED_NOW = new Date('2025-03-04T05:06:07.000Z');
const Q = { resourceType: 'Questionnaire', status: 'active' };
const BUNDLE = { resourceType: 'Bundle', type: 'transaction', entry: [] };
let qr;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  qr = { resourceType: 'QuestionnaireResponse', status: 'in-progress' };
  buildFHIRObject.mockReset().mockReturnValue(Q);
  buildQR.mockReset().mockReturnValue(qr);
  extractObservations.mockReset().mockReturnValue(BUNDLE);
  downloadJSON.mockReset();
  EventState._set(AppEvents.APP_CONTEXT_READY, { answerStore: { toValueMap: () => ({ q1: 'a' }) } });
});
afterEach(() => { vi.useRealTimers(); });

describe('exportObservations', () => {
  it('builds the QR from the questionnaire and current answers, marking it completed with an authored timestamp', () => {
    exportObservations('o.json');
    expect(buildQR).toHaveBeenCalledWith(Q, { q1: 'a' });
    expect(extractObservations.mock.calls[0][0]).toMatchObject({
      resourceType: 'QuestionnaireResponse', status: 'completed', authored: '2025-03-04T05:06:07.000Z',
    });
    expect(extractObservations.mock.calls[0][1]).toBe(Q);
  });

  it('adds the SDC observation profile by default', () => {
    exportObservations('o.json');
    expect(extractObservations.mock.calls[0][2]).toEqual({ obsProfile: [FHIR.sdcObservation] });
  });

  it('omits the profile when addProfile is false but keeps it for other falsy-ish values', () => {
    exportObservations('o.json', { addProfile: false });
    expect(extractObservations.mock.calls[0][2]).toEqual({ obsProfile: [] });
    exportObservations('o.json', { addProfile: undefined });
    expect(extractObservations.mock.calls[1][2]).toEqual({ obsProfile: [FHIR.sdcObservation] });
  });

  it('applies qrId, subject and author from meta as id / references', () => {
    exportObservations('o.json', { qrId: 'qr-9', subject: 'Patient/1', author: 'Practitioner/2' });
    expect(extractObservations.mock.calls[0][0]).toMatchObject({
      id: 'qr-9', subject: { reference: 'Patient/1' }, author: { reference: 'Practitioner/2' },
    });
  });

  it('leaves id, subject and author unset without meta', () => {
    exportObservations('o.json');
    const sent = extractObservations.mock.calls[0][0];
    expect(sent).not.toHaveProperty('id');
    expect(sent).not.toHaveProperty('subject');
    expect(sent).not.toHaveProperty('author');
  });

  it('downloads and returns the bundle under the given file name', () => {
    expect(exportObservations('phq-9-observations.json')).toBe(BUNDLE);
    expect(downloadJSON).toHaveBeenCalledWith(BUNDLE, 'phq-9-observations.json');
  });

  it('defaults the file name to observations.json', () => {
    exportObservations();
    expect(downloadJSON).toHaveBeenCalledWith(BUNDLE, 'observations.json');
  });
});
