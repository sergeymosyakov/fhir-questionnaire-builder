import { ItemSection } from './base-section.js';
import { ITEM_SECTIONS } from './registry.js';
import { makeCollapsible } from './helpers.js';
import { createCustomSelect } from '../custom-select.js';
import {
  EXT_VALUE_TYPES, EXT_COMPLEX, EXT_BOOL, EXT_INT, EXT_DEC,
  extToDraft, draftToExt,
} from './data.js';

class ExtensionsSection extends ItemSection {
  initPending(node) {
    return { unknownExtensions: (node._unknownExtensions || []).map(extToDraft) };
  }

  build(pending) {
    return makeCollapsible({
      testid:      'item-props-ext-toggle',
      tip:         { title: 'Custom extensions', body: 'Pass-through FHIR extensions not natively supported by the builder. Preserved as-is in the exported Questionnaire JSON.', fhir: 'Questionnaire.item.extension[]', spec: 'R4' },
      label:       'Extensions',
      countFn:     () => pending.unknownExtensions.filter(d => d.url.trim()).length,
      initialOpen: pending.unknownExtensions.length > 0,
      liveUpdate:  true,
      buildBody:   ({ el, setLabel }) => {
        const render = () => {
          el.innerHTML = '';

          if (pending.unknownExtensions.length === 0) {
            const empty = document.createElement('div');
            empty.className   = 'codes-empty-msg';
            empty.textContent = 'No custom extensions. Add one below.';
            el.appendChild(empty);
          }

          pending.unknownExtensions.forEach((draft, idx) => {
            const card = document.createElement('div');
            card.className = 'ext-card';

            // ── URL row ────────────────────────────────────────────────────
            const urlRow = document.createElement('div');
            urlRow.className = 'ext-url-row';

            const urlInp = document.createElement('input');
            urlInp.type           = 'text';
            urlInp.className      = 'ext-url-input';
            urlInp.placeholder    = 'http://example.com/fhir/StructureDefinition/ext-name';
            urlInp.dataset.testid = `item-props-ext-url-${idx}`;
            urlInp.value          = draft.url;
            urlInp.oninput = () => {
              pending.unknownExtensions[idx].url = urlInp.value;
              setLabel();
            };

            const rmBtn = document.createElement('button');
            rmBtn.type             = 'button';
            rmBtn.className        = 'codes-remove-btn';
            rmBtn.textContent      = '\u00D7';
            rmBtn.dataset.tipTitle = 'Remove';
            rmBtn.dataset.testid   = `item-props-ext-rm-${idx}`;
            rmBtn.onclick = () => {
              pending.unknownExtensions.splice(idx, 1);
              render();
              setLabel();
            };

            urlRow.append(urlInp, rmBtn);

            // ── Type row ───────────────────────────────────────────────────
            const typeRow = document.createElement('div');
            typeRow.className = 'ext-type-row';

            const typeLbl = document.createElement('span');
            typeLbl.className   = 'ext-field-lbl';
            typeLbl.textContent = 'Type';

            const typeItems = (EXT_VALUE_TYPES.includes(draft.valueType)
              ? EXT_VALUE_TYPES
              : [...EXT_VALUE_TYPES, draft.valueType]
            ).map(t => ({ value: t, label: EXT_COMPLEX.has(t) ? t + ' (JSON)' : t }));

            const typeSel = createCustomSelect({
              items:     typeItems,
              value:     draft.valueType,
              testid:    `item-props-ext-type-${idx}`,
              className: 'sc-trigger--sm ext-type-trigger',
            });

            typeRow.append(typeLbl, typeSel.el);

            // ── Value row ──────────────────────────────────────────────────
            const valRow = document.createElement('div');
            valRow.className = 'ext-val-row';

            const valLbl = document.createElement('span');
            valLbl.className   = 'ext-field-lbl';
            valLbl.textContent = 'Value';

            const valContainer = document.createElement('div');
            valContainer.className = 'ext-val-container';

            const renderVal = (valueType, valueRaw) => {
              valContainer.innerHTML = '';
              if (EXT_BOOL.has(valueType)) {
                const boolSel = createCustomSelect({
                  items:     [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }],
                  value:     valueRaw === 'false' ? 'false' : 'true',
                  testid:    `item-props-ext-val-${idx}`,
                  className: 'sc-trigger--sm',
                  onChange:  v => { pending.unknownExtensions[idx].valueRaw = v; },
                });
                valContainer.appendChild(boolSel.el);
              } else if (EXT_COMPLEX.has(valueType) || valueType === 'valueString') {
                const ta = document.createElement('textarea');
                ta.className      = 'ext-val-textarea';
                ta.rows           = EXT_COMPLEX.has(valueType) ? 3 : 1;
                ta.spellcheck     = false;
                ta.dataset.testid = `item-props-ext-val-${idx}`;
                ta.placeholder    = EXT_COMPLEX.has(valueType) ? 'JSON object\u2026' : 'value';
                ta.value          = valueRaw;
                ta.oninput = () => { pending.unknownExtensions[idx].valueRaw = ta.value; };
                valContainer.appendChild(ta);
              } else {
                const inp = document.createElement('input');
                inp.type           = (EXT_INT.has(valueType) || EXT_DEC.has(valueType)) ? 'number' : 'text';
                if (EXT_DEC.has(valueType)) inp.step = 'any';
                inp.className      = 'ext-val-input';
                inp.dataset.testid = `item-props-ext-val-${idx}`;
                inp.placeholder    = 'value';
                inp.value          = valueRaw;
                inp.oninput = () => { pending.unknownExtensions[idx].valueRaw = inp.value; };
                valContainer.appendChild(inp);
              }
            };

            renderVal(draft.valueType, draft.valueRaw);

            typeSel.setOnChange((newType) => {
              pending.unknownExtensions[idx].valueType = newType;
              pending.unknownExtensions[idx].valueRaw  = '';
              renderVal(newType, '');
            });

            valRow.append(valLbl, valContainer);
            card.append(urlRow, typeRow, valRow);
            el.appendChild(card);
          });

          const addBtn = document.createElement('button');
          addBtn.type           = 'button';
          addBtn.className      = 'codes-add-btn';
          addBtn.dataset.testid = 'item-props-ext-add';
          addBtn.textContent    = '+ Add extension';
          addBtn.onclick = () => {
            pending.unknownExtensions.push({ url: '', valueType: 'valueString', valueRaw: '' });
            render();
            setLabel();
            el.querySelector('[data-testid^="item-props-ext-url-"]:last-of-type')?.focus();
          };
          el.appendChild(addBtn);
        };
        render();
      },
    });
  }

  commit(pending, node) {
    const parsedExts = pending.unknownExtensions.map(draftToExt).filter(Boolean);
    if (parsedExts.length) node._unknownExtensions = parsedExts;
    else delete node._unknownExtensions;
  }
}

ITEM_SECTIONS.push(new ExtensionsSection());
