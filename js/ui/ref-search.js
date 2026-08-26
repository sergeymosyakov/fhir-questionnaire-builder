// ── FHIR resource search autocomplete dropdown ────────────────────────────────
// Shared live-search UI: debounced searchFhir() call, dropdown of results,
// cancels a superseded in-flight request. Used by SdcPopulateModal (fixed
// Patient type) and ReferenceNode (dynamic resource type) — was duplicated
// in both before this extraction.
import { searchFhir } from '../fhir/fhir-search.js';

const DEBOUNCE_MS = 350;
const BLUR_CLOSE_DELAY_MS = 150;

/**
 * @param {HTMLInputElement} input - the text field driving the search
 * @param {object} options
 * @param {() => string} options.getResourceType - current FHIR resource type (e.g. 'Patient')
 * @param {() => boolean} [options.isEnabled] - gate search on/off (e.g. no FHIR base configured)
 * @param {() => {fhirBase?: string, corsProxy?: string}} [options.getContext]
 * @param {(result: {id: string, display: string}, input: HTMLInputElement) => void} options.onSelect
 * @param {string} [options.extraClassName] - extra class(es) on the dropdown element
 * @param {(input: HTMLInputElement, dropdown: HTMLElement) => void} [options.positionDrop] - custom positioning
 * @param {boolean} [options.searchOnFocus] - also search on focus if the input already has a value
 * @returns {{ close(): void, destroy(): void }}
 */
export function createRefSearchAutocomplete(input, options) {
  const {
    getResourceType,
    isEnabled = () => true,
    getContext = () => ({}),
    onSelect,
    extraClassName = '',
    searchOnFocus = false,
  } = options;

  const dropdown = document.createElement('div');
  dropdown.className = extraClassName ? `ref-search-drop ${extraClassName}` : 'ref-search-drop';
  dropdown.style.display = 'none';
  document.body.appendChild(dropdown);

  const defaultPositionDrop = () => {
    const r = input.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top   = (r.bottom + 3) + 'px';
    dropdown.style.left  = r.left + 'px';
    dropdown.style.width = r.width + 'px';
  };
  const positionDrop = options.positionDrop
    ? () => options.positionDrop(input, dropdown)
    : defaultPositionDrop;

  const close = () => { dropdown.style.display = 'none'; };
  const open  = () => { positionDrop(); dropdown.style.display = 'block'; };

  let debounceTimer = null;
  let searchAbort = null;

  const showResults = (results, query) => {
    dropdown.innerHTML = '';
    if (!results.length) {
      const empty = document.createElement('div');
      empty.className = 'ref-search-empty';
      empty.textContent = query.trim() ? 'No results' : 'Type to search\u2026';
      dropdown.appendChild(empty);
    } else {
      results.forEach(r => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'ref-search-item';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'ref-search-name';
        nameSpan.textContent = r.display;
        const idSpan = document.createElement('span');
        idSpan.className = 'ref-search-id';
        idSpan.textContent = r.id;
        item.append(nameSpan, idSpan);
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          onSelect(r, input);
          close();
        });
        dropdown.appendChild(item);
      });
    }
    open();
  };

  const doSearch = async (query) => {
    const resourceType = getResourceType();
    if (!resourceType || !isEnabled()) { close(); return; }
    searchAbort?.abort(); // supersede any still-in-flight search
    const controller = new AbortController();
    searchAbort = controller;
    const loading = document.createElement('div');
    loading.className = 'ref-search-empty';
    loading.textContent = 'Searching\u2026';
    dropdown.innerHTML = '';
    dropdown.appendChild(loading);
    open();
    try {
      const { fhirBase, corsProxy } = getContext();
      const results = await searchFhir(resourceType, query, 10, { fhirBase, corsProxy, signal: controller.signal });
      if (controller.signal.aborted) return; // a newer search superseded this one
      showResults(results, query);
    } catch (e) {
      if (controller.signal.aborted || e.name === 'AbortError') return;
      const err = document.createElement('div');
      err.className = 'ref-search-empty ref-search-error';
      err.textContent = e.message || 'Search failed';
      dropdown.innerHTML = '';
      dropdown.appendChild(err);
    }
  };

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) { close(); return; }
    debounceTimer = setTimeout(() => doSearch(q), DEBOUNCE_MS);
  });

  if (searchOnFocus) {
    input.addEventListener('focus', () => {
      if (input.value.trim()) doSearch(input.value.trim());
    });
  }

  input.addEventListener('blur', () => setTimeout(close, BLUR_CLOSE_DELAY_MS));

  return {
    close,
    destroy() {
      clearTimeout(debounceTimer);
      searchAbort?.abort();
      dropdown.remove();
    },
  };
}
