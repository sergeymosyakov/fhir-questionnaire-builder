// The controls for a rounding-style function (round, abs, …), shared by the result's rounding row and the
// "Round / abs / … of ( … )" operand so both read and behave the same.
import { createCustomSelect } from '../../custom-select.js';
import { MATH_WRAP_FNS } from '../../../fhir/expr-builder/model.js';

const LABELS = { round: 'round', abs: 'absolute value', ceiling: 'round up (ceiling)', floor: 'round down (floor)', truncate: 'truncate' };
export const MATH_FN_ITEMS = MATH_WRAP_FNS.map((v) => ({ value: v, label: LABELS[v] }));

/** @param {{ value: string, onChange(fn), testid, none?: string, ariaLabel? }} opts — `none` adds a leading "no function" entry */
export function createMathFnSelect({ value, onChange, testid, none, ariaLabel = 'Function' }) {
  return createCustomSelect({
    items: none ? [{ value: '', label: none }, ...MATH_FN_ITEMS] : MATH_FN_ITEMS,
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
