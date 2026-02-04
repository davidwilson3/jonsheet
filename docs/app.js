// app.js - Core Game Logic

const IMG_WIDTH = 4284;
const IMG_HEIGHT = 5712;
const ROW_COUNT = 25;

const COLUMN_DEFS = [
    { id: 'connie', name: 'Connie', checkable: true },
    { id: 'winky', name: 'Winky', checkable: true },
    { id: 'david', name: 'David', checkable: true },
    { id: 'james', name: 'James', checkable: true },
    { id: 'stud', name: 'Stud', checkable: true },
    { id: 'jhatz', name: 'J. Hatz', checkable: true },
    { id: 'notes', name: 'Notes', checkable: false }
];

// State
let checks = {};
let sheetsReady = false;
let cellParams = {};
let isEditing = false;
let refreshInterval = null;

// Zoom
let currentZoom = 1.0;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5.0;

function init() {
    const modal = document.getElementById('welcome-modal');
    const btnClose = document.getElementById('btn-close-modal');
    const btnEdit = document.getElementById('btn-edit-mode');
    const modeIndicator = document.getElementById('mode-indicator');

    if (btnEdit && modal && btnClose) {
        btnEdit.addEventListener('click', () => {
            if (!sheetsReady) {
                showError('Sign in with Google first.');
                return;
            }

            if (isEditing) {
                isEditing = false;
                btnEdit.textContent = "switch to edit";
                btnEdit.classList.remove('active');
                if (modeIndicator) modeIndicator.textContent = "view mode";
                render();
            } else {
                modal.classList.remove('hidden');
            }
        });

        btnClose.addEventListener('click', () => {
            modal.classList.add('hidden');
            isEditing = true;
            btnEdit.textContent = "switch to view";
            btnEdit.classList.add('active');
            if (modeIndicator) modeIndicator.textContent = "edit mode";
            render();
        });
    }

    // Zoom (trackpad pinch)
    const container = document.querySelector('.scroll-container');
    if (container) {
        container.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                applyZoom(-e.deltaY * 0.005);
            }
        }, { passive: false });

        // Panning
        let isPanning = false;
        let startX, startY, scrollLeft, scrollTop;

        container.addEventListener('mousedown', (e) => {
            if (e.defaultPrevented) return;
            if (window.isEditMode && e.target.closest('g')) return;

            isPanning = false;
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
            setTimeout(() => {
                isPanning = false;
                container.classList.remove('active');
            }, 0);
        });

        container.addEventListener('mousemove', (e) => {
            if (isPanning) {
                e.preventDefault();
                const x = e.pageX - container.offsetLeft;
                const y = e.pageY - container.offsetTop;
                container.scrollLeft = scrollLeft - (x - startX);
                container.scrollTop = scrollTop - (y - startY);
                return;
            }

            if (e.buttons === 1) {
                const x = e.pageX - container.offsetLeft;
                const y = e.pageY - container.offsetTop;
                if (Math.abs(x - startX) > 5 || Math.abs(y - startY) > 5) {
                    isPanning = true;
                    container.classList.add('active');
                }
            }
        });
    }

    // Load grid geometry (always use GRID_DATA for production)
    if (typeof GRID_DATA !== 'undefined' && GRID_DATA) {
        cellParams = GRID_DATA;
    } else {
        cellParams = createDefaultParams();
    }

    // Update jump-to-sheet link
    const jumpLink = document.getElementById('jump-sheet');
    if (jumpLink && typeof SHEETS_CONFIG !== 'undefined') {
        jumpLink.href = SHEETS_CONFIG.sheetUrl;
    }

    // Populate homies list on sign-in page
    const homiesList = document.getElementById('homies-list');
    if (homiesList && typeof SHEETS_CONFIG !== 'undefined' && SHEETS_CONFIG.homies) {
        homiesList.innerHTML = '<div class="homies-label">homies who can see this:</div>' +
            '<ul>' + SHEETS_CONFIG.homies.map(e => `<li>${e}</li>`).join('') + '</ul>';
    }

    render();

    // Initialize Google auth
    initAuth();
}

