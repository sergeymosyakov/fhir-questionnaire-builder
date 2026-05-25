// ── BaseNode ──────────────────────────────────────────────────────────────────
// Common properties shared by every node (group and all item types).
// Subclasses must set `this.type` and optionally `this.itemType`.
import { nextId } from '../id.js';

export class BaseNode {
  constructor(data = {}) {
    this.id                   = data.id   ?? nextId();
    this.title                = data.title ?? '';
    this.enableWhen           = data.enableWhen           ?? [];
    this.enableBehavior       = data.enableBehavior       ?? 'all';
    this.enableWhenExpression = data.enableWhenExpression ?? '';
    this.mandatory            = data.mandatory            ?? null;
  }
}
