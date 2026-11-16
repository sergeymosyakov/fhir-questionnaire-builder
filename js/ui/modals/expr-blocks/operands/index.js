// The operand library: one file per kind; importing a file registers it. To add a kind, subclass OperandKind in
// its own file, register it, and import it below — the value editor picks it up through the registry.
import './if.js';
import './empty.js';

export { operandKinds, operandKind, registerOperand } from './registry.js';
export { OperandKind } from './operand-kind.js';
