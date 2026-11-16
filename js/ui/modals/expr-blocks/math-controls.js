// The controls for a rounding-style function (round, abs, …), shared by the result's rounding row and the
// "Round / square root / … of ( … )" operand so both read and behave the same.
import { createCustomSelect } from '../../custom-select.js';
import { MATH_WRAP_FNS, MATH_FNS } from '../../../fhir/expr-builder/model.js';

const LABELS = { sqrt: 'square root', round: 'round', abs: 'absolute value', ceiling: 'round up (ceiling)', floor: 'round down (floor)', truncate: 'truncate' };
const itemsOf = (fns) => fns.map((v) => ({ value: v, label: LABELS[v] }));
export const MATH_FN_ITEMS = itemsOf(MATH_WRAP_FNS);

/** @param {{ value: string, onChange(fn), testid, none?: string, ariaLabel?, withSqrt?: boolean }} opts — `none` adds a leading "no function" entry; `withSqrt` offers the square root too */
export function createMathFnSelect({ value, onChange, testid, none, ariaLabel = 'Function', withSqrt = false }) {
  const fns = itemsOf(withSqrt ? MATH_FNS : MATH_WRAP_FNS);
  return createCustomSelect({
    items: none ? [{ value: '', label: none }, ...fns] : fns,
    value,
    className: 'sc-trigger--sm',
    testid,
    ariaLabel,
    onChange,
  });
}

/** The "decimals" box of round(), with its caption. The input carries the test id. */
export function createDecimalsInput({ value, onInput, testid }) {
  const wrap = document.createElement('span');
  wrap.className = 'eb-decimals';
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.step = '1';
  inp.min = '0';
  inp.className = 'eb-val-inp eb-wrap-arg';
  inp.placeholder = '0';
  inp.dataset.testid = testid;
  inp.setAttribute('aria-label', 'Decimal places');
  inp.value = value;
  inp.addEventListener('input', () => onInput(inp.value));
  const caption = document.createElement('span');
  caption.textContent = 'decimals';
  wrap.append(inp, caption);
  return wrap;
}

/** round()'s argument as a number, or null when empty or not a number. */
export function decimalsArg(text) {
  if (text === '' || text == null) return null;
  const n = Number(text);
  return isNaN(n) ? null : n;
}
