// Unit tests for AnswerStore — flat rows, $$ addressing, and repeating-group
// instances addressed by an instance path. Pure class, no DOM needed.

import { describe, it, expect } from 'vitest';
import { AnswerStore } from '../js/answer-store.js';

describe('AnswerStore — flat (root) behaviour', () => {
  it('set/get a single value (row 0)', () => {
    const s = new AnswerStore();
    s.set('q1', 'hi');
    expect(s.get('q1')).toBe('hi');
    expect(s.getAll('q1')).toEqual(['hi']);
  });

  it('$$ repeat rows on a leaf', () => {
    const s = new AnswerStore();
    s.set('q', 'a');
    s.set('q$$1', 'b');
    s.set('q$$2', 'c');
    expect(s.get('q')).toBe('a');
    expect(s.get('q$$2')).toBe('c');
    expect(s.getAll('q')).toEqual(['a', 'b', 'c']);
    expect(s.get('q$$n')).toBe(2);
  });

  it('remove(id) drops all rows; remove(id$$n) truncates to row 0', () => {
    const s = new AnswerStore();
    s.set('q', 'a'); s.set('q$$1', 'b'); s.set('q$$2', 'c');
    s.remove('q$$n');
    expect(s.getAll('q')).toEqual(['a']);
    s.remove('q');
    expect(s.getAll('q')).toEqual([]);
  });

  it('unknown id reads are empty/undefined', () => {
    const s = new AnswerStore();
    expect(s.get('nope')).toBeUndefined();
    expect(s.getAll('nope')).toEqual([]);
  });
});

describe('AnswerStore — repeating-group instances', () => {
  it('addInstance grows the group; instanceCount reflects it', () => {
    const s = new AnswerStore();
    expect(s.instanceCount('vitals')).toBe(0);
    expect(s.addInstance('vitals')).toBe(1);
    expect(s.addInstance('vitals')).toBe(2);
    expect(s.instanceCount('vitals')).toBe(2);
  });

  it('per-instance values are isolated by path', () => {
    const s = new AnswerStore();
    s.addInstance('vitals'); s.addInstance('vitals');
    s.set('height', 170, [{ id: 'vitals', idx: 0 }]);
    s.set('height', 182, [{ id: 'vitals', idx: 1 }]);
    expect(s.get('height', [{ id: 'vitals', idx: 0 }])).toBe(170);
    expect(s.get('height', [{ id: 'vitals', idx: 1 }])).toBe(182);
    // root scope has no 'height'
    expect(s.get('height')).toBeUndefined();
  });

  it('set auto-creates the instance path when writing', () => {
    const s = new AnswerStore();
    s.set('weight', 80, [{ id: 'vitals', idx: 0 }]);
    expect(s.instanceCount('vitals')).toBe(1);
    expect(s.get('weight', [{ id: 'vitals', idx: 0 }])).toBe(80);
  });

  it('removeInstance drops the instance and its values', () => {
    const s = new AnswerStore();
    s.set('height', 170, [{ id: 'vitals', idx: 0 }]);
    s.set('height', 182, [{ id: 'vitals', idx: 1 }]);
    s.removeInstance('vitals', 0);
    expect(s.instanceCount('vitals')).toBe(1);
    // what was instance 1 is now instance 0
    expect(s.get('height', [{ id: 'vitals', idx: 0 }])).toBe(182);
  });

  it('reading a missing instance path is safe (undefined/empty)', () => {
    const s = new AnswerStore();
    expect(s.get('height', [{ id: 'vitals', idx: 3 }])).toBeUndefined();
    expect(s.getAll('height', [{ id: 'vitals', idx: 3 }])).toEqual([]);
    expect(s.instanceCount('missing')).toBe(0);
  });

  it('$$ repeat rows work inside a group instance', () => {
    const s = new AnswerStore();
    const p = [{ id: 'meds', idx: 0 }];
    s.set('name', 'aspirin', p);
    s.set('name$$1', 'ibuprofen', p);
    expect(s.getAll('name', p)).toEqual(['aspirin', 'ibuprofen']);
  });
});

describe('AnswerStore — nested repeating groups (group in group)', () => {
  it('two-level instance path isolates values', () => {
    const s = new AnswerStore();
    // encounters[0] → readings[0], readings[1]
    const enc0 = [{ id: 'encounters', idx: 0 }];
    const enc1 = [{ id: 'encounters', idx: 1 }];
    s.set('systolic', 120, [...enc0, { id: 'readings', idx: 0 }]);
    s.set('systolic', 130, [...enc0, { id: 'readings', idx: 1 }]);
    s.set('systolic', 140, [...enc1, { id: 'readings', idx: 0 }]);

    expect(s.get('systolic', [...enc0, { id: 'readings', idx: 0 }])).toBe(120);
    expect(s.get('systolic', [...enc0, { id: 'readings', idx: 1 }])).toBe(130);
    expect(s.get('systolic', [...enc1, { id: 'readings', idx: 0 }])).toBe(140);
    expect(s.instanceCount('readings', enc0)).toBe(2);
    expect(s.instanceCount('readings', enc1)).toBe(1);
    expect(s.instanceCount('encounters')).toBe(2);
  });
});
