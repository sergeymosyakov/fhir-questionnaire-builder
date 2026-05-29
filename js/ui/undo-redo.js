// ── Undo / Redo control ───────────────────────────────────────────────────────
// Wires undo/redo buttons and Ctrl+Z / Ctrl+Y keyboard shortcuts.
// Initialises the history module with the required build/import/render functions.
import * as history from './history.js';
import { buildFHIRObject } from '../fhir/export.js';
import { importFHIR } from '../fhir/import.js';
import { renderTree } from '../builder/index.js';

export class UndoRedo {
  /**
   * @param {HTMLElement} undoBtn
   * @param {HTMLElement} redoBtn
   */
  constructor(undoBtn, redoBtn) {
    this._undoBtn = undoBtn;
    this._redoBtn = redoBtn;

    history.init({
      buildFn:  buildFHIRObject,
      importFn: importFHIR,
      renderFn: renderTree,
      onChange: () => this._sync(),
    });

    this._bind();
    this._sync();
  }

  _sync() {
    this._undoBtn.disabled = !history.canUndo();
    this._redoBtn.disabled = !history.canRedo();
  }

  _bind() {
    this._undoBtn.addEventListener('click', () => { history.undo(); this._sync(); });
    this._redoBtn.addEventListener('click', () => { history.redo(); this._sync(); });

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); history.undo(); this._sync();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault(); history.redo(); this._sync();
      }
    });
  }
}
