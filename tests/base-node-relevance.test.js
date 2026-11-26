import { describe, test, expect } from 'vitest';
import { isRelevantItem } from '../js/nodes/base-node.js';

const rc = (ok) => ({ hasEnforceableRule: () => false, calcFormOk: () => ok });

describe('isRelevantItem', () => {
  test('a half-filled quantity counts toward its group', () => {
    expect(isRelevantItem({ itemType: 'quantity' }, rc(false))).toBe(true);
  });
  test('an untouched or complete optional quantity does not', () => {
    expect(isRelevantItem({ itemType: 'quantity' }, rc(true))).toBe(false);
  });
  test('other items follow hasEnforceableRule only', () => {
    expect(isRelevantItem({ itemType: 'string' }, rc(false))).toBe(false);
    expect(isRelevantItem({ itemType: 'string' }, { ...rc(true), hasEnforceableRule: () => true })).toBe(true);
  });
});
