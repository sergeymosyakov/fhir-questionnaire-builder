// ── Unit tests: translation import / export round-trip ───────────────────────
import { describe, test, expect } from 'vitest';

// ── Import helpers ────────────────────────────────────────────────────────────
// Replicate the _importTranslations and _exportTranslations logic in isolation
// (no DOM, no module side-effects).

const TRANSLATION_URL = 'http://hl7.org/fhir/StructureDefinition/translation';

function importTranslations(q, translations) {
  const titleExts = (q._title?.extension || []).filter(e => e.url === TRANSLATION_URL);
  for (const ext of titleExts) {
    const lang    = (ext.extension || []).find(s => s.url === 'lang')?.valueCode;
    const content = (ext.extension || []).find(s => s.url === 'content')?.valueString;
    if (!lang || content == null) continue;
    ensureLang(translations, lang);
    translations[lang].title = content;
  }
  walk(q.item, translations);
}

function walk(items, translations) {
  for (const fi of items || []) {
    const textExts = (fi._text?.extension || []).filter(e => e.url === TRANSLATION_URL);
    for (const ext of textExts) {
      const lang    = (ext.extension || []).find(s => s.url === 'lang')?.valueCode;
      const content = (ext.extension || []).find(s => s.url === 'content')?.valueString;
      if (!lang || content == null) continue;
      ensureLang(translations, lang);
      translations[lang].items[fi.linkId] = content;
    }
    for (const ao of fi.answerOption || []) {
      const code = ao.valueCoding?.code;
      if (!code) continue;
      const optExts = (ao._valueCoding?._display?.extension || []).filter(e => e.url === TRANSLATION_URL);
      for (const ext of optExts) {
        const lang    = (ext.extension || []).find(s => s.url === 'lang')?.valueCode;
        const content = (ext.extension || []).find(s => s.url === 'content')?.valueString;
        if (!lang || content == null) continue;
        ensureLang(translations, lang);
        translations[lang].opts[fi.linkId + '__' + code] = content;
      }
    }
    walk(fi.item, translations);
  }
}

function ensureLang(translations, lang) {
  if (!translations[lang]) translations[lang] = { title: '', items: {}, opts: {} };
}

function exportTranslations(q, translations) {
  if (!translations || !Object.keys(translations).length) return;
  const langs = Object.keys(translations);

  const titleExts = langs.filter(l => translations[l].title)
    .map(l => transExt(l, translations[l].title));
  if (titleExts.length) {
    q._title = q._title || {};
    q._title.extension = [...(q._title.extension || []).filter(e => e.url !== TRANSLATION_URL), ...titleExts];
  }

  function walkExport(items) {
    for (const fi of items || []) {
      const textExts = langs.filter(l => translations[l].items[fi.linkId] != null)
        .map(l => transExt(l, translations[l].items[fi.linkId]));
      if (textExts.length) {
        fi._text = fi._text || {};
        fi._text.extension = [...(fi._text.extension || []).filter(e => e.url !== TRANSLATION_URL), ...textExts];
      }
      for (const ao of fi.answerOption || []) {
        const code = ao.valueCoding?.code;
        if (!code) continue;
        const key = fi.linkId + '__' + code;
        const optExts = langs.filter(l => translations[l].opts[key] != null)
          .map(l => transExt(l, translations[l].opts[key]));
        if (!optExts.length) continue;
        if (ao.valueCoding) {
          ao._valueCoding = ao._valueCoding || {};
          ao._valueCoding._display = ao._valueCoding._display || {};
          ao._valueCoding._display.extension = [
            ...(ao._valueCoding._display.extension || []).filter(e => e.url !== TRANSLATION_URL),
            ...optExts,
          ];
        }
      }
      walkExport(fi.item);
    }
  }
  walkExport(q.item);
}

