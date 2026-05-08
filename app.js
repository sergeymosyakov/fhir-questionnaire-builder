'use strict';

const { ref, reactive, effect } = VueReactivity;

// ── Reactive state ────────────────────────────────────────────────────────────
// FHIR Patient R4 fields relevant for Questionnaire logic
const age      = ref(30);
const gender   = ref('male');       // male | female | other | unknown
const bmi      = ref(42);
const pregnant = ref(false);        // boolean (Extension: patient-mothersMaidenName or pregnancyStatus)
const smoker   = ref(false);        // boolean (Observation: tobacco-use)
const proc     = ref('43644');      // procedure code (Claim.procedure)
const comorb   = ref('');           // comma-separated condition codes / display names
const testMode = ref(false);
const tree     = reactive([]);

// Plain (non-reactive) store for current form values in preview.
// Not reactive on purpose — avoids re-triggering effect() on every keystroke.
const values = {};

// Tracks which node IDs were pre-filled by conditionRule (vs manually edited).
// Auto values update when patient data changes; manually edited values are preserved.
const autoFilledIds = new Set();

// Reactive tick: incremented when a checkbox/select changes in the preview.
// Causes effect() to re-run → re-evaluates enableWhen visibility conditions.
const _formTick = ref(0);

// ── Wire patient-data inputs → refs ──────────────────────────────────────────
[
  ['inp-age',      age,      v => parseFloat(v) || 0],
  ['inp-bmi',      bmi,      v => parseFloat(v) || 0],
  ['inp-proc',     proc,     v => v],
  ['inp-comorb',   comorb,   v => v],
  ['inp-gender',   gender,   v => v],
].forEach(([id, r, parse]) => {
  document.getElementById(id).addEventListener('input', e => {
    r.value = parse(e.target.value);
    testMode.value = false;
  });
});
// Checkbox inputs wired separately
document.getElementById('inp-pregnant').addEventListener('change', e => { pregnant.value = e.target.checked; testMode.value = false; });
document.getElementById('inp-smoker').addEventListener('change',   e => { smoker.value   = e.target.checked; testMode.value = false; });

// ── ID factory ────────────────────────────────────────────────────────────────
let _seq = 1;
const nextId = () => 'n' + (_seq++);

// ── Data factories ────────────────────────────────────────────────────────────
const makeGroup = title => ({
  id: nextId(), type: 'group',
  title: title || 'New Group',
  visibilityRule: '', conditionRule: '', mandatory: false,
  logicWithParent: 'AND', children: []
});

// Items are mandatory by default.
// If template is provided, copies all settings from it (except id and title).
const makeItem = (title, template) => {
  if (template) {
    return {
      id: nextId(), type: 'item',
      title: title || 'New Item',
      visibilityRule: template.visibilityRule,
      mandatory:      template.mandatory,
      conditionRule:  template.conditionRule,
      itemType:       template.itemType,
      options:        template.options,
      successValue:   template.successValue
    };
  }
  return {
    id: nextId(), type: 'item',
    title: title || 'New Item',
    visibilityRule: '', mandatory: true,
    conditionRule: '', itemType: 'text',
    options: '', successValue: ''
  };
};

// ── Rule evaluation ───────────────────────────────────────────────────────────
// Exposed variables (FHIR Patient R4 context):
//   age       — integer (from Patient.birthDate)
//   gender    — string: 'male'|'female'|'other'|'unknown' (Patient.gender)
//   bmi       — decimal (Observation: body-mass-index)
//   pregnant  — boolean (Extension / Observation)
//   smoker    — boolean (Observation: tobacco-use)
//   proc      — string, procedure code (Claim.procedure.procedureCodeableConcept)
//   comorb    — string, comma-separated condition names/codes (lowercased)
const evalRule = (rule, ctx) => {
  if (!rule || !rule.trim()) return true;
  try {
    // 'values' exposed so enableWhen-style rules (values['linkId'] == x) work too
    return !!new Function(
      'age', 'gender', 'bmi', 'pregnant', 'smoker', 'proc', 'comorb', 'values',
      'return (' + rule + ');'
    )(ctx.age, ctx.gender, ctx.bmi, ctx.pregnant, ctx.smoker, ctx.proc, ctx.comorb, values);
  } catch (_) { return false; }
};

// ── Form-value success check ──────────────────────────────────────────────────
// Called both in preview rendering and from controls on change.
const calcFormOk = node => {
  if (!node.mandatory || node.successValue === '') return true;
  const val = values[node.id];
  if (node.itemType === 'checkbox') return String(!!val) === node.successValue;
  return String(val !== undefined ? val : '') === String(node.successValue);
};

// ── Tree evaluation ───────────────────────────────────────────────────────────
// Marks every node in a subtree as visible-but-disabled.
// Used when a group's conditionRule evaluates to false.
function markAllDisabled(nodes, results) {
  for (const ch of nodes) {
    results.push({ node: ch, visible: true, ok: true, disabled: true });
    if (ch.type === 'group') markAllDisabled(ch.children, results);
  }
}

// evaluateNode handles external conditions (visibilityRule, conditionRule).
// Form-value checks (calcFormOk) are applied separately in the preview renderer
// so that typing in a control does NOT trigger a full DOM rebuild via effect().
function evaluateNode(node, ctx, results) {
  const visible = evalRule(node.visibilityRule, ctx);
  if (!visible) {
    // If this node came from FHIR enableWhen, show it dimmed in preview with condition text
    const showDimmed = !!node._enableWhenText;
    results.push({ node, visible: false, ok: !node.mandatory, showDimmed });
    if (showDimmed && node.type === 'group') {
      markAllDisabled(node.children, results); // reuse disabled-marker for children
    }
    return { ok: !node.mandatory, visible: false, showDimmed };
  }

  if (node.type === 'item') {
    const ok = !node.mandatory || evalRule(node.conditionRule, ctx);
    results.push({ node, visible: true, ok });
    return { ok, visible: true };
  }

  // Group: push placeholder FIRST → group heading appears above children in preview
  const entry = { node, visible: true, ok: true };
  results.push(entry);

  // Group's own conditionRule — if false: whole subtree is N/A (disabled, not FAIL)
  if (!evalRule(node.conditionRule, ctx)) {
    entry.disabled = true;
    markAllDisabled(node.children, results);
    return { ok: true, visible: true, disabled: true };
  }

  const visKids = [];
  for (const ch of node.children) {
    const r = evaluateNode(ch, ctx, results);
    if (r.visible) visKids.push(r);
  }

  let groupOk;
  if (visKids.length === 0) {
    groupOk = !node.mandatory;
  } else {
    groupOk = visKids[0].ok;
    for (let i = 1; i < visKids.length; i++) {
      groupOk = node.logicWithParent === 'AND'
        ? groupOk && visKids[i].ok
        : groupOk || visKids[i].ok;
    }
  }
  entry.ok = groupOk;
  return { ok: groupOk, visible: true };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const escAttr = s => (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function findAndRemove(id, nodes) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) { nodes.splice(i, 1); return; }
    if (nodes[i].type === 'group') findAndRemove(id, nodes[i].children);
  }
}

