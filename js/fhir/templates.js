// Template library: catalog (templates/library.json) + one Questionnaire file per template holding a single root group.
const BASE = 'templates/';
let _library = null;

export async function loadTemplateLibrary() {
  if (_library) return _library;
  const res = await fetch(BASE + 'library.json');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  _library = await res.json();
  return _library;
}

/** The wrapper group of a template Questionnaire; throws if the file isn't exactly one root group. */
export function templateGroupFrom(questionnaire) {
  const items = questionnaire?.item;
  if (!Array.isArray(items) || items.length !== 1 || items[0].type !== 'group') {
    throw new Error('A template must contain exactly one root group');
  }
  return items[0];
}

export async function loadTemplateGroup(entry) {
  const res = await fetch(BASE + entry.file);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return templateGroupFrom(await res.json());
}
