// ── PatientPresetMenu ─────────────────────────────────────────────────────────
// Header dropdown for patient preset profiles.
// Extends DropdownMenu — inherits close-dropdowns listener and toggle logic.
// Receives presets[] in constructor; handlers injected via setHandlers().
import { DropdownMenu } from '../dropdown-menu.js';

export class PatientPresetMenu extends DropdownMenu {
  constructor(presets) {
    super({
      label:    '&#x1F464; Patient &#x25BE;',
      btnClass: 'btn-fhir',
      testid:   'patient-preset-btn',
      tipTitle: 'Patient Preset',
      tipBody:  'Select a patient profile to populate %age, %gender, %bmi, %pregnant, %smoker, %proc, %comorb variables. Applying a preset re-evaluates all initialExpression fields. Use Custom\u2026 to edit values manually.',
      tipSpec:  'SDC \u00B7 questionnaire-level variable',
    });

    this._onPreset = null;
    this._onCustom = null;

    for (const preset of presets) {
      const item = this._item(null, preset.label);
      item.dataset.preset = preset.id;
      item.addEventListener('click', () => {
        this.close();
        this._btn.innerHTML = '&#x1F464; ' + preset.shortLabel + ' &#x25BE;';
        this._onPreset?.(preset);
      });
      this._menu.appendChild(item);
    }

    this._menu.appendChild(this._sep());

    const customItem = this._item(null, '\u270F Custom\u2026');
    customItem.dataset.preset = 'custom';
    customItem.addEventListener('click', () => { this.close(); this._onCustom?.(); });
    this._menu.appendChild(customItem);

    // The menu lives inside .top-panel which has overflow-x:auto.
    // Use position:fixed so the dropdown escapes the overflow clipping.
    this._menu.style.position = 'fixed';
  }

  /** Position the fixed menu below the button on every open. */
  _onOpen() {
    const r = this._btn.getBoundingClientRect();
    this._menu.style.top  = (r.bottom + 4) + 'px';
    this._menu.style.left = r.left + 'px';
  }

  /** @param {{ onPreset(preset): void, onCustom(): void }} handlers */
  setHandlers({ onPreset, onCustom }) {
    this._onPreset = onPreset;
    this._onCustom = onCustom;
  }

  /** Reactively disable/enable the button (e.g. when no questionnaire is loaded). */
  setDisabled(disabled) { this._btn.disabled = disabled; }
}
