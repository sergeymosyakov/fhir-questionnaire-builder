// ── Node registry and factory ─────────────────────────────────────────────────
// Central point for creating node instances by type.
// Usage:
//   createGroupNode({ title: 'My Group' })
//   createItemNode('text', { title: 'Q1' })
//   createItemNode('number', { title: 'Age', _minValue: 0 })
//   createItemNodeFromTemplate(title, template)  — clones template settings

import { GroupNode }      from './group-node.js';
import { TextNode }       from './text-node.js';
import { NumberNode }     from './number-node.js';
import { ChoiceNode, RadioNode, OpenChoiceNode } from './choice-node.js';
import { DateNode, DateTimeNode, TimeNode }      from './date-node.js';
import { CheckboxNode }   from './checkbox-node.js';
import { UrlNode }        from './url-node.js';
import { AttachmentNode } from './attachment-node.js';
import { ReferenceNode }  from './reference-node.js';
import { QuantityNode }   from './quantity-node.js';
import { DisplayNode }    from './display-node.js';

// Maps itemType string → constructor
export const NODE_REGISTRY = new Map([
  ['text',        TextNode],
  ['number',      NumberNode],
  ['integer',     NumberNode],
  ['decimal',     NumberNode],
  ['select',      ChoiceNode],
  ['radio',       RadioNode],
  ['open-choice', OpenChoiceNode],
  ['date',        DateNode],
  ['dateTime',    DateTimeNode],
  ['time',        TimeNode],
  ['checkbox',    CheckboxNode],
  ['url',         UrlNode],
  ['attachment',  AttachmentNode],
  ['reference',   ReferenceNode],
  ['quantity',    QuantityNode],
  ['display',     DisplayNode],
]);

/** Create a new GroupNode. Replaces makeGroup(title). */
export function createGroupNode(data = {}) {
  if (typeof data === 'string') data = { title: data };
  return new GroupNode({ title: data.title || 'New Group', ...data });
}

/** Create a new item node for the given itemType. Replaces makeItem(title). */
export function createItemNode(itemType, data = {}) {
  if (typeof data === 'string') data = { title: data };
  const Cls = NODE_REGISTRY.get(itemType) ?? TextNode;
  return new Cls({ title: data.title || 'New Item', ...data, itemType });
}

/** Clone a template node's settings into a new node with a new title/id.
 *  Replaces makeItem(title, template). */
export function createItemNodeFromTemplate(title, template) {
  return createItemNode(template.itemType, {
    title,
    mandatory:  template.mandatory,
    repeats:    template.repeats || false,
    options:    template.options,
    constraint: template.constraint ? template.constraint.map(c => ({ ...c })) : [],
  });
}

// Re-export all node classes for convenience
export { GroupNode, TextNode, NumberNode,
         ChoiceNode, RadioNode, OpenChoiceNode,
         DateNode, DateTimeNode, TimeNode,
         CheckboxNode, UrlNode, AttachmentNode,
         ReferenceNode, QuantityNode, DisplayNode };
export { BaseNode }  from './base-node.js';
export { ItemNode }  from './item-node.js';
