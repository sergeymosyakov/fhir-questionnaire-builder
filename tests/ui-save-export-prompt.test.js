import { describe, test, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ validateOpts: null, promptCb: null, onCancel: vi.fn() }));

vi.mock('../js/ui/modals/modal-base.js', () => ({
  Modal: class {
    constructor() { this.body = { appendChild() {} }; }
    open() {} close() {} setTitle() {}
  },
}));
vi.mock('../js/ui/custom-select.js', () => ({ createCustomSelect: () => ({ el: {}, setValue() {} }) }));
vi.mock('../js/fhir/export.js', () => ({ buildFHIRObject: () => ({}) }));
vi.mock('../js/fhir/download.js', () => ({ downloadJSON: () => {} }));
vi.mock('../js/fhir/format-registry.js', () => {
  const fmt = { id: 'R4', label: 'R4', ext: 'json', build: () => '{}', onCancel: () => h.onCancel() };
  return { formatRegistry: { getAll: () => [fmt], get: id => (id === 'R4' ? fmt : null) } };
});
vi.mock('../js/ui/modals/validate-modal.js', () => ({ show: (_t, _m, opts) => { h.validateOpts = opts; } }));
vi.mock('../js/ui/toast.js', () => ({ showPrompt: (_l, _d, cb) => { h.promptCb = cb; } }));

let modal;
beforeEach(async () => {
  h.validateOpts = null; h.promptCb = null; h.onCancel.mockClear();
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.document = {
    dispatchEvent() {}, addEventListener() {},
    createElement: () => ({ appendChild() {}, append() {} }),
  };
  ({ saveFormatModal: modal } = await import('../js/ui/modals/save-format-modal.js'));
});

describe('SaveFormatModal onDone', () => {
  test('cancel calls onDone once', () => {
    const onDone = vi.fn();
    modal.open({ tree: [], values: {}, onDone });
    modal._cancel();
    modal._cancel();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('completed export calls onDone once', () => {
    const onDone = vi.fn();
    modal.open({ tree: [], values: {}, onDone });
    modal._apply();
    h.validateOpts.onExport();
    expect(onDone).not.toHaveBeenCalled();
    h.promptCb('file');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('cancelled filename prompt calls onDone', () => {
    const onDone = vi.fn();
    modal.open({ tree: [], values: {}, onDone });
    modal._apply();
    h.validateOpts.onExport();
    h.promptCb(null);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('dismissed validation report calls onDone', () => {
    const onDone = vi.fn();
    modal.open({ tree: [], values: {}, onDone });
    modal._apply();
    h.validateOpts.onDismiss();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('format onCancel runs on dismissal and on a cancelled prompt, not after an export', () => {
    modal.open({ tree: [], values: {} });
    h.onCancel.mockClear(); // open() resets the previous format's side effects
    modal._apply();
    h.validateOpts.onDismiss();
    expect(h.onCancel).toHaveBeenCalledTimes(1);

    modal.open({ tree: [], values: {} });
    h.onCancel.mockClear();
    modal._apply();
    h.validateOpts.onExport();
    h.promptCb(null);
    expect(h.onCancel).toHaveBeenCalledTimes(1);

    modal.open({ tree: [], values: {} });
    h.onCancel.mockClear();
    modal._apply();
    h.validateOpts.onExport();
    h.promptCb('file');
    expect(h.onCancel).not.toHaveBeenCalled();
  });

  test('open without onDone does not throw', () => {
    modal.open({ tree: [], values: {} });
    expect(() => modal._cancel()).not.toThrow();
  });
});
