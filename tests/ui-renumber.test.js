import { describe, test, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ show: vi.fn(), hide: vi.fn(), showError: vi.fn() }));
vi.mock('../js/ui/custom-select.js', () => ({ createCustomSelect: () => ({ el: { dataset: {} } }) }));
vi.mock('../js/ui/progress.js', () => ({ show: h.show, hide: h.hide, update: () => {} }));
vi.mock('../js/ui/toast.js', () => ({ showError: h.showError }));

let btn;
beforeEach(() => {
  Object.values(h).forEach(f => f.mockClear());
  btn = { disabled: false };
  const mount = { appendChild() {} };
  globalThis.document = {
    querySelector: sel => (sel.includes('renumber-btn') ? btn : mount),
    addEventListener() {}, removeEventListener() {},
  };
});

describe('RenumberControl', () => {
  test('failure shows the error and cleans up', async () => {
    const { RenumberControl } = await import('../js/ui/renumber-control.js');
    new RenumberControl({ renumberAll: async () => { throw new Error('boom'); } });
    await btn.onclick();
    expect(h.showError).toHaveBeenCalledWith('boom');
    expect(h.hide).toHaveBeenCalled();
    expect(btn.disabled).toBe(false);
  });
});
