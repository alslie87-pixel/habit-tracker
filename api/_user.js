const { google } = require('googleapis');

// Resolves which spreadsheet to use for this request.
// ?user=<name>  ->  looked up in the Customers sheet (CUSTOMERS_SHEET_ID),
// matching column A (name, case-insensitive) and taking the sheet URL in that row.
// No ?user or no match -> falls back to GOOGLE_SHEET_ID (single-user mode).

const cache = new Map(); // name -> { id, t }
const TTL = 5 * 60 * 1000;

async function resolveSheetId(req) {
  const fallback = process.env.GOOGLE_SHEET_ID;
  const user = (req.query && req.query.user ? String(req.query.user) : '').trim().toLowerCase();
  const customersId = process.env.CUSTOMERS_SHEET_ID;
  if (!user || !customersId) return fallback;

  const hit = cache.get(user);
  if (hit && Date.now() - hit.t < TTL) return hit.id;

  try {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: customersId,
      range: 'A1:H200'
    });
    const rows = resp.data.values || [];
    for (const row of rows) {
      const name = (row[0] || '').toString().trim().toLowerCase();
      if (name !== user) continue;
      for (const cell of row) {
        const m = /\/d\/([a-zA-Z0-9-_]+)/.exec((cell || '').toString());
        if (m) { cache.set(user, { id: m[1], t: Date.now() }); return m[1]; }
      }
    }
  } catch (e) {
    console.error('user lookup failed', e.message);
  }
  return fallback;
}

module.exports = { resolveSheetId };
