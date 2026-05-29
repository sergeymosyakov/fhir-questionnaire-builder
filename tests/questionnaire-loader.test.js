// Unit tests for QuestionnaireLoader in js/fhir/questionnaire-loader.js.
// All DOM-dependent and heavy dependencies are mocked.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DOM stubs ─────────────────────────────────────────────────────────────────
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init?.detail; }
};
globalThis.document = { dispatchEvent: vi.fn() };

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('../js/ui/toast.js', () => ({ showError: vi.fn() }));
vi.mock('../js/fhir/import.js', () => ({ importFHIR: vi.fn() }));
vi.mock('../js/fhir/validate.js', () => ({ validateTree: vi.fn(() => []) }));
vi.mock('../js/ui/modals/validate-modal.js', () => ({ show: vi.fn() }));
vi.mock('../js/ui/progress.js', () => ({ show: vi.fn(), update: vi.fn(), hide: vi.fn() }));
vi.mock('../js/builder/index.js', () => ({
  renderTreeAsync: vi.fn(() => Promise.resolve()),
  renderTree: vi.fn(),
}));
vi.mock('../js/nodes/group-node.js', () => ({
  GroupNode: { resetCollapsedFromTree: vi.fn() },
}));
vi.mock('../js/fhir/terminology-service.js', () => ({
  terminologyService: { expandAll: vi.fn(() => Promise.resolve([])) },
}));
vi.mock('../js/ui/modals/load-confirm-modal.js', () => ({
  loadConfirmModal: { open: vi.fn(() => Promise.resolve('proceed')) },
}));
vi.mock('../js/utils.js', () => ({
  destroyTree: vi.fn(),
}));
vi.mock('../js/state.js', () => ({
  clearAllValues: vi.fn(),
  resetQuestMeta: vi.fn(),
  questVariables: [],
  questContained: [],
}));

const { QuestionnaireLoader }    = await import('../js/fhir/questionnaire-loader.js');
const { showError }              = await import('../js/ui/toast.js');
const { importFHIR }             = await import('../js/fhir/import.js');
const { validateTree }           = await import('../js/fhir/validate.js');
const validateModal              = await import('../js/ui/modals/validate-modal.js');
const progress                   = await import('../js/ui/progress.js');
const { renderTreeAsync, renderTree } = await import('../js/builder/index.js');
const { GroupNode }              = await import('../js/nodes/group-node.js');
const { terminologyService }     = await import('../js/fhir/terminology-service.js');
const { loadConfirmModal }       = await import('../js/ui/modals/load-confirm-modal.js');
const { destroyTree }            = await import('../js/utils.js');
const state                      = await import('../js/state.js');

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeLoader(overrides = {}) {
  const defaults = {
    tree:       [],
    values:     {},
    questMeta:  {},
    reinitForm: vi.fn(() => Promise.resolve()),
  };
  return new QuestionnaireLoader({ ...defaults, ...overrides });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset default mock return values
  importFHIR.mockImplementation(() => {});
  validateTree.mockReturnValue([]);
  renderTreeAsync.mockResolvedValue(undefined);
  terminologyService.expandAll.mockResolvedValue([]);
  loadConfirmModal.open.mockResolvedValue('proceed');
});

// ── confirmBeforeLoad ─────────────────────────────────────────────────────────
describe('QuestionnaireLoader.confirmBeforeLoad', () => {
  it('resolves to "proceed" immediately for empty tree', async () => {
    const loader = makeLoader({ tree: [] });
    const result = await loader.confirmBeforeLoad();
    expect(result).toBe('proceed');
    expect(loadConfirmModal.open).not.toHaveBeenCalled();
  });

  it('opens loadConfirmModal when tree has items', async () => {
    const loader = makeLoader({ tree: [{ id: 'g1', type: 'group', children: [] }] });
    loadConfirmModal.open.mockResolvedValue('proceed');
    const result = await loader.confirmBeforeLoad();
    expect(loadConfirmModal.open).toHaveBeenCalledTimes(1);
    expect(result).toBe('proceed');
  });

  it('forwards "cancel" from loadConfirmModal', async () => {
    const loader = makeLoader({ tree: [{ id: 'g1', type: 'group', children: [] }] });
    loadConfirmModal.open.mockResolvedValue('cancel');
    const result = await loader.confirmBeforeLoad();
    expect(result).toBe('cancel');
  });
});

