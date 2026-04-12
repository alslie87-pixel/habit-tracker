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

    const today = new Date();
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const monthName = monthNames[today.getMonth()];

    // Get Morning Signal data
    const signalRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'🌅 Morning Signal'!A1:D15"
    });
    const signal = signalRes.data.values || [];

    // Get month sheet data (rows 1-46, columns A-T)
    const monthRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${monthName}'!A1:T46`
    });
    const monthData = monthRes.data.values || [];

    // Find current week
    today.setHours(0, 0, 0, 0);
    const weekStartRows = [1, 10, 19, 28, 37]; // 0-indexed (sheet rows 2,11,20,29,38)
    let currentWeekIdx = 0;

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

    const weekRow = weekStartRows[currentWeekIdx];
    const summaryRow = weekRow + 8; // Q column weekly %

    // Extract week data for calendar
    const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    const badHabitNames = ["No SoMe","No Alcohol","No Sugar","No Smoking","No Junk","No Porn"];
    const goodHabitNames = ["Brush Teeth","Read","Build","Train","Sleep","Meditate","Journal"];

    const weekData = [];
    for (let d = 0; d < 7; d++) {
      const row = weekRow + d;
      if (!monthData[row]) continue;

      const dateVal = monthData[row][1] ? new Date(monthData[row][1]) : null;
      const dateNorm = dateVal ? new Date(dateVal) : null;
      if (dateNorm) dateNorm.setHours(0, 0, 0, 0);

      const dayData = {
        day: days[d],
        date: dateVal ? dateVal.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
        row: weekRow + d + 1, // 1-indexed sheet row
        isToday: dateNorm ? dateNorm.getTime() === today.getTime() : false,
        bad: [],
        good: []
      };

      // Bad habits columns C-H (index 2-7)
      for (let c = 0; c < 6; c++) {
        dayData.bad.push({
          name: badHabitNames[c],
          checked: monthData[row][2 + c] === 'TRUE' || monthData[row][2 + c] === true,
          col: 3 + c // 1-indexed column
        });
      }

      // Good habits columns I-O (index 8-14)
      for (let c = 0; c < 7; c++) {
        dayData.good.push({
          name: goodHabitNames[c],
          checked: monthData[row][8 + c] === 'TRUE' || monthData[row][8 + c] === true,
          col: 9 + c // 1-indexed column
        });
      }

      weekData.push(dayData);
    }

    // Extract stats
    const weekStartDate = monthData[weekRow] && monthData[weekRow][1]
      ? new Date(monthData[weekRow][1]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'N/A';

    // Weekly % from column Q (index 16) at summary row
    let weeklyPercent = 0;
    if (monthData[summaryRow] && monthData[summaryRow][16]) {
      const raw = parseFloat(monthData[summaryRow][16]);
      weeklyPercent = raw > 1 ? Math.round(raw) : Math.round(raw * 100);
    }

    // Streak from column R (index 17) at week start
    const streak = monthData[weekRow] && monthData[weekRow][17] ? parseInt(monthData[weekRow][17]) || 0 : 0;

    // Weakest from column S (index 18)
    const weakest = monthData[weekRow] && monthData[weekRow][18] ? String(monthData[weekRow][18]).trim() : 'None';

    // Signal from column T (index 19)
    const signalMsg = monthData[weekRow] && monthData[weekRow][19] ? String(monthData[weekRow][19]).trim() : 'Keep going!';

    // Focus habits from Morning Signal
    const goodFocus = signal[12] && signal[12][1] ? signal[12][1] : 'Not set'; // B13
    const badFocus = signal[12] && signal[12][2] ? signal[12][2] : 'Not set';  // C13
    const goodCount = signal[5] && signal[5][3] ? parseInt(signal[5][3]) || 0 : 0; // D6
    const badCount = signal[6] && signal[6][3] ? parseInt(signal[6][3]) || 0 : 0;  // D7

    // Get row 46 counts for habit overview + graveyard
    const row46 = monthData[45] || []; // 0-indexed

    // Count days elapsed this month
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysElapsed = Math.floor((today - firstOfMonth) / (86400000)) + 1;

    // Calculate total trackable days
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

    // Good habit stats
    const goodHabitStats = [];
    for (let g = 0; g < 7; g++) {
      const count = row46[8 + g] ? parseInt(row46[8 + g]) || 0 : 0;
      const pct = totalDays > 0 ? Math.round((count / totalDays) * 100) : 0;
      goodHabitStats.push({ name: goodHabitNames[g], percent: pct });
    }

    // Bad habit stats + graveyard
    const badHabitStats = [];
    const graveyard = [];
    for (let b = 0; b < 6; b++) {
      const count = row46[2 + b] ? parseInt(row46[2 + b]) || 0 : 0;
      const pct = totalDays > 0 ? Math.round((count / totalDays) * 100) : 0;
      badHabitStats.push({ name: badHabitNames[b], percent: pct });
      if (pct >= 90) graveyard.push({ name: badHabitNames[b], percent: pct });
    }

    const sortedBad = badHabitStats.slice().sort((a, b) => a.percent - b.percent);
    const worst = sortedBad.length > 0 ? sortedBad[0] : null;
    const best = sortedBad.length > 0 ? sortedBad[sortedBad.length - 1] : null;

    res.status(200).json({
      month: monthName,
      weekStart: weekStartDate,
      streak,
      percent: weeklyPercent,
      weakest,
      signal: signalMsg,
      week: weekData,
      sheetName: monthName,
      goodFocus,
      badFocus,
      goodCount,
      badCount,
      daysElapsed,
      goodHabitStats,
      worst,
      best,
      graveyard
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
