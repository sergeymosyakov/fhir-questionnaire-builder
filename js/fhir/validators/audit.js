// ── AuditValidator ────────────────────────────────────────────────────────────
// Wraps the pure auditTree() quality-audit report as a Validator. Advisory
// only — ValidateModal only runs it in 'validate' mode, never export/import.

import { Validator } from './base.js';
import { auditTree } from '../audit.js';
import { AppEvents, EventState } from '../../events.js';

export class AuditValidator extends Validator {
  get id()   { return 'audit'; }
  get name() { return 'Quality audit'; }
  get type() { return 'local'; }
  get advisory() { return true; }

  async _run(_questJson, tree) {
    const variables = EventState.get(AppEvents.APP_CONTEXT_READY)?.questDoc?.variables || [];
    return auditTree(tree, variables);
  }
}
