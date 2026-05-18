// ── Control base: shared contract and utilities ───────────────────────────────
//
// Every control module must export:
//
//   export function build(node, ctx) → HTMLElement (wrapper span)
//
// Parameters:
//   node  — the questionnaire node (id, itemType, options, mandatory, …)
//   ctx   — {
//     getValue : (id: string) => any  — read the primary answer for a linkId
//     setValue : (id: string, val: any) => void  — write the primary answer
//     onChange : () => void   — call after updating; updates own icon + group icons
//                              updates own icon + group icons
//     _reCalc  : () => void   — re-run FHIRPath calc (select/radio/open-choice)
//     _formTick: Ref<number>  — increment to re-trigger effect() for
//                              enableWhen re-evaluation (select/radio/checkbox)
//   }
//
// The wrapper must be a <span> with display:inline-flex so it composes cleanly
// inside the preview row flex container.

export function createWrap() {
  const wrap = document.createElement('span');
  wrap.className = 'ctrl-wrap';
  return wrap;
}