// ── load — happy path ─────────────────────────────────────────────────────────
describe('QuestionnaireLoader.load — success', () => {
  it('calls importFHIR with the raw data', async () => {
    const data = { resourceType: 'Questionnaire' };
    await makeLoader().load(data, 'test.json');
    expect(importFHIR).toHaveBeenCalledWith(data, expect.any(Function));
  });

  it('calls GroupNode.resetCollapsedFromTree', async () => {
    await makeLoader().load({}, 'test.json');
    expect(GroupNode.resetCollapsedFromTree).toHaveBeenCalledTimes(1);
  });

  it('calls reinitForm', async () => {
    const reinitForm = vi.fn(() => Promise.resolve());
    await makeLoader({ reinitForm }).load({}, 'test.json');
    expect(reinitForm).toHaveBeenCalled();
  });

  it('dispatches QUESTIONNAIRE_LOADED event with fileName', async () => {
    await makeLoader().load({}, 'my-qs.json');
    const calls = document.dispatchEvent.mock.calls;
    const loadedEvt = calls.find(c => c[0].type === 'questionnaire-loaded');
    expect(loadedEvt).toBeDefined();
    expect(loadedEvt[0].detail.fileName).toBe('my-qs.json');
  });

  it('calls renderTreeAsync', async () => {
    await makeLoader().load({}, 'test.json');
    expect(renderTreeAsync).toHaveBeenCalledTimes(1);
  });

  it('calls progress.show before render, progress.hide in finally', async () => {
    await makeLoader().load({}, 'test.json');
    expect(progress.show).toHaveBeenCalledTimes(1);
    expect(progress.hide).toHaveBeenCalledTimes(1);
  });

  it('calls terminologyService.expandAll after render', async () => {
    await makeLoader().load({}, 'test.json');
    expect(terminologyService.expandAll).toHaveBeenCalledTimes(1);
  });

  it('does not call validateModal.show when no validation issues', async () => {
    validateTree.mockReturnValue([]);
    await makeLoader().load({}, 'test.json');
    expect(validateModal.show).not.toHaveBeenCalled();
  });
});

// ── load — import error ───────────────────────────────────────────────────────
describe('QuestionnaireLoader.load — import error', () => {
  it('calls showError on importFHIR throw', async () => {
    importFHIR.mockImplementation(() => { throw new Error('invalid FHIR'); });
    await makeLoader().load({}, 'bad.json');
    expect(showError).toHaveBeenCalledWith('Import error: invalid FHIR');
  });

  it('still calls progress.hide after import error', async () => {
    importFHIR.mockImplementation(() => { throw new Error('oops'); });
    await makeLoader().load({}, 'bad.json');
    expect(progress.hide).toHaveBeenCalledTimes(1);
  });

  it('does not call renderTreeAsync after import error', async () => {
    importFHIR.mockImplementation(() => { throw new Error('oops'); });
    await makeLoader().load({}, 'bad.json');
    expect(renderTreeAsync).not.toHaveBeenCalled();
  });
});

// ── load — validation issues ──────────────────────────────────────────────────
describe('QuestionnaireLoader.load — validation issues', () => {
  it('calls validateModal.show with issues', async () => {
    validateTree.mockReturnValue([
      { severity: 'error', nodeId: 'q1', message: 'Duplicate linkId' },
    ]);
    await makeLoader().load({}, 'test.json');
    expect(validateModal.show).toHaveBeenCalledTimes(1);
    const [title, issues, mode] = validateModal.show.mock.calls[0];
    expect(title).toContain('Validation Report');
    expect(issues[0].message).toContain('Duplicate linkId');
    expect(mode).toBe('import');
  });
});

