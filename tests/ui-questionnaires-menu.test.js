// @vitest-environment jsdom
// ── DOM tests: QuestionnairesMenu library loading and progress handling ──────
// Collaborators are mocked; the "From Library" click flow is driven end to end.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ onPick: null }));

vi.mock('../js/ui/autosave.js', () => ({ getDraftData: vi.fn(), getMostRecentDraft: vi.fn(async () => null) }));
vi.mock('../js/ui/modals/library-modal.js', () => ({ open: vi.fn((_lib, cb) => { h.onPick = cb; }) }));
vi.mock('../js/ui/progress.js', () => ({ show: vi.fn(), update: vi.fn(), hide: vi.fn() }));
vi.mock('../js/ui/toast.js', () => ({ showError: vi.fn() }));
vi.mock('../js/ui/modals/load-format-modal.js', () => ({ loadFormatModal: { open: vi.fn() } }));
vi.mock('../js/fhir/sd-import.js', () => ({ applyStructureDefinition: vi.fn() }));

import { QuestionnairesMenu } from '../js/ui/menus/questionnaires-menu.js';
import * as progress from '../js/ui/progress.js';
import * as libraryModal from '../js/ui/modals/library-modal.js';
import { showError } from '../js/ui/toast.js';
import { applyStructureDefinition } from '../js/fhir/sd-import.js';
import { AppEvents } from '../js/events.js';

let menu, loadRequests, onConfirm, onLoad;
const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  h.onPick = null;
  loadRequests = [];
  document.body.innerHTML = '';
  menu = new QuestionnairesMenu();
  document.body.appendChild(menu.el);
  onConfirm = e => e.detail.resolve(true);
  document.addEventListener(AppEvents.QUESTIONNAIRE_LOAD_CONFIRM_REQUESTED, onConfirm);
  onLoad = e => loadRequests.push(e.detail);
  document.addEventListener(AppEvents.QUESTIONNAIRE_LOAD_REQUESTED, onLoad);
});
afterEach(() => {
  document.removeEventListener(AppEvents.QUESTIONNAIRE_LOAD_REQUESTED, onLoad);
  document.removeEventListener(AppEvents.QUESTIONNAIRE_LOAD_CONFIRM_REQUESTED, onConfirm);
  vi.unstubAllGlobals();
});

async function pickLibraryItem(item, body) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body })));
  menu._loadLibraryItem.click();
  await vi.waitFor(() => expect(h.onPick).toBeTypeOf('function'));
  h.onPick(item);
  await flush();
}

describe('From Library', () => {
  it('opens the fhir-r4 library for questionnaire and sd types after confirmation', async () => {
    menu._loadLibraryItem.click();
    await vi.waitFor(() => expect(libraryModal.open).toHaveBeenCalled());
    expect(libraryModal.open.mock.calls[0][0]).toBe('fhir-r4');
    expect(libraryModal.open.mock.calls[0][2]).toEqual(['questionnaire', 'sd']);
  });

  it('does not open the library when the user cancels the unsaved-changes confirmation', async () => {
    document.removeEventListener(AppEvents.QUESTIONNAIRE_LOAD_CONFIRM_REQUESTED, onConfirm);
    onConfirm = e => e.detail.resolve(false);
    document.addEventListener(AppEvents.QUESTIONNAIRE_LOAD_CONFIRM_REQUESTED, onConfirm);
    menu._loadLibraryItem.click();
    await flush();
    expect(libraryModal.open).not.toHaveBeenCalled();
  });

  it('loads a questionnaire item as-is and leaves the progress overlay to the loader', async () => {
    const data = { resourceType: 'Questionnaire', id: 'q' };
    await pickLibraryItem({ label: 'PHQ-9', file: 'phq9.json', type: 'questionnaire' }, data);
    expect(fetch).toHaveBeenCalledWith('sampledata/phq9.json');
    expect(progress.show).toHaveBeenCalledWith('Loading PHQ-9…');
    expect(loadRequests).toEqual([{ data, fileName: 'PHQ-9' }]);
    expect(progress.hide).not.toHaveBeenCalled();
  });

  it('loads a StructureDefinition item through applyStructureDefinition', async () => {
    const q = { resourceType: 'Questionnaire', id: 'gen' };
    applyStructureDefinition.mockReturnValue(q);
    const sd = { resourceType: 'StructureDefinition' };
    await pickLibraryItem({ label: 'Patient SD', file: 'sd.json', type: 'sd' }, sd);
    expect(applyStructureDefinition).toHaveBeenCalledWith(sd, 'Patient SD');
    expect(loadRequests).toEqual([{ data: q, fileName: 'Patient SD' }]);
    expect(progress.hide).not.toHaveBeenCalled();
  });

  it('hides the progress overlay and loads nothing when SD generation returns null', async () => {
    applyStructureDefinition.mockReturnValue(null);
    await pickLibraryItem({ label: 'Bad SD', file: 'bad.json', type: 'sd' }, { resourceType: 'Basic' });
    expect(progress.hide).toHaveBeenCalledTimes(1);
    expect(loadRequests).toEqual([]);
    expect(showError).not.toHaveBeenCalled();
  });

  it('hides progress and shows an error when the sample cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    menu._loadLibraryItem.click();
    await vi.waitFor(() => expect(h.onPick).toBeTypeOf('function'));
    h.onPick({ label: 'Gone', file: 'gone.json', type: 'questionnaire' });
    await flush();
    expect(progress.hide).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledWith('Could not load sample: HTTP 404');
    expect(loadRequests).toEqual([]);
  });
});
