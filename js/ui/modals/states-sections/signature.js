import { StatesSection } from './base-section.js';
import { STATES_SECTIONS } from './registry.js';

const SIG_TYPES = [
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1',  display: "Author's Signature" },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.2',  display: "Coauthor's Signature" },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.3',  display: "Co-participant's Signature" },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.4',  display: 'Transcriptionist/Recorder Signature' },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.5',  display: 'Verification Signature' },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.6',  display: 'Validation Signature' },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.7',  display: 'Consent Signature' },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.8',  display: 'Signature Witness Signature' },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.9',  display: 'Event Witness Signature' },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.10', display: 'Identity Witness Signature' },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.11', display: 'Consent Witness Signature' },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.12', display: 'Interpreter Signature' },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.13', display: 'Review Signature' },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.14', display: 'Source Signature' },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.15', display: 'Addendum Signature' },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.16', display: 'Modification Signature' },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.17', display: 'Administrative (Error/Edit) Signature' },
  { system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.18', display: 'Timestamp Signature' },
  { system: 'http://uri.etsi.org/01903/v1.2.2', code: 'ProofOfOrigin',   display: 'Proof of origin' },
  { system: 'http://uri.etsi.org/01903/v1.2.2', code: 'ProofOfReceipt',  display: 'Proof of receipt' },
  { system: 'http://uri.etsi.org/01903/v1.2.2', code: 'ProofOfDelivery', display: 'Proof of delivery' },
  { system: 'http://uri.etsi.org/01903/v1.2.2', code: 'ProofOfSender',   display: 'Proof of sender' },
  { system: 'http://uri.etsi.org/01903/v1.2.2', code: 'ProofOfapproval', display: 'Proof of approval' },
  { system: 'http://uri.etsi.org/01903/v1.2.2', code: 'ProofOfCreation', display: 'Proof of creation' },
];

class SignatureSection extends StatesSection {
  initPending(node) {
    return { draftSignatures: node._signatureRequired ? node._signatureRequired.map(s => ({ ...s })) : [] };
  }

  build(pending) {
    const wrap = document.createElement('div');
    wrap.className = 'states-modal-field-row';
    wrap.style.flexWrap = 'wrap';

    const lbl = document.createElement('label');
    lbl.className        = 'states-modal-chk-label';
    lbl.textContent      = 'Signature required:';
    lbl.dataset.tipTitle = 'questionnaire-signatureRequired';
    lbl.dataset.tipBody  = 'Indicates that a digital signature of the specified type is required when completing the response. Multiple types may be selected.';
    lbl.dataset.tipFhir  = 'item.extension[questionnaire-signatureRequired].valueCodeableConcept';
    lbl.dataset.tipSpec  = 'R4';

    const chipWrap = document.createElement('div');
    chipWrap.style.cssText = 'flex-basis:100%;display:flex;flex-wrap:wrap;gap:4px;margin-top:4px';

    const _refresh = () => {
      chipWrap.innerHTML = '';
      for (const sig of pending.draftSignatures) {
        const chip = document.createElement('span');
        chip.className = 'subtype-chip';
        chip.textContent = sig.display || sig.code;
        const rm = document.createElement('span');
        rm.className = 'subtype-chip-rm';
        rm.textContent = '\u00D7';
        rm.addEventListener('click', () => {
          pending.draftSignatures = pending.draftSignatures.filter(s => s.code !== sig.code);
          _refresh();
        });
        chip.appendChild(rm);
        chipWrap.appendChild(chip);
      }
    };
    _refresh();

    const addRow = document.createElement('div');
    addRow.style.cssText = 'flex-basis:100%;margin-top:4px';

    const sel = document.createElement('select');
    sel.dataset.testid = 'sig-type-sel';
    sel.style.cssText = 'font-size:12px;padding:2px 4px;max-width:300px';
    const defOpt = document.createElement('option');
    defOpt.value = '';
    defOpt.textContent = '+ Add signature type…';
    sel.appendChild(defOpt);
    for (const t of SIG_TYPES) {
      const opt = document.createElement('option');
      opt.value = t.code;
      opt.textContent = t.display;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      if (!sel.value) return;
      const found = SIG_TYPES.find(t => t.code === sel.value);
      if (found && !pending.draftSignatures.some(s => s.code === found.code)) {
        pending.draftSignatures.push({ ...found });
        _refresh();
      }
      sel.value = '';
    });
    addRow.appendChild(sel);

    wrap.append(lbl, chipWrap, addRow);
    return wrap;
  }

  commit(pending, node) {
    if (pending.draftSignatures.length) {
      node._signatureRequired = pending.draftSignatures.map(s => ({ ...s }));
    } else {
      delete node._signatureRequired;
    }
  }
}

STATES_SECTIONS.push(new SignatureSection());
