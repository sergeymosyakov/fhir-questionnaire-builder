// The scores of the chosen answers of several questions: the collection
//   %resource.repeat(item).where(linkId in ('a' | 'b')).answer.valueCoding.extension('<ordinalValue>').valueDecimal
// which sum()/count() reduce to a scale's total. Read inside an aggregate (sum, count, …) or on its own.
import { registerBlock } from './registry.js';
import { aggregate, AGG_FNS } from '../model.js';

export const ANSWER_SCORES = 'answerScores';
export const ORDINAL_VALUE_URL = 'http://hl7.org/fhir/StructureDefinition/ordinalValue';

export const answerScores = (linkIds, url = ORDINAL_VALUE_URL) => ({ kind: ANSWER_SCORES, linkIds: [...linkIds], url });

const list = (parts) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]);

registerBlock({
  kind: ANSWER_SCORES,
  emit: (b, { q }) => `%resource.repeat(item).where(linkId in (${b.linkIds.map(q).join(' | ')})).answer.valueCoding.extension(${q(b.url)}).valueDecimal`,
  describe: (b, { title }) => `the scores of the answers to ${list(b.linkIds.map(title))}`,
  formula: (b, labelOf) => `scores of ${b.linkIds.map(labelOf).join(', ')}`,

  // …repeat(item).where(linkId in (…)).answer.valueCoding.extension('url').valueDecimal[.sum()|.count()|…]
  parsePath: ({ head, steps }, ctx) => {
    if (!ctx.isResourceTerm(head)) return null;
    const rest = [...steps];
    const last = rest[rest.length - 1];
    let fn = null;
    if (last?.kind === 'func' && last.args.length === 0 && AGG_FNS.includes(last.name)) { fn = last.name; rest.pop(); }
    if (rest.length !== 6) return null;
    const [repeat, where, answer, coding, extension, value] = rest;
    const is = (s, kind, name, argc) => s.kind === kind && s.name === name && (argc == null || s.args.length === argc);
    if (!is(repeat, 'func', 'repeat', 1) || !ctx.isBareName(repeat.args[0], 'item')) return null;
    if (!is(where, 'func', 'where', 1)) return null;
    const test = ctx.unwrap(where.args[0]);
    if (test?.type !== 'MembershipExpression' || test.text !== 'in' || ctx.identOfTerm(ctx.kids(test)[0]) !== 'linkId') return null;
    const linkIds = ctx.collectStrings(ctx.kids(test)[1]);
    if (!linkIds) return null;
    if (!is(answer, 'member', 'answer') || !is(coding, 'member', 'valueCoding') || !is(value, 'member', 'valueDecimal')) return null;
    if (!is(extension, 'func', 'extension', 1)) return null;
    const url = ctx.stringLitOf(extension.args[0]);
    if (url == null) return null;
    const scores = answerScores(linkIds, url);
    return fn ? aggregate(fn, scores) : scores;
  },
});