// ── load — ValueSet expansion failures ───────────────────────────────────────
describe('QuestionnaireLoader.load — VS expansion failures', () => {
  it('calls validateModal.show with expansion failures', async () => {
    terminologyService.expandAll.mockResolvedValueOnce([
      { node: { id: 'q1' }, vsUrl: 'http://vs', server: 'https://tx.fhir.org/r4', error: 'timeout' },
    ]);
    await makeLoader().load({}, 'test.json');
    // validateModal.show called once for expansion errors
    const showCalls = validateModal.show.mock.calls;
    const expansionCall = showCalls.find(c => c[0].includes('ValueSet'));
    expect(expansionCall).toBeDefined();
    expect(expansionCall[1][0].message).toContain('http://vs');
  });

  it('does not call validateModal.show for VS when no failures', async () => {
    terminologyService.expandAll.mockResolvedValue([]);
    await makeLoader().load({}, 'test.json');
    const showCalls = validateModal.show.mock.calls;
    const expansionCall = showCalls.find(c => c[0]?.includes('ValueSet'));
    expect(expansionCall).toBeUndefined();
  });

  it('increments _importSeq on each load, so stale expansions are ignored', async () => {
    // Two sequential loads — the second increments _importSeq past the first,
    // so if the first expansion resolves late it is a no-op.
    const loader = makeLoader();
    await loader.load({}, 'first.json');
    await loader.load({}, 'second.json');
    // Both complete without error; expandAll called twice
    expect(terminologyService.expandAll).toHaveBeenCalledTimes(2);
  });
});

// ── reset() ───────────────────────────────────────────────────────────────────
describe('QuestionnaireLoader.reset', () => {
  it('calls destroyTree with the tree array', () => {
    const tree = [{ id: 'g1' }];
    const loader = makeLoader({ tree });
    loader.reset();
    expect(destroyTree).toHaveBeenCalledWith(tree);
  });

  it('calls clearAllValues', () => {
    const loader = makeLoader();
    loader.reset();
    expect(state.clearAllValues).toHaveBeenCalledTimes(1);
  });

  it('calls resetQuestMeta', () => {
    const loader = makeLoader();
    loader.reset();
    expect(state.resetQuestMeta).toHaveBeenCalledTimes(1);
  });

  it('calls renderTree', () => {
    const loader = makeLoader();
    loader.reset();
    expect(renderTree).toHaveBeenCalledTimes(1);
  });

  it('dispatches QUESTIONNAIRE_CLEARED event', () => {
    const loader = makeLoader();
    loader.reset();
    const calls = document.dispatchEvent.mock.calls;
    const evt = calls.find(c => c[0].type === 'questionnaire-cleared');
    expect(evt).toBeDefined();
  });

  it('clears rawFhir.value when rawFhir is provided', () => {
    const rawFhir = { value: { resourceType: 'Questionnaire' } };
    const loader = makeLoader({ rawFhir });
    loader.reset();
    expect(rawFhir.value).toBeNull();
  });

  it('does not throw when rawFhir is not provided', () => {
    const loader = makeLoader();
    expect(() => loader.reset()).not.toThrow();
  });

  it('calls clearDraft when resetFlow is configured', () => {
    const clearDraft = vi.fn();
    const loader = makeLoader();
    loader.configureResetFlow({
      confirmOpen: vi.fn(),
      promptExport: vi.fn(),
      showValidateExport: vi.fn(),
      clearDraft,
    });
    loader.reset();
    expect(clearDraft).toHaveBeenCalledTimes(1);
  });

  it('does not throw when resetFlow is not configured (no clearDraft)', () => {
    const loader = makeLoader();
    expect(() => loader.reset()).not.toThrow();
  });

  it('splices questVariables and questContained', () => {
    state.questVariables.push({ name: 'v1' });
    state.questContained.push({ id: 'vs1' });
    const loader = makeLoader();
    loader.reset();
    expect(state.questVariables.length).toBe(0);
    expect(state.questContained.length).toBe(0);
  });
});

