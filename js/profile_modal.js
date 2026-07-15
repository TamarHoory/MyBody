/**
 * profile_modal.js — Profile View & Edit Modal
 *
 * Displays:
 *   - Current BF% (latest entry), BMR, and TDEE (@sedentary)
 *   - Gender, Age, Height as editable fields
 *
 * Saving updates the profile in localStorage and re-renders the header subtitle.
 */
(function (global) {
  'use strict';

  let _selectedGender = null;

  /* ---- Public API ---- */

  function open() {
    const profile = StorageService.getProfile();
    if (!profile) return;

    _selectedGender = profile.gender;

    // Pre-fill edit fields
    if (profile.birthDate) {
      document.getElementById('profile-birthdate').value = profile.birthDate;
    }
    document.getElementById('profile-height').value   = profile.height;
    if (profile.activityLevel) {
      document.getElementById('profile-activity').value = profile.activityLevel;
    }

    // Mark correct gender button
    _updateGenderButtons(profile.gender);

    // Render read-only stats card
    _renderStats(profile);

    // Clear any previous error
    document.getElementById('profile-modal-error').textContent = '';

    document.getElementById('profile-modal-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    document.getElementById('profile-modal-overlay').classList.add('hidden');
    document.body.style.overflow = '';
  }

  function closeOnBackdrop(event) {
    if (event.target.id === 'profile-modal-overlay') close();
  }

  function selectGender(gender) {
    _selectedGender = gender;
    _updateGenderButtons(gender);
  }

  function save() {
    const bdateRaw    = document.getElementById('profile-birthdate').value;
    const heightRaw = document.getElementById('profile-height').value;
    const actRaw    = document.getElementById('profile-activity').value;

    const bdate = bdateRaw;
    const height = parseFloat(String(heightRaw).trim().replace(',', '.'));
    const activityLevel = parseFloat(actRaw) || 1.45;

    if (!_selectedGender) {
      _showError('נא לבחור מגדר'); return;
    }
    if (!bdate) {
      _showError('נא להזין תאריך לידה תקין'); return;
    }
    
    const bYear = new Date(bdate).getFullYear();
    const currentYear = new Date().getFullYear();
    if (bYear < currentYear - 100 || bYear > currentYear - 10) {
      _showError('נא להזין תאריך לידה הגיוני (גיל 10-100)'); return;
    }
    if (isNaN(height) || height < 100 || height > 250) {
      _showError('נא להזין גובה תקין (100–250 ס"מ)'); return;
    }

    StorageService.saveProfile({ gender: _selectedGender, birthDate: bdate, height, activityLevel });

    close();
    AppController.init();  // Re-render header + all components
  }

  /* ---- Private ---- */

  function _renderRangeBar(val, min, max, breakpoints, colors) {
    if (val === null || isNaN(val)) return '';
    const span = max - min;
    let gradientStops = [];
    let currentPct = 0;
    
    for (let i = 0; i < breakpoints.length; i++) {
      const bpPct = Math.max(0, Math.min(100, ((breakpoints[i] - min) / span) * 100));
      const col = colors[i];
      gradientStops.push(`${col} ${currentPct}%, ${col} ${bpPct}%`);
      currentPct = bpPct;
    }
    const lastCol = colors[colors.length - 1];
    gradientStops.push(`${lastCol} ${currentPct}%, ${lastCol} 100%`);
    
    const gradient = `linear-gradient(to left, ${gradientStops.join(', ')})`;
    let valPct = Math.max(0, Math.min(100, ((val - min) / span) * 100));
    
    return `
      <div style="position: relative; margin-top: 15px; margin-bottom: 5px; margin-left: 5px; margin-right: 5px;">
        <div style="height: 5px; border-radius: 3px; background: ${gradient};"></div>
        <div style="position: absolute; top: -11px; right: ${valPct}%; transform: translateX(50%); font-size: 10px; color: var(--color-text-primary);">▼</div>
      </div>
    `;
  }

  function _renderStats(profile) {
    const card = document.getElementById('profile-derived-stats');
    const entries = StorageService.getEntries();
    if (!entries || entries.length === 0) {
      card.innerHTML = '<div style="color:var(--color-text-muted); text-align:center; padding: 20px;">אין עדיין מדידות</div>';
      return;
    }

    const latest = entries[entries.length - 1];
    const bf = Formulas.calcBodyFatPercent(profile.gender, {
      neck:   latest.neck,
      waist:  latest.waist,
      hips:   latest.hips,
      height: profile.height,
    });

    const bmr  = Formulas.calcBMR(profile.gender, latest.weight, profile.height, profile.age);
    const actLvl = profile.activityLevel || 1.45;
    const tdee = Formulas.calcTDEE(bmr, actLvl);

    const heightM = profile.height / 100;
    const h2 = heightM * heightM;
    const bmi = parseFloat((latest.weight / h2).toFixed(1));

    // Calculate range bars
    const weightBar = _renderRangeBar(latest.weight, 15*h2, 35*h2, [18.5*h2, 25*h2, 30*h2], ['#4DB8FF', '#3DAA72', '#E07A2C', '#D95252']);
    const bmiBar = _renderRangeBar(bmi, 15, 35, [18.5, 25, 30], ['#4DB8FF', '#3DAA72', '#E07A2C', '#D95252']);
    
    let bfBar = '';
    if (bf !== null) {
      if (profile.gender === 'female') {
        bfBar = _renderRangeBar(bf, 10, 45, [14, 32, 40], ['#4DB8FF', '#3DAA72', '#E07A2C', '#D95252']);
      } else {
        bfBar = _renderRangeBar(bf, 2, 35, [6, 25, 30], ['#4DB8FF', '#3DAA72', '#E07A2C', '#D95252']);
      }
    }

    card.innerHTML = `
      <div class="profile-stats-title">📊 הנתונים האחרונים שלך (${Formulas.formatDateDisplay(latest.date)})</div>
      <div class="profile-stats-grid">
        <div class="profile-stat">
          <div class="profile-stat-label">משקל נוכחי</div>
          <div class="profile-stat-value">${latest.weight} ק"ג</div>
          ${weightBar}
        </div>
        <div class="profile-stat">
          <div class="profile-stat-label">אחוז שומן</div>
          <div class="profile-stat-value">${bf !== null ? bf + '%' : '—'}</div>
          ${bfBar}
        </div>
        <div class="profile-stat">
          <div class="profile-stat-label">BMI (מדד מסת גוף)</div>
          <div class="profile-stat-value">${bmi}</div>
          ${bmiBar}
        </div>
        <div class="profile-stat">
          <div class="profile-stat-label">BMR (מנוחה)</div>
          <div class="profile-stat-value">${bmr.toLocaleString('he-IL')} קל׳</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-label">TDEE (מותאם לפעילות)</div>
          <div class="profile-stat-value">${tdee.toLocaleString('he-IL')} קל׳</div>
        </div>
      </div>
    `;
  }

  /**
   * Returns a label + CSS class for the BF% category.
   * Based on ACE (American Council on Exercise) classification.
   */
  function _bfCategory(bf, gender) {
    if (bf === null) return null;
    if (gender === 'female') {
      if (bf < 14)       return { label: 'ספורטאית עלית',  cls: 'tag-elite'    };
      if (bf < 21)       return { label: 'ספורטאית',        cls: 'tag-athlete'  };
      if (bf < 25)       return { label: 'כשיר',             cls: 'tag-fit'      };
      if (bf < 32)       return { label: 'ממוצע',            cls: 'tag-average'  };
      return               { label: 'מעל הממוצע',          cls: 'tag-above'    };
    } else {
      if (bf < 6)        return { label: 'ספורטאי עלית',   cls: 'tag-elite'    };
      if (bf < 14)       return { label: 'ספורטאי',         cls: 'tag-athlete'  };
      if (bf < 18)       return { label: 'כשיר',             cls: 'tag-fit'      };
      if (bf < 25)       return { label: 'ממוצע',            cls: 'tag-average'  };
      return               { label: 'מעל הממוצע',          cls: 'tag-above'    };
    }
  }

  function _updateGenderButtons(gender) {
    ['female', 'male'].forEach(g => {
      const btn = document.getElementById(`profile-btn-${g}`);
      if (btn) btn.classList.toggle('selected', g === gender);
    });
  }

  function _showError(msg) {
    document.getElementById('profile-modal-error').textContent = msg;
  }

  /* ---- Expose ---- */
  global.ProfileModal = { open, close, closeOnBackdrop, selectGender, save };

})(window);
