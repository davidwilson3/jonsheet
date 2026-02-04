// config.js - Google Sheets configuration
// Fill in your Client ID and Spreadsheet ID after setting up Google Cloud Console

const SHEETS_CONFIG = {
    clientId: '656124936613-60pe3kfit7ddvaj2lniqfnoflqff98je.apps.googleusercontent.com',
    spreadsheetId: '1hBTvaqrfAOD28GQor6g1FyP6mUk_dAOoTJPMPb1t5Wg',
    sheetName: 'FUCKING TRIP',
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    dataRange: 'C2:H26',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1hBTvaqrfAOD28GQor6g1FyP6mUk_dAOoTJPMPb1t5Wg/edit',
    emailToColumn: {
        'conorbritain@gmail.com': 'connie',
        'clayton.winkelvoss@gmail.com': 'winky',
        'davidrwilson3@gmail.com': 'david',
        'jharmsmahlandt@gmail.com': 'jhatz',
        'jayrome.lewis@gmail.com': 'james',
        'yates.walt@gmail.com': 'stud'
    },
    get homies() { return Object.keys(this.emailToColumn); }
};
