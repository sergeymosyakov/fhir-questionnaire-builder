import { LANGUAGES_MAP } from '../../../fhir/languages.js';
import { FHIR } from '../../../fhir/urls/fhir.js';

export const STATUSES = ['draft', 'active', 'retired', 'unknown'];

// Questionnaire.language dropdown — BCP-47 codes from the shared master list.
// '(not set)' entry prepended; regional variants included for FHIR conformance.
export const LANGUAGES = [
  { value: '', label: '(not set)' },
  ...Array.from(LANGUAGES_MAP.entries()).map(([value, label]) => ({ value, label: `${value} \u2014 ${label}` })),
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
export const VERSION_ALGO_SYSTEM = FHIR.versionAlgorithm;
export const VERSION_ALGO_OPTIONS = [
  { value: '',          label: '(not set)' },
  { value: 'semver',    label: 'semver \u2014 Semantic version' },
  { value: 'integer',   label: 'integer \u2014 Whole number' },
  { value: 'alpha',     label: 'alpha \u2014 Alphabetical' },
  { value: 'date',      label: 'date \u2014 Date/time' },
  { value: 'natural',   label: 'natural \u2014 Natural language' },
  { value: '__custom__', label: 'Custom expression (FHIRPath)\u2026' },
];
