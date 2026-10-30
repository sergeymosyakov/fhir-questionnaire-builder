// ── Security: markdown label fallback never uses innerHTML without sanitizer ─
import { describe, it, expect, vi, afterEach } from 'vitest';
import { BaseNode } from '../js/nodes/base-node.js';

function fakeEl() {
  return { innerHTML: '', textContent: '' };
}

const rc = { activeLanguage: 'fr', translations: { fr: { markdown: { q1: '<img src=x onerror=alert(1)>' } } } };

afterEach(() => vi.unstubAllGlobals());

describe('BaseNode._applyLabelContent translated markdown', () => {
  it('uses textContent when DOMPurify is missing', () => {
    vi.stubGlobal('window', { marked: { parseInline: s => s } });
    const el = fakeEl();
    new BaseNode({ id: 'q1' })._applyLabelContent(el, rc);
    expect(el.innerHTML).toBe('');
    expect(el.textContent).toBe(rc.translations.fr.markdown.q1);
  });

  it('uses textContent when marked is missing', () => {
    vi.stubGlobal('window', { DOMPurify: { sanitize: s => s } });
    const el = fakeEl();
    new BaseNode({ id: 'q1' })._applyLabelContent(el, rc);
    expect(el.innerHTML).toBe('');
    expect(el.textContent).toBe(rc.translations.fr.markdown.q1);
  });

  it('sanitizes parsed markdown when both libs are present', () => {
    vi.stubGlobal('window', { DOMPurify: { sanitize: s => `S(${s})` }, marked: { parseInline: s => `P(${s})` } });
    const el = fakeEl();
    new BaseNode({ id: 'q1' })._applyLabelContent(el, rc);
    expect(el.innerHTML).toBe(`S(P(${rc.translations.fr.markdown.q1}))`);
  });
});
