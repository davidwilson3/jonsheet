// app.js - Core Game Logic (Static Version)

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

// Hardcoded checks from final state
const checks = {
    // Row 0
    "connie_0": true, "winky_0": true, "david_0": true, "james_0": true, "stud_0": true, "jhatz_0": true,
    // Row 1
    "james_1": true, "jhatz_1": true,
    // Row 2
    "james_2": true, "jhatz_2": true,
    // Row 3
    "stud_3": true, "jhatz_3": true,
    // Row 4
    "james_4": true, "stud_4": true, "jhatz_4": true,
    // Row 5
    "james_5": true, "jhatz_5": true,
    // Row 6
    "james_6": true,
    // Row 7
    "james_7": true, "stud_7": true,
    // Row 8
    "james_8": true, "stud_8": true,
    // Row 9
    "david_9": true, "james_9": true, "stud_9": true,
    // Row 10
    "david_10": true, "james_10": true,
    // Row 11
    "david_11": true,
    // Row 12
    "david_12": true,
    // Row 13
    "james_13": true, "jhatz_13": true,
    // Row 14
    "david_14": true, "james_14": true, "stud_14": true, "jhatz_14": true,
    // Row 15
    "david_15": true, "james_15": true, "stud_15": true, "jhatz_15": true,
    // Row 16
    "david_16": true, "james_16": true, "stud_16": true,
    // Row 17
    "david_17": true, "james_17": true, "stud_17": true,
    // Row 18
    "david_18": true, "james_18": true, "jhatz_18": true,
    // Row 19
    "david_19": true, "jhatz_19": true,
    // Row 20
    "stud_20": true,
    // Row 21
    "james_21": true, "jhatz_21": true,
    // Row 22
    "david_22": true, "james_22": true, "jhatz_22": true,
    // Row 23
    "david_23": true, "james_23": true, "jhatz_23": true,
    // Row 24
    "david_24": true, "james_24": true, "jhatz_24": true
};

let cellParams = {};

// Zoom
let currentZoom = 1.0;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5.0;

function init() {
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

    render();
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

    Object.keys(cellParams).forEach(cellId => {
        const p = cellParams[cellId];
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.dataset.id = cellId;
        g.setAttribute("transform", `translate(${p.x}, ${p.y})`);

        g.style.cursor = "default";
        
        // Cell rect (invisible hitbox)
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("width", p.w);
        rect.setAttribute("height", p.h);
        rect.setAttribute("fill", "white");
        rect.setAttribute("fill-opacity", "0");
        g.appendChild(rect);

        // Checkmarks
        if (checks[cellId]) {
            const img = document.createElementNS("http://www.w3.org/2000/svg", "image");

            const hash = cellId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const variant = (hash % 2) + 1;
            img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `check${variant}.png`);
            img.style.display = 'block';

            let size = 150;
            // Center check
            const centerX = p.w / 2;
            const centerY = p.h / 2;
            img.setAttribute("x", centerX - (size / 2));
            img.setAttribute("y", centerY - (size / 2));
            img.setAttribute("width", size);
            img.setAttribute("height", size);
            
            g.appendChild(img);
        }

        svg.appendChild(g);
    });
}

document.addEventListener('DOMContentLoaded', init);
