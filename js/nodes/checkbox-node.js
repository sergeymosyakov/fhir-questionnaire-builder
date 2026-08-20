// ── CheckboxNode ──────────────────────────────────────────────────────────────
// Boolean yes/no input rendered as a 3-segment control (Yes / No / Not Answered).
// itemType: 'checkbox'
import { ItemNode } from './item-node.js';
import { NODE_REGISTRY } from './registry.js';
import { BaseNode, createWrap } from './base-node.js';

const SEGMENTS = [
  { label: 'Yes',         value: true      },
  { label: 'No',          value: false     },
  { label: 'Not Answered', value: undefined },
];

export class CheckboxNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'checkbox';
  }

  supportsRepeat() { return false; }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc } = ctx;

    const wrap = createWrap();
    const seg = document.createElement('div');
    seg.className = 'bool-seg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', node.text || 'Boolean');

    const currentVal = getValue(node.id);

    for (const opt of SEGMENTS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bool-seg__btn';
      btn.textContent = opt.label;
      // undefined === undefined needs explicit check since === works for primitives
      const isActive = opt.value === currentVal ||
        (opt.value === undefined && currentVal === undefined);
      btn.classList.toggle('bool-seg__btn--active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));

      btn.addEventListener('click', () => {
        seg.querySelectorAll('.bool-seg__btn').forEach(b => {
          b.classList.remove('bool-seg__btn--active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('bool-seg__btn--active');
        btn.setAttribute('aria-pressed', 'true');
        setValue(node.id, opt.value);
        _reCalc();
        onChange();
        BaseNode.notifyChanged(ctx.bus);
      });

      seg.appendChild(btn);
    }

    wrap.appendChild(seg);
    return wrap;
  }
}

NODE_REGISTRY.set('checkbox',    CheckboxNode);
