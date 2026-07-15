/**
 * table.js — Measurements Table Renderer
 *
 * Renders all entries newest-first in a scrollable table.
 * Computes BF% and Lean Mass per row using the Formulas module.
 */
(function (global) {
  'use strict';

  function render() {
    const entries  = StorageService.getEntries(); // sorted oldest → newest
    const profile  = StorageService.getProfile();
    const tbody    = document.getElementById('measurements-tbody');
    const wrapper  = document.getElementById('table-wrapper');
    const empty    = document.getElementById('empty-state');

    if (!entries.length) {
      wrapper.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }

    wrapper.classList.remove('hidden');
    empty.classList.add('hidden');

    // Display oldest at top, newest at bottom (chronological order)
    const displayEntries = [...entries];

    tbody.innerHTML = displayEntries.map(entry => {
      const bf = Formulas.calcBodyFatPercent(profile.gender, {
        neck:   entry.neck,
        waist:  entry.waist,
        hips:   entry.hips,
        height: profile.height,
      });

      const { leanMass } = bf !== null
        ? Formulas.calcMassComposition(entry.weight, bf)
        : { leanMass: null };

      const dateStr = Formulas.formatDateDisplay(entry.date);

      return `<tr>
        <td class="date-cell">${dateStr}</td>
        <td>${entry.weight}</td>
        <td>${entry.neck}</td>
        <td>${entry.chest}</td>
        <td>${entry.waist}</td>
        <td>${entry.hips}</td>
        <td>${entry.thigh}</td>
        <td>${entry.arm}</td>
        <td>${entry.calf}</td>
        <td class="bf-cell">${bf !== null ? bf + '%' : '—'}</td>
        <td class="lean-cell">${leanMass !== null ? leanMass + ' ק"ג' : '—'}</td>
        <td class="actions-cell">
          <button class="action-btn action-btn-edit"
                  title="עריכת מדידה"
                  onclick="EntryModal.open('${entry.id}')">✏️</button>
          <button class="action-btn action-btn-delete"
                  title="מחיקת מדידה"
                  onclick="AppController.requestDelete('${entry.id}')">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  }

  global.TableController = { render };

})(window);
