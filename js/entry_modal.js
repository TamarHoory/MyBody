/**
 * entry_modal.js — Add / Edit Measurement Entry Modal
 *
 * Manages the modal for adding new entries and editing existing ones.
 * Exposes: EntryModal.open(id?), EntryModal.close(), EntryModal.save()
 */
(function (global) {
  'use strict';

  let _editingId = null;

  /**
   * Parse a numeric string that may use either '.' or ',' as the decimal
   * separator. Israeli/European mobile keyboards often output a comma.
   * e.g. "29,5" → 29.5 instead of the broken parseFloat result of 29.
   */
  function _parseDecimal(str) {
    return parseFloat(String(str).trim().replace(',', '.'));
  }

  const FIELD_DEFS = [
    { id: 'date',   label: 'תאריך',    type: 'date'   },
    { id: 'weight', label: 'משקל',    min: 30,  max: 300, step: 0.1 },
    { id: 'neck',   label: 'צוואר',   min: 20,  max: 80,  step: 0.5 },
    { id: 'chest',  label: 'חזה',     min: 50,  max: 200, step: 0.5 },
    { id: 'waist',  label: 'מותניים', min: 40,  max: 200, step: 0.5 },
    { id: 'hips',   label: 'אגן',     min: 50,  max: 200, step: 0.5 },
    { id: 'thigh',  label: 'ירך',     min: 30,  max: 120, step: 0.5 },
    { id: 'arm',    label: 'זרוע',    min: 15,  max: 70,  step: 0.5 },
    { id: 'calf',   label: 'שוק',     min: 20,  max: 80,  step: 0.5 },
  ];

  /* ---- Public API ---- */

  /**
   * Open the modal.
   * @param {string|undefined} id — if provided, loads that entry for editing.
   */
  function open(id) {
    _editingId = id || null;
    _clearError();

    document.getElementById('entry-modal-title').textContent =
      _editingId ? 'עריכת מדידה' : 'הוספת מדידה חדשה';

    if (_editingId) {
      // Pre-fill form with existing data
      const entry = StorageService.getEntries().find(e => e.id === _editingId);
      if (!entry) return;
      FIELD_DEFS.forEach(f => {
        const el = document.getElementById(`entry-${f.id}`);
        if (el) el.value = entry[f.id] !== undefined ? entry[f.id] : '';
      });
    } else {
      // Clear form and set today's date
      FIELD_DEFS.forEach(f => {
        const el = document.getElementById(`entry-${f.id}`);
        if (el) el.value = '';
      });
      document.getElementById('entry-date').value =
        new Date().toISOString().split('T')[0];
    }

    document.getElementById('entry-modal-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Focus date field (or weight if editing)
    setTimeout(() => {
      const focusId = _editingId ? 'entry-weight' : 'entry-date';
      const el = document.getElementById(focusId);
      if (el) el.focus();
    }, 100);
  }

  function close() {
    document.getElementById('entry-modal-overlay').classList.add('hidden');
    document.body.style.overflow = '';
    _editingId = null;
  }

  function closeOnBackdrop(event) {
    if (event.target.id === 'entry-modal-overlay') close();
  }

  function save() {
    const profile = StorageService.getProfile();
    const entry   = {};

    // --- Validate all fields ---
    for (const f of FIELD_DEFS) {
      const el = document.getElementById(`entry-${f.id}`);

      if (f.type === 'date') {
        if (!el.value) { _showError('נא לבחור תאריך'); return; }
        entry.date = el.value;
        continue;
      }

      const val = _parseDecimal(el.value);
      if (isNaN(val) || val < f.min || val > f.max) {
        _showError(`נא להזין ערך תקין עבור: ${f.label} (${f.min}–${f.max})`);
        el.focus();
        return;
      }
      entry[f.id] = val;
    }

    // --- Validate BF% formula can run ---
    const bf = Formulas.calcBodyFatPercent(profile.gender, {
      neck:   entry.neck,
      waist:  entry.waist,
      hips:   entry.hips,
      height: profile.height,
    });

    if (bf === null) {
      _showError('לא ניתן לחשב אחוז שומן — יש לוודא שמותניים > צוואר');
      return;
    }

    // --- Persist ---
    if (_editingId) {
      StorageService.updateEntry(_editingId, entry);
    } else {
      StorageService.addEntry(entry);
    }

    close();
    AppController.refresh(); // Re-render all UI
  }

  /* ---- Private ---- */

  function _showError(msg) {
    document.getElementById('entry-modal-error').textContent = msg;
  }

  function _clearError() {
    document.getElementById('entry-modal-error').textContent = '';
  }

  /* ---- Expose ---- */
  global.EntryModal = { open, close, closeOnBackdrop, save };

})(window);
