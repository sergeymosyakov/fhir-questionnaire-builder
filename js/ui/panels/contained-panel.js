// ── Contained Resources panel ─────────────────────────────────────────────────
// Collapsible editable card for Questionnaire.contained[] items.
// Add/edit a resource via a raw-JSON modal; each chip opens the JSON viewer.
import { AppEvents, EventState } from '../../events.js';
import { Panel } from './panel-base.js';
import { containedResourceModal } from '../modals/contained-resource-modal.js';

class ContainedPanel extends Panel {
  constructor() {
    super({
      mod:      'contained',
      idPrefix: 'containedCard',
      label:    'Contained',
      tipTitle: 'Contained Resources',
      tipBody:  'Questionnaire.contained[] — inline FHIR resources bundled inside the questionnaire (e.g. ValueSet definitions). Add or edit them here; referenced from items via #id.',
      tipFhir:  'Questionnaire.contained[]',
      tipSpec:  'R4 · optional',
    });
    this._questDoc = EventState.get(AppEvents.APP_CONTEXT_READY)?.questDoc ?? null;
    this._modal = containedResourceModal;
    this._buildAddButton();

    document.addEventListener(AppEvents.APP_CONTEXT_READY, e => {
      this._questDoc = e.detail?.questDoc ?? this._questDoc;
    });
    document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED, e => {
      this._questDoc = e.detail?.questDoc ?? EventState.get(AppEvents.APP_CONTEXT_READY)?.questDoc ?? this._questDoc;
      this._card.style.display = '';
      this.refresh();
    });
    document.addEventListener(AppEvents.QUESTIONNAIRE_NEW, () => {
      this._card.style.display = '';
      this.refresh();
    });
    document.addEventListener(AppEvents.QUESTIONNAIRE_CLEARED, () => {
      this._card.style.display = 'none';
    });
  }

  _buildAddButton() {
    const header = this._card.querySelector('.fhir-res-card-header');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fhir-res-add-btn';
    btn.dataset.testid = 'contained-add-btn';
    btn.textContent = '+ Add';
    btn.dataset.tipTitle = 'Add contained resource';
    btn.dataset.tipBody  = 'Paste a FHIR resource (e.g. a ValueSet) to embed in Questionnaire.contained[].';
    btn.addEventListener('click', () => this._openEditor(null));
    header.appendChild(btn);
  }

  _openEditor(index) {
    const arr = this._questDoc?.contained ?? [];
    const editing = index != null;
    const resource = editing ? arr[index] : null;
    this._modal.open({
      json:  editing ? JSON.stringify(resource, null, 2) : '',
      title: editing ? 'Edit contained resource' : 'Add contained resource',
      onCommit: obj => this._commit(index, obj),
    });
  }

  // Returns an error string to keep the modal open, or null on success.
  _commit(index, obj) {
    const arr = (this._questDoc.contained ??= []);
    if (obj.id) {
      const dup = arr.findIndex((r, i) => i !== index && r?.id === obj.id);
      if (dup >= 0) return `A contained resource with id "${obj.id}" already exists.`;
    }
    if (index == null) arr.push(obj);
    else arr.splice(index, 1, obj);
    this.refresh();
    return null;
  }

  _remove(index) {
    const arr = this._questDoc?.contained;
    if (!arr) return;
    arr.splice(index, 1);
    this.refresh();
  }

  refresh() {
    const count = this._questDoc?.contained?.length ?? 0;
    this._count.textContent   = count > 0 ? String(count) : '';
    this._count.style.display = count > 0 ? '' : 'none';
    this._renderChips();
  }

  _renderChips() {
    this._chipList.innerHTML = '';
    const arr = this._questDoc?.contained ?? [];
    if (arr.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'fhir-res-empty';
      empty.dataset.testid = 'contained-empty';
      empty.textContent = 'No contained resources. Use \u201C+ Add\u201D.';
      this._chipList.appendChild(empty);
      return;
    }
    arr.forEach((resource, index) => {
      const rType = resource.resourceType || 'Resource';
      const rId   = resource.id           || '';
      const label = rId ? `${rType}/${rId}` : rType;

      const entry = document.createElement('span');
      entry.className = 'fhir-res-entry';

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'fhir-res-chip fhir-res-chip--contained';
      chip.textContent = label;
      chip.dataset.tipTitle = label;
      chip.dataset.tipBody  = `View the raw JSON of this contained ${rType}.`;
      chip.dataset.tipFhir  = rId ? `Questionnaire.contained[id="${rId}"]` : 'Questionnaire.contained[]';
      chip.dataset.tipSpec  = 'R4 · optional';
      chip.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent(AppEvents.SHOW_JSON, { detail: { title: label, data: resource } }));
      });

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'fhir-res-mini';
      edit.dataset.testid = `contained-edit-${index}`;
      edit.textContent = '\u270E';
      edit.dataset.tipTitle = 'Edit';
      edit.dataset.tipBody  = 'Edit this contained resource JSON.';
      edit.addEventListener('click', () => this._openEditor(index));

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'fhir-res-mini fhir-res-mini--rm';
      rm.dataset.testid = `contained-remove-${index}`;
      rm.textContent = '\u2715';
      rm.dataset.tipTitle = 'Remove';
      rm.dataset.tipBody  = 'Remove this contained resource.';
      rm.addEventListener('click', () => this._remove(index));

      entry.append(chip, edit, rm);
      this._chipList.appendChild(entry);
    });
  }
}

export default new ContainedPanel();
