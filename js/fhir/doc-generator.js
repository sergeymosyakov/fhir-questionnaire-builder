// ── Questionnaire documentation model builder ─────────────────────────────────
// Pure function — walks the tree into a structured doc model consumed by both
// doc-render-text.js and questionnaire-docs-page.js. Reuses existing FHIR
// helpers (humanEnableWhen, validateTree, auditTree) so wording matches the
// live builder exactly. No DOM, no EventState — all state is passed in.
import { validateTree } from './validate.js';
import { auditTree } from './audit.js';
import { parseOptions } from '../utils.js';
import { LANGUAGES_MAP } from './languages.js';
import { COPYRIGHT_HTML } from '../ui/copyright-notice.js';
import { parseExprTree } from './explain.js';
import { parseExpression, expandAggregateOverSet } from './expr-builder/parse.js';
import { describeBlock, COMPARE_WORDS } from './expr-builder/describe.js';
import { parseRenderStyle } from './render-style.js';

// Icon vocabulary shared with gtable-renderer.js's column indicators, plus a
// couple of doc-only entries (required, repeats) — documented once here.
export const DOC_LEGEND = [
  { icon: '*',        label: 'Required',    desc: 'Item must be answered before the questionnaire can pass (Questionnaire.item.required)' },
  { icon: '\u21BB',   label: 'Repeats',     desc: 'Item may carry more than one answer (Questionnaire.item.repeats)' },
  { icon: '\uD83D\uDD12', label: 'Read-only', desc: 'Value is computed, never typed by the respondent (Questionnaire.item.readOnly)' },
  { icon: '\u26A1',   label: 'Calculated',  desc: 'Value is derived from a FHIRPath calculatedExpression' },
  { icon: '\uD83D\uDC41', label: 'Conditional', desc: 'Item is shown only when a visibility condition is met (enableWhen / enableWhenExpression)' },
  { icon: '\u26A0\uFE0F', label: 'Constraint', desc: 'Item carries a validation rule beyond basic type/cardinality (questionnaire-constraint)' },
  { icon: '\uD83D\uDD17', label: 'Support link', desc: 'Item carries an external reference link (questionnaire-supportLink)' },
  { icon: 'G',        label: 'Group',       desc: 'Row is a structural container (Questionnaire.item with type=group)', badges: [{ text: 'G', cls: 'group' }] },
  { icon: 'Q',        label: 'Question',    desc: 'Row is an answerable item (any non-group Questionnaire.item type)', badges: [{ text: 'Q', cls: 'item' }] },
  { icon: '\uD83C\uDF10', label: 'Translation', desc: 'One or more translated language versions are listed below the original text (questDoc.translations)' },
  { icon: '\uD83C\uDFA8', label: 'Appearance', desc: 'Item has custom presentation — rendering-style, rendering-xhtml, or rendering-markdown — shown in a highlighted box' },
];

function buildLinkIdMap(nodes, map = {}) {
  for (const n of nodes) {
    map[n.id] = n.title || n.id;
    if (n.children?.length) buildLinkIdMap(n.children, map);
  }
  return map;
}

// FHIR-standard min..max cardinality notation, not invented prose.
function cardinality(node) {
  const min = node.mandatory ? 1 : (node._minOccurs ?? 0);
  const max = node.repeats ? (node._maxOccurs ?? '*') : 1;
  return `${min}..${max}`;
}

function flags(node) {
  const f = [];
  if (node.mandatory) f.push('*');
  if (node.repeats) f.push('\u21BB');
  if (node._readOnly) f.push('\uD83D\uDD12');
  if (node._calculatedExpr) f.push('\u26A1');
  if (node.enableWhen?.length || node.enableWhenExpression) f.push('\uD83D\uDC41');
  if (node.constraint?.length) f.push('\u26A0\uFE0F');
  if (node._supportLinks?.length) f.push('\uD83D\uDD17');
  return f.join(' ');
}

// kind: 'title' | 'item' | 'opt' — matches questDoc.translations' three text stores.
function translationsFor(kind, key, translations) {
  const out = [];
  for (const [lang, store] of Object.entries(translations || {})) {
    const text = kind === 'title' ? store.title
      : kind === 'item' ? store.items?.[key]
      : store.opts?.[key];
    if (text) out.push({ lang, label: LANGUAGES_MAP.get(lang) || lang, text });
  }
  return out;
}

