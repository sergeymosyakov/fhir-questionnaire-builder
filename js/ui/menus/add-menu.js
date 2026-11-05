// ── Add menu (+) ──────────────────────────────────────────────────────────────
// Tree-toolbar menu: add an empty root group, or insert a library template at root.
import { DropdownMenu } from '../dropdown-menu.js';
import { AppEvents } from '../../events.js';

export class AddMenu extends DropdownMenu {
  constructor() {
    super({
      btnId:    'addMenuBtn',
      menuId:   'addMenu',
      label:    '+ Add &#x25BE;',
      menuTitle: 'Add',
      btnClass: 'btn-add-root',
      testid:   'add-menu-btn',
      tipTitle: 'Add',
      tipBody:  'Add a new top-level group at the end of the questionnaire, or insert a ready-made template (a group of questions with its calculations).',
      tipFhir:  'Questionnaire.item[type=group]',
      tipSpec:  'R4 · required',
    });

    const rootGroup = this._item(null, 'Root group', 'add-root-group-btn');
    rootGroup.dataset.tipTitle = 'Add Root Group';
    rootGroup.dataset.tipBody  = 'Creates a new top-level group at the end of the questionnaire. Groups can contain items and other nested groups.';
    rootGroup.dataset.tipFhir  = 'Questionnaire.item[type=group]';
    rootGroup.dataset.tipSpec  = 'R4 · required';
    rootGroup.addEventListener('click', () => {
      this.close();
      document.dispatchEvent(new CustomEvent(AppEvents.ROOT_GROUP_ADD_REQUESTED));
    });

    const template = this._item(null, 'From template&hellip;', 'add-template-btn');
    template.dataset.tipTitle = 'Insert template';
    template.dataset.tipBody  = 'Pick a ready-made template and add it as a new top-level group.';
    template.addEventListener('click', () => {
      this.close();
      document.dispatchEvent(new CustomEvent(AppEvents.NODE_INSERT_TEMPLATE_REQUESTED, { detail: { id: null } }));
    });

    this._menu.append(rootGroup, template);

    document.querySelector('[data-mount="add-menu"]')?.replaceWith(this.el);
  }
}

if (typeof document !== 'undefined') new AddMenu();
