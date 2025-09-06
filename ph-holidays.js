// ph-holidays.js
(() => {
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const iso = (y, m0, d) => `${y}-${pad(m0 + 1)}-${pad(d)}`;

  // Anonymous Gregorian algorithm for Easter Sunday (month: 0=Jan)
  function easter(y){
    const a = y % 19, b = Math.floor(y/100), c = y % 100, d = Math.floor(b/4);
    const e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19*a + b - d - g + 15) % 30, i = Math.floor(c/4), k = c % 4;
    const l = (32 + 2*e + 2*i - h - k) % 7, m = Math.floor((a + 11*h + 22*l) / 451);
    const month = Math.floor((h + l - 7*m + 114) / 31) - 1; // 0=Jan
    const day = ((h + l - 7*m + 114) % 31) + 1;
    return { y, m: month, d: day }; // Easter Sunday
  }
  function addDays(y,m,d,delta){
    const dt = new Date(Date.UTC(y, m, d)); // UTC safe (no TZ drift)
    dt.setUTCDate(dt.getUTCDate() + delta);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() };
  }

  // Last Monday of a month (m0: 0..11)
  function lastMonday(y, m0){
    const last = new Date(Date.UTC(y, m0 + 1, 0)); // last day
    const dow = last.getUTCDay(); // 0=Sun..6=Sat
    const delta = (dow >= 1) ? (dow - 1) : 6; // distance back to Monday
    last.setUTCDate(last.getUTCDate() - delta);
    return { y, m: last.getUTCMonth(), d: last.getUTCDate() };
  }

  // Put your extra/special holidays here (per year), ISO 'YYYY-MM-DD'
  // Example: Chinese New Year, Eid, special non-working days, observed Mondays, etc.
  const EXTRA_HOLIDAYS = {
    // "2025-02-??": "Chinese New Year",
    // "2025-04-??": "Eid al-Fitr",
    // "2025-06-??": "Eid al-Adha",
  };

  // Build a Map<ISO, name> for a given year
  function phHolidayMap(year){
    const map = new Map();

    // Regular (fixed-date) holidays
    map.set(iso(year, 0, 1),   "New Year's Day");            // Jan 1
    map.set(iso(year, 3, 9),   "Araw ng Kagitingan");        // Apr 9
    map.set(iso(year, 4, 1),   "Labor Day");                 // May 1
    map.set(iso(year, 5, 12),  "Independence Day");          // Jun 12
    map.set(iso(year, 10, 30), "Bonifacio Day");             // Nov 30
    map.set(iso(year, 11, 25), "Christmas Day");             // Dec 25
    map.set(iso(year, 11, 30), "Rizal Day");                 // Dec 30

    // Movable: National Heroes' Day (last Monday of August)
    const nhd = lastMonday(year, 7); // Aug
    map.set(iso(nhd.y, nhd.m, nhd.d), "National Heroes' Day");

    // Holy Week (regular holidays): Maundy Thu & Good Fri from Easter
    const eas = easter(year);
    const maundy = addDays(eas.y, eas.m, eas.d, -3);
    const good   = addDays(eas.y, eas.m, eas.d, -2);
    map.set(iso(maundy.y, maundy.m, maundy.d), "Maundy Thursday");
    map.set(iso(good.y,   good.m,   good.d),   "Good Friday");

    // Common special non-working (fixed date). Toggle as you prefer:
    map.set(iso(year, 7, 21), "Ninoy Aquino Day");           // Aug 21
    map.set(iso(year,10, 1),  "All Saints’ Day");            // Nov 1
    // map.set(iso(year,10, 2),  "All Souls’ Day");          // Often added by proclamation

    // Year-specific extras / proclamations
    for (const [k,v] of Object.entries(EXTRA_HOLIDAYS)){
      if (k.startsWith(String(year))) map.set(k, v);
    }
    return map;
  }

  // Public: look up by ISO 'YYYY-MM-DD'
  function phHolidayNameForISO(isoStr){
    const y = parseInt(isoStr.slice(0,4), 10);
    const map = phHolidayMap(y);
    return map.get(isoStr) || null;
  }

  // expose
  window.phHolidayNameForISO = phHolidayNameForISO;
})();
