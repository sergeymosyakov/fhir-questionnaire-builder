import { describe, it, expect } from 'vitest';
import { changeNodeType, nodeTypeNeedsConfig, nodeHasTypeConfig } from '../js/nodes/change-type.js';
import { createItemNode } from '../js/nodes/index.js';

describe('changeNodeType', () => {
  it('returns a new node of the target type, preserving id and title', () => {
    const node = createItemNode('text', { id: '1.1' });
    node.title = 'My question';
    const out = changeNodeType(node, 'integer');
    expect(out.itemType).toBe('integer');
    expect(out.id).toBe('1.1');
    expect(out.title).toBe('My question');
  });

  it('replaces the node in the tree in place', () => {
    const node = createItemNode('text', { id: '1' });
    const tree = [node];
    const out = changeNodeType(node, 'boolean', tree);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toBe(out);
    expect(tree[0].itemType).toBe('boolean');
  });

  it('replaces a nested node in the tree', () => {
    const child = createItemNode('text', { id: '1.1' });
    const tree = [{ id: '1', type: 'group', children: [child] }];
    const out = changeNodeType(child, 'date', tree);
    expect(tree[0].children[0]).toBe(out);
    expect(tree[0].children[0].itemType).toBe('date');
  });

  it('forces repeats=true for a type that implies repeats (checklist)', () => {
    const node = createItemNode('select', { id: '1' });
    const out = changeNodeType(node, 'checklist');
    expect(out.impliesRepeats()).toBe(true);
    expect(out.repeats).toBe(true);
  });

  it('clears repeats when the new type does not support it (checkbox)', () => {
    const node = createItemNode('text', { id: '1' });
    node.repeats = true;
    node._minOccurs = 1;
    node._maxOccurs = 3;
    const out = changeNodeType(node, 'checkbox');
    expect(out.supportsRepeat()).toBe(false);
    expect(out.repeats).toBe(false);
    expect(out._minOccurs).toBeUndefined();
    expect(out._maxOccurs).toBeUndefined();
  });

  it('keeps the same type without throwing (no-op type)', () => {
    const node = createItemNode('text', { id: '1' });
    const out = changeNodeType(node, 'text');
    expect(out.itemType).toBe('text');
  });
});

describe('nodeTypeNeedsConfig', () => {
  it('is true for every choice-family type', () => {
    expect(nodeTypeNeedsConfig(createItemNode('select', { id: '1' }))).toBe(true);
    expect(nodeTypeNeedsConfig(createItemNode('radio', { id: '1' }))).toBe(true);
    expect(nodeTypeNeedsConfig(createItemNode('checklist', { id: '1' }))).toBe(true);
    expect(nodeTypeNeedsConfig(createItemNode('open-choice', { id: '1' }))).toBe(true);
  });

  it('stays true for a choice type even after options are added', () => {
    const withOpts = createItemNode('select', { id: '1' });
    withOpts.options = [{ code: 'a', display: 'A' }];
    expect(nodeTypeNeedsConfig(withOpts)).toBe(true);
  });

  it('is false for non-choice types', () => {
    expect(nodeTypeNeedsConfig(createItemNode('text', { id: '1' }))).toBe(false);
    expect(nodeTypeNeedsConfig(createItemNode('integer', { id: '1' }))).toBe(false);
    expect(nodeTypeNeedsConfig(createItemNode('boolean', { id: '1' }))).toBe(false);
  });

  it('is false for null/undefined', () => {
    expect(nodeTypeNeedsConfig(null)).toBe(false);
    expect(nodeTypeNeedsConfig(undefined)).toBe(false);
  });
});

describe('nodeHasTypeConfig', () => {
  it('is true when a text item has a regex pattern', () => {
    const n = createItemNode('text', { id: '1' });
    n._regex = '[A-Z]+';
    expect(nodeHasTypeConfig(n)).toBe(true);
  });

  it('is true when an integer item has a min or max value', () => {
    const n = createItemNode('integer', { id: '1' });
    n._minValue = 0;
    expect(nodeHasTypeConfig(n)).toBe(true);
    delete n._minValue;
    n._maxValue = 100;
    expect(nodeHasTypeConfig(n)).toBe(true);
  });

  it('is true when a quantity item has a unit', () => {
    const n = createItemNode('quantity', { id: '1' });
    n.quantityUnit = 'kg';
    expect(nodeHasTypeConfig(n)).toBe(true);
  });

  it('is true when a decimal item has sliderStep', () => {
    const n = createItemNode('decimal', { id: '1' });
    n._sliderStep = 0.5;
    expect(nodeHasTypeConfig(n)).toBe(true);
  });

  it('is true when item has entryFormat', () => {
    const n = createItemNode('date', { id: '1' });
    n._entryFormat = 'MM/DD/YYYY';
    expect(nodeHasTypeConfig(n)).toBe(true);
  });

  it('is true when attachment item has mime types', () => {
    const n = createItemNode('attachment', { id: '1' });
    n._mimeTypes = ['image/png'];
    expect(nodeHasTypeConfig(n)).toBe(true);
  });

  it('is false for a plain text item with no settings', () => {
    expect(nodeHasTypeConfig(createItemNode('text', { id: '1' }))).toBe(false);
  });

  it('is false for null/undefined', () => {
    expect(nodeHasTypeConfig(null)).toBe(false);
    expect(nodeHasTypeConfig(undefined)).toBe(false);
  });
});
