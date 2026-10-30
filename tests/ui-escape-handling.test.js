// @vitest-environment jsdom
// ── DOM tests: Escape closes custom-select / date-picker / toast and stays contained ──
// An open popup's Escape must not reach a document-level Escape listener
// (e.g. an enclosing modal's close handler).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCustomSelect } from '../js/ui/custom-select.js';
import { createDatePicker } from '../js/ui/date-picker.js';
import { showError, showPrompt } from '../js/ui/toast.js';

const esc = () => new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });

let modalEscape;
beforeEach(() => {
  Element.prototype.scrollIntoView = () => {}; // not implemented in jsdom
  document.body.innerHTML = '';
  modalEscape = vi.fn();
  document.addEventListener('keydown', modalEscape);
});
afterEach(() => {
  document.removeEventListener('keydown', modalEscape);
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('custom-select Escape', () => {
  const items = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
  let sel;
  beforeEach(() => {
    sel = createCustomSelect({ items, value: 'a' });
    document.body.appendChild(sel.el);
  });

  it('closes the open dropdown, keeps the value, refocuses the trigger and does not reach document listeners', () => {
    sel.el.click();
    expect(document.querySelector('.csel-drop')).not.toBeNull();
    expect(sel.el.getAttribute('aria-expanded')).toBe('true');
    const ev = esc();
    sel.el.dispatchEvent(ev);
    expect(document.querySelector('.csel-drop')).toBeNull();
    expect(sel.el.getAttribute('aria-expanded')).toBe('false');
    expect(sel.getValue()).toBe('a');
    expect(document.activeElement).toBe(sel.el);
    expect(modalEscape).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it('also stops propagation when the event target is outside the trigger', () => {
    sel.el.click();
    document.body.dispatchEvent(esc());
    expect(document.querySelector('.csel-drop')).toBeNull();
    expect(modalEscape).not.toHaveBeenCalled();
  });

  it('lets Escape through once the dropdown is closed (so a surrounding modal can close)', () => {
    sel.el.dispatchEvent(esc());
    expect(modalEscape).toHaveBeenCalledTimes(1);
  });

  it('removes its document listeners after closing (second Escape reaches the document)', () => {
    sel.el.click();
    sel.el.dispatchEvent(esc());
    document.body.dispatchEvent(esc());
    expect(modalEscape).toHaveBeenCalledTimes(1);
  });

  it('works for a searchable dropdown too', () => {
    vi.useFakeTimers();
    const s = createCustomSelect({ items, value: 'a', searchable: true });
    document.body.appendChild(s.el);
    s.el.click();
    expect(document.querySelector('.vis-q-sel-search')).not.toBeNull();
    document.querySelector('.vis-q-sel-search').dispatchEvent(esc());
    expect(document.querySelector('.csel-drop')).toBeNull();
    expect(modalEscape).not.toHaveBeenCalled();
  });
});

describe('date-picker Escape', () => {
  let dp;
  beforeEach(() => {
    dp = createDatePicker({ value: '2024-05-06' });
    document.body.appendChild(dp.el);
  });

  it('closes the calendar, keeps the value, refocuses the trigger and does not reach document listeners', () => {
    dp.el.click();
    expect(document.querySelector('.dp-cal')).not.toBeNull();
    dp.el.dispatchEvent(esc());
    expect(document.querySelector('.dp-cal')).toBeNull();
    expect(dp.getValue()).toBe('2024-05-06');
    expect(document.activeElement).toBe(dp.el);
    expect(modalEscape).not.toHaveBeenCalled();
  });

  it('stops Escape fired from inside the calendar', () => {
    dp.el.click();
    document.querySelector('.dp-cal').dispatchEvent(esc());
    expect(document.querySelector('.dp-cal')).toBeNull();
    expect(modalEscape).not.toHaveBeenCalled();
  });

  it('lets Escape through when the calendar is not open', () => {
    dp.el.dispatchEvent(esc());
    expect(modalEscape).toHaveBeenCalledTimes(1);
  });

  it('removes its listener after closing', () => {
    dp.el.click();
    dp.el.dispatchEvent(esc());
    document.body.dispatchEvent(esc());
    expect(modalEscape).toHaveBeenCalledTimes(1);
  });
});

describe('toast Escape', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('Escape dismisses the notification and does not reach document listeners', () => {
    showError('Something broke');
    const backdrop = document.querySelector('.notif-backdrop');
    expect(backdrop.querySelector('.modal-body').textContent).toBe('Something broke');
    document.body.dispatchEvent(esc());
    expect(backdrop.style.opacity).toBe('0');
    vi.advanceTimersByTime(300);
    expect(document.querySelector('.notif-backdrop')).toBeNull();
    expect(modalEscape).not.toHaveBeenCalled();
  });

  it('Escape does not propagate even to a document listener registered in the capture phase later than the toast', () => {
    showError('x');
    const late = vi.fn();
    document.addEventListener('keydown', late);
    document.body.dispatchEvent(esc());
    document.removeEventListener('keydown', late);
    expect(late).not.toHaveBeenCalled();
  });

  it('Enter also dismisses but is not swallowed', () => {
    showError('x');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    vi.advanceTimersByTime(300);
    expect(document.querySelector('.notif-backdrop')).toBeNull();
    expect(modalEscape).toHaveBeenCalledTimes(1);
  });

  it('after dismissal the toast no longer swallows Escape', () => {
    showError('x');
    document.body.dispatchEvent(esc());
    document.body.dispatchEvent(esc());
    expect(modalEscape).toHaveBeenCalledTimes(1);
  });

  it('showPrompt: Escape cancels with null and does not propagate', () => {
    const cb = vi.fn();
    showPrompt('Name', 'default', cb);
    document.body.dispatchEvent(esc());
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(null);
    expect(modalEscape).not.toHaveBeenCalled();
  });

  it('showPrompt: Enter confirms with the trimmed input value', () => {
    const cb = vi.fn();
    showPrompt('Name', 'default', cb);
    document.querySelector('.modal-text-input').value = '  typed  ';
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(cb).toHaveBeenCalledWith('typed');
  });
});
