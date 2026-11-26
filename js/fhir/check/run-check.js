// Check a Questionnaire given as text, without the builder: own session, same checkForm and report as the builder window.
import { loadForm } from './load-form.js';
import { checkForm } from './reachability.js';
import { buildReport } from './report.js';

/**
 * @param {string} text Questionnaire JSON
 * @param {{ fp: object, onProgress?: Function }} deps
 * @returns {Promise<object>} the report model (see buildReport)
 */
export async function runCheck(text, { fp, onProgress }) {
  const { tree, base, variables, title } = loadForm(text);
  const result = await checkForm({ tree, base, fp, variables, onProgress });
  return buildReport({ tree, result, title, questionnaire: base });
}
