import { AppEvents, EventState } from '../../../events.js';
import { expressionBuilderModal } from '../expression-builder-modal.js';

/**
 * Build a label-row + auto-resize textarea for a FHIRPath expression.
 * opts.node enables a "Build…" button that opens the visual value builder.
 * Returns a DocumentFragment.
 */
export function makeExprField(labelText, exprValue, testid, placeholder, onInput, opts = {}) {
  const frag = document.createDocumentFragment();

  const iconRow = document.createElement('div');
  iconRow.className = 'panel-expr-lbl panel-lbl-row';
  const lbl = document.createElement('span');
  lbl.textContent = labelText;
  const icon = document.createElement('span');
  icon.className        = 'expr-live-icon';
  icon.dataset.exprIcon = exprValue;
  iconRow.appendChild(lbl);
  iconRow.appendChild(icon);
  frag.appendChild(iconRow);

  const ta = document.createElement('textarea');
  ta.className   = 'expr-textarea';
  ta.rows        = 3;
  ta.value       = exprValue;
  ta.placeholder = placeholder || '';
  if (testid) ta.dataset.testid = testid;

  const resize = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  ta.addEventListener('input', resize);
  setTimeout(resize, 0);

  const emitChange = () => {
    icon.dataset.exprIcon = ta.value.trim();
    clearTimeout(ta._d);
    ta._d = setTimeout(() => document.dispatchEvent(new CustomEvent(AppEvents.REFRESH_EXPR_ICONS)), 400);
    onInput(ta.value);
  };
  ta.oninput = emitChange;
  frag.appendChild(ta);

  if (opts.node) {
    const buildBtn = document.createElement('button');
    buildBtn.type = 'button';
    buildBtn.className = 'vis-build-btn';
    buildBtn.textContent = '\uD83E\uDDE9 Build\u2026';
    buildBtn.dataset.testid = (testid ? testid + '-' : '') + 'build-btn';
    buildBtn.addEventListener('click', () => {
      expressionBuilderModal.open({
        tree: EventState.get(AppEvents.APP_CONTEXT_READY)?.questDoc?.tree || [],
        variables: EventState.get(AppEvents.APP_CONTEXT_READY)?.questDoc?.variables || [],
        resultKind: 'value',
        initialExpr: ta.value,
        excludeId: opts.node.id,
        onInsert: (str) => { ta.value = str; resize(); emitChange(); },
      });
    });
    frag.appendChild(buildBtn);
  }
  return frag;
}

/**
 * Build a section header + hint paragraph + expr field.
 * Returns a DocumentFragment.
 */
export function makeSectionBlock(title, fhirKey, hint, exprValue, testid, placeholder, onInput, opts = {}) {
  const frag = document.createDocumentFragment();

  const hdr = document.createElement('div');
  hdr.className        = 'expr-section-hdr';
  hdr.dataset.tipTitle = title;
  hdr.dataset.tipBody  = hint;
  hdr.dataset.tipFhir  = 'item.extension[' + fhirKey + '].valueExpression.expression';
  hdr.dataset.tipSpec  = 'SDC';
  const titleSpan = document.createElement('span');
  titleSpan.textContent = title;
  hdr.appendChild(titleSpan);
  frag.appendChild(hdr);

  const hintEl = document.createElement('div');
  hintEl.className   = 'panel-hint';
  hintEl.textContent = hint;
  frag.appendChild(hintEl);

  frag.appendChild(makeExprField('FHIRPath expression:', exprValue, testid, placeholder, onInput, opts));
  return frag;
}
