// ── Plain-text renderer for the questionnaire documentation model ─────────────
// Pure function — turns the doc model from doc-generator.js into a downloadable
// .txt report. Mirrors the section order of the HTML/print view.
import { buildItemTree } from './doc-generator.js';

function rule(char, len = 70) { return char.repeat(len); }

function plainCopyright(html) {
  return html
    .replace(/<a[^>]*>([^<]*)<\/a>/g, '$1')
    .replace(/&copy;/g, '\u00A9')
    .replace(/&middot;/g, '\u00B7');
}

function renderTranslations(list, indent) {
  if (!list.length) return '';
  return list.map(t => `${indent}  \u{1F310} [${t.lang}] ${t.label}: ${t.text}`).join('\n') + '\n';
}

// AND/OR/NOT/LEAF condition tree — mirrors the Explain modal's shape
// (js/fhir/explain.js). AND/OR sit BETWEEN sibling children (not as a header
// above them) since that's how the operator naturally reads; NOT stays a
// prefix label since it has a single child.
function renderCondNode(node, pad) {
  if (!node) return `${pad}- [malformed condition, unable to parse]`;
  if (node.type === 'LEAF') {
    return node.human != null ? `${pad}- ${node.human}` : `${pad}- [not recognized] ${node.code}`;
  }
  if (node.type === 'NOT') return `${pad}NOT:\n` + renderCondNode(node.child, pad + '  ');
  const childPad = pad + '  ';
  return node.children.map(c => renderCondNode(c, childPad)).join(`\n${childPad}${node.type}\n`);
}

// { tree, code } — tree is the AND/OR/NOT/LEAF breakdown above; code is the
// full raw FHIRPath for reference (absent for a plain enableWhen[]).
function renderExpr(label, field, indent) {
  if (!field) return '';
  let out = `${indent}    ${label}:\n` + renderCondNode(field.tree, indent + '      ') + '\n';
  if (field.code) out += `${indent}      FHIRPath: ${field.code}\n`;
  return out;
}

function renderMedia(label, media, indent) {
  if (!media) return '';
  return `${indent}    ${label}: ${media.contentType || 'media'}${media.title ? ' - ' + media.title : ''}${media.url ? ' (' + media.url + ')' : ''}\n`;
}

// Raw multi-line text (xhtml/markdown source) indented to match the
// surrounding block, verbatim — never re-flowed or escaped.
function indentBlock(text, indent) {
  return text.split('\n').map(l => `${indent}${l}`).join('\n') + '\n';
}

// { summary, xhtml, markdown } — summary is the plain-English note; xhtml/markdown,
// when present, are printed verbatim right after it.
function renderAppearance(appearance, indent) {
  let out = `${indent}    \u{1F3A8} Appearance: ${appearance.summary}\n`;
  if (appearance.xhtml) out += indentBlock(appearance.xhtml, indent + '      ');
  if (appearance.markdown) out += indentBlock(appearance.markdown, indent + '      ');
  return out;
}

// answerValueSet/answerExpression/candidateExpression are alternatives to a
// static answerOption[] list — an item uses at most one to source its choices.
function renderAnswerSource(answerSource, indent) {
  if (!answerSource) return '';
  let out = '';
  const vs = answerSource.valueSet;
  if (vs) {
    out += vs.local
      ? `${indent}    Answer options from ValueSet: ${vs.name || vs.ref} (see Contained Resources: ${vs.id})\n`
      : `${indent}    Answer options from ValueSet: ${vs.ref}\n`;
  }
  out += renderExpr('Answer options (computed dynamically via answerExpression)', answerSource.expression, indent);
  out += renderExpr('Candidate options (computed dynamically via candidateExpression)', answerSource.candidate, indent);
  return out;
}

// A per-option code/display label, with ordinal/prefix/exclusive/weight
// appended as a parenthetical when any are present.
function optionLabel(o) {
  const extra = [];
  if (o.prefix) extra.push(o.prefix);
  if (o.ordinal != null) extra.push(`ordinal ${o.ordinal}`);
  if (o.weight != null) extra.push(`weight ${o.weight}`);
  if (o.exclusive) extra.push('exclusive');
  return `${o.code} = ${o.display}${extra.length ? ` (${extra.join(', ')})` : ''}`;
}

// Remaining scalar SDC/core properties with no dedicated block of their own.
function renderAdditionalProps(entry, indent) {
  const rows = [];
  if (entry.shortText) rows.push(['Short text', entry.shortText]);
  if (entry.entryFormat) rows.push(['Entry format', entry.entryFormat]);
  if (entry.columnCount) rows.push(['Column count', String(entry.columnCount)]);
  if (entry.choiceColumns?.length) rows.push(['Choice columns', entry.choiceColumns.map(c => c.label || c.path || '(unlabeled)').join(', ')]);
  if (entry.itemControl) rows.push(['Item control', entry.itemControl]);
  if (entry.collapsible) rows.push(['Collapsible', entry.collapsible]);
  if (entry.openLabel) rows.push(['Open label', entry.openLabel]);
  if (entry.disabledDisplay) rows.push(['Disabled display', entry.disabledDisplay]);
  if (entry.isSubject) rows.push(['Subject item', 'Yes']);
  if (entry.observationExtract != null) rows.push(['Observation extract', entry.observationExtract ? 'Yes' : 'No']);
  if (entry.maxLength != null) rows.push(['Max length', String(entry.maxLength)]);
  if (entry.maxDecimalPlaces != null) rows.push(['Max decimal places', String(entry.maxDecimalPlaces)]);
  if (entry.answerConstraint) rows.push(['Answer constraint', entry.answerConstraint]);
  if (entry.codes?.length) rows.push(['Codes', entry.codes.map(c => `${c.system ? c.system + '|' : ''}${c.code}`).join(', ')]);
  return rows.map(([k, v]) => `${indent}    ${k}: ${v}\n`).join('');
}

