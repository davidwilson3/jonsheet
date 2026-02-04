// editor.js - Calibration and Admin Logic

var isEditMode = false;
var draggingCellId = null;
var dragOffset = { x: 0, y: 0 };
var wasDragging = false;
let baselineParams = null; // For slide preview

function initEditor() {
    console.log("Initializing Editor Tools...");

    // Show Controls (moved from index.html logic)
    document.querySelector('.admin-bar .controls').appendChild(createEditorControls());

    // Attach Listeners
    document.getElementById('btn-edit-grid').addEventListener('click', toggleEditMode);
    document.getElementById('btn-reset-grid').addEventListener('click', resetGridParams);
    document.getElementById('btn-clear-checks').addEventListener('click', clearAllChecks);
    document.getElementById('btn-export').addEventListener('click', exportGridData);

    document.getElementById('slider-x').addEventListener('input', livePreview);
    document.getElementById('slider-y').addEventListener('input', livePreview);
    document.getElementById('slider-width').addEventListener('input', livePreview);
    document.getElementById('slider-row').addEventListener('input', livePreview);
    document.getElementById('slider-size').addEventListener('input', () => { render(); });

    document.getElementById('slider-x').addEventListener('change', () => baselineParams = null);
    document.getElementById('slider-y').addEventListener('change', () => baselineParams = null);
    document.getElementById('slider-width').addEventListener('change', () => baselineParams = null);
    document.getElementById('slider-row').addEventListener('change', () => baselineParams = null);

    // SVG Listeners for Dragging
    const svg = document.getElementById('grid-svg');
    svg.addEventListener('mousemove', onDrag);
    svg.addEventListener('mouseup', endDrag);
    svg.addEventListener('touchmove', onTouchDrag);
    svg.addEventListener('touchend', endDrag);

    // Override the core render function to handle edit visuals?
    // Or just hook into it?
    // We'll let the core render run, but we set strictly global isEditMode
}

function createEditorControls() {
    const container = document.createElement('div');
    container.id = 'admin-ui';
    container.innerHTML = `
        <div id="edit-controls" style="display:none; align-items: center; gap: 10px; margin-right: 10px;">
            <label>Move X: <input type="range" id="slider-x" min="-2500" max="2500" value="0" step="5"></label>
            <label>Move Y: <input type="range" id="slider-y" min="-2500" max="2500" value="0" step="5"></label>
            <label>Spread H: <input type="range" id="slider-width" min="50" max="500" step="5"></label>
            <label>Spread V: <input type="range" id="slider-row" min="50" max="500" step="5"></label>
            <label>Size: <input type="range" id="slider-size" min="20" max="300" value="150" step="5"></label>
            <button id="btn-export">💾 Export Data</button>
        </div>
        
        <div id="edit-legend" style="display:none; font-size: 14px; margin-bottom: 10px; color: #555;">
            <span style="color: #2ecc71; font-weight:bold;">Green 🔒</span> = Permanent Check (Point) &nbsp;|&nbsp; 
            <span style="color: #e74c3c; font-weight:bold;">Red 🔒</span> = Blocked (No Point) &nbsp;|&nbsp; 
            <span style="color: #00cccc; font-weight:bold;">Cyan</span> = Playable
        </div>

        <button id="btn-edit-grid">📍 Move Checks</button>
        <button id="btn-reset-grid" style="display:none; background-color: #e74c3c;">Reset Layout</button>
        <button id="btn-clear-checks" style="background-color: #f39c12; color: white;">Eraser (Clear All)</button>
        <span id="drag-hint" style="display:none; color: #2ecc71; font-weight: bold; margin-left:10px;">💡 Tip: Drag boxes to fine-tune!</span>
    `;
    return container;
}

function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('btn-edit-grid');
    const resetBtn = document.getElementById('btn-reset-grid');
    const controls = document.getElementById('edit-controls');
    const legend = document.getElementById('edit-legend');

    btn.innerText = isEditMode ? "Done Editing" : "📍 Edit Calibration";
    btn.style.backgroundColor = isEditMode ? "#2ecc71" : "";

    resetBtn.style.display = isEditMode ? "inline-block" : "none";
    controls.style.display = isEditMode ? "flex" : "none";
    legend.style.display = isEditMode ? "block" : "none";
    document.getElementById('drag-hint').style.display = isEditMode ? "inline-block" : "none";

    if (isEditMode) {
        initSliders();
    }

    render();
}

function initSliders() {
    // Try to guess values from current params
    const firstCell = cellParams[`${COLUMN_DEFS[0].id}_0`]; // 0_0
    const bottomCell = cellParams[`${COLUMN_DEFS[0].id}_1`]; // 0_1
    const rightCell = cellParams[`${COLUMN_DEFS[1].id}_0`]; // 1_0

    if (firstCell && bottomCell && rightCell) {
        const rowH = bottomCell.y - firstCell.y;
        const colW = rightCell.x - firstCell.x;
        const dx = firstCell.x;
        const dy = firstCell.y - 600; // Assuming 600 header

        document.getElementById('slider-x').value = dx;
        document.getElementById('slider-y').value = dy;
        document.getElementById('slider-width').value = colW;
        document.getElementById('slider-row').value = rowH;
    }
}

