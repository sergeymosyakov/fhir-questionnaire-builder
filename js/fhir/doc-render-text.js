// ── Plain-text renderer for the questionnaire documentation model ─────────────
// Pure function — turns the doc model from doc-generator.js into a downloadable
// .txt report. Mirrors the section order of the HTML/print view.
import { buildItemTree } from './doc-generator.js';

function rule(char, len = 70) { return char.repeat(len); }

// Push [label, formattedValue] only when value is present. entry.* fields are
// already normalized to null/undefined-when-absent by doc-generator.js; call
// sites for raw doc.meta.* fields normalize inline (empty array -> null) first.
function addRow(rows, label, value, format = String) {
  if (value == null) return;
  rows.push([label, format(value)]);
}
const joinList = v => v.join(', ');
const formatSystemCode = list => list.map(c => `${c.system ? c.system + '|' : ''}${c.code}`).join(', ');
const formatCodingDisplay = list => list.map(c => c.display || c.code).join(', ');

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
  if (o.initialSelected) extra.push('initially selected');
  return `${o.code} = ${o.display}${extra.length ? ` (${extra.join(', ')})` : ''}`;
}

// Remaining scalar SDC/core properties with no dedicated block of their own.
function renderAdditionalProps(entry, indent) {
  const rows = [];
  addRow(rows, 'Short text', entry.shortText);
  addRow(rows, 'Entry format', entry.entryFormat);
  addRow(rows, 'Regex pattern', entry.regex);
  addRow(rows, 'Column count', entry.columnCount, String);
  addRow(rows, 'Choice orientation', entry.choiceOrientation);
  addRow(rows, 'Choice columns', entry.choiceColumns, v => v.map(c => c.label || c.path || '(unlabeled)').join(', '));
  addRow(rows, 'Item control', entry.itemControl);
  addRow(rows, 'Display category', entry.displayCategory);
  addRow(rows, 'Collapsible', entry.collapsible);
  addRow(rows, 'Open label', entry.openLabel);
  addRow(rows, 'Disabled display', entry.disabledDisplay);
  addRow(rows, 'Usage mode', entry.usageMode);
  if (entry.isSubject) rows.push(['Subject item', 'Yes']);
  if (entry.observationExtract != null) rows.push(['Observation extract', entry.observationExtract ? 'Yes' : 'No']);
  addRow(rows, 'Max length', entry.maxLength, String);
  addRow(rows, 'Min value', entry.minValue, String);
  addRow(rows, 'Max value', entry.maxValue, String);
  addRow(rows, 'Slider step', entry.sliderStep, String);
  addRow(rows, 'Max decimal places', entry.maxDecimalPlaces, String);
  addRow(rows, 'Answer constraint', entry.answerConstraint);
  addRow(rows, 'Codes', entry.codes, formatSystemCode);
  addRow(rows, 'Definition', entry.definition);
  addRow(rows, 'Base type', entry.baseType);
  addRow(rows, 'FHIR type', entry.fhirType);
  addRow(rows, 'Reference resource type', entry.referenceResourceType);
  addRow(rows, 'Reference profiles', entry.referenceProfiles, joinList);
  addRow(rows, 'Reference filter', entry.referenceFilter);
  addRow(rows, 'Unit', entry.unit);
  addRow(rows, 'Unit options', entry.unitOptions, v => v.map(u => u.display || u.code).join(', '));
  addRow(rows, 'Unit ValueSet', entry.unitValueSet);
  addRow(rows, 'Max file size (MB)', entry.maxFileSizeMB, String);
  addRow(rows, 'Allowed file types', entry.mimeTypes, joinList);
  addRow(rows, 'Preferred terminology server', entry.preferredTermServer);
  addRow(rows, 'Signature required', entry.signatureRequired, formatCodingDisplay);
  addRow(rows, 'Support links', entry.supportLinks, joinList);
  addRow(rows, 'Other extensions', entry.unknownExtensionCount, v => `${v} preserved (round-trip only)`);
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
  const metaRows = [];
  addRow(metaRows, 'URL', m.url);
  addRow(metaRows, 'Version', m.version);
  addRow(metaRows, 'Status', m.status);
  addRow(metaRows, 'Date', m.date);
  addRow(metaRows, 'Publisher', m.publisher);
  addRow(metaRows, 'Description', m.description);
  addRow(metaRows, 'Purpose', m.purpose);
  addRow(metaRows, 'Preferred terminology server', m.preferredTermServer);
  addRow(metaRows, 'Target StructureMap', m.targetStructureMap);
  addRow(metaRows, 'Source StructureMap', m.sourceStructureMap);
  addRow(metaRows, 'Resource version', m._metaVersionId);
  addRow(metaRows, 'Resource source', m._metaSource);
  addRow(metaRows, 'Resource last updated', m._metaLastUpdated);
  addRow(metaRows, 'Derived from', m.derivedFrom?.length ? m.derivedFrom : null, joinList);
  addRow(metaRows, 'Replaces', m.replaces?.length ? m.replaces : null, joinList);
  addRow(metaRows, 'Profiles', m._rawMetaProfile?.length ? m._rawMetaProfile : null, joinList);
  addRow(metaRows, 'Identifiers', m._rawIdentifier?.length ? m._rawIdentifier : null, v => v.map(i => i.value || '(no value)').join(', '));
  addRow(metaRows, 'Codes', m._rawCode?.length ? m._rawCode : null, formatSystemCode);
  addRow(metaRows, 'Tags', m._rawMetaTag?.length ? m._rawMetaTag : null, formatCodingDisplay);
  addRow(metaRows, 'Security labels', m._rawMetaSecurity?.length ? m._rawMetaSecurity : null, formatCodingDisplay);
  const namedLaunchContexts = m.launchContexts?.filter(l => l.name) || [];
  addRow(metaRows, 'Launch context', namedLaunchContexts.length ? namedLaunchContexts : null, v => v.map(l => l.name).join(', '));
  addRow(metaRows, 'Signature required', m._signatureRequired?.length ? m._signatureRequired : null, formatCodingDisplay);
  addRow(metaRows, 'Other extensions', m._rawQuestExtensions?.length || null, v => `${v} preserved (round-trip only)`);
  for (const [k, v] of metaRows) lines.push(`  ${k}: ${v}`);
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
