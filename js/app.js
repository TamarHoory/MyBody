/**
 * app.js — Main Application Controller & Entry Point
 *
 * Responsibilities:
 *  - Boot sequence: decides between onboarding vs. main app
 *  - init() / refresh() — orchestrates all sub-module renders
 *  - Delete flow (request → confirm dialog → confirm/cancel)
 *  - CSV export with UTF-8 BOM for Excel Hebrew compatibility
 */
(function (global) {
  'use strict';

  let _pendingDeleteId = null;

  /* ============================================================
   * RENDER APP — centralized UI state management
   * ============================================================ */
  function renderApp() {
    const loginOverlay = document.getElementById('login-overlay');
    const onboardingOverlay = document.getElementById('onboarding-overlay');
    const appContainer = document.getElementById('app');

    const user = StorageService.getCurrentUser();
    
    // 1. If not logged in -> Show Login Screen
    if (!user) {
      loginOverlay.classList.remove('hidden');
      onboardingOverlay.classList.add('hidden');
      appContainer.classList.add('hidden');
      return;
    }

    // 2. If logged in but no profile -> Show Onboarding Screen
    if (!StorageService.isSetupComplete()) {
      loginOverlay.classList.add('hidden');
      appContainer.classList.add('hidden');
      onboardingOverlay.classList.remove('hidden');
      Onboarding.init();
      return;
    }

    // 3. If logged in and profile exists -> Show Dashboard
    loginOverlay.classList.add('hidden');
    onboardingOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    init();
  }

  /* ============================================================
   * INIT — set up header + render all components
   * ============================================================ */
  function init() {
    const profile = StorageService.getProfile();
    if (!profile) return;

    const genderLabel = profile.gender === 'female' ? 'נקבה' : 'זכר';
    document.getElementById('profile-subtitle').textContent =
      `${genderLabel} · גיל ${profile.age} · גובה ${profile.height} ס"מ`;

    refresh();
  }

  /* ============================================================
   * REFRESH — re-render every UI component
   * ============================================================ */
  function refresh() {
    TableController.render();
    KPIController.render();
    InsightsController.render();
    ChartsController.renderAll();
  }

  /* ============================================================
   * DELETE FLOW
   * ============================================================ */
  function requestDelete(id) {
    _pendingDeleteId = id;
    document.getElementById('confirm-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function confirmDelete() {
    if (_pendingDeleteId) {
      StorageService.deleteEntry(_pendingDeleteId);
      _pendingDeleteId = null;
    }
    _closeConfirm();
    refresh();
  }

  function cancelDelete() {
    _pendingDeleteId = null;
    _closeConfirm();
  }

  function _closeConfirm() {
    document.getElementById('confirm-overlay').classList.add('hidden');
    document.body.style.overflow = '';
  }

  /* ============================================================
   * CSV EXPORT
   * Includes UTF-8 BOM (\uFEFF) so Excel opens Hebrew correctly
   * without needing an import wizard.
   * ============================================================ */
  function exportCSV() {
    const entries = StorageService.getEntries(); // oldest → newest
    const profile = StorageService.getProfile();

    if (!entries.length) {
      alert('אין נתונים לייצוא. הוסיפי לפחות מדידה אחת.');
      return;
    }

    const headers = [
      'תאריך',
      'משקל (ק"ג)',
      'צוואר (ס"מ)',
      'חזה (ס"מ)',
      'מותניים (ס"מ)',
      'אגן (ס"מ)',
      'ירך (ס"מ)',
      'זרוע (ס"מ)',
      'שוק (ס"מ)',
      '% שומן (Navy)',
      'מסת שומן (ק"ג)',
      'מסה רזה (ק"ג)',
      'היקף כולל (ס"מ)',
      'BMR (קל׳/יום)',
    ];

    const rows = entries.map(e => {
      const bf = Formulas.calcBodyFatPercent(profile.gender, {
        neck: e.neck, waist: e.waist, hips: e.hips, height: profile.height,
      });
      const { fatMass, leanMass } = bf !== null
        ? Formulas.calcMassComposition(e.weight, bf)
        : { fatMass: '', leanMass: '' };
      const totalCirc = Formulas.calcTotalCircumference(e);
      const bmr       = Formulas.calcBMR(profile.gender, e.weight, profile.height, profile.age);

      return [
        e.date,
        e.weight,
        e.neck,
        e.chest,
        e.waist,
        e.hips,
        e.thigh,
        e.arm,
        e.calf,
        bf !== null ? bf : '',
        fatMass,
        leanMass,
        totalCirc,
        bmr,
      ];
    });

    // Add profile info rows at top
    const profileRows = [
      ['מגדר', profile.gender === 'female' ? 'נקבה' : 'זכר', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['גיל',  profile.age + ' שנים',                          '', '', '', '', '', '', '', '', '', '', '', ''],
      ['גובה', profile.height + ' ס"מ',                        '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', ''], // blank separator
    ];

    const BOM  = '\uFEFF';
    const csv  = BOM + [...profileRows, headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    const today    = new Date().toISOString().slice(0, 10);
    a.href         = url;
    a.download     = `MyBody_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ============================================================
   * EXPOSE & AUTO-BOOT
   * ============================================================  /* ---- Expose Globals ---- */
  global.AppController = {
    renderApp,
    init,
    refresh,
    requestDelete,
    confirmDelete,
    cancelDelete,
    exportCSV,
  };

  /* ============================================================
   * CAROUSEL SCROLL LOGIC
   * ============================================================ */
  global.updateCarouselDots = function() {
    const carousel = document.getElementById('chart-carousel');
    const dots = document.querySelectorAll('.carousel-dots .dot');
    if (!carousel || dots.length === 0) return;

    const scrollLeft = carousel.scrollLeft;
    // Note: scrollLeft is negative or positive depending on RTL/LTR and browser.
    // Let's use absolute value and calculate the index based on item width.
    const itemWidth = carousel.clientWidth;
    const index = Math.round(Math.abs(scrollLeft) / itemWidth);

    dots.forEach((dot, i) => {
      if (i === index) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  };

})(window);
