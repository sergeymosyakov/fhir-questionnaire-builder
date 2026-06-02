// ── Validator bootstrap ───────────────────────────────────────────────────────
// Reads config.json and registers all configured validators into the registry.
//
// Called once at app startup (js/app.js or builder/index.js).
// Accepts initial enabled state from persisted prefs so validators start in the
// correct state before any VALIDATOR_TOGGLE events are dispatched.
//
// config.json shape:
//   {
//     "validators": [
//       { "type": "local",    "name": "Built-in" },
//       { "type": "external", "name": "HAPI FHIR R4", "url": "https://hapi.fhir.org/baseR4" }
//     ]
//   }

import { validatorRegistry } from './registry.js';
import { LocalValidator }    from './local.js';
import { ExternalValidator } from './external.js';

/**
 * @param {{ localEnabled?: boolean, externalEnabled?: boolean }} opts
 */
export async function initValidators({ localEnabled = true, externalEnabled = false } = {}) {
  try {
    const cfg = await fetch('./config.json').then(r => r.json());
    const defs = cfg.validators || [{ type: 'local', name: 'Built-in' }];

    for (const def of defs) {
      if (def.type === 'local') {
        const v = new LocalValidator({ name: def.name || 'Built-in' });
        v.enabled = localEnabled;
        validatorRegistry.register(v);
      } else if (def.type === 'external' && def.url) {
        const v = new ExternalValidator({ name: def.name || def.url, url: def.url, retries: def.retries ?? 3 });
        v.enabled = externalEnabled;
        validatorRegistry.register(v);
      }
    }
  } catch {
    // Fallback: always register local validator so the app works without config
    const v = new LocalValidator();
    v.enabled = localEnabled;
    validatorRegistry.register(v);
  }
}

