// ── Security: docs page renderMedia only links http(s) URLs ──────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function fakeNode(tag) {
  return { tag, children: [], dataset: {}, appendChild(c) { this.children.push(c); return c; }, set textContent(v) { this.text = v; } };
}

let renderMedia;

beforeEach(async () => {
  vi.stubGlobal('sessionStorage', { getItem: () => null });
  vi.stubGlobal('document', {
    createElement: fakeNode,
    createTextNode: text => ({ tag: '#text', text }),
    querySelectorAll: () => [],
  });
  ({ renderMedia } = await import('../js/questionnaire-docs-page.js'));
});

afterEach(() => vi.unstubAllGlobals());

const anchors = p => p.children.filter(c => c.tag === 'a');

describe('renderMedia', () => {
  it('links http and https URLs', () => {
    for (const url of ['https://example.com/a.png', 'http://example.com/a.png']) {
      const a = anchors(renderMedia('Media', { url }));
      expect(a).toHaveLength(1);
      expect(a[0].href).toBe(url);
    }
  });

  it('renders javascript:, data: and vbscript: URLs as plain text, never as links', () => {
    for (const url of ['javascript:alert(1)', ' JaVaScript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x']) {
      const p = renderMedia('Media', { url });
      expect(anchors(p)).toHaveLength(0);
      expect(p.children.at(-1)).toEqual({ tag: '#text', text: url });
    }
  });

  it('returns null without media', () => {
    expect(renderMedia('Media', null)).toBeNull();
  });
});
