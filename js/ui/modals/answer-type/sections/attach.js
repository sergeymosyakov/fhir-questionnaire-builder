import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';

class AttachSection extends AnswerTypeSection {
  isVisible(type) { return type === 'attachment'; }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const maxSizeLbl = document.createElement('div');
    maxSizeLbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    maxSizeLbl.textContent      = 'Max file size (MB):';
    maxSizeLbl.dataset.tipTitle = 'Maximum file size';
    maxSizeLbl.dataset.tipBody  = 'Maximum allowed file size in megabytes. Validated when the user selects a file in preview. Exported as the maxSize FHIR extension (valueDecimal).';
    maxSizeLbl.dataset.tipFhir  = 'item.extension[maxSize].valueDecimal';
    maxSizeLbl.dataset.tipSpec  = 'R4';

    const maxSizeInp = document.createElement('input');
    maxSizeInp.type           = 'number';
    maxSizeInp.min            = '0.01';
    maxSizeInp.step           = 'any';
    maxSizeInp.className      = 'at-modal-num-inp';
    maxSizeInp.dataset.testid = 'max-file-size-input';
    maxSizeInp.value          = pending.draftMaxFileSizeMB;
    maxSizeInp.placeholder    = 'e.g. 5';
    maxSizeInp.oninput = () => { pending.draftMaxFileSizeMB = maxSizeInp.value; };

    const mimeTypesLbl = document.createElement('div');
    mimeTypesLbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    mimeTypesLbl.textContent      = 'Allowed MIME types:';
    mimeTypesLbl.dataset.tipTitle = 'Allowed MIME types';
    mimeTypesLbl.dataset.tipBody  = 'Comma-separated list of accepted MIME types (e.g. image/jpeg, application/pdf). Sets the accept attribute on the file input. Exported as one mimeType extension entry per value.';
    mimeTypesLbl.dataset.tipFhir  = 'item.extension[mimeType].valueCode';
    mimeTypesLbl.dataset.tipSpec  = 'R4';

    const mimeTypesInp = document.createElement('input');
    mimeTypesInp.type           = 'text';
    mimeTypesInp.className      = 'at-modal-placeholder-inp';
    mimeTypesInp.dataset.testid = 'mime-types-input';
    mimeTypesInp.value          = pending.draftMimeTypes;
    mimeTypesInp.placeholder    = 'e.g. image/*,application/pdf';
    mimeTypesInp.oninput = () => { pending.draftMimeTypes = mimeTypesInp.value; };

    section.append(maxSizeLbl, maxSizeInp, mimeTypesLbl, mimeTypesInp);
    return section;
  }

  commit(pending, node) {
    if (node.itemType === 'attachment' && pending.draftMaxFileSizeMB !== '') {
      const mb = parseFloat(pending.draftMaxFileSizeMB);
      if (!isNaN(mb) && mb > 0) node._maxFileSizeMB = mb; else delete node._maxFileSizeMB;
    } else {
      delete node._maxFileSizeMB;
    }

    if (node.itemType === 'attachment') {
      const mimes = pending.draftMimeTypes.split(',').map(s => s.trim()).filter(s => s.length > 0);
      if (mimes.length) node._mimeTypes = mimes; else delete node._mimeTypes;
    } else {
      delete node._mimeTypes;
    }
  }

  initPending(node) {
    return {
      draftMaxFileSizeMB: node._maxFileSizeMB !== undefined ? String(node._maxFileSizeMB) : '',
      draftMimeTypes:     node._mimeTypes ? node._mimeTypes.join(', ') : '',
    };
  }
}

ANSWER_TYPE_SECTIONS.push(new AttachSection());
