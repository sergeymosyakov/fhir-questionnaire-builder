import { StatesSection } from './base-section.js';
import { STATES_SECTIONS } from './registry.js';
import { createCustomSelect } from '../../custom-select.js';

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
    wrap.className = 'states-modal-field-row states-sig-wrap';

    const lbl = document.createElement('label');
    lbl.className        = 'states-modal-chk-label';
    lbl.textContent      = 'Signature required:';
    lbl.dataset.tipTitle = 'questionnaire-signatureRequired';
    lbl.dataset.tipBody  = 'Indicates that a digital signature of the specified type is required when completing the response. Multiple types may be selected.';
    lbl.dataset.tipFhir  = 'item.extension[questionnaire-signatureRequired].valueCodeableConcept';
    lbl.dataset.tipSpec  = 'R4';

    const chipWrap = document.createElement('div');
    chipWrap.className = 'states-sig-chips';

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
    addRow.className = 'states-sig-add-row';

    const sigItems = [
      { value: '', label: '+ Add signature type\u2026' },
      ...SIG_TYPES.map(t => ({ value: t.code, label: t.display })),
    ];
    const csel = createCustomSelect({
      items: sigItems,
      value: '',
      testid: 'sig-type-sel',
      onChange: v => {
        if (!v) return;
        const found = SIG_TYPES.find(t => t.code === v);
        if (found && !pending.draftSignatures.some(s => s.code === found.code)) {
          pending.draftSignatures.push({ ...found });
          _refresh();
        }
        csel.setValue('');
      },
    });
    addRow.appendChild(csel.el);

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

  buildPatch(pending, _node) {
    return {
      _signatureRequired: pending.draftSignatures.length
        ? pending.draftSignatures.map(s => ({ ...s }))
        : null,
    };
  }
}

STATES_SECTIONS.push(new SignatureSection());
