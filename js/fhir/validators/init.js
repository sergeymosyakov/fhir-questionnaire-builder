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
//       { "type": "external", "name": "HAPI FHIR", "url": "https://hapi.fhir.org/baseR4" }
//     ]
//   }

import { validatorRegistry } from './registry.js';
import { LocalValidator }    from './local.js';
import { ExternalValidator } from './external.js';
import { AppEvents }         from '../../events.js';
import { serverConfig, CONFIG_KEYS } from '../server-config.js';

/**
 * Reads config.json and registers validators.
 * Reads initial enabled state from localStorage directly (prefs keys).
 */
export async function initValidators(override = {}) {
  const _ls = (key, def) => {
    try { const v = (typeof localStorage !== 'undefined') && localStorage.getItem('fhirqb.' + key); return v === null || v === false ? def : v !== 'false'; }
    catch { return def; }
  };
  const localEnabled    = override.localEnabled    ?? _ls('validate', true);
  const externalEnabled = override.externalEnabled ?? _ls('validateExternal', false);
  try {
    await serverConfig.ready();
    const defs = serverConfig.getParsed(CONFIG_KEYS.VALIDATORS) || [{ type: 'local', name: 'Built-in' }];

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
  // Broadcast initial states so listeners (QuestionnaireLoader, QRAnswersManager) sync up
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent(AppEvents.VALIDATOR_TOGGLE, { detail: { id: 'local',    enabled: localEnabled } }));
    document.dispatchEvent(new CustomEvent(AppEvents.VALIDATOR_TOGGLE, { detail: { id: 'external', enabled: externalEnabled } }));
  }
}

