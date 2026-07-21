// ── Unit tests: js/fhir/qr-export.js ─────────────────────────────────────────
// exportQR uses document / Blob / URL globals — mocked via vi.stubGlobal
// since vitest runs in `node` environment.

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FHIR } from '../js/fhir/urls/fhir.js';

// ── Module mocks (hoisted automatically by vitest) ────────────────────────────

vi.mock('../js/state.js', () => ({
  values: {},
  previewMode: { value: 'preview' },
}));

vi.mock('../js/fhir/export.js', () => ({
  buildFHIRObject: vi.fn(() => ({ resourceType: 'Questionnaire', id: 'test-q', item: [] })),
}));

vi.mock('../js/fhir/qr-builder.js', () => ({
  buildQR: vi.fn(() => ({ resourceType: 'QuestionnaireResponse', item: [] })),
}));

// ── Imports (resolved AFTER vi.mock hoisting) ─────────────────────────────────

import { exportQR, configure as configureQrExport } from '../js/fhir/qr-export.js';
import { buildFHIRObject } from '../js/fhir/export.js';
import { buildQR }         from '../js/fhir/qr-builder.js';

// _svc injection — exportQR needs answerStore from _svc, not state.js
configureQrExport({ answerStore: { data: {}, toValueMap() { return this.data; } } });

// ── DOM stub helpers ──────────────────────────────────────────────────────────

let mockAnchor;
let createObjectURLMock;
let revokeObjectURLMock;

