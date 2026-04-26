const { google } = require('googleapis');
function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}
function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}
module.exports = { getAuth, getSheets };
