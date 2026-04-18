const { google } = require('googleapis');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;

    // action: 'remove' | 'replace' | 'add'
    // type: 'bad' | 'good'
    // name: current habit name (for remove/replace)
    // newName: new habit name (for replace/add)
    const { action, type, name, newName } = req.body;

    if (!action || !type) {
      return res.status(400).json({ error: 'Missing action or type' });
    }

    // Read current Config
    const configRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'Config'!A1:D20"
    });
    const rows = configRes.data.values || [];

    // Find the target row index (1-based for Sheets API, but 0-based in array)
    // rows[0] = header, rows[1]+ = habits
    let targetRowIdx = -1;
    let emptySlotIdx = -1;

    for (let i = 1; i < rows.length; i++) {
      const rowType   = (rows[i][0] || '').trim().toLowerCase();
      const rowName   = (rows[i][1] || '').trim();
      const rowStatus = (rows[i][2] || '').trim().toLowerCase();

      // Find target habit
      if (rowType === type && rowName === name) {
        targetRowIdx = i;
      }

      // Find first empty slot of matching type
      if (rowType === type && rowStatus === 'empty' && emptySlotIdx === -1) {
        emptySlotIdx = i;
      }
    }

    // Count active habits of this type
    const activeCount = rows.slice(1).filter(r =>
      (r[0] || '').trim().toLowerCase() === type &&
      (r[2] || '').trim().toLowerCase() === 'active'
    ).length;

    if (action === 'remove') {
      if (targetRowIdx === -1) return res.status(404).json({ error: 'Habit not found' });

      const currentStatus = (rows[targetRowIdx][2] || '').trim().toLowerCase();
      const currentPct    = parseInt(rows[targetRowIdx][3] || '0') || 0;

      // Bad habit: ghost if conquered (90%+), else empty
      // Good habit: always retired
      let newStatus = 'empty';
      if (type === 'bad') {
        // Check if it's in conquered state or has conquest note
        const note = (rows[targetRowIdx][3] || '').toLowerCase();
        newStatus = (currentStatus === 'conquered' || note.includes('conquered')) ? 'ghost' : 'empty';
      } else {
        newStatus = 'retired';
      }

      const sheetRow = targetRowIdx + 1; // 1-indexed
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'Config'!C${sheetRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[newStatus]] }
      });

      return res.status(200).json({ success: true, action: 'removed', newStatus });
    }

    if (action === 'replace') {
      if (targetRowIdx === -1) return res.status(404).json({ error: 'Habit not found' });
      if (!newName)            return res.status(400).json({ error: 'Missing newName' });

      const sheetRow  = targetRowIdx + 1;
      const note      = (rows[targetRowIdx][3] || '').toLowerCase();
      const oldStatus = (rows[targetRowIdx][2] || '').trim().toLowerCase();

      // Set old habit status
      let oldNewStatus = 'empty';
      if (type === 'bad') {
        oldNewStatus = (oldStatus === 'conquered' || note.includes('conquered')) ? 'ghost' : 'empty';
      } else {
        oldNewStatus = 'retired';
      }

      // Update old habit to ghost/retired/empty
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'Config'!C${sheetRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[oldNewStatus]] }
      });

      // Find empty slot for new habit — reuse same row if going empty, else find next empty
      let newSlotRow = sheetRow; // reuse same row
      if (oldNewStatus !== 'empty') {
        // Need a different slot — find existing empty slot or append
        if (emptySlotIdx !== -1 && emptySlotIdx !== targetRowIdx) {
          newSlotRow = emptySlotIdx + 1;
          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `'Config'!A${newSlotRow}:D${newSlotRow}`,
            valueInputOption: 'RAW',
            requestBody: { values: [[type, newName, 'active', '']] }
          });
        } else {
          // Append new row at end of this type's section
          await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: "'Config'!A:D",
            valueInputOption: 'RAW',
            requestBody: { values: [[type, newName, 'active', '']] }
          });
        }
      } else {
        // Slot is freed — write new habit into same row
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'Config'!A${newSlotRow}:D${newSlotRow}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[type, newName, 'active', '']] }
        });
      }

      return res.status(200).json({ success: true, action: 'replaced' });
    }

    if (action === 'add') {
      if (!newName) return res.status(400).json({ error: 'Missing newName' });
      if (activeCount >= 7) return res.status(400).json({ error: 'Maximum 7 habits reached' });

      if (emptySlotIdx !== -1) {
        // Fill existing empty slot
        const slotRow = emptySlotIdx + 1;
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'Config'!A${slotRow}:D${slotRow}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[type, newName, 'active', '']] }
        });
      } else {
        // Append new row
        await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: "'Config'!A:D",
          valueInputOption: 'RAW',
          requestBody: { values: [[type, newName, 'active', '']] }
        });
      }

      return res.status(200).json({ success: true, action: 'added' });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
