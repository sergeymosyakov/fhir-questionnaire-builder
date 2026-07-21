import { Section } from '../section.js';
import { META_SECTIONS } from './registry.js';
import { makeCollapsible } from './helpers.js';
import { FHIR } from '../../../fhir/urls/fhir.js';
import { EXAMPLE_URL } from '../../../fhir/urls/examples.js';

function buildUrlList(pending, key, { emptyText, placeholder, testidPrefix, addLabel }) {
  return ({ el, setLabel, expand }) => {
    const render = () => {
      el.innerHTML = '';
      if (pending[key].length === 0) {
        const empty = document.createElement('div');
        empty.className   = 'codes-empty-msg';
        empty.textContent = emptyText;
        el.appendChild(empty);
      }
      pending[key].forEach((url, idx) => {
        const row = document.createElement('div');
        row.className = 'codes-row';
        const inp = document.createElement('input');
        inp.type           = 'url';
        inp.className      = 'codes-inp';
        inp.value          = url;
        inp.placeholder    = placeholder;
        inp.dataset.testid = `${testidPrefix}-url-${idx}`;
        inp.oninput = () => { pending[key][idx] = inp.value; setLabel(); };
        const rm = document.createElement('button');
        rm.type            = 'button';
        rm.className       = 'codes-remove-btn';
        rm.textContent     = '\u00D7';
        rm.dataset.testid  = `${testidPrefix}-remove-${idx}`;
        rm.onclick = () => { pending[key].splice(idx, 1); render(); setLabel(); };
        row.append(inp, rm);
        el.appendChild(row);
      });
      const addBtn = document.createElement('button');
      addBtn.type           = 'button';
      addBtn.className      = 'codes-add-btn';
      addBtn.textContent    = addLabel;
      addBtn.dataset.testid = `${testidPrefix}-add-btn`;
      addBtn.onclick = () => { pending[key].push(''); expand(); render(); setLabel(); };
      el.appendChild(addBtn);
    };
    render();
  };
}

class ReplacesSection extends Section {
  build(pending) {
    return makeCollapsible({
      testid:      'meta-replaces-toggle',
      tip:         { title: 'replaces extension', body: 'Canonical URLs of questionnaires that this questionnaire supersedes. Each URL will be written as a separate replaces extension entry.', fhir: FHIR.replaces, spec: 'R4' },
      label:       'Replaces',
      countFn:     () => pending.replaces.filter(u => u.trim()).length,
      initialOpen: pending.replaces.length > 0,
      buildBody:   buildUrlList(pending, 'replaces', {
        emptyText:    'No replaced questionnaire URLs. Click \u2018+ Add URL\u2019 to add one.',
        placeholder:  EXAMPLE_URL.canonicalPrior,
        testidPrefix: 'meta-replaces',
        addLabel:     '+ Add URL',
      }),
    });
  }
}

META_SECTIONS.push(new ReplacesSection());
