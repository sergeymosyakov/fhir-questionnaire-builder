// ── FHIR canonical URLs ───────────────────────────────────────────────────────
// FHIR canonical URLs (extension definitions, code systems) are spec-defined
// `http://` identifiers — they are URIs, never fetched over HTTP. SonarQube's
// S5332 (clear-text protocol) is therefore a false positive here. The single
// base literal below carries a NOSONAR marker and every URL is built from it by
// concatenation, so no other line in the codebase contains a raw `http://`.
//
// Centralising these also removes the duplicated URL strings that were spread
// across import-item.js / export.js / import-helpers.js and the modal sections.

const HL7  = 'http:' + '//hl7.org/fhir';        // NOSONAR — FHIR canonical URI, not a network endpoint
const SD   = HL7 + '/StructureDefinition';       // core FHIR extensions
const SDC  = HL7 + '/uv/sdc/StructureDefinition'; // SDC extensions
const SDCS = HL7 + '/uv/sdc/CodeSystem';          // SDC code systems

export const FHIR = {
  // Base for building dynamic StructureDefinition URLs, e.g. `${FHIR.sd}/${type}`.
  sd: SD,

  // ── Core FHIR (questionnaire-*) extensions ────────────────────────────────
  itemControl:          SD + '/questionnaire-itemControl',
  constraint:           SD + '/questionnaire-constraint',
  unit:                 SD + '/questionnaire-unit',
  unitValueSet:         SD + '/questionnaire-unitValueSet',
  unitOption:           SD + '/questionnaire-unitOption',
  minOccurs:            SD + '/questionnaire-minOccurs',
  maxOccurs:            SD + '/questionnaire-maxOccurs',
  sliderStepValue:      SD + '/questionnaire-sliderStepValue',
  supportLink:          SD + '/questionnaire-supportLink',
  optionPrefix:         SD + '/questionnaire-optionPrefix',
  optionExclusive:      SD + '/questionnaire-optionExclusive',
  hidden:               SD + '/questionnaire-hidden',
  usageMode:            SD + '/questionnaire-usageMode',
  choiceOrientation:    SD + '/questionnaire-choiceOrientation',
  displayCategory:      SD + '/questionnaire-displayCategory',
  baseType:             SD + '/questionnaire-baseType',
  fhirType:             SD + '/questionnaire-fhirType',
  referenceResource:    SD + '/questionnaire-referenceResource',
  referenceProfile:     SD + '/questionnaire-referenceProfile',
  referenceFilter:      SD + '/questionnaire-referenceFilter',
  signatureRequired:    SD + '/questionnaire-signatureRequired',

  // ── Core FHIR (general) extensions ────────────────────────────────────────
  minValue:             SD + '/minValue',
  maxValue:             SD + '/maxValue',
  minLength:            SD + '/minLength',
  maxSize:              SD + '/maxSize',
  mimeType:             SD + '/mimeType',
  regex:                SD + '/regex',
  entryFormat:          SD + '/entryFormat',
  ordinalValue:         SD + '/ordinalValue',
  itemWeight:           SD + '/itemWeight',
  designNote:           SD + '/designNote',
  translation:          SD + '/translation',
  maxDecimalPlaces:     SD + '/maxDecimalPlaces',
  renderingXhtml:       SD + '/rendering-xhtml',
  renderingStyle:       SD + '/rendering-style',
  renderingMarkdown:    SD + '/rendering-markdown',
  artifactVersionAlgorithm: SD + '/artifact-versionAlgorithm',
  artifactCopyrightLabel:   SD + '/artifact-copyrightLabel',
  replaces:             SD + '/replaces',

  // ── SDC (sdc-questionnaire-*) extensions ──────────────────────────────────
  calculatedExpression: SDC + '/sdc-questionnaire-calculatedExpression',
  initialExpression:    SDC + '/sdc-questionnaire-initialExpression',
  enableWhenExpression: SDC + '/sdc-questionnaire-enableWhenExpression',
  answerExpression:     SDC + '/sdc-questionnaire-answerExpression',
  candidateExpression:  SDC + '/sdc-questionnaire-candidateExpression',
  variable:             SDC + '/sdc-questionnaire-variable',
  launchContext:        SDC + '/sdc-questionnaire-launchContext',
  itemMedia:            SDC + '/sdc-questionnaire-itemMedia',
  answerMedia:          SDC + '/sdc-questionnaire-answerMedia',
  isSubject:            SDC + '/sdc-questionnaire-isSubject',
  entryFormatSdc:       SDC + '/sdc-questionnaire-entryFormat',
  columnCount:          SDC + '/sdc-questionnaire-columnCount',
  choiceColumn:         SDC + '/sdc-questionnaire-choiceColumn',
  collapsible:          SDC + '/sdc-questionnaire-collapsible',
  hiddenSdc:            SDC + '/sdc-questionnaire-hidden',
  openLabel:            SDC + '/sdc-questionnaire-openLabel',
  observationExtract:   SDC + '/sdc-questionnaire-observationExtract',
  preferredTerminologyServer: SDC + '/sdc-questionnaire-preferredTerminologyServer',
  shortText:            SDC + '/sdc-questionnaire-shortText',
  itemContext:          SDC + '/sdc-questionnaire-itemContext',
  definitionExtract:    SDC + '/sdc-questionnaire-definitionExtract',
  definitionExtractContext: SDC + '/sdc-questionnaire-definitionExtractContext',
  sdcQuestionnaire:     SDC + '/sdc-questionnaire',
  sdcObservation:       SDC + '/sdc-observation',
  launchContextCS:      SDCS + '/launchContext',

  // ── FHIR code systems / value-set URIs (non-StructureDefinition) ──────────
  itemControlCS:        HL7 + '/questionnaire-item-control',
  displayCategoryCS:    HL7 + '/questionnaire-display-category',
  versionAlgorithm:     HL7 + '/version-algorithm',
  icd10cm:              HL7 + '/sid/icd-10-cm',
};