function transExt(lang, content) {
  return { url: TRANSLATION_URL, extension: [{ url: 'lang', valueCode: lang }, { url: 'content', valueString: content }] };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('translation import', () => {
  test('imports title translation', () => {
    const q = {
      title: 'PHQ-9',
      _title: { extension: [transExt('es', 'PHQ-9 en español')] },
      item: [],
    };
    const store = {};
    importTranslations(q, store);
    expect(store.es.title).toBe('PHQ-9 en español');
  });

  test('imports item text translation', () => {
    const q = {
      item: [{
        linkId: 'q1',
        text: 'How are you?',
        _text: { extension: [transExt('fr', 'Comment allez-vous?')] },
        answerOption: [],
      }],
    };
    const store = {};
    importTranslations(q, store);
    expect(store.fr.items['q1']).toBe('Comment allez-vous?');
  });

  test('imports answerOption label translation', () => {
    const q = {
      item: [{
        linkId: 'q1',
        text: 'Q',
        answerOption: [{
          valueCoding: { code: 'yes', display: 'Yes' },
          _valueCoding: { _display: { extension: [transExt('de', 'Ja')] } },
        }],
      }],
    };
    const store = {};
    importTranslations(q, store);
    expect(store.de.opts['q1__yes']).toBe('Ja');
  });

  test('imports multiple languages simultaneously', () => {
    const q = {
      item: [{
        linkId: 'q1',
        text: 'Hello',
        _text: {
          extension: [
            transExt('es', 'Hola'),
            transExt('fr', 'Bonjour'),
          ],
        },
        answerOption: [],
      }],
    };
    const store = {};
    importTranslations(q, store);
    expect(store.es.items['q1']).toBe('Hola');
    expect(store.fr.items['q1']).toBe('Bonjour');
  });

  test('ignores extensions with missing lang or content', () => {
    const q = {
      item: [{
        linkId: 'q1',
        text: 'Q',
        _text: {
          extension: [
            { url: TRANSLATION_URL, extension: [{ url: 'lang', valueCode: 'es' }] }, // missing content
          ],
        },
        answerOption: [],
      }],
    };
    const store = {};
    importTranslations(q, store);
    expect(Object.keys(store)).toHaveLength(0);
  });
});

describe('translation export', () => {
  test('writes title translation to _title', () => {
    const q = { title: 'PHQ-9', item: [] };
    const store = { es: { title: 'PHQ-9 en español', items: {}, opts: {} } };
    exportTranslations(q, store);
    const ext = q._title?.extension?.find(e => e.url === TRANSLATION_URL);
    expect(ext?.extension?.find(s => s.url === 'content')?.valueString).toBe('PHQ-9 en español');
  });

  test('writes item text translation', () => {
    const q = { item: [{ linkId: 'q1', text: 'Hello', answerOption: [] }] };
    const store = { fr: { title: '', items: { q1: 'Bonjour' }, opts: {} } };
    exportTranslations(q, store);
    const ext = q.item[0]._text?.extension?.find(e => e.url === TRANSLATION_URL);
    expect(ext?.extension?.find(s => s.url === 'content')?.valueString).toBe('Bonjour');
  });

  test('writes answerOption label translation', () => {
    const q = {
      item: [{
        linkId: 'q1',
        text: 'Q',
        answerOption: [{ valueCoding: { code: 'yes', display: 'Yes' } }],
      }],
    };
    const store = { es: { title: '', items: {}, opts: { 'q1__yes': 'Sí' } } };
    exportTranslations(q, store);
    const ext = q.item[0].answerOption[0]._valueCoding?._display?.extension?.find(e => e.url === TRANSLATION_URL);
    expect(ext?.extension?.find(s => s.url === 'content')?.valueString).toBe('Sí');
  });

  test('does not duplicate existing translation extensions on re-export', () => {
    const q = {
      item: [{
        linkId: 'q1',
        text: 'Q',
        _text: { extension: [transExt('es', 'old translation')] },
        answerOption: [],
      }],
    };
    const store = { es: { title: '', items: { q1: 'new translation' }, opts: {} } };
    exportTranslations(q, store);
    const transExts = q.item[0]._text.extension.filter(e => e.url === TRANSLATION_URL);
    expect(transExts).toHaveLength(1);
    expect(transExts[0].extension.find(s => s.url === 'content')?.valueString).toBe('new translation');
  });

  test('noop when translations store is empty', () => {
    const q = { title: 'T', item: [] };
    exportTranslations(q, {});
    expect(q._title).toBeUndefined();
  });
});

describe('round-trip: import then export restores original JSON', () => {
  test('item text survives import→export cycle', () => {
    const original = {
      item: [{
        linkId: 'q1',
        text: 'Question',
        _text: { extension: [transExt('es', 'Pregunta')] },
        answerOption: [],
      }],
    };
    const store = {};
    importTranslations(original, store);

    const output = { item: [{ linkId: 'q1', text: 'Question', answerOption: [] }] };
    exportTranslations(output, store);

    const ext = output.item[0]._text?.extension?.find(e => e.url === TRANSLATION_URL);
    expect(ext?.extension?.find(s => s.url === 'lang')?.valueCode).toBe('es');
    expect(ext?.extension?.find(s => s.url === 'content')?.valueString).toBe('Pregunta');
  });
});
