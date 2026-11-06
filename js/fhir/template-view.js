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

/** `text (link)` as escaped HTML; the link only when there is an href. */
export const linkHtml = (text, href) => (href ? `${esc(text)} (<a href="${esc(href)}" rel="noopener">link</a>)` : esc(text));

export const LOINC_NOTICE = 'This material contains content from LOINC (<a href="https://loinc.org" rel="noopener">loinc.org</a>). LOINC is copyright © Regenstrief Institute, Inc. and the Logical Observation Identifiers Names and Codes (LOINC) Committee and is available at no cost under the <a href="https://loinc.org/license/" rel="noopener">LOINC license</a>.';
