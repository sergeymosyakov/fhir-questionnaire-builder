// ── Unit tests: js/fhir/sd-import.js ─────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../js/fhir/sd-to-questionnaire.js', () => ({ generateQuestionnaireFromSD: vi.fn() }));
vi.mock('../js/ui/toast.js', () => ({ showError: vi.fn() }));
vi.mock('../js/ui/modals/validate-modal.js', () => ({ show: vi.fn() }));

import { applyStructureDefinition } from '../js/fhir/sd-import.js';
import { generateQuestionnaireFromSD } from '../js/fhir/sd-to-questionnaire.js';
import { showError } from '../js/ui/toast.js';
import * as validateModal from '../js/ui/modals/validate-modal.js';

beforeEach(() => {
  generateQuestionnaireFromSD.mockReset();
  showError.mockReset();
  validateModal.show.mockReset();
});

describe('applyStructureDefinition', () => {
  it.each([[null], [undefined], [{ resourceType: 'Questionnaire' }], [{}]])(
    'rejects non-StructureDefinition input %j with a toast and null', (data) => {
      expect(applyStructureDefinition(data, 't')).toBeNull();
      expect(showError).toHaveBeenCalledWith('The selected file is not a FHIR StructureDefinition.');
      expect(generateQuestionnaireFromSD).not.toHaveBeenCalled();
    });

  it('generates with the title and returns the questionnaire without a warnings modal', () => {
    const q = { resourceType: 'Questionnaire' };
    generateQuestionnaireFromSD.mockReturnValue({ questionnaire: q, warnings: [] });
    const sd = { resourceType: 'StructureDefinition' };
    expect(applyStructureDefinition(sd, 'My title')).toBe(q);
    expect(generateQuestionnaireFromSD).toHaveBeenCalledWith(sd, { title: 'My title' });
    expect(validateModal.show).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });

  it('shows generation warnings in the validate modal as warning issues and still returns the questionnaire', () => {
    const q = { resourceType: 'Questionnaire' };
    generateQuestionnaireFromSD.mockReturnValue({ questionnaire: q, warnings: ['w1', 'w2'] });
    expect(applyStructureDefinition({ resourceType: 'StructureDefinition' }, 't')).toBe(q);
    expect(validateModal.show).toHaveBeenCalledWith('StructureDefinition Generation — Warnings', 'import', {
      extraIssues: [
        { severity: 'warning', nodeId: '', message: 'w1' },
        { severity: 'warning', nodeId: '', message: 'w2' },
      ],
    });
  });
});
