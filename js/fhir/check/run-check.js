// Check a Questionnaire given as text, without the builder: own session, same checkForm and report as the builder window.
import { createSession } from '../../core/session.js';
import { AppEvents } from '../../events.js';
import { importFHIR } from '../import.js';
import { buildFHIRObject } from '../export.js';
import { checkForm } from './reachability.js';
import { buildReport } from './report.js';

// importFHIR reports its refusal through NOTIFY_REQUESTED; collect the text so the page can show it.
function importQuietly(text, session) {
  const messages = [];
  const collect = (e) => { if (e.detail?.message) messages.push(e.detail.message); };
  document.addEventListener(AppEvents.NOTIFY_REQUESTED, collect);
  try { return { ok: importFHIR(text, { questDoc: session.questDoc, bus: session.bus }), messages }; }
  finally { document.removeEventListener(AppEvents.NOTIFY_REQUESTED, collect); }
}

/**
 * @param {string} text Questionnaire JSON
 * @param {{ fp: object, onProgress?: Function }} deps
 * @returns {Promise<object>} the report model (see buildReport)
 */
export async function runCheck(text, { fp, onProgress }) {
  const session = createSession();
  const { ok, messages } = importQuietly(text, session);
  if (!ok) throw new Error(messages.join('\n') || 'This is not a Questionnaire.');
  const { questDoc } = session;
  const base = buildFHIRObject(questDoc);
  const result = await checkForm({ tree: questDoc.tree, base, fp, variables: questDoc.variables, onProgress });
  return buildReport({ tree: questDoc.tree, result, title: base.title, questionnaire: base });
}
