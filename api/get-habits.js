const { google } = require('googleapis');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;

    // ── 1. READ CONFIG TAB ───────────────────────────────────
    const configRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'Config'!A1:D20"
    });
    const configRows = configRes.data.values || [];

    // Skip header row, assign sheet column indices dynamically
    // bad habits start at column C (index 2), good at column I (index 8)
    let badColIdx  = 2;
    let goodColIdx = 8;

    const badHabits  = [];
    const goodHabits = [];

    configRows.slice(1).forEach(row => {
      const type   = (row[0] || '').trim().toLowerCase();
      const name   = (row[1] || '').trim();
      const status = (row[2] || '').trim().toLowerCase();
      const note   = (row[3] || '').trim();

      if (!type || status === 'empty') return;

      if (type === 'bad') {
        badHabits.push({ name, status, note, colIndex: badColIdx });
        badColIdx++;
      } else if (type === 'good') {
        goodHabits.push({ name, status, note, colIndex: goodColIdx });
        goodColIdx++;
      }
    });

    const activeBad      = badHabits.filter(h => h.status === 'active');
    const activeGood     = goodHabits.filter(h => h.status === 'active');
    const conqueredBad   = badHabits.filter(h => h.status === 'conquered');

    // ── 2. READ SHEET DATA ───────────────────────────────────
    const today = new Date();
    const monthNames = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];
    const monthName = monthNames[today.getMonth()];

    const signalRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'🌅 Morning Signal'!A1:D15"
    });
    const signal = signalRes.data.values || [];

    // Always fetch at least to column T (index 19) to cover Q/R/S/T formula columns
    const lastColIdx    = Math.max(badColIdx, goodColIdx - 1, 19);
    const lastColLetter = colIndexToLetter(lastColIdx);

    const monthRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${monthName}'!A1:${lastColLetter}46`
    });
    const monthData = monthRes.data.values || [];

    // ── 3. FIND CURRENT WEEK ─────────────────────────────────
    today.setHours(0, 0, 0, 0);
    const weekStartRows = [1, 10, 19, 28, 37];
    let currentWeekIdx  = 0;

    for (let i = 0; i < weekStartRows.length; i++) {
      const row = weekStartRows[i];
      if (monthData[row] && monthData[row][1]) {
        const dateVal = new Date(monthData[row][1]);
        dateVal.setHours(0, 0, 0, 0);
        const endDate = new Date(dateVal);
        endDate.setDate(endDate.getDate() + 6);
        if (today >= dateVal && today <= endDate) {
          currentWeekIdx = i;
          break;
        }
      }
    }

    const weekRow    = weekStartRows[currentWeekIdx];
    const summaryRow = weekRow + 8;

    // ── 4. BUILD CALENDAR WEEK ───────────────────────────────
    const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    const weekData = [];

    for (let d = 0; d < 7; d++) {
      const row = weekRow + d;
      if (!monthData[row]) continue;

      const dateVal  = monthData[row][1] ? new Date(monthData[row][1]) : null;
      const dateNorm = dateVal ? new Date(dateVal) : null;
      if (dateNorm) dateNorm.setHours(0, 0, 0, 0);

      const dayData = {
        day:     days[d],
        date:    dateVal ? dateVal.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
        row:     weekRow + d + 1,
        isToday: dateNorm ? dateNorm.getTime() === today.getTime() : false,
        bad:     [],
        good:    []
      };

      activeBad.forEach(h => {
        dayData.bad.push({
          name:    h.name,
          checked: monthData[row][h.colIndex] === 'TRUE' || monthData[row][h.colIndex] === true,
          col:     h.colIndex + 1
        });
      });

      activeGood.forEach(h => {
        dayData.good.push({
          name:    h.name,
          checked: monthData[row][h.colIndex] === 'TRUE' || monthData[row][h.colIndex] === true,
          col:     h.colIndex + 1
        });
      });

      weekData.push(dayData);
    }

    // ── 5. WEEKLY % + TREND ──────────────────────────────────
    let weeklyPercent = 0;
    if (monthData[summaryRow] && monthData[summaryRow][16]) {
      const raw = parseFloat(monthData[summaryRow][16]);
      weeklyPercent = raw > 1 ? Math.round(raw) : Math.round(raw * 100);
    }

    const weeklyTrend = [];
    for (let i = 0; i < weekStartRows.length; i++) {
      const sr = weekStartRows[i] + 8;
      if (monthData[sr] && monthData[sr][16]) {
        const raw = parseFloat(monthData[sr][16]);
        weeklyTrend.push(raw > 1 ? Math.round(raw) : Math.round(raw * 100));
      } else {
        weeklyTrend.push(0);
      }
    }
    const last4Weeks = weeklyTrend.slice(Math.max(0, currentWeekIdx - 3), currentWeekIdx + 1);
    const bestWeek   = weeklyTrend.length > 0 ? Math.max(...weeklyTrend.filter(w => w > 0)) : 0;

    // ── 6. SMART SIGNAL ──────────────────────────────────────
    const completedWeeks = weeklyTrend.slice(0, currentWeekIdx);
    const recent2    = completedWeeks.slice(-2);
    const older2     = completedWeeks.slice(-4, -2);
    const recent2Avg = recent2.length > 0 ? Math.round(recent2.reduce((a,b) => a+b,0) / recent2.length) : 0;
    const older2Avg  = older2.length  > 0 ? Math.round(older2.reduce((a,b)  => a+b,0) / older2.length)  : 0;
    const trendDiff  = recent2Avg - older2Avg;

    let smartSignal = '';
    if (completedWeeks.length === 0) {
      smartSignal = 'First week. Every habit counts. Start strong.';
    } else if (completedWeeks.length === 1) {
      smartSignal = recent2Avg >= 70
        ? 'Strong start. Keep this energy going into next week.'
        : 'Slow start — but one week means nothing yet. Show up today.';
    } else if (trendDiff >= 15) {
      smartSignal = `Up ${trendDiff}% on your last two weeks. You're building something real.`;
    } else if (trendDiff >= 5) {
      smartSignal = `Trending up. ${recent2Avg}% average — keep the pressure on.`;
    } else if (trendDiff >= -5) {
      smartSignal = `Holding steady at ${recent2Avg}%. Consistency is the game — don't slip.`;
    } else if (trendDiff >= -15) {
      smartSignal = `Dipping slightly. You were at ${older2Avg}% — you know you can get back there.`;
    } else {
      smartSignal = `Down ${Math.abs(trendDiff)}% from your best. This is the week to turn it around.`;
    }

    // ── 7. HABITS ON TRACK + MOST IMPROVED ──────────────────
    const prev2WeeksRows = [];
    for (let i = Math.max(0, currentWeekIdx - 1); i <= currentWeekIdx; i++)
      for (let d = 0; d < 7; d++) prev2WeeksRows.push(weekStartRows[i] + d);

    const totalDays2 = prev2WeeksRows.filter(r => {
      if (!monthData[r] || !monthData[r][1]) return false;
      const d = new Date(monthData[r][1]); d.setHours(0,0,0,0);
      return d <= today;
    }).length;

    let habitsOnTrack = 0;
