// ── Custom date picker ────────────────────────────────────────────────────────
// Lightweight portal-based calendar dropdown. No dependencies.
// Consistent with the app's design system.
//
// createDatePicker({ value, onChange, className, testid, placeholder, withTime })
//   value:       string  — 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS' or ''
//   onChange:    (isoString) => void  — called on confirm or clear
//   className:   string  — extra classes on the trigger
//   testid:      string  — data-testid on the trigger
//   placeholder: string  — text shown when no value set
//   withTime:    boolean — datetime mode: shows time inputs, value includes T...
//
// Returns { el, getValue(), setValue(v) }

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DAY_NAMES   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function _parseISO(s) {
  if (!s || s.length < 10) return null;
  const y   = parseInt(s.slice(0,4),  10);
  const m   = parseInt(s.slice(5,7),  10) - 1;
  const d   = parseInt(s.slice(8,10), 10);
  const h   = s.length >= 16 ? (parseInt(s.slice(11,13), 10) || 0) : 0;
  const min = s.length >= 16 ? (parseInt(s.slice(14,16), 10) || 0) : 0;
  return (isNaN(y)||isNaN(m)||isNaN(d)) ? null : { y, m, d, h, min };
}

function _toISO(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function _formatDisplay(iso, withTime) {
  const p = _parseISO(iso);
  if (!p) return '';
  const base = `${p.d} ${MONTH_NAMES[p.m]} ${p.y}`;
  if (!withTime) return base;
  return `${base} \u00b7 ${String(p.h).padStart(2,'0')}:${String(p.min).padStart(2,'0')}`;
}

export function createDatePicker({ value = '', onChange, className = '', testid, placeholder, withTime = false } = {}) {
  const _ph    = placeholder || (withTime ? '\u2014 date & time \u2014' : '\u2014 date \u2014');
  let _value   = value;
  let _handler = onChange || null;

  // ── Trigger ───────────────────────────────────────────────────────────────
  const trigger = document.createElement('div');
  trigger.className = 'sc-trigger dp-trigger' + (className ? ' ' + className : '');
  trigger.tabIndex  = 0;
  if (testid) trigger.dataset.testid = testid;

  const textSpan = document.createElement('span');
  textSpan.className = 'sc-trigger-text';
  trigger.appendChild(textSpan);

  const _updateLabel = () => {
    const disp = _formatDisplay(_value, withTime);
    textSpan.textContent = disp || _ph;
    trigger.classList.toggle('sc-trigger--empty', !disp);
    trigger.dataset.value = _value;
  };
  _updateLabel();

  // ── Calendar portal ───────────────────────────────────────────────────────
  let calEl = null;
  // Current calendar view (which month/year is shown)
  let _viewY = 0, _viewM = 0;

  // Pending selection — only used in withTime mode, reset on each open()
  let _pendY = null, _pendM = null, _pendD = null;
  let _pendH = 0, _pendMin = 0;
  const _close = () => {
    if (calEl) { calEl.remove(); calEl = null; }
    document.removeEventListener('mousedown', _onOutside, true);
    document.removeEventListener('keydown',   _onEsc,     true);
  };

  const _onOutside = e => {
    if (!trigger.contains(e.target) && !calEl?.contains(e.target)) _close();
  };
  const _onEsc = e => { if (e.key === 'Escape') { _close(); trigger.focus(); } };

  const _open = () => {
    if (calEl) { _close(); return; }

    const parsed = _parseISO(_value);
    const today  = new Date();
    _viewY = parsed ? parsed.y : today.getFullYear();
    _viewM = parsed ? parsed.m : today.getMonth();

    // Initialise pending from current value
    _pendY   = parsed ? parsed.y   : null;
    _pendM   = parsed ? parsed.m   : null;
    _pendD   = parsed ? parsed.d   : null;
    _pendH   = parsed ? parsed.h   : 0;
    _pendMin = parsed ? parsed.min : 0;

    calEl = document.createElement('div');
    calEl.className = 'dp-cal' + (withTime ? ' dp-cal--dt' : '');
    document.body.appendChild(calEl);
    _renderCal();
    _position();

    document.addEventListener('mousedown', _onOutside, true);
    document.addEventListener('keydown',   _onEsc,     true);
  };

  const _position = () => {
    if (!calEl) return;
    const rect = trigger.getBoundingClientRect();
    calEl.style.left = rect.left + 'px';
    const calH = calEl.offsetHeight;
    if (rect.bottom + calH + 4 <= window.innerHeight) {
      calEl.style.top = (rect.bottom + 2) + 'px';
    } else {
      calEl.style.top = Math.max(4, rect.top - calH - 2) + 'px';
    }
  };

  const _renderCal = () => {
    calEl.innerHTML = '';
    const y = _viewY, m = _viewM;
    const today  = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth();
    const todayD = today.getDate();

    // Selected day: date mode from _value; datetime mode from pending
    const selParsed = withTime
      ? (_pendY !== null ? { y: _pendY, m: _pendM, d: _pendD } : null)
      : _parseISO(_value);

    // ── Header ────────────────────────────────────────────────────────────────
    const hdr = document.createElement('div');
    hdr.className = 'dp-hdr';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'dp-nav-btn';
    prevBtn.textContent = '\u2039';
    prevBtn.addEventListener('mousedown', e => {
      e.preventDefault();
      if (_viewM === 0) { _viewM = 11; _viewY--; } else { _viewM--; }
      _renderCal();
    });

    const monthLbl = document.createElement('span');
    monthLbl.className = 'dp-month-lbl';
    monthLbl.textContent = `${MONTH_NAMES[m]} ${y}`;

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'dp-nav-btn';
    nextBtn.textContent = '\u203a';
    nextBtn.addEventListener('mousedown', e => {
      e.preventDefault();
      if (_viewM === 11) { _viewM = 0; _viewY++; } else { _viewM++; }
      _renderCal();
    });

    hdr.append(prevBtn, monthLbl, nextBtn);
    calEl.appendChild(hdr);

    // ── Day names row ─────────────────────────────────────────────────────────
    const dayNamesRow = document.createElement('div');
    dayNamesRow.className = 'dp-grid';
    for (const dn of DAY_NAMES) {
      const cell = document.createElement('div');
      cell.className = 'dp-dn';
      cell.textContent = dn;
      dayNamesRow.appendChild(cell);
    }
    calEl.appendChild(dayNamesRow);

    // ── Day grid ──────────────────────────────────────────────────────────────
    const grid = document.createElement('div');
    grid.className = 'dp-grid';

    const firstDay    = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const blank = document.createElement('div');
      blank.className = 'dp-day dp-day--blank';
      grid.appendChild(blank);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cell    = document.createElement('div');
      const isToday = y === todayY && m === todayM && d === todayD;
      const isSel   = selParsed && y === selParsed.y && m === selParsed.m && d === selParsed.d;
      cell.className = 'dp-day'
        + (isToday ? ' dp-day--today' : '')
        + (isSel   ? ' dp-day--sel'   : '');
      cell.textContent = d;
      const _y = y, _m = m, _d = d;
      cell.addEventListener('mousedown', e => {
        e.preventDefault();
        if (!withTime) {
          // Date mode: commit immediately on day click
          _value = _toISO(_y, _m, _d);
          _updateLabel();
          if (_handler) _handler(_value);
          _close();
          trigger.focus();
        } else {
          // Datetime mode: update pending, re-render to show selection
          _pendY = _y; _pendM = _m; _pendD = _d;
          _renderCal();
        }
      });
      grid.appendChild(cell);
    }
    calEl.appendChild(grid);

    // ── Footer ────────────────────────────────────────────────────────────────
    const footer = document.createElement('div');
    footer.className = 'dp-footer';

    if (withTime) {
      // Time row: [HH] : [MM]
      const timeRow = document.createElement('div');
      timeRow.className = 'dp-time-row';

      const hInp = document.createElement('input');
      hInp.type = 'number'; hInp.min = '0'; hInp.max = '23'; hInp.step = '1';
      hInp.className = 'dp-time-inp';
      hInp.value = String(_pendH).padStart(2, '0');
      hInp.addEventListener('mousedown', e => e.stopPropagation());
      hInp.addEventListener('input', () => {
        _pendH = Math.min(23, Math.max(0, parseInt(hInp.value, 10) || 0));
      });
      hInp.addEventListener('blur', () => { hInp.value = String(_pendH).padStart(2, '0'); });

      const sep = document.createElement('span');
      sep.className = 'dp-time-sep'; sep.textContent = ':';

      const minInp = document.createElement('input');
      minInp.type = 'number'; minInp.min = '0'; minInp.max = '59'; minInp.step = '1';
      minInp.className = 'dp-time-inp';
      minInp.value = String(_pendMin).padStart(2, '0');
      minInp.addEventListener('mousedown', e => e.stopPropagation());
      minInp.addEventListener('input', () => {
        _pendMin = Math.min(59, Math.max(0, parseInt(minInp.value, 10) || 0));
      });
      minInp.addEventListener('blur', () => { minInp.value = String(_pendMin).padStart(2, '0'); });

      timeRow.append(hInp, sep, minInp);
      footer.appendChild(timeRow);

      const setBtn = document.createElement('button');
      setBtn.type = 'button';
      setBtn.className = 'dp-footer-btn dp-footer-btn--set';
      setBtn.textContent = 'Set';
      setBtn.disabled = _pendY === null;
      setBtn.addEventListener('mousedown', e => {
        e.preventDefault();
        if (_pendY === null) return;
        _value = `${_toISO(_pendY, _pendM, _pendD)}T${String(_pendH).padStart(2,'0')}:${String(_pendMin).padStart(2,'0')}:00`;
        _updateLabel();
        if (_handler) _handler(_value);
        _close();
        trigger.focus();
      });

      const clearDtBtn = document.createElement('button');
      clearDtBtn.type = 'button';
      clearDtBtn.className = 'dp-footer-btn dp-footer-btn--clear';
      clearDtBtn.textContent = 'Clear';
      clearDtBtn.addEventListener('mousedown', e => {
        e.preventDefault();
        _value = '';
        _updateLabel();
        if (_handler) _handler('');
        _close();
        trigger.focus();
      });

      footer.append(setBtn, clearDtBtn);

    } else {
      // Date-only footer: Today / Clear
      const todayBtn = document.createElement('button');
      todayBtn.type = 'button';
      todayBtn.className = 'dp-footer-btn';
      todayBtn.textContent = 'Today';
      todayBtn.addEventListener('mousedown', e => {
        e.preventDefault();
        _value = _toISO(todayY, todayM, todayD);
        _updateLabel();
        if (_handler) _handler(_value);
        _close();
        trigger.focus();
      });

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'dp-footer-btn dp-footer-btn--clear';
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('mousedown', e => {
        e.preventDefault();
        _value = '';
        _updateLabel();
        if (_handler) _handler('');
        _close();
        trigger.focus();
      });

      footer.append(todayBtn, clearBtn);
    }

    calEl.appendChild(footer);
    setTimeout(_position, 0);
  };

  trigger.addEventListener('click', _open);
  trigger.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _open(); }
    if (e.key === 'Escape') _close();
  });

  // Programmatic setter — calls onChange so state updates (used in tests)
  trigger._dpSetValue = (v) => {
    _value = v || '';
    _updateLabel();
    if (_handler) _handler(_value);
  };

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    el: trigger,
    getValue() { return _value; },
    setValue(v) {
      _value = v || '';
      _updateLabel();
    },
  };
}
