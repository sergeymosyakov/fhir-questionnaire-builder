// A Questionnaire given as text or JSON, loaded into its own session (no builder): what the checks and the comparison run on.
import { createSession } from '../../core/session.js';
import { AppEvents } from '../../events.js';
import { importFHIR } from '../import.js';
import { buildFHIRObject } from '../export.js';

// importFHIR reports its refusal through NOTIFY_REQUESTED; collect the text so the page can show it.
function importQuietly(input, session) {
  const messages = [];
  const collect = (e) => { if (e.detail?.message) messages.push(e.detail.message); };
  document.addEventListener(AppEvents.NOTIFY_REQUESTED, collect);
  try { return { ok: importFHIR(input, { questDoc: session.questDoc, bus: session.bus }), messages }; }
  finally { document.removeEventListener(AppEvents.NOTIFY_REQUESTED, collect); }
}

/**
 * @param {string|object} input Questionnaire JSON
 * @returns {{ tree: object[], base: object, variables: object[], title: string }}
 * @throws {Error} with the reason when it cannot be loaded
 */
export function loadForm(input) {
  const session = createSession();
  const { ok, messages } = importQuietly(input, session);
  if (!ok) throw new Error(messages.join('\n') || 'This is not a Questionnaire.');
  const { questDoc } = session;
  const base = buildFHIRObject(questDoc);
  return { tree: questDoc.tree, base, variables: questDoc.variables, title: base.title };
}
