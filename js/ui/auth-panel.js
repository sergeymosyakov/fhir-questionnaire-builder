// ── Auth + Cloud panel ────────────────────────────────────────────────────────
// Owns the sign-in button and user chip DOM in the top bar.
// Manages auth state changes and cloud save / load operations.
// Mount: document.getElementById('authWrap') — an empty container in index.html.
import * as auth from '../auth/auth.js';
import { AppEvents } from '../events.js';
import * as storage from '../storage/storage.js';
import * as cloudModal from './modals/cloud-modal.js';
import { confirmModal } from './modals/confirm-modal.js';
import * as progress from './progress.js';
import { buildFHIRObject } from '../fhir/export.js';

const _GITHUB_SVG = '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">'
  + '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38'
  + ' 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15'
  + '-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07'
  + '-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0'
  + ' .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82'
  + '.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73'
  + '.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>'
  + '</svg>';

export class AuthPanel {
  static _svc = { tree: null, effect: null };

  static configure({ tree, effect }) {
    AuthPanel._svc.tree = tree;
    AuthPanel._svc.effect = effect;
  }

  constructor(mountEl) {
    this._mount     = mountEl;
    this._cloudId   = null;  // cloud row id of the currently open questionnaire

    this._buildDOM();
    this._bindHandlers();
    this._subscribeEvents();
    this._initReactive();

    // Fires immediately with the current session, then on every auth change
    auth.onAuthChange((_, user) => this._setAuthUI(user));
  }

  // ── DOM construction ──────────────────────────────────────────────────────

  _buildDOM() {
    // Sign in button
    this._signInBtn = document.createElement('button');
    this._signInBtn.id = 'signInBtn';
    this._signInBtn.type = 'button';
    this._signInBtn.className = 'auth-signin-btn';
    this._signInBtn.dataset.tipTitle = 'Sign in with GitHub';
    this._signInBtn.dataset.tipBody  = 'Save questionnaires to the cloud and access them from any device.';
    this._signInBtn.innerHTML = _GITHUB_SVG + ' Sign in';

    // User chip (hidden until signed in)
    this._userChip = document.createElement('div');
    this._userChip.id = 'userChip';
    this._userChip.className = 'load-wrap top-panel-auth';
    this._userChip.style.display = 'none';

    // User menu toggle button
    this._userMenuBtn = document.createElement('button');
    this._userMenuBtn.id = 'userMenuBtn';
    this._userMenuBtn.type = 'button';
    this._userMenuBtn.className = 'btn-fhir auth-user-btn';

    this._userAvatar = document.createElement('img');
    this._userAvatar.id = 'userAvatar';
    this._userAvatar.className = 'auth-user-avatar';
    this._userAvatar.src = '';
    this._userAvatar.alt = '';
    this._userAvatar.width = 18;
    this._userAvatar.height = 18;

    this._userName = document.createElement('span');
    this._userName.id = 'userName';
    this._userName.className = 'auth-user-name';

    const chevron = document.createElement('span');
    chevron.innerHTML = '&#x25BE;';
    this._userMenuBtn.append(this._userAvatar, this._userName, chevron);

    // Dropdown menu
    this._userMenu = document.createElement('div');
    this._userMenu.id = 'userMenu';
    this._userMenu.className = 'load-menu';
    this._userMenu.style.display = 'none';

    this._signOutItem = document.createElement('div');
    this._signOutItem.id = 'signOutBtn';
    this._signOutItem.className = 'load-menu-item';
    this._signOutItem.dataset.testid = 'sign-out-btn';
    this._signOutItem.textContent = 'Sign out';

    this._userMenu.appendChild(this._signOutItem);
    this._userChip.append(this._userMenuBtn, this._userMenu);
    this._mount.append(this._signInBtn, this._userChip);
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  _bindHandlers() {
    this._signInBtn.addEventListener('click', async () => {
      try { await auth.signInWithGitHub(); }
      catch (err) { import('./toast.js').then(m => m.showError('Sign in failed: ' + err.message)); }
    });

    this._userMenuBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (this._userMenu.style.display === 'none') {
        const r = this._userMenuBtn.getBoundingClientRect();
        this._userMenu.style.top      = (r.bottom + 4) + 'px';
        this._userMenu.style.right    = (window.innerWidth - r.right) + 'px';
        this._userMenu.style.minWidth = r.width + 'px';
        this._userMenu.style.display  = 'block';
      } else {
        this._userMenu.style.display = 'none';
      }
    });

