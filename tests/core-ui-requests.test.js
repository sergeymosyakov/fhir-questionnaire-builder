// Modules below the UI ask for notices, reports, progress and confirmations through events.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const sent = [];
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
globalThis.document = { dispatchEvent: (e) => sent.push(e), addEventListener() {}, removeEventListener() {} };

const ui = await import('../js/core/ui-requests.js');
const { AppEvents } = await import('../js/events.js');

beforeEach(() => { sent.length = 0; });

describe('ui-requests', () => {
  it('sends a notice with its level', () => {
    ui.notifyError('bad'); ui.notifyWarn('hmm'); ui.notifyInfo('ok');
    expect(sent.map((e) => [e.type, e.detail.type, e.detail.message])).toEqual([
      [AppEvents.NOTIFY_REQUESTED, 'error', 'bad'], [AppEvents.NOTIFY_REQUESTED, 'warn', 'hmm'], [AppEvents.NOTIFY_REQUESTED, 'info', 'ok'],
    ]);
  });

  it('asks for a validation report with title, mode and options', () => {
    ui.requestValidationReport('Import', 'import', { extraIssues: [1] });
    expect(sent[0]).toMatchObject({ type: AppEvents.VALIDATION_REPORT_REQUESTED, detail: { title: 'Import', mode: 'import', extraIssues: [1] } });
  });

  it('shows and hides the progress overlay', () => {
    ui.showProgress('Loading'); ui.hideProgress();
    expect(sent.map((e) => e.type)).toEqual([AppEvents.PROGRESS_SHOW, AppEvents.PROGRESS_HIDE]);
    expect(sent[0].detail.label).toBe('Loading');
  });

  it('resolves a load confirmation with what the UI answers', async () => {
    document.dispatchEvent = (e) => { sent.push(e); e.detail.handled = true; e.detail.resolve('cancel'); };
    expect(await ui.confirmLoadReplace()).toBe('cancel');
    document.dispatchEvent = (e) => sent.push(e);
  });

  it('proceeds when nothing in the page answers the confirmation', async () => {
    expect(await ui.confirmLoadReplace()).toBe('proceed');
  });
});

describe('listeners', () => {
  const read = (f) => readFileSync(path.join('js', f), 'utf8');
  it.each([
    ['NOTIFY_REQUESTED', 'ui/toast.js'],
    ['VALIDATION_REPORT_REQUESTED', 'ui/modals/validate-modal.js'],
    ['PROGRESS_SHOW', 'ui/progress.js'],
    ['PROGRESS_HIDE', 'ui/progress.js'],
    ['LOAD_REPLACE_CONFIRM_REQUESTED', 'ui/modals/load-confirm-modal.js'],
  ])('%s is answered in %s', (event, file) => {
    expect(read(file)).toContain(`addEventListener(AppEvents.${event}`);
  });
});