activeGood.forEach(h => {
  let count = 0;
  prev2WeeksRows.forEach(r => {
    if (monthData[r] && monthData[r][h.colIndex] === 'TRUE') count++;
  });
  if (totalDays2 > 0 && count / totalDays2 >= 0.7) habitsOnTrack++;
});

const olderWeeksRows = [];
for (let i = Math.max(0, currentWeekIdx - 3); i < Math.max(0, currentWeekIdx - 1); i++)
  for (let d = 0; d < 7; d++) olderWeeksRows.push(weekStartRows[i] + d);

const totalOlderDays = olderWeeksRows.filter(r => {
  if (!monthData[r] || !monthData[r][1]) return false;
  const d = new Date(monthData[r][1]); d.setHours(0,0,0,0);
  return d <= today;
}).length;

let prevHabitsOnTrack = 0;
activeGood.forEach(h => {
  let count = 0;
  olderWeeksRows.forEach(r => {
    if (monthData[r] && monthData[r][h.colIndex] === 'TRUE') count++;
  });
  if (totalOlderDays > 0 && count / totalOlderDays >= 0.7) prevHabitsOnTrack++;
});

    const prev2Start = Math.max(0, currentWeekIdx - 1);
    const prev2Rows  = [];
    for (let i = prev2Start; i <= currentWeekIdx; i++)
      for (let d = 0; d < 7; d++) prev2Rows.push(weekStartRows[i] + d);

    const older2Rows = [];
    for (let i = Math.max(0, currentWeekIdx - 3); i < prev2Start; i++)
      for (let d = 0; d < 7; d++) older2Rows.push(weekStartRows[i] + d);

    let mostImproved    = null;
    let bestImprovement = -999;
    activeGood.forEach(h => {
      let recentCount = 0, olderCount = 0;
      prev2Rows.forEach(r  => { if (monthData[r] && monthData[r][h.colIndex] === 'TRUE') recentCount++; });
      older2Rows.forEach(r => { if (monthData[r] && monthData[r][h.colIndex] === 'TRUE') olderCount++;  });
      const recentPct   = prev2Rows.length  > 0 ? recentCount / prev2Rows.length  : 0;
      const olderPct    = older2Rows.length > 0 ? olderCount  / older2Rows.length : 0;
      const improvement = recentPct - olderPct;
      if (improvement > bestImprovement) { bestImprovement = improvement; mostImproved = h.name; }
    });

    // ── 8. STREAK / WEAKEST / SIGNAL FROM SHEET ─────────────
    // ── 8. STREAK CALCULATION + WEAKEST / SIGNAL FROM SHEET ──
