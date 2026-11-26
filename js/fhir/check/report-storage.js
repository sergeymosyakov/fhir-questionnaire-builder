// Where the Check my form window leaves the report for questionnaire-check.html: as is, packed when it does not fit.
import { packJson, unpackJson } from '../../core/json-pack.js';

export const CHECK_REPORT_KEY = 'fhirqb.checkReport';

/** Synchronous, so a caller can open a tab in the same click. @returns {boolean} false when it does not fit as is */
export function storeReportPlain(report) {
  try { sessionStorage.setItem(CHECK_REPORT_KEY, JSON.stringify(report)); return true; } catch { return false; }
}

/** @returns {Promise<boolean>} false when even the packed report does not fit */
export async function storeReportPacked(report) {
  try { sessionStorage.setItem(CHECK_REPORT_KEY, await packJson(report)); return true; } catch { return false; }
}

export const storeReport = async (report) => storeReportPlain(report) || storeReportPacked(report);

export function clearReport() {
  try { sessionStorage.removeItem(CHECK_REPORT_KEY); } catch { /* storage unavailable */ }
}

/** @returns {Promise<object|null>} */
export async function loadReport() {
  const raw = sessionStorage.getItem(CHECK_REPORT_KEY);
  if (!raw) return null;
  return raw.startsWith('{') ? JSON.parse(raw) : unpackJson(raw);
}
