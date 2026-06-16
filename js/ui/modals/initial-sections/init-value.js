import { InitialSection } from './base-section.js';
import { INITIAL_SECTIONS } from './registry.js';
import { parseOptions, rawOptsToPairs } from '../../../utils.js';
import { AppEvents } from '../../../events.js';
import { createCustomSelect } from '../../custom-select.js';
import { createDatePicker } from '../../date-picker.js';

class InitValueSection extends InitialSection {
  initPending(node) {
    return { draftValue: node._initialValue };
  }

  build(pending) {
    const frag = document.createDocumentFragment();

    const hint = document.createElement('div');
    hint.className   = 'panel-hint';
    hint.textContent = 'Pre-filled when the form loads. User can edit unless readOnly.';
    frag.appendChild(hint);

    const itype = pending.node.itemType;

    if (itype === 'display' || itype === 'attachment') {
      const na = document.createElement('div');
      na.className       = 'panel-hint panel-hint--mt';
      na.textContent     = 'Not applicable for this item type.';
      frag.appendChild(na);
      return frag;
    }

    const wrap = document.createElement('div');
    wrap.className = 'panel-sub-section';
    frag.appendChild(wrap);

    const lbl = document.createElement('label');
    lbl.className        = 'initial-modal-label';
    lbl.textContent      = 'Default value:';
    lbl.dataset.tipTitle = 'item.initial';
    lbl.dataset.tipBody  = 'Pre-filled value when the form loads. Exported as item.initial[0].value[x] in the FHIR Questionnaire. User can edit unless the item is read-only.';
    lbl.dataset.tipFhir  = 'Questionnaire.item.initial[].value[x]';
    lbl.dataset.tipSpec  = 'R4';
    wrap.appendChild(lbl);

    const setDraft = v => { pending.draftValue = v; };

    let ctrl;
    if (itype === 'checkbox') {
      const cbSel = createCustomSelect({
        items: [
          { value: '',      label: '\u2014 none \u2014' },
          { value: 'true',  label: 'Checked (Yes)' },
          { value: 'false', label: 'Unchecked (No)' },
        ],
        value:     pending.draftValue === undefined ? '' : String(pending.draftValue),
        className: 'sc-trigger--full',
        onChange:  v => setDraft(v === '' ? undefined : v === 'true'),
      });
      ctrl = cbSel.el;

    } else if (itype === 'select' || itype === 'radio' || itype === 'open-choice') {
      const optSel = createCustomSelect({
        items: [
          { value: '', label: '\u2014 none \u2014' },
          ...(pending.node._rawAnswerOptions
            ? rawOptsToPairs(pending.node._rawAnswerOptions)
            : parseOptions(pending.node.options || '')
          ).map(({ code, display }) => ({ value: code, label: display || code })),
        ],
        value:     pending.draftValue || '',
        className: 'sc-trigger--full',
        onChange:  v => setDraft(v || undefined),
      });
      ctrl = optSel.el;

    } else if (itype === 'date') {
      const dp = createDatePicker({
        value:    pending.draftValue || '',
        onChange: v => setDraft(v || undefined),
        className: 'sc-trigger--full',
      });
      ctrl = dp.el;

    } else if (itype === 'dateTime') {
      const dp = createDatePicker({
        value:    pending.draftValue || '',
        onChange: v => setDraft(v || undefined),
        withTime:  true,
        className: 'sc-trigger--full',
      });
      ctrl = dp.el;

    } else if (itype === 'time') {
      ctrl = document.createElement('input');
      ctrl.type      = 'time';
      ctrl.className = 'panel-inp-sm ctrl-input--time';
      // FHIR time stored as HH:MM:SS — native input uses HH:MM
      ctrl.value = pending.draftValue ? String(pending.draftValue).slice(0, 5) : '';
      ctrl.addEventListener('change', () => {
        setDraft(ctrl.value ? ctrl.value + ':00' : undefined);
      });

    } else if (['number', 'integer', 'decimal', 'quantity'].includes(itype)) {
      ctrl = document.createElement('input');
      ctrl.type      = 'number';
      ctrl.className = 'panel-inp-sm';
      ctrl.value     = pending.draftValue !== undefined ? pending.draftValue : '';
      ctrl.oninput = () => setDraft(ctrl.value !== '' ? ctrl.value : undefined);

    } else if (itype === 'text') {
      ctrl = document.createElement('textarea');
      ctrl.className = 'panel-inp-textarea';
      ctrl.rows  = 3;
      ctrl.value = pending.draftValue !== undefined ? String(pending.draftValue) : '';
      ctrl.oninput = () => setDraft(ctrl.value || undefined);

    } else {
      // url, reference, open-choice free-text fallback, and other string-like types
      ctrl = document.createElement('input');
      ctrl.type      = 'text';
      ctrl.className = 'panel-inp-sm';
      ctrl.value     = pending.draftValue !== undefined ? String(pending.draftValue) : '';
      ctrl.oninput   = () => setDraft(ctrl.value || undefined);
    }

    wrap.appendChild(ctrl);
    return frag;
  }

  commit(pending, node) {
    const v = pending.draftValue;
    if (v !== undefined && v !== '') {
      node._initialValue = v;
      document.dispatchEvent(new CustomEvent(AppEvents.ANSWER_SET, { detail: { id: node.id, value: v } }));
    } else {
      delete node._initialValue;
      document.dispatchEvent(new CustomEvent(AppEvents.ANSWER_DELETE, { detail: { id: node.id } }));
    }
  }
}

INITIAL_SECTIONS.push(new InitValueSection());
