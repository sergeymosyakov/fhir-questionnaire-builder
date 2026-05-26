import { Section } from '../section.js';

export class AppearanceSection extends Section {
  /** Return a partial pending object initialised from node. */
  initPending(_node)      { return {}; }
  /** Write draft values back to the node on Apply. */
  commit(_pending, _node) {}
}
