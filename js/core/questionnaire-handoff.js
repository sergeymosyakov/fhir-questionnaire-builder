// Hands a Questionnaire from one page to the builder in a new tab: packed in localStorage under a one-off id that the opened URL carries.
import { packJson, unpackJson } from './json-pack.js';

const PREFIX = 'fhirqb.handoff.';
const LEFTOVER_MS = 10 * 60_000; // an envelope nobody opened (tab closed first) is swept, so it never sits in storage for good

function sweep(now = Date.now()) {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX) && now - Number(localStorage.getItem(key)?.split(':', 1)[0]) > LEFTOVER_MS) localStorage.removeItem(key);
  }
}

/** @returns {Promise<string|null>} the id to put in the builder URL, or null when the browser refused to store it */
export async function putHandoff(questionnaire) {
  try {
    sweep();
    const id = crypto.randomUUID();
    localStorage.setItem(PREFIX + id, `${Date.now()}:${await packJson(questionnaire)}`);
    return id;
  } catch { return null; }
}

export function dropHandoff(id) {
  try { localStorage.removeItem(PREFIX + id); } catch { /* storage unavailable */ }
}

/**
 * @param {string} id
 * @returns {Promise<object|null>} the Questionnaire (removed from storage), or null when nothing waits under this id
 * @throws when the envelope is there but cannot be read
 */
export async function takeHandoff(id) {
  let envelope;
  try { sweep(); envelope = localStorage.getItem(PREFIX + id); localStorage.removeItem(PREFIX + id); } catch { return null; }
  if (!envelope) return null;
  return unpackJson(envelope.slice(envelope.indexOf(':') + 1));
}
