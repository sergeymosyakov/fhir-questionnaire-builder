// ── Questionnaire Documentation page ───────────────────────────────────────────
// Standalone tab opened from Save ▾ → Generate Docs…; renders the doc model
// save-menu.js wrote to sessionStorage, offers Print/Save-as-PDF and a plain
// text download. No app state/DOM imports — this page is fully self-contained.
import { renderDocAsText } from './fhir/doc-render-text.js';
import { downloadText } from './fhir/download.js';
import { buildItemTree } from './fhir/doc-generator.js';

const STORAGE_KEY = 'fhirqb.generatedDocs';

function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.testid) node.dataset.testid = opts.testid;
  if (opts.href) node.href = opts.href;
  for (const c of children) node.appendChild(c);
  return node;
}

function translationList(list, extraClass = '') {
  if (!list?.length) return null;
  return el('ul', { className: 'qdoc-translation-list ' + extraClass }, list.map(t =>
    el('li', { text: `\uD83C\uDF10 [${t.lang}] ${t.label}: ${t.text}` }),
  ));
}

// AND/OR/NOT/LEAF condition tree — same shape the Explain modal renders
// (js/ui/modals/explain-modal.js), minus the live ✓/✗ icon (no patient
// context here). Each nested AND/OR/NOT is a real container (.qdoc-cond-group)
// with a colored left border spanning exactly its own children — nesting shows
// as stacked stripes automatically. The outermost group gets no stripe (
// .qdoc-cond-root): it always wraps the whole tree, so a border there would
// just outline the entire block with nothing else to distinguish it from.
// AND/OR sit BETWEEN sibling children (not as a header above them); NOT stays
// a prefix label since it has a single child.
function renderCondNode(node, nested = true) {
  // Defensive: a malformed/missing tree node must not take down the whole
  // report — surface it as an unrecognized leaf instead of throwing.
  if (!node) {
    return el('div', { className: 'qdoc-cond-row' }, [
      el('span', { className: 'qdoc-cond-unknown', text: 'Malformed condition (unable to parse)' }),
    ]);
  }
  if (node.type === 'LEAF') {
    const row = el('div', { className: 'qdoc-cond-row' });
    if (node.human != null) {
      row.appendChild(el('span', { className: 'qdoc-cond-leaf', text: node.human }));
    } else {
      row.append(
        el('span', { className: 'qdoc-cond-unknown', text: 'Not recognized: ' }),
        el('code', { className: 'qdoc-code', text: node.code, testid: 'qdoc-code' }),
      );
    }
    return row;
  }

  const groupClass = nested ? 'qdoc-cond-group qdoc-cond-group--' + node.type.toLowerCase() : 'qdoc-cond-root';

  if (node.type === 'NOT') {
    const row = el('div', { className: 'qdoc-cond-row' }, [
      el('span', { className: 'qdoc-cond-op qdoc-cond-op--not', text: 'NOT' }),
    ]);
    return el('div', { className: groupClass }, [row, renderCondNode(node.child)]);
  }

  const group = el('div', { className: groupClass });
  node.children.forEach((c, i) => {
    if (i > 0) {
      group.appendChild(el('div', { className: 'qdoc-cond-row' }, [
        el('span', { className: 'qdoc-cond-op qdoc-cond-op--' + node.type.toLowerCase(), text: node.type }),
      ]));
    }
    group.appendChild(renderCondNode(c));
  });
  return group;
}

// { tree, code } — tree is the AND/OR/NOT/LEAF breakdown above; code is the
// full raw FHIRPath shown once at the bottom for reference (absent for a
// plain enableWhen[]), mirroring the Explain modal's own footer strip.
function renderExprBlock(label, field) {
  if (!field) return null;
  const wrap = el('div', { className: 'qdoc-detail' }, [
    el('div', { className: 'qdoc-detail-label', text: label + ':' }),
    el('div', { className: 'qdoc-cond-tree' }, [renderCondNode(field.tree, false)]),
  ]);
  if (field.code) {
    wrap.appendChild(el('div', { className: 'qdoc-cond-fhirpath' }, [
      document.createTextNode('FHIRPath: '),
      el('code', { className: 'qdoc-code', text: field.code, testid: 'qdoc-code' }),
    ]));
  }
  return wrap;
}

// { summary, xhtml, markdown } — summary is the plain-English note; xhtml/markdown
// (when present) are shown verbatim in a <pre> via textContent, never innerHTML,
// so the raw source is visible as-is instead of being interpreted/rendered.
function renderAppearance(appearance) {
  const box = el('div', { className: 'qdoc-appearance', testid: 'qdoc-appearance' }, [
    el('span', { className: 'qdoc-appearance-label', text: '\uD83C\uDFA8 Appearance: ' }),
    document.createTextNode(appearance.summary),
  ]);
  if (appearance.xhtml) box.appendChild(rawBlock(appearance.xhtml));
  if (appearance.markdown) box.appendChild(rawBlock(appearance.markdown));
  return box;
}

