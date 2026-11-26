import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../js/ui/modals/modal-base.js', () => ({
  Modal: class {
    constructor() { this.footer = { appendChild() {} }; this.opened = 0; this.closed = 0; }
    open() { this.opened++; }
    close() { this.closed++; }
  },
}));

let ChoiceModal;
beforeEach(async () => {
  globalThis.document = {
    createElement: () => ({ dataset: {}, addEventListener(_t, fn) { this.click = fn; } }),
  };
  ({ ChoiceModal } = await import('../js/ui/modals/choice-modal.js'));
});

describe('ChoiceModal', () => {
  test('resolves with the id of the pressed button and closes', async () => {
    const m = new ChoiceModal();
    const ok = m.addChoice('Yes', 'b', 'yes-btn', 'yes');
    const p = m.open();
    ok.click();
    expect(await p).toBe('yes');
    expect(m.closed).toBe(1);
  });

  test('Esc / × (a cancel) resolves "cancel"', async () => {
    const m = new ChoiceModal();
    const p = m.open();
    m._cancel();
    expect(await p).toBe('cancel');
  });

  test('a second open() resolves the pending one with "cancel"', async () => {
    const m = new ChoiceModal();
    const first = m.open();
    const second = m.open();
    expect(await first).toBe('cancel');
    m._cancel();
    expect(await second).toBe('cancel');
    expect(m.opened).toBe(2);
  });

  test('a choice pressed after the modal is settled does nothing', async () => {
    const m = new ChoiceModal();
    const btn = m.addChoice('Yes', 'b', 'yes-btn', 'yes');
    const p = m.open();
    m._cancel();
    await p;
    btn.click();
    expect(m.closed).toBe(2);
  });
});
