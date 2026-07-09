export const STATUSES = ['draft', 'active', 'retired', 'unknown'];

export const LANGUAGES = [
  { value: '',      label: '(not set)' },
  { value: 'en',    label: 'en \u2014 English' },
  { value: 'en-US', label: 'en-US \u2014 English (US)' },
  { value: 'en-GB', label: 'en-GB \u2014 English (UK)' },
  { value: 'de',    label: 'de \u2014 German' },
  { value: 'de-DE', label: 'de-DE \u2014 German (Germany)' },
  { value: 'de-AT', label: 'de-AT \u2014 German (Austria)' },
  { value: 'de-CH', label: 'de-CH \u2014 German (Switzerland)' },
  { value: 'fr',    label: 'fr \u2014 French' },
  { value: 'fr-FR', label: 'fr-FR \u2014 French (France)' },
  { value: 'fr-BE', label: 'fr-BE \u2014 French (Belgium)' },
  { value: 'fr-CH', label: 'fr-CH \u2014 French (Switzerland)' },
  { value: 'nl',    label: 'nl \u2014 Dutch' },
  { value: 'nl-NL', label: 'nl-NL \u2014 Dutch (Netherlands)' },
  { value: 'nl-BE', label: 'nl-BE \u2014 Dutch (Belgium)' },
  { value: 'es',    label: 'es \u2014 Spanish' },
  { value: 'es-ES', label: 'es-ES \u2014 Spanish (Spain)' },
  { value: 'pt',    label: 'pt \u2014 Portuguese' },
  { value: 'pt-BR', label: 'pt-BR \u2014 Portuguese (Brazil)' },
  { value: 'it',    label: 'it \u2014 Italian' },
  { value: 'pl',    label: 'pl \u2014 Polish' },
  { value: 'sv',    label: 'sv \u2014 Swedish' },
  { value: 'da',    label: 'da \u2014 Danish' },
  { value: 'nb',    label: 'nb \u2014 Norwegian Bokm\u00e5l' },
  { value: 'fi',    label: 'fi \u2014 Finnish' },
  { value: 'ja',    label: 'ja \u2014 Japanese' },
  { value: 'zh',    label: 'zh \u2014 Chinese' },
  { value: 'ar',    label: 'ar \u2014 Arabic' },
  { value: 'ru',    label: 'ru \u2014 Russian' },
  { value: 'uk',    label: 'uk \u2014 Ukrainian' },
];

export const EXPERIMENTALS = [
  { value: '',      label: '(not set)' },
  { value: 'true',  label: 'Yes \u2014 experimental / for testing only' },
  { value: 'false', label: 'No \u2014 production ready' },
];

export const TELECOM_SYSTEMS = ['email', 'phone', 'url', 'fax', 'pager', 'sms', 'other'];

export const ID_USES       = ['', 'usual', 'official', 'temp', 'secondary', 'old'];
export const ID_USE_LABELS = ['(use)', 'usual', 'official', 'temp', 'secondary', 'old'];

// Questionnaire.versionAlgorithm[x] — code system + editor options.
// Coding form uses the standard Version Algorithm code system; '__custom__'
// switches to a free-text FHIRPath expression (the versionAlgorithmString form).
export const VERSION_ALGO_SYSTEM = 'http://hl7.org/fhir/version-algorithm';
export const VERSION_ALGO_OPTIONS = [
  { value: '',          label: '(not set)' },
  { value: 'semver',    label: 'semver \u2014 Semantic version' },
  { value: 'integer',   label: 'integer \u2014 Whole number' },
  { value: 'alpha',     label: 'alpha \u2014 Alphabetical' },
  { value: 'date',      label: 'date \u2014 Date/time' },
  { value: 'natural',   label: 'natural \u2014 Natural language' },
  { value: '__custom__', label: 'Custom expression (FHIRPath)\u2026' },
];
