// Unit tests for TerminologyService in js/fhir/terminology-service.js.
// Mocks globalThis.fetch so no real network calls are made.

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

// ── Mock fetch before module import ───────────────────────────────────────────
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ── Response helpers ──────────────────────────────────────────────────────────
const makeOk = (body) => ({
  ok: true, status: 200, statusText: 'OK',
  headers: { get: () => null },
  json: () => Promise.resolve(body),
});

const makeErr = (status, statusText = 'Error') => ({
  ok: false, status, statusText,
  headers: { get: () => null },
  json: () => Promise.resolve({}),
});

const makeRetryable = (status) => ({
  ok: false, status, statusText: `HTTP ${status}`,
  headers: { get: () => null },
  json: () => Promise.resolve({}),
});

const VS_BODY = {
  resourceType: 'ValueSet',
  expansion: { contains: [
    { code: 'A', display: 'Alpha', system: 'https://example.com' },
    { code: 'B', display: 'Beta',  system: 'https://example.com' },
  ] },
};

const CAP_BODY = {
  resourceType: 'CapabilityStatement',
  software: { name: 'HAPI FHIR', version: '6.0' },
};

// Default implementation: all non-expected URLs reject.
const defaultImpl = (url) => {
  return Promise.reject(new Error('unexpected fetch: ' + String(url)));
};
mockFetch.mockImplementation(defaultImpl);

const { terminologyService } =
  await import('../js/fhir/terminology-service.js');
const DEFAULT_TERMINOLOGY_SERVER = 'https://tx.fhir.org/r4';

// Warmup: serverConfig.ready() resolves immediately (no config.json fetch needed).
// One mock consumed by the VS expand request.
beforeAll(async () => {
  mockFetch
    .mockImplementationOnce(() => Promise.resolve(makeOk({
      resourceType: 'ValueSet', expansion: { contains: [] },
    })));
  await terminologyService.expandValueSet('http://warmup', DEFAULT_TERMINOLOGY_SERVER);
  // Reset so tests start clean
  mockFetch.mockReset();
  mockFetch.mockImplementation(defaultImpl);
});

afterEach(() => {
  mockFetch.mockReset();
  mockFetch.mockImplementation(defaultImpl);
});

// ── DEFAULT_TERMINOLOGY_SERVER ────────────────────────────────────────────────
describe('DEFAULT_TERMINOLOGY_SERVER', () => {
  it('points to tx.fhir.org/r4', () => {
    expect(DEFAULT_TERMINOLOGY_SERVER).toMatch(/tx\.fhir\.org/);
  });
});

// ── getServer ─────────────────────────────────────────────────────────────────
describe('terminologyService.getServer', () => {
  it('uses node._preferredTermServer when set', () => {
    expect(terminologyService.getServer({ _preferredTermServer: 'https://node.example.com' }, {}))
      .toBe('https://node.example.com');
  });

  it('uses questMeta.preferredTermServer when node has none', () => {
    expect(terminologyService.getServer({}, { preferredTermServer: 'https://meta.example.com' }))
      .toBe('https://meta.example.com');
  });

  it('falls back to DEFAULT_TERMINOLOGY_SERVER', () => {
    expect(terminologyService.getServer({}, {})).toBe(DEFAULT_TERMINOLOGY_SERVER);
  });

  it('strips trailing slash', () => {
    expect(terminologyService.getServer({ _preferredTermServer: 'https://s.example.com/' }, {}))
      .toBe('https://s.example.com');
  });

  it('handles null node', () => {
    expect(terminologyService.getServer(null, {})).toBe(DEFAULT_TERMINOLOGY_SERVER);
  });

  it('node._preferredTermServer takes priority over questMeta', () => {
    const node = { _preferredTermServer: 'https://node.example.com' };
    const meta = { preferredTermServer: 'https://meta.example.com' };
    expect(terminologyService.getServer(node, meta)).toBe('https://node.example.com');
  });
});

