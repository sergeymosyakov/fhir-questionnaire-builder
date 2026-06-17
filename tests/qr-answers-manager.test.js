// Unit tests for QRAnswersManager in js/fhir/qr-answers-manager.js.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DOM stubs ─────────────────────────────────────────────────────────────────
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init?.detail; }
};
globalThis.document = { dispatchEvent: vi.fn(), addEventListener: vi.fn() };

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('../js/ui/toast.js', () => ({ showError: vi.fn() }));
vi.mock('../js/ui/modals/validate-modal.js', () => ({ show: vi.fn() }));
vi.mock('../js/fhir/qr-import.js', () => ({ importQRAnswers: vi.fn() }));

const { QRAnswersManager }       = await import('../js/fhir/qr-answers-manager.js');
const { showError }              = await import('../js/ui/toast.js');
const validateModal              = await import('../js/ui/modals/validate-modal.js');
const { importQRAnswers }        = await import('../js/fhir/qr-import.js');

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeManager(overrides = {}) {
  const defaults = {
    questDoc:    overrides.questDoc ?? { rawFhir: null, tree: [] },
    answerStore: { data: {}, get: () => undefined },
  };
  return new QRAnswersManager({ ...defaults, ...overrides });
}

const SUCCESS = {
  ok: true,
  meta: { status: 'in-progress', subject: null, author: null },
  questionnaire: '',
  unmatched: [],
  loaded: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── apply — error path ────────────────────────────────────────────────────────
describe('QRAnswersManager.apply — import error', () => {
  it('calls showError when importQRAnswers returns ok:false', () => {
    importQRAnswers.mockReturnValue({ ok: false, error: 'bad format' });
    const mgr = makeManager();
    mgr.apply({});
    expect(showError).toHaveBeenCalledWith('Cannot load answers: bad format');
  });

  it('does not dispatch event when ok:false', () => {
    importQRAnswers.mockReturnValue({ ok: false, error: 'bad format' });
    makeManager().apply({});
    expect(document.dispatchEvent).not.toHaveBeenCalled();
  });

  it('does not dispatch RESPONSE_CHANGED when ok:false', () => {
    importQRAnswers.mockReturnValue({ ok: false, error: 'bad format' });
    makeManager().apply({});
    expect(document.dispatchEvent).not.toHaveBeenCalled();
  });
});

// ── apply — happy path ────────────────────────────────────────────────────────
describe('QRAnswersManager.apply — success', () => {
  it('dispatches QR_LOADED event', () => {
    importQRAnswers.mockReturnValue(SUCCESS);
    makeManager().apply({});
    const types = document.dispatchEvent.mock.calls.map(c => c[0].type);
    expect(types).toContain('qr-loaded');
  });

  it('QR_LOADED detail has status, subject, author', () => {
    importQRAnswers.mockReturnValue({
      ...SUCCESS,
      meta: { status: 'completed', subject: 'Patient/1', author: 'Practitioner/2' },
    });
    makeManager().apply({});
    const detail = document.dispatchEvent.mock.calls[0][0].detail;
    expect(detail.status).toBe('completed');
    expect(detail.subject).toBe('Patient/1');
    expect(detail.author).toBe('Practitioner/2');
  });

  it('dispatches RESPONSE_CHANGED event on success', () => {
    importQRAnswers.mockReturnValue(SUCCESS);
    makeManager().apply({});
    const dispatchedTypes = document.dispatchEvent.mock.calls.map(c => c[0].type);
    expect(dispatchedTypes).toContain('preview:response-changed');
  });

  it('does not call validateModal.show when no issues', () => {
    importQRAnswers.mockReturnValue(SUCCESS);
    makeManager().apply({});
    expect(validateModal.show).not.toHaveBeenCalled();
  });

  it('does not call showError on success', () => {
    importQRAnswers.mockReturnValue(SUCCESS);
    makeManager().apply({});
    expect(showError).not.toHaveBeenCalled();
  });
});

// ── apply — questionnaire mismatch warning ────────────────────────────────────
describe('QRAnswersManager.apply — questionnaire mismatch', () => {
  it('shows validateModal with mismatch warning', () => {
    importQRAnswers.mockReturnValue({
      ...SUCCESS,
      questionnaire: 'http://example.com/qs/other',
    });
    const questDoc = { rawFhir: { url: 'http://example.com/qs/current' } };
    makeManager({ questDoc }).apply({});
    expect(validateModal.show).toHaveBeenCalledTimes(1);
    const [, , { extraIssues: issues }] = validateModal.show.mock.calls[0];
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toContain('other');
    expect(issues[0].message).toContain('current');
  });

  it('does not warn when QR questionnaire matches loaded URL', () => {
    importQRAnswers.mockReturnValue({
      ...SUCCESS,
      questionnaire: 'http://example.com/qs/same',
    });
    const questDoc = { rawFhir: { url: 'http://example.com/qs/same' } };
    makeManager({ questDoc }).apply({});
    expect(validateModal.show).not.toHaveBeenCalled();
  });

  it('does not warn when QR has no questionnaire field', () => {
    importQRAnswers.mockReturnValue({ ...SUCCESS, questionnaire: '' });
    const questDoc = { rawFhir: { url: 'http://example.com/qs/current' } };
    makeManager({ questDoc }).apply({});
    expect(validateModal.show).not.toHaveBeenCalled();
  });
});

// ── apply — unmatched items warning ──────────────────────────────────────────
describe('QRAnswersManager.apply — unmatched items', () => {
  it('shows validateModal with unmatched warning', () => {
    importQRAnswers.mockReturnValue({ ...SUCCESS, unmatched: ['q1', 'q2'] });
    makeManager().apply({});
    expect(validateModal.show).toHaveBeenCalledTimes(1);
    const [, , { extraIssues: issues }] = validateModal.show.mock.calls[0];
    const msg = issues[0].message;
    expect(issues[0].severity).toBe('warning');
    expect(msg).toContain('2');
    expect(msg).toContain('q1');
    expect(msg).toContain('q2');
  });

  it('truncates preview to 5 items with ellipsis when > 5 unmatched', () => {
    importQRAnswers.mockReturnValue({
      ...SUCCESS,
      unmatched: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    });
    makeManager().apply({});
    const [, , { extraIssues: issues }] = validateModal.show.mock.calls[0];
    expect(issues[0].message).toContain('\u2026');
    // Items 6 and 7 ('f', 'g') must not appear as list entries
    expect(issues[0].message).not.toContain(', f');
    expect(issues[0].message).not.toContain(', g');
  });

  it('no ellipsis when exactly 5 unmatched', () => {
    importQRAnswers.mockReturnValue({
      ...SUCCESS,
      unmatched: ['a', 'b', 'c', 'd', 'e'],
    });
    makeManager().apply({});
    const [, , { extraIssues: issues }] = validateModal.show.mock.calls[0];
    expect(issues[0].message).not.toContain('\u2026');
  });

  it('modal title includes loaded count', () => {
    importQRAnswers.mockReturnValue({ ...SUCCESS, unmatched: ['q1'], loaded: 7 });
    makeManager().apply({});
    const [title] = validateModal.show.mock.calls[0];
    expect(title).toContain('7');
  });
});

// ── apply — both warnings together ───────────────────────────────────────────
describe('QRAnswersManager.apply — multiple issues', () => {
  it('shows validateModal with two issues when both conditions apply', () => {
    importQRAnswers.mockReturnValue({
      ...SUCCESS,
      questionnaire: 'http://other',
      unmatched: ['q1'],
    });
    const questDoc = { rawFhir: { url: 'http://current' } };
    makeManager({ questDoc }).apply({});
    const [, , { extraIssues: issues }] = validateModal.show.mock.calls[0];
    expect(issues).toHaveLength(2);
  });
});
