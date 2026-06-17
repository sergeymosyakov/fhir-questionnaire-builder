// Tests for evaluateNode (FHIR R4 enableWhen-based visibility).
// eval.js imports answerStore from state.js — mocked below.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared mutable values store — eval.js reads this via answerStore.getAll
const _values = {};
const _mockAnswerStore = {
  data: _values,
  get: id => _values[id],
  getAll: id => {
    const result = [];
    if (_values[id] !== undefined) result.push(_values[id]);
    const n = _values[id + '$$n'] || 0;
    for (let i = 1; i <= n; i++) {
      if (_values[id + '$$' + i] !== undefined) result.push(_values[id + '$$' + i]);
    }
    return result;
  },
};

vi.mock('../js/answer-store.js', () => ({
  answerStore: _mockAnswerStore,
}));

const { evaluateNode, markAllDisabled } = await import('../js/eval.js');

// Helper: reset values before each test
beforeEach(() => {
  Object.keys(_values).forEach(k => delete _values[k]);
});

// ── markAllDisabled ───────────────────────────────────────────────────────────
describe('markAllDisabled', () => {
  it('marks all nodes in subtree as disabled', () => {
    const nodes = [
      { id: 'a', type: 'item' },
      { id: 'b', type: 'group', children: [{ id: 'c', type: 'item' }] },
    ];
    const results = [];
    markAllDisabled(nodes, results);
    expect(results).toHaveLength(3);
    expect(results.every(r => r.disabled && r.visible && r.ok)).toBe(true);
  });

  it('handles empty array', () => {
    const results = [];
    markAllDisabled([], results);
    expect(results).toHaveLength(0);
  });
});

// ── evaluateNode — sdc-questionnaire-hidden ───────────────────────────────────
describe('evaluateNode — _hidden', () => {
  it('marks hidden item as hiddenRoot with hidden=true', () => {
    const node = { id: 'q1', type: 'item', _hidden: true };
    const results = [];
    const r = evaluateNode(node, {}, results);
    expect(r.hidden).toBe(true);
    expect(r.visible).toBe(true);
    expect(r.ok).toBe(true);
    expect(results[0].hiddenRoot).toBe(true);
    expect(results[0].hidden).toBe(true);
  });

  it('marks hidden group and all children as hidden', () => {
    const node = {
      id: 'g1', type: 'group', _hidden: true,
      children: [
        { id: 'g1.q1', type: 'item' },
        { id: 'g1.q2', type: 'item' },
      ],
    };
    const results = [];
    evaluateNode(node, {}, results);
    expect(results).toHaveLength(3);
    expect(results[0].hiddenRoot).toBe(true);
    expect(results[1].hidden).toBe(true);
    expect(results[1].hiddenRoot).toBe(false);
    expect(results[2].hidden).toBe(true);
    expect(results[2].hiddenRoot).toBe(false);
  });

  it('marks nested children as hidden but not hiddenRoot', () => {
    const node = { id: 'q1', type: 'item', _hidden: true };
    const results = [];
    evaluateNode(node, {}, results, true); // called with _insideHidden = true
    expect(results[0].hiddenRoot).toBe(false);
    expect(results[0].hidden).toBe(true);
  });

  it('non-hidden item is not marked hidden', () => {
    const node = { id: 'q1', type: 'item' };
    const results = [];
    const r = evaluateNode(node, {}, results);
    expect(r.hidden).toBeUndefined();
    expect(results[0].hidden).toBeUndefined();
  });
});

// ── evaluateNode — no enableWhen (always visible) ─────────────────────────────
describe('evaluateNode — no conditions', () => {
  it('item with no enableWhen is always visible', () => {
    const node = { id: 'q1', type: 'item', mandatory: false, enableWhen: [], enableWhenExpression: '' };
    const results = [];
    const r = evaluateNode(node, {}, results);
    expect(r.visible).toBe(true);
    expect(r.ok).toBe(true);
    expect(results).toHaveLength(1);
  });

  it('group with no enableWhen is always visible', () => {
    const node = { id: 'g1', type: 'group', enableWhen: [], enableWhenExpression: '', mandatory: false, logicWithParent: 'AND', children: [] };
    const results = [];
    const r = evaluateNode(node, {}, results);
    expect(r.visible).toBe(true);
  });
});

