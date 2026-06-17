import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';

const CHOICE_TYPES = new Set(['choice', 'open-choice', 'select', 'radio', 'checklist']);

class ChoiceColumnsSection extends AnswerTypeSection {
  isVisible(type) { return CHOICE_TYPES.has(type); }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const lbl = document.createElement('div');
    lbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    lbl.textContent      = 'Choice columns:';
    lbl.dataset.tipTitle = 'Choice Columns (SDC)';
    lbl.dataset.tipBody  = 'Defines multi-column display for dropdown options. Each column shows a property of the answer option (e.g. code, display, system). Mark one column as "For display" to control which value shows in the trigger after selection.';
    lbl.dataset.tipFhir  = 'item.extension[sdc-questionnaire-choiceColumn]';
    lbl.dataset.tipSpec  = 'SDC';
    section.appendChild(lbl);

    const listEl = document.createElement('div');
    listEl.className = 'cc-list';
    listEl.dataset.testid = 'choice-columns-list';

    const _renderRows = () => {
      listEl.innerHTML = '';
      const cols = pending.draftChoiceColumns || [];
      if (!cols.length) {
        const empty = document.createElement('div');
        empty.className = 'cc-empty';
        empty.textContent = 'No columns defined';
        listEl.appendChild(empty);
        return;
      }
      for (let i = 0; i < cols.length; i++) {
        listEl.appendChild(_buildRow(cols, i, pending, _renderRows));
      }
    };

    _renderRows();
    section.appendChild(listEl);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'modal-btn modal-btn--sm';
    addBtn.textContent = '+ Add column';
    addBtn.dataset.testid = 'cc-add-btn';
    addBtn.onclick = () => {
      if (!pending.draftChoiceColumns) pending.draftChoiceColumns = [];
      pending.draftChoiceColumns.push({ path: '', label: '', forDisplay: false });
      _renderRows();
    };
    section.appendChild(addBtn);

    return section;
  }

  commit(pending, node, _questDoc, _answerStore) {
    const cols = (pending.draftChoiceColumns || []).filter(c => c.path);
    node._choiceColumns = cols.length ? cols : undefined;
  }

  initPending(node) {
    const cols = node._choiceColumns;
    return {
      draftChoiceColumns: cols ? cols.map(c => ({ ...c })) : [],
    };
  }
}

function _buildRow(cols, idx, pending, rerender) {
  const col = cols[idx];
  const row = document.createElement('div');
  row.className = 'cc-row';
  row.dataset.testid = 'cc-row';

  const pathIn = document.createElement('input');
  pathIn.type = 'text';
  pathIn.className = 'cc-input';
  pathIn.placeholder = 'Path (e.g. code)';
  pathIn.value = col.path || '';
  pathIn.dataset.testid = 'cc-path';
  pathIn.oninput = () => { col.path = pathIn.value; };

  const labelIn = document.createElement('input');
  labelIn.type = 'text';
  labelIn.className = 'cc-input';
  labelIn.placeholder = 'Label';
  labelIn.value = col.label || '';
  labelIn.dataset.testid = 'cc-label';
  labelIn.oninput = () => { col.label = labelIn.value; };

  const widthIn = document.createElement('input');
  widthIn.type = 'text';
  widthIn.className = 'cc-input cc-input--sm';
  widthIn.placeholder = 'Width';
  widthIn.value = col.width ? (col.width.value + (col.width.unit || col.width.code || '')) : '';
  widthIn.dataset.testid = 'cc-width';
  widthIn.dataset.tipTitle = 'Column Width';
  widthIn.dataset.tipBody = 'Optional width with unit (e.g. 30%, 100px). Exported as a FHIR Quantity.';
  widthIn.dataset.tipFhir = 'item.extension[sdc-questionnaire-choiceColumn].extension[width]';
  widthIn.dataset.tipSpec = 'SDC';
  widthIn.oninput = () => {
    const raw = widthIn.value.trim();
    if (!raw) { delete col.width; return; }
    const m = raw.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (m) col.width = { value: parseFloat(m[1]), unit: m[2] || '%' };
  };

  const fdWrap = document.createElement('label');
  fdWrap.className = 'cc-fd-label';
  fdWrap.dataset.tipTitle = 'For Display';
  fdWrap.dataset.tipBody = 'When checked, this column\'s value is shown in the dropdown trigger after an option is selected.';
  fdWrap.dataset.tipFhir = 'item.extension[sdc-questionnaire-choiceColumn].extension[forDisplay]';
  fdWrap.dataset.tipSpec = 'SDC';
  const fdCb = document.createElement('input');
  fdCb.type = 'checkbox';
  fdCb.checked = !!col.forDisplay;
  fdCb.dataset.testid = 'cc-for-display';
  fdCb.onchange = () => {
    // Only one column can be forDisplay
    if (fdCb.checked) {
      for (const c of cols) c.forDisplay = false;
      col.forDisplay = true;
    } else {
      col.forDisplay = false;
    }
    rerender();
  };
  fdWrap.appendChild(fdCb);
  fdWrap.appendChild(document.createTextNode(' Display'));

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'cc-del-btn';
  delBtn.textContent = '\u00D7';
  delBtn.dataset.testid = 'cc-del-btn';
  delBtn.onclick = () => {
    pending.draftChoiceColumns.splice(idx, 1);
    rerender();
  };

  row.append(pathIn, labelIn, widthIn, fdWrap, delBtn);
  return row;
}

ANSWER_TYPE_SECTIONS.push(new ChoiceColumnsSection());