// ── expandValueSet ────────────────────────────────────────────────────────────
describe('terminologyService.expandValueSet', () => {
  it('returns mapped options on success', async () => {
    mockFetch.mockResolvedValueOnce(makeOk(VS_BODY));
    const result = await terminologyService.expandValueSet('http://vs', DEFAULT_TERMINOLOGY_SERVER);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ code: 'A', display: 'Alpha', system: 'https://example.com' });
    expect(result[1]).toEqual({ code: 'B', display: 'Beta',  system: 'https://example.com' });
  });

  it('returns empty array when expansion.contains is empty', async () => {
    mockFetch.mockResolvedValueOnce(makeOk({ resourceType: 'ValueSet', expansion: { contains: [] } }));
    expect(await terminologyService.expandValueSet('http://vs', DEFAULT_TERMINOLOGY_SERVER)).toEqual([]);
  });

  it('uses code as display fallback when display is absent', async () => {
    mockFetch.mockResolvedValueOnce(makeOk({
      resourceType: 'ValueSet',
      expansion: { contains: [{ code: 'X', system: 'http://s.com' }] },
    }));
    const result = await terminologyService.expandValueSet('http://vs', DEFAULT_TERMINOLOGY_SERVER);
    expect(result[0].display).toBe('X');
  });

  it('uses empty string for missing code', async () => {
    mockFetch.mockResolvedValueOnce(makeOk({
      resourceType: 'ValueSet',
      expansion: { contains: [{ display: 'No code', system: 'http://s.com' }] },
    }));
    const result = await terminologyService.expandValueSet('http://vs', DEFAULT_TERMINOLOGY_SERVER);
    expect(result[0].code).toBe('');
  });

  it('throws on non-ok HTTP response', async () => {
    mockFetch.mockResolvedValueOnce(makeErr(404, 'Not Found'));
    await expect(terminologyService.expandValueSet('http://vs', DEFAULT_TERMINOLOGY_SERVER))
      .rejects.toThrow('HTTP 404 Not Found');
  });

  it('throws when response is not a ValueSet', async () => {
    mockFetch.mockResolvedValueOnce(makeOk({ resourceType: 'OperationOutcome' }));
    await expect(terminologyService.expandValueSet('http://vs', DEFAULT_TERMINOLOGY_SERVER))
      .rejects.toThrow('not a FHIR ValueSet');
  });

  it('falls back to default server when serverUrl is empty', async () => {
    mockFetch.mockResolvedValueOnce(makeOk(VS_BODY));
    await terminologyService.expandValueSet('http://vs', '');
    expect(mockFetch.mock.calls[0][0]).toContain('tx.fhir.org');
  });

  it('encodes the ValueSet URL as a query param', async () => {
    mockFetch.mockResolvedValueOnce(makeOk(VS_BODY));
    const vs = 'https://example.com/vs?v=1';
    await terminologyService.expandValueSet(vs, DEFAULT_TERMINOLOGY_SERVER);
    expect(mockFetch.mock.calls[0][0]).toContain(encodeURIComponent(vs));
  });
});

// ── expandWithFilter ──────────────────────────────────────────────────────────
describe('terminologyService.expandWithFilter', () => {
  it('returns mapped options on success', async () => {
    mockFetch.mockResolvedValueOnce(makeOk(VS_BODY));
    const result = await terminologyService.expandWithFilter('http://vs', DEFAULT_TERMINOLOGY_SERVER, 'a');
    expect(result).toHaveLength(2);
  });

  it('includes filter param in URL when provided', async () => {
    mockFetch.mockResolvedValueOnce(makeOk(VS_BODY));
    await terminologyService.expandWithFilter('http://vs', DEFAULT_TERMINOLOGY_SERVER, 'alpha');
    expect(mockFetch.mock.calls[0][0]).toContain('filter=alpha');
  });

  it('omits filter param when empty string', async () => {
    mockFetch.mockResolvedValueOnce(makeOk(VS_BODY));
    await terminologyService.expandWithFilter('http://vs', DEFAULT_TERMINOLOGY_SERVER, '');
    expect(mockFetch.mock.calls[0][0]).not.toContain('filter=');
  });

  it('omits filter param when whitespace-only', async () => {
    mockFetch.mockResolvedValueOnce(makeOk(VS_BODY));
    await terminologyService.expandWithFilter('http://vs', DEFAULT_TERMINOLOGY_SERVER, '   ');
    expect(mockFetch.mock.calls[0][0]).not.toContain('filter=');
  });

  it('respects custom count parameter', async () => {
    mockFetch.mockResolvedValueOnce(makeOk(VS_BODY));
    await terminologyService.expandWithFilter('http://vs', DEFAULT_TERMINOLOGY_SERVER, '', 25);
    expect(mockFetch.mock.calls[0][0]).toContain('_count=25');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(makeErr(400, 'Bad Request'));
    await expect(terminologyService.expandWithFilter('http://vs', DEFAULT_TERMINOLOGY_SERVER, 'x'))
      .rejects.toThrow('HTTP 400');
  });

  it('throws when response is not a ValueSet', async () => {
    mockFetch.mockResolvedValueOnce(makeOk({ resourceType: 'OperationOutcome' }));
    await expect(terminologyService.expandWithFilter('http://vs', DEFAULT_TERMINOLOGY_SERVER))
      .rejects.toThrow('not a FHIR ValueSet');
  });
});

