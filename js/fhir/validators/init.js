// ── Validator bootstrap ───────────────────────────────────────────────────────
// Reads config.json and registers all configured validators into the registry.
//
// Called once at app startup (js/app.js or builder/index.js).
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

export async function initValidators() {
  try {
    const cfg = await fetch('/config.json').then(r => r.json());
    const defs = cfg.validators || [{ type: 'local', name: 'Built-in' }];

    for (const def of defs) {
      if (def.type === 'local') {
        validatorRegistry.register(new LocalValidator({ name: def.name || 'Built-in' }));
      } else if (def.type === 'external' && def.url) {
        validatorRegistry.register(new ExternalValidator({ name: def.name || def.url, url: def.url, retries: def.retries ?? 3 }));
      }
    }
  } catch {
    // Fallback: always register local validator so the app works without config
    validatorRegistry.register(new LocalValidator());
  }
}
