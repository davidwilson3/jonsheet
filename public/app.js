// app.js - Core Game Logic

// Natural Image Dimensions
const IMG_WIDTH = 4284;
const IMG_HEIGHT = 5712;
const ROW_COUNT = 25;

// Metadata
const COLUMN_DEFS = [
    { id: 'connie', name: 'Connie', checkable: true },
    { id: 'winky', name: 'Winky', checkable: true },
    { id: 'david', name: 'David', checkable: true },
    { id: 'james', name: 'James', checkable: true },
    { id: 'stud', name: 'Stud', checkable: true },
    { id: 'jhatz', name: 'J. Hatz', checkable: true },
    { id: 'notes', name: 'Notes', checkable: false }
];

// STATE
// User's Progress (Checks they toggled)
let checks = JSON.parse(localStorage.getItem('jonsheet_checks')) || {};

// Grid Geometry (Positions & Locks)
// Prod: Uses GRID_DATA from grid-data.js (if valid)
// Admin: Uses localStorage to save work-in-progress, or falls back to GRID_DATA
let cellParams = {};

// Zoom State
let currentZoom = 1.0; // 1.0 = 100% of Viewport
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5.0; // 500% Zoom (Good for mobile)

function init() {
    console.log("Initializing Jonsheet Core...");

    // Attach Zoom Listeners (Buttons)
    const btnIn = document.getElementById('btn-zoom-in');
    const btnOut = document.getElementById('btn-zoom-out');
    if (btnIn && btnOut) {
        btnIn.addEventListener('click', () => applyZoom(ZOOM_STEP));
        btnOut.addEventListener('click', () => applyZoom(-ZOOM_STEP));
    }

    // Modal Listener
    const modal = document.getElementById('welcome-modal');
    const btnClose = document.getElementById('btn-close-modal');
    if (modal && btnClose) {
        btnClose.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    // Attach Zoom Listeners (Trackpad Pinch)
    const container = document.querySelector('.scroll-container');
    if (container) {
        container.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                // Normalize delta. Trackpads can send float deltaY.
                // Negative deltaY = Scrolling Up (Pushing away) = Zoom IN in most apps
                // Positive deltaY = Scrolling Down (Pulling in) = Zoom OUT
                const zoomFactor = -e.deltaY * 0.005;
                applyZoom(zoomFactor);
            }
        }, { passive: false }); // Passive false needed to preventDefault
    }

    // Panning State
    let isPanning = false;
    let startX, startY, scrollLeft, scrollTop;
    const container = document.querySelector('.scroll-container');

    if (container) {
        container.addEventListener('mousedown', (e) => {
            // In Admin mode, don't pan if we are clicking a cell (dragging logic is handled elsewhere)
            // But we can check if default prevented?
            // Actually, admin drag calls startDrag.
            if (e.defaultPrevented) return;

            // Check if we are interacting with a UI control (like zoom buttons if they were inside, but they are fixed outside)
            // If dragging checks in admin mode, stop.
            if (window.isEditMode && e.target.closest('g')) return;

            isPanning = true;
            container.classList.add('active'); // CSS for grabbing cursor
            startX = e.pageX - container.offsetLeft;
            startY = e.pageY - container.offsetTop;
            scrollLeft = container.scrollLeft;
            scrollTop = container.scrollTop;
        });

        container.addEventListener('mouseleave', () => {
            isPanning = false;
            container.classList.remove('active');
        });

        container.addEventListener('mouseup', () => {
            // We need to differentiate click vs drag for the 'click' handlers on cells?
            // We'll use a globally accessible 'wasPanning' flag or time threshold if needed.
            // But usually the click event fires after mouseup.
            // Let's set a timeout to clear isPanning so click handlers can check it?
            // Actually, simple capture:
            setTimeout(() => {
                isPanning = false;
                container.classList.remove('active');
            }, 0);
        });

        container.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const y = e.pageY - container.offsetTop;
            const walkX = (x - startX) * 1; // Scroll speed 1:1
            const walkY = (y - startY) * 1;
            container.scrollLeft = scrollLeft - walkX;
            container.scrollTop = scrollTop - walkY;
        });
    }

    // Determine source of truth for Grid Geometry
    const storedParams = localStorage.getItem('jonsheet_cell_params');

    if (typeof GRID_DATA !== 'undefined' && GRID_DATA) {
        // Production: Use the hardcoded export
        if (window.isEditMode !== undefined) {
            // Admin context
            if (storedParams) {
                cellParams = JSON.parse(storedParams);
                console.log("Loaded Geometry from LocalStorage (Draft)");
            } else {
                cellParams = GRID_DATA;
                console.log("Loaded Geometry from GRID_DATA (Base)");
            }
        } else {
            // Pure Production
            cellParams = GRID_DATA;
            console.log("Loaded Geometry from GRID_DATA (Prod)");
        }
    } else {
        // No GRID_DATA
        if (storedParams) {
            cellParams = JSON.parse(storedParams);
            console.log("Loaded Geometry from LocalStorage (No Export Found)");
        } else {
            cellParams = createDefaultParams();
            console.log("Created Default Geometry");
        }
    }

    // Initial Render
    render();
}