// { url, title, contentType } Attachment — same shape for itemMedia and a
// per-option answerMedia entry.
function renderMedia(label, media) {
  if (!media) return null;
  const p = el('p', { className: 'qdoc-detail' });
  p.appendChild(document.createTextNode(`${label}: ${media.contentType || 'media'}${media.title ? ' \u2014 ' + media.title : ''} `));
  if (media.url) p.appendChild(el('a', { href: media.url, text: media.url }));
  return p;
}

// answerValueSet/answerExpression/candidateExpression are alternatives to a
// static answerOption[] list — grouped together since an item uses at most
// one of these to source its answer choices.
function renderAnswerSource(answerSource) {
  if (!answerSource) return [];
  const parts = [];
  const vs = answerSource.valueSet;
  if (vs) {
    const p = el('p', { className: 'qdoc-detail' });
    p.appendChild(document.createTextNode('Answer options from ValueSet: '));
    if (vs.local) {
      p.appendChild(el('a', { href: '#qdoc-contained-' + vs.id, text: vs.name || vs.ref }));
      if (!vs.found) p.appendChild(document.createTextNode(' (not found in Contained Resources)'));
    } else {
      p.appendChild(el('code', { className: 'qdoc-code', text: vs.ref, testid: 'qdoc-code' }));
    }
    parts.push(p);
  }
  const exprBlock = renderExprBlock('Answer options (computed dynamically via answerExpression)', answerSource.expression);
  if (exprBlock) parts.push(exprBlock);
  const candBlock = renderExprBlock('Candidate options (computed dynamically via candidateExpression)', answerSource.candidate);
  if (candBlock) parts.push(candBlock);
  return parts;
}

function renderChoiceColumns(cols) {
  if (!cols?.length) return null;
  return el('div', { className: 'qdoc-detail' }, [
    el('div', { className: 'qdoc-detail-label', text: 'Choice columns:' }),
    el('ul', { className: 'qdoc-props-list' }, cols.map(c =>
      el('li', { text: `${c.label || c.path || '(unlabeled)'}${c.forDisplay ? ' (display only)' : ''}` }))),
  ]);
}

function renderCodes(codes) {
  if (!codes?.length) return null;
  return el('div', { className: 'qdoc-detail' }, [
    el('div', { className: 'qdoc-detail-label', text: 'Codes:' }),
    el('ul', { className: 'qdoc-props-list' }, codes.map(c =>
      el('li', { text: `${c.system ? c.system + '|' : ''}${c.code}${c.display ? ' \u2014 ' + c.display : ''}` }))),
  ]);
}

// Remaining scalar SDC/core properties with no dedicated block of their own —
// a compact label:value list, only rendered when at least one is present.
function renderAdditionalProps(entry) {
  const rows = [];
  if (entry.shortText) rows.push(['Short text', entry.shortText]);
  if (entry.entryFormat) rows.push(['Entry format', entry.entryFormat]);
  if (entry.columnCount) rows.push(['Column count', String(entry.columnCount)]);
  if (entry.itemControl) rows.push(['Item control', entry.itemControl]);
  if (entry.collapsible) rows.push(['Collapsible', entry.collapsible]);
  if (entry.openLabel) rows.push(['Open label', entry.openLabel]);
  if (entry.disabledDisplay) rows.push(['Disabled display', entry.disabledDisplay]);
  if (entry.isSubject) rows.push(['Subject item', 'Yes \u2014 identifies the QuestionnaireResponse subject']);
  if (entry.observationExtract != null) rows.push(['Observation extract', entry.observationExtract ? 'Yes' : 'No']);
  if (entry.maxLength != null) rows.push(['Max length', String(entry.maxLength)]);
  if (entry.maxDecimalPlaces != null) rows.push(['Max decimal places', String(entry.maxDecimalPlaces)]);
  if (entry.answerConstraint) rows.push(['Answer constraint', entry.answerConstraint]);
  if (!rows.length) return null;
  return el('ul', { className: 'qdoc-props-list' }, rows.map(([k, v]) =>
    el('li', {}, [el('strong', { text: `${k}: ` }), document.createTextNode(v)])));
}

// A per-option code/display/media label, with ordinal/prefix/exclusive/weight
// appended as a parenthetical when any are present.
function optionLabel(o) {
  const extra = [];
  if (o.prefix) extra.push(o.prefix);
  if (o.ordinal != null) extra.push(`ordinal ${o.ordinal}`);
  if (o.weight != null) extra.push(`weight ${o.weight}`);
  if (o.exclusive) extra.push('exclusive');
  return `${o.code} = ${o.display}${extra.length ? ` (${extra.join(', ')})` : ''}`;
}

