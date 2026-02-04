// sheets.js - Google Identity Services + Apps Script backend integration

let idToken = null;
let currentUserEmail = null;

function getCurrentUserEmail() {
    return currentUserEmail;
}

// Decode email from JWT ID token (base64url → JSON)
function decodeIdToken(token) {
    try {
        var parts = token.split('.');
        var payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        var json = atob(payload);
        return JSON.parse(json);
    } catch (e) {
        console.error('Failed to decode ID token:', e);
        return null;
    }
}

// Column mapping (same as before)
const COLUMN_MAP = {
    connie: 0,
    winky: 1,
    david: 2,
    james: 3,
    stud: 4,
    jhatz: 5
};

const COLUMN_LETTERS = ['C', 'D', 'E', 'F', 'G', 'H'];
const COLUMN_IDS = ['connie', 'winky', 'david', 'james', 'stud', 'jhatz'];

function cellIdToSheetRef(cellId) {
    const parts = cellId.split('_');
    const colId = parts[0];
    const rowIndex = parseInt(parts[1]);
    const colIndex = COLUMN_MAP[colId];
    if (colIndex === undefined) return null;
    const col = COLUMN_LETTERS[colIndex];
    const row = rowIndex + 2;
    return `${col}${row}`;
}

function sheetPosToCellId(rowIndex, colIndex) {
    if (colIndex < 0 || colIndex >= COLUMN_IDS.length) return null;
    return `${COLUMN_IDS[colIndex]}_${rowIndex}`;
}

// Google Identity Services callback
function handleCredentialResponse(response) {
    idToken = response.credential;
    var payload = decodeIdToken(idToken);
    if (payload && payload.email) {
        currentUserEmail = payload.email.toLowerCase();
    }
    localStorage.setItem('jonsheet_id_token', idToken);
    onSignedIn();
}

// Initialize Google Identity Services (Sign-In with Google)
function initAuth() {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
        setTimeout(initAuth, 200);
        return;
    }

    google.accounts.id.initialize({
        client_id: SHEETS_CONFIG.clientId,
        callback: handleCredentialResponse,
        auto_select: true
    });

    // Render Google sign-in button
    try {
        var btnContainer = document.getElementById('g-signin-btn');
        if (btnContainer) {
            google.accounts.id.renderButton(btnContainer, {
                theme: 'outline',
                size: 'large',
                width: 300
            });
        }
    } catch (e) {
        console.error('Failed to render Google button:', e);
    }

    // Try to restore from saved token
    var savedToken = localStorage.getItem('jonsheet_id_token');
    if (savedToken) {
        var payload = decodeIdToken(savedToken);
        // Check if token is expired (exp is in seconds)
        if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
            idToken = savedToken;
            currentUserEmail = (payload.email || '').toLowerCase();
            setTimeout(function() { onSignedIn(); }, 400);
            return;
        }
        // Token expired — clear it
        localStorage.removeItem('jonsheet_id_token');
    }

    setTimeout(function() { showSignedOutUI(); }, 400);
}


function signOut() {
    localStorage.removeItem('jonsheet_id_token');
    idToken = null;
    currentUserEmail = null;
    google.accounts.id.disableAutoSelect();
    onSignedOut();
}

// Fetch via Apps Script using JSONP to avoid CORS issues
function appsScriptRequest(params) {
    return new Promise(function(resolve, reject) {
        var callbackName = '_apscb_' + Math.random().toString(36).slice(2);
        var timeout = setTimeout(function() {
            delete window[callbackName];
            var script = document.getElementById(callbackName);
            if (script) script.remove();
            reject(new Error('Apps Script request timed out'));
        }, 15000);

        window[callbackName] = function(data) {
            clearTimeout(timeout);
            delete window[callbackName];
            var script = document.getElementById(callbackName);
            if (script) script.remove();
            if (data.error) {
                reject(new Error(data.error));
            } else {
                resolve(data);
            }
        };

        var url = SHEETS_CONFIG.scriptUrl + '?callback=' + callbackName
            + '&id_token=' + encodeURIComponent(idToken);

        Object.keys(params || {}).forEach(function(key) {
            url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
        });

        var script = document.createElement('script');
        script.id = callbackName;
        script.src = url;
        script.onerror = function() {
            clearTimeout(timeout);
            delete window[callbackName];
            script.remove();
            reject(new Error('Apps Script request failed'));
        };
        document.body.appendChild(script);
    });
}

// Fetch check data via Apps Script web app
async function loadChecksFromSheet() {
    var data = await appsScriptRequest({ action: 'read' });

    var rows = data.values || [];
    var newChecks = {};

    for (var r = 0; r < rows.length; r++) {
        for (var c = 0; c < rows[r].length; c++) {
            var val = (rows[r][c] || '').toString().toUpperCase().trim();
            if (val === 'TRUE' || val === 'X' || val === 'YES') {
                var cellId = sheetPosToCellId(r, c);
                if (cellId) newChecks[cellId] = true;
            }
        }
    }

    return newChecks;
}

// Write a single check via Apps Script web app
async function writeCheckToSheet(cellId, isChecked) {
    var ref = cellIdToSheetRef(cellId);
    if (!ref) return;

    await appsScriptRequest({
        action: 'write',
        cellId: cellId,
        isChecked: isChecked ? 'true' : 'false'
    });
}
