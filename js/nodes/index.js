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
import { NODE_REGISTRY }  from './registry.js';

// Fill the registry (registry.js is a leaf — no node imports, no circular dep).
// base-node.js imports registry.js, so BaseNode.dispatch() reads a fully-filled
// map as long as nodes/index.js is imported before the first dispatch call.
NODE_REGISTRY.set('group',       GroupNode);
NODE_REGISTRY.set('text',        TextNode);
NODE_REGISTRY.set('number',      NumberNode);
NODE_REGISTRY.set('integer',     NumberNode);
NODE_REGISTRY.set('decimal',     NumberNode);
NODE_REGISTRY.set('select',      ChoiceNode);
NODE_REGISTRY.set('radio',       RadioNode);
NODE_REGISTRY.set('open-choice', OpenChoiceNode);
NODE_REGISTRY.set('date',        DateNode);
NODE_REGISTRY.set('dateTime',    DateTimeNode);
NODE_REGISTRY.set('time',        TimeNode);
NODE_REGISTRY.set('checkbox',    CheckboxNode);
NODE_REGISTRY.set('url',         UrlNode);
NODE_REGISTRY.set('attachment',  AttachmentNode);
NODE_REGISTRY.set('reference',   ReferenceNode);
NODE_REGISTRY.set('quantity',    QuantityNode);
NODE_REGISTRY.set('display',     DisplayNode);

export { NODE_REGISTRY };

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
