/**
 * createOptionsEditor — dynamic row-based editor for answer options.
 *
 * Each row holds: code | label | score (optional) | prefix (optional) | remove btn.
 * Used in the Answer Type modal (choice / radio / open-choice) to replace the
 * comma-separated plain-text inputs.
 *
 * API:
 *   const ed = createOptionsEditor({ rows, onchange, testidPrefix });
 *   container.appendChild(ed.el);
 *   const rows = ed.getRows(); // [{code, label, score, prefix}, ...]
 */

export function createOptionsEditor({ rows = [], onchange = () => {}, testidPrefix = 'opt' } = {}) {
  // internal state — array of row objects (mutable)
  let _rows = rows.map(r => ({ code: r.code || '', label: r.label || '', score: r.score ?? '', prefix: r.prefix || '', exclusive: !!r.exclusive }));

  const wrap = document.createElement('div');
  wrap.className = 'opt-editor';

  const list = document.createElement('div');
  list.className = 'opt-editor__list';
  wrap.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.type      = 'button';
  addBtn.className = 'opt-editor__add-btn';
  addBtn.textContent = '+ Add option';
  addBtn.dataset.testid = testidPrefix + '-add-btn';
  addBtn.addEventListener('click', () => {
    _rows.push({ code: '', label: '', score: '', prefix: '', exclusive: false });
    _renderRows();
    onchange(_rows);
    // focus the code input of the new row
    const inputs = list.querySelectorAll('.opt-editor__row:last-child .opt-editor__cell input');
    if (inputs[0]) inputs[0].focus();
  });
  wrap.appendChild(addBtn);

  function _renderRows() {
    list.innerHTML = '';

    if (_rows.length === 0) {
      const empty = document.createElement('div');
      empty.className   = 'opt-editor__empty';
      empty.textContent = 'No options yet — click "+ Add option" below.';
      list.appendChild(empty);
      return;
    }

    // header row
    const HEADERS = [
      {
        text:     'Code',
        tipTitle: 'Option code',
        tipBody:  'Machine-readable identifier for this answer choice. Used as valueCoding.code in the exported FHIR Questionnaire.',
        tipFhir:  'Questionnaire.item.answerOption[].valueCoding.code',
        tipSpec:  'R4',
      },
      {
        text:     'Label',
        tipTitle: 'Display label',
        tipBody:  'Human-readable text shown to the user for this answer choice. Maps to valueCoding.display.',
        tipFhir:  'Questionnaire.item.answerOption[].valueCoding.display',
        tipSpec:  'R4',
      },
      {
        text:     'Score',
        tipTitle: 'Ordinal score',
        tipBody:  'Optional numeric score (ordinal value) for this answer. Used in scored questionnaires (e.g. PHQ-9). Exported as the ordinalValue extension on answerOption.',
        tipFhir:  'Questionnaire.item.answerOption[].extension[ordinalValue]',
        tipSpec:  'R4',
      },
      {
        text:     'Prefix',
        tipTitle: 'Display prefix',
        tipBody:  'Optional text shown before the answer label, e.g. "A.", "1.". Exported as the questionnaire-optionPrefix extension on answerOption.',
        tipFhir:  'Questionnaire.item.answerOption[].extension[questionnaire-optionPrefix]',
        tipSpec:  'R4',
      },
      {
        text:     'Excl',
        tipTitle: 'Option exclusive',
        tipBody:  'When checked, selecting this option in a checklist deselects all other options (e.g. "None of the above"). Exported as the questionnaire-optionExclusive extension on answerOption.',
        tipFhir:  'Questionnaire.item.answerOption[].extension[questionnaire-optionExclusive]',
        tipSpec:  'R4',
      },
      { text: '' },
    ];

    const header = document.createElement('div');
    header.className = 'opt-editor__header';
    HEADERS.forEach(({ text, tipTitle, tipBody, tipFhir, tipSpec }) => {
      const cell = document.createElement('div');
      cell.className   = 'opt-editor__hcell';
      cell.textContent = text;
      if (tipTitle) {
        cell.dataset.tipTitle = tipTitle;
        cell.dataset.tipBody  = tipBody;
        if (tipFhir) cell.dataset.tipFhir = tipFhir;
        if (tipSpec)  cell.dataset.tipSpec = tipSpec;
      }
      header.appendChild(cell);
    });
    list.appendChild(header);

    _rows.forEach((row, idx) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'opt-editor__row';

      const fields = [
        { key: 'code',   placeholder: 'code',           testid: testidPrefix + '-code-' + idx },
        { key: 'label',  placeholder: 'label',          testid: testidPrefix + '-label-' + idx },
        { key: 'score',  placeholder: 'score',          testid: testidPrefix + '-score-' + idx },
        { key: 'prefix', placeholder: 'prefix (e.g. A.)', testid: testidPrefix + '-prefix-' + idx },
      ];

      fields.forEach(({ key, placeholder, testid }) => {
        const cell = document.createElement('div');
        cell.className = 'opt-editor__cell';
        const inp = document.createElement('input');
        inp.type             = 'text';
        inp.value            = row[key];
        inp.placeholder      = placeholder;
        inp.dataset.testid   = testid;
        inp.autocomplete     = 'off';
        inp.addEventListener('input', () => {
          _rows[idx][key] = inp.value;
          onchange(_rows);
        });
        cell.appendChild(inp);
        rowEl.appendChild(cell);
      });

      // exclusive checkbox cell
      const exclCell = document.createElement('div');
      exclCell.className = 'opt-editor__cell opt-editor__cell--excl';
      const exclCb = document.createElement('input');
      exclCb.type            = 'checkbox';
      exclCb.checked         = !!row.exclusive;
      exclCb.dataset.testid  = testidPrefix + '-excl-' + idx;
      exclCb.addEventListener('change', () => {
        _rows[idx].exclusive = exclCb.checked;
        onchange(_rows);
      });
      exclCell.appendChild(exclCb);
      rowEl.appendChild(exclCell);

      // remove button cell
      const rmCell = document.createElement('div');
      rmCell.className = 'opt-editor__cell opt-editor__cell--rm';
      const rmBtn = document.createElement('button');
      rmBtn.type            = 'button';
      rmBtn.className       = 'opt-editor__rm-btn';
      rmBtn.dataset.testid  = testidPrefix + '-rm-' + idx;
      rmBtn.setAttribute('aria-label', 'Remove option');
      rmBtn.textContent     = '✕';
      rmBtn.addEventListener('click', () => {
        _rows.splice(idx, 1);
        _renderRows();
        onchange(_rows);
      });
      rmCell.appendChild(rmBtn);
      rowEl.appendChild(rmCell);

      list.appendChild(rowEl);
    });
  }

  _renderRows();

  return {
    el: wrap,
    getRows() { return _rows; },
    setRows(newRows) {
      _rows = newRows.map(r => ({ code: r.code || '', label: r.label || '', score: r.score ?? '', prefix: r.prefix || '', exclusive: !!r.exclusive }));
      _renderRows();
    },
  };
}
