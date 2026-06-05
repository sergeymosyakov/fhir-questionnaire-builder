import { Section } from '../section.js';

export class StatesSection extends Section {
  /** Return a partial pending object initialised from node. */
  initPending(_node)      { return {}; }
  /** Write draft values back to the node on Apply. */
  commit(_pending, _node) {}
  /** Return a patch object to apply to a node (null value = delete key). */
  buildPatch(_pending, _node) { return {}; }
  /** Return false to skip rendering this section for the given node. */
  isVisible(_node)        { return true; }
}
