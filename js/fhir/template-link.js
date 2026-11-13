// Deep link `/?template=<id>`: parsing the id and removing the parameter from the address afterwards.
const PARAM = 'template';
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** @returns {null | {id: string} | {invalid: true}} null = no template parameter */
export function parseTemplateLink(search) {
  const value = new URLSearchParams(search).get(PARAM);
  if (value === null) return null;
  return ID_RE.test(value) ? { id: value } : { invalid: true };
}

/** Path + remaining query + hash of `href`, without the template parameter. */
export function withoutTemplateParam(href) {
  const url = new URL(href, 'https://placeholder.invalid');
  url.searchParams.delete(PARAM);
  return url.pathname + url.search + url.hash;
}
