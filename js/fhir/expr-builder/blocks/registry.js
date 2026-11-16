// Registry of expression-builder block kinds that live outside the core model. A block
// file registers one definition; parse/emit/describe ask the registry about kinds they don't know.
//
// def = {
//   kind,                                    // block.kind string
//   atomic?,                                 // true: a single value, never bracketed when described as an operand
//   emit(block, ctx),                        // → FHIRPath text; ctx = { emit, wrap, wrapTarget, q }
//   describe(block, ctx),                    // → plain words or null; ctx = { describe, title }
//   describeExists?(block, negate, ctx),     // wording for "<block> has / has no an answer"
//   parseNode?(node, ctx),                   // CST node → block | null; ctx = { toBlock, kids, identText }
//   parseTerm?(term, ctx),                   // CST term (literal/function call) → block | null
//   parsePath?({ head, steps, receiver }, ctx), // a member/function chain → block | null; receiver() = the chain without its last step, as a block
//   formula?(block, labelOf, text),          // the block inside a short formula (formula-text.js); text(b) formats a sub-block
// }
import { Registry } from '../../../registry.js';

const registry = new Registry({ name: 'block', key: 'kind' });

export const registerBlock = (def) => registry.register(def);
export const blockDef = (kind) => registry.get(kind);
export const isRegisteredKind = (kind) => registry.has(kind);
export const registeredBlocks = () => registry.all();

// First definition whose hook yields a block wins.
export const parseWithRegistry = (hook, node, ctx) => registry.first((def) => def[hook]?.(node, ctx));
