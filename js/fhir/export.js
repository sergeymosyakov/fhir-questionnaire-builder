// ── FHIR R4 Questionnaire export ──────────────────────────────────────────────
import { tree } from '../state.js';

function itemTypeToFHIRType(t) {
  if (t === 'checkbox') return 'boolean';
  if (t === 'number')   return 'decimal';
  if (t === 'select')   return 'choice';
  if (t === 'display')  return 'display';
  return 'string';
}

// Try to convert our visibilityRule back to FHIR enableWhen[].
// Handles patterns produced by the visual builder:
//   values['linkId'] == true/false / 'string' / number
// Returns null if the rule is too complex (free-form JS).
function visRuleToEnableWhen(rule) {
  if (!rule || !rule.trim()) return null;
  const m = rule.trim().match(/^values\['([^']+)'\]\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!m) return null;
  const [, question, op, rawVal] = m;
  const fhirOp = op === '==' ? '=' : op;
  let answer;
  if (rawVal === 'true')       answer = { answerBoolean: true };
  else if (rawVal === 'false') answer = { answerBoolean: false };
  else if (/^-?\d+(\.\d+)?$/.test(rawVal)) {
    answer = rawVal.includes('.')
      ? { answerDecimal: parseFloat(rawVal) }
      : { answerInteger: parseInt(rawVal, 10) };
  } else {
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
  if (node.mandatory === true) fhirItem.required = true;
  else if (node.mandatory === false) fhirItem.required = false;
  // null = not set, omit from FHIR

  // visibilityRule → enableWhen if possible, else custom extension
  if (node.visibilityRule) {
    const ew = visRuleToEnableWhen(node.visibilityRule);
    if (ew) {
      fhirItem.enableWhen = ew;
    } else {
      fhirItem.extension = (fhirItem.extension || []).concat({
        url: 'http://logicbuilder.example.org/extension/visibilityRule',
        valueString: node.visibilityRule
      });
    }
  }

  const ext = fhirItem.extension ? [...fhirItem.extension] : [];
  if (node.conditionRule)
    ext.push({ url: 'http://logicbuilder.example.org/extension/conditionRule', valueString: node.conditionRule });
  if (node.type === 'item' && node.successValue)
    ext.push({ url: 'http://logicbuilder.example.org/extension/successValue', valueString: node.successValue });
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

export function exportFHIR() {
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
