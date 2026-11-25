// ── Builder tree entry point ──────────────────────────────────────────────────
// Creates the builder panel and the classes that mount into it; imports register node builders and formats.
import { BuilderPanel } from './builder-panel.js';
import { MetadataCard } from '../ui/metadata-card.js';
import { CopyPaste }    from '../ui/copy-paste.js';
import { TemplateInsert } from '../ui/template-insert.js';
import '../ui/menus/add-menu.js';
import './node-builder-ext.js';   // augments node prototypes with buildBuilder (builder-only)
import '../fhir/version-compat/open-choice.js';
import '../fhir/version-compat/r5-downgrade.js';
import '../fhir/formats/r4.js';
import '../fhir/formats/r4b.js';
import '../fhir/formats/r5.js';
import '../fhir/formats/redcap.js';

// ── Single panel instance ─────────────────────────────────────────────────────
new BuilderPanel();
new MetadataCard();
new CopyPaste();
new TemplateInsert();
