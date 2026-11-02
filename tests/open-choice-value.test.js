// Open-choice answers: a picked option is a Coding object, typed text is a string (R4: Coding or string).
import { describe, it, expect, vi } from 'vitest';
import { isCoded, openChoiceText, pickedValue, matchesOption, initialAnswerValue, answerText } from '../js/fhir/open-choice-value.js';
import { FHIR } from '../js/fhir/urls/fhir.js';
import { importQRAnswers } from '../js/fhir/qr-import.js';
import { buildQR } from '../js/fhir/qr-builder.js';
import { evalInitialExprNodes } from '../js/fhir/calc.js';
import { compareValue } from '../js/eval.js';

const SYS = 'http://example.org/cs';
const tree = [{ id: 'o', itemType: 'open-choice', children: [] }];
const qrOf = answer => ({ resourceType: 'QuestionnaireResponse', item: [{ linkId: 'o', answer }] });

describe('value helpers', () => {
  it('distinguishes a picked option from typed text', () => {
    expect(isCoded({ code: 'a' })).toBe(true);
    expect(isCoded('a')).toBe(false);
    expect(isCoded(null)).toBe(false);
    expect(isCoded({ value: 5, unit: 'mg', code: 'mg', system: SYS })).toBe(false);
  });
  it('shows the display of a picked option and the text as typed', () => {
    expect(openChoiceText({ code: 'a', display: 'Alpha' })).toBe('Alpha');
    expect(openChoiceText({ code: 'a' })).toBe('a');
    expect(openChoiceText('free')).toBe('free');
    expect(openChoiceText(undefined)).toBe('');
  });
  it('pickedValue takes the system from the option or its raw answerOption', () => {
    expect(pickedValue({ code: 'a', display: 'A', system: SYS })).toEqual({ code: 'a', display: 'A', system: SYS });
    expect(pickedValue({ code: 'a', display: 'A' }, { valueCoding: { system: SYS } })).toEqual({ code: 'a', display: 'A', system: SYS });
    expect(pickedValue({ code: 'a' })).toEqual({ code: 'a', display: 'a' });
  });
  it('matchesOption is an exact match on display or code', () => {
    const opts = [{ code: 'Y', display: 'Yes' }];
    expect(matchesOption('Yes', opts)).toBe(true);
    expect(matchesOption('Y', opts)).toBe(true);
    expect(matchesOption('yes', opts)).toBe(false);
    expect(matchesOption('', opts)).toBe(false);
  });
});

describe('open-choice rendered as radio / check-box (option codes, no typing)', () => {
  const ctl = code => [{ url: FHIR.itemControl, valueCodeableConcept: { coding: [{ code }] } }];
  const answerOption = [{ valueCoding: { system: SYS, code: 'a', display: 'A' } }];
  it.each(['radio-button', 'check-box', 'atable'])('%s: a stored option code exports as valueCoding', code => {
    const fhir = { item: [{ linkId: 'o', type: 'open-choice', extension: ctl(code), answerOption }] };
    expect(buildQR(fhir, { o: ['a'] }).item[0].answer).toEqual([{ valueCoding: { system: SYS, code: 'a', display: 'A' } }]);
  });
});

describe('answerText', () => {
  it('renders every stored value kind as readable text', () => {
    expect(answerText({ code: 'a', display: 'A' })).toBe('A');
    expect(answerText({ code: 'a' })).toBe('a');
    expect(answerText({ reference: 'Patient/1', display: 'P' })).toBe('P');
    expect(answerText({ value: 5, unit: 'kg' })).toBe('5 kg');
    expect(answerText({ value: 5, unit: 'mg', system: SYS, code: 'mg' })).toBe('5 mg');
    expect(answerText({ value: '', unit: 'mg' })).toBe('');
    expect(answerText({ name: 'scan.pdf', size: 1 })).toBe('scan.pdf');
    expect(answerText(0)).toBe('0');
    expect(answerText(false)).toBe('false');
    expect(answerText(undefined)).toBe('');
    expect(answerText('')).toBe('');
  });
});

