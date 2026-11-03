// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createMedia } from '../js/nodes/media-element.js';

describe('createMedia', () => {
  it('builds an img by default, audio/video by content type', () => {
    expect(createMedia({ url: 'https://x.org/a.png' }, 'c').tagName).toBe('IMG');
    expect(createMedia({ url: 'https://x.org/a.mp3', contentType: 'audio/mpeg' }, 'c').tagName).toBe('AUDIO');
    expect(createMedia({ url: 'https://x.org/a.mp4', contentType: 'video/mp4' }, 'c').controls).toBe(true);
  });
  it('accepts relative and data media URLs, sets class and no-referrer', () => {
    expect(createMedia({ url: 'sampledata/a.svg' }, 'preview-item-media').className).toBe('preview-item-media');
    expect(createMedia({ url: 'data:image/png;base64,AAAA' }, 'c')).not.toBeNull();
    expect(createMedia({ url: 'https://x.org/a.png' }, 'c').referrerPolicy).toBe('no-referrer');
  });
  it.each(['javascript:alert(1)', 'ftp://x.org/a.png', 'file:///etc/passwd', 'data:text/html,<b>x</b>', '', undefined])(
    'rejects %s', url => { expect(createMedia({ url }, 'c')).toBeNull(); });
});
