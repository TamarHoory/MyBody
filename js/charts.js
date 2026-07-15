/**
 * charts.js — Chart.js Visualization Layer
 *
 * 4 charts:
 *   1. Body Fat % line + OLS trendline
 *   2. Fat Mass vs Lean Mass dual line
 *   3. Zone delta bar chart (absolute values, color-coded direction)
 *   4. Total circumference line + OLS trendline
 *
 * Point Comparison:
 *   Click any two data points on a line chart to see the Δ between them.
 *   A single click shows nothing; a second click reveals the comparison panel.
 *   A third click resets to only that new point.
 */
(function (global) {
  'use strict';

  const _instances = {};

  // Selection state: key → [] | [idx] | [idx, idx]
  const _sel = { bf: [], mass: [], volume: [] };

  /* ============================================================
   * SHARED CHART DEFAULTS
   * ============================================================ */
  const FONT_BODY = { family: "'Heebo', sans-serif", size: 11 };
  const FONT_NUM  = { family: "'Inter', sans-serif",  size: 10 };

  const BASE_OPTS = {
    responsive:          true,
    maintainAspectRatio: false,
    animation: { duration: 500 },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font:            FONT_BODY,
          padding:         14,
          usePointStyle:   true,
          pointStyleWidth: 8,
          color:           '#5A5A72',
        },
      },
      tooltip: {
        rtl:             true,
        textDirection:   'rtl',
        titleFont:       { family: "'Heebo', sans-serif", size: 12 },
        bodyFont:        { family: "'Inter', sans-serif", size: 12 },
        backgroundColor: 'rgba(26,26,46,0.88)',
        titleColor:      '#FFFFFF',
        bodyColor:       '#D0D0E0',
        padding:         10,
        cornerRadius:    10,
        caretSize:       5,
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
          threshold: 20, // Requires 20px of movement before panning starts (less sensitive)
        },
        zoom: {
          wheel: { enabled: true, speed: 0.05 },
          pinch: { enabled: true },
          mode: 'x',
        }
      }
    },
    scales: {
      x: {
        ticks: { font: FONT_NUM, color: '#9B9BAF', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        grid:  { display: false },
        border:{ display: false },
      },
      y: {
        ticks:  { font: FONT_NUM, color: '#9B9BAF' },
        grid:   { color: 'rgba(0,0,0,0.05)', lineWidth: 1 },
        border: { display: false, dash: [3, 3] },
      },
    },
  };

  /* ============================================================
   * HELPERS
   * ============================================================ */

  function _destroy(key) {
    if (_instances[key]) {
      _instances[key].destroy();
      delete _instances[key];
    }
  }

  function _clearPlaceholder(canvas) {
    canvas.style.display = 'block';
    const ph = canvas.parentElement.querySelector('.chart-ph');
    if (ph) ph.remove();
  }

  function _showPlaceholder(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    canvas.style.display = 'none';
    const parent = canvas.parentElement;
    if (!parent.querySelector('.chart-ph')) {
      const div = document.createElement('div');
      div.className = 'chart-ph no-insights';
      div.style.cssText = 'text-align:center;padding:50px 20px;color:#9B9BAF;font-size:14px;';
      div.textContent   = 'הוסיפי לפחות 2 מדידות לצפייה בגרפים';
      parent.appendChild(div);
    }
  }

  /* ============================================================
   * POINT COMPARISON SYSTEM
   * ============================================================ */

  /**
   * Handle a data-point click.
   * key      — chart key ('bf', 'mass', 'volume')
   * clickIdx — data index along the X axis
   */
  function _handleClick(key, clickIdx) {
    const sel = _sel[key];
    const pos = sel.indexOf(clickIdx);

    if (pos !== -1) {
      // Clicking an already-selected point deselects it
      sel.splice(pos, 1);
    } else if (sel.length >= 2) {
      // Third click: drop the oldest, keep the previous, add new
      sel.shift();
      sel.push(clickIdx);
    } else {
      sel.push(clickIdx);
    }

    // Redraw to update point highlight colours
    if (_instances[key]) _instances[key].update();

    // Refresh the compare panel below the chart
    _updateComparePanel(key);
  }

  /**
   * Colour callback for points — highlights selected points in amber.
   * defaultColor — the chart series colour
   */
  function _ptColor(key, defaultColor) {
    return function (ctx) {
      return _sel[key].includes(ctx.dataIndex) ? '#F59E0B' : defaultColor;
    };
  }

  function _ptRadius(key, normal) {
    return function (ctx) {
      return _sel[key].includes(ctx.dataIndex) ? normal + 4 : normal;
    };
  }

  function _ptBorderColor(key) {
    return function (ctx) {
      return _sel[key].includes(ctx.dataIndex) ? '#FFFFFF' : '#FFFFFF';
    };
  }

  /** Ensure a compare-panel div exists below the chart card. */
  function _ensureComparePanel(key) {
    const id     = `chart-compare-${key}`;
    if (document.getElementById(id)) return;
    const canvas = document.getElementById(`chart-${key}`);
    if (!canvas) return;
    const card   = canvas.closest('.carousel-item');
    if (!card)   return;
    const div    = document.createElement('div');
    div.id        = id;
    div.className = 'chart-compare-panel hidden';
    card.appendChild(div);
  }

  /** Build the compare panel HTML for two selected points on a line chart. */
  function _updateComparePanel(key) {
    const panel = document.getElementById(`chart-compare-${key}`);
    if (!panel) return;

    const sel = _sel[key];

    if (sel.length < 2) {
      panel.classList.add('hidden');
      panel.innerHTML = '';
      return;
    }

    panel.classList.remove('hidden');

    const chart    = _instances[key];
    if (!chart) return;

    // Sort chronologically
    const [i1, i2] = [...sel].sort((a, b) => a - b);
    const labels   = chart.data.labels;
    const date1    = labels[i1];
    const date2    = labels[i2];

    const rows = chart.data.datasets
      .filter(ds => !ds._isTrend)           // skip trendline
      .map(ds => {
        const v1 = ds.data[i1];
        const v2 = ds.data[i2];
        if (v1 === null || v1 === undefined || v2 === null || v2 === undefined) return null;
        const delta = parseFloat((v2 - v1).toFixed(2));
        const pct   = v1 !== 0 ? parseFloat(((delta / Math.abs(v1)) * 100).toFixed(1)) : null;
        return { label: ds.label, v1, v2, delta, pct, color: ds.borderColor };
      })
      .filter(Boolean);

    if (!rows.length) {
      panel.innerHTML = '<div class="cmp-note">לא ניתן להשוות — ערכים חסרים</div>';
      return;
    }

    const sign = d => d > 0 ? '+' : '';
    const arrow = d => d < 0 ? '▼' : (d > 0 ? '▲' : '←');
    const cls   = d => d < 0 ? 'cmp-neg' : (d > 0 ? 'cmp-pos' : 'cmp-zero');

    panel.innerHTML = `
      <div class="cmp-header">
        <span class="cmp-title">📊 השוואה בין שתי נקודות</span>
        <button class="cmp-close" onclick="ChartsController.clearCompare('${key}')">✕</button>
      </div>
      <div class="cmp-dates">
        <span class="cmp-date-a">מ-${date1}</span>
        <span class="cmp-arrow">עד</span>
        <span class="cmp-date-b">${date2}</span>
      </div>
      <div class="cmp-rows">
        ${rows.map(r => {
          const showPct = !r.label.includes('%');
          return `
          <div class="cmp-row">
            <span class="cmp-label">${r.label}</span>
            <span class="cmp-values">מ-${r.v1} ל-${r.v2}</span>
            <span class="cmp-delta ${cls(r.delta)}">
              ${arrow(r.delta)} <span dir="ltr">${sign(r.delta)}${r.delta}</span>
              ${(r.pct !== null && showPct) ? `<span class="cmp-pct">(<span dir="ltr">${sign(r.pct)}${r.pct}%</span>)</span>` : ''}
            </span>
          </div>
          `;
        }).join('')}
      </div>
      <div class="cmp-hint">לחצי על נקודה שלישית כדי לעדכן את ההשוואה</div>
    `;
  }

  /** Public: clear selection for a given key (called by close button). */
  function clearCompare(key) {
    _sel[key] = [];
    if (_instances[key]) _instances[key].update();
    const panel = document.getElementById(`chart-compare-${key}`);
    if (panel) { panel.classList.add('hidden'); panel.innerHTML = ''; }
  }

  /* ============================================================
   * PUBLIC — renderAll
   * ============================================================ */
  function renderAll() {
    const entries = StorageService.getEntries();
    const profile = StorageService.getProfile();
    const section = document.getElementById('charts-section');

    if (entries.length < 1) {
      section.classList.add('hidden');
      return;
    }
    section.classList.remove('hidden');

    if (entries.length < 2) {
      ['chart-bf', 'chart-mass', 'chart-delta', 'chart-volume'].forEach(_showPlaceholder);
      return;
    }

    const labels = entries.map(e => Formulas.formatDateLabel(e.date));

    _renderBFChart(entries, profile, labels);
    _renderMassChart(entries, profile, labels);
    _renderDeltaChart(entries);
    _renderVolumeChart(entries, labels);

    // Ensure compare panels exist
    ['bf', 'mass', 'volume'].forEach(_ensureComparePanel);
  }

  /* ============================================================
   * CHART 1 — Body Fat % + trendline
   * ============================================================ */
  function _renderBFChart(entries, profile, labels) {
    _destroy('bf');
    const canvas = document.getElementById('chart-bf');
    _clearPlaceholder(canvas);

    const bfData = entries.map(e =>
      Formulas.calcBodyFatPercent(profile.gender, {
        neck: e.neck, waist: e.waist, hips: e.hips, height: profile.height,
      })
    );

    const regression = Formulas.linearRegression(bfData.filter(v => v !== null));
    let trendPoints  = null;
    if (regression) {
      let validCount = 0;
      trendPoints = bfData.map(v => {
        if (v === null) return null;
        return regression.points[validCount++];
      });
    }

    const COLOR = '#2D7D9A';

    const datasets = [
      {
        label:                '% שומן',
        data:                 bfData,
        borderColor:          COLOR,
        backgroundColor:      'rgba(45,125,154,0.07)',
        borderWidth:          2.5,
        pointRadius:          _ptRadius('bf', 5),
        pointHoverRadius:     8,
        pointBackgroundColor: _ptColor('bf', COLOR),
        pointBorderColor:     '#FFFFFF',
        pointBorderWidth:     2,
        pointHitRadius:       14,
        fill:     true,
        tension:  0.35,
        spanGaps: true,
      },
    ];

    if (trendPoints) {
      datasets.push({
        _isTrend:     true,
        label:        'מגמה (רגרסיה לינארית)',
        data:         trendPoints,
        borderColor:  'rgba(45,125,154,0.38)',
        borderWidth:  1.8,
        borderDash:   [6, 5],
        pointRadius:  0,
        pointHitRadius: 0,
        fill:         false,
        tension:      0,
        spanGaps:     true,
      });
    }

    _instances['bf'] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        ...BASE_OPTS,
        onClick: (_, elements) => {
          if (elements.length) _handleClick('bf', elements[0].index);
        },
        scales: {
          ...BASE_OPTS.scales,
          y: {
            ...BASE_OPTS.scales.y,
            ticks: { ...BASE_OPTS.scales.y.ticks, callback: v => v + '%' },
          },
        },
        plugins: {
          ...BASE_OPTS.plugins,
          tooltip: {
            ...BASE_OPTS.plugins.tooltip,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}%` },
          },
        },
      },
    });
  }

  /* ============================================================
   * CHART 2 — Fat Mass vs Lean Mass
   * ============================================================ */
  function _renderMassChart(entries, profile, labels) {
    _destroy('mass');
    const canvas = document.getElementById('chart-mass');
    _clearPlaceholder(canvas);

    const fatData  = [];
    const leanData = [];

    entries.forEach(e => {
      const bf = Formulas.calcBodyFatPercent(profile.gender, {
        neck: e.neck, waist: e.waist, hips: e.hips, height: profile.height,
      });
      if (bf !== null) {
        const { fatMass, leanMass } = Formulas.calcMassComposition(e.weight, bf);
        fatData.push(fatMass);
        leanData.push(leanMass);
      } else {
        fatData.push(null);
        leanData.push(null);
      }
    });

    const C_FAT  = '#D95252';
    const C_LEAN = '#3DAA72';

    _instances['mass'] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label:                'מסת שומן (ק"ג)',
            data:                 fatData,
            borderColor:          C_FAT,
            backgroundColor:      'rgba(217,82,82,0.08)',
            borderWidth:          2.5,
            pointRadius:          _ptRadius('mass', 5),
            pointHoverRadius:     8,
            pointBackgroundColor: _ptColor('mass', C_FAT),
            pointBorderColor:     '#FFFFFF',
            pointBorderWidth:     2,
            pointHitRadius:       14,
            fill:     true,
            tension:  0.35,
            spanGaps: true,
          },
          {
            label:                'מסה רזה (ק"ג)',
            data:                 leanData,
            borderColor:          C_LEAN,
            backgroundColor:      'rgba(61,170,114,0.08)',
            borderWidth:          2.5,
            pointRadius:          _ptRadius('mass', 5),
            pointHoverRadius:     8,
            pointBackgroundColor: _ptColor('mass', C_LEAN),
            pointBorderColor:     '#FFFFFF',
            pointBorderWidth:     2,
            pointHitRadius:       14,
            fill:     true,
            tension:  0.35,
            spanGaps: true,
          },
        ],
      },
      options: {
        ...BASE_OPTS,
        onClick: (_, elements) => {
          if (elements.length) _handleClick('mass', elements[0].index);
        },
        scales: {
          ...BASE_OPTS.scales,
          y: {
            ...BASE_OPTS.scales.y,
            ticks: { ...BASE_OPTS.scales.y.ticks, callback: v => v + ' ק"ג' },
          },
        },
        plugins: {
          ...BASE_OPTS.plugins,
          tooltip: {
            ...BASE_OPTS.plugins.tooltip,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} ק"ג` },
          },
        },
      },
    });
  }

  /* ============================================================
   * CHART 3 — Zone Delta Bar Chart
   *
   * FIX: All bars now show ABSOLUTE values so they always start
   *      from the zero baseline and grow upward.
   *      Color encodes direction: green = reduction (good),
   *      red = increase, blue/orange = net total.
   *      Tooltip shows the real signed value.
   * ============================================================ */
  function _renderDeltaChart(entries) {
    _destroy('delta');
    const canvas = document.getElementById('chart-delta');
    _clearPlaceholder(canvas);

    const latest = entries[entries.length - 1];
    const prev   = entries[entries.length - 2];

    const ZONES = [
      { key: 'chest', label: 'חזה' },
      { key: 'waist', label: 'מותניים' },
      { key: 'hips',  label: 'אגן' },
      { key: 'thigh', label: 'ירך' },
      { key: 'arm',   label: 'זרוע' },
      { key: 'calf',  label: 'שוק' },
      { key: 'neck',  label: 'צוואר' },
    ];

    // Signed deltas (for tooltip and total)
    const signedDeltas = ZONES.map(z =>
      parseFloat(((latest[z.key] || 0) - (prev[z.key] || 0)).toFixed(1))
    );
    const totalDelta = parseFloat(signedDeltas.reduce((a, b) => a + b, 0).toFixed(1));

    // Absolute values for bar height (all bars start from bottom ↑)
    const absData   = [...signedDeltas.map(d => Math.abs(d)), Math.abs(totalDelta)];
    const allLabels = [...ZONES.map(z => z.label), 'סה"כ'];

    const allSigned = [...signedDeltas, totalDelta]; // kept for tooltip & color

    const bgColors = allSigned.map((v, i) => {
      if (i === allSigned.length - 1) {
        // Total bar: blue if net reduction (good), orange if net increase
        return v <= 0 ? 'rgba(45,125,154,0.75)' : 'rgba(224,122,44,0.75)';
      }
      if (v < 0)  return 'rgba(61,170,114,0.78)';  // reduction = green
      if (v > 0)  return 'rgba(217,82,82,0.78)';   // increase  = red
      return             'rgba(155,155,175,0.45)';  // no change = gray
    });

    const borderColors = allSigned.map((v, i) => {
      if (i === allSigned.length - 1) return v <= 0 ? '#1E5F76' : '#B06B15';
      if (v < 0) return '#2C8458';
      if (v > 0) return '#B03838';
      return '#9B9BAF';
    });

    _instances['delta'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: allLabels,
        datasets: [{
          label:           'שינוי (ס"מ)',
          data:            absData,       // ← absolute values: all bars go UP
          backgroundColor: bgColors,
          borderColor:     borderColors,
          borderWidth:     1.5,
          borderRadius:    6,
          borderSkipped:   false,
        }],
      },
      options: {
        ...BASE_OPTS,
        scales: {
          ...BASE_OPTS.scales,
          x: {
            ...BASE_OPTS.scales.x,
            ticks: { font: { family: "'Heebo', sans-serif", size: 10 }, color: '#9B9BAF' },
          },
          y: {
            ...BASE_OPTS.scales.y,
            min: 0,   // ← force baseline at zero so bars always grow upward
            ticks: {
              ...BASE_OPTS.scales.y.ticks,
              callback: v => v + ' ס"מ',
            },
          },
        },
        plugins: {
          ...BASE_OPTS.plugins,
          legend: { display: false },
          tooltip: {
            ...BASE_OPTS.plugins.tooltip,
            callbacks: {
              label: ctx => {
                // Show real signed value in tooltip (not the absolute)
                const signed = allSigned[ctx.dataIndex];
                const sign   = signed > 0 ? '+' : '';
                const icon   = signed < 0 ? '▼ ירידה' : (signed > 0 ? '▲ עלייה' : '→ ללא שינוי');
                return ` ${icon}: \u200E${sign}${signed} ס"מ`;
              },
            },
          },
        },
      },
    });
  }

  /* ============================================================
   * CHART 4 — Total Circumference + trendline
   * ============================================================ */
  function _renderVolumeChart(entries, labels) {
    _destroy('volume');
    const canvas = document.getElementById('chart-volume');
    _clearPlaceholder(canvas);

    const volumeData = entries.map(e => Formulas.calcTotalCircumference(e));
    const regression = Formulas.linearRegression(volumeData);
    const COLOR = '#6B47D6';

    const datasets = [
      {
        label:                'היקף כולל (ס"מ)',
        data:                 volumeData,
        borderColor:          COLOR,
        backgroundColor:      'rgba(107,71,214,0.07)',
        borderWidth:          2.5,
        pointRadius:          _ptRadius('volume', 5),
        pointHoverRadius:     8,
        pointBackgroundColor: _ptColor('volume', COLOR),
        pointBorderColor:     '#FFFFFF',
        pointBorderWidth:     2,
        pointHitRadius:       14,
        fill:    true,
        tension: 0.35,
      },
    ];

    if (regression) {
      datasets.push({
        _isTrend:     true,
        label:        'מגמה (רגרסיה לינארית)',
        data:         regression.points,
        borderColor:  'rgba(107,71,214,0.35)',
        borderWidth:  1.8,
        borderDash:   [6, 5],
        pointRadius:  0,
        pointHitRadius: 0,
        fill:         false,
        tension:      0,
      });
    }

    _instances['volume'] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        ...BASE_OPTS,
        onClick: (_, elements) => {
          if (elements.length) _handleClick('volume', elements[0].index);
        },
        scales: {
          ...BASE_OPTS.scales,
          y: {
            ...BASE_OPTS.scales.y,
            ticks: { ...BASE_OPTS.scales.y.ticks, callback: v => v + ' ס"מ' },
          },
        },
        plugins: {
          ...BASE_OPTS.plugins,
          tooltip: {
            ...BASE_OPTS.plugins.tooltip,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} ס"מ` },
          },
        },
      },
    });
  }

  /* ---- Expose ---- */
  global.ChartsController = { renderAll, clearCompare };

})(window);
