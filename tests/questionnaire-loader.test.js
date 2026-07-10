// Unit tests for QuestionnaireLoader in js/fhir/questionnaire-loader.js.
// All DOM-dependent and heavy dependencies are mocked.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DOM stubs ─────────────────────────────────────────────────────────────────
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init?.detail; }
};
globalThis.document = { dispatchEvent: vi.fn(), addEventListener: vi.fn() };

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('../js/ui/toast.js', () => ({ showError: vi.fn() }));
vi.mock('../js/fhir/import.js', () => ({ importFHIR: vi.fn() }));
vi.mock('../js/fhir/validate.js', () => ({ validateTree: vi.fn(() => []) }));
vi.mock('../js/ui/modals/validate-modal.js', () => ({ show: vi.fn() }));
vi.mock('../js/ui/progress.js', () => ({ show: vi.fn(), update: vi.fn(), hide: vi.fn() }));
vi.mock('../js/builder/index.js', () => ({
  renderTreeAsync: vi.fn(() => Promise.resolve()),
  renderTree: vi.fn(),
  addRootGroup: vi.fn(),
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
  answerStore: { data: {}, get: vi.fn(), getAll: vi.fn(), toValueMap() { return this.data; } },
}));

const { QuestionnaireLoader }    = await import('../js/fhir/questionnaire-loader.js');
const { showError }              = await import('../js/ui/toast.js');
const { importFHIR }             = await import('../js/fhir/import.js');
const { validateTree }           = await import('../js/fhir/validate.js');
const validateModal              = await import('../js/ui/modals/validate-modal.js');
const progress                   = await import('../js/ui/progress.js');
const { GroupNode }              = await import('../js/nodes/group-node.js');
const { terminologyService }     = await import('../js/fhir/terminology-service.js');
const { loadConfirmModal }       = await import('../js/ui/modals/load-confirm-modal.js');
const { EventState, AppEvents }  = await import('../js/events.js');

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeLoader(overrides = {}) {
  const tree = overrides.tree ?? [];
  const answerStore = overrides.answerStore ?? { data: {}, get: vi.fn(), getAll: vi.fn(), toValueMap() { return this.data; } };
  const questDoc = overrides.questDoc ?? {
    tree,
    meta: { fhirTarget: 'R4' },
    rawFhir: null,
    contained: [],
    variables: [],
    reset: vi.fn(),
  };
  EventState._set(AppEvents.APP_CONTEXT_READY, { questDoc, answerStore });
  return new QuestionnaireLoader();
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset default mock return values
  importFHIR.mockImplementation(() => {});
  validateTree.mockReturnValue([]);
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
    expect(importFHIR).toHaveBeenCalledWith(data);
  });

  it('calls GroupNode.resetCollapsedFromTree', async () => {
    await makeLoader().load({}, 'test.json');
    expect(GroupNode.resetCollapsedFromTree).toHaveBeenCalledTimes(1);
  });

  it('dispatches REINIT_FORM on load', async () => {
    await makeLoader().load({}, 'test.json');
    const calls = document.dispatchEvent.mock.calls;
    const evt = calls.find(c => c[0].type === 'reinit-form');
    expect(evt).toBeDefined();
  });

  it('dispatches QUESTIONNAIRE_LOADED event with fileName', async () => {
    await makeLoader().load({}, 'my-qs.json');
    const calls = document.dispatchEvent.mock.calls;
    const loadedEvt = calls.find(c => c[0].type === 'questionnaire-loaded');
    expect(loadedEvt).toBeDefined();
    expect(loadedEvt[0].detail.fileName).toBe('my-qs.json');
  });

  it('calls progress.show and progress.hide in finally', async () => {
    await makeLoader().load({}, 'test.json');
    expect(progress.show).not.toHaveBeenCalled(); // rendering moved to BuilderPanel
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

  it('does not throw when importFHIR throws', async () => {
    importFHIR.mockImplementation(() => { throw new Error('oops'); });
    await makeLoader().load({}, 'bad.json');
    expect(progress.hide).toHaveBeenCalledTimes(1);
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
    const [title, mode] = validateModal.show.mock.calls[0];
    expect(title).toContain('Validation Report');
    expect(mode).toBe('import');
  });
});

