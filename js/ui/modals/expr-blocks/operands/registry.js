// Registry of operand kinds for the value editor's chain (beyond its built-in question / variable / number /
// aggregate / group). A kind is a subclass of OperandKind; the chain editor asks the registry.
import { Registry } from '../../../../registry.js';

const registry = new Registry({ name: 'operand kind', key: 'id' });

// The chain editor's own kinds; a library kind must not reuse one of these ids.
export const BUILT_IN_OPERANDS = ['item', 'var', 'num', 'agg'];

export function registerOperand(kindClass) {
  if (BUILT_IN_OPERANDS.includes(kindClass?.id)) throw new Error(`operand kind "${kindClass.id}" is a built-in`);
  return registry.register(kindClass);
}
export const operandKinds = () => registry.all();
export const operandKind = (id) => registry.get(id);
