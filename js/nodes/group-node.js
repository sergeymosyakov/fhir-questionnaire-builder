// ── GroupNode ─────────────────────────────────────────────────────────────────
// Represents a FHIR Questionnaire group item (type: 'group').
// Children are other GroupNode or ItemNode instances.
// Optional FHIR-imported properties set after construction:
//   _collapsible, _renderXhtml, _renderStyle, _prefix, _definition,
//   _codes, _supportLinks, _hidden, _designNote, _unknownExtensions
import { BaseNode } from './base-node.js';

export class GroupNode extends BaseNode {
  constructor(data = {}) {
    super(data);
    this.type            = 'group';
    this.logicWithParent = data.logicWithParent ?? 'AND';
    this.children        = data.children        ?? [];
  }
}