async function onSignedIn() {
    showSignedInUI();
    showLoadingState(true);
    try {
        checks = await loadChecksFromSheet();
        sheetsReady = true;
        render();

        // Start auto-refresh every 30 seconds
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(refreshFromSheet, 30000);
    } catch (err) {
        console.error('Failed to load checks:', err);
        showError('Load failed: ' + err.message);
    } finally {
        showLoadingState(false);
    }
}

function onSignedOut() {
    sheetsReady = false;
    checks = {};
    isEditing = false;
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }

    const btnEdit = document.getElementById('btn-edit-mode');
    const modeIndicator = document.getElementById('mode-indicator');
    if (btnEdit) {
        btnEdit.textContent = "switch to edit";
        btnEdit.classList.remove('active');
    }
    if (modeIndicator) modeIndicator.textContent = "view mode";

    showSignedOutUI();
    render();
}

async function refreshFromSheet() {
    if (!sheetsReady || !idToken) return;
    try {
        checks = await loadChecksFromSheet();
        render();
    } catch (err) {
        console.error('Refresh failed:', err);
    }
}

function getUserColumn() {
    const email = getCurrentUserEmail();
    if (!email || !SHEETS_CONFIG.emailToColumn) return null;
    return SHEETS_CONFIG.emailToColumn[email] || null;
}

async function toggleGameCheck(cellId) {
    const colId = cellId.split('_')[0];
    const colDef = COLUMN_DEFS.find(c => c.id === colId);
    if (colDef && !colDef.checkable) return;
    if (!sheetsReady) return;

    const userCol = getUserColumn();
    if (userCol && colId !== userCol) return;

    // Optimistic update
    const wasChecked = !!checks[cellId];
    if (wasChecked) {
        delete checks[cellId];
    } else {
        checks[cellId] = true;
    }
    render();

    // Write to sheet
    try {
        await writeCheckToSheet(cellId, !wasChecked);
    } catch (err) {
        console.error('Failed to write check:', err);
        showError('Failed to save. Rolling back...');
        // Rollback
        if (wasChecked) {
            checks[cellId] = true;
        } else {
            delete checks[cellId];
        }
        render();
    }
}

function showLoadingState(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.toggle('hidden', !show);
    }
}

