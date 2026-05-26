import { Section } from '../section.js';
import { META_SECTIONS } from './registry.js';
import { makeCollapsible } from './helpers.js';
import { createCustomSelect } from '../../custom-select.js';
import { TELECOM_SYSTEMS } from './data.js';

class ContactSection extends Section {
  build(pending) {
    return makeCollapsible({
      testid:      'meta-contact-toggle',
      tip:         { title: 'Questionnaire.contact', body: 'Contact details for the publisher. Typically the author\u2019s name and email or URL.', fhir: 'Questionnaire.contact', spec: 'R4' },
      label:       'Contact',
      countFn:     () => pending.contacts.filter(c => c.name?.trim() || c.telecom?.some(t => t.value?.trim())).length,
      initialOpen: pending.contacts.length > 0,
      liveUpdate:  true,
      buildBody:   ({ el, setLabel, expand }) => {
        const render = () => {
          el.innerHTML = '';
          if (pending.contacts.length === 0) {
            const empty = document.createElement('div');
            empty.className   = 'codes-empty-msg';
            empty.textContent = 'No contacts. Click \u2018+ Add Contact\u2019 to add one.';
            el.appendChild(empty);
          }
          pending.contacts.forEach((contact, ci) => {
            const block = document.createElement('div');
            block.className = 'contact-block';

            const nameRow = document.createElement('div');
            nameRow.className = 'codes-row';
            const nameInp = document.createElement('input');
            nameInp.type           = 'text';
            nameInp.className      = 'codes-inp';
            nameInp.value          = contact.name || '';
            nameInp.placeholder    = 'Contact name';
            nameInp.dataset.testid = `meta-contact-name-${ci}`;
            nameInp.oninput = () => { contact.name = nameInp.value; setLabel(); };
            const rmContact = document.createElement('button');
            rmContact.type           = 'button';
            rmContact.className      = 'codes-remove-btn';
            rmContact.textContent    = '\u00D7';
            rmContact.dataset.testid = `meta-contact-remove-${ci}`;
            rmContact.onclick = () => { pending.contacts.splice(ci, 1); render(); setLabel(); };
            nameRow.append(nameInp, rmContact);
            block.appendChild(nameRow);

            const telecoms = contact.telecom || (contact.telecom = []);
            telecoms.forEach((tel, ti) => {
              const telRow = document.createElement('div');
              telRow.className = 'codes-row telecom-row';
              const sysSel = createCustomSelect({
                items:     TELECOM_SYSTEMS.map(s => ({ value: s, label: s })),
                value:     tel.system || 'email',
                testid:    `meta-contact-${ci}-tel-sys-${ti}`,
                className: 'sc-trigger--sm',
                onChange:  v => { tel.system = v; },
              });
              const valInp = document.createElement('input');
              valInp.type           = 'text';
              valInp.className      = 'codes-inp';
              valInp.value          = tel.value || '';
              valInp.placeholder    = 'value';
              valInp.dataset.testid = `meta-contact-${ci}-tel-val-${ti}`;
              valInp.oninput = () => { tel.value = valInp.value; setLabel(); };
              const rmTel = document.createElement('button');
              rmTel.type           = 'button';
              rmTel.className      = 'codes-remove-btn';
              rmTel.textContent    = '\u00D7';
              rmTel.dataset.testid = `meta-contact-${ci}-tel-remove-${ti}`;
              rmTel.onclick = () => { telecoms.splice(ti, 1); render(); setLabel(); };
              telRow.append(sysSel.el, valInp, rmTel);
              block.appendChild(telRow);
            });

            const addTelBtn = document.createElement('button');
            addTelBtn.type           = 'button';
            addTelBtn.className      = 'codes-add-btn codes-add-btn--sub';
            addTelBtn.textContent    = '+ Add telecom';
            addTelBtn.dataset.testid = `meta-contact-${ci}-add-tel`;
            addTelBtn.onclick = () => { telecoms.push({ system: 'email', value: '' }); render(); };
            block.appendChild(addTelBtn);
            el.appendChild(block);
          });

          const addBtn = document.createElement('button');
          addBtn.type           = 'button';
          addBtn.className      = 'codes-add-btn';
          addBtn.textContent    = '+ Add Contact';
          addBtn.dataset.testid = 'meta-contact-add-btn';
          addBtn.onclick = () => {
            pending.contacts.push({ name: '', telecom: [{ system: 'email', value: '' }] });
            expand(); render(); setLabel();
          };
          el.appendChild(addBtn);
        };
        render();
      },
    });
  }
}

META_SECTIONS.push(new ContactSection());