// ── evaluateNode — enableWhen (single condition) ──────────────────────────────
describe('evaluateNode — enableWhen single condition', () => {
  it('hides item when answerBoolean condition not met', () => {
    const node = {
      id: 'q1', type: 'item', mandatory: false,
      enableWhen: [{ question: 'q0', operator: '=', answerBoolean: true }],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    _values['q0'] = false;
    const results = [];
    const r = evaluateNode(node, {}, results);
    expect(r.visible).toBe(false);
  });

  it('shows item when answerBoolean condition met', () => {
    const node = {
      id: 'q1', type: 'item', mandatory: false,
      enableWhen: [{ question: 'q0', operator: '=', answerBoolean: true }],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    _values['q0'] = true;
    const results = [];
    const r = evaluateNode(node, {}, results);
    expect(r.visible).toBe(true);
  });

  it('hides item when answerString condition not met', () => {
    const node = {
      id: 'q1', type: 'item', mandatory: false,
      enableWhen: [{ question: 'q0', operator: '=', answerString: 'male' }],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    _values['q0'] = 'female';
    const results = [];
    const r = evaluateNode(node, {}, results);
    expect(r.visible).toBe(false);
  });

  it('shows item when answerString condition met', () => {
    const node = {
      id: 'q1', type: 'item', mandatory: false,
      enableWhen: [{ question: 'q0', operator: '=', answerString: 'male' }],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    _values['q0'] = 'male';
    const results = [];
    const r = evaluateNode(node, {}, results);
    expect(r.visible).toBe(true);
  });

  it('handles != operator', () => {
    const node = {
      id: 'q1', type: 'item', mandatory: false,
      enableWhen: [{ question: 'q0', operator: '!=', answerString: 'no' }],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    _values['q0'] = 'yes';
    const r = evaluateNode(node, {}, []);
    expect(r.visible).toBe(true);
  });

  it('handles >= operator with integer', () => {
    const node = {
      id: 'q1', type: 'item', mandatory: false,
      enableWhen: [{ question: 'age', operator: '>=', answerInteger: 18 }],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    _values['age'] = '20';
    expect(evaluateNode(node, {}, []).visible).toBe(true);
    _values['age'] = '15';
    expect(evaluateNode(node, {}, []).visible).toBe(false);
  });

  it('handles exists:true operator', () => {
    const node = {
      id: 'q1', type: 'item', mandatory: false,
      enableWhen: [{ question: 'q0', operator: 'exists', answerBoolean: true }],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    _values['q0'] = 'something';
    expect(evaluateNode(node, {}, []).visible).toBe(true);
    delete _values['q0'];
    expect(evaluateNode(node, {}, []).visible).toBe(false);
  });

  it('handles exists:false operator', () => {
    const node = {
      id: 'q1', type: 'item', mandatory: false,
      enableWhen: [{ question: 'q0', operator: 'exists', answerBoolean: false }],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    delete _values['q0'];
    expect(evaluateNode(node, {}, []).visible).toBe(true);
    _values['q0'] = 'something';
    expect(evaluateNode(node, {}, []).visible).toBe(false);
  });

  it('handles answerCoding by code', () => {
    const node = {
      id: 'q1', type: 'item', mandatory: false,
      enableWhen: [{ question: 'q0', operator: '=', answerCoding: { code: 'y', display: 'Yes' } }],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    _values['q0'] = 'y';
    expect(evaluateNode(node, {}, []).visible).toBe(true);
    _values['q0'] = 'n';
    expect(evaluateNode(node, {}, []).visible).toBe(false);
  });
});

// ── evaluateNode — enableBehavior AND vs OR ───────────────────────────────────
describe('evaluateNode — enableBehavior AND / OR', () => {
  it('ALL (AND): hides when any condition not met', () => {
    const node = {
      id: 'q1', type: 'item', mandatory: false,
      enableWhen: [
        { question: 'q0', operator: '=', answerBoolean: true },
        { question: 'q2', operator: '=', answerString: 'yes' },
      ],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    _values['q0'] = true;
    _values['q2'] = 'no';
    expect(evaluateNode(node, {}, []).visible).toBe(false);
  });

  it('ALL (AND): shows when all conditions met', () => {
    const node = {
      id: 'q1', type: 'item', mandatory: false,
      enableWhen: [
        { question: 'q0', operator: '=', answerBoolean: true },
        { question: 'q2', operator: '=', answerString: 'yes' },
      ],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    _values['q0'] = true;
    _values['q2'] = 'yes';
    expect(evaluateNode(node, {}, []).visible).toBe(true);
  });

  it('ANY (OR): shows when any one condition met', () => {
    const node = {
      id: 'q1', type: 'item', mandatory: false,
      enableWhen: [
        { question: 'q0', operator: '=', answerBoolean: true },
        { question: 'q2', operator: '=', answerString: 'yes' },
      ],
      enableBehavior: 'any', enableWhenExpression: '',
    };
    _values['q0'] = false;
    _values['q2'] = 'yes';
    expect(evaluateNode(node, {}, []).visible).toBe(true);
  });

  it('ANY (OR): hides when no condition met', () => {
    const node = {
      id: 'q1', type: 'item', mandatory: false,
      enableWhen: [
        { question: 'q0', operator: '=', answerBoolean: true },
        { question: 'q2', operator: '=', answerString: 'yes' },
      ],
      enableBehavior: 'any', enableWhenExpression: '',
    };
    _values['q0'] = false;
    _values['q2'] = 'no';
    expect(evaluateNode(node, {}, []).visible).toBe(false);
  });
});

// ── evaluateNode — showDimmed ─────────────────────────────────────────────────
describe('evaluateNode — showDimmed', () => {
  it('sets showDimmed when enableWhen conditions not met', () => {
    const node = {
      id: 'q1', type: 'item', mandatory: false,
      enableWhen: [{ question: 'q0', operator: '=', answerBoolean: true }],
      enableBehavior: 'all', enableWhenExpression: '',
      _enableWhenText: 'Diet program = Yes',
    };
    _values['q0'] = false;
    const results = [];
    const r = evaluateNode(node, {}, results);
    expect(r.visible).toBe(false);
    expect(r.showDimmed).toBe(true);
    expect(results[0].showDimmed).toBe(true);
  });

  it('showDimmed false when no enableWhen', () => {
    const node = {
      id: 'q1', type: 'item', mandatory: false,
      enableWhen: [], enableBehavior: 'all', enableWhenExpression: '',
    };
    const results = [];
    const r = evaluateNode(node, {}, results);
    expect(r.visible).toBe(true);
    expect(r.showDimmed).toBeUndefined();
  });
});

// ── evaluateNode — group visibility ──────────────────────────────────────────
describe('evaluateNode — group', () => {
  it('group with all visible children → visible', () => {
    const node = {
      id: 'g1', type: 'group', enableWhen: [], enableWhenExpression: '',
      mandatory: false, logicWithParent: 'AND',
      children: [
        { id: 'c1', type: 'item', mandatory: false, enableWhen: [], enableWhenExpression: '' },
        { id: 'c2', type: 'item', mandatory: false, enableWhen: [], enableWhenExpression: '' },
      ],
    };
    const results = [];
    const r = evaluateNode(node, {}, results);
    expect(r.visible).toBe(true);
    expect(results).toHaveLength(3); // group + 2 children
  });

  it('hidden group pushes showDimmed result', () => {
    const node = {
      id: 'g1', type: 'group',
      enableWhen: [{ question: 'q0', operator: '=', answerBoolean: true }],
      enableBehavior: 'all', enableWhenExpression: '',
      mandatory: false, logicWithParent: 'AND',
      children: [{ id: 'c1', type: 'item', mandatory: false, enableWhen: [], enableWhenExpression: '' }],
    };
    _values['q0'] = false;
    const results = [];
    const r = evaluateNode(node, {}, results);
    expect(r.visible).toBe(false);
    expect(r.showDimmed).toBe(true);
    // children also pushed as disabled
    expect(results).toHaveLength(2);
  });

  it('AND group ok only when all visible children ok', () => {
    const node = {
      id: 'g1', type: 'group', enableWhen: [], enableWhenExpression: '',
      mandatory: false, logicWithParent: 'AND',
      children: [
        { id: 'c1', type: 'item', mandatory: true, enableWhen: [], enableWhenExpression: '' },
        { id: 'c2', type: 'item', mandatory: false, enableWhen: [], enableWhenExpression: '' },
      ],
    };
    const r = evaluateNode(node, {}, []);
    // c1 is item → ok:true from evaluateNode (form-value checks are separate)
    expect(r.visible).toBe(true);
  });

  it('OR group (logicWithParent) uses OR aggregation', () => {
    // logicWithParent controls group-level pass/fail aggregation, not visibility
    const node = {
      id: 'g1', type: 'group', enableWhen: [], enableWhenExpression: '',
      mandatory: false, logicWithParent: 'OR',
      children: [
        { id: 'c1', type: 'item', mandatory: false, enableWhen: [], enableWhenExpression: '' },
      ],
    };
    const r = evaluateNode(node, {}, []);
    expect(r.visible).toBe(true);
  });
});

// ── enableWhen with repeating source item ─────────────────────────────────────
describe('evaluateNode — enableWhen with repeat values', () => {
  it('hidden when primary empty and no repeat rows', () => {
    const node = {
      id: 'q2', type: 'item', mandatory: false,
      enableWhen: [{ question: 'q1', operator: '=', answerString: 'yes' }],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    expect(evaluateNode(node, {}, []).visible).toBe(false);
  });

  it('visible when condition met by primary value', () => {
    const node = {
      id: 'q2', type: 'item', mandatory: false,
      enableWhen: [{ question: 'q1', operator: '=', answerString: 'yes' }],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    _values['q1'] = 'yes';
    expect(evaluateNode(node, {}, []).visible).toBe(true);
  });

  it('visible when condition met by a repeat row (not primary)', () => {
    const node = {
      id: 'q2', type: 'item', mandatory: false,
      enableWhen: [{ question: 'q1', operator: '=', answerString: 'yes' }],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    _values['q1'] = 'no';       // primary does not satisfy
    _values['q1$$n'] = 1;
    _values['q1$$1'] = 'yes';   // repeat row satisfies
    expect(evaluateNode(node, {}, []).visible).toBe(true);
  });

  it('hidden when no repeat row satisfies condition', () => {
    const node = {
      id: 'q2', type: 'item', mandatory: false,
      enableWhen: [{ question: 'q1', operator: '=', answerString: 'yes' }],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    _values['q1'] = 'no';
    _values['q1$$n'] = 2;
    _values['q1$$1'] = 'maybe';
    _values['q1$$2'] = 'no';
    expect(evaluateNode(node, {}, []).visible).toBe(false);
  });

  it('exists:true satisfied by any repeat row', () => {
    const node = {
      id: 'q2', type: 'item', mandatory: false,
      enableWhen: [{ question: 'q1', operator: 'exists', answerBoolean: true }],
      enableBehavior: 'all', enableWhenExpression: '',
    };
    // primary not set, but repeat row is
    _values['q1$$n'] = 1;
    _values['q1$$1'] = 'something';
    expect(evaluateNode(node, {}, []).visible).toBe(true);
  });
});