beforeEach(() => {
  buildFHIRObject.mockClear();
  buildQR.mockClear();

  mockAnchor = { href: '', download: '', click: vi.fn() };
  createObjectURLMock = vi.fn(() => 'blob:mock-url');
  revokeObjectURLMock = vi.fn();

  vi.stubGlobal('document', {
    createElement: vi.fn(() => mockAnchor),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
  });
  vi.stubGlobal('Blob', class MockBlob {
    constructor(parts, opts) { this.parts = parts; this.type = opts?.type; }
  });
  vi.stubGlobal('URL', {
    createObjectURL: createObjectURLMock,
    revokeObjectURL: revokeObjectURLMock,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('exportQR — FHIR building', () => {
  it('calls buildFHIRObject once', () => {
    exportQR('test.json');
    expect(buildFHIRObject).toHaveBeenCalledOnce();
  });

  it('passes the Questionnaire and values to buildQR', () => {
    exportQR('test.json');
    const fhirQ = buildFHIRObject.mock.results[0].value;
    expect(buildQR).toHaveBeenCalledWith(fhirQ, {});
  });
});

describe('exportQR — QR metadata', () => {
  it('sets status to "in-progress" by default (no meta)', () => {
    exportQR('test.json');
    expect(buildQR.mock.results[0].value.status).toBe('in-progress');
  });

  it('uses meta.status when provided', () => {
    exportQR('test.json', { status: 'completed' });
    expect(buildQR.mock.results[0].value.status).toBe('completed');
  });

  it('does not set subject when meta.subject is absent', () => {
    exportQR('test.json');
    expect(buildQR.mock.results[0].value.subject).toBeUndefined();
  });

  it('sets subject.reference when meta.subject is provided', () => {
    exportQR('test.json', { subject: 'Patient/123' });
    expect(buildQR.mock.results[0].value.subject).toEqual({ reference: 'Patient/123' });
  });

  it('does not set author when meta.author is absent', () => {
    exportQR('test.json');
    expect(buildQR.mock.results[0].value.author).toBeUndefined();
  });

  it('sets author.reference when meta.author is provided', () => {
    exportQR('test.json', { author: 'Practitioner/99' });
    expect(buildQR.mock.results[0].value.author).toEqual({ reference: 'Practitioner/99' });
  });

  it('sets authored as a valid ISO date string', () => {
    exportQR('test.json');
    const authored = buildQR.mock.results[0].value.authored;
    expect(typeof authored).toBe('string');
    // Must parse as a valid date and round-trip
    expect(new Date(authored).toISOString()).toBe(authored);
  });
});

describe('exportQR — file download', () => {
  it('uses the provided filename', () => {
    exportQR('my-response.json');
    expect(mockAnchor.download).toBe('my-response.json');
  });

  it('falls back to "questionnaire-response.json" when filename is omitted', () => {
    exportQR();
    expect(mockAnchor.download).toBe('questionnaire-response.json');
  });

  it('falls back to default filename when undefined is passed', () => {
    exportQR(undefined);
    expect(mockAnchor.download).toBe('questionnaire-response.json');
  });

  it('clicks the anchor element to trigger the download', () => {
    exportQR('test.json');
    expect(mockAnchor.click).toHaveBeenCalledOnce();
  });

  it('creates a blob URL and assigns it to the anchor href', () => {
    exportQR('test.json');
    expect(createObjectURLMock).toHaveBeenCalledOnce();
    expect(mockAnchor.href).toBe('blob:mock-url');
  });

  it('revokes the blob URL after click', () => {
    exportQR('test.json');
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
  });

  it('creates the blob with application/json mime type', () => {
    exportQR('test.json');
    const blobArg = createObjectURLMock.mock.calls[0][0];
    expect(blobArg.type).toBe('application/json');
  });

  it('serialises the QR as pretty-printed JSON in the blob', () => {
    exportQR('test.json');
    const qr = buildQR.mock.results[0].value;
    const blobArg = createObjectURLMock.mock.calls[0][0];
    expect(blobArg.parts[0]).toBe(JSON.stringify(qr, null, 2));
  });
});

// ── exportQR — new QR fields (id, language, meta) ────────────────────────────
describe('exportQR — id, language and meta block', () => {
  it('does not set id when meta.id is absent', () => {
    exportQR('test.json');
    expect(buildQR.mock.results[0].value.id).toBeUndefined();
  });

  it('sets id when meta.id is provided', () => {
    exportQR('test.json', { id: 'my-response-42' });
    expect(buildQR.mock.results[0].value.id).toBe('my-response-42');
  });

  it('does not set language when meta.language is absent', () => {
    exportQR('test.json');
    expect(buildQR.mock.results[0].value.language).toBeUndefined();
  });

  it('sets language when meta.language is provided', () => {
    exportQR('test.json', { language: 'nl' });
    expect(buildQR.mock.results[0].value.language).toBe('nl');
  });

  it('always writes meta.lastUpdated as an ISO date string', () => {
    exportQR('test.json');
    const { meta } = buildQR.mock.results[0].value;
    expect(meta).toBeDefined();
    expect(typeof meta.lastUpdated).toBe('string');
    expect(new Date(meta.lastUpdated).toISOString()).toBe(meta.lastUpdated);
  });

  it('writes meta.versionId when provided', () => {
    exportQR('test.json', { metaVersionId: '7' });
    expect(buildQR.mock.results[0].value.meta.versionId).toBe('7');
  });

  it('omits meta.versionId when absent', () => {
    exportQR('test.json');
    expect(buildQR.mock.results[0].value.meta.versionId).toBeUndefined();
  });

  it('writes meta.source when provided', () => {
    exportQR('test.json', { metaSource: 'https://example.org/qr' });
    expect(buildQR.mock.results[0].value.meta.source).toBe('https://example.org/qr');
  });

  it('writes meta.profile when provided', () => {
    exportQR('test.json', { metaProfile: [FHIR.sd + '/qr-profile'] });
    expect(buildQR.mock.results[0].value.meta.profile).toEqual([FHIR.sd + '/qr-profile']);
  });

  it('omits meta.profile when empty array', () => {
    exportQR('test.json', { metaProfile: [] });
    expect(buildQR.mock.results[0].value.meta.profile).toBeUndefined();
  });

  it('writes meta.tag when provided (filters empty codes)', () => {
    exportQR('test.json', { metaTag: [{ code: 'tag1', system: 'https://example.org' }, { code: '' }] });
    const tag = buildQR.mock.results[0].value.meta.tag;
    expect(tag).toHaveLength(1);
    expect(tag[0].code).toBe('tag1');
  });

  it('omits meta.tag when empty array', () => {
    exportQR('test.json', { metaTag: [] });
    expect(buildQR.mock.results[0].value.meta.tag).toBeUndefined();
  });

  it('writes meta.security when provided (filters empty codes)', () => {
    exportQR('test.json', { metaSecurity: [{ code: 'restricted' }, { code: '  ' }] });
    const sec = buildQR.mock.results[0].value.meta.security;
    expect(sec).toHaveLength(1);
    expect(sec[0].code).toBe('restricted');
  });

  it('omits meta.security when empty array', () => {
    exportQR('test.json', { metaSecurity: [] });
    expect(buildQR.mock.results[0].value.meta.security).toBeUndefined();
  });

  it('sets id when meta.id provided', () => {
    exportQR('test.json', { id: 'my-qr-id' });
    expect(buildQR.mock.results[0].value.id).toBe('my-qr-id');
  });

  it('sets language when meta.language provided', () => {
    exportQR('test.json', { language: 'de' });
    expect(buildQR.mock.results[0].value.language).toBe('de');
  });
});
