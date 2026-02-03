// sheets.js - Google Sheets API integration (client-side, no gapi needed)

let tokenClient = null;
let accessToken = null;

// Column mapping: column IDs to sheet columns (B=0, C=1, D=2, E=3, F=4, G=5)
const COLUMN_MAP = {
    connie: 0,
    winky: 1,
    david: 2,
    james: 3,
    stud: 4,
    jhatz: 5
};

const COLUMN_LETTERS = ['B', 'C', 'D', 'E', 'F', 'G'];
const COLUMN_IDS = ['connie', 'winky', 'david', 'james', 'stud', 'jhatz'];

// Convert cell ID (e.g. "connie_0") to sheet reference (e.g. "B2")
function cellIdToSheetRef(cellId) {
    const parts = cellId.split('_');
    const colId = parts[0];
    const rowIndex = parseInt(parts[1]);
    const colIndex = COLUMN_MAP[colId];
    if (colIndex === undefined) return null;
    const col = COLUMN_LETTERS[colIndex];
    const row = rowIndex + 2; // row 0 -> sheet row 2
    return `${col}${row}`;
}

// Convert sheet position (row, col indices within data range) to cell ID
function sheetPosToCellId(rowIndex, colIndex) {
    if (colIndex < 0 || colIndex >= COLUMN_IDS.length) return null;
    return `${COLUMN_IDS[colIndex]}_${rowIndex}`;
}

// Initialize Google Identity Services token client
function initAuth() {
    if (typeof google === 'undefined' || !google.accounts) {
        console.error('Google Identity Services not loaded');
        showError('Google sign-in failed to load. Refresh the page.');
        return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: SHEETS_CONFIG.clientId,
        scope: SHEETS_CONFIG.scope,
        callback: (response) => {
            if (response.error) {
                console.error('Auth error:', response.error);
                showError('Sign-in failed: ' + response.error);
                return;
            }
            accessToken = response.access_token;
            onSignedIn();
        },
    });

    showSignedOutUI();
}

function signIn() {
    if (!tokenClient) {
        showError('Auth not initialized. Refresh the page.');
        return;
    }
    tokenClient.requestAccessToken();
}

function signOut() {
    if (accessToken) {
        google.accounts.oauth2.revoke(accessToken, () => {
            accessToken = null;
            onSignedOut();
        });
    }
}

// Fetch check data from the Google Sheet
async function loadChecksFromSheet() {
    const { spreadsheetId, sheetName, dataRange } = SHEETS_CONFIG;
    const range = encodeURIComponent(`${sheetName}!${dataRange}`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to load sheet: ${res.status} ${err}`);
    }

    const data = await res.json();
    const rows = data.values || [];
    const newChecks = {};

    for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
            const val = (rows[r][c] || '').toString().toUpperCase().trim();
            if (val === 'TRUE' || val === 'X' || val === 'YES') {
                const cellId = sheetPosToCellId(r, c);
                if (cellId) newChecks[cellId] = true;
            }
        }
    }

    return newChecks;
}

// Write a single check value to the Google Sheet
async function writeCheckToSheet(cellId, isChecked) {
    const ref = cellIdToSheetRef(cellId);
    if (!ref) return;

    const { spreadsheetId, sheetName } = SHEETS_CONFIG;
    const range = encodeURIComponent(`${sheetName}!${ref}`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`;

    const body = {
        range: `${sheetName}!${ref}`,
        values: [[isChecked ? 'TRUE' : '']]
    };

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to write cell ${ref}: ${res.status} ${err}`);
    }
}
