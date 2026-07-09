import { Section } from '../section.js';
import { META_SECTIONS } from './registry.js';
import { makeCollapsible } from './helpers.js';
import { createCustomSelect } from '../../custom-select.js';

const LC_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-launchContext';

// Standard SDC launch-context names with their typical resource type.
const COMMON_NAMES = [
  { value: 'patient',   label: 'patient — %patient',   type: 'Patient'   },
  { value: 'user',      label: 'user — %user',          type: 'Practitioner' },
  { value: 'encounter', label: 'encounter — %encounter',type: 'Encounter' },
  { value: 'location',  label: 'location — %location',  type: 'Location'  },
  { value: 'study',     label: 'study — %study',        type: 'ResearchStudy' },
];

const COMMON_TYPES = [
  'Patient','Practitioner','PractitionerRole','RelatedPerson',
  'Encounter','Location','Organization','Group','ResearchStudy',
];

class LaunchContextSection extends Section {
  build(pending) {
    return makeCollapsible({
      testid:      'meta-launch-ctx-toggle',
      tip: {
        title: 'sdc-questionnaire-launchContext',
        body:  'Declares named runtime contexts (%patient, %user, %encounter, …) that the questionnaire expects at launch time. SDC servers use these to pre-populate the form via $populate.',
        fhir:  'Questionnaire.extension[sdc-questionnaire-launchContext]',
        spec:  'SDC',
      },
      label:       'Launch Context',
      countFn:     () => pending.launchContexts.filter(lc => lc.name.trim()).length,
      initialOpen: pending.launchContexts.length > 0,
      buildBody:   ({ el, setLabel, expand }) => {
        const render = () => {
          el.innerHTML = '';
          if (pending.launchContexts.length === 0) {
            const empty = document.createElement('div');
            empty.className   = 'codes-empty-msg';
            empty.textContent = 'No launch contexts declared.';
            el.appendChild(empty);
          }
          pending.launchContexts.forEach((lc, idx) => {
            el.appendChild(_buildRow(lc, idx, pending, render, setLabel));
          });
          const addBtn = document.createElement('button');
          addBtn.type           = 'button';
          addBtn.className      = 'codes-add-btn';
          addBtn.textContent    = '+ Add context';
          addBtn.dataset.testid = 'meta-lc-add-btn';
          addBtn.onclick = () => {
            pending.launchContexts.push({ name: '', type: '', description: '' });
            expand();
            render();
            setLabel();
          };
          el.appendChild(addBtn);
        };
        render();
      },
    });
  }
}

function _buildRow(lc, idx, pending, render, setLabel) {
  const row = document.createElement('div');
  row.className = 'lc-row';
  row.dataset.testid = `meta-lc-row-${idx}`;

  // Name selector (custom select)
  const nameSel = createCustomSelect({
    items: [
      { value: '', label: '— custom —' },
      ...COMMON_NAMES.map(n => ({ value: n.value, label: n.label })),
    ],
    value:    COMMON_NAMES.some(n => n.value === lc.name) ? lc.name : '',
    className: 'sc-trigger--sm',
    testid:   `meta-lc-name-sel-${idx}`,
    onChange:  v => {
      if (v) {
        lc.name = v;
        const preset = COMMON_NAMES.find(n => n.value === v);
        if (!lc.type && preset) {
          lc.type = preset.type;
          typeInp.value = preset.type;
        }
        nameInp.value = '';
      }
      setLabel();
    },
  });

  const nameInp = document.createElement('input');
  nameInp.type           = 'text';
  nameInp.className      = 'codes-inp';
  nameInp.placeholder    = 'custom name';
  nameInp.value          = COMMON_NAMES.some(n => n.value === lc.name) ? '' : lc.name;
  nameInp.dataset.testid = `meta-lc-name-inp-${idx}`;
  nameInp.oninput = () => {
    lc.name = nameInp.value.trim();
    nameSel.setValue('');
    setLabel();
  };

  const typeInp = document.createElement('input');
  typeInp.type           = 'text';
  typeInp.className      = 'codes-inp';
  typeInp.placeholder    = 'type (e.g. Patient)';
  typeInp.value          = lc.type;
  typeInp.dataset.testid = `meta-lc-type-${idx}`;
  typeInp.setAttribute('list', 'lc-type-list');
  typeInp.oninput = () => { lc.type = typeInp.value.trim(); };

  // shared datalist for type suggestions (created once per render pass)
  if (!document.getElementById('lc-type-list')) {
    const dl = document.createElement('datalist');
    dl.id = 'lc-type-list';
    COMMON_TYPES.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      dl.appendChild(opt);
    });
    document.body.appendChild(dl);
  }

  const descInp = document.createElement('input');
  descInp.type           = 'text';
  descInp.className      = 'codes-inp';
  descInp.placeholder    = 'description (optional)';
  descInp.value          = lc.description;
  descInp.dataset.testid = `meta-lc-desc-${idx}`;
  descInp.oninput = () => { lc.description = descInp.value; };

  const rm = document.createElement('button');
  rm.type            = 'button';
  rm.className       = 'codes-remove-btn';
  rm.textContent     = '\u00D7';
  rm.dataset.testid  = `meta-lc-remove-${idx}`;
  rm.onclick = () => { pending.launchContexts.splice(idx, 1); render(); setLabel(); };

  row.append(nameSel.el, nameInp, typeInp, descInp, rm);
  return row;
}

META_SECTIONS.push(new LaunchContextSection());
export { LC_URL };