// Leaf-level gloss, reusing the Expression Builder's own parser (parse.js) so
// it's not a second FHIRPath translator. When the block model can't represent
// the text (falls to `raw`), try expanding it as a boolean aggregate-over-a-set
// of linkIds (allTrue/anyTrue/…, or the `count($this=true) >= 1` idiom) — a
// common real-world idiom (the same one Build's condition editor recognizes,
// js/ui/modals/expr-tree/tree-editor.js) — turning it into a nested AND/OR of
// leaves instead of one leaf. A leaf that still can't be described keeps its
// own raw FHIRPath as `code` — never a fabricated guess, and pinpoints exactly
// which fragment wasn't understood instead of failing the whole expression.
function describeLeafNode(text, fp, linkIdMap) {
  const block = parseExpression(text, fp);
  if (block) {
    const d = describeBlock(block, linkIdMap);
    if (d != null) return { type: 'LEAF', human: d, code: text };
  }
  const expanded = expandAggregateOverSet(text, fp);
  if (expanded) {
    return { type: expanded.op === 'or' ? 'OR' : 'AND', children: expanded.leaves.map(l => describeLeafNode(l, fp, linkIdMap)) };
  }
  return { type: 'LEAF', human: null, code: text };
}

// Full expression → an AND/OR/NOT/LEAF tree, mirroring the exact shape
// js/fhir/explain.js builds for the Explain modal (same string-based top-level
// and/or/not decomposition) — but each LEAF carries a human-readable gloss
// instead of a live ✓/✗ result (this document has no patient/answer context).
function describeExprTree(text, fp, linkIdMap) {
  if (!text) return null;
  if (!fp) return { type: 'LEAF', human: null, code: text };
  return buildFromParsedTree(parseExprTree(text), fp, linkIdMap);
}

function buildFromParsedTree(node, fp, linkIdMap) {
  if (node.type === 'LEAF') return describeLeafNode(node.expr, fp, linkIdMap);
  if (node.type === 'NOT') return { type: 'NOT', child: buildFromParsedTree(node.child, fp, linkIdMap) };
  return { type: node.type, children: node.children.map(c => buildFromParsedTree(c, fp, linkIdMap)) };
}

function title(linkId, linkIdMap) {
  return '\u00AB' + ((linkIdMap && linkIdMap[linkId]) || linkId) + '\u00BB';
}

function ewValueText(ew) {
  if (ew.answerBoolean  !== undefined) return ew.answerBoolean ? 'Yes' : 'No';
  if (ew.answerString   !== undefined) return `"${ew.answerString}"`;
  if (ew.answerInteger  !== undefined) return String(ew.answerInteger);
  if (ew.answerDecimal  !== undefined) return String(ew.answerDecimal);
  if (ew.answerQuantity !== undefined) {
    const unit = ew.answerQuantity.unit || ew.answerQuantity.code;
    return (ew.answerQuantity.value ?? '?') + (unit ? ' ' + unit : '');
  }
  if (ew.answerCoding) return ew.answerCoding.display || ew.answerCoding.code || '?';
  return '?';
}

// Doc-specific verbose phrasing for standard enableWhen[] — spells out operator
// words (same COMPARE_WORDS as expr-builder/describe.js, so both condition
// mechanisms read consistently) instead of symbols, so a comparison never reads
// like an already-evaluated result (e.g. "= Yes" misread as a live outcome).
// Returns a LEAF (single condition) or an AND/OR of LEAFs (multiple), matching
// the same tree shape as describeExprTree — there's no separate FHIRPath text
// per condition, so each leaf's `code` stays null.
function enableWhenLeaf(ew, linkIdMap) {
  const q = title(ew.question, linkIdMap);
  const human = ew.operator === 'exists'
    ? (ew.answerBoolean === false ? `no value is selected for ${q}` : `a value is selected for ${q}`)
    : `the value selected for ${q} ${COMPARE_WORDS[ew.operator] || ew.operator} ${ewValueText(ew)}`;
  return { type: 'LEAF', human, code: null };
}

function enableWhenTree(enableWhen, enableBehavior, linkIdMap) {
  if (enableWhen.length === 1) return enableWhenLeaf(enableWhen[0], linkIdMap);
  return { type: enableBehavior === 'any' ? 'OR' : 'AND', children: enableWhen.map(ew => enableWhenLeaf(ew, linkIdMap)) };
}