// ── testServer ────────────────────────────────────────────────────────────────
describe('terminologyService.testServer', () => {
  it('returns ok:true with software name on success', async () => {
    mockFetch.mockResolvedValueOnce(makeOk(CAP_BODY));
    const result = await terminologyService.testServer('https://tx.fhir.org/r4');
    expect(result.ok).toBe(true);
    expect(result.message).toContain('HAPI FHIR');
  });

  it('returns ok:false for empty URL', async () => {
    const result = await terminologyService.testServer('');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/No URL/);
  });

  it('returns ok:false for null URL', async () => {
    const result = await terminologyService.testServer(null);
    expect(result.ok).toBe(false);
  });

  it('returns ok:false on non-ok HTTP response', async () => {
    mockFetch.mockResolvedValueOnce(makeErr(400, 'Bad Request'));
    const result = await terminologyService.testServer('https://tx.fhir.org/r4');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('400');
  });

  it('returns ok:false when response is not a CapabilityStatement', async () => {
    mockFetch.mockResolvedValueOnce(makeOk({ resourceType: 'OperationOutcome' }));
    const result = await terminologyService.testServer('https://tx.fhir.org/r4');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not a FHIR server/i);
  });

  it('returns ok:false on network error', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const promise = terminologyService.testServer('https://tx.fhir.org/r4');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Failed to fetch');
    vi.useRealTimers();
  });

  it('returns "OK" as message when software info is absent', async () => {
    mockFetch.mockResolvedValueOnce(makeOk({ resourceType: 'CapabilityStatement' }));
    const result = await terminologyService.testServer('https://tx.fhir.org/r4');
    expect(result.ok).toBe(true);
    expect(result.message).toBe('OK');
  });

  it('strips trailing slash from server URL before calling /metadata', async () => {
    mockFetch.mockResolvedValueOnce(makeOk(CAP_BODY));
    await terminologyService.testServer('https://tx.fhir.org/r4/');
    expect(mockFetch.mock.calls[0][0]).toContain('/metadata');
    expect(mockFetch.mock.calls[0][0]).not.toContain('//metadata');
  });

  it('calls onRetry callback on retry', async () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    // Fail once (retryable), then succeed
    mockFetch
      .mockResolvedValueOnce(makeRetryable(503))
      .mockResolvedValueOnce(makeOk(CAP_BODY));
    const promise = terminologyService.testServer('https://tx.fhir.org/r4', { onRetry });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.ok).toBe(true);
    expect(onRetry).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

// ── testExpand ────────────────────────────────────────────────────────────────
describe('terminologyService.testExpand', () => {
  it('returns ok:true with count message on success', async () => {
    mockFetch.mockResolvedValueOnce(makeOk(VS_BODY));
    const result = await terminologyService.testExpand('http://vs', DEFAULT_TERMINOLOGY_SERVER);
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/2 codes/);
    expect(result.count).toBe(2);
  });

  it('uses singular "code" for count of 1', async () => {
    mockFetch.mockResolvedValueOnce(makeOk({
      resourceType: 'ValueSet',
      expansion: { contains: [{ code: 'A', system: 'http://s.com' }] },
    }));
    const result = await terminologyService.testExpand('http://vs', DEFAULT_TERMINOLOGY_SERVER);
    expect(result.message).toMatch(/^1 code$/);
  });

  it('returns ok:false with message on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(makeErr(404, 'Not Found'));
    const result = await terminologyService.testExpand('http://vs', DEFAULT_TERMINOLOGY_SERVER);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('404');
  });

  it('returns ok:false for empty vsUrl', async () => {
    const result = await terminologyService.testExpand('');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/No URL/);
  });

  it('returns ok:false for null vsUrl', async () => {
    const result = await terminologyService.testExpand(null);
    expect(result.ok).toBe(false);
  });
});