const todayNorm = new Date(today);
todayNorm.setHours(0, 0, 0, 0);

// Build flat list of all days newest first
const allDayRows = [];
for (let i = weekStartRows.length - 1; i >= 0; i--) {
  for (let d = 6; d >= 0; d--) {
    const r = weekStartRows[i] + d;
    if (!monthData[r] || !monthData[r][1]) continue;
    const rowDate = new Date(monthData[r][1]);
    rowDate.setHours(0, 0, 0, 0);
    if (rowDate > todayNorm) continue;
    allDayRows.push({ r, rowDate });
  }
}

// Count consecutive days where both bad + good habits hit 66%+
let streak = 0;
for (let i = 0; i < allDayRows.length; i++) {
  const { r } = allDayRows[i];
  let badDone = 0;
  activeBad.forEach(h => {
    if (monthData[r] && monthData[r][h.colIndex] === 'TRUE') badDone++;
  });
  const badPct = activeBad.length > 0 ? badDone / activeBad.length : 1;
  let goodDone = 0;
  activeGood.forEach(h => {
    if (monthData[r] && monthData[r][h.colIndex] === 'TRUE') goodDone++;
  });
  const goodPct = activeGood.length > 0 ? goodDone / activeGood.length : 1;
  if (badPct >= 0.66 && goodPct >= 0.66) {
    streak++;
  } else {
    break;
  }
}

