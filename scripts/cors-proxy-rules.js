// What the CORS proxy worker lets through (kept apart so the worker exports only its handler).
export const ALLOWED_PATHS = [
  /\/metadata$/,
  /\/ValueSet(\/[^/]+)?(\/\$expand)?$/,
  /\/Questionnaire(\/[^/]+)?\/\$(validate|populate)$/,
  /\/Patient(\/[^/]+)?$/,
];
// DeepL does not allow browser calls, so its two API hosts (only) may be reached through the proxy.
export const DEEPL_HOSTS = new Set(['api.deepl.com', 'api-free.deepl.com']);
export const isAllowedTarget = (url) => (DEEPL_HOSTS.has(url.hostname) && url.pathname === '/v2/translate') || ALLOWED_PATHS.some((re) => re.test(url.pathname));
export const MAX_BODY_BYTES = 2 * 1024 * 1024;
export const ALLOWED_ORIGINS = [/^https:\/\/fhirbuilder\.com$/, /^https:\/\/sergeymosyakov\.github\.io$/, /^https?:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

export const isAllowedOrigin = (origin) => !!origin && ALLOWED_ORIGINS.some(re => re.test(origin));
