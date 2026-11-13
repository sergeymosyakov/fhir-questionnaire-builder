// Pure helpers shared by the generated template pages: what a respondent answers and what is calculated.
import { esc } from './static-page.js';

const optionText = (o) => o.valueCoding?.display ?? o.valueString ?? String(o.valueInteger ?? o.valueDate ?? o.valueCoding?.code ?? '');

/** [{text, options}] for every question a respondent answers (nested groups flattened; no results, no display notes). */
export function questionsOf(group) {
  return (group.item ?? []).flatMap((i) => {
    if (i.type === 'group') return questionsOf(i);
    if (i.type === 'display' || i.readOnly) return [];
    return [{ text: i.text, options: (i.answerOption ?? []).map(optionText) }];
  });
}

/** Text of every read-only (calculated) result in the template. */
export function resultsOf(group) {
  return (group.item ?? []).flatMap((i) => (i.type === 'group' ? resultsOf(i) : i.readOnly ? [i.text] : []));
}

/** True when the template carries LOINC codes (item codes or answer codes). */
export function usesLoinc(group) {
  const loinc = (c) => c?.system === 'http://loinc.org';
  return (group.item ?? []).some((i) => i.code?.some(loinc) || i.answerOption?.some((o) => loinc(o.valueCoding)) || (i.type === 'group' && usesLoinc(i)));
}

/**
 * Links shown on a template's page: explicitly related templates, other templates of its category,
 * and the gallery patterns behind it. Throws on a reference to an unknown template or pattern.
 * @param {object} entry @param {object[]} entries all catalog entries @param {{id: string, name: string}[]} patterns gallery patterns
 */
export function templateLinks(entry, entries, patterns) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const patternById = new Map(patterns.map((p) => [p.id, p]));
  const pick = (ids, map, what) => ids.map((id) => {
    if (!map.has(id)) throw new Error(`template ${entry.id}: unknown ${what} "${id}"`);
    return map.get(id);
  });
  const related = pick(entry.related ?? [], byId, 'related template');
  const relatedIds = new Set(related.map((e) => e.id));
  return {
    related,
    more: entries.filter((o) => o.id !== entry.id && o.category === entry.category && !relatedIds.has(o.id)),
    patterns: pick(entry.galleryPatterns ?? [], patternById, 'gallery pattern').map((p) => ({ id: p.id, name: p.name })),
  };
}

/** Map of gallery pattern id → [{id, name}] of the templates that list it. */
export function templatesByPatternOf(entries) {
  const map = new Map();
  for (const e of entries) {
    for (const id of e.galleryPatterns ?? []) map.set(id, [...(map.get(id) ?? []), { id: e.id, name: e.name }]);
  }
  return map;
}

/** `text (link)` as escaped HTML; the link only when there is an href. */
export const linkHtml = (text, href) => (href ? `${esc(text)} (<a href="${esc(href)}" rel="noopener">link</a>)` : esc(text));

export const LOINC_NOTICE = 'This material contains content from LOINC (<a href="https://loinc.org" rel="noopener">loinc.org</a>). LOINC is copyright © Regenstrief Institute, Inc. and the Logical Observation Identifiers Names and Codes (LOINC) Committee and is available at no cost under the <a href="https://loinc.org/license/" rel="noopener">LOINC license</a>.';
