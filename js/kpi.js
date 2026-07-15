/**
 * kpi.js — KPI Delta Cards
 *
 * Displays 4 circumference KPI cards (RTL order: חזה | מותניים | אגן | ירך)
 * Each card shows the current value and Δ from the previous entry.
 *
 * Color semantics (for circumferences):
 *   Reduction (▼, green) = positive progress
 *   Increase  (▲, red)   = unfavourable
 */
(function (global) {
  'use strict';

  // RTL visual order: right → left
  const ZONES = [
    { key: 'weight', label: 'משקל', unit: 'ק"ג' },
    { key: 'chest',  label: 'חזה', unit: 'ס"מ' },
    { key: 'waist',  label: 'מותניים', unit: 'ס"מ' },
    { key: 'hips',   label: 'אגן', unit: 'ס"מ' },
    { key: 'thigh',  label: 'ירך', unit: 'ס"מ' },
  ];

  function render() {
    const entries = StorageService.getEntries(); // oldest → newest
    const section = document.getElementById('kpi-section');
    const grid    = document.getElementById('kpi-grid');

    if (entries.length < 1) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');

    const latest = entries[entries.length - 1];
    const prev   = entries.length >= 2 ? entries[entries.length - 2] : null;

    grid.innerHTML = ZONES.map(zone => {
      const value   = latest[zone.key];
      let deltaHTML = '';

      if (prev && prev[zone.key] != null && value != null) {
        const delta      = parseFloat((value - prev[zone.key]).toFixed(1));
        const isReduction = delta < 0;
        const isNeutral   = delta === 0;
        const sign        = delta > 0 ? '+' : '';
        const arrow       = isNeutral ? '→' : (delta < 0 ? '▼' : '▲');
        const cls         = isNeutral ? 'neutral' : (isReduction ? 'negative' : 'positive');

        deltaHTML = `<div class="kpi-delta ${cls}">${arrow} <span dir="ltr">${sign}${delta}</span> ${zone.unit}</div>`;
      }

      return `<div class="kpi-card">
        <div class="kpi-label">${zone.label}</div>
        <div class="kpi-value">${value != null ? value : '—'}</div>
        <div class="kpi-unit">${zone.unit}</div>
        ${deltaHTML}
      </div>`;
    }).join('');
  }

  global.KPIController = { render };

})(window);