function renderItem(entry) {
  const kind = entry.type === 'group' ? 'Group' : entry.itemType;
  const head = el('div', { className: 'qdoc-item-head' }, [
    el('span', { className: 'qdoc-node-badge qdoc-node-badge--' + entry.type, text: entry.type === 'group' ? 'G' : 'Q' }),
    el('span', { className: 'qdoc-linkid', text: entry.id }),
    ...(entry.prefix ? [el('span', { className: 'qdoc-prefix', text: entry.prefix })] : []),
    el('span', { className: 'qdoc-type', text: kind }),
    el('span', { className: 'qdoc-card', text: entry.cardinality }),
    document.createTextNode(`${entry.flags ? ', ' + entry.flags : ''} `),
    el('strong', { text: entry.title }),
  ]);

  const children = [head];
  const tt = translationList(entry.translations);
  if (tt) children.push(tt);
  if (entry.appearance) children.push(renderAppearance(entry.appearance));
  if (entry.designNote) {
    children.push(el('div', { className: 'qdoc-appearance', testid: 'qdoc-design-note' }, [
      el('span', { className: 'qdoc-appearance-label', text: '\uD83D\uDCDD Design note: ' }),
      document.createTextNode(entry.designNote),
    ]));
  }
  const media = renderMedia('\uD83D\uDDBC Item media', entry.itemMedia);
  if (media) children.push(media);
  const vis = renderExprBlock('This item is shown only when this condition is true', entry.visibility);
  if (vis) children.push(vis);
  const calc = renderExprBlock('Calculated', entry.calculated);
  if (calc) children.push(calc);
  const init = renderExprBlock('Initial value', entry.initial);
  if (init) children.push(init);
  if (entry.initialValue) {
    children.push(el('p', { className: 'qdoc-detail' }, [
      document.createTextNode(`Initial value (fixed): ${entry.initialValue.join(', ')}`),
    ]));
  }
  children.push(...renderAnswerSource(entry.answerSource));
  for (const c of entry.constraints) {
    const p = el('p', { className: 'qdoc-detail' });
    p.appendChild(document.createTextNode(`Constraint [${c.severity}] ${c.human || c.key}: `));
    p.appendChild(el('code', { className: 'qdoc-code', text: c.expression, testid: 'qdoc-code' }));
    children.push(p);
  }
  if (entry.options.length) {
    children.push(el('ul', { className: 'qdoc-options' }, entry.options.map(o => {
      const li = el('li', { text: optionLabel(o) });
      const ott = translationList(o.translations);
      if (ott) li.appendChild(ott);
      if (o.answerMedia) li.appendChild(document.createTextNode(` \uD83D\uDDBC ${o.answerMedia.title || o.answerMedia.contentType || 'media'}`));
      return li;
    })));
  }
  const cc = renderChoiceColumns(entry.choiceColumns);
  if (cc) children.push(cc);
  const codes = renderCodes(entry.codes);
  if (codes) children.push(codes);
  const props = renderAdditionalProps(entry);
  if (props) children.push(props);

  return el('div', { className: 'qdoc-item', testid: 'qdoc-item-' + entry.id }, children);
}

// Real nested <ul>/<li> tree (via buildItemTree's depth reconstruction) so
// CSS alone draws the connector lines — a parent <ul> border-left is exactly
// as tall as its own <li> children, giving each group its own trunk line with
// no manual depth/last-child math (mirrors the .qdoc-cond-group technique).
function renderTreeNode(wrapper) {
  const li = el('li', { className: 'qdoc-tree-node' }, [renderItem(wrapper.item)]);
  if (wrapper.children.length) {
    li.appendChild(el('ul', { className: 'qdoc-tree' }, wrapper.children.map(renderTreeNode)));
  }
  return li;
}

function renderStructureTree(items) {
  return el('ul', { className: 'qdoc-tree qdoc-tree--root' }, buildItemTree(items).map(renderTreeNode));
}

function renderIssues(list, emptyText) {
  if (!list.length) return el('p', { text: emptyText });
  return el('ul', { className: 'qdoc-issues' }, list.map(i =>
    el('li', { className: 'qdoc-issue--' + i.severity, text: `[${i.severity}] ${i.nodeId}: ${i.message}` }),
  ));
}

function jsonBlock(value) {
  return el('pre', { className: 'qdoc-code-block', testid: 'qdoc-code' }, [document.createTextNode(JSON.stringify(value, null, 2))]);
}

function rawBlock(text) {
  return el('pre', { className: 'qdoc-code-block', testid: 'qdoc-code' }, [document.createTextNode(text)]);
}

function renderVariables(variables) {
  return variables?.length ? jsonBlock(variables) : el('p', { text: 'No variables defined.' });
}

