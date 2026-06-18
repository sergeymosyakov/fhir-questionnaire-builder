// ── Left panel header actions ─────────────────────────────────────────────────
// Mounts the More menu (Undo / Redo / Help / Settings) into the left panel header.
import { MoreMenu } from './menus/more-menu.js';

export let moreMenu;

export function mount() {
  const wrap = document.querySelector('[data-mount="left-header-right"]');
  if (!wrap) return;
  moreMenu = new MoreMenu();
  wrap.appendChild(moreMenu._wrap);
}

if (typeof document !== 'undefined') mount();