// ── Success-value UI (rebuilt when itemType changes, stays inside open panel) ─
function buildSuccessValueUI(node, container) {
  container.innerHTML = '';
  const header = document.createElement('div');
  header.style.marginTop = '6px';

  if (node.itemType === 'checkbox') {
    header.textContent = 'Success when: ';
    const sel = document.createElement('select');
    sel.style.width = 'auto';
    [['true', 'checked'], ['false', 'unchecked']].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = label;
      if ((node.successValue || 'true') === val) opt.selected = true;
      sel.appendChild(opt);
    });
    if (!node.successValue) node.successValue = 'true';
    sel.onchange = () => { node.successValue = sel.value; };
    header.appendChild(sel);
  } else {
    header.textContent = 'Success value (exact match):';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = node.itemType === 'number' ? 'e.g. 42' : 'e.g. yes';
    inp.value = node.successValue || '';
    inp.style.marginTop = '2px';
    inp.oninput = () => { node.successValue = inp.value; };
    header.appendChild(inp);
  }

  container.appendChild(header);
}

// Returns true if nodeId is anywhere inside group's subtree (recursive).
function isDescendant(nodeId, group) {
  for (const ch of group.children) {
    if (ch.id === nodeId) return true;
    if (ch.type === 'group' && isDescendant(nodeId, ch)) return true;
  }
  return false;
}

// ── FHIR R4 — built-in example (loaded from file) ───────────────────────────────
const EXAMPLE_FILE = 'example-bariatric.fhir.json';

function loadExampleFile(onLoaded) {
  if (window.EXAMPLE_FHIR_Q) {
    // Loaded via <script> tag — works with file:// protocol
    onLoaded(window.EXAMPLE_FHIR_Q);
  } else {
    // Fallback: fetch (requires HTTP server)
    fetch(EXAMPLE_FILE)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(onLoaded)
      .catch(err => alert('Could not load example: ' + err.message));
  }
}

// ── FHIR R4 import helpers ────────────────────────────────────────────────────

// Read our custom extension value from a FHIR item
function extractExtension(fhirItem, key) {
  const ext = (fhirItem.extension || []).find(
    e => e.url === 'http://logicbuilder.example.org/extension/' + key
  );
  return ext ? (ext.valueString || '') : '';
}

// FHIR enableWhen[] → JS expression string using values['linkId']
// These are evaluated by evalRule (which now receives the values store)
function enableWhenToExpr(enableWhen) {
  if (!enableWhen || !enableWhen.length) return '';
  return enableWhen.map(ew => {
    const q = `values['${ew.question}']`;
    let val;
    if      (ew.answerBoolean  !== undefined) val = ew.answerBoolean;
    else if (ew.answerString   !== undefined) val = `'${ew.answerString}'`;
    else if (ew.answerInteger  !== undefined) val = ew.answerInteger;
    else if (ew.answerDecimal  !== undefined) val = ew.answerDecimal;
    else if (ew.answerCoding)                 val = `'${ew.answerCoding.code || ew.answerCoding.display || ''}'`;
    else val = true;
    if (ew.operator === 'exists') return val ? `${q} !== undefined` : `${q} === undefined`;
    const jsOp = ew.operator === '=' ? '==' : ew.operator;
    return `${q} ${jsOp} ${val}`;
  }).join(' && ');
}

// FHIR item.type → our itemType
function fhirTypeToItemType(t) {
  if (t === 'boolean')                                   return 'checkbox';
  if (t === 'integer' || t === 'decimal' || t === 'quantity') return 'number';
  if (t === 'choice'  || t === 'open-choice')             return 'select';
  if (t === 'display')                                   return 'display';
  return 'text'; // string, text, date, dateTime, url, reference, attachment
}

// answerOption[] → comma-separated display/code string for our options field
function fhirOptsToStr(opts) {
  return (opts || []).map(o => {
    if (o.valueCoding) return o.valueCoding.display || o.valueCoding.code || '';
    return o.valueString || (o.valueInteger !== undefined ? String(o.valueInteger) : '');
  }).filter(Boolean).join(', ');
}

// Build linkId → question text map for human-friendly display
function buildLinkIdMap(items, map = {}) {
  for (const item of items || []) {
    map[item.linkId] = item.text || item.linkId || '';
    buildLinkIdMap(item.item, map);
  }
  return map;
}

// FHIR enableWhen[] → readable string like: “"Diet program" is Yes”
function humanEnableWhen(enableWhen, linkIdMap) {
  if (!enableWhen || !enableWhen.length) return '';
  const parts = enableWhen.map(ew => {
    const qText = linkIdMap[ew.question] || ew.question;
    if (ew.operator === 'exists') return `«${qText}» есть ответ`;
    let val;
    if      (ew.answerBoolean  !== undefined) val = ew.answerBoolean ? 'Yes' : 'No';
    else if (ew.answerString   !== undefined) val = `«${ew.answerString}»`;
    else if (ew.answerInteger  !== undefined) val = ew.answerInteger;
    else if (ew.answerDecimal  !== undefined) val = ew.answerDecimal;
    else if (ew.answerCoding)                 val = ew.answerCoding.display || ew.answerCoding.code || '?';
    else val = '?';
    const opLabel = { '=': '=', '!=': '≠', '>': '>', '<': '<', '>=': '≥', '<=': '≤' }[ew.operator] || ew.operator;
    return `«${qText}» ${opLabel} ${val}`;
  });
  return parts.join(' AND ');
}

// Build our item node from a FHIR leaf question
function fhirQuestionToItem(fhirItem, linkIdMap) {
  const node = makeItem(fhirItem.text || fhirItem.linkId || 'Item');
  node.id             = fhirItem.linkId || node.id;
  node.mandatory      = !!fhirItem.required;
  node.visibilityRule = extractExtension(fhirItem, 'visibilityRule') || enableWhenToExpr(fhirItem.enableWhen);
  node.conditionRule  = extractExtension(fhirItem, 'conditionRule')  || '';
  node.itemType       = fhirTypeToItemType(fhirItem.type || 'string');
  node.options        = fhirOptsToStr(fhirItem.answerOption);
  const sv = extractExtension(fhirItem, 'successValue');
  if (sv) node.successValue = sv;
  if (fhirItem.enableWhen && fhirItem.enableWhen.length && linkIdMap) {
    node._enableWhenText = humanEnableWhen(fhirItem.enableWhen, linkIdMap);
  }
  const rs = fhirItem._text && fhirItem._text.extension
    && fhirItem._text.extension.find(x => x.url && x.url.includes('rendering-style'));
  if (rs) node._renderStyle = rs.valueString || '';
  return node;
}

