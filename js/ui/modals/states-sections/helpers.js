export { applyTip, makeCollapsible } from '../section.js';
export { createCustomSelect } from '../../custom-select.js';

export function toKey(v) {
  if (v === true) return 'true';
  return 'false';
}

export function fromKey(k) {
  if (k === 'true') return true;
  return false;
}

export const REQUIRED_OPTIONS = [
  { value: 'true',  label: 'Yes \u2014 required' },
  { value: 'false', label: 'No \u2014 optional' },
];

export const COLL_OPTIONS = [
  { value: '',               label: 'Not set \u2014 always expanded' },
  { value: 'default-open',   label: 'Default open (collapsible)' },
  { value: 'default-closed', label: 'Default closed (collapsed)' },
];