function showError(msg) {
    const toast = document.getElementById('error-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
}

function hideStartupOverlay() {
    const startup = document.getElementById('startup-overlay');
    if (startup) startup.classList.add('hidden');
}

function showSignedInUI() {
    hideStartupOverlay();
    const overlay = document.getElementById('sign-in-overlay');
    const userInfo = document.getElementById('user-info');

    if (overlay) overlay.classList.add('hidden');
    if (userInfo) userInfo.classList.remove('hidden');
}

function showSignedOutUI() {
    hideStartupOverlay();
    const overlay = document.getElementById('sign-in-overlay');
    const userInfo = document.getElementById('user-info');

    if (overlay) overlay.classList.remove('hidden');
    if (userInfo) userInfo.classList.add('hidden');
}

function applyZoom(delta) {
    currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + delta));
    const wrapper = document.querySelector('.sheet-wrapper');
    if (wrapper) {
        wrapper.style.width = `${Math.round(currentZoom * 100)}%`;
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

    // Fallback: sync state from DOM if inconsistent
    const btnEdit = document.getElementById('btn-edit-mode');
    if (!isEditing && btnEdit && btnEdit.classList.contains('active')) {
        isEditing = true;
    }

    const adminEditing = (typeof isEditMode !== 'undefined' && isEditMode);

    Object.keys(cellParams).forEach(cellId => {
        const p = cellParams[cellId];
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.dataset.id = cellId;
        g.setAttribute("transform", `translate(${p.x}, ${p.y})`);

        // Interaction
        if (adminEditing) {
            g.style.cursor = "move";
            g.onmousedown = (e) => { if (window.startDrag) window.startDrag(e, cellId); };
            g.ontouchstart = (e) => { if (window.startDrag) window.startDrag(e, cellId); };
            g.oncontextmenu = (e) => {
                e.preventDefault();
                if (window.toggleLock) window.toggleLock(cellId);
            };
            g.onclick = (e) => { if (window.onCellClick) window.onCellClick(cellId); };
        } else if (p.locked) {
            g.style.cursor = "default";
        } else if (isEditing && sheetsReady) {
            const cellCol = cellId.split('_')[0];
            const userCol = getUserColumn();
            if (!userCol || cellCol === userCol) {
                g.style.cursor = "pointer";
                g.onclick = (e) => {
                    e.stopPropagation();
                    const container = document.querySelector('.scroll-container');
                    if (container && container.classList.contains('active')) return;
                    toggleGameCheck(cellId);
                };
            } else {
                g.style.cursor = "default";
            }
        } else {
            g.style.cursor = "grab";
        }

        // Cell rect
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("width", p.w);
        rect.setAttribute("height", p.h);

        if (adminEditing) {
            let stroke = "cyan";
            let fill = "rgba(0, 255, 255, 0.2)";

            if (p.locked) {
                if (checks[cellId]) {
                    stroke = "#2ecc71";
                    fill = "rgba(46, 204, 113, 0.3)";
                } else {
                    stroke = "#e74c3c";
                    fill = "rgba(231, 76, 60, 0.3)";
                }
            }

            rect.setAttribute("fill", fill);
            rect.setAttribute("stroke", stroke);
            rect.setAttribute("stroke-dasharray", "5,5");
        } else {
            // Invisible hitbox (fill with 0 opacity to capture clicks)
            rect.setAttribute("fill", "white");
            rect.setAttribute("fill-opacity", "0");
        }
        g.appendChild(rect);

        // Checkmarks
        const colId = cellId.split('_')[0];
        const colDef = COLUMN_DEFS.find(c => c.id === colId);
        const isCheckable = colDef ? colDef.checkable : false;

        let showCheck = false;
        let isPermanent = false;
        let isGhost = false;

        if (adminEditing) {
            if (p.locked && checks[cellId]) {
                showCheck = true;
                isPermanent = true;
            } else if (!p.locked && isCheckable) {
                showCheck = true;
                if (!checks[cellId]) isGhost = true;
            }
        } else {
            if (p.isPermanent) {
                showCheck = true;
                isPermanent = true;
            } else if (!p.locked && checks[cellId]) {
                showCheck = true;
            }
        }

        if (showCheck) {
            const img = document.createElementNS("http://www.w3.org/2000/svg", "image");

            const hash = cellId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const variant = (hash % 2) + 1;
            img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `check${variant}.png`);
            img.style.display = 'block';

            let size = 150;
            if (typeof GRID_CONFIG !== 'undefined' && GRID_CONFIG.checkSize) {
                size = GRID_CONFIG.checkSize;
            }
            if (adminEditing) {
                const slider = document.getElementById('slider-size');
                if (slider) size = parseInt(slider.value) || size;
            }

            const centerX = p.w / 2;
            const centerY = p.h / 2;
            img.setAttribute("x", centerX - (size / 2));
            img.setAttribute("y", centerY - (size / 2));
            img.setAttribute("width", size);
            img.setAttribute("height", size);
            img.style.opacity = isGhost ? "0.7" : "1.0";

            g.appendChild(img);
        }

        // Lock icon (admin only, locked + unchecked)
        if (adminEditing && p.locked && !checks[cellId]) {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.textContent = "\uD83D\uDD12";
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

document.addEventListener('DOMContentLoaded', init);
