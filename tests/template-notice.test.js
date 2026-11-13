import { describe, it, expect } from 'vitest';
import { copyrightNoticeFor, withCopyrightNotice } from '../js/fhir/template-notice.js';

const third = { name: 'PHQ-9', license: 'No permission required.', licenseUrl: 'https://www.phqscreeners.com/' };
const own = { name: 'Glasgow', license: 'Original wording.', licenseUrl: 'https://github.com/sergeymosyakov/fhir-questionnaire-builder/blob/master/LICENSE' };

describe('copyrightNoticeFor', () => {
  it('credits the licence of a third-party template', () => {
    expect(copyrightNoticeFor(third)).toBe('PHQ-9 — No permission required. (https://www.phqscreeners.com/)');
  });
  it('adds nothing for a template written for this builder', () => {
    expect(copyrightNoticeFor(own)).toBeNull();
  });
});

describe('copyrightNoticeFor — own-repo detection', () => {
  const at = licenseUrl => copyrightNoticeFor({ ...third, licenseUrl });
  it('does not treat a look-alike repository or host as our own', () => {
    expect(at('https://github.com/sergeymosyakov/fhir-questionnaire-builder-fork/blob/x/LICENSE')).not.toBeNull();
    expect(at('https://github.com.evil.example/sergeymosyakov/fhir-questionnaire-builder/LICENSE')).not.toBeNull();
  });
});

describe('withCopyrightNotice', () => {
  const notice = 'PHQ-9 — licence';
  it('uses the notice when there is no copyright text yet', () => expect(withCopyrightNotice('', notice)).toBe(notice));
  it('keeps the author\'s text and appends the notice after it', () => {
    expect(withCopyrightNotice('(c) Acme\n', notice)).toBe('(c) Acme\n\nPHQ-9 — licence');
  });
  it('does not repeat a notice that is already there', () => {
    const once = withCopyrightNotice('(c) Acme', notice);
    expect(withCopyrightNotice(once, notice)).toBe(once);
  });
  it('treats a missing copyright as empty', () => expect(withCopyrightNotice(undefined, notice)).toBe(notice));
  it('leaves the text unchanged when there is no notice', () => expect(withCopyrightNotice('(c) Acme', null)).toBe('(c) Acme'));
});