function resetGridParams() {
    if (confirm("Reset layout to defaults?")) {
        cellParams = createDefaultParams();
        render();
        initSliders();
    }
}

function clearAllChecks() {
    if (confirm("Erase all digital checkmarks?")) {
        checks = {};
        localStorage.setItem('jonsheet_checks', JSON.stringify(checks));
        render();
    }
}

function exportGridData() {
    // Determine the permanent "True" checks (Green ones)
    // The "checks" object currently stores ALL clicks. 
    // In our new model: Locked + Checked = Permanent.
    // We should export the cellParams AND distinct "permanentChecks".
    // Or just bake permanent checks into cellParams?

    // Let's modify cellParams to include `isPermanent: true` property.
    Object.keys(cellParams).forEach(key => {
        if (cellParams[key].locked && checks[key]) {
            cellParams[key].isPermanent = true;
        } else {
            delete cellParams[key].isPermanent;
        }
    });

    const checkSize = parseInt(document.getElementById('slider-size').value) || 150;
    const data = `const GRID_DATA = ${JSON.stringify(cellParams, null, 2)};
const GRID_CONFIG = { checkSize: ${checkSize} };`;

    // Create a Blob and download it
    const blob = new Blob([data], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grid-data.js';
    a.click();

    alert("Downloaded 'grid-data.js'.\n\n1. Move this file to the public/ directory.\n2. It will now be the hardcoded production data.");
}

function livePreview() {
    const dx = parseInt(document.getElementById('slider-x').value);
    const dy = parseInt(document.getElementById('slider-y').value);
    const colW = parseInt(document.getElementById('slider-width').value);
    const rowH = parseInt(document.getElementById('slider-row').value);

    const headerOffset = 600;

    if (!baselineParams) {
        // PIVOT: Sliders rewrite the grid.
        // We do NOT snapshot interaction. The sliders are absolute generators.
    }

    const newParams = {};
    for (let r = 0; r < ROW_COUNT; r++) {
        for (let c = 0; c < COLUMN_DEFS.length; c++) {
            const cellId = `${COLUMN_DEFS[c].id}_${r}`;
            const oldParam = cellParams[cellId] || {};

            newParams[cellId] = {
                x: Math.round((c * colW) + dx),
                y: Math.round((headerOffset + (r * rowH)) + dy),
                w: Math.round(colW),
                h: Math.round(rowH),
                locked: oldParam.locked || false
            };
        }
    }
    cellParams = newParams;
    render();
}

function startDrag(e, cellId) {
    if (!isEditMode) return;
    e.preventDefault();
    draggingCellId = cellId;
    wasDragging = false;

    const svg = document.getElementById('grid-svg');
    const pt = getSVGPoint(e, svg);
    const p = cellParams[cellId];

    dragOffset.x = pt.x - p.x;
    dragOffset.y = pt.y - p.y;
}

function onDrag(e) {
    if (!draggingCellId) return;
    e.preventDefault();
    wasDragging = true;

    const svg = document.getElementById('grid-svg');
    const pt = getSVGPoint(e, svg);

    const p = cellParams[draggingCellId];
    p.x = Math.round(pt.x - dragOffset.x);
    p.y = Math.round(pt.y - dragOffset.y);

    const g = document.querySelector(`g[data-id="${draggingCellId}"]`);
    if (g) {
        g.setAttribute("transform", `translate(${p.x}, ${p.y})`);
    }
}

function onTouchDrag(e) {
    if (!draggingCellId) return;
    const touch = e.touches[0];
    wasDragging = true;

    const svg = document.getElementById('grid-svg');
    const pt = getSVGPoint(touch, svg);

    const p = cellParams[draggingCellId];
    p.x = Math.round(pt.x - dragOffset.x);
    p.y = Math.round(pt.y - dragOffset.y);

    const g = document.querySelector(`g[data-id="${draggingCellId}"]`);
    if (g) {
        g.setAttribute("transform", `translate(${p.x}, ${p.y})`);
    }
}

function endDrag() {
    if (draggingCellId) {
        draggingCellId = null;
        localStorage.setItem('jonsheet_cell_params', JSON.stringify(cellParams));
        setTimeout(() => wasDragging = false, 50);
    }
}

function getSVGPoint(evt, svg) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// Editor Hooks (Exposed for app.js)
window.startDrag = startDrag; // Explicit export
window.toggleLock = function (cellId) {
    if (!isEditMode) return;
    const p = cellParams[cellId];
    p.locked = !p.locked;
    render();
};

window.onCellClick = function (cellId) {
    if (!isEditMode) return;
    if (wasDragging) return; // Ignore drag-clicks

    // Toggle "Permanent" state in checks drafts
    if (checks[cellId]) {
        delete checks[cellId];
    } else {
        checks[cellId] = true;
    }
    localStorage.setItem('jonsheet_checks', JSON.stringify(checks));
    render();
};

// Hook into app load
document.addEventListener('DOMContentLoaded', initEditor);

