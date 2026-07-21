import { Section } from '../section.js';
import { META_SECTIONS } from './registry.js';
import { makeRow, makeSelectRow } from './helpers.js';
import { STATUSES, LANGUAGES } from './data.js';
import { EXAMPLE_URL } from '../../../fhir/urls/examples.js';

// Ordered fields: id → url → version → name → title → status → language → publisher → description
class CoreFieldsSection extends Section {
  build(pending) {
    const frag = document.createDocumentFragment();
    const r = (key, label, type, ph, testid, tip) => makeRow(pending, key, label, type, ph, testid, tip);
    const s = (key, label, opts, testid, tip)     => makeSelectRow(pending, key, label, opts, testid, tip);

    frag.append(
      r('id',          'ID',          'text',     'e.g. my-questionnaire',     'meta-id',          { title: 'Questionnaire.id',          body: 'Logical identifier for this resource. Unique within the server context. Used in resource references and URLs.',                                       fhir: 'Questionnaire.id',          spec: 'R4' }),
      r('url',         'URL',         'text',     EXAMPLE_URL.questionnaireUrl, 'meta-url',    { title: 'Questionnaire.url',         body: 'Canonical URL \u2014 globally unique identifier for this questionnaire. Used for cross-server references, versioning, and profile conformance declarations.',  fhir: 'Questionnaire.url',         spec: 'R4' }),
      r('version',     'Version',     'text',     'e.g. 1.0.0',                'meta-version',     { title: 'Questionnaire.version',     body: 'Business version. Changes with each substantive update. Follows semver convention (e.g. 1.0.0).',                                                       fhir: 'Questionnaire.version',     spec: 'R4' }),
      r('name',        'Name',        'text',     'e.g. MyQuestionnaire',      'meta-name',        { title: 'Questionnaire.name',        body: 'Computer-friendly identifier. No spaces; starts with a letter or underscore. Used in code generation and system identifiers.',                         fhir: 'Questionnaire.name',        spec: 'R4' }),
      r('title',       'Title',       'text',     'e.g. PHQ-9 Depression\u2026', 'meta-title',     { title: 'Questionnaire.title',       body: 'Human-readable display name shown in questionnaire catalogs and form headers.',                                                                        fhir: 'Questionnaire.title',       spec: 'R4' }),
      s('status',      'Status',      STATUSES.map(v => ({ value: v, label: v })), 'meta-status',  { title: 'Questionnaire.status',      body: '"draft" \u2014 work in progress; "active" \u2014 in use; "retired" \u2014 no longer recommended; "unknown" \u2014 status not determined. Required field.', fhir: 'Questionnaire.status',      spec: 'R4' }),
      s('language',    'Language',    LANGUAGES, 'meta-language',               { title: 'Questionnaire.language',    body: 'BCP-47 language tag for the primary language of the questionnaire (e.g. en, fr, de). Affects text rendering and locale-specific formatting.',                          fhir: 'Questionnaire.language',    spec: 'R4' }),
      r('publisher',   'Publisher',   'text',     'e.g. HL7 International',    'meta-publisher',   { title: 'Questionnaire.publisher',   body: 'Name of the organization or person responsible for publishing this questionnaire.',                                                                   fhir: 'Questionnaire.publisher',   spec: 'R4' }),
      r('description', 'Description', 'textarea', 'Optional description\u2026', 'meta-description', { title: 'Questionnaire.description', body: 'Natural language description of the questionnaire \u2014 its purpose, scope, and intended use.',                                                   fhir: 'Questionnaire.description', spec: 'R4' }),
    );
    return frag;
  }
}

META_SECTIONS.push(new CoreFieldsSection());
