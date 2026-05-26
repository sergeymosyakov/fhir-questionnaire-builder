import { Section } from '../section.js';
import { META_SECTIONS } from './registry.js';

class HintSection extends Section {
  build(_pending) {
    const el = document.createElement('div');
    el.className   = 'panel-hint';
    el.textContent = 'Questionnaire-level metadata. Preserved on import and written back on export.';
    return el;
  }
}

META_SECTIONS.push(new HintSection());
