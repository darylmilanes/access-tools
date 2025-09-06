(() => {
  const tz = 'Asia/Manila';
  const $  = (s, r = document) => r.querySelector(s);

  // DOM
  const calRoot    = $('#calendar');
  const calGrid    = $('#calGrid');
  const calMonth   = $('#calMonth');
  const calYear    = $('#calYear');
  const btnToday   = $('#calTodayBtn');
  const btnMY      = $('#calMYBtn');
  const picker     = $('#calPicker');
  const pickerYear = $('#pickerYear');
  const pickerClose= $('#pickerClose');

  // Helpers
  function manilaTodayParts(){
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return { y: +map.year, m: (+map.month - 1), d: +map.day };
  }
   function dow(y, m /*1..12*/, d){
     const t = [0,3,2,5,0,3,5,1,4,6,2,4];
     if (m < 3) y -= 1;
     return (y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400) + t[m-1] + d) % 7;
   }
  function daysInMonth(y, m /*0..11*/){
    return [31, (y%4===0 && y%100!==0)|| (y%400===0) ? 29:28, 31,30,31,30,31,31,30,31,30,31][m];
  }
  function monthName(m){
    return ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'][m];
  }

  // Helpers to format ISO date for a cell
  function toISO(y, m0, d){
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    return `${y}-${pad(m0 + 1)}-${pad(d)}`;
  }
  function holidayName(y, m0, d){
    const iso = toISO(y, m0, d);
    // from ph-holidays.js (attached to window)
    return (typeof window.phHolidayNameForISO === 'function')
      ? window.phHolidayNameForISO(iso)
      : null;
  }

  // State
  const today = manilaTodayParts();
  let view = { y: today.y, m: today.m };

  // Temp selection for picker (prevents NaN and supports month->year or year-only flows)
  let tempYear = view.y;
  let tempMonth = view.m; // keep current month as default

  // Render month grid
  function render(){
    calMonth.textContent = monthName(view.m);
    calYear.textContent  = String(view.y);

    const firstDow = dow(view.y, view.m + 1, 1); // 0=Sun
    const dim      = daysInMonth(view.y, view.m);
    let start = 1 - firstDow;

    const frag = document.createDocumentFragment();
    for (let i = 0; i < 42; i++){
      let y = view.y, m = view.m, d = start + i;

      if (d < 1){
        m = (view.m + 11) % 12;
        y = view.y - (view.m === 0 ? 1 : 0);
        d = daysInMonth(y, m) + d;
      } else if (d > dim){
        d = d - dim;
        m = (view.m + 1) % 12;
        y = view.y + (view.m === 11 ? 1 : 0);
      }

      const cell = document.createElement('div');
      cell.className = 'd';
      cell.setAttribute('role','gridcell');
      cell.dataset.y = y; cell.dataset.m = m; cell.dataset.d = d;
      cell.textContent = d;

      // Holiday flag
      const hName = holidayName(y, m, d);
      if (hName){
        cell.classList.add('holiday');
        cell.title = hName; // simple tooltip on hover
      }

      if (m !== view.m) cell.classList.add('other');
      if (i % 7 === 0) cell.classList.add('sun'); // Sundays
      if (y === today.y && m === today.m && d === today.d) cell.classList.add('today');

      frag.appendChild(cell);
    }

    calGrid.innerHTML = '';
    calGrid.appendChild(frag);
  }

  // --- Picker control ---
  function setMonthButtonsActive(){
    const buttons = picker.querySelectorAll('.month-grid button');
    buttons.forEach((b, idx) => {
      if (idx === tempMonth) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  function openPicker(){
    // Initialize temp selection from current view each time we open
    tempYear  = view.y;
    tempMonth = view.m;
    pickerYear.textContent = String(tempYear);
    setMonthButtonsActive();

    picker.classList.add('open');
    btnMY.setAttribute('aria-expanded','true');
  }
  function closePicker(){
    picker.classList.remove('open');
    btnMY.setAttribute('aria-expanded','false');
  }

  // Apply current temp selection to the calendar view.
  // If month wasn't changed, keep current month when year changes (year-only jump).
  function applySelection({close = false, live = true} = {}){
    const monthChanged = (tempMonth !== view.m);
    const yearChanged  = (tempYear  !== view.y);

    if (monthChanged && yearChanged) {
      view.y = tempYear; view.m = tempMonth;
    } else if (monthChanged) {
      view.m = tempMonth; // same year
    } else if (yearChanged) {
      view.y = tempYear;  // keep month
    } // else no change

    if (live) render();
    if (close) closePicker();
  }

  // --- Buttons / events ---
  btnToday.addEventListener('click', () => {
    const t = manilaTodayParts();
    view.y = t.y; view.m = t.m;
    render();
  });

  btnMY.addEventListener('click', (e) => {
    // Toggle; ensure it opens on first tap
    if (picker.classList.contains('open')) closePicker();
    else openPicker();
  });

  pickerClose.addEventListener('click', () => {
    // On explicit close, ensure any temp change is applied
    applySelection({close: true, live: true});
  });

  // Inside picker interactions
  picker.addEventListener('click', (e) => {
    // Year step
    const stepBtn = e.target.closest('.year-step');
    if (stepBtn){
      const step = parseInt(stepBtn.dataset.step, 10);
      tempYear += step;
      pickerYear.textContent = String(tempYear);
      // If user is only changing year, jump to that year on current month
      // If user also chose a month earlier, this will reflect month+year
      applySelection({close: false, live: true});
      return;
    }

    // Month click
    const mBtn = e.target.closest('.month-grid button');
    if (mBtn){
      tempMonth = parseInt(mBtn.dataset.m, 10);
      setMonthButtonsActive();
      // Apply immediately with current tempYear (supports month-first then year)
      applySelection({close: false, live: true});
      return;
    }
  });

  // Click outside closes picker (but keeps live-applied changes)
  document.addEventListener('click', (e) => {
    if (!picker.classList.contains('open')) return;
    const inside = e.target.closest('#calPicker') || e.target.closest('#calMYBtn');
    if (!inside) closePicker();
  }, { capture: true });

  // --- Swipe navigation (kept from previous version) ---
  const isInteractive = (el) =>
    !!(el.closest('button') || el.closest('.cal-picker'));

  const swipe = { active:false, pointerId:null, x0:0, y0:0, dx:0, dy:0, moved:false };

  function gotoPrevMonth(){ if (view.m === 0){ view.m = 11; view.y -= 1; } else view.m -= 1; render(); }
  function gotoNextMonth(){ if (view.m === 11){ view.m = 0; view.y += 1; } else view.m += 1; render(); }

  function onPointerDown(e){
    if (picker.classList.contains('open')) return;
    if (isInteractive(e.target)) return;
    swipe.active = true;
    swipe.pointerId = e.pointerId ?? 'mouse';
    swipe.x0 = e.clientX; swipe.y0 = e.clientY;
    swipe.dx = swipe.dy = 0; swipe.moved = false;
    try { calRoot.setPointerCapture(e.pointerId); } catch {}
  }
  function onPointerMove(e){
    if (!swipe.active) return;
    if (swipe.pointerId && e.pointerId && swipe.pointerId !== e.pointerId) return;
    swipe.dx = e.clientX - swipe.x0;
    swipe.dy = e.clientY - swipe.y0;
    if (!swipe.moved && (Math.abs(swipe.dx) > 6 || Math.abs(swipe.dy) > 6)) swipe.moved = true;
  }
  function onPointerUp(e){
    if (!swipe.active) return;
    if (swipe.pointerId && e.pointerId && swipe.pointerId !== e.pointerId) return;

    const width = calRoot.clientWidth || 1;
    const horizDominant = Math.abs(swipe.dx) > Math.abs(swipe.dy) * 1.4;
    const threshold = Math.max(60, width * 0.08);

    if (horizDominant && Math.abs(swipe.dx) >= threshold){
      if (swipe.dx < 0) gotoNextMonth();
      else gotoPrevMonth();
    }

    swipe.active = false; swipe.pointerId = null; swipe.moved = false; swipe.dx = swipe.dy = 0;
    try { calRoot.releasePointerCapture(e.pointerId); } catch {}
  }

  calRoot.addEventListener('pointerdown', onPointerDown, { passive: true });
  calRoot.addEventListener('pointermove', onPointerMove, { passive: true });
  calRoot.addEventListener('pointerup', onPointerUp, { passive: true });
  calRoot.addEventListener('pointercancel', onPointerUp, { passive: true });
  calRoot.addEventListener('lostpointercapture', onPointerUp, { passive: true });

  // Initial paint
  render();
})();
