/**
 * nutrition.js — Nutrition & Deficit Simulator Modal
 *
 * Displays BMR based on the latest entry + user profile.
 * Activity dropdown drives TDEE live.
 * Calorie slider (1200–2500 kcal, step 100) drives thermodynamic forecast.
 */
(function (global) {
  'use strict';

  const SLIDER_MIN  = 1200;
  const SLIDER_MAX  = 2500;
  const SLIDER_STEP = 100;

  /* ---- Public API ---- */

  function open() {
    const overlay = document.getElementById('nutrition-modal-overlay');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Sync activity dropdown with profile setting
    const profile = StorageService.getProfile();
    if (profile && profile.activityLevel) {
      document.getElementById('activity-select').value = profile.activityLevel;
    }

    _populateProfile();
    _buildSliderTicks();
    update();
  }

  function close() {
    document.getElementById('nutrition-modal-overlay').classList.add('hidden');
    document.body.style.overflow = '';
  }

  function closeOnBackdrop(event) {
    if (event.target.id === 'nutrition-modal-overlay') close();
  }

  /** Called on every slider tick and dropdown change. */
  function update() {
    const profile = StorageService.getProfile();
    const entries = StorageService.getEntries();
    if (!profile || !entries.length) return;

    const latest   = entries[entries.length - 1];
    const bmr      = Formulas.calcBMR(profile.gender, latest.weight, profile.height, profile.age);
    const activity = parseFloat(document.getElementById('activity-select').value);
    const tdee     = Formulas.calcTDEE(bmr, activity);
    const intake   = parseInt(document.getElementById('calorie-slider').value, 10);

    // Update slider track fill dynamically
    _updateSliderFill(intake);

    // TDEE display
    document.getElementById('tdee-value').textContent = tdee.toLocaleString('he-IL');

    // Slider value display
    document.getElementById('calorie-slider-value').textContent = intake.toLocaleString('he-IL');

    // Forecast
    const { dailyBalance, weeklyChange, monthlyChange } =
      Formulas.calcThermodynamicForecast(intake, tdee);

    _renderBalance(dailyBalance);
    _renderPrediction(weeklyChange, monthlyChange, latest.weight);
  }

  /* ---- Private ---- */

  function _populateProfile() {
    const profile = StorageService.getProfile();
    const entries = StorageService.getEntries();
    if (!profile || !entries.length) return;

    const latest     = entries[entries.length - 1];
    const bmr        = Formulas.calcBMR(profile.gender, latest.weight, profile.height, profile.age);
    const genderLbl  = profile.gender === 'female' ? 'נקבה' : 'זכר';

    document.getElementById('nutrition-profile-summary').innerHTML = `
      <div class="nutrition-profile-row">
        <span class="nutrition-profile-label">מגדר</span>
        <span class="nutrition-profile-value">${genderLbl}</span>
      </div>
      <div class="nutrition-profile-row">
        <span class="nutrition-profile-label">גיל</span>
        <span class="nutrition-profile-value">${profile.age} שנים</span>
      </div>
      <div class="nutrition-profile-row">
        <span class="nutrition-profile-label">גובה</span>
        <span class="nutrition-profile-value">${profile.height} ס"מ</span>
      </div>
      <div class="nutrition-profile-row">
        <span class="nutrition-profile-label">משקל נוכחי</span>
        <span class="nutrition-profile-value">${latest.weight} ק"ג</span>
      </div>
      <div class="nutrition-profile-row">
        <span class="nutrition-profile-label">🔋 BMR (מנוחה מלאה)</span>
        <span class="nutrition-profile-value">${bmr.toLocaleString('he-IL')} קל׳/יום</span>
      </div>
    `;
  }

  function _buildSliderTicks() {
    const container = document.getElementById('slider-ticks');
    // Place a tick every 325 kcal approximately to get ~5 ticks
    const ticks     = [];
    for (let v = SLIDER_MIN; v <= SLIDER_MAX; v += 325) {
      ticks.push(v);
    }
    if (ticks[ticks.length - 1] !== SLIDER_MAX) ticks.push(SLIDER_MAX);

    container.innerHTML = ticks
      .map(v => `<span class="slider-tick">${v}</span>`)
      .join('');
  }

  function _updateSliderFill(value) {
    const slider = document.getElementById('calorie-slider');
    const pct    = ((value - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
    // LTR slider: fill from left
    slider.style.background =
      `linear-gradient(to right, var(--color-primary) ${pct}%, var(--color-border) ${pct}%)`;
  }

  function _renderBalance(dailyBalance) {
    const el = document.getElementById('forecast-balance');
    const abs = Math.abs(dailyBalance);

    if (dailyBalance < 0) {
      el.innerHTML = `מאזן יומי: <span class="forecast-deficit">גירעון של ${abs.toLocaleString('he-IL')} קל׳</span>`;
    } else if (dailyBalance > 0) {
      el.innerHTML = `מאזן יומי: <span class="forecast-surplus">עודף של ${abs.toLocaleString('he-IL')} קל׳</span>`;
    } else {
      el.innerHTML = `מאזן יומי: <span class="forecast-neutral">תחזוקה — ללא שינוי צפוי במשקל</span>`;
    }
  }

  function _renderPrediction(weeklyChange, monthlyChange, currentWeight) {
    const el = document.getElementById('forecast-prediction');

    if (weeklyChange === 0) {
      el.innerHTML = `צפי: <strong>יציבות במשקל (${currentWeight} ק"ג)</strong>`;
      return;
    }

    const weeklyAbs  = Math.abs(weeklyChange).toFixed(2);
    const monthlyAbs = Math.abs(monthlyChange).toFixed(1);
    const direction  = weeklyChange < 0 ? 'ירידה' : 'עלייה';
    const expectedWeight = (currentWeight + monthlyChange).toFixed(1);

    el.innerHTML =
      `צפי ${direction}: <strong>${weeklyAbs} ק"ג בשבוע | ${monthlyAbs} ק"ג בחודש (צפי ל-${expectedWeight} ק"ג)</strong>`;
  }

  /* ---- Expose ---- */
  global.NutritionModal = { open, close, closeOnBackdrop, update };

})(window);
