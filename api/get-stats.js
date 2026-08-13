// v29 stats endpoint — one batchGet, everything the Progress page needs.
// Derives all values the design's State Management section lists, from the
// real habit-log grid (readonly). No writes.
//
// Month grid columns (0-based within A1:X47):
//   B=1 date · C..I=2..8 bad · J..P=9..15 good · Q=16 BH% · R=17 GH%
//   W=22 weekday helper (1=Mon … 7=Sun) · X=23 numeric GH daily helper
//   Row 46 (idx 45) = monthly counts per habit.
// Control Panel: E7:H20 habit slots · Z1 = hidden app-onboarded marker.
//
// The pure derivation lives in computeStats() so it can be unit-tested
// against a synthetic grid without touching the live sheet.

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const WEEK_STARTS = [1, 10, 19, 28, 37]; // 0-based array rows (sheet rows 2,11,20,29,38)
const DEFAULT_HABITS = ['No alcohol','No social media','No sugar','Exercise','Read','Early to bed'];
const DAY = 86400000;

function serialToDate(v) {
  if (typeof v !== 'number') return null;
  const ud = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * DAY);
  return new Date(ud.getUTCFullYear(), ud.getUTCMonth(), ud.getUTCDate());
}
const isChecked = v => v === true || v === 'TRUE';
const pad2 = n => (n < 10 ? '0' : '') + n;
const isoLocal = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;

