import { Section } from '../section.js';
import { META_SECTIONS } from './registry.js';
import { makeRow, makeSelectRow, makeCollapsible } from './helpers.js';
import { EXPERIMENTALS, VERSION_ALGO_OPTIONS } from './data.js';

class AdvancedSection extends Section {
  build(pending) {
    return makeCollapsible({
      testid:      'meta-advanced-toggle',
      tip:         { title: 'Advanced metadata', body: 'Less commonly used fields: experimental flag, date, subject types, effective period, approval/review dates, purpose, copyright, version algorithm.' },
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
          r('effectivePeriodStart', 'Effective From', 'date',     '',                           'meta-effective-start', { title: 'Questionnaire.effectivePeriod.start', body: 'Start of the period during which this questionnaire is intended to be used.',                                                fhir: 'Questionnaire.effectivePeriod',     spec: 'R4' }),
          r('effectivePeriodEnd',   'Effective To',   'date',     '',                           'meta-effective-end',   { title: 'Questionnaire.effectivePeriod.end',   body: 'End of the period during which this questionnaire is intended to be used.',                                                  fhir: 'Questionnaire.effectivePeriod',     spec: 'R4' }),
          r('approvalDate',         'Approved',       'date',     '',                           'meta-approval-date',   { title: 'Questionnaire.approvalDate',         body: 'Date when this questionnaire was formally approved by the publisher or governance body.',                                       fhir: 'Questionnaire.approvalDate',        spec: 'R4' }),
          r('lastReviewDate',       'Last Review',    'date',     '',                           'meta-last-review',     { title: 'Questionnaire.lastReviewDate',       body: 'Date when this questionnaire was last reviewed. Used by registries to track content currency.',                                  fhir: 'Questionnaire.lastReviewDate',      spec: 'R4' }),
          r('purpose',              'Purpose',        'textarea', 'Intended use\u2026',         'meta-purpose',         { title: 'Questionnaire.purpose',              body: 'Explains why this questionnaire is needed. Describes the clinical or administrative problem it addresses.',                     fhir: 'Questionnaire.purpose',             spec: 'R4' }),
          r('copyright',            'Copyright',      'textarea', 'Copyright statement\u2026',  'meta-copyright',       { title: 'Questionnaire.copyright',            body: 'Copyright notice and/or license information applicable to this questionnaire.',                                               fhir: 'Questionnaire.copyright',           spec: 'R4' }),
          r('copyrightLabel',       'Copyright Label','text',     'e.g. All rights reserved',   'meta-copyright-label', { title: 'Questionnaire.copyrightLabel',       body: 'A short (<50 char) copyright string for a page footer. R5 native field; on R4/R4B export it is written as the official artifact-copyrightLabel extension.', fhir: 'Questionnaire.copyrightLabel',      spec: 'R5' }),
        );
        el.append(this._buildVersionAlgorithmRow(pending));
      },
    });
  }

  // Version algorithm: standard Coding value set, or a custom FHIRPath string.
  _buildVersionAlgorithmRow(pending) {
    const wrap = document.createElement('div');
    wrap.append(makeSelectRow(pending, 'versionAlgo', 'Version Algorithm', VERSION_ALGO_OPTIONS, 'meta-version-algorithm', {
      title: 'Questionnaire.versionAlgorithm[x]',
      body:  'Mechanism used to compare versions to determine which is more current. Coding values come from the standard Version Algorithm value set; "Custom expression" stores a FHIRPath string instead. R5 native field; on R4/R4B export it is written as the official artifact-versionAlgorithm extension.',
      fhir:  'Questionnaire.versionAlgorithm[x]', spec: 'R5',
    }));
    const exprRow = makeRow(pending, 'versionAlgoExpr', 'Custom expression', 'text', 'e.g. %version1 > %version2', 'meta-version-algorithm-expr', null);
    exprRow.style.display = pending.versionAlgo === '__custom__' ? '' : 'none';
    wrap.append(exprRow);
    // Toggle the expression row when the selection changes.
    const sel = wrap.querySelector('[data-testid="meta-version-algorithm"]');
    if (sel) {
      const obs = new MutationObserver(() => {
        exprRow.style.display = sel.dataset.value === '__custom__' ? '' : 'none';
      });
      obs.observe(sel, { attributes: true, attributeFilter: ['data-value'] });
    }
    return wrap;
  }
}

META_SECTIONS.push(new AdvancedSection());
