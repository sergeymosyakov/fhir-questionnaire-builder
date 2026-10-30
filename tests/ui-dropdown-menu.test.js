// @vitest-environment jsdom
// ── DOM tests: DropdownMenu HTML handling and open/close behaviour ────────────

import { describe, it, expect, vi, afterEach } from 'vitest';
import { DropdownMenu } from '../js/ui/dropdown-menu.js';

afterEach(() => {
  delete window.DOMPurify;
  document.body.innerHTML = '';
});

describe('DropdownMenu _setHtml', () => {
  it('without DOMPurify, renders the label and item html as inert text', () => {
    const m = new DropdownMenu({ label: 'Menu <b>x</b>' });
    const item = m._item('i1', '<img src=x onerror=alert(1)>');
    expect(m._btn.textContent).toBe('Menu <b>x</b>');
    expect(m._btn.querySelector('b')).toBeNull();
    expect(item.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(item.querySelector('img')).toBeNull();
  });

  it('with DOMPurify, passes html through sanitize and renders its output as markup', () => {
    // Fixed input→output table: the stub must not implement real sanitizing.
    const cleaned = { 'ok <b>bold</b><script>evil()</script>': 'ok <b>bold</b>' };
    const sanitize = vi.fn(h => cleaned[h] ?? h);
    window.DOMPurify = { sanitize };
    const m = new DropdownMenu({ label: 'Menu &#x25BE;' });
    const item = m._item('i1', 'ok <b>bold</b><script>evil()</script>');
    expect(sanitize).toHaveBeenCalledWith('Menu &#x25BE;');
    expect(sanitize).toHaveBeenCalledWith('ok <b>bold</b><script>evil()</script>');
    expect(m._btn.textContent).toBe('Menu ▾');
    expect(item.innerHTML).toBe('ok <b>bold</b>');
    expect(item.querySelector('script')).toBeNull();
  });

  it('assigns id and testid to items', () => {
    const item = new DropdownMenu()._item('myId', 'x', 'my-testid');
    expect(item.id).toBe('myId');
    expect(item.dataset.testid).toBe('my-testid');
    expect(item.className).toBe('load-menu-item');
  });
});

describe('DropdownMenu open/close', () => {
  it('opens on click, sets ARIA state and closes on an outside click', () => {
    const m = new DropdownMenu({ menuId: 'someMenu' });
    document.body.appendChild(m.el);
    expect(m._menu.style.display).toBe('none');
    m._btn.click();
    expect(m._menu.style.display).toBe('block');
    expect(m._btn.getAttribute('aria-expanded')).toBe('true');
    expect(m._btn.classList.contains('load-btn--active')).toBe(true);
    document.body.click();
    expect(m._menu.style.display).toBe('none');
    expect(m._btn.getAttribute('aria-expanded')).toBe('false');
    expect(m._btn.classList.contains('load-btn--active')).toBe(false);
  });

  it('opening one menu closes another', () => {
    const a = new DropdownMenu(); const b = new DropdownMenu();
    document.body.append(a.el, b.el);
    a._btn.click();
    b._btn.click();
    expect(a._menu.style.display).toBe('none');
    expect(b._menu.style.display).toBe('block');
  });

  it('clicking the open button again toggles it closed and fires _onOpen only when opening', () => {
    const m = new DropdownMenu();
    m._onOpen = vi.fn();
    document.body.appendChild(m.el);
    m._btn.click();
    m._btn.click();
    expect(m._menu.style.display).toBe('none');
    expect(m._onOpen).toHaveBeenCalledTimes(1);
  });

  it('derives a kebab-case testid for the menu from menuId', () => {
    expect(new DropdownMenu({ menuId: 'loadMenu' })._menu.dataset.testid).toBe('load-menu');
  });
});