// ── expandAll ─────────────────────────────────────────────────────────────────
describe('terminologyService.expandAll', () => {
  it('returns empty array for empty tree', async () => {
    expect(await terminologyService.expandAll([], {})).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty array when no node has answerValueSet', async () => {
    const tree = [{ id: 'q1', children: [] }, { id: 'q2', children: [] }];
    expect(await terminologyService.expandAll(tree, {})).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('expands and caches results on matching node', async () => {
    mockFetch.mockResolvedValueOnce(makeOk(VS_BODY));
    const node = { id: 'q1', _answerValueSet: 'http://vs', children: [] };
    const failures = await terminologyService.expandAll([node], {});
    expect(failures).toEqual([]);
    expect(node._vsCache).toHaveLength(2);
    expect(node._vsCache[0].code).toBe('A');
  });

  it('records failure and caches empty array on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce(makeErr(404, 'Not Found'));
    const node = { id: 'q1', _answerValueSet: 'http://vs', children: [] };
    const failures = await terminologyService.expandAll([node], {});
    expect(failures).toHaveLength(1);
    expect(failures[0].vsUrl).toBe('http://vs');
    expect(failures[0].node).toBe(node);
    expect(node._vsCache).toEqual([]);
  });

  it('enriches CORS TypeError with human-readable message', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const node = { id: 'q1', _answerValueSet: 'http://vs', children: [] };
    const promise = terminologyService.expandAll([node], {});
    await vi.runAllTimersAsync();
    const failures = await promise;
    expect(failures[0].error).toMatch(/CORS/i);
    vi.useRealTimers();
  });

  it('skips contained (#) ValueSet URLs', async () => {
    const node = { id: 'q1', _answerValueSet: '#local', children: [] };
    await terminologyService.expandAll([node], {});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('skips lookup-type nodes (they do on-demand search)', async () => {
    const node = { id: 'q1', _answerValueSet: 'http://vs', _itemControl: 'lookup', children: [] };
    await terminologyService.expandAll([node], {});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('recursively expands nodes in nested children', async () => {
    mockFetch.mockResolvedValueOnce(makeOk(VS_BODY));
    const child = { id: 'q2', _answerValueSet: 'http://vs', children: [] };
    const parent = { id: 'g1', children: [child] };
    await terminologyService.expandAll([parent], {});
    expect(child._vsCache).toHaveLength(2);
  });

  it('processes multiple failures independently', async () => {
    mockFetch
      .mockResolvedValueOnce(makeErr(404, 'Not Found'))
      .mockResolvedValueOnce(makeErr(404, 'Not Found'));
    const nodes = [
      { id: 'q1', _answerValueSet: 'http://vs1', children: [] },
      { id: 'q2', _answerValueSet: 'http://vs2', children: [] },
    ];
    const failures = await terminologyService.expandAll(nodes, {});
    expect(failures).toHaveLength(2);
    expect(failures[0].vsUrl).toBe('http://vs1');
    expect(failures[1].vsUrl).toBe('http://vs2');
  });

  it('uses node._preferredTermServer via getServer', async () => {
    mockFetch.mockResolvedValueOnce(makeOk(VS_BODY));
    const node = {
      id: 'q1',
      _answerValueSet: 'http://vs',
      _preferredTermServer: 'https://custom-server.example.com',
      children: [],
    };
    await terminologyService.expandAll([node], {});
    expect(mockFetch.mock.calls[0][0]).toContain('custom-server.example.com');
  });
});

// ── _fetchWithRetry — retry on transient errors ────────────────────────────
describe('_fetchWithRetry (via expandValueSet)', () => {
  it('retries on 503 and succeeds on second attempt', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(makeRetryable(503))
      .mockResolvedValueOnce(makeOk(VS_BODY));
    const promise = terminologyService.expandValueSet('http://vs', DEFAULT_TERMINOLOGY_SERVER);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('retries on 429 and succeeds', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(makeRetryable(429))
      .mockResolvedValueOnce(makeOk(VS_BODY));
    const promise = terminologyService.expandValueSet('http://vs', DEFAULT_TERMINOLOGY_SERVER);
    await vi.runAllTimersAsync();
    await promise;
    expect(mockFetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('throws after exhausting all retries', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(makeRetryable(503))
      .mockResolvedValueOnce(makeRetryable(503))
      .mockResolvedValueOnce(makeRetryable(503));
    const promise = terminologyService.expandValueSet('http://vs', DEFAULT_TERMINOLOGY_SERVER);
    // Attach rejection handler BEFORE running timers to prevent unhandled-rejection warning
    const check = expect(promise).rejects.toThrow('HTTP 503');
    await vi.runAllTimersAsync();
    await check;
    vi.useRealTimers();
  });

  it('retries on network error and succeeds', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockRejectedValueOnce(new TypeError('Network error'))
      .mockResolvedValueOnce(makeOk(VS_BODY));
    const promise = terminologyService.expandValueSet('http://vs', DEFAULT_TERMINOLOGY_SERVER);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toHaveLength(2);
    vi.useRealTimers();
  });
});
