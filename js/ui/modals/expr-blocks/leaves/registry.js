// Registry of condition-leaf kinds for the condition tree editor, beyond its built-in "question <op> value"
// and "question has an answer". A kind is a subclass of LeafKind; the leaf editor asks the registry.
import { Registry } from '../../../../registry.js';

const registry = new Registry({ name: 'leaf kind', key: 'id' });

export const registerLeafKind = (kindClass) => registry.register(kindClass);
export const leafKinds = () => registry.all();
export const leafKind = (id) => registry.get(id);

// The first kind that recognises the block → an instance, else null.
export const leafFromBlock = (block, items, ctx) => registry.first((Kind) => (Kind.available(ctx) ? Kind.fromBlock(block, items, ctx) : null));