    this._signOutItem.addEventListener('click', async () => {
      this._userMenu.style.display = 'none';
      if (AuthPanel._svc.tree.length > 0) {
        const answer = await confirmModal.open({
          title:       'Sign out?',
          msg:         'Your unsaved work will be lost. Sign out anyway?',
          okLabel:     'Sign out',
          cancelLabel: 'Cancel',
        });
        if (answer !== 'ok') return;
        document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_RESET));
      }
      try { await auth.signOut(); }
      catch (err) { import('./toast.js').then(m => m.showError('Sign out failed: ' + err.message)); }
    });

    // Cloud save — item owned by SaveMenu, logic lives here
    document.getElementById('cloudSaveBtn').addEventListener('click', async () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      const btn = document.getElementById('cloudSaveBtn');
      btn.classList.add('load-menu-item--loading');
      try {
        const fhirJson = buildFHIRObject();
        let row;
        if (this._cloudId) {
          row = await storage.cloudUpdate(this._cloudId, fhirJson);
        } else {
          row = await storage.cloudSave(fhirJson);
          this._cloudId = row.id;
        }
        import('./toast.js').then(m => m.showInfo('Saved to cloud'));
      } catch (err) {
        import('./toast.js').then(m => m.showError('Cloud save failed: ' + err.message));
      } finally {
        btn.classList.remove('load-menu-item--loading');
      }
    });

    // Cloud load — item owned by QuestionnairesMenu, logic lives here
    document.getElementById('loadCloudItem').addEventListener('click', async () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      const { importAndValidate, _askBeforeLoad } = await import('../app-load.js');
      if (await _askBeforeLoad() !== 'proceed') return;
      cloudModal.open(async id => {
        try {
          progress.show('Loading from cloud\u2026');
          const fhirJson = await storage.cloudLoad(id);
          this._cloudId = id;
          await importAndValidate(fhirJson, fhirJson.title || 'Cloud questionnaire');
        } catch (err) {
          progress.hide();
          import('./toast.js').then(m => m.showError('Cloud load failed: ' + err.message));
        }
      });
    });
  }

  // ── Events ────────────────────────────────────────────────────────────────

  _subscribeEvents() {
    document.addEventListener(AppEvents.QUESTIONNAIRE_CLEARED, () => {
      this._cloudId = null;
    });
  }

  // ── Reactivity ────────────────────────────────────────────────────────────

  _initReactive() {
    const { tree, effect } = AuthPanel._svc;
    // Re-sync cloud save button visibility whenever the tree changes
    effect(() => {
      const loggedIn = this._userChip.style.display !== 'none';
      const hasNodes = tree.length > 0;
      const show = loggedIn && hasNodes ? '' : 'none';
      const cloudSaveBtn = document.getElementById('cloudSaveBtn');
      const cloudSaveSep = document.getElementById('cloudSaveSep');
      if (cloudSaveBtn) cloudSaveBtn.style.display = show;
      if (cloudSaveSep) cloudSaveSep.style.display = show;
    });
  }

  // ── Auth state ────────────────────────────────────────────────────────────

  _setAuthUI(user) {
    const cloudSaveBtn  = document.getElementById('cloudSaveBtn');
    const cloudSaveSep  = document.getElementById('cloudSaveSep');
    const loadCloudItem = document.getElementById('loadCloudItem');
    const loadCloudSep  = document.getElementById('loadCloudSep');

    if (user) {
      this._signInBtn.style.display  = 'none';
      this._userChip.style.display   = 'inline-flex';
      this._userAvatar.src           = user.user_metadata?.avatar_url || '';
      this._userName.textContent     = user.user_metadata?.user_name || user.email || '';
      if (loadCloudItem) loadCloudItem.style.display = '';
      if (loadCloudSep)  loadCloudSep.style.display  = '';
    } else {
      this._signInBtn.style.display  = '';
      this._userChip.style.display   = 'none';
      if (loadCloudItem) loadCloudItem.style.display = 'none';
      if (loadCloudSep)  loadCloudSep.style.display  = 'none';
      if (cloudSaveBtn)  cloudSaveBtn.style.display  = 'none';
      if (cloudSaveSep)  cloudSaveSep.style.display  = 'none';
      this._cloudId = null;
    }
  }
}
