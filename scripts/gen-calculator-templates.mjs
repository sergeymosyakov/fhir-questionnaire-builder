// Regenerates templates/*.template.json for the calculator templates and upserts their library.json entries.
import fs from 'fs';
import path from 'path';
import { calculatorFiles } from './calculator-templates.mjs';

const DIR = path.resolve('templates');
const libPath = path.join(DIR, 'library.json');
const library = JSON.parse(fs.readFileSync(libPath, 'utf8'));
for (const { file, template, entry } of calculatorFiles()) {
  fs.writeFileSync(path.join(DIR, file), JSON.stringify(template, null, 2) + '\n');
  const at = library.findIndex(e => e.id === entry.id);
  if (at >= 0) library[at] = entry; else library.push(entry);
}
fs.writeFileSync(libPath, JSON.stringify(library, null, 2) + '\n');