describe('QR import for open-choice', () => {
  it('valueCoding becomes a Coding object, valueString stays a string', () => {
    const coded = {};
    importQRAnswers(qrOf([{ valueCoding: { system: SYS, code: 'a', display: 'A' } }]), coded, tree);
    expect(coded.o).toEqual([{ code: 'a', display: 'A', system: SYS }]);
    const typed = {};
    importQRAnswers(qrOf([{ valueString: 'free' }]), typed, tree);
    expect(typed.o).toEqual(['free']);
  });
  it('other choice types still import the bare code', () => {
    const values = {};
    importQRAnswers(qrOf([{ valueCoding: { code: 'a' } }]), values, [{ id: 'o', itemType: 'select', children: [] }]);
    expect(values.o).toEqual(['a']);
  });
  it('works inside repeating-group instances', () => {
    const t = [{ id: 'g', type: 'group', repeats: true, children: [{ id: 'o', itemType: 'open-choice', children: [] }] }];
    const values = {};
    const qr = { resourceType: 'QuestionnaireResponse', item: [
      { linkId: 'g', item: [{ linkId: 'o', answer: [{ valueCoding: { code: 'a', display: 'A' } }] }] },
      { linkId: 'g', item: [{ linkId: 'o', answer: [{ valueString: 'free' }] }] },
    ] };
    importQRAnswers(qr, values, t);
    expect(values.g.map(m => m.o)).toEqual([[{ code: 'a', display: 'A' }], ['free']]);
  });
  it('a coded answer survives import then rebuild unchanged', () => {
    const values = {};
    const answer = [{ valueCoding: { system: SYS, code: 'a', display: 'A' } }];
    importQRAnswers(qrOf(answer), values, tree);
    const qr = buildQR({ item: [{ linkId: 'o', type: 'open-choice' }] }, values);
    expect(qr.item[0].answer).toEqual(answer);
  });
});

describe('enableWhen on open-choice values', () => {
  it('a picked option compares by its code (answerCoding and string-valued options)', () => {
    const picked = { code: 'a', display: 'A' };
    expect(compareValue(picked, { operator: '=', answerCoding: { code: 'a' } })).toBe(true);
    expect(compareValue(picked, { operator: '=', answerCoding: { code: 'b' } })).toBe(false);
    expect(compareValue(picked, { operator: '=', answerString: 'a' })).toBe(true);
    expect(compareValue(picked, { operator: '=', answerString: 'A' })).toBe(false);
    expect(compareValue(picked, { operator: '!=', answerString: 'A' })).toBe(true);
  });
  it('typed text still compares as a string', () => {
    expect(compareValue('free', { operator: '=', answerString: 'free' })).toBe(true);
  });
});

describe('expression results for open-choice', () => {
  const run = result => {
    const values = {};
    evalInitialExprNodes([{ id: 'o', type: 'item', itemType: 'open-choice', _initialExpr: 'e' }], {}, { evaluate: vi.fn(() => result) }, values);
    return values.o;
  };
  it('a Coding result is a picked option', () => {
    expect(run([{ code: 'a', display: 'A', system: SYS }])).toEqual({ code: 'a', display: 'A', system: SYS });
  });
  it('a string result stays free text', () => {
    expect(run(['free'])).toBe('free');
  });
});

describe('initial answers for open-choice', () => {
  const node = extra => ({ itemType: 'open-choice', ...extra });
  it('a default naming a listed Coding option is a picked option', () => {
    const n = node({ _rawAnswerOptions: [{ valueCoding: { system: SYS, code: 'a', display: 'A' } }] });
    expect(initialAnswerValue(n, 'a')).toEqual({ code: 'a', display: 'A', system: SYS });
  });
  it('a kept initial Coding wins and carries its system and display', () => {
    const n = node({ _initialCodings: [{ system: SYS, code: 'x', display: 'X' }] });
    expect(initialAnswerValue(n, 'x')).toEqual({ code: 'x', display: 'X', system: SYS });
  });
  it('an initial valueString stays text even if it equals an option code', () => {
    const n = node({ _initialTexts: ['a'], _rawAnswerOptions: [{ valueCoding: { code: 'a', display: 'A' } }] });
    expect(initialAnswerValue(n, 'a')).toBe('a');
  });
  it('other item types are untouched', () => {
    expect(initialAnswerValue({ itemType: 'select' }, 'a')).toBe('a');
  });
});
