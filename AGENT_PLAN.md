# Jonsheet - Architecture & Agent Reference

## What This Is

Jonsheet is a friends-only app that overlays interactive checkmarks on a photo of a handwritten spreadsheet. Users sign in with Google, and their checks read/write directly to a shared Google Sheet. Everything runs client-side on GitHub Pages — no server.

## File Structure

```
public/
  index.html       - Main page: sign-in overlay, loading screen, sheet image + SVG overlay
  app.js           - Core logic: init, render, toggle checks, UI state management
  sheets.js        - Google Sheets API: auth (GIS token client), read/write checks
  config.js        - Credentials: Client ID, Spreadsheet ID, sheet name, data range, homies list
  grid-data.js     - Cell positions/sizes for SVG overlay (generated via admin tool)
  style.css        - All styles including mobile responsive
  sheet.jpeg       - Photo of the physical handwritten spreadsheet
  check1.png       - Checkmark image variant 1
  check2.png       - Checkmark image variant 2
  admin.html       - Admin tool for adjusting cell positions (not linked from prod)
  editor.js        - Admin tool JS (not linked from prod)
jonsheet-import.csv - CSV for initial Google Sheet import
```

## Data Flow

```
Page load → startup spinner → check localStorage for saved token
  ├─ Token found → load sheet data → success → hide overlay, render checks
  │                                → failure (401) → clear token, show sign-in
  └─ No token → show sign-in overlay

User clicks cell → optimistic UI update → async PUT to Google Sheets API
  ├─ Success → done
  └─ Failure → rollback UI, show error toast

Every 30s → GET sheet data → update checks → re-render (catch others' changes)
```

## Google Sheets Integration

- **Auth**: Google Identity Services (GIS) token client. No gapi library.
- **Persistence**: Access token stored in localStorage (`jonsheet_token`). Tokens last ~1 hour. On page load, the saved token is tried directly against the Sheets API. If it fails (expired), the sign-in overlay appears.
- **Read**: `GET /v4/spreadsheets/{id}/values/{range}` with Bearer token. Range is `FUCKING TRIP!C2:H26`. Values of `YES`, `TRUE`, or `X` (case-insensitive) count as checked.
- **Write**: `PUT /v4/spreadsheets/{id}/values/{range}?valueInputOption=RAW`. Writes `yes` or `no`.
- **Column mapping**: C=Connie, D=Winky, E=David, F=James, G=Stud, H=J.Hatz. Sheet columns A-B are Month and Days (not touched by the app). Column I is Notes (not touched).

## Grid Data & Cell Locking

`grid-data.js` contains pixel positions for each cell on the sheet image. Each cell has:
- `x, y, w, h` — position/size in the 4284x5712 image coordinate space
- `locked` — if true, the cell has a checkmark already drawn on the physical paper. The app does NOT draw a check on locked cells. They are non-interactive.
- `isPermanent` — legacy flag, should NOT be used. Was incorrectly drawing duplicate checks over the image. Locked cells already have checks visible in the image.

Cell IDs follow the pattern `{columnId}_{rowIndex}` (e.g., `david_14` = David column, row 14 which is 0-indexed).

## Google Cloud Setup

The OAuth client and Sheets API are configured in Google Cloud Console under project "Jonsheet":
- OAuth consent screen: External, test users are the 6 homies listed in `config.js`
- OAuth Client ID: Web app type, authorized origins include `http://localhost:8000` and the GitHub Pages URL
- Google Sheets API: enabled
- The sheet is shared with all 6 homies as Editors

## Key Decisions

- **No server**: Everything is client-side. GitHub Pages hosts static files only.
- **Optimistic updates**: Checks render immediately, then write to sheet async. Rollback on failure.
- **30s polling**: No websockets. Simple interval polling catches changes from other users.
- **Locked cells = image checks**: The physical sheet photo has some checks already drawn. Those cells are locked so the app doesn't draw duplicates or allow toggling.
- **Admin tool excluded from prod**: `admin.html` and `editor.js` exist in the repo but aren't linked from `index.html`. They modify cell positions in localStorage for development only.
- **Mobile responsive**: Buttons shrink on small screens, mode indicator hidden, sign-out moves to bottom-right.