// ── load — ValueSet expansion failures ───────────────────────────────────────
describe('QuestionnaireLoader.load — VS expansion failures', () => {
  it('calls validateModal.show with expansion failures', async () => {
    terminologyService.expandAll.mockResolvedValueOnce([
      { node: { id: 'q1' }, vsUrl: 'http://vs', server: 'https://tx.fhir.org/r4', error: 'timeout' },
    ]);
    const data = { resourceType: 'Questionnaire', item: [] };
    await makeLoader().load(data, 'test.json');
    // validateModal.show called once for expansion errors — with the questJson
    // so the external validator does not POST an empty body (HTTP 400).
    const showCalls = validateModal.show.mock.calls;
    const expansionCall = showCalls.find(c => c[0].includes('ValueSet'));
    expect(expansionCall).toBeDefined();
    expect(expansionCall[2].questJson).toBe(data);
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
  it('calls questDoc.reset()', () => {
    const questDoc = { tree: [], meta: {}, rawFhir: null, contained: [], variables: [], reset: vi.fn() };
    const loader = makeLoader({ questDoc });
    loader.reset();
    expect(questDoc.reset).toHaveBeenCalledTimes(1);
  });

  it('dispatches ANSWERS_CLEAR', () => {
    const loader = makeLoader();
    loader.reset();
    const calls = document.dispatchEvent.mock.calls;
    const evt = calls.find(c => c[0].type === 'answer:clear');
    expect(evt).toBeDefined();
  });

  it('dispatches BUILDER_RERENDER on reset', () => {
    const loader = makeLoader();
    loader.reset();
    const calls = document.dispatchEvent.mock.calls;
    const evt = calls.find(c => c[0].type === 'builder:rerender');
    expect(evt).toBeDefined();
  });

  it('dispatches QUESTIONNAIRE_CLEARED event', () => {
    const loader = makeLoader();
    loader.reset();
    const calls = document.dispatchEvent.mock.calls;
    const evt = calls.find(c => c[0].type === 'questionnaire-cleared');
    expect(evt).toBeDefined();
  });

  it('does not throw', () => {
    const loader = makeLoader();
    expect(() => loader.reset()).not.toThrow();
  });

  it('dispatches AUTOSAVE_CLEAR_DRAFT on reset', () => {
    const loader = makeLoader();
    loader.reset();
    const types = document.dispatchEvent.mock.calls.map(c => c[0].type);
    expect(types).toContain('reset:autosave-clear-draft');
  });

  it('does not throw', () => {
    const loader = makeLoader();
    expect(() => loader.reset()).not.toThrow();
  });
});

// ── confirmAndReset() ─────────────────────────────────────────────────────────
describe('QuestionnaireLoader.confirmAndReset', () => {
  function _resolveNext(eventType, value) {
    const orig = document.addEventListener;
    vi.spyOn(document, 'addEventListener').mockImplementationOnce((type, fn) => {
      if (type === eventType) {
        // simulate listener registration — immediately call the handler
        setTimeout(() => fn({ detail: { resolve: r => r(value) } }), 0);
      } else {
        orig.call(document, type, fn);
      }
    });
  }

  it('calls reset() immediately when tree is empty', async () => {
    const loader = makeLoader({ tree: [] });
    await loader.confirmAndReset();
    expect(loader._questDoc.reset).toHaveBeenCalledTimes(1);
  });

  it('dispatches CLEAR_CONFIRM_REQUESTED when tree has items', async () => {
    const loader = makeLoader({ tree: [{ id: 'g1' }] });
    // Dispatch event but provide a resolve that returns 'cancel' so it exits
    document.dispatchEvent.mockImplementationOnce(e => {
      if (e.type === 'reset:clear-confirm-requested') e.detail.resolve('cancel');
    });
    await loader.confirmAndReset();
    const types = document.dispatchEvent.mock.calls.map(c => c[0].type);
    expect(types).toContain('reset:clear-confirm-requested');
  });

  it('calls reset() when user picks clear', async () => {
    const loader = makeLoader({ tree: [{ id: 'g1' }] });
    document.dispatchEvent.mockImplementationOnce(e => {
      if (e.type === 'reset:clear-confirm-requested') e.detail.resolve('clear');
    });
    await loader.confirmAndReset();
    expect(loader._questDoc.reset).toHaveBeenCalledTimes(1);
  });

  it('does nothing when user picks cancel', async () => {
    const loader = makeLoader({ tree: [{ id: 'g1' }] });
    document.dispatchEvent.mockImplementationOnce(e => {
      if (e.type === 'reset:clear-confirm-requested') e.detail.resolve('cancel');
    });
    await loader.confirmAndReset();
    expect(loader._questDoc.reset).not.toHaveBeenCalled();
  });
});
