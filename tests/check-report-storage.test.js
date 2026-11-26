import { describe, test, expect, beforeEach } from 'vitest';
import { storeReport, loadReport, clearReport, CHECK_REPORT_KEY } from '../js/fhir/check/report-storage.js';

const report = { title: 'T', trials: Array.from({ length: 500 }, (_, i) => ({ answers: [`q${i} = a`], results: ['x'], qr: null })) };

function fakeStorage(limit) {
  const m = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => m.get(k) ?? null,
    removeItem: (k) => m.delete(k),
    setItem: (k, v) => { if (v.length > limit) throw new Error('quota'); m.set(k, v); },
  };
  return m;
}

describe('check report storage', () => {
  let m;
  beforeEach(() => { m = fakeStorage(Infinity); });

  test('a report that fits is stored as is and read back', async () => {
    expect(await storeReport(report)).toBe(true);
    expect(m.get(CHECK_REPORT_KEY).startsWith('{')).toBe(true);
    expect(await loadReport()).toEqual(report);
  });

  test('a report that does not fit as is is stored packed, whole, and read back', async () => {
    m = fakeStorage(JSON.stringify(report).length - 1);
    expect(await storeReport(report)).toBe(true);
    expect(m.get(CHECK_REPORT_KEY).startsWith('gz:')).toBe(true);
    expect(await loadReport()).toEqual(report);
  });

  test('a report too large even packed reports failure', async () => {
    fakeStorage(10);
    expect(await storeReport(report)).toBe(false);
  });

  test('clearing removes the stored report', async () => {
    await storeReport(report);
    clearReport();
    expect(m.has(CHECK_REPORT_KEY)).toBe(false);
    expect(await loadReport()).toBeNull();
  });

  test('nothing stored reads as null', async () => {
    expect(await loadReport()).toBeNull();
  });
});
