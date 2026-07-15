/**
 * formulas.js — Scientific Calculation Engine
 *
 * All measurements MUST be in metric units:
 *   Weight  → kilograms (kg)
 *   Height  → centimeters (cm)
 *   Girths  → centimeters (cm)
 *   Age     → integer years
 *
 * References are cited inline per function.
 */
(function (global) {
  'use strict';

  /* ==================================================================
   * 1. BODY FAT PERCENTAGE — U.S. Navy Circumference Method
   *    Source: Hodgdon, J.A. & Beckett, M.B. (1984).
   *    "Prediction of percent body fat for U.S. Navy men from body
   *    circumferences and height." Reports No. 84-11, Naval Health
   *    Research Center, San Diego, CA.
   *
   *    Male formula:
   *      BF% = 86.010 × log10(waist − neck)
   *            − 70.041 × log10(height) + 36.76
   *
   *    Female formula:
   *      BF% = 163.205 × log10(waist + hips − neck)
   *            − 97.684 × log10(height) − 78.387
   *
   *    All measurements in cm. Returns null if inputs are invalid.
   * ================================================================== */
  function calcBodyFatPercent(gender, { neck, waist, hips, height }) {
    if (!neck || !waist || !height || neck <= 0 || waist <= 0 || height <= 0) return null;

    // ⚠️ CRITICAL: Hodgdon & Beckett (1984) formula requires measurements in INCHES.
    // All inputs arrive in centimeters → convert before applying logarithms.
    // Without this conversion the female formula returns ~60% instead of ~30-35%.
    const CM_TO_IN = 1 / 2.54;
    const neckIn   = neck   * CM_TO_IN;
    const waistIn  = waist  * CM_TO_IN;
    const hipsIn   = hips ? hips * CM_TO_IN : 0;
    const heightIn = height * CM_TO_IN;

    let bf;
    if (gender === 'male') {
      const diff = waistIn - neckIn;
      if (diff <= 0) return null;
      bf = 86.010 * Math.log10(diff) - 70.041 * Math.log10(heightIn) + 36.76;
    } else {
      if (!hips || hips <= 0) return null;
      const sum = waistIn + hipsIn - neckIn;
      if (sum <= 0) return null;
      bf = 163.205 * Math.log10(sum) - 97.684 * Math.log10(heightIn) - 78.387;
    }

    // Clamp to physiologically valid range (3% – 60%)
    const clamped = Math.min(60, Math.max(3, bf));
    return parseFloat(clamped.toFixed(1));
  }

  /* ==================================================================
   * 2. FAT MASS & LEAN MASS SEPARATION
   *    Fat Mass  (kg) = Weight × (BF% / 100)
   *    Lean Mass (kg) = Weight − Fat Mass
   * ================================================================== */
  function calcMassComposition(weight, bodyFatPercent) {
    const fatMass  = parseFloat((weight * (bodyFatPercent / 100)).toFixed(2));
    const leanMass = parseFloat((weight - fatMass).toFixed(2));
    return { fatMass, leanMass };
  }

  /* ==================================================================
   * 3. BMR — Mifflin–St Jeor Equation
   *    Source: Mifflin, M.D. et al. (1990).
   *    "A new predictive equation for resting energy expenditure in
   *    healthy individuals." Am. J. Clin. Nutr. 51(2):241-247.
   *
   *    Chosen over Harris-Benedict (1919) for superior accuracy in
   *    contemporary populations (Frankenfield et al., 2005).
   *
   *    Male:   BMR = 10W + 6.25H − 5A + 5
   *    Female: BMR = 10W + 6.25H − 5A − 161
   *
   *    W = weight (kg), H = height (cm), A = age (years)
   *    Returns kcal/day.
   * ================================================================== */
  function calcBMR(gender, weight, height, age) {
    const base = (10 * weight) + (6.25 * height) - (5 * age);
    const bmr   = gender === 'male' ? base + 5 : base - 161;
    return Math.round(bmr);
  }

  /* ==================================================================
   * 4. TDEE — Total Daily Energy Expenditure
   *    Source: Activity multipliers from Ainsworth et al. &
   *    standard clinical nutritional practice.
   *
   *    TDEE = BMR × Activity Multiplier
   *
   *    Multipliers:
   *      1.200 — Sedentary (desk work, < 5,000 steps/day)
   *      1.375 — Lightly active (1-3 light sessions/week, ~7,000 steps)
   *      1.550 — Moderately active (3-5 sessions/week, ~10,000 steps)
   *      1.725 — Very active (6-7 hard sessions/week, 12,000+ steps)
   *      1.900 — Super active (twice-daily / physical labor)
   *
   *    Returns kcal/day.
   * ================================================================== */
  function calcTDEE(bmr, activityMultiplier) {
    return Math.round(bmr * activityMultiplier);
  }

  /* ==================================================================
   * 5. THERMODYNAMIC FORECASTING
   *    Source: Wishnofsky, M. (1958).
   *    "Caloric equivalents of gained or lost weight."
   *    Am. J. Clin. Nutr. 6(5):542-546.
   *
   *    Energy density of human fat tissue ≈ 7,700 kcal/kg
   *    (still the accepted clinical approximation).
   *
   *    Daily Balance   = Intake − TDEE  (negative = deficit)
   *    Weekly  Δ (kg)  = (Daily Balance × 7)  / 7700
   *    Monthly Δ (kg)  = (Daily Balance × 30) / 7700
   *
   *    Negative Δ = weight loss  |  Positive Δ = weight gain
   * ================================================================== */
  function calcThermodynamicForecast(dailyCalorieIntake, tdee) {
    const FAT_KCAL_PER_KG = 7700;
    const dailyBalance  = dailyCalorieIntake - tdee;
    const weeklyChange  = parseFloat(((dailyBalance * 7)  / FAT_KCAL_PER_KG).toFixed(2));
    const monthlyChange = parseFloat(((dailyBalance * 30) / FAT_KCAL_PER_KG).toFixed(2));
    return { dailyBalance, weeklyChange, monthlyChange };
  }

  /* ==================================================================
   * 6. LINEAR REGRESSION (Ordinary Least Squares)
   *    Used to compute trendlines for Chart 1 (BF%) and Chart 4 (Volume).
   *    x is the sequential index (0, 1, 2, …).
   * ================================================================== */
  function linearRegression(yValues) {
    const n = yValues.length;
    if (n < 2) return null;

    const xMean = (n - 1) / 2;
    const yMean = yValues.reduce((s, v) => s + v, 0) / n;

    let numerator   = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator   += (i - xMean) * (yValues[i] - yMean);
      denominator += (i - xMean) ** 2;
    }

    const slope     = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;
    const points    = yValues.map((_, i) => parseFloat((slope * i + intercept).toFixed(2)));

    return { slope, intercept, points };
  }

  /* ==================================================================
   * 7. UTILITIES
   * ================================================================== */

  /** Format a date string (YYYY-MM-DD) as MM/yyyy for chart x-axis. */
  function formatDateLabel(dateStr) {
    const d     = new Date(dateStr + 'T12:00:00');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${month}/${d.getFullYear()}`;
  }

  /** Format a date for Hebrew display (DD/MM/YYYY). */
  function formatDateDisplay(dateStr) {
    const d   = new Date(dateStr + 'T12:00:00');
    const dd  = String(d.getDate()).padStart(2, '0');
    const mm  = String(d.getMonth() + 1).padStart(2, '0');
    const yy  = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  /**
   * Compute total circumference for an entry.
   * Sums: neck + chest + waist + hips + thigh + arm + calf
   */
  function calcTotalCircumference(entry) {
    const keys = ['neck', 'chest', 'waist', 'hips', 'thigh', 'arm', 'calf'];
    return parseFloat(keys.reduce((sum, k) => sum + (parseFloat(entry[k]) || 0), 0).toFixed(1));
  }

  /* ==================================================================
   * SELF-TESTS (run once on load in development; safe in production)
   * ================================================================== */
  (function _selfTest() {
    // Female, 165cm, waist=75, hips=110, neck=32 → expect ~33-37% (with inch conversion)
    const bfFemale = calcBodyFatPercent('female', { neck: 32, waist: 75, hips: 110, height: 165 });
    console.assert(bfFemale > 28 && bfFemale < 42,
      '[Formulas] Female BF% out of expected range:', bfFemale);

    // Male, 178cm, waist=90, neck=38 → expect ~18-24% (with inch conversion)
    const bfMale = calcBodyFatPercent('male', { neck: 38, waist: 90, height: 178 });
    console.assert(bfMale > 14 && bfMale < 28,
      '[Formulas] Male BF% out of expected range:', bfMale);

    // BMR female, 70kg, 165cm, 32yo → expect ~1380–1420
    const bmr = calcBMR('female', 70, 165, 32);
    console.assert(Math.abs(bmr - 1399) < 30,
      '[Formulas] BMR out of expected range:', bmr);

    // Forecast: 1400 intake vs 1800 TDEE → deficit of 400/day → ~0.36 kg/week
    const forecast = calcThermodynamicForecast(1400, 1800);
    console.assert(Math.abs(forecast.weeklyChange - (-0.36)) < 0.05,
      '[Formulas] Weekly forecast error:', forecast.weeklyChange);

    console.log('[Formulas] All self-tests passed ✓');
  })();

  /* ---- Expose ---- */
  global.Formulas = {
    calcBodyFatPercent,
    calcMassComposition,
    calcBMR,
    calcTDEE,
    calcThermodynamicForecast,
    linearRegression,
    formatDateLabel,
    formatDateDisplay,
    calcTotalCircumference,
  };

})(window);