function renderContained(contained) {
  if (!contained?.length) return el('p', { text: 'No contained resources.' });
  const wrap = el('div', {});
  for (const r of contained) {
    const heading = el('h3', { text: `${r.resourceType}/${r.id || '(no id)'}` });
    if (r.id) heading.id = 'qdoc-contained-' + r.id;
    wrap.appendChild(heading);
    wrap.appendChild(jsonBlock(r));
  }
  return wrap;
}

function render(doc) {
  const root = document.getElementById('qdocRoot');
  root.innerHTML = '';
  root.dataset.testid = 'qdoc-root';

  const title = doc.meta.title || doc.meta.name || '(untitled questionnaire)';
  root.appendChild(el('h1', { text: title, testid: 'qdoc-title' }));
  const titleTt = translationList(doc.titleTranslations);
  if (titleTt) root.appendChild(titleTt);

  root.appendChild(el('nav', { className: 'qdoc-toc' }, [
    el('h2', { text: 'Table of Contents' }),
    el('a', { href: '#qdoc-legend', text: '1. Legend' }),
    el('a', { href: '#qdoc-metadata', text: '2. Metadata' }),
    el('a', { href: '#qdoc-variables', text: '3. Variables' }),
    el('a', { href: '#qdoc-contained', text: '4. Contained Resources' }),
    el('a', { href: '#qdoc-structure', text: '5. Structure' }),
    el('a', { href: '#qdoc-validation', text: '6. Validation & Audit' }),
  ]));

  root.appendChild(el('h2', { text: '1. Legend', testid: 'qdoc-legend' }));
  root.appendChild(el('ul', { className: 'qdoc-legend-list' }, [
    ...doc.legend.map(l => l.badges
      // A legend entry can carry real .qdoc-node-badge samples (badges/colors
      // aren't representable as a plain icon character) instead of the icon text.
      ? el('li', {}, [
        ...l.badges.map(b => el('span', { className: 'qdoc-node-badge qdoc-node-badge--' + b.cls, text: b.text })),
        document.createTextNode(`  ${l.label} \u2014 ${l.desc}`),
      ])
      : el('li', { text: `${l.icon}  ${l.label} \u2014 ${l.desc}` })),
    el('li', { text: 'x..y  Cardinality (FHIR convention) \u2014 minimum..maximum occurrences' }),
  ]));

  root.appendChild(el('h2', { text: '2. Metadata', testid: 'qdoc-metadata' }));
  const m = doc.meta;
  root.appendChild(el('ul', { className: 'qdoc-meta-list' },
    [['URL', m.url], ['Version', m.version], ['Status', m.status], ['Date', m.date],
      ['Publisher', m.publisher], ['Description', m.description], ['Purpose', m.purpose]]
      .filter(([, v]) => v)
      .map(([k, v]) => el('li', {}, [el('strong', { text: `${k}: ` }), document.createTextNode(v)])),
  ));

  root.appendChild(el('h2', { text: '3. Variables', testid: 'qdoc-variables' }));
  root.appendChild(renderVariables(doc.variables));

  root.appendChild(el('h2', { text: '4. Contained Resources', testid: 'qdoc-contained' }));
  root.appendChild(renderContained(doc.contained));

  root.appendChild(el('h2', { text: '5. Structure', testid: 'qdoc-structure' }));
  root.appendChild(renderStructureTree(doc.items));

  root.appendChild(el('h2', { text: '6. Validation & Audit', testid: 'qdoc-validation' }));
  root.appendChild(el('h3', { text: 'Local validation' }));
  root.appendChild(renderIssues(doc.validation, 'No issues found.'));
  root.appendChild(el('h3', { text: 'Quality audit' }));
  root.appendChild(renderIssues(doc.audit, 'No issues found.'));

  const footer = el('div', { className: 'qdoc-footer' }, [
    el('p', { text: `Generated on ${doc.generatedAt} by FHIR Questionnaire Builder` }),
  ]);
  // Copyright is a fixed, trusted constant from copyright-notice.js — the one
  // deliberate innerHTML use on this page (everything else is textContent).
  const copyrightP = document.createElement('p');
  copyrightP.innerHTML = doc.copyrightHtml;
  footer.appendChild(copyrightP);
  root.appendChild(footer);
}

function loadDoc() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

const doc = loadDoc();
if (doc) {
  render(doc);
  document.querySelector('[data-testid="qdoc-print-btn"]').addEventListener('click', () => window.print());
  document.querySelector('[data-testid="qdoc-download-btn"]').addEventListener('click', () => {
    const title = (doc.meta.title || doc.meta.name || 'questionnaire').trim();
    downloadText(renderDocAsText(doc), title.replace(/[^\w-]+/g, '-') + '-documentation.txt');
  });
} else {
  document.querySelectorAll('.qdoc-no-print button').forEach(b => b.disabled = true);
}
