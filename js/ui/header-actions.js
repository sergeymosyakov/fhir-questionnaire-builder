// ── Header action menus ───────────────────────────────────────────────────────
// Creates and mounts all five preview-header-actions dropdowns into #headerActions.
// Imported as a side-effect at the top of app.js so the elements exist before
// initPreview() resolves IDs like 'viewOptionsWrap', 'previewModeWrap', etc.

import { QuestionnairesMenu } from './menus/questionnaires-menu.js';
import { AnswersMenu }        from './menus/answers-menu.js';
import { SaveMenu }           from './menus/save-menu.js';
import { PreviewModeMenu }    from './menus/preview-mode-menu.js';
import { ViewOptionsMenu }    from './menus/view-options-menu.js';
import { ToolsMenu }          from './menus/tools-menu.js';

export const questionnairesMenu = new QuestionnairesMenu();
export const answersMenu        = new AnswersMenu();
export const saveMenu           = new SaveMenu();
export const previewModeMenu    = new PreviewModeMenu();
export const viewOptionsMenu    = new ViewOptionsMenu();
export const toolsMenu          = new ToolsMenu();

export function mount(wrap) {
  [questionnairesMenu, answersMenu, saveMenu, previewModeMenu, viewOptionsMenu, toolsMenu]
    .forEach(m => wrap.appendChild(m.el));
}