function applyZoom(delta) {
    currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + delta));
    const wrapper = document.querySelector('.sheet-wrapper');
    if (wrapper) {
        // Percentage based width relative to viewport
        wrapper.style.width = `${Math.round(currentZoom * 100)}%`;
        // wrapper.style.transform = ''; // Not needed anymore
    }
}

function createDefaultParams() {
    const params = {};
    const colWidth = IMG_WIDTH / COLUMN_DEFS.length;
    const headerHeight = 600;
    const rowHeight = (IMG_HEIGHT - headerHeight) / ROW_COUNT;

    for (let r = 0; r < ROW_COUNT; r++) {
        for (let c = 0; c < COLUMN_DEFS.length; c++) {
            const cellId = `${COLUMN_DEFS[c].id}_${r}`;
            params[cellId] = {
                x: Math.round(c * colWidth),
                y: Math.round(headerHeight + (r * rowHeight)),
                w: Math.round(colWidth),
                h: Math.round(rowHeight)
            };
        }
    }
    return params;
}

function render() {
    const svg = document.getElementById('grid-svg');
    if (!svg) return;
    svg.innerHTML = '';

    // console.log("Rendering grid. Mode:", (typeof isEditMode !== 'undefined' && isEditMode) ? "EDIT" : "GAME");

    // Iterate over cells
    Object.keys(cellParams).forEach(cellId => {
        const p = cellParams[cellId];
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.dataset.id = cellId;
        g.setAttribute("transform", `translate(${p.x}, ${p.y})`);

        // Check if we are in Edit Mode (Global var from editor.js)
        const editing = (typeof isEditMode !== 'undefined' && isEditMode);

        // Interaction Logic
        if (editing) {
            g.style.cursor = "move";

            // Drag Listeners (Delegated to editor.js global)
            g.onmousedown = (e) => {
                console.log("MouseDown:", cellId, "startDrag:", !!window.startDrag);
                if (window.startDrag) window.startDrag(e, cellId);
            };
            g.ontouchstart = (e) => { if (window.startDrag) window.startDrag(e, cellId); };

            g.oncontextmenu = (e) => {
                e.preventDefault();
                // We shouldn't call toggleLock directly if it's not defined here?
                // It's better if app.js exposes a "onCellRightClick" hook?
                // Or we keep the toggle functions global?
                // Let's assume editor.js defines toggleLock globally if loaded.
                if (window.toggleLock) window.toggleLock(cellId);
            };

            g.onclick = (e) => {
                // editor.js handles drag vs click state
                if (window.onCellClick) window.onCellClick(cellId);
            };
        } else {
            // GAME MODE
            if (p.locked) {
                // Locked cells are non-interactive.
                g.style.cursor = "default";
            } else {
                g.style.cursor = "pointer";
                g.onclick = (e) => {
                    e.stopPropagation();
                    // If we were just panning, DO NOT toggle
                    // (Strictly speaking, click won't fire if we moved far enough? 
                    // No, it usually does. We can check container class or a global flag)
                    const container = document.querySelector('.scroll-container');
                    if (container && container.classList.contains('active')) return;

                    toggleGameCheck(cellId);
                };
            }
        }

        // 1. Visual Box
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("width", p.w);
        rect.setAttribute("height", p.h);

        if (editing) {
            // EDITOR VISUALS
            let stroke = "cyan";
            let fill = "rgba(0, 255, 255, 0.2)";

            // In Editor, we check `checks` (localStorage draft) to see intended state
            // If Locked + Checked = Green
            // If Locked + Unchecked = Red
            const isSavedCheck = checks[cellId];

            if (p.locked) {
                if (isSavedCheck) {
                    stroke = "#2ecc71"; // Green
                    fill = "rgba(46, 204, 113, 0.3)";
                } else {
                    stroke = "#e74c3c"; // Red
                    fill = "rgba(231, 76, 60, 0.3)";
                }
            }

            rect.setAttribute("fill", fill);
            rect.setAttribute("stroke", stroke);
            rect.setAttribute("stroke-dasharray", "5,5");
        } else {
            // PROD VISUALS (Invisible Hitbox)
            rect.setAttribute("fill", "transparent");
        }
        g.appendChild(rect);


        // 2. Checkmarks
        // Logic: Show check if:
        // A) It is a Permanent Check (p.isPermanent is true OR (AdminMode && checks[cellId] && locked))
        // B) It is a User Check (checks[cellId] && !locked)
        // C) It is Editor Ghost (Checkable & Unlocked)

        const colId = cellId.split('_')[0];
        const colDef = COLUMN_DEFS.find(c => c.id === colId);
        const isCheckable = colDef ? colDef.checkable : false;

        let showCheck = false;
        let isPermanent = false;
        let isGhost = false;

        if (editing) {
            if (p.locked) {
                if (checks[cellId]) {
                    showCheck = true;
                    isPermanent = true; // Visual style
                }
            } else if (isCheckable) {
                showCheck = true;
                if (!checks[cellId]) isGhost = true;
            }
        } else {
            // GAME MODE
            if (p.isPermanent) {
                // Baked in permanent check
                showCheck = true;
                isPermanent = true;
            } else if (!p.locked && checks[cellId]) {
                // User check
                showCheck = true;
            }
        }

        if (showCheck) {
            const img = document.createElementNS("http://www.w3.org/2000/svg", "image");

            // Hash variant
            const hash = cellId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const variant = (hash % 2) + 1;
            img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `check${variant}.png`);
            img.style.display = 'block';

            // Size Logic (Editor vs Prod)
            let size = 150; // Default

            // Try to load from Config (Prod export)
            if (typeof GRID_CONFIG !== 'undefined' && GRID_CONFIG.checkSize) {
                size = GRID_CONFIG.checkSize;
            }

            if (editing) {
                const slider = document.getElementById('slider-size');
                if (slider) size = parseInt(slider.value) || size;
            }

            const centerX = p.w / 2;
            const centerY = p.h / 2;
            img.setAttribute("x", centerX - (size / 2));
            img.setAttribute("y", centerY - (size / 2));
            img.setAttribute("width", size);
            img.setAttribute("height", size);

            if (isGhost) {
                img.style.opacity = "0.7";
            } else {
                img.style.opacity = "1.0";
            }

            // If permanent in Prod, maybe give it a slight tint or just normal?
            // "Green" border was for Admin. In Prod, it should just look like ink (image).
            // WAIT - In Prod, if it's permanent, it's ALREADY on the background image (the hand drawing).
            // So we should NOT render a digital check on top of it, unless we want to "digitize" it?
            // User said: "you need to know the hardcoded ones to put into the google sheet still".
            // So we need the DATA. But do we show the IMG?
            // "make the locked show a lock symbol (meaning they can't be edited), the green can be (Permanent Check)"
            // If checking "Green" in Admin means "There is ink here", then in Prod we DON'T need to render a check, 
            // because the ink is there.
            // BUT for this prototype, maybe we do render it to confirm detection?
            // Let's hide it if permanent in Prod, assuming background has it.
            // BUT verify: "checked doesn't matter right, we're starting with all of theme unchecked until i place checks (except for the locked ones that are always locke)"

            if (!editing && isPermanent) {
                // Don't render image for permanent checks in Prod (Background has it)
                // Just keep logic for click blocking.
                // Unless user wants to see "Digitized" state.
                // "checks arre stilll waaaaaay too big" implies they SEE them.
                // Let's RENDERING them for now to be safe, high opacity.
            }

            g.appendChild(img);
        }

        // Lock Icon (Only Editor for now? Or Prod too?)
        // User: "make the locked show a lock symbol (meaning they can't be edited)"
        // This implies visual feedback in Prod too if user tries to click?
        // Or just visible locks on blocked cells?
        // "Red 🔒 = Blocked".
        // Let's show lock icon in Editor. In Prod, maybe not needed unless requested.
        if (editing && p.locked && !checks[cellId]) { // Red state
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.textContent = "🔒";
            text.setAttribute("x", p.w / 2);
            text.setAttribute("y", p.h / 2);
            text.setAttribute("dominant-baseline", "central");
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("font-size", Math.min(p.w, p.h) * 0.5);
            text.style.pointerEvents = "none";
            g.appendChild(text);
        }

        svg.appendChild(g);
    });
}

function toggleGameCheck(cellId) {
    // Only toggles user checks (not permanent ones)
    // Check if column is checkable
    const colId = cellId.split('_')[0];
    const colDef = COLUMN_DEFS.find(c => c.id === colId);
    if (colDef && !colDef.checkable) return;

    // Toggle
    if (checks[cellId]) {
        delete checks[cellId];
    } else {
        checks[cellId] = true;
    }
    localStorage.setItem('jonsheet_checks', JSON.stringify(checks));
    render();
}

document.addEventListener('DOMContentLoaded', init);
