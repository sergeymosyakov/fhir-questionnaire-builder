import { Section } from '../section.js';
import { META_SECTIONS } from './registry.js';
import { makeRow, makeSelectRow, makeCollapsible } from './helpers.js';
import { EXPERIMENTALS } from './data.js';

class AdvancedSection extends Section {
  build(pending) {
    return makeCollapsible({
      testid:      'meta-advanced-toggle',
      tip:         { title: 'Advanced metadata', body: 'Less commonly used fields: experimental flag, date, subject types, effective period, approval/review dates, purpose, and copyright.' },
      label:       'Advanced',
      initialOpen: false,
      buildBody:   ({ el }) => {
        const r = (key, label, type, ph, testid, tip) => makeRow(pending, key, label, type, ph, testid, tip);
        el.append(
          makeSelectRow(pending, 'experimental', 'Experimental', EXPERIMENTALS, 'meta-experimental', {
            title: 'Questionnaire.experimental',
            body:  'Marks this questionnaire as experimental \u2014 for testing and evaluation only. Should not be used in production clinical workflows.',
            fhir:  'Questionnaire.experimental', spec: 'R4',
          }),
          r('date',                 'Date',           'date',     '',                           'meta-date',            { title: 'Questionnaire.date',                body: 'Date this version was last significantly changed. Used for versioning and change tracking in questionnaire registries.',         fhir: 'Questionnaire.date',                spec: 'R4' }),
          r('subjectType',          'Subject Type',   'text',     'e.g. Patient, Practitioner', 'meta-subject-type',   { title: 'Questionnaire.subjectType',         body: 'Resource type(s) that can be the subject of a QuestionnaireResponse. Comma-separated list (e.g. Patient, Practitioner).',         fhir: 'Questionnaire.subjectType',         spec: 'R4' }),
          r('effectivePeriodStart', 'Effective From', 'date',     '',                           'meta-effective-start', { title: 'Questionnaire.effectivePeriod.start', body: 'Start of the period during which this questionnaire is intended to be used.',                                                fhir: 'Questionnaire.effectivePeriod',     spec: 'R4' }),
          r('effectivePeriodEnd',   'Effective To',   'date',     '',                           'meta-effective-end',   { title: 'Questionnaire.effectivePeriod.end',   body: 'End of the period during which this questionnaire is intended to be used.',                                                  fhir: 'Questionnaire.effectivePeriod',     spec: 'R4' }),
          r('approvalDate',         'Approved',       'date',     '',                           'meta-approval-date',   { title: 'Questionnaire.approvalDate',         body: 'Date when this questionnaire was formally approved by the publisher or governance body.',                                       fhir: 'Questionnaire.approvalDate',        spec: 'R4' }),
          r('lastReviewDate',       'Last Review',    'date',     '',                           'meta-last-review',     { title: 'Questionnaire.lastReviewDate',       body: 'Date when this questionnaire was last reviewed. Used by registries to track content currency.',                                  fhir: 'Questionnaire.lastReviewDate',      spec: 'R4' }),
          r('purpose',              'Purpose',        'textarea', 'Intended use\u2026',         'meta-purpose',         { title: 'Questionnaire.purpose',              body: 'Explains why this questionnaire is needed. Describes the clinical or administrative problem it addresses.',                     fhir: 'Questionnaire.purpose',             spec: 'R4' }),
          r('copyright',            'Copyright',      'textarea', 'Copyright statement\u2026',  'meta-copyright',       { title: 'Questionnaire.copyright',            body: 'Copyright notice and/or license information applicable to this questionnaire.',                                               fhir: 'Questionnaire.copyright',           spec: 'R4' }),
        );
      },
    });
  }
}

META_SECTIONS.push(new AdvancedSection());
