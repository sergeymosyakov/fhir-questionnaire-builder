export { applyTip, makeCollapsible } from '../section.js';
export { createCustomSelect } from '../../custom-select.js';

export function toKey(v) {
  if (v === true)  return 'true';
  if (v === false) return 'false';
  return 'null';
}

export function fromKey(k) {
  if (k === 'true')  return true;
  if (k === 'false') return false;
  return null;
}

export const REQUIRED_OPTIONS = [
  { value: 'null',  label: 'Not set' },
  { value: 'true',  label: 'Yes \u2014 required' },
  { value: 'false', label: 'No \u2014 optional' },
];

export const COLL_OPTIONS = [
  { value: '',               label: 'Not set \u2014 always expanded' },
  { value: 'default-open',   label: 'Default open (collapsible)' },
  { value: 'default-closed', label: 'Default closed (collapsed)' },
];
