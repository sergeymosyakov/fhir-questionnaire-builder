// ── Undo / Redo control ───────────────────────────────────────────────────────
// Wires undo/redo buttons and Ctrl+Z / Ctrl+Y keyboard shortcuts.
// Initialises the history module with the required build/import/render functions.
import * as history from './history.js';
import { buildFHIRObject } from '../fhir/export.js';
import { importFHIR } from '../fhir/import.js';

export class UndoRedo {
  constructor() {
    this._undoBtn = document.querySelector('[data-mount="undo-btn"]');
    this._redoBtn = document.querySelector('[data-mount="redo-btn"]');

    history.init({
      buildFn:  buildFHIRObject,
      importFn: importFHIR,
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
      // Leave native text undo to editable fields, and don't rewrite the form behind an open modal.
      if (e.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      if ([...document.querySelectorAll('.modal-backdrop')].some(b => b.style.display !== 'none')) return;
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
