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

    const { action, type, name, newName } = req.body;
    if (!action || !type) {
      return res.status(400).json({ error: 'Missing action or type' });
    }

    // Read Control Panel — B6:E20
    // Row 6 = header, rows 7-20 = habit data
    // B=Type, C=Name, D=Status, E=Note
    const configRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'⚙️ Control Panel'!B6:E20"
    });
    const rows = configRes.data.values || [];

    // rows[0] = header (row 6 in sheet)
    // rows[1] = first habit (row 7 in sheet)
    // Sheet row = array index + 6
    let targetRowIdx = -1;
    let emptySlotIdx = -1;

    for (let i = 1; i < rows.length; i++) {
      const rowType   = (rows[i][0] || '').trim().toLowerCase();
      const rowName   = (rows[i][1] || '').trim();
      const rowStatus = (rows[i][2] || '').trim().toLowerCase();

      if (rowType === type && rowName === name) targetRowIdx = i;
      if (rowType === type && rowStatus === 'empty' && emptySlotIdx === -1) emptySlotIdx = i;
    }

    const activeCount = rows.slice(1).filter(r =>
      (r[0] || '').trim().toLowerCase() === type &&
      (r[2] || '').trim().toLowerCase() === 'active'
    ).length;

    // Convert array index to actual sheet row number
    // rows[1] = sheet row 7, so sheetRow = arrayIdx + 6
    function toSheetRow(arrayIdx) { return arrayIdx + 6; }

    if (action === 'remove') {
      if (targetRowIdx === -1) return res.status(404).json({ error: 'Habit not found' });
      const note = (rows[targetRowIdx][3] || '').toLowerCase();
      const oldStatus = (rows[targetRowIdx][2] || '').trim().toLowerCase();
      let newStatus = type === 'bad'
        ? ((oldStatus === 'conquered' || note.includes('conquered')) ? 'ghost' : 'empty')
        : 'retired';
      const sheetRow = toSheetRow(targetRowIdx);
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'⚙️ Control Panel'!D${sheetRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[newStatus]] }
      });
      return res.status(200).json({ success: true, action: 'removed', newStatus });
    }

    if (action === 'replace') {
      if (targetRowIdx === -1) return res.status(404).json({ error: 'Habit not found' });
      if (!newName) return res.status(400).json({ error: 'Missing newName' });
      const note = (rows[targetRowIdx][3] || '').toLowerCase();
      const oldStatus = (rows[targetRowIdx][2] || '').trim().toLowerCase();
      let oldNewStatus = type === 'bad'
        ? ((oldStatus === 'conquered' || note.includes('conquered')) ? 'ghost' : 'empty')
        : 'retired';
      const sheetRow = toSheetRow(targetRowIdx);
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'⚙️ Control Panel'!D${sheetRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[oldNewStatus]] }
      });
      let newSlotRow = sheetRow;
      if (oldNewStatus !== 'empty') {
        if (emptySlotIdx !== -1 && emptySlotIdx !== targetRowIdx) {
          newSlotRow = toSheetRow(emptySlotIdx);
          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `'⚙️ Control Panel'!B${newSlotRow}:E${newSlotRow}`,
            valueInputOption: 'RAW',
            requestBody: { values: [[type, newName, 'active', '']] }
          });
        } else {
          await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: "'⚙️ Control Panel'!B:E",
            valueInputOption: 'RAW',
            requestBody: { values: [[type, newName, 'active', '']] }
          });
        }
      } else {
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'⚙️ Control Panel'!B${newSlotRow}:E${newSlotRow}`,
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
        const slotRow = toSheetRow(emptySlotIdx);
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'⚙️ Control Panel'!B${slotRow}:E${slotRow}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[type, newName, 'active', '']] }
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: "'⚙️ Control Panel'!B:E",
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
