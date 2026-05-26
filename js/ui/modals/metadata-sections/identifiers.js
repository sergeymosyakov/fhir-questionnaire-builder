import { Section } from '../section.js';
import { META_SECTIONS } from './registry.js';
import { makeCollapsible } from './helpers.js';
import { createCustomSelect } from '../../custom-select.js';
import { ID_USES, ID_USE_LABELS } from './data.js';

class IdentifiersSection extends Section {
  build(pending) {
    return makeCollapsible({
      testid:      'meta-identifiers-toggle',
      tip:         { title: 'Questionnaire.identifier', body: 'Business identifiers for this questionnaire \u2014 NamingSystem + value pairs used by EHR systems to look up questionnaires by external ID. Required by some IG profiles.', fhir: 'Questionnaire.identifier', spec: 'R4' },
      label:       'Identifiers',
      countFn:     () => pending.identifiers.filter(i => i.system?.trim() || i.value?.trim()).length,
      initialOpen: pending.identifiers.length > 0,
      buildBody:   ({ el, setLabel, expand }) => {
        const render = () => {
          el.innerHTML = '';
          if (pending.identifiers.length === 0) {
            const empty = document.createElement('div');
            empty.className   = 'codes-empty-msg';
            empty.textContent = 'No identifiers. Click \u2018+ Add Identifier\u2019 to add one.';
            el.appendChild(empty);
          }
          pending.identifiers.forEach((ident, idx) => {
            const row = document.createElement('div');
            row.className = 'codes-row identifier-row';

            const useSel = createCustomSelect({
              items:     ID_USES.map((u, i) => ({ value: u, label: ID_USE_LABELS[i] })),
              value:     ident.use || '',
              testid:    `meta-identifier-use-${idx}`,
              className: 'sc-trigger--sm',
              onChange:  v => { if (v) ident.use = v; else delete ident.use; setLabel(); },
            });

            const sysInp = document.createElement('input');
            sysInp.type           = 'url';
            sysInp.className      = 'codes-inp';
            sysInp.value          = ident.system || '';
            sysInp.placeholder    = 'http://example.org/ids';
            sysInp.dataset.testid = `meta-identifier-system-${idx}`;
            sysInp.oninput = () => { ident.system = sysInp.value; setLabel(); };

            const valInp = document.createElement('input');
            valInp.type           = 'text';
            valInp.className      = 'codes-inp';
            valInp.value          = ident.value || '';
            valInp.placeholder    = 'e.g. Q001';
            valInp.dataset.testid = `meta-identifier-value-${idx}`;
            valInp.oninput = () => { ident.value = valInp.value; setLabel(); };

            const rm = document.createElement('button');
            rm.type           = 'button';
            rm.className      = 'codes-remove-btn';
            rm.textContent    = '\u00D7';
            rm.dataset.testid = `meta-identifier-remove-${idx}`;
            rm.onclick = () => { pending.identifiers.splice(idx, 1); render(); setLabel(); };

            row.append(useSel.el, sysInp, valInp, rm);
            el.appendChild(row);
          });

          const addBtn = document.createElement('button');
          addBtn.type           = 'button';
          addBtn.className      = 'codes-add-btn';
          addBtn.textContent    = '+ Add Identifier';
          addBtn.dataset.testid = 'meta-identifier-add-btn';
          addBtn.onclick = () => { pending.identifiers.push({ system: '', value: '' }); expand(); render(); setLabel(); };
          el.appendChild(addBtn);
        };
        render();
      },
    });
  }
}

META_SECTIONS.push(new IdentifiersSection());
