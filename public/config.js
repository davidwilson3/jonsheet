// config.js - Google Sheets configuration
// Fill in your Client ID and Spreadsheet ID after setting up Google Cloud Console

const SHEETS_CONFIG = {
    clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
    spreadsheetId: 'YOUR_SPREADSHEET_ID',
    sheetName: 'Sheet1',
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    dataRange: 'B2:G26',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit'
};