function renderItem(entry, headPrefix, detailIndent) {
  const kind = entry.type === 'group' ? 'Group' : entry.itemType;
  const prefixTag = entry.prefix ? ` [${entry.prefix}]` : '';
  let out = `${headPrefix}[${entry.id}]${prefixTag} (${kind}, ${entry.cardinality}${entry.flags ? ', ' + entry.flags : ''}) ${entry.title}\n`;
  out += renderTranslations(entry.translations, detailIndent);
  if (entry.appearance) out += renderAppearance(entry.appearance, detailIndent);
  if (entry.designNote) out += `${detailIndent}    \u{1F4DD} Design note: ${entry.designNote}\n`;
  out += renderMedia('\u{1F5BC} Item media', entry.itemMedia, detailIndent);
  out += renderExpr('This item is shown only when this condition is true', entry.visibility, detailIndent);
  out += renderExpr('Calculated', entry.calculated, detailIndent);
  out += renderExpr('Initial value', entry.initial, detailIndent);
  if (entry.initialValue) out += `${detailIndent}    Initial value (fixed): ${entry.initialValue.join(', ')}\n`;
  out += renderAnswerSource(entry.answerSource, detailIndent);
  for (const c of entry.constraints) {
    out += `${detailIndent}    Constraint [${c.severity}] ${c.human || c.key}: ${c.expression}\n`;
  }
  for (const o of entry.options) {
    const mediaTag = o.answerMedia ? ` [${o.answerMedia.title || o.answerMedia.contentType || 'media'}]` : '';
    out += `${detailIndent}    Option: ${optionLabel(o)}${mediaTag}\n`;
    out += renderTranslations(o.translations, detailIndent + '  ');
  }
  out += renderAdditionalProps(entry, detailIndent);
  return out;
}

// Unix `tree`-command connectors: "├── " for a middle sibling, "└── " for the
// last, "│   " to continue an ancestor's trunk down past it, "    " once that
// ancestor was itself the last child (nothing left to connect to below it).
function renderNode(wrapper, prefix, isLast) {
  const connector = isLast ? '\u2514\u2500 ' : '\u251C\u2500 ';
  const childPrefix = prefix + (isLast ? '    ' : '\u2502   ');
  let out = renderItem(wrapper.item, prefix + connector, childPrefix + '    ');
  wrapper.children.forEach((c, i) => {
    out += renderNode(c, childPrefix, i === wrapper.children.length - 1);
  });
  return out;
}

function renderStructure(items) {
  const tree = buildItemTree(items);
  return tree.map((n, i) => renderNode(n, '', i === tree.length - 1)).join('');
}

function renderIssues(list, emptyText) {
  if (!list.length) return `  ${emptyText}\n`;
  return list.map(i => `  [${i.severity}] ${i.nodeId}: ${i.message}`).join('\n') + '\n';
}

function renderJsonBlock(value) {
  return JSON.stringify(value, null, 2).split('\n').map(l => `  ${l}`).join('\n') + '\n';
}

function renderVariables(variables) {
  if (!variables?.length) return '  No variables defined.\n';
  return renderJsonBlock(variables);
}

function renderContained(contained) {
  if (!contained?.length) return '  No contained resources.\n';
  return contained.map(r => `  ${r.resourceType}/${r.id || '(no id)'}:\n` + renderJsonBlock(r)).join('\n');
}

export function renderDocAsText(doc) {
  const lines = [];
  const title = doc.meta.title || doc.meta.name || '(untitled questionnaire)';

  lines.push(title.toUpperCase(), rule('='));
  for (const t of doc.titleTranslations) lines.push(`[${t.lang}] ${t.label}: ${t.text}`);
  lines.push('');

  lines.push(
    'TABLE OF CONTENTS', rule('-'),
    '1. Legend', '2. Metadata', '3. Variables', '4. Contained Resources', '5. Structure', '6. Validation & Audit', '',
  );

  lines.push('1. LEGEND', rule('-'));
  for (const l of doc.legend) lines.push(`  ${l.icon}  ${l.label} \u2014 ${l.desc}`);
  lines.push('  x..y  Cardinality (FHIR convention) \u2014 minimum..maximum occurrences', '');

  lines.push('2. METADATA', rule('-'));
  const m = doc.meta;
  for (const [k, v] of [
    ['URL', m.url], ['Version', m.version], ['Status', m.status], ['Date', m.date],
    ['Publisher', m.publisher], ['Description', m.description], ['Purpose', m.purpose],
  ]) if (v) lines.push(`  ${k}: ${v}`);
  lines.push('');

  lines.push('3. VARIABLES', rule('-'));
  lines.push(renderVariables(doc.variables));

  lines.push('4. CONTAINED RESOURCES', rule('-'));
  lines.push(renderContained(doc.contained));

  lines.push('5. STRUCTURE', rule('-'));
  lines.push(renderStructure(doc.items));

  lines.push('6. VALIDATION & AUDIT', rule('-'));
  lines.push('Local validation:');
  lines.push(renderIssues(doc.validation, 'No issues found.'));
  lines.push('Quality audit:');
  lines.push(renderIssues(doc.audit, 'No issues found.'));

  lines.push(rule('='));
  lines.push(`Generated on ${doc.generatedAt} by FHIR Questionnaire Builder`);
  lines.push(plainCopyright(doc.copyrightHtml));

  return lines.join('\n');
}