const weakest   = monthData[weekRow] && monthData[weekRow][18] ? String(monthData[weekRow][18]).trim() : 'None';
const signalMsg = monthData[weekRow] && monthData[weekRow][19] ? String(monthData[weekRow][19]).trim() : 'Keep going!';

    // ── 9. FOCUS HABITS ──────────────────────────────────────
    const goodFocus = signal[12] && signal[12][1] ? signal[12][1] : 'Not set';
    const badFocus  = signal[12] && signal[12][2] ? signal[12][2] : 'Not set';
    const goodCount = signal[5]  && signal[5][3]  ? parseInt(signal[5][3])  || 0 : 0;
    const badCount  = signal[6]  && signal[6][3]  ? parseInt(signal[6][3])  || 0 : 0;

    // ── 10. DAYS ELAPSED + TOTAL TRACKABLE ──────────────────
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysElapsed  = Math.floor((today - firstOfMonth) / 86400000) + 1;

    let totalDays = 0;
    for (let i = 0; i < weekStartRows.length; i++) {
      const r = weekStartRows[i];
      if (monthData[r] && monthData[r][1]) {
        const dv = new Date(monthData[r][1]);
        dv.setHours(0, 0, 0, 0);
        if (dv.getFullYear() >= 2026 && dv <= today) {
          for (let dd = 0; dd < 7; dd++) {
            const cd = new Date(dv);
            cd.setDate(cd.getDate() + dd);
            if (cd <= today) totalDays++;
          }
        }
      }
    }

    // ── 11. ROW 46 STATS ─────────────────────────────────────
    const row46 = monthData[45] || [];

    const goodHabitStats = activeGood.map(h => {
      const count = row46[h.colIndex] ? parseInt(row46[h.colIndex]) || 0 : 0;
      return { name: h.name, percent: totalDays > 0 ? Math.round((count / totalDays) * 100) : 0 };
    });

    const badHabitStats = activeBad.map(h => {
      const count = row46[h.colIndex] ? parseInt(row46[h.colIndex]) || 0 : 0;
      return { name: h.name, percent: totalDays > 0 ? Math.round((count / totalDays) * 100) : 0 };
    });

    const sortedBad = badHabitStats.slice().sort((a, b) => a.percent - b.percent);
    const worst = sortedBad.length > 0 ? sortedBad[0] : null;
    const best  = sortedBad.length > 0 ? sortedBad[sortedBad.length - 1] : null;

    // ── 12. CONQUERED + GHOST RELAPSE CHECK ─────────────────
    const graveyard = [];

    conqueredBad.forEach(h => {
      const count = row46[h.colIndex] ? parseInt(row46[h.colIndex]) || 0 : 0;
      const pct   = totalDays > 0 ? Math.round((count / totalDays) * 100) : 0;

      // Check for relapses after conquest date (note format: "conquered:YYYY-MM-DD")
      let relapseCount = 0;
      if (h.note && h.note.includes('conquered:')) {
        const conquestDate = new Date(h.note.replace('conquered:', '').trim());
        conquestDate.setHours(0, 0, 0, 0);
        for (let i = 0; i < weekStartRows.length; i++) {
          for (let d = 0; d < 7; d++) {
            const r = weekStartRows[i] + d;
            if (!monthData[r] || !monthData[r][1]) continue;
            const rowDate = new Date(monthData[r][1]);
            rowDate.setHours(0, 0, 0, 0);
            if (rowDate > conquestDate && monthData[r][h.colIndex] === 'TRUE') relapseCount++;
          }
        }
      }

      graveyard.push({
        name:         h.name,
        percent:      pct,
        relapseCount,
        warning:      relapseCount > 0
          ? `⚠ Slipped ${relapseCount} time${relapseCount > 1 ? 's' : ''} since conquest`
          : null
      });
    });

    // Also catch active habits that hit 90%+ this month
    activeBad.forEach(h => {
      const count = row46[h.colIndex] ? parseInt(row46[h.colIndex]) || 0 : 0;
      const pct   = totalDays > 0 ? Math.round((count / totalDays) * 100) : 0;
      if (pct >= 90) graveyard.push({ name: h.name, percent: pct, relapseCount: 0, warning: null });
    });

    // ── 13. NEXT TO FALL ─────────────────────────────────────
    let nextToFall = null, nextToFallDays = 0;
    activeBad.forEach(h => {
      const count = row46[h.colIndex] ? parseInt(row46[h.colIndex]) || 0 : 0;
      if (count > nextToFallDays && count < 30) { nextToFallDays = count; nextToFall = h.name; }
    });
    const daysToKill = 30 - nextToFallDays;

    // ── 14. WEEK START DATE ──────────────────────────────────
    const weekStartDate = monthData[weekRow] && monthData[weekRow][1]
      ? new Date(monthData[weekRow][1]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'N/A';

    // ── 15. RESPOND ──────────────────────────────────────────
    res.status(200).json({
      month:        monthName,
      weekStart:    weekStartDate,
      streak,
      percent:      weeklyPercent,
      weakest,
      signal:       smartSignal || signalMsg,
      week:         weekData,
      sheetName:    monthName,
      goodFocus,
      badFocus,
      goodCount,
      badCount,
      daysElapsed,
      goodHabitStats,
      badHabitStats,
      worst,
      best,
      graveyard,
      weeklyTrend:  last4Weeks,
      habitsOnTrack,
      prevHabitsOnTrack,
      totalHabits:  activeGood.length,
      mostImproved,
      nextToFall,
      nextToFallDays,
      daysToKill,
      bestWeek
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ── HELPER: 0-based column index → sheet letter (A, B ... Z, AA, AB ...) ────
function colIndexToLetter(index) {
  let letter = '';
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}
