// The block library: one file per block kind; importing a file registers it. To add a kind,
// create its file here and import it below — parse/emit/describe pick it up through the registry.
import './iif.js';
import './union.js';
import './empty.js';

export { iif, IIF } from './iif.js';
export { union, UNION } from './union.js';
export { empty, EMPTY } from './empty.js';
export { blockDef, isRegisteredKind, registeredBlocks, registerBlock } from './registry.js';