// ── configureResetFlow() ───────────────────────────────────────────────────────
describe('QuestionnaireLoader.configureResetFlow', () => {
  it('stores the provided callbacks in _resetFlow', () => {
    const callbacks = {
      confirmOpen: vi.fn(),
      promptExport: vi.fn(),
      showValidateExport: vi.fn(),
      clearDraft: vi.fn(),
    };
    const loader = makeLoader();
    loader.configureResetFlow(callbacks);
    expect(loader._resetFlow).toStrictEqual(callbacks);
  });
});

// ── confirmAndReset() ─────────────────────────────────────────────────────────
describe('QuestionnaireLoader.confirmAndReset', () => {
  function makeFlowLoader(treeItems = []) {
    const loader = makeLoader({ tree: treeItems });
    const confirmOpen     = vi.fn();
    const promptExport    = vi.fn();
    const showValidateExport = vi.fn();
    const clearDraft      = vi.fn();
    loader.configureResetFlow({ confirmOpen, promptExport, showValidateExport, clearDraft });
    return { loader, confirmOpen, promptExport, showValidateExport, clearDraft };
  }

  it('calls reset() immediately when tree is empty', async () => {
    const { loader, confirmOpen } = makeFlowLoader([]);
    await loader.confirmAndReset();
    expect(confirmOpen).not.toHaveBeenCalled();
    expect(state.clearAllValues).toHaveBeenCalledTimes(1);
  });

  it('calls reset() directly when _resetFlow is not configured', async () => {
    const loader = makeLoader({ tree: [{ id: 'g1' }] });
    await loader.confirmAndReset();
    expect(state.clearAllValues).toHaveBeenCalledTimes(1);
  });

  it('does nothing when user picks cancel', async () => {
    const { loader, confirmOpen } = makeFlowLoader([{ id: 'g1' }]);
    confirmOpen.mockResolvedValue('cancel');
    await loader.confirmAndReset();
    expect(state.clearAllValues).not.toHaveBeenCalled();
  });

  it('calls reset() when user picks clear (not cancel/export)', async () => {
    const { loader, confirmOpen } = makeFlowLoader([{ id: 'g1' }]);
    confirmOpen.mockResolvedValue('clear');
    await loader.confirmAndReset();
    expect(state.clearAllValues).toHaveBeenCalledTimes(1);
  });

  it('calls promptExport (no issues) when user picks export', async () => {
    const { loader, confirmOpen, promptExport } = makeFlowLoader([{ id: 'g1' }]);
    confirmOpen.mockResolvedValue('export');
    validateTree.mockReturnValue([]);
    await loader.confirmAndReset();
    expect(promptExport).toHaveBeenCalledTimes(1);
    // callback passed to promptExport calls reset
    const [onDone] = promptExport.mock.calls[0];
    onDone();
    expect(state.clearAllValues).toHaveBeenCalledTimes(1);
  });

  it('calls showValidateExport (with issues) when user picks export', async () => {
    const { loader, confirmOpen, promptExport, showValidateExport } = makeFlowLoader([{ id: 'g1' }]);
    confirmOpen.mockResolvedValue('export');
    validateTree.mockReturnValue([{ severity: 'error', nodeId: 'q1', message: 'bad' }]);
    await loader.confirmAndReset();
    expect(showValidateExport).toHaveBeenCalledTimes(1);
    expect(promptExport).not.toHaveBeenCalled();
    // callback passed to showValidateExport calls promptExport → then reset
    const [, onExport] = showValidateExport.mock.calls[0];
    onExport();
    expect(promptExport).toHaveBeenCalledTimes(1);
  });
});