// enableWhenExpression wins when present (mirrors eval.js's override/fallback rule).
// Standard enableWhen[] has no raw FHIRPath to show — `code` stays null in that case.
function visibilityOf(node, linkIdMap, fp) {
  if (node.enableWhenExpression) {
    return { tree: describeExprTree(node.enableWhenExpression, fp, linkIdMap), code: node.enableWhenExpression };
  }
  if (node.enableWhen?.length) {
    return { tree: enableWhenTree(node.enableWhen, node.enableBehavior, linkIdMap), code: null };
  }
  return null;
}

function exprOf(text, linkIdMap, fp) {
  return text ? { tree: describeExprTree(text, fp, linkIdMap), code: text } : null;
}

// Plain-text note for the Appearance callout — describes custom presentation
// (rendering-style/xhtml/markdown) rather than reproducing it; the doc is a
// structural reference, not a pixel-accurate re-render of the styled form.
function appearanceOf(node) {
  const style = parseRenderStyle(node._renderStyle);
  const parts = [];
  if (style['font-weight'] === 'bold') parts.push('bold');
  if (style['font-style'] === 'italic') parts.push('italic');
  if (style['color']) parts.push('color: ' + style['color']);
  if (style['font-size']) parts.push('font size: ' + style['font-size']);
  if (style['text-decoration']) parts.push('text-decoration: ' + style['text-decoration']);
  const notes = [];
  if (parts.length) notes.push(parts.join(', '));
  if (node._renderXhtml) notes.push('custom XHTML formatting');
  if (node._renderMarkdown) notes.push('custom Markdown formatting');
  return notes.length ? notes.join('; ') : null;
}

function walkNode(node, linkIdMap, translations, fp, depth, out) {
  out.push({
    depth,
    id: node.id,
    prefix: node._prefix || null,
    type: node.type,
    itemType: node.itemType || null,
    title: node.title || '(no text)',
    translations: translationsFor('item', node.id, translations),
    cardinality: cardinality(node),
    flags: flags(node),
    appearance: appearanceOf(node),
    visibility: visibilityOf(node, linkIdMap, fp),
    calculated: exprOf(node._calculatedExpr, linkIdMap, fp),
    initial: exprOf(node._initialExpr, linkIdMap, fp),
    constraints: (node.constraint || []).map(c => ({
      key: c.key, severity: c.severity, human: c.human, expression: c.expression,
    })),
    options: node.options ? parseOptions(node.options).map(o => ({
      ...o,
      translations: translationsFor('opt', node.id + '__' + o.code, translations),
    })) : [],
  });
  for (const c of node.children || []) walkNode(c, linkIdMap, translations, fp, depth + 1, out);
}

/**
 * Build the full documentation model for the current questionnaire.
 * @param {{tree:object[], questMeta:object, values:object, variables:object[], contained:object[], translations:object, fp:object}} deps
 *   fp — injected FHIRPath instance (window.fhirpath); optional, enables the
 *   human-readable expression interpretation when supplied.
 */
export function generateQuestionnaireDoc({ tree, questMeta, values, variables, contained, translations, fp }) {
  const linkIdMap = buildLinkIdMap(tree);
  const items = [];
  for (const n of tree) walkNode(n, linkIdMap, translations, fp, 0, items);

  return {
    generatedAt: new Date().toISOString(),
    meta: { ...questMeta },
    titleTranslations: translationsFor('title', null, translations),
    legend: DOC_LEGEND,
    variables: variables || [],
    contained: contained || [],
    items,
    validation: validateTree(tree, values, questMeta),
    audit: auditTree(tree, variables),
    copyrightHtml: COPYRIGHT_HTML,
  };
}

/**
 * Reconstruct parent/child nesting from the flat, depth-annotated `items[]`
 * list (each entry unchanged, wrapped as `{ item, children }`) — depth always
 * increases by exactly 1 into a child and drops back for a sibling/ancestor,
 * so a simple stack rebuilds the tree in one pass. Shared by both renderers
 * (doc-render-text.js, questionnaire-docs-page.js) so the connector-line tree
 * is drawn identically; `doc.items` itself stays flat (existing consumers/
 * tests rely on that shape).
 */
export function buildItemTree(items) {
  const root = { children: [] };
  const stack = [root];
  for (const item of items) {
    const wrapper = { item, children: [] };
    while (stack.length > item.depth + 1) stack.pop();
    stack[stack.length - 1].children.push(wrapper);
    stack.push(wrapper);
  }
  return root.children;
}