// Recursive FHIR item → our node
// Non-group questions with nested items are wrapped in a synthetic group
// (FHIR allows nesting under any item; our model only allows children under groups)
function fhirItemToNode(fhirItem, linkIdMap) {
  const t = fhirItem.type || 'string';

  if (t === 'group') {
    const node = makeGroup(fhirItem.text || fhirItem.linkId || 'Group');
    node.id              = fhirItem.linkId || node.id;
    node.mandatory       = !!fhirItem.required;
    node.logicWithParent = fhirItem.enableBehavior === 'any' ? 'OR' : 'AND';
    node.visibilityRule  = extractExtension(fhirItem, 'visibilityRule') || enableWhenToExpr(fhirItem.enableWhen);
    node.conditionRule   = extractExtension(fhirItem, 'conditionRule')  || '';
    if (fhirItem.enableWhen && fhirItem.enableWhen.length && linkIdMap) {
      node._enableWhenText = humanEnableWhen(fhirItem.enableWhen, linkIdMap);
    }
    const rs = fhirItem._text && fhirItem._text.extension
      && fhirItem._text.extension.find(x => x.url && x.url.includes('rendering-style'));
    if (rs) node._renderStyle = rs.valueString || '';
    for (const child of fhirItem.item || []) {
      const n = fhirItemToNode(child, linkIdMap);
      if (n) node.children.push(n);
    }
    return node;
  }

  // Question with nested sub-items → wrap in synthetic group
  if ((fhirItem.item || []).length > 0) {
    const wrapper = makeGroup(fhirItem.text || fhirItem.linkId || 'Group');
    wrapper.id             = (fhirItem.linkId || wrapper.id) + '-grp';
    wrapper.mandatory      = !!fhirItem.required;
    wrapper.visibilityRule = extractExtension(fhirItem, 'visibilityRule') || enableWhenToExpr(fhirItem.enableWhen);
    wrapper.conditionRule  = extractExtension(fhirItem, 'conditionRule')  || '';
    if (fhirItem.enableWhen && fhirItem.enableWhen.length && linkIdMap) {
      wrapper._enableWhenText = humanEnableWhen(fhirItem.enableWhen, linkIdMap);
    }
    wrapper.children.push(fhirQuestionToItem(fhirItem, linkIdMap));
    for (const child of fhirItem.item) {
      const n = fhirItemToNode(child, linkIdMap);
      if (n) wrapper.children.push(n);
    }
    return wrapper;
  }

  return fhirQuestionToItem(fhirItem, linkIdMap);
}

// Main import entry point
function importFHIR(fhirJson) {
  let q = fhirJson;
  if (typeof q === 'string') {
    try { q = JSON.parse(q); } catch (e) { alert('Invalid JSON:\n' + e.message); return; }
  }
  if (!q || q.resourceType !== 'Questionnaire') {
    alert('Not a FHIR Questionnaire resource (resourceType must be "Questionnaire").');
    return;
  }
  tree.splice(0);
  Object.keys(values).forEach(k => delete values[k]);
  testMode.value = false;
  _seq = 1;
  const linkIdMap = buildLinkIdMap(q.item);
  for (const item of q.item || []) {
    const n = fhirItemToNode(item, linkIdMap);
    if (n) tree.push(n);
  }
  renderTree();
}

// ── FHIR R4 export ────────────────────────────────────────────────────────────
function itemTypeToFHIRType(t) {
  if (t === 'checkbox') return 'boolean';
  if (t === 'number')   return 'decimal';
  if (t === 'select')   return 'choice';
  if (t === 'display')  return 'display';
  return 'string';
}

