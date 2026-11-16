// The operand library: one file per kind; importing a file registers it. To add a kind, subclass OperandKind in
// its own file, register it, and import it below — the value editor picks it up through the registry.
import './group.js';
import './scale-total.js'; // before if.js: it claims the exact scale-total shape of a conditional
import './score.js';
import './if.js';
import './empty.js';
import './math.js';
import './power.js';
import './negate.js';
import './text.js';

export { operandKinds, operandKind, registerOperand } from './registry.js';
export { OperandKind } from './operand-kind.js';
