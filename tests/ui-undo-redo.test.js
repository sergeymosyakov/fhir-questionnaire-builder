import { describe, test, expect, vi, beforeEach } from 'vitest';

const hist = vi.hoisted(() => ({
  init: vi.fn(), undo: vi.fn(), redo: vi.fn(), canUndo: () => true, canRedo: () => true,
}));
vi.mock('../js/ui/history.js', () => hist);
vi.mock('../js/fhir/export.js', () => ({ buildFHIRObject: () => ({}) }));
vi.mock('../js/fhir/import.js', () => ({ importFHIR: () => {} }));

let keydown;
let backdrops;

beforeEach(async () => {
  hist.undo.mockClear(); hist.redo.mockClear();
  backdrops = [];
  const btn = () => ({ addEventListener() {}, disabled: false });
  globalThis.document = {
    querySelector: () => btn(),
    querySelectorAll: () => backdrops,
    addEventListener: (type, fn) => { if (type === 'keydown') keydown = fn; },
  };
  const { UndoRedo } = await import('../js/ui/undo-redo.js');
  new UndoRedo();
});

const key = (extra = {}) => {
  const e = { key: 'z', ctrlKey: true, shiftKey: false, target: { closest: () => null }, preventDefault: vi.fn(), ...extra };
  keydown(e);
  return e;
};

describe('UndoRedo keyboard shortcuts', () => {
  test('Ctrl+Z undoes and prevents default on a plain target', () => {
    const e = key();
    expect(hist.undo).toHaveBeenCalledTimes(1);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  test('Ctrl+Y redoes', () => {
    key({ key: 'y' });
    expect(hist.redo).toHaveBeenCalledTimes(1);
  });

  test('ignored when typing in an editable element', () => {
    const e = key({ target: { closest: () => ({}) } });
    expect(hist.undo).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('ignored while a modal is open', () => {
    backdrops = [{ style: { display: 'none' } }, { style: { display: 'flex' } }];
    key();
    expect(hist.undo).not.toHaveBeenCalled();
  });

  test('works when all modals are hidden', () => {
    backdrops = [{ style: { display: 'none' } }];
    key();
    expect(hist.undo).toHaveBeenCalledTimes(1);
  });
});
