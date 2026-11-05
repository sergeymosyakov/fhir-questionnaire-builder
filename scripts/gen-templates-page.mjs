// Regenerates templates.html from templates/library.json and the template files.
import { readFileSync, writeFileSync } from 'node:fs';
import { templateGroupFrom } from '../js/fhir/templates.js';
import { renderTemplatesPage } from '../js/fhir/templates-page.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../templates/${name}`, import.meta.url), 'utf8'));
const entries = read('library.json');
const groups = new Map(entries.map((e) => [e.id, templateGroupFrom(read(e.file))]));
writeFileSync(new URL('../templates.html', import.meta.url), renderTemplatesPage(entries, groups));
