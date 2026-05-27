import { describe, test, expect, vi } from 'vitest';
import { reactive, effect } from '@vue/reactivity';

// state.js imports Vue from CDN — redirect to the npm package in tests
vi.mock(
  'https://unpkg.com/@vue/reactivity@3.5/dist/reactivity.esm-browser.js',
  async () => await import('@vue/reactivity'),
);

import { GroupNode }    from '../js/nodes/group-node.js';
import { TextNode }     from '../js/nodes/text-node.js';
import { NumberNode }   from '../js/nodes/number-node.js';

import { createGroupNode, createItemNode, createItemNodeFromTemplate, NODE_REGISTRY } from '../js/nodes/index.js';

// ── Class shape ───────────────────────────────────────────────────────────────

describe('Node class shapes', () => {
  test('TextNode has correct type and itemType', () => {
    const n = new TextNode({ title: 'Q1' });
    expect(n.type).toBe('item');
    expect(n.itemType).toBe('text');
    expect(n.title).toBe('Q1');
    expect(n.repeats).toBe(false);
    expect(n.constraint).toEqual([]);
    expect(n.enableWhen).toEqual([]);
    expect(n.mandatory).toBe(false);
  });

  test('GroupNode has correct type and children', () => {
    const g = new GroupNode({ title: 'My Group' });
    expect(g.type).toBe('group');
    expect(g.children).toEqual([]);
    expect(g.logicWithParent).toBe('AND');
  });

  test('NumberNode preserves integer/decimal itemType', () => {
    const ni = new NumberNode({ itemType: 'integer' });
    expect(ni.itemType).toBe('integer');
    const nd = new NumberNode({ itemType: 'decimal' });
    expect(nd.itemType).toBe('decimal');
  });

  test('ids are unique across instances', () => {
    const a = new TextNode();
    const b = new TextNode();
    expect(a.id).not.toBe(b.id);
  });

  test('custom id is preserved', () => {
    const n = new TextNode({ id: 'my-link-id' });
    expect(n.id).toBe('my-link-id');
  });
});

// ── NODE_REGISTRY ─────────────────────────────────────────────────────────────

describe('NODE_REGISTRY', () => {
  test('covers all expected itemTypes', () => {
    const types = ['text','number','integer','decimal','select','radio','open-choice',
                   'date','dateTime','time','checkbox','url','attachment','reference','quantity'];
    for (const t of types) {
      expect(NODE_REGISTRY.has(t), `registry missing: ${t}`).toBe(true);
    }
  });
});

// ── Factory functions ─────────────────────────────────────────────────────────

describe('createGroupNode / createItemNode', () => {
  test('createGroupNode from string title', () => {
    const g = createGroupNode('Section A');
    expect(g.type).toBe('group');
    expect(g.title).toBe('Section A');
  });

  test('createItemNode defaults to TextNode for "text"', () => {
    const n = createItemNode('text', { title: 'Name' });
    expect(n instanceof TextNode).toBe(true);
    expect(n.itemType).toBe('text');
  });

  test('createItemNode returns correct class for each type', () => {
    expect(createItemNode('checkbox').itemType).toBe('checkbox');
    expect(createItemNode('integer').itemType).toBe('integer');
    expect(createItemNode('date').itemType).toBe('date');
    expect(createItemNode('select').itemType).toBe('select');
  });

  test('createItemNodeFromTemplate clones settings', () => {
    const tpl = new TextNode({ mandatory: false, repeats: true, options: 'a|b', constraint: [{ key: 'k1' }] });
    const n = createItemNodeFromTemplate('Copy', tpl);
    expect(n.title).toBe('Copy');
    expect(n.mandatory).toBe(false);
    expect(n.repeats).toBe(true);
    expect(n.options).toBe('a|b');
    expect(n.constraint).toEqual([{ key: 'k1' }]);
    expect(n.constraint).not.toBe(tpl.constraint); // deep copy
    expect(n.id).not.toBe(tpl.id);
  });
});

// ── Vue reactivity ────────────────────────────────────────────────────────────

describe('Vue reactivity with node classes', () => {
  test('class instances are reactive in reactive array', () => {
    const tree = reactive([]);
    let count = 0;
    effect(() => { count = tree.length; });

    expect(count).toBe(0);
    tree.push(new TextNode({ title: 'T1' }));
    expect(count).toBe(1);
    tree.push(new GroupNode({ title: 'G1' }));
    expect(count).toBe(2);
  });

  test('node properties are reactive after push', () => {
    const tree = reactive([new TextNode({ title: 'original' })]);
    let captured = '';
    effect(() => { captured = tree[0].title; });

    expect(captured).toBe('original');
    tree[0].title = 'changed';
    expect(captured).toBe('changed');
  });

  test('dynamically added FHIR-import properties are reactive', () => {
    const tree = reactive([new TextNode({ title: 'Q' })]);
    let maxLen = undefined;
    effect(() => { maxLen = tree[0]._maxLength; });

    expect(maxLen).toBeUndefined();
    tree[0]._maxLength = 100; // simulates FHIR import setting this after creation
    expect(maxLen).toBe(100);
  });

  test('children array on GroupNode is reactive', () => {
    const group = reactive(new GroupNode({ title: 'G' }));
    let childCount = 0;
    effect(() => { childCount = group.children.length; });

    expect(childCount).toBe(0);
    group.children.push(new TextNode({ title: 'child' }));
    expect(childCount).toBe(1);
  });
});