// Try to convert our visibilityRule back to FHIR enableWhen[].
// Handles patterns produced by the visual builder:
//   values['linkId'] == true/false
//   values['linkId'] == 'string' or == number
//   values['linkId'] != / > / < / >= / <=
// Returns null if the rule is too complex (free-form JS).
function visRuleToEnableWhen(rule) {
  if (!rule || !rule.trim()) return null;
  // Match: values['linkId'] OP value  (single condition only)
  const m = rule.trim().match(/^values\['([^']+)'\]\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!m) return null;
  const [, question, op, rawVal] = m;
  const fhirOp = op === '==' ? '=' : op;
  let answer;
  if (rawVal === 'true')       answer = { answerBoolean: true };
  else if (rawVal === 'false') answer = { answerBoolean: false };
  else if (/^-?\d+(\.\d+)?$/.test(rawVal)) {
    answer = rawVal.includes('.') ? { answerDecimal: parseFloat(rawVal) } : { answerInteger: parseInt(rawVal, 10) };
  } else {
    // strip surrounding quotes
    const s = rawVal.replace(/^['"]|['"]$/g, '');
    answer = { answerString: s };
  }
  return [{ question, operator: fhirOp, ...answer }];
}

function nodeToFHIRItem(node) {
  const fhirItem = {
    linkId: node.id,
    text:   node.title,
    type:   node.type === 'group' ? 'group' : itemTypeToFHIRType(node.itemType)
  };
  if (node.mandatory) fhirItem.required = true;

  // visibilityRule → enableWhen if possible, else custom extension
  if (node.visibilityRule) {
    const ew = visRuleToEnableWhen(node.visibilityRule);
    if (ew) {
      fhirItem.enableWhen = ew;
    } else {
      // Complex JS — keep as extension so it round-trips correctly
      fhirItem.extension = (fhirItem.extension || []).concat({
        url: 'http://logicbuilder.example.org/extension/visibilityRule',
        valueString: node.visibilityRule
      });
    }
  }

  const ext = fhirItem.extension ? [...fhirItem.extension] : [];
  if (node.conditionRule)  ext.push({ url: 'http://logicbuilder.example.org/extension/conditionRule',  valueString: node.conditionRule });
  if (node.type === 'item' && node.successValue) ext.push({ url: 'http://logicbuilder.example.org/extension/successValue', valueString: node.successValue });
  if (ext.length) fhirItem.extension = ext;

  // _renderStyle → _text.extension[rendering-style] (round-trip)
  if (node._renderStyle) {
    fhirItem._text = {
      extension: [{
        url: 'http://hl7.org/fhir/StructureDefinition/rendering-style',
        valueString: node._renderStyle
      }]
    };
  }

  if (node.type === 'group') {
    if (node.logicWithParent === 'OR') fhirItem.enableBehavior = 'any';
    fhirItem.item = node.children.map(nodeToFHIRItem);
  } else if (node.itemType === 'select' && node.options) {
    fhirItem.answerOption = node.options.split(',')
      .map(o => o.trim()).filter(Boolean)
      .map(o => ({ valueCoding: { code: o, display: o } }));
  }
  return fhirItem;
}

function exportFHIR() {
  const q = {
    resourceType: 'Questionnaire',
    id:     'logic-builder-export',
    title:  'Exported Questionnaire',
    status: 'draft',
    subjectType: ['Patient'],
    date:   new Date().toISOString().split('T')[0],
    item:   tree.map(nodeToFHIRItem)
  };
  const blob = new Blob([JSON.stringify(q, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'questionnaire.fhir.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Left panel: builder tree ──────────────────────────────────────────────────
// Tracks collapse state per node id (UI-only, not reactive)
const _collapsed = new Map();

// Collect all item nodes from the tree (flat, with path titles for display)
function getAllItems(nodes, result = [], prefix = '') {
  for (const n of nodes) {
    if (n.type === 'item') {
      result.push({ id: n.id, label: (prefix ? prefix + ' › ' : '') + n.title, itemType: n.itemType, options: n.options });
    } else if (n.type === 'group') {
      getAllItems(n.children, result, (prefix ? prefix + ' › ' : '') + n.title);
    }
  }
  return result;
}

function renderTree() {
  const container = document.getElementById('treeContainer');
  container.innerHTML = '';
  for (const node of tree) container.appendChild(renderNode(node));
}

function renderNode(node) {
  const div = document.createElement('div');
  div.className = 'node ' + (node.type === 'group' ? 'node-group' : 'node-item');
  div.dataset.nodeId = node.id;

  const header = document.createElement('div');
  header.className = 'node-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'node-title';

  // Collapse toggle (groups only)
  if (node.type === 'group') {
    const collapsed = _collapsed.get(node.id) || false;
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'node-collapse-btn';
    toggleBtn.textContent = collapsed ? '▶' : '▼';
    toggleBtn.title = collapsed ? 'Expand' : 'Collapse';
    toggleBtn.onclick = e => {
      e.stopPropagation();
      const isNowCollapsed = !(_collapsed.get(node.id) || false);
      _collapsed.set(node.id, isNowCollapsed);
      toggleBtn.textContent = isNowCollapsed ? '▶' : '▼';
      toggleBtn.title = isNowCollapsed ? 'Expand' : 'Collapse';
      const body = div.querySelector('.node-body');
      if (body) body.style.display = isNowCollapsed ? 'none' : '';
    };
    titleWrap.appendChild(toggleBtn);
  }

  const isEmptyGroupNode = node.type === 'group' && node.children.length === 0;
  const typeLabel = document.createElement('span');
  typeLabel.className = 'node-type-label ' + (node.type === 'group' ? (isEmptyGroupNode ? 'lbl-info' : 'lbl-group') : 'lbl-item');
  typeLabel.textContent = node.type === 'group' ? (isEmptyGroupNode ? '[Info]' : '[Group]') : '[Item]';
  titleWrap.appendChild(typeLabel);

  // linkId (editable)
  const linkIdInput = document.createElement('input');
  linkIdInput.type = 'text';
  linkIdInput.value = node.id;
  linkIdInput.className = 'node-linkid-input';
  linkIdInput.title = 'FHIR linkId — editable';
  linkIdInput.oninput = () => { node.id = linkIdInput.value.trim() || node.id; };
  titleWrap.appendChild(linkIdInput);

  const titleInput = document.createElement('input');
  titleInput.type  = 'text';
  titleInput.value = node.title;
  titleInput.className = 'node-title-input';
  titleInput.oninput = () => { node.title = titleInput.value; };
  titleWrap.appendChild(titleInput);

  // Left → Right navigation: click header → scroll to preview row
  titleWrap.style.cursor = 'pointer';
  titleWrap.title = 'Click to navigate to preview row';
  titleWrap.addEventListener('click', e => {
    if (e.target === titleInput || e.target === linkIdInput) return;
    const target = document.querySelector('[data-preview-id="' + node.id + '"]');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('preview-flash');
    setTimeout(() => target.classList.remove('preview-flash'), 1000);
  });

  header.appendChild(titleWrap);

  const actions = document.createElement('div');
  actions.className = 'node-actions';

  let openKey = null;
  const panels = {};

  const addToggle = (label, key) => {
    const a = document.createElement('a');
    a.textContent = label;
    a.className = 'action-edit';
    a.onclick = () => {
      openKey = openKey === key ? null : key;
      for (const k of Object.keys(panels))
        panels[k].style.display = openKey === k ? 'block' : 'none';
    };
    actions.appendChild(a);
  };

  addToggle('Visibility', 'vis');
  addToggle('Mandatory',  'mand');
  addToggle('Style',      'style');

  if (node.type === 'item') {
    addToggle('Condition', 'cond');
    addToggle('Item type', 'type');
  } else {
    addToggle('Condition', 'cond');
    const aSub = document.createElement('a');
    aSub.textContent = '+ Group';
    aSub.className = 'action-add';
    aSub.onclick = () => {
      const newNode = makeGroup('New Group');
      node.children.push(newNode);
      _collapsed.set(node.id, false); // ensure parent is expanded
      renderTree();
      requestAnimationFrame(() => {
        const el = document.querySelector('[data-node-id="' + newNode.id + '"]');
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('node-flash'); setTimeout(() => el.classList.remove('node-flash'), 1000); }
      });
    };
    actions.appendChild(aSub);

    const aItem = document.createElement('a');
    aItem.textContent = '+ Item';
    aItem.className = 'action-add';
    aItem.onclick = () => {
      // Copy settings from the last sibling item (same group)
      const siblings = node.children.filter(c => c.type === 'item');
      const template = siblings.length > 0 ? siblings[siblings.length - 1] : null;
      const newNode = makeItem('New Item', template);
      node.children.push(newNode);
      _collapsed.set(node.id, false);
      renderTree();
      requestAnimationFrame(() => {
        const el = document.querySelector('[data-node-id="' + newNode.id + '"]');
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('node-flash'); setTimeout(() => el.classList.remove('node-flash'), 1000); }
      });
    };
    actions.appendChild(aItem);
  }

  const aDel = document.createElement('a');
  aDel.textContent = 'Delete';
  aDel.className = 'action-delete';
  aDel.onclick = () => { findAndRemove(node.id, tree); renderTree(); };
  actions.appendChild(aDel);

  header.appendChild(actions);
  div.appendChild(header);

  // Collapsible panels
  const addPanel = (key, buildFn) => {
    const p = document.createElement('div');
    p.className = 'hidden-panel';
    p.style.display = 'none';
    buildFn(p);
    panels[key] = p;
    div.appendChild(p);
  };

  addPanel('vis', p => {
    if (node._enableWhenText) {
      const friendly = document.createElement('div');
      friendly.style.cssText = 'margin-bottom:6px; padding:4px 8px; background:#fff8e1; border:1px solid #ffe082; border-radius:4px; font-size:11px; color:#5d4037;';
      friendly.innerHTML = '\uD83D\uDD12 <b>Shown when:</b> ' + escAttr(node._enableWhenText);
      p.appendChild(friendly);
    }

    // ── Visual condition builder ──────────────────────────────────────
    const builderWrap = document.createElement('div');
    builderWrap.className = 'vis-builder';

    const items = getAllItems(tree).filter(it => it.id !== node.id);

    const qSel = document.createElement('select');
    qSel.className = 'vis-builder-sel';
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = '\u2014 pick a question \u2014';
    qSel.appendChild(blank);
    for (const it of items) {
      const opt = document.createElement('option');
      opt.value = it.id; opt.textContent = it.label;
      opt.dataset.itype = it.itemType; opt.dataset.opts = it.options || '';
      qSel.appendChild(opt);
    }

    const opSel = document.createElement('select');
    opSel.className = 'vis-builder-sel vis-builder-op';

    const valWrap = document.createElement('span');

    const preview = document.createElement('div');
    preview.className = 'vis-builder-preview';
    preview.style.display = 'none';

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'vis-builder-apply';
    applyBtn.textContent = 'Use →';

    const rebuildValueInput = (itype, opts) => {
      valWrap.innerHTML = '';
      opSel.innerHTML = '';
      if (itype === 'checkbox') {
        ['== true|is Yes (checked)', '== false|is No (unchecked)'].forEach(s => {
          const [v, l] = s.split('|');
          const o = document.createElement('option'); o.value = v; o.textContent = l; opSel.appendChild(o);
        });
      } else {
        ['==|equals', '!=|not equals', '>|greater than', '<|less than'].forEach(s => {
          const [v, l] = s.split('|');
          const o = document.createElement('option'); o.value = v; o.textContent = l; opSel.appendChild(o);
        });
        if (itype === 'select' && opts) {
          const sel2 = document.createElement('select');
          sel2.className = 'vis-builder-sel';
          opts.split(',').map(s => s.trim()).filter(Boolean).forEach(o => {
            const opt = document.createElement('option'); opt.value = o; opt.textContent = o; sel2.appendChild(opt);
          });
          valWrap.appendChild(sel2);
        } else {
          const inp2 = document.createElement('input');
          inp2.type = itype === 'number' ? 'number' : 'text';
          inp2.placeholder = 'value';
          inp2.style.width = '70px';
          valWrap.appendChild(inp2);
        }
      }
    };

    const updatePreview = () => {
      const qid = qSel.value; if (!qid) { preview.style.display = 'none'; return; }
      const op  = opSel.value;
      const selOpt = qSel.options[qSel.selectedIndex];
      const itype = selOpt.dataset.itype;
      let valPart = '';
      if (itype === 'checkbox') {
        valPart = op; // op already contains full expression suffix like "== true"
      } else {
        const inp2 = valWrap.querySelector('input,select');
        const raw  = inp2 ? inp2.value : '';
        valPart = op + ' ' + (isNaN(raw) || raw === '' ? '\'' + raw.replace(/'/g, "\\'") + '\'' : raw);
      }
      const expr = itype === 'checkbox'
        ? `values['${qid}'] ${valPart}`
        : `values['${qid}'] ${valPart}`;
      preview.textContent = expr;
      preview.style.display = 'block';
      applyBtn.onclick = () => {
        node.visibilityRule = expr;
        rawInp.value = expr;
      };
    };

    qSel.onchange = () => {
      const selOpt = qSel.options[qSel.selectedIndex];
      if (!selOpt || !selOpt.value) { preview.style.display = 'none'; return; }
      rebuildValueInput(selOpt.dataset.itype, selOpt.dataset.opts);
      opSel.onchange = updatePreview;
      const inp2 = valWrap.querySelector('input,select');
      if (inp2) inp2.oninput = inp2.onchange = updatePreview;
      updatePreview();
    };

    builderWrap.appendChild(qSel);
    builderWrap.appendChild(opSel);
    builderWrap.appendChild(valWrap);
    builderWrap.appendChild(preview);
    builderWrap.appendChild(applyBtn);
    p.appendChild(builderWrap);

    // ── Raw JS (advanced) ─────────────────────────────────────────────
    const rawLbl = document.createElement('div');
    rawLbl.style.cssText = 'margin-top:8px; font-size:10px; color:#aaa; text-transform:uppercase; letter-spacing:.05em;';
    rawLbl.textContent = 'or type JS directly:';
    p.appendChild(rawLbl);
    const rawInp = document.createElement('input');
    rawInp.type = 'text'; rawInp.value = node.visibilityRule || '';
    rawInp.oninput = () => { node.visibilityRule = rawInp.value; };
    p.appendChild(rawInp);
  });

  addPanel('mand', p => {
    p.innerHTML = 'Mandatory: <input type="checkbox"' + (node.mandatory ? ' checked' : '') + '>';
    p.querySelector('input').onchange = function () { node.mandatory = this.checked; };
  });

  if (node.type === 'item') {
    addPanel('cond', p => {
      p.innerHTML = 'Condition rule (age, bmi, proc, comorb):<br>'
        + '<input type="text" value="' + escAttr(node.conditionRule) + '">';
      p.querySelector('input').oninput = function () { node.conditionRule = this.value; };
    });

    addPanel('type', p => {
      // Item type selector
      const typeRow = document.createElement('div');
      typeRow.textContent = 'Item type: ';
      const typeSelect = document.createElement('select');
      typeSelect.style.width = 'auto';
      for (const t of ['text', 'number', 'checkbox', 'select', 'display']) {
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        if (node.itemType === t) opt.selected = true;
        typeSelect.appendChild(opt);
      }
      typeRow.appendChild(typeSelect);
      p.appendChild(typeRow);

      // Options input (only for select type)
      const optionsDiv = document.createElement('div');
      optionsDiv.style.marginTop = '4px';
      optionsDiv.style.display = node.itemType === 'select' ? 'block' : 'none';
      optionsDiv.innerHTML = 'Options (comma-separated):<br>'
        + '<input type="text" value="' + escAttr(node.options) + '">';
      optionsDiv.querySelector('input').oninput = function () { node.options = this.value; };
      p.appendChild(optionsDiv);

      // Success value UI — rebuilt in place when type changes (no tree re-render)
      const successDiv = document.createElement('div');
      p.appendChild(successDiv);
      buildSuccessValueUI(node, successDiv);

      typeSelect.onchange = () => {
        node.itemType = typeSelect.value;
        optionsDiv.style.display = node.itemType === 'select' ? 'block' : 'none';
        buildSuccessValueUI(node, successDiv);
      };
    });
  }

  // Style panel (both group and item)
  addPanel('style', p => {
    const styleRow = (label, fn) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:12px;';
      const lbl = document.createElement('label');
      lbl.style.cssText = 'min-width:48px;color:#666;';
      lbl.textContent = label;
      row.appendChild(lbl);
      const ctrl = fn();
      row.appendChild(ctrl);
      p.appendChild(row);
      return ctrl;
    };

    const parseStyle = () => {
      const s = node._renderStyle || '';
      const bold   = /font-weight\s*:\s*bold/i.test(s);
      const italic = /font-style\s*:\s*italic/i.test(s);
      const colorM = s.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
      const color  = colorM ? colorM[1].trim() : '';
      return { bold, italic, color };
    };

    const buildStyle = (bold, italic, color) => {
      // Always explicit about weight+style so inline CSS overrides any class (e.g. display-info-label)
      const parts = [
        'font-weight: ' + (bold   ? 'bold'   : 'normal'),
        'font-style: '  + (italic ? 'italic' : 'normal'),
      ];
      if (color) parts.push('color: ' + color);
      return parts.join('; ');
    };

    const current = parseStyle();

    const boldCb = document.createElement('input');
    boldCb.type = 'checkbox'; boldCb.checked = current.bold;

    const italicCb = document.createElement('input');
    italicCb.type = 'checkbox'; italicCb.checked = current.italic;

    const colorInp = document.createElement('input');
    colorInp.type = 'color';
    colorInp.value = current.color
      ? (current.color.startsWith('#') ? current.color : '#000000')
      : '#000000';
    colorInp.style.cssText = 'width:36px;height:22px;padding:1px;border:1px solid #ccc;cursor:pointer;';

    const colorClear = document.createElement('button');
    colorClear.type = 'button';
    colorClear.textContent = '✕';
    colorClear.style.cssText = 'font-size:10px;padding:1px 5px;';
    colorClear.title = 'Remove color';

    const rawInp = document.createElement('input');
    rawInp.type = 'text';
    rawInp.value = node._renderStyle || '';
    rawInp.placeholder = 'e.g. font-weight: bold; color: blue';
    rawInp.style.cssText = 'width:100%;margin-top:4px;font-size:11px;';

    const sync = () => {
      const color = colorClear._cleared ? '' : (current.color || colorInp.value);
      const s = buildStyle(boldCb.checked, italicCb.checked, color);
      node._renderStyle = s;
      rawInp.value = s;
      _formTick.value++; // force preview re-render
    };

    boldCb.onchange   = sync;
    italicCb.onchange = sync;
    colorInp.oninput  = () => { current.color = colorInp.value; colorClear._cleared = false; sync(); };
    colorClear.onclick = () => {
      colorClear._cleared = true;
      current.color = '';
      colorInp.value = '#000000';
      sync();
    };

    rawInp.oninput = () => {
      node._renderStyle = rawInp.value;
      const p2 = parseStyle();
      boldCb.checked   = p2.bold;
      italicCb.checked = p2.italic;
      if (p2.color && p2.color.startsWith('#')) colorInp.value = p2.color;
      _formTick.value++;
    };

    styleRow('Bold', () => boldCb);
    styleRow('Italic', () => italicCb);
    const colorRow = document.createElement('div');
    colorRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:12px;';
    const colorLbl = document.createElement('label');
    colorLbl.style.cssText = 'min-width:48px;color:#666;';
    colorLbl.textContent = 'Color';
    colorRow.appendChild(colorLbl);
    colorRow.appendChild(colorInp);
    colorRow.appendChild(colorClear);
    p.appendChild(colorRow);

    const rawLbl = document.createElement('div');
    rawLbl.style.cssText = 'margin-top:4px;font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.05em;';
    rawLbl.textContent = 'raw CSS:';
    p.appendChild(rawLbl);
    p.appendChild(rawInp);
  });

  if (node.type === 'group') {
    addPanel('cond', p => {
      p.innerHTML = 'Condition rule — if false, group is N/A (disabled, not FAIL):<br>'
        + '<small style="color:#aaa;font-size:10px">Variables: age, gender, bmi, pregnant, smoker, proc, comorb</small>'
        + '<input type="text" value="' + escAttr(node.conditionRule) + '">';
      p.querySelector('input').oninput = function () { node.conditionRule = this.value; };
    });

    const body = document.createElement('div');
    body.className = 'node-body';
    if (_collapsed.get(node.id)) body.style.display = 'none';

    const logicRow = document.createElement('div');
    logicRow.className = 'logic-row';
    logicRow.textContent = 'Logic between children: ';

    const logicSel = document.createElement('select');
    for (const v of ['AND', 'OR']) {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      if (node.logicWithParent === v) opt.selected = true;
      logicSel.appendChild(opt);
    }
    logicSel.onchange = () => { node.logicWithParent = logicSel.value; };
    logicRow.appendChild(logicSel);
    body.appendChild(logicRow);

    for (const ch of node.children) body.appendChild(renderNode(ch));
    div.appendChild(body);
  }

  return div;
}

// ── Right panel: reactive preview ─────────────────────────────────────────────
// effect() re-runs when tree structure, patient data, or node config changes.
// Form value changes (user typing) are handled imperatively via updateIcon()
// inside buildControl — no effect re-run needed.
effect(() => {
  void _formTick.value; // subscribe: re-run when checkbox/select changes (re-evaluates enableWhen)
  const ctx = {
    age:      age.value,
    gender:   gender.value,
    bmi:      bmi.value,
    pregnant: pregnant.value,
    smoker:   smoker.value,
    proc:     proc.value,
    comorb:   comorb.value.toLowerCase()
  };
  const tMode = testMode.value;

  const lform = document.getElementById('lform');
  lform.innerHTML = '';

  const results = [];
  let anyVisible = false;
  for (const node of tree) {
    const r = evaluateNode(node, ctx, results);
    if (r.visible) anyVisible = true;
  }

  const visible = results.filter(r => r.visible);
  // Build a lookup map for results by node id
  const resultMap = new Map(results.map(r => [r.node.id, r]));

  if (visible.length === 0) {
    const msg = document.createElement('div');
    msg.style.cssText = 'color:#999; font-size:13px; padding:12px;';
    msg.textContent = 'No visible groups/items.';
    lform.appendChild(msg);
  }

  // Compute final ok including form values
  // Disabled nodes (group conditionRule not met) are excluded from final result
  let finalOk = visible.filter(r => !r.disabled).every(res => {
    if (res.node.type === 'item') return res.ok && calcFormOk(res.node);
    return res.ok;
  });

  // groupIconMap: populated during recursive render, used by updateGroupIcons
  const groupIconMap = new Map();

  // Recursive preview renderer — builds nested DOM matching tree structure
  function renderPreviewNode(res, container) {
    if (!res) return;
    if (!res.visible && !res.showDimmed) return;

    // Dimmed: enableWhen condition not yet met → show as "waiting" row
    if (!res.visible && res.showDimmed) {
      const row = document.createElement('div');
      row.className = 'lform-item lform-waiting';
      row.dataset.previewId = res.node.id;
      row.title = 'Click to navigate to builder node';
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const target = document.querySelector('[data-node-id="' + res.node.id + '"]');
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('node-flash');
        setTimeout(() => target.classList.remove('node-flash'), 1000);
      });
      const ph = document.createElement('span');
      ph.style.cssText = 'width:20px;flex-shrink:0;display:inline-block;';
      row.appendChild(ph);
      const label = document.createElement('span');
      label.style.color = '#aaa';
      label.textContent = (res.node.type === 'group' ? 'Group: ' : 'Item: ') + res.node.title;
      row.appendChild(label);
      const hint = document.createElement('span');
      hint.className = 'preview-condition-hint preview-condition-waiting';
      hint.textContent = '\uD83D\uDD12 ' + res.node._enableWhenText;
      row.appendChild(hint);
      container.appendChild(row);
      return;
    }

    // Disabled: group conditionRule not met → render grayed-out N/A row
    if (res.disabled) {
      const row = document.createElement('div');
      row.className = 'lform-item lform-disabled';
      row.dataset.previewId = res.node.id;
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const target = document.querySelector('[data-node-id="' + res.node.id + '"]');
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('node-flash');
        setTimeout(() => target.classList.remove('node-flash'), 1000);
      });
      const naIcon = document.createElement('span');
      naIcon.className = 'icon-na';
      naIcon.textContent = '\u2014'; // em dash
      row.appendChild(naIcon);
      const label = document.createElement('span');
      if (res.node.type === 'group') label.className = 'group-label';
      label.textContent = (res.node.type === 'group' ? 'Group: ' : 'Item: ') + res.node.title;
      row.appendChild(label);
      container.appendChild(row);
      if (res.node.type === 'group' && res.node.children.length > 0) {
        const nested = document.createElement('div');
        nested.className = 'preview-nested';
        for (const ch of res.node.children) {
          const childRes = resultMap.get(ch.id);
          if (childRes) renderPreviewNode(childRes, nested);
        }
        if (nested.childElementCount > 0) container.appendChild(nested);
      }
      return;
    }

    let hasCondition, displayOk;
    if (res.node.type === 'group') {
      const descendantItems = visible.filter(r =>
        r.node.type === 'item' && !r.disabled && isDescendant(r.node.id, res.node)
      );
      if (descendantItems.length === 0) {
        hasCondition = false;
        displayOk    = true;
      } else {
        hasCondition = true;
        const itemOk = k => k.ok && calcFormOk(k.node);
        displayOk = res.node.logicWithParent === 'OR'
          ? descendantItems.some(itemOk)
          : descendantItems.every(itemOk);
      }
    } else {
      hasCondition = res.node.itemType !== 'display' && res.node.mandatory && res.node.successValue !== '';
      displayOk    = res.ok && calcFormOk(res.node);
    }

    // Header row
    const row = document.createElement('div');
    row.className = 'lform-item';
    row.dataset.previewId = res.node.id;
    if (tMode) row.classList.add(displayOk ? 'success' : 'error');
    row.title = 'Click to navigate to builder node';
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      const target = document.querySelector('[data-node-id="' + res.node.id + '"]');
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('node-flash');
      setTimeout(() => target.classList.remove('node-flash'), 1000);
    });

    let iconEl = null;
    if (hasCondition) {
      iconEl = document.createElement('span');
      iconEl.className   = displayOk ? 'icon-ok' : 'icon-fail';
      iconEl.textContent = displayOk ? '\u2714' : '\u2718';
      row.appendChild(iconEl);
    } else {
      const ph = document.createElement('span');
      ph.style.cssText = 'width:20px; flex-shrink:0; display:inline-block;';
      row.appendChild(ph);
    }
    res._iconEl = iconEl;

    const isEmptyGroup = res.node.type === 'group' && res.node.children.length === 0;

    // linkId badge — left of label
    const idTag = document.createElement('span');
    idTag.className = 'preview-linkid';
    idTag.textContent = res.node.id;
    idTag.title = 'FHIR linkId — use as: values[\'' + res.node.id + '\']';
    row.appendChild(idTag);

    const label = document.createElement('span');
    if (isEmptyGroup) {
      label.className = 'display-info-label';
      label.textContent = res.node.title;
    } else if (res.node.type === 'group') {
      label.className = 'group-label';
      label.textContent = res.node.title;
    } else {
      label.textContent = res.node.title;
    }
    if (res.node._renderStyle) label.style.cssText = res.node._renderStyle;
    row.appendChild(label);

    if (res.node.type === 'group' && !isEmptyGroup) {
      const isOr = res.node.logicWithParent === 'OR';
      const lb = document.createElement('span');
      lb.className = 'preview-logic-badge preview-logic-' + (isOr ? 'or' : 'and');
      lb.textContent = isOr ? 'ANY item ✓' : 'ALL items ✓';
      lb.title = isOr
        ? 'Group passes if at least one item inside is satisfied (OR)'
        : 'Group passes only if all items inside are satisfied (AND)';
      row.appendChild(lb);
    }

    // Human-friendly visibility condition
    if (res.node._enableWhenText) {
      const hint = document.createElement('span');
      hint.className = 'preview-condition-hint';
      hint.title = 'Visible when: ' + res.node._enableWhenText;
      hint.textContent = '\uD83D\uDC41\uFE0F ' + res.node._enableWhenText;
      row.appendChild(hint);
    }

    if (res.node.type === 'item') {
      // Pre-fill checkbox from conditionRule when applicable
      if (res.node.itemType === 'checkbox' && res.node.conditionRule) {
        if (values[res.node.id] === undefined || autoFilledIds.has(res.node.id)) {
          values[res.node.id] = evalRule(res.node.conditionRule, ctx);
          autoFilledIds.add(res.node.id);
        }
      }
      if (res.node.itemType !== 'display') {
        const isAuto = autoFilledIds.has(res.node.id);
        row.appendChild(buildControl(res.node, iconEl, () => updateGroupIcons(), isAuto));
      }
    }

    container.appendChild(row);

    // For groups: render children with AND/OR separators between visible siblings
    if (res.node.type === 'group' && res.node.children.length > 0) {
      const nested = document.createElement('div');
      nested.className = 'preview-nested';
      const logic = res.node.logicWithParent || 'AND';
      let firstVisible = true;
      for (const ch of res.node.children) {
        const childRes = resultMap.get(ch.id);
        if (childRes && (childRes.visible || childRes.showDimmed)) {
          if (!firstVisible && childRes.visible) {
            const sep = document.createElement('div');
            sep.className = 'logic-separator logic-separator-' + logic.toLowerCase();
            sep.textContent = logic;
            nested.appendChild(sep);
          }
          renderPreviewNode(childRes, nested);
          if (childRes.visible) firstVisible = false;
        }
      }
      if (nested.childElementCount > 0) container.appendChild(nested);

      // Register group in map for live icon updates (exclude disabled items)
      const descendants = visible.filter(r =>
        r.node.type === 'item' && !r.disabled && isDescendant(r.node.id, res.node)
      );
      if (iconEl) groupIconMap.set(res.node.id, { icon: iconEl, descendants, node: res.node });
    }
  }

  // Render only root-level nodes; children rendered recursively inside
  for (const node of tree) {
    const res = resultMap.get(node.id);
    if (res) renderPreviewNode(res, lform);
  }

  function updateGroupIcons() {
    for (const [, { icon, descendants, node }] of groupIconMap.entries()) {
      if (descendants.length === 0) continue;
      const itemOk = k => k.ok && calcFormOk(k.node);
      const ok = node.logicWithParent === 'OR'
        ? descendants.some(itemOk)
        : descendants.every(itemOk);
      icon.className   = ok ? 'icon-ok' : 'icon-fail';
      icon.textContent = ok ? '\u2714' : '\u2718';
    }
  }

  const finalEl = document.getElementById('finalResult');
  if (!anyVisible) {
    finalEl.textContent = 'Final Result: No visible groups/items.';
    finalEl.className = 'final-result';
  } else {
    finalEl.textContent = 'Final Result: ' + (finalOk ? 'PASS' : 'FAIL');
    finalEl.className = 'final-result ' + (finalOk ? 'pass' : 'fail');
  }
});

