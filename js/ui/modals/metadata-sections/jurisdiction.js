import { Section } from '../section.js';
import { META_SECTIONS } from './registry.js';
import { makeCollapsible } from './helpers.js';

class JurisdictionSection extends Section {
  build(pending) {
    return makeCollapsible({
      testid:      'meta-jurisdiction-toggle',
      tip:         { title: 'Questionnaire.jurisdiction', body: 'Intended jurisdiction for this questionnaire. Coded as system/code/display (e.g. urn:iso:std:iso:3166 / US). Full CodeableConcept structure is preserved on round-trip; only coding[0] is shown and editable.', fhir: 'Questionnaire.jurisdiction', spec: 'R4' },
      label:       'Jurisdiction',
      countFn:     () => pending.jurisdictions.filter(jur => jur.coding?.[0]?.code?.trim()).length,
      initialOpen: pending.jurisdictions.length > 0,
      liveUpdate:  true,
      buildBody:   ({ el, setLabel }) => {
        const render = () => {
          el.innerHTML = '';
          if (pending.jurisdictions.length === 0) {
            const empty = document.createElement('div');
            empty.className   = 'codes-empty-msg';
            empty.textContent = 'No jurisdictions. Click \u2018+ Add jurisdiction\u2019 to add one.';
            el.appendChild(empty);
          }
          pending.jurisdictions.forEach((jur, idx) => {
            if (!jur.coding)    jur.coding    = [{}];
            if (!jur.coding[0]) jur.coding[0] = {};
            const c = jur.coding[0];
            const row = document.createElement('div');
            row.className = 'codes-row';
            const mkInp = (placeholder, field) => {
              const inp = document.createElement('input');
              inp.type           = 'text';
              inp.className      = 'codes-inp';
              inp.value          = c[field] || '';
              inp.placeholder    = placeholder;
              inp.dataset.testid = `meta-jurisdiction-${field}-${idx}`;
              inp.oninput = () => { c[field] = inp.value; setLabel(); };
              return inp;
            };
            row.append(mkInp('system URL', 'system'), mkInp('code *', 'code'), mkInp('display', 'display'));
            const rm = document.createElement('button');
            rm.type           = 'button';
            rm.className      = 'codes-remove-btn';
            rm.textContent    = '\u00D7';
            rm.dataset.testid = `meta-jurisdiction-remove-${idx}`;
            rm.onclick = () => { pending.jurisdictions.splice(idx, 1); render(); setLabel(); };
            row.appendChild(rm);
            el.appendChild(row);
          });
          const addBtn = document.createElement('button');
          addBtn.type           = 'button';
          addBtn.className      = 'codes-add-btn';
          addBtn.dataset.testid = 'meta-jurisdictions-add-btn';
          addBtn.textContent    = '+ Add jurisdiction';
          addBtn.onclick = () => {
            pending.jurisdictions.push({ coding: [{ system: '', code: '', display: '' }] });
            render(); setLabel();
          };
          el.appendChild(addBtn);
        };
        render();
      },
    });
  }
}

META_SECTIONS.push(new JurisdictionSection());
