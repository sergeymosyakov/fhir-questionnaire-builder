// The ✕ that leads a removable row in the expression builder, with its tooltip.
/** @param {{ testid: string, label: string, tip?: string, onClick(): void }} opts — `label` is the accessible name */
export function createRemoveButton({ testid, label, tip, onClick }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'eb-rm';
  b.textContent = '✕';
  b.dataset.testid = testid;
  b.dataset.tipTitle = 'Remove';
  b.dataset.tipBody = tip ?? label;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}
