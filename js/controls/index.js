// ── Control registry ──────────────────────────────────────────────────────────
// Maps itemType → build(node, ctx) factory function.
// To add a new control type: create its module and register it here.
import { build as checkbox    } from './checkbox.js';
import { build as number      } from './number.js';
import { build as date        } from './date.js';
import { build as datetime    } from './datetime.js';
import { build as time        } from './time.js';
import { build as url         } from './url.js';
import { build as attachment  } from './attachment.js';
import { build as select      } from './select.js';
import { build as radio       } from './radio.js';
import { build as openChoice  } from './open-choice.js';
import { build as text        } from './text.js';
import { build as reference   } from './reference.js';
import { build as quantity    } from './quantity.js';

const registry = new Map([
  ['checkbox',    checkbox],
  ['number',      number],
  ['integer',      number],
  ['decimal',      number],
  ['date',        date],
  ['dateTime',    datetime],
  ['time',         time],
  ['url',         url],
  ['attachment',  attachment],
  ['select',      select],
  ['radio',       radio],
  ['open-choice', openChoice],
  ['text',        text],
  ['reference',   reference],
  ['quantity',    quantity],
]);

// Returns the built wrapper element, or null for unknown / display types.
export function buildControl(node, ctx) {
  const factory = registry.get(node.itemType) ?? text;
  return factory(node, ctx);
}
