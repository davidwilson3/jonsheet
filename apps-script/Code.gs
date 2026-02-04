// Code.gs — Google Apps Script backend for TheJonSheet
// Deploy: Extensions → Apps Script → Deploy as web app
//   Execute as: Me | Access: Anyone

// ── Configuration ──────────────────────────────────────────────────
var SHEET_NAME = 'FUCKING TRIP';
var DATA_RANGE = 'C2:H26';

var EMAIL_TO_COLUMN = {
  'conorbritain@gmail.com': 'connie',
  'clayton.winkelvoss@gmail.com': 'winky',
  'davidrwilson3@gmail.com': 'david',
  'jharmsmahlandt@gmail.com': 'jhatz',
  'jayrome.lewis@gmail.com': 'james',
  'yates.walt@gmail.com': 'stud'
};

var COLUMN_MAP = {
  connie: 0,
  winky: 1,
  david: 2,
  james: 3,
  stud: 4,
  jhatz: 5
};

var COLUMN_LETTERS = ['C', 'D', 'E', 'F', 'G', 'H'];

// ── Helpers ────────────────────────────────────────────────────────

function verifyIdToken(idToken) {
  if (!idToken) return null;
  var url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) return null;
  var payload = JSON.parse(resp.getContentText());
  var email = (payload.email || '').toLowerCase();
  if (!EMAIL_TO_COLUMN[email]) return null;
  return email;
}

function cellIdToSheetRef(cellId) {
  var parts = cellId.split('_');
  var colId = parts[0];
  var rowIndex = parseInt(parts[1], 10);
  var colIndex = COLUMN_MAP[colId];
  if (colIndex === undefined) return null;
  return COLUMN_LETTERS[colIndex] + (rowIndex + 2);
}

function jsonpResponse(callback, obj) {
  var json = JSON.stringify(obj);
  var output = callback + '(' + json + ')';
  return ContentService
    .createTextOutput(output)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ── GET: All requests come here (JSONP) ────────────────────────────

function doGet(e) {
  var params = e.parameter || {};
  var callback = params.callback || 'callback';
  var idToken = params.id_token || '';
  var action = params.action || 'read';

  var email = verifyIdToken(idToken);
  if (!email) {
    return jsonpResponse(callback, { error: 'Unauthorized' });
  }

  if (action === 'write') {
    return doWrite(params, email, callback);
  }

  // Default: read
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    return jsonpResponse(callback, { error: 'Sheet not found' });
  }

  var range = sheet.getRange(DATA_RANGE);
  var values = range.getValues();

  var rows = values.map(function(row) {
    return row.map(function(cell) {
      return cell === true ? 'TRUE' : (cell === false ? 'FALSE' : String(cell));
    });
  });

  return jsonpResponse(callback, { values: rows });
}

// ── Write a check ──────────────────────────────────────────────────

function doWrite(params, email, callback) {
  var cellId = params.cellId || '';
  var isChecked = params.isChecked === 'true';

  if (!cellId) {
    return jsonpResponse(callback, { error: 'Missing cellId' });
  }

  var colId = cellId.split('_')[0];
  var userCol = EMAIL_TO_COLUMN[email];
  if (colId !== userCol) {
    return jsonpResponse(callback, { error: 'You can only edit your own column' });
  }

  var ref = cellIdToSheetRef(cellId);
  if (!ref) {
    return jsonpResponse(callback, { error: 'Invalid cellId' });
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    return jsonpResponse(callback, { error: 'Sheet not found' });
  }

  sheet.getRange(ref).setValue(isChecked ? 'yes' : 'no');

  return jsonpResponse(callback, { success: true, cell: ref, value: isChecked ? 'yes' : 'no' });
}
