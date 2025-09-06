(() => {
  const tz = 'Asia/Manila';

  const fmtTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz
  });

  const fmtDow = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', timeZone: tz
  });

  const fmtDate = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', timeZone: tz
  });

  const $ = (s) => document.querySelector(s);

  function tick(){
    const now = new Date();
    $('#clockTime').textContent = fmtTime.format(now).toUpperCase();  // 10:30 AM
    $('#clockDow').textContent  = fmtDow.format(now).toUpperCase();   // SATURDAY
    $('#clockDate').textContent = fmtDate.format(now).toUpperCase();  // SEP 06
  }

  // Initial paint + update every second
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });

  tick();
  setInterval(tick, 1000);
})();
