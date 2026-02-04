# The Jon Sheet - Architecture & Agent Reference

## What This Is

The Jon Sheet is a friends-only app that overlays interactive checkmarks on a photo of a handwritten spreadsheet. Users sign in with Google (identity only, no Sheets permissions). Checks read/write through a Google Apps Script backend. The frontend runs client-side on GitHub Pages — no server.

## File Structure

```
docs/
  index.html       - Main page: sign-in overlay, loading screen, sheet image + SVG overlay
  app.js           - Core logic: init, render, toggle checks, UI state management
  sheets.js        - Auth (Google Identity Services) + Apps Script JSONP communication
  config.js        - Client ID, Apps Script URL, spreadsheet metadata, homies list
  grid-data.js     - Cell positions/sizes for SVG overlay (generated via admin tool)
  style.css        - All styles including mobile responsive
  sheet.jpeg       - Photo of the physical handwritten spreadsheet
  check1.png       - Checkmark image variant 1
  check2.png       - Checkmark image variant 2
  JonPoints.png    - Jon logo used in title
  admin.html       - Admin tool for adjusting cell positions (not linked from prod)
  editor.js        - Admin tool JS (not linked from prod)
apps-script/
  Code.gs          - Google Apps Script backend (deployed from the spreadsheet's script editor)
```

## Data Flow

```
Page load → startup spinner → check localStorage for saved ID token
  ├─ Token found & not expired → load sheet data via Apps Script → success → hide overlay, render checks
  │                                                               → failure → show error toast
  └─ No token / expired → show sign-in overlay with Google button

User clicks "Sign in with Google" → Google Identity Services → ID token returned
  → decode email from JWT → store token in localStorage → load sheet data → render

User clicks cell (edit mode) → optimistic UI update → JSONP request to Apps Script
  ├─ Success → done
  └─ Failure → rollback UI, show error toast

Every 30s → JSONP read from Apps Script → update checks → re-render (catch others' changes)
```

## Architecture

```
User → Google Sign-In (ID token, email only) → Frontend
Frontend → Apps Script web app (passes ID token via JSONP) → Google Sheet
```

Users consent to: "Sign in with Google" (basic identity). No Sheets access requested.

## Google Apps Script Backend (apps-script/Code.gs)

- **Deployed as**: Web app, Execute as "Me" (sheet owner), Access: "Anyone"
- **Auth**: Verifies Google ID tokens via `https://oauth2.googleapis.com/tokeninfo`
- **Read**: `doGet` with `action=read` — reads range C2:H26, returns values as JSONP
- **Write**: `doGet` with `action=write` — verifies column ownership, writes to sheet, returns JSONP
- **Column enforcement**: Server-side check that user's email maps to the column being edited
- **JSONP**: All responses wrapped in `callback(...)` to avoid CORS issues with Apps Script redirects

## Frontend Auth (sheets.js)

- **Library**: Google Identity Services (`google.accounts.id`)
- **Flow**: `renderButton` renders Google's sign-in button → user clicks → `handleCredentialResponse` callback receives ID token (JWT)
- **Token storage**: ID token stored in localStorage (`jonsheet_id_token`). On page load, token is decoded and checked for expiration. If valid, auto-signs in.
- **Email extraction**: Decoded client-side from JWT payload (base64). Server-side verification happens in Apps Script.
- **Sign-out**: Clears localStorage, calls `google.accounts.id.disableAutoSelect()`

## Grid Data & Cell Locking

`grid-data.js` contains pixel positions for each cell on the sheet image. Each cell has:
- `x, y, w, h` — position/size in the 4284x5712 image coordinate space
- `locked` — if true, the cell has a checkmark already drawn on the physical paper. The app does NOT draw a check on locked cells. They are non-interactive.
- `isPermanent` — legacy flag, should NOT be used. Was incorrectly drawing duplicate checks over the image. Locked cells already have checks visible in the image.

Cell IDs follow the pattern `{columnId}_{rowIndex}` (e.g., `david_14` = David column, row 14 which is 0-indexed).

Column mapping: C=Connie, D=Winky, E=David, F=James, G=Stud, H=J.Hatz. Sheet columns A-B are Month and Days (not touched by the app). Column I is Notes (not touched).

## Google Cloud Setup

- OAuth consent screen: External, test users are the 6 homies listed in `config.js`
- OAuth Client ID: Web app type, authorized origins include `http://localhost`, `http://localhost:8000`, and `https://davidwilson3.github.io`
- Google Sheets API: no longer needed (Apps Script accesses the sheet directly)
- The Apps Script is attached to the spreadsheet and deployed as a web app

## Key Decisions

- **No Sheets scope**: Users only consent to basic Google identity. All sheet access goes through Apps Script running as the sheet owner.
- **JSONP over fetch**: Apps Script web apps redirect responses, which causes CORS issues with `fetch()`. JSONP (dynamic script tags) bypasses this entirely.
- **Server-side column enforcement**: Apps Script verifies the user's email and rejects writes to columns they don't own. Frontend also prevents clicks on other columns (not-allowed cursor) but the real enforcement is server-side.
- **No server**: Frontend is static files on GitHub Pages. Apps Script is the only "backend."
- **Optimistic updates**: Checks render immediately, then write to sheet async. Rollback on failure.
- **30s polling**: No websockets. Simple interval polling catches changes from other users.
- **Locked cells = image checks**: The physical sheet photo has some checks already drawn. Those cells are locked so the app doesn't draw duplicates or allow toggling.
- **Admin tool excluded from prod**: `admin.html` and `editor.js` exist in the repo but aren't linked from `index.html`. They modify cell positions in localStorage for development only.
- **Mobile responsive**: Buttons shrink on small screens, mode indicator hidden, sign-out moves to bottom-right.