// ── pure derivation ────────────────────────────────────────
// monthGrids: 12 arrays of rows (unformatted values) · cpRows: Control Panel
// E7:H20 · markerCell: Control Panel Z1 · today: local-midnight Date.
function computeStats({ monthGrids, cpRows, markerCell, today }) {
  const curMonth = today.getMonth();
  const year = today.getFullYear();

  // habits (position-based, like get-habits)
  const habits = [];
  (cpRows || []).forEach((row, idx) => {
    const type = (row[0] || '').toString().trim().toLowerCase();
    const name = (row[1] || '').toString().trim();
    const status = (row[2] || '').toString().trim().toLowerCase();
    if (!type || !name || status === 'empty') return;
    const colIndex = idx <= 6 ? 2 + idx : 9 + (idx - 7);
    habits.push({ name, type, status, colIndex });
  });
  const active = habits.filter(h => h.status === 'active');
  const N = active.length;

  // day rows per month (chronological, date <= today)
  function dayRows(grid) {
    const out = [];
    WEEK_STARTS.forEach(ws => {
      for (let d = 0; d < 7; d++) {
        const row = grid[ws + d]; if (!row) continue;
        const date = serialToDate(row[1]); if (!date) continue;
        out.push({ row, date });
      }
    });
    return out;
  }
  const monthDayRows = monthGrids.map(g =>
    dayRows(g).filter(x => x.date <= today).sort((a, b) => a.date - b.date));

  // per-day habit counts (real log → year grid + counters)
  const countByISO = {};
  let checksYTD = 0;
  monthDayRows.forEach(rows => {
    rows.forEach(({ row, date }) => {
      let c = 0;
      active.forEach(h => { if (isChecked(row[h.colIndex])) c++; });
      countByISO[isoLocal(date)] = c;
      checksYTD += c;
    });
  });

  const elapsedMonths = [];
  for (let mi = 0; mi <= curMonth; mi++) elapsedMonths.push(mi);

  // per-habit derivations
  const habitStats = active.map(h => {
    const monthRate = monthGrids.map(() => null);
    const wdChecks = [0, 0, 0, 0, 0, 0, 0], wdDays = [0, 0, 0, 0, 0, 0, 0];
    let tot = 0, totDays = 0;
    const seq = [];
    let run = 0, best = 0, lastOk = null;

    monthDayRows.forEach((rows, mi) => {
      let c = 0, d = 0;
      rows.forEach(({ row, date }) => {
        d++; totDays++;
        const p = (row[22] || 0) - 1;                     // 0=Mon … 6=Sun
        if (p >= 0 && p < 7) wdDays[p]++;
        const ok = isChecked(row[h.colIndex]);
        seq.push(ok);
        if (ok) {
          c++; tot++;
          if (p >= 0 && p < 7) wdChecks[p]++;
          run = (lastOk && (date - lastOk) === DAY) ? run + 1 : 1;
          if (run > best) best = run;
          lastOk = date;
        } else run = 0;
      });
      monthRate[mi] = d ? c / d : null;
    });

    // comebacks: ≥3 consecutive hits preceded by ≥4 consecutive misses
    let comebacks = 0;
    for (let i = 4; i < seq.length - 2; i++)
      if (seq[i] && seq[i + 1] && seq[i + 2] &&
          !seq[i - 1] && !seq[i - 2] && !seq[i - 3] && !seq[i - 4]) comebacks++;

    const rowPct = wdDays.map((dd, p) => dd ? Math.round(wdChecks[p] / dd * 100) : 0);
    const series = elapsedMonths.map(mi =>
      monthRate[mi] === null ? 0 : Math.round(monthRate[mi] * 100));
    const cur = monthRate[curMonth];
    const prev = curMonth > 0 ? monthRate[curMonth - 1] : null;

    return {
      name: h.name, type: h.type,
      pct: cur === null ? 0 : Math.round(cur * 100),
      delta: (cur !== null && prev !== null)
        ? Math.round(cur * 100) - Math.round(prev * 100) : null,
      series, best, all: totDays ? Math.round(tot / totDays * 100) : 0,
      row: rowPct, comebacks
    };
  });

  // overall monthly completion % (mean of habit rates)
  const months = elapsedMonths.map(mi => {
    const rates = habitStats.map(h => h.series[mi]).filter(v => v !== null && v !== undefined);
    return { name: MONTHS[mi].slice(0, 3), full: MONTHS[mi], pct: Math.round(mean(rates)) };
  });

  // weekday means + consistency (design definitions)
  const weekday = [];
  for (let p = 0; p < 7; p++) weekday.push(Math.round(mean(habitStats.map(h => h.row[p]))));
  const consistency = Math.round(mean(weekday));
  const weekdayAvg = Math.round(mean(weekday.slice(0, 5)));
  const weekendAvg = Math.round(mean(weekday.slice(5)));
  const dip = weekdayAvg - weekendAvg;
  const bestDay = weekday.indexOf(Math.max.apply(null, weekday));

  // counters
  let perfectDays = 0, daysLogged = 0, habitWins = 0;
  Object.keys(countByISO).forEach(iso => {
    const c = countByISO[iso];
    habitWins += c;
    if (c >= 1) daysLogged++;
    if (N > 0 && c === N) perfectDays++;
  });
  const comebacks = habitStats.reduce((s, h) => s + h.comebacks, 0);
  const curPct = months.length ? months[months.length - 1].pct : 0;
  const prevMax = months.length > 1
    ? Math.max.apply(null, months.slice(0, -1).map(m => m.pct)) : null;
  const vsBestMonth = prevMax === null ? null : curPct - prevMax;

  // your year — every calendar day of the year
  const yearCells = [];
  for (let m = 0; m < 12; m++) {
    const dim = new Date(year, m + 1, 0).getDate();
    for (let d = 1; d <= dim; d++) {
      const date = new Date(year, m, d);
      const wd = (date.getDay() + 6) % 7;                 // 0=Mon … 6=Sun
      const future = date > today;
      const c = future ? 0 : (countByISO[isoLocal(date)] || 0);
      yearCells.push({ m, d, wd, c, future: future ? 1 : 0 });
    }
  }

  const jan1 = new Date(year, 0, 1);
  const daysTracked = Math.round((today - jan1) / DAY) + 1;

  // onboarding state (unchanged contract)
  const names = active.map(h => h.name).sort();
  const isDefault = names.length === 6 &&
    DEFAULT_HABITS.slice().sort().every((n, i) => n === names[i]);
  const onboarded = String(markerCell || '').trim() === 'app-onboarded';
  const needsOnboarding = !onboarded && isDefault && checksYTD === 0;

  return {
    needsOnboarding,
    habits: active.map(h => ({ name: h.name, type: h.type })),
    meta: {
      monthsIn: curMonth + 1,
      habitCount: N,
      startISO: isoLocal(jan1),
      endISO: isoLocal(today),
      daysTracked,
      daysLogged
    },
    months,
    habitStats: habitStats.map(h => ({
      name: h.name, type: h.type, pct: h.pct, delta: h.delta,
      series: h.series, best: h.best, all: h.all, row: h.row
    })),
    weekday, consistency, weekdayAvg, weekendAvg, dip, bestDay,
    counters: { perfectDays, habitWins, comebacks, vsBestMonth },
    year: yearCells
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { google } = require('googleapis');
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;

    const ranges = MONTHS.map(m => `'${m}'!A1:X47`);
    ranges.push("'⚙️ Control Panel'!E7:H20");
    ranges.push("'⚙️ Control Panel'!Z1");

    const batch = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      ranges,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });
    const vr = batch.data.valueRanges;
    const monthGrids = vr.slice(0, 12).map(r => r.values || []);
    const cpRows = vr[12].values || [];
    const markerCell = (vr[13].values && vr[13].values[0] && vr[13].values[0][0]) || '';

    const today = new Date(); today.setHours(0, 0, 0, 0);

    res.status(200).json(computeStats({ monthGrids, cpRows, markerCell, today }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

module.exports.computeStats = computeStats;