// ── Interactive control for preview ──────────────────────────────────────────
// text and checkbox are fully interactive.
// number and select also interactive but don't allow free-form invalid input.
// onAfterChange: callback to run after the value changes (updates group icons).
function buildControl(node, iconEl, onAfterChange, isAuto) {
  const updateOwnIcon = () => {
    if (!iconEl) return;
    const ok = calcFormOk(node);
    iconEl.className   = ok ? 'icon-ok' : 'icon-fail';
    iconEl.textContent = ok ? '\u2714' : '\u2718';
  };

  const onChange = () => {
    updateOwnIcon();
    if (onAfterChange) onAfterChange();
  };

  const wrap = document.createElement('span');
  wrap.style.cssText = 'display:inline-flex;align-items:center;gap:5px;';

  if (node.itemType === 'checkbox') {
    const el = document.createElement('input');
    el.type    = 'checkbox';
    el.checked = !!values[node.id];

    let badge = null;
    if (isAuto) {
      badge = document.createElement('span');
      badge.className = 'auto-badge';
      badge.title = 'Pre-filled from patient data. You can override.';
      badge.textContent = '\uD83E\uDD16';
    }

    el.onchange = () => {
      values[node.id] = el.checked;
      autoFilledIds.delete(node.id); // mark as manually edited
      if (badge) { badge.style.opacity = '0.35'; badge.title = 'Was pre-filled, now manually set.'; }
      onChange();
      _formTick.value++;
    };
    wrap.appendChild(el);
    if (badge) wrap.appendChild(badge);

  } else if (node.itemType === 'number') {
    const el = document.createElement('input');
    el.type = 'number'; el.style.width = '80px';
    el.value = values[node.id] !== undefined ? values[node.id] : '';
    el.oninput = () => { values[node.id] = el.value; onChange(); };
    wrap.appendChild(el);

  } else if (node.itemType === 'select') {
    const el = document.createElement('select');
    let firstOpt = null;
    for (const o of (node.options || '').split(',')) {
      const t = o.trim(); if (!t) continue;
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t;
      if (!firstOpt) firstOpt = t;
      el.appendChild(opt);
    }
    if (values[node.id] !== undefined) el.value = values[node.id];
    else if (firstOpt) { values[node.id] = firstOpt; }
    el.onchange = () => { values[node.id] = el.value; onChange(); _formTick.value++; };
    wrap.appendChild(el);

  } else {
    const el = document.createElement('input');
    el.type = 'text'; el.style.width = '120px';
    el.value = values[node.id] !== undefined ? values[node.id] : '';
    el.oninput = () => { values[node.id] = el.value; onChange(); };
    wrap.appendChild(el);
  }

  return wrap;
}

// ── Buttons + init ────────────────────────────────────────────────────────────
document.getElementById('addRootGroupBtn').onclick = () => {
  const newNode = makeGroup('Root Group ' + tree.length);
  tree.push(newNode);
  renderTree();
  requestAnimationFrame(() => {
    const el = document.querySelector('[data-node-id="' + newNode.id + '"]');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('node-flash'); setTimeout(() => el.classList.remove('node-flash'), 1000); }
  });
};
document.getElementById('testBtn').onclick    = () => { testMode.value = true; };
document.getElementById('loadExampleBtn').onclick  = () => loadExampleFile(importFHIR);
document.getElementById('exportFhirBtn').onclick  = exportFHIR;
document.getElementById('loadFhirBtn').onclick    = () => document.getElementById('fhirFileInput').click();
document.getElementById('fhirFileInput').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload  = ev => { try { importFHIR(JSON.parse(ev.target.result)); } catch(err) { alert('Parse error: ' + err.message); } };
  reader.onerror = ()  => alert('Error reading file.');
  reader.readAsText(file);
  e.target.value = ''; // allow re-loading same file
};

// Start with the built-in example loaded
loadExampleFile(importFHIR);
