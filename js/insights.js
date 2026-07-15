/**
 * insights.js — Smart Insights Engine
 *
 * Evaluates the two most recent entries and fires a set of
 * evidence-based rules to produce localized Hebrew insights.
 *
 * Rule set (7 rules):
 *   1. Weight-loss quality (fat vs. lean ratio)
 *   2. Lean mass safety alert (> 1 kg lean loss)
 *   3. WHR (Waist-Hip Ratio) metabolic trend
 *   4. Best improvement zone (largest cm reduction)
 *   5. Plateau detection (3 entries, < 0.5 kg change)
 *   6. Rapid weight loss alert (> 1.5 kg/week implied rate)
 *   7. Weight gain flag (> 0.5 kg increase)
 */
(function (global) {
  'use strict';

  const ZONE_LABELS = {
    neck:  'צוואר',
    chest: 'חזה',
    waist: 'מותניים',
    hips:  'אגן',
    thigh: 'ירך',
    arm:   'זרוע',
    calf:  'שוק',
  };

  function render() {
    const entries = StorageService.getEntries(); // oldest → newest
    const profile = StorageService.getProfile();
    const section = document.getElementById('insights-section');
    const list    = document.getElementById('insights-list');

    // Need at least 1 entry to show the section
    if (entries.length < 1) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');

    // Need at least 2 to generate insights
    if (entries.length < 2) {
      list.innerHTML = `<div class="no-insights">
        הוסיפי לפחות שתי מדידות כדי לראות תובנות חכמות 📊
      </div>`;
      return;
    }

    const latest = entries[entries.length - 1];
    const prev   = entries[entries.length - 2];

    // --- Compute mass composition for both entries ---
    const bfLatest = Formulas.calcBodyFatPercent(profile.gender, {
      neck: latest.neck, waist: latest.waist, hips: latest.hips, height: profile.height,
    });
    const bfPrev = Formulas.calcBodyFatPercent(profile.gender, {
      neck: prev.neck, waist: prev.waist, hips: prev.hips, height: profile.height,
    });

    const { fatMass: fatL, leanMass: leanL } = bfLatest
      ? Formulas.calcMassComposition(latest.weight, bfLatest) : {};
    const { fatMass: fatP, leanMass: leanP } = bfPrev
      ? Formulas.calcMassComposition(prev.weight, bfPrev) : {};

    const weightDelta = parseFloat((latest.weight - prev.weight).toFixed(2));
    const fatDelta    = (fatL != null && fatP != null) ? parseFloat((fatL - fatP).toFixed(2)) : null;
    const leanDelta   = (leanL != null && leanP != null) ? parseFloat((leanL - leanP).toFixed(2)) : null;

    const insights = [];

    /* ---- Rule 1: Weight-loss quality ---- */
    if (weightDelta < -0.3 && fatDelta !== null && leanDelta !== null) {
      const totalLost   = Math.abs(weightDelta);
      const fatLostPct  = totalLost > 0 ? Math.abs(fatDelta) / totalLost : 0;
      const pct = Math.round(fatLostPct * 100);

      if (fatLostPct >= 0.75) {
        insights.push({
          type: 'success', icon: '✅',
          text: `איכות הירידה מצוינת! ${pct}% מהירידה הגיעה ממסת שומן — המסה הרזה נשמרה היטב.`,
        });
      } else if (fatLostPct >= 0.5) {
        insights.push({
          type: 'info', icon: '📊',
          text: `${pct}% מהירידה הגיעה ממסת שומן — תוצאה סבירה. הגדלת צריכת חלבון ואימוני כוח יעזרו לשפר יחס זה.`,
        });
      } else {
        insights.push({
          type: 'warning', icon: '⚠️',
          text: `רק ${pct}% מהירידה הגיע משומן. חשוב לשים דגש על שמירת מסה רזה — חלבון + אימוני כוח.`,
        });
      }
    }

    /* ---- Rule 2: Lean mass safety alert ---- */
    if (leanDelta !== null && leanDelta < -1.0) {
      insights.push({
        type: 'danger', icon: '🔴',
        text: `אזהרה: ירידה של ${Math.abs(leanDelta).toFixed(1)} ק"ג במסה הרזה — זוהי ירידה משמעותית. מומלץ להתייעץ עם תזונאי/ת ומאמן/ת מקצועי.`,
      });
    }

    /* ---- Rule 3: WHR metabolic trend ---- */
    if (latest.waist && latest.hips && prev.waist && prev.hips) {
      const whrNow  = parseFloat((latest.waist / latest.hips).toFixed(3));
      const whrPrev = parseFloat((prev.waist  / prev.hips).toFixed(3));
      if (whrNow < whrPrev) {
        insights.push({
          type: 'success', icon: '💚',
          text: `יחס מותניים-אגן (WHR) השתפר מ-${whrPrev} ל-${whrNow} — סימן חיובי לבריאות מטבולית ולסיכון לב-וסקולרי מופחת.`,
        });
      }
    }

    /* ---- Rule 4: Best improvement zone ---- */
    const zones = Object.keys(ZONE_LABELS);
    let maxReduction = 0;
    let bestZone     = null;

    zones.forEach(zone => {
      if (latest[zone] != null && prev[zone] != null) {
        const reduction = prev[zone] - latest[zone]; // positive = cm lost
        if (reduction > maxReduction) {
          maxReduction = reduction;
          bestZone = zone;
        }
      }
    });

    if (bestZone && maxReduction >= 0.5) {
      insights.push({
        type: 'info', icon: '💪',
        text: `האזור עם השיפור הגדול ביותר: ${ZONE_LABELS[bestZone]} — ירידה של ${maxReduction.toFixed(1)} ס"מ. כל הכבוד!`,
      });
    }

    /* ---- Rule 5: Plateau detection (requires 3 entries) ---- */
    if (entries.length >= 3) {
      const older = entries[entries.length - 3];
      const totalSwing = Math.abs(latest.weight - older.weight);
      if (totalSwing < 0.5) {
        insights.push({
          type: 'warning', icon: '📉',
          text: `נראה שהמשקל יציב בשלוש המדידות האחרונות — ייתכן שמגיעה לרמת יציבות (Plateau). שקלי לגוון את התזונה או עצימות האימונים.`,
        });
      }
    }

    /* ---- Rule 6: Rapid weight loss ---- */
    if (weightDelta < 0) {
      const ms          = Math.abs(new Date(latest.date) - new Date(prev.date));
      const days        = Math.max(1, ms / 86400000);
      const weeklyRate  = (Math.abs(weightDelta) / days) * 7;

      if (weeklyRate > 1.5) {
        insights.push({
          type: 'danger', icon: '⚡',
          text: `קצב ירידה גבוה: ~${weeklyRate.toFixed(1)} ק"ג לשבוע — מעל המומלץ (0.5–1 ק"ג). ירידה מהירה מדי עלולה לגרום לאיבוד מסה רזה וחסרים תזונתיים. היוועצי עם גורם מקצועי.`,
        });
      }
    }

    /* ---- Rule 7: Weight gain ---- */
    if (weightDelta > 0.5) {
      insights.push({
        type: 'warning', icon: '📈',
        text: `עלייה של ${weightDelta.toFixed(1)} ק"ג מהמדידה הקודמת. עלייה קצרת-טווח יכולה לנבוע מנוזלים, תקופת המחזור, או שינוי תזונתי — בדקי מגמה לאורך מספר מדידות.`,
      });
    }

    /* ---- Render ---- */
    if (!insights.length) {
      list.innerHTML = `<div class="no-insights">
        לא זוהו תובנות חריגות — המדידות שלך נראות יציבות 👍
      </div>`;
      return;
    }

    list.innerHTML = insights
      .map((ins, i) =>
        `<div class="insight-item ${ins.type}" style="animation-delay: ${i * 60}ms">
          <span class="insight-icon">${ins.icon}</span>
          <span class="insight-text">${ins.text}</span>
        </div>`
      )
      .join('');
  }

  global.InsightsController = { render };

})(window);
