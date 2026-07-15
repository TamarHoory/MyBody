/**
 * onboarding.js — 4-Step Setup Wizard Controller
 *
 * Step 1: Gender selection (auto-advances on click)
 * Step 2: Age + Height
 * Step 3: 8 body measurements
 * Step 4: Summary confirmation → saves profile + first entry
 */
(function (global) {
  'use strict';

  let _currentStep = 1;
  const TOTAL_STEPS = 4;
  let _selectedGender = null;

  /**
   * Parse a numeric string that may use '.' or ',' as decimal separator.
   * Israeli/European mobile keyboards often output a comma instead of a period.
   * e.g. "29,5" → 29.5 instead of 29.
   */
  function _parseDecimal(str) {
    return parseFloat(String(str).trim().replace(',', '.'));
  }

  /* ---- Public ---- */

  function init() {
    _currentStep = 1;
    _selectedGender = null;
    _updateUI();
    _show();

    // Attach gender button listeners
    document.querySelectorAll('#step-1 .gender-btn').forEach(btn => {
      btn.onclick = function () {
        _selectGender(this.dataset.gender);
        // Auto-advance after brief animation delay
        setTimeout(() => {
          if (!_validate(1)) {
            nextStep();
          }
        }, 320);
      };
    });
  }

  function nextStep() {
    const error = _validate(_currentStep);
    if (error) { _showError(error); return; }
    _showError('');

    if (_currentStep === TOTAL_STEPS) {
      _complete();
      return;
    }

    if (_currentStep === TOTAL_STEPS - 1) {
      _buildSummary();
    }

    _currentStep++;
    _updateUI();
  }

  function prevStep() {
    if (_currentStep === 1) {
      if (typeof StorageService !== 'undefined') {
        StorageService.logout();
      }
      return;
    }
    _currentStep--;
    _showError('');
    _updateUI();
  }

  /* ---- Private ---- */

  function _show() {
    document.getElementById('onboarding-overlay').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  }

  function _hide() {
    document.getElementById('onboarding-overlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  }

  function _selectGender(gender) {
    _selectedGender = gender;
    document.querySelectorAll('.gender-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.gender === gender);
    });
    _showError('');
  }

  function _validate(step) {
    if (step === 1) {
      if (!_selectedGender) return 'נא לבחור מין (זכר / נקבה)';
    }

    if (step === 2) {
      const bdate  = document.getElementById('ob-birthdate').value;
      const height = _parseDecimal(document.getElementById('ob-height').value);
      if (!bdate) return 'נא להזין תאריך לידה תקין';
      
      const bYear = new Date(bdate).getFullYear();
      const currentYear = new Date().getFullYear();
      if (bYear < currentYear - 100 || bYear > currentYear - 10) return 'נא להזין תאריך לידה הגיוני (גיל 10-100)';
      if (!height || height < 100 || height > 250) return 'נא להזין גובה תקין (100–250 ס"מ)';
    }

    if (step === 3) {
      const fieldDefs = [
        { id: 'ob-weight', label: 'משקל',    min: 30,  max: 300 },
        { id: 'ob-neck',   label: 'צוואר',   min: 20,  max: 80  },
        { id: 'ob-chest',  label: 'חזה',     min: 50,  max: 200 },
        { id: 'ob-waist',  label: 'מותניים', min: 40,  max: 200 },
        { id: 'ob-hips',   label: 'אגן',     min: 50,  max: 200 },
        { id: 'ob-thigh',  label: 'ירך',     min: 30,  max: 120 },
        { id: 'ob-arm',    label: 'זרוע',    min: 15,  max: 70  },
        { id: 'ob-calf',   label: 'שוק',     min: 20,  max: 80  },
      ];

      for (const { id, label, min, max } of fieldDefs) {
        const val = _parseDecimal(document.getElementById(id).value);
        if (isNaN(val) || val < min || val > max) {
          return `נא להזין ערך תקין עבור: ${label} (${min}–${max})`;
        }
      }

      // Validate that the Navy BF% formula can produce a result
      const neck   = _parseDecimal(document.getElementById('ob-neck').value);
      const waist  = _parseDecimal(document.getElementById('ob-waist').value);
      const hips   = _parseDecimal(document.getElementById('ob-hips').value);
      const height = _parseDecimal(document.getElementById('ob-height').value);
      const bf = Formulas.calcBodyFatPercent(_selectedGender, { neck, waist, hips, height });

      if (bf === null) {
        return 'לא ניתן לחשב אחוז שומן — יש לוודא שמידת המותניים גדולה ממידת הצוואר';
      }
    }

    return null; // no error
  }

  function _complete() {
    // 1. Save profile
    const profile = {
      gender: _selectedGender,
      birthDate: document.getElementById('ob-birthdate').value,
      height: _parseDecimal(document.getElementById('ob-height').value),
    };
    StorageService.saveProfile(profile);

    // 2. Save initial measurement entry with today's date
    const today = new Date().toISOString().split('T')[0];
    StorageService.addEntry({
      date:   today,
      weight: _parseDecimal(document.getElementById('ob-weight').value),
      neck:   _parseDecimal(document.getElementById('ob-neck').value),
      chest:  _parseDecimal(document.getElementById('ob-chest').value),
      waist:  _parseDecimal(document.getElementById('ob-waist').value),
      hips:   _parseDecimal(document.getElementById('ob-hips').value),
      thigh:  _parseDecimal(document.getElementById('ob-thigh').value),
      arm:    _parseDecimal(document.getElementById('ob-arm').value),
      calf:   _parseDecimal(document.getElementById('ob-calf').value),
    });

    _hide();
    AppController.init();
  }

  function _buildSummary() {
    const height = parseFloat(document.getElementById('ob-height').value);
    const neck   = parseFloat(document.getElementById('ob-neck').value);
    const waist  = parseFloat(document.getElementById('ob-waist').value);
    const hips   = parseFloat(document.getElementById('ob-hips').value);
    const weight = parseFloat(document.getElementById('ob-weight').value);
    const bdate  = document.getElementById('ob-birthdate').value;
    const bYear = new Date(bdate).getFullYear();
    const age = new Date().getFullYear() - bYear;

    const bf = Formulas.calcBodyFatPercent(_selectedGender, { neck, waist, hips, height });
    const genderLabel = _selectedGender === 'female' ? 'נקבה' : 'זכר';

    const rows = [
      ['מין',             genderLabel],
      ['גיל (מוערך)',     `${age} שנים`],
      ['גובה',            `${height} ס"מ`],
      ['משקל',            `${weight} ק"ג`],
      ['מותניים',         `${waist} ס"מ`],
      ...(_selectedGender === 'female' ? [['אגן', `${hips} ס"מ`]] : []),
      ['אחוז שומן (חישוב)', `${bf}%`],
    ];

    document.getElementById('onboarding-summary').innerHTML =
      rows.map(([label, value]) =>
        `<div class="summary-row">
          <span class="summary-label">${label}</span>
          <span class="summary-value">${value}</span>
        </div>`
      ).join('');
  }

  function _updateUI() {
    // Toggle step visibility
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const el = document.getElementById(`step-${i}`);
      if (el) el.classList.toggle('hidden', i !== _currentStep);
    }

    // Progress bar
    const pct = (_currentStep / TOTAL_STEPS) * 100;
    document.getElementById('onboarding-progress-fill').style.width = `${pct}%`;
    document.getElementById('onboarding-step-label').textContent =
      `שלב ${_currentStep} מתוך ${TOTAL_STEPS}`;

    // Back button
    const backBtn = document.getElementById('ob-back-btn');
    backBtn.style.visibility = 'visible';

    // Next/Finish button label
    document.getElementById('ob-next-btn').textContent =
      _currentStep === TOTAL_STEPS ? '🚀 התחילי לעקוב!' : 'המשך ←';
  }

  function _showError(msg) {
    document.getElementById('onboarding-error').textContent = msg;
  }

  /* ---- Expose ---- */
  global.Onboarding = { init, nextStep, prevStep };

})(window);
