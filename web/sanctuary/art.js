// Everything the palace looks like. No image assets: tile, gold, sandstone, fruit
// trees and jewel-coloured books are painted with canvas strokes once
// (bakeStatic and friends), and the parts that move -- fire, river, waterfall,
// armies, ants, the scribe himself -- are drawn live on top.
//
// The world is a floating island seen in cutaway, Terraria-style. From the bottom
// up: a river runs through the rock under a glass floor (and pours off the cliff as
// a waterfall); a basement forge; a ground floor with the library and the desk side
// by side; and a walled garden and prayer hall above. A flying carpet is the lift.

export const W = 3100;                       // world width
export const F1 = 1070;                      // basement floor (where his feet land)
export const F2 = 700;                       // ground floor: library and desk
export const F3 = 330;                       // top floor: garden and prayer hall
export const FLOOR = F1;                     // the forge and river live at F1
export const LEVEL_Y = { 1: F1, 2: F2, 3: F3 };
export const BLD = { x0: 400, x1: 2680 };    // the palace itself
export const SHAFT = { x0: 1045, x1: 1215, x: 1130 };   // the carpet's shaft
export const SLAB_F3 = [[400, 1045], [1215, 1750]];            // the prayer hall and garden court
export const SLAB_F2 = [[400, 1045], [1215, 2680]];            // the whole ground floor, out to the terrace and the gate
const BY0 = -420, BH = 3000;                 // baked region: y -420 .. 2580 (the pillar runs off the bottom of the world)
export const BAKE_Y0 = BY0, BAKE_Y1 = BY0 + BH;
export const TAU = Math.PI * 2;
const SLAB_T = 50;                           // floor thickness
const RIVER_TOP = F1, RIVER_BOT = 1270;
const FLOOR_T = 60;                          // the basement floor is solid stone, with a few glass panes onto the river

// ------------------------------------------------------------------- helpers

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const easeIn = t => t * t * t;
export const approach = (v, to, d) => (v < to ? Math.min(to, v + d) : Math.max(to, v - d));
export const rand = (a, b) => a + Math.random() * (b - a);

function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
}
export function mix(a, b, t) {
    const A = hex(a), B = hex(b);
    return `rgb(${(A[0] + (B[0] - A[0]) * t) | 0},${(A[1] + (B[1] - A[1]) * t) | 0},${(A[2] + (B[2] - A[2]) * t) | 0})`;
}

const HEAT = [[0, "#9aa6b2"], [0.22, "#8a4a40"], [0.4, "#c0482c"], [0.62, "#ee7a2a"], [0.82, "#f8b650"], [1, "#fff2c0"]];
export function heat(t) {
    t = clamp(t, 0, 1);
    for (let i = 1; i < HEAT.length; i++) {
        if (t <= HEAT[i][0]) return mix(HEAT[i - 1][1], HEAT[i][1], (t - HEAT[i - 1][0]) / (HEAT[i][0] - HEAT[i - 1][0]));
    }
    return HEAT[HEAT.length - 1][1];
}

const INK = "#3a2c40";          // a warm aubergine rather than black: this is a golden place
const GOLD = "#d9ab4c", GOLD_D = "#9b7428";
const TURQ = "#3aa9b0", TURQ_D = "#1f7585", TURQ_L = "#8fdde0";
const CREAM = "#f4ead2", SAND_L = "#e8d6a8";
const JEWEL = ["#b3324a", "#2e8a64", "#2b4a9c", "#d98a2e", "#7a3a8c", "#2fa8a8", "#c75a3a", "#4a64b8"];

// ------------------------------------------------------------- world layout

const M = 1900;                                         // x of the furnace mouth: the forge is laid out from here
export const LAYOUT = {
    desk: { x0: 1300, x1: 1590, top: F2 - 85 },
    panel: { x0: 1385, x1: 1605, y0: F2 - 277, y1: F2 - 93 },
    rack: { x0: M - 450, x1: M - 250, rows: [F1 - 257, F1 - 217, F1 - 177, F1 - 137] },
    ore: { x: 1420, y: F1 - 35 },
    bellows: { x0: M - 228, x1: M - 128, hinge: [M - 132, F1 - 41], rodX: M - 222 },
    furnace: { x0: M - 125, x1: M + 125, mouthX: M, mouthY0: F1 - 145, mouthY1: F1 - 20, hoodTop: F1 - 300 },
    mold: { x: M - 14, y: F1 - 22 },
    anvil: { x: M + 270, top: F1 - 67, tipX: M + 242 },
    trough: { x0: M + 380, x1: M + 540, rim: F1 - 41 },
    wheel: { x: M + 680, y: F1 - 55, r: 38 },
    fountain: { x: 740, y: F3 },
    windows: [
        { x: 690, y: F2 - 300, w: 130, h: 270, floor: F2 },
        { x: 1290, y: 100, w: 110, h: 190, floor: F3 },
        { x: 1620, y: 100, w: 110, h: 190, floor: F3 }
    ],
    lamps: [[620, 430], [960, 430], [1400, 430], [1680, 430], [1300, 120], [1620, 120],
        [620, 810], [960, 810], [1260, 810], [1560, 810], [1850, 810], [2150, 810], [2450, 810],
        [1990, 560], [2260, 560], [2570, 560]],
    pool: { x0: 2900, x1: 3030, surface: 706, floor: 810 },
    ledge: { x0: 2765, x1: 2875, y: 610 },
    panes: [[500, 620], [1070, 1190], [1520, 1640], [2100, 2220], [2480, 2600]],
    candle: [1300 + 240, F2 - 85],
    slots: []
};

export const STATIONS = {
    lib: { x: 755, face: 1, level: 2 },
    desk: { x: 1290, face: 1, level: 2 },
    rack: { x: 1420, face: 1, level: 1 },
    ore: { x: 1350, face: 1, level: 1 },
    bellows: { x: 1650, face: 1, level: 1 },
    furnace: { x: 1785, face: 1, level: 1 },
    anvil: { x: 2064, face: 1, level: 1 },
    trough: { x: 2202, face: 1, level: 1 },
    grind: { x: 2425, face: 1, level: 1 }
};

// The library's books. Most are baked into the shelves; the flagged few are the
// ones that leave their shelf when he studies, so they are drawn live.
const CASE_TOP = F2 - 320;
const CASES = [[440, 680], [830, 1040]];
const ROW_BOTTOMS = [CASE_TOP + 84, CASE_TOP + 168, CASE_TOP + 252];
const LIB_BOOKS = (() => {
    const r = rng(33);
    const out = [];
    for (const [cx0, cx1] of CASES) {
        ROW_BOTTOMS.forEach((bot, row) => {
            const rowH = 72;
            let x = cx0 + 16;
            while (x < cx1 - 18) {
                const w = 11 + r() * 12;
                const h = rowH * (0.62 + r() * 0.34);
                out.push({ x, w, h, bottom: bot, col: JEWEL[Math.floor(r() * JEWEL.length)], lean: r() < 0.07 ? (r() - 0.5) * 0.3 : 0, row });
                x += w + 1.4;
            }
        });
    }
    let n = 0;
    const idx = out.map((b, i) => i).sort(() => r() - 0.5);
    for (const i of idx) {
        const b = out[i];
        if (b.lean || b.w < 14 || b.h < 52) continue;
        if (out.filter(o => o.slot && Math.abs(o.x - b.x) < 52 && o.bottom === b.bottom).length) continue;
        b.slot = true;
        if (++n >= 12) break;
    }
    return out;
})();
LAYOUT.slots = LIB_BOOKS.filter(b => b.slot).map(b => ({ x: b.x + b.w / 2, y: b.bottom - b.h / 2, w: b.w, h: b.h, col: b.col }));

// ---------------------------------------------------- the paintings (assets/art)
// Trees, rock, water, carved stone, the far palace sky and the drapes are cut from
// the two reference paintings. If an image fails to load the procedural drawing
// underneath still stands in, so the scene never breaks.

const ART_FILES = {
    plate: "plate_sky.jpg", valley: "valley.jpg", rock: "rock.jpg", river: "river.jpg", waterfall: "waterfall.jpg",
    carve: "carve.jpg", panel: "panel.jpg", mosaic: "mosaic.jpg", frieze: "frieze.jpg", grass: "grass.jpg",
    palms: "palm_grove.png", pomA: "tree_pomegranate_a.png", pomB: "tree_pomegranate_b.png",
    curtL: "curtain_l.png", curtR: "curtain_r.png"
};
let ART = {};
const TILES = {};

export function loadArt() {
    const base = new URL("../../assets/art/", import.meta.url);
    return Promise.all(Object.entries(ART_FILES).map(([key, file]) => new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve([key, img]);
        img.onerror = () => resolve([key, null]);
        img.src = new URL(file, base).href;
    }))).then(list => {
        ART = {};
        list.forEach(([k, img]) => { if (img) ART[k] = img; });
        ART.rock = makeRockTile();       // the painted rock tile has foliage in its corner; stone is drawn instead
        for (const k of Object.keys(TILES)) delete TILES[k];
        TILES.rock = ART.rock;           // already seamless: mirroring it would print a kaleidoscope
        return ART;
    });
}

/** Pure stone: slate-brown, faceted blocks, hairline cracks, bedding planes and grit. No growth. */
function makeRockTile() {
    const S = 256, cv = offscreen(S, S), c = cv.getContext("2d");
    const r = rng(2024);
    c.fillStyle = "#5c5048"; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {                                           // big soft faces of slightly different stone
        const x = r() * S, y = r() * S, w = 40 + r() * 90, h = 14 + r() * 40, a = (r() - 0.5) * 0.3;
        const l = r() < 0.5;
        for (const [dx, dy] of [[0, 0], [-S, 0], [S, 0], [0, -S], [0, S]]) {   // wrap so the tile repeats
            c.save(); c.translate(x + dx, y + dy); c.rotate(a);
            c.fillStyle = l ? `rgba(190,165,135,${0.05 + r() * 0.08})` : `rgba(28,20,24,${0.08 + r() * 0.12})`;
            c.fillRect(-w / 2, -h / 2, w, h); c.restore();
        }
    }
    c.lineCap = "round";
    for (let i = 0; i < 16; i++) {                                           // bedding planes
        const y = r() * S, amp = 2 + r() * 5, ph = r() * 6;
        c.strokeStyle = r() < 0.6 ? "rgba(30,20,26,0.5)" : "rgba(235,210,170,0.2)"; c.lineWidth = 1 + r() * 2.2;
        c.beginPath();
        for (let x = 0; x <= S; x += 8) { const yy = y + Math.sin(x / S * Math.PI * 4 + ph) * amp; x ? c.lineTo(x, yy) : c.moveTo(x, yy); }
        c.stroke();
    }
    for (let i = 0; i < 24; i++) {                                           // angular cracks
        let x = r() * S, y = r() * S;
        c.strokeStyle = "rgba(24,16,22,0.55)"; c.lineWidth = 0.8 + r() * 1.4;
        c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 50; y += 10 + r() * 28; c.lineTo(x, y); }
        c.stroke();
    }
    for (let i = 0; i < 700; i++) {                                          // grit
        c.fillStyle = r() < 0.5 ? `rgba(20,14,18,${0.08 + r() * 0.2})` : `rgba(230,205,170,${0.05 + r() * 0.12})`;
        c.fillRect(r() * S, r() * S, 1 + r() * 2.5, 1 + r() * 2);
    }
    return cv;
}

const iw = img => img.naturalWidth || img.width;
const ih = img => img.naturalHeight || img.height;

/** The painting flipped into a 2x2 block, so it repeats without a seam. */
function mirrorTile(key) {
    const img = ART[key];
    if (!img) return null;
    if (TILES[key]) return TILES[key];
    const w = iw(img), h = ih(img);
    const cv = offscreen(w * 2, h * 2);
    const c = cv.getContext("2d");
    c.drawImage(img, 0, 0);
    c.save(); c.scale(-1, 1); c.drawImage(img, -2 * w, 0); c.restore();
    c.save(); c.scale(1, -1); c.drawImage(img, 0, -2 * h); c.restore();
    c.save(); c.scale(-1, -1); c.drawImage(img, -2 * w, -2 * h); c.restore();
    TILES[key] = cv;
    return cv;
}

function tilePattern(c, key, scale, ox, oy) {
    const t = mirrorTile(key);
    if (!t) return null;
    const pat = c.createPattern(t, "repeat");
    if (pat && pat.setTransform && typeof DOMMatrix !== "undefined") pat.setTransform(new DOMMatrix().translate(ox || 0, oy || 0).scale(scale));
    return pat;
}

/** A tree (or any cutout) standing with its foot at (x, baseY), `h` tall. */
function treeSprite(c, key, x, baseY, h, flip, alpha) {
    const img = ART[key];
    if (!img) return false;
    const sc = h / ih(img), w = iw(img) * sc;
    c.save();
    if (alpha != null) c.globalAlpha = alpha;
    if (flip) { c.translate(x, 0); c.scale(-1, 1); c.drawImage(img, -w / 2, baseY - h, w, h); }
    else c.drawImage(img, x - w / 2, baseY - h, w, h);
    c.restore();
    return true;
}

/** Diagonal pen hatching, for the shadowed sides of things. */
function hatch(c, x, y, w, h, gap, alpha) {
    c.save();
    c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.strokeStyle = `rgba(40,24,36,${alpha})`; c.lineWidth = 1.4;
    for (let i = -h; i < w; i += gap) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + h, y); c.stroke(); }
    c.restore();
}

// ------------------------------------------------------------- brush marks

function shape(c, path, fill, stroke, lw) {
    c.beginPath();
    path(c);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke !== null) {
        c.lineWidth = (lw || 2.4) * 1.3;          // chunkier, hand-inked outlines
        c.strokeStyle = stroke || INK;
        c.lineJoin = "round";
        c.stroke();
    }
}

function facets(c, x, y, w, h, n, seed, strength) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
        const px = x + r() * w, py = y + r() * h, sz = 30 + r() * 110;
        const a = r() * TAU;
        c.fillStyle = r() < 0.55 ? `rgba(255,255,255,${(strength || 0.1) * (0.4 + r())})` : `rgba(200,150,90,${(strength || 0.1) * 0.7 * (0.4 + r())})`;
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(px + Math.cos(a) * sz, py + Math.sin(a) * sz * 0.8);
        c.lineTo(px + Math.cos(a + 1.9 + r()) * sz * 0.7, py + Math.sin(a + 1.9) * sz * 0.8);
        c.closePath();
        c.fill();
    }
}

function sparkleDots(c, x, y, w, h, n, seed) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
        c.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.5})`;
        c.fillRect(x + r() * w, y + r() * h, 1 + r() * 2, 1 + r() * 2);
    }
}

function blocks(c, x0, y0, x1, y1, rowH, palette, seed, mortar) {
    const r = rng(seed);
    let row = 0;
    for (let y = y0; y < y1; y += rowH, row++) {
        let x = x0 - (row % 2 ? 30 + r() * 50 : r() * 25);
        const h = Math.min(rowH, y1 - y);
        while (x < x1) {
            const w = 60 + r() * 80;
            const bx = Math.max(x, x0), bw = Math.min(x + w, x1) - bx;
            if (bw > 6) {
                c.fillStyle = palette[Math.floor(r() * palette.length)];
                c.fillRect(bx, y, bw, h);
                c.fillStyle = "rgba(255,255,255,0.14)";
                c.fillRect(bx, y, bw, 3);
                c.fillStyle = "rgba(60,30,10,0.16)";
                c.fillRect(bx, y + h - 4, bw, 4);
                c.strokeStyle = mortar;
                c.lineWidth = 2;
                c.strokeRect(bx, y, bw, h);
            }
            x += w;
        }
    }
}

function gothic(c, x, y, w, h) {
    c.moveTo(x, y + h);
    c.lineTo(x, y + w * 0.9);
    c.quadraticCurveTo(x, y + w * 0.22, x + w / 2, y);
    c.quadraticCurveTo(x + w, y + w * 0.22, x + w, y + w * 0.9);
    c.lineTo(x + w, y + h);
    c.closePath();
}

function star8(c, x, y, r, fill) {
    c.save();
    c.translate(x, y);
    shape(c, p => p.rect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4), fill, GOLD_D, 1.6);
    c.rotate(Math.PI / 4);
    shape(c, p => p.rect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4), fill, GOLD_D, 1.6);
    c.restore();
    shape(c, p => p.arc(x, y, r * 0.3, 0, TAU), GOLD, GOLD_D, 1.4);
}

function scallops(c, x0, x1, y, r, fill) {
    for (let x = x0; x < x1; x += r * 2) {
        shape(c, p => { p.moveTo(x, y); p.arc(x + r, y, r, Math.PI, 0, true); p.closePath(); }, fill, GOLD_D, 1.6);
    }
}

function offscreen(w, h) {
    const cv = document.createElement("canvas");
    cv.width = Math.max(2, Math.round(w));
    cv.height = Math.max(2, Math.round(h));
    return cv;
}

// -------------------------------------------------- the island (terrain, rock)

const RIGHT_EDGE = [[3050, 700], [3040, 820], [3000, 960], [2935, 1090], [2870, 1210], [2760, 1320], [2560, 1420], [2330, 1500], [2150, 1590], [2010, 1700], [1990, 1860], [1996, 2100], [1990, 2600]];
const LEFT_EDGE = [[60, 700], [75, 830], [120, 960], [200, 1090], [320, 1210], [500, 1320], [760, 1420], [1000, 1500], [1180, 1590], [1240, 1700], [1250, 1860], [1244, 2100], [1250, 2600]];
const GRASS_Y = 700;

function islandPath(c) {
    const r = rng(5);
    const jag = (p, i, n) => (i > 0 && i < n - 1 ? [p[0] + (r() - 0.5) * 16, p[1] + (r() - 0.5) * 10] : p);
    c.moveTo(56, GRASS_Y - 8);
    c.lineTo(3054, GRASS_Y - 8);
    RIGHT_EDGE.forEach((p, i) => { const q = jag(p, i, RIGHT_EDGE.length); c.lineTo(q[0], q[1]); });
    for (let i = LEFT_EDGE.length - 1; i >= 0; i--) { const q = jag(LEFT_EDGE[i], i, LEFT_EDGE.length); c.lineTo(q[0], q[1]); }
    c.closePath();
}

/** x of the island's right-hand cliff at a given height. */
function rightEdgeAt(y) {
    for (let i = 1; i < RIGHT_EDGE.length; i++) {
        if (y <= RIGHT_EDGE[i][1]) {
            const a = RIGHT_EDGE[i - 1], b = RIGHT_EDGE[i];
            return lerp(a[0], b[0], (y - a[1]) / (b[1] - a[1]));
        }
    }
    return RIGHT_EDGE[RIGHT_EDGE.length - 1][0];
}

function pomegranateTree(c, x, y, s) {
    s = s || 1;
    c.strokeStyle = INK; c.lineWidth = 12 * s; c.lineCap = "round";
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 4 * s, y - 40 * s, x + 2 * s, y - 70 * s); c.stroke();
    c.strokeStyle = "#7a5230"; c.lineWidth = 8 * s;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 4 * s, y - 40 * s, x + 2 * s, y - 70 * s); c.stroke();
    const r = rng(Math.floor(x));
    for (let i = 0; i < 9; i++) {
        const px = x + (r() - 0.5) * 80 * s, py = y - 80 * s - r() * 52 * s, rad = (24 + r() * 14) * s;
        shape(c, p => p.arc(px, py, rad, 0, TAU), ["#3f8a4a", "#4a9a52", "#357a40"][i % 3], INK, 1.8);
    }
    for (let i = 0; i < 12; i++) {
        const px = x + (r() - 0.5) * 100 * s, py = y - 70 * s - r() * 70 * s;
        shape(c, p => p.arc(px, py, 6 * s, 0, TAU), "#c4283a", INK, 1.2);
        c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(px - 2 * s, py - 3 * s, 2, 2);
    }
}

function datePalm(c, x, y, h, lean) {
    lean = lean || 0;
    const tx = x + lean * h * 0.3;
    const g = c.createLinearGradient(x - 10, 0, x + 10, 0);
    g.addColorStop(0, "#8a6240"); g.addColorStop(0.5, "#b88a58"); g.addColorStop(1, "#6a4a30");
    c.beginPath();
    c.moveTo(x - 11, y); c.quadraticCurveTo(x - 8 + lean * 20, y - h * 0.5, tx - 6, y - h);
    c.lineTo(tx + 6, y - h); c.quadraticCurveTo(x + 8 + lean * 20, y - h * 0.5, x + 11, y);
    c.closePath();
    c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.4; c.stroke();
    c.strokeStyle = "rgba(60,30,10,0.45)"; c.lineWidth = 1.6;
    for (let i = 1; i < 14; i++) {                                           // the diamond bark scars
        const t = i / 14, yy = y - h * t, xx = lerp(x, tx, t * t);
        c.beginPath(); c.moveTo(xx - 8, yy); c.lineTo(xx + 8, yy - 5); c.stroke();
    }
    const r = rng(Math.floor(x * 3));
    for (let i = 0; i < 10; i++) {                                           // fronds
        const a = -Math.PI + (i / 9) * Math.PI + (r() - 0.5) * 0.2;
        const len = h * 0.42 + r() * 20;
        const ex = tx + Math.cos(a) * len, ey = y - h + Math.sin(a) * len * 0.55 + len * 0.28;
        c.strokeStyle = INK; c.lineWidth = 7;
        c.beginPath(); c.moveTo(tx, y - h); c.quadraticCurveTo(tx + Math.cos(a) * len * 0.55, y - h - 22 - r() * 12, ex, ey); c.stroke();
        c.strokeStyle = i % 2 ? "#3f8a48" : "#52a050"; c.lineWidth = 4;
        c.beginPath(); c.moveTo(tx, y - h); c.quadraticCurveTo(tx + Math.cos(a) * len * 0.55, y - h - 22 - r() * 12, ex, ey); c.stroke();
        c.strokeStyle = "rgba(30,80,40,0.7)"; c.lineWidth = 1.2;
        for (let k = 1; k < 7; k++) {                                        // leaflets
            const t = k / 7;
            const bx = lerp(tx, ex, t), by = lerp(y - h, ey, t) - Math.sin(t * Math.PI) * 14;
            c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - 3, by + 11); c.moveTo(bx, by); c.lineTo(bx + 5, by + 9); c.stroke();
        }
    }
    for (let i = 0; i < 3; i++) {                                            // heavy clusters of dates
        const cx = tx - 12 + i * 12, cy = y - h + 12 + (i % 2) * 6;
        for (let k = 0; k < 9; k++) shape(c, p => p.ellipse(cx + (k % 3) * 4 - 4, cy + Math.floor(k / 3) * 7, 3, 4.6, 0, 0, TAU), k % 2 ? "#d9702a" : "#c25a20", INK, 1);
    }
}

function drawRock(c) {
    c.save();
    c.beginPath(); islandPath(c); c.clip();
    const pat = tilePattern(c, "rock", 2.3, 0, GRASS_Y);
    if (pat) {
        c.fillStyle = pat;
        c.fillRect(0, GRASS_Y - 10, W, 1900);
        const sh = c.createLinearGradient(0, GRASS_Y, 0, 2300);               // lit from above, heavy underneath
        sh.addColorStop(0, "rgba(255,230,180,0.1)"); sh.addColorStop(1, "rgba(30,20,28,0.45)");
        c.fillStyle = sh; c.fillRect(0, GRASS_Y - 10, W, 1900);
    } else {
        const g = c.createLinearGradient(0, GRASS_Y, 0, 2300);
        g.addColorStop(0, "#9a8468"); g.addColorStop(0.3, "#7a6650"); g.addColorStop(1, "#4a3c34");
        c.fillStyle = g; c.fillRect(0, GRASS_Y - 10, W, 1900);
    }
    const r = rng(11);
    for (let i = 0; i < 40; i++) {                                           // strata, inked
        const y = GRASS_Y + 30 + r() * 1100, x0 = r() * W, len = 200 + r() * 600;
        c.strokeStyle = r() < 0.6 ? "rgba(40,24,36,0.32)" : "rgba(255,230,190,0.14)";
        c.lineWidth = 1.5 + r() * 3;
        c.beginPath(); c.moveTo(x0, y);
        for (let k = 1; k <= 8; k++) c.lineTo(x0 + (len * k) / 8, y + Math.sin(k * 1.3 + i) * 8);
        c.stroke();
    }
    hatch(c, 40, 760, 700, 800, 11, 0.07);
    hatch(c, 2400, 760, 700, 800, 11, 0.07);
    const rp = rng(31);
    for (let i = 0; i < 46; i++) {                                           // strata down the pillar's shaft
        const y = 1500 + rp() * 1100, x0 = 1150 + rp() * 700, len = 160 + rp() * 420;
        c.strokeStyle = rp() < 0.6 ? "rgba(40,24,36,0.32)" : "rgba(255,230,190,0.14)";
        c.lineWidth = 1.5 + rp() * 3;
        c.beginPath(); c.moveTo(x0, y);
        for (let k = 1; k <= 8; k++) c.lineTo(x0 + (len * k) / 8, y + Math.sin(k * 1.3 + i) * 8);
        c.stroke();
    }
    hatch(c, 1250, 1700, 740, 900, 11, 0.07);
    c.restore();
    c.strokeStyle = INK; c.lineWidth = 4.5;                                  // the cliff outline
    c.beginPath(); islandPath(c); c.stroke();
    c.strokeStyle = "#4a8a4c"; c.lineWidth = 3; c.lineCap = "round";        // vines hanging from the rim
    for (let i = 0; i < 40; i++) {
        const x = 70 + r() * 340 + (i % 2 ? 2520 : 0);
        if (x > 400 && x < 2680) continue;
        const y0 = GRASS_Y + 6, len = 20 + r() * 120;
        c.beginPath(); c.moveTo(x, y0); c.quadraticCurveTo(x + (r() - 0.5) * 24, y0 + len / 2, x + (r() - 0.5) * 10, y0 + len); c.stroke();
    }
}

const MOUND = { x: 150, peak: 652 };
const ANT_PATH = (() => {
    // [x, y, tag]: tag 'h' hides the ant (inside the mound), 'c' = carrying a crumb
    const p = [[340, 695, "c"], [214, 695, "c"], [208, 689, "c"], [194, 678, "c"], [176, 664, "c"], [160, 656, "c"], [MOUND.x, 654, "h"],
        [MOUND.x, 703, "h"], [MOUND.x, 760, ""], [MOUND.x, 800, ""], [190, 832, ""], [236, 850, ""], [262, 806, ""], [274, 740, ""], [278, 705, ""], [280, 699, ""], [340, 699, ""]];
    const segs = [];
    let total = 0;
    for (let i = 1; i < p.length; i++) {
        const len = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        segs.push({ a: p[i - 1], b: p[i], len, start: total });
        total += len;
    }
    // close the loop: from the end of the out-trail, back to the start of the in-trail
    segs.push({ a: p[p.length - 1], b: [340, 695, "c"], len: 6, start: total });
    total += 6;
    return { segs, total };
})();

function drawAntNest(c) {
    // the mound
    c.beginPath(); c.moveTo(94, GRASS_Y); c.quadraticCurveTo(110, 668, MOUND.x - 8, MOUND.peak + 4); c.quadraticCurveTo(MOUND.x + 2, MOUND.peak - 4, MOUND.x + 14, MOUND.peak + 6); c.quadraticCurveTo(190, 672, 216, GRASS_Y); c.closePath();
    const g = c.createLinearGradient(0, MOUND.peak, 0, GRASS_Y);
    g.addColorStop(0, "#b48a5a"); g.addColorStop(1, "#8a6840");
    c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.6; c.stroke();
    const r = rng(9);
    for (let i = 0; i < 30; i++) shape(c, p => p.ellipse(104 + r() * 110, 668 + r() * 30, 2 + r() * 3, 1.5 + r() * 2, 0, 0, TAU), "rgba(60,40,24,0.5)", null);
    shape(c, p => p.ellipse(MOUND.x, MOUND.peak + 2, 9, 5, 0, 0, TAU), "#1f140e", INK, 1.6);          // the entrance
    shape(c, p => p.ellipse(280, GRASS_Y - 1, 6, 3, 0, 0, TAU), "#1f140e", INK, 1.4);                 // the back door
    // the tunnels, cut away in the soil
    c.lineCap = "round"; c.lineJoin = "round";
    const tun = "#2b1d14";
    c.strokeStyle = tun; c.lineWidth = 15;
    c.beginPath();
    c.moveTo(MOUND.x, 702); c.lineTo(MOUND.x, 800); c.quadraticCurveTo(160, 836, 236, 850);
    c.moveTo(236, 850); c.quadraticCurveTo(268, 820, 274, 740); c.lineTo(278, 704);
    c.stroke();
    for (const [x, y, rx, ry] of [[236, 852, 30, 18], [MOUND.x, 806, 22, 14], [112, 850, 20, 12]]) shape(c, p => p.ellipse(x, y, rx, ry, 0, 0, TAU), tun, null);
    c.strokeStyle = "rgba(255,230,190,0.18)"; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(MOUND.x - 6, 710); c.lineTo(MOUND.x - 6, 796); c.stroke();
    // grain stores and eggs in the chambers
    for (let i = 0; i < 8; i++) shape(c, p => p.ellipse(226 + (i % 4) * 8, 856 + Math.floor(i / 4) * 5, 3, 2, 0, 0, TAU), "#f3e8c8", null);
    for (let i = 0; i < 7; i++) shape(c, p => p.ellipse(104 + (i % 4) * 6, 850 + Math.floor(i / 4) * 5, 2.4, 3.2, 0, 0, TAU), "#efe0b8", null);
}

function drawMarginPlants(c) {
    if (!ART.palms) { drawMarginPlantsProc(c); return; }
    // left of the palace, behind the ant nest
    treeSprite(c, "pomB", 96, GRASS_Y + 6, 240);
    treeSprite(c, "palms", 262, GRASS_Y + 8, 270);
    // right of the gate: an orchard, then a rocky ledge, then the pool at the cliff's edge
    treeSprite(c, "pomA", 2722, GRASS_Y + 6, 230);
    treeSprite(c, "palms", 2830, GRASS_Y + 8, 320, true);
    treeSprite(c, "pomB", 2760, GRASS_Y + 6, 170, true);
    const r = rng(77);
    const { x0: px0, x1: px1 } = LAYOUT.pool;
    for (let i = 0; i < 80; i++) {                                           // grass tufts and flowers
        const x = (r() < 0.5 ? 70 + r() * 330 : 2680 + r() * 370);
        if (x > px0 - 6 && x < px1 + 6) continue;
        c.strokeStyle = "#4a8a4c"; c.lineWidth = 2; c.lineCap = "round";
        c.beginPath(); c.moveTo(x, GRASS_Y); c.lineTo(x - 3, GRASS_Y - 8 - r() * 8); c.moveTo(x, GRASS_Y); c.lineTo(x + 3, GRASS_Y - 7 - r() * 8); c.stroke();
        if (r() < 0.3) shape(c, p => p.arc(x, GRASS_Y - 12, 2.6, 0, TAU), ["#e8586a", "#f6c84a", "#fff"][i % 3], null);
    }
    const gp = tilePattern(c, "grass", 0.9, 0, GRASS_Y - 20);
    c.fillStyle = gp || "#6aa850";
    for (const [a, b] of [[60, 405], [2675, px0 - 4], [px1 + 4, 3054]]) c.fillRect(a, GRASS_Y - 8, b - a, 14);
    c.strokeStyle = INK; c.lineWidth = 3;
    c.beginPath();
    for (const [a, b] of [[60, 405], [2675, px0 - 4], [px1 + 4, 3054]]) { c.moveTo(a, GRASS_Y - 8); c.lineTo(b, GRASS_Y - 8); }
    c.stroke();
}

/** A rocky ledge to jump up onto, on the way to the pool. */
function drawLedge(c) {
    const { x0, x1, y } = LAYOUT.ledge;
    c.beginPath();
    c.moveTo(x0 - 20, GRASS_Y + 6); c.lineTo(x0 - 8, y + 40); c.quadraticCurveTo(x0 - 2, y + 4, x0 + 18, y);
    c.lineTo(x1 - 14, y - 3); c.quadraticCurveTo(x1 + 8, y + 6, x1 + 14, y + 44); c.lineTo(x1 + 24, GRASS_Y + 6); c.closePath();
    const pat = tilePattern(c, "rock", 1.15, x0, y);
    c.fillStyle = pat || "#7a6650"; c.fill();
    const sh = c.createLinearGradient(0, y, 0, GRASS_Y); sh.addColorStop(0, "rgba(255,230,180,0.15)"); sh.addColorStop(1, "rgba(30,20,28,0.4)");
    c.fillStyle = sh; c.fill();
    c.strokeStyle = INK; c.lineWidth = 4.5; c.stroke();
    hatch(c, x0 + 50, y + 10, x1 - x0 - 40, GRASS_Y - y - 10, 9, 0.1);
    const gp = tilePattern(c, "grass", 0.9, x0, y - 20);
    c.fillStyle = gp || "#6aa850"; c.fillRect(x0 + 4, y - 8, x1 - x0 - 14, 14);
    c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(x0 + 4, y - 8); c.lineTo(x1 - 10, y - 8); c.stroke();
    const r = rng(12);
    for (let i = 0; i < 9; i++) {
        const x = x0 + 10 + r() * (x1 - x0 - 30);
        c.strokeStyle = "#4a8a4c"; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x - 3, y - 18 - r() * 8); c.moveTo(x, y - 8); c.lineTo(x + 3, y - 16 - r() * 8); c.stroke();
        if (i % 3 === 0) shape(c, p => p.arc(x, y - 22, 2.8, 0, TAU), ["#e8586a", "#f6c84a", "#fff"][i % 3 === 0 ? i / 3 % 3 : 0], null);
    }
}

function cutPool(c) {
    const { x0, x1, surface, floor } = LAYOUT.pool;
    c.save();
    c.globalCompositeOperation = "destination-out";
    c.fillRect(x0, surface - 2, x1 - x0, floor - surface + 2);
    c.restore();
}

function drawPoolRim(c) {
    const { x0, x1, surface, floor } = LAYOUT.pool;
    for (const [rx, rw] of [[x0 - 14, 16], [x1 - 2, 22]]) {                  // the pool's stone lips
        const pat = tilePattern(c, "rock", 1.1, rx, surface);
        shape(c, p => p.rect(rx, GRASS_Y - 6, rw, floor - GRASS_Y + 10), pat || "#7a6650", INK, 3);
    }
    c.strokeStyle = INK; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x0, floor); c.lineTo(x1, floor); c.stroke();
    const r = rng(15);
    c.lineCap = "round";
    for (let i = 0; i < 16; i++) {                                           // reeds
        const x = (i % 2 ? x0 - 8 : x1 + 6) + (r() - 0.5) * 8, h = 22 + r() * 26;
        c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.moveTo(x, GRASS_Y); c.quadraticCurveTo(x + (r() - 0.5) * 12, GRASS_Y - h / 2, x + (r() - 0.5) * 18, GRASS_Y - h); c.stroke();
        c.strokeStyle = "#5aa058"; c.lineWidth = 2.6; c.beginPath(); c.moveTo(x, GRASS_Y); c.quadraticCurveTo(x + (r() - 0.5) * 12, GRASS_Y - h / 2, x + (r() - 0.5) * 18, GRASS_Y - h); c.stroke();
    }
    // a boulder at the cliff's edge, so nobody wanders off it
    const pat = tilePattern(c, "rock", 1.4, 3030, 640);
    c.beginPath(); c.moveTo(3028, GRASS_Y + 4); c.quadraticCurveTo(3030, 650, 3046, 640); c.lineTo(3058, 650); c.lineTo(3058, GRASS_Y + 4); c.closePath();
    c.fillStyle = pat || "#7a6650"; c.fill(); c.strokeStyle = INK; c.lineWidth = 4; c.stroke();
}

/** The pillar runs on down, off the bottom of the world: bare rock, with ivy climbing it. */
function drawPillarBase(c) {
    const r = rng(303);
    const edgeL = y => { for (let i = 1; i < LEFT_EDGE.length; i++) if (y <= LEFT_EDGE[i][1]) return lerp(LEFT_EDGE[i - 1][0], LEFT_EDGE[i][0], (y - LEFT_EDGE[i - 1][1]) / (LEFT_EDGE[i][1] - LEFT_EDGE[i - 1][1])); return LEFT_EDGE[LEFT_EDGE.length - 1][0]; };
    const leaf = (x, y, ang, len, col) => {
        c.save(); c.translate(x, y); c.rotate(ang);
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0); c.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0); c.closePath();
        c.fillStyle = col; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke();
        c.strokeStyle = "rgba(220,255,200,0.4)"; c.lineWidth = 0.9;
        c.beginPath(); c.moveTo(len * 0.1, 0); c.lineTo(len * 0.85, 0); c.stroke();
        c.restore();
    };
    const GREENS = ["#3f8a4a", "#4a9a52", "#357a40", "#5aa65a"];
    c.lineCap = "round"; c.lineJoin = "round";
    const vine = (x, y, len, side, sway) => {                                // one climbing vine, drawn as a curved stem with leaves
        const pts = [];
        for (let k = 0; k <= 14; k++) { const t = k / 14; pts.push([x + Math.sin(t * 5 + sway) * 24 * side + t * 14 * side, y - t * len]); }
        for (const [w, col] of [[9, INK], [5.5, "#3a6a34"]]) {
            c.strokeStyle = col; c.lineWidth = w; c.beginPath();
            pts.forEach((q, k) => (k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
            c.stroke();
        }
        pts.forEach((q, k) => {
            if (k < 1) return;
            const up = -Math.PI / 2;
            leaf(q[0], q[1], up + side * (0.9 + r() * 0.5), 26 + r() * 14, GREENS[(k + (r() * 4 | 0)) % 4]);
            if (k % 2) leaf(q[0], q[1], up - side * (0.8 + r() * 0.5), 20 + r() * 12, GREENS[(k + 2) % 4]);
            if (k % 5 === 0) {                                               // a little curling tendril
                c.strokeStyle = "#3a6a34"; c.lineWidth = 1.4; c.beginPath();
                c.moveTo(q[0], q[1]); c.quadraticCurveTo(q[0] + side * 18, q[1] - 8, q[0] + side * 12, q[1] - 20); c.stroke();
            }
        });
    };
    for (let i = 0; i < 9; i++) {                                            // hanging ivy and climbers on the left face
        const y = 1600 + i * 80 + r() * 40, x = edgeL(y) + 14 + r() * 40;
        vine(x, y + 60 + r() * 100, 200 + r() * 160, i % 2 ? 1 : -1, r() * 6);
    }
    for (let i = 0; i < 9; i++) {                                            // ...and the right face
        const y = 1600 + i * 80 + r() * 40, x = 1996 - 14 - r() * 40;
        vine(x, y + 60 + r() * 100, 200 + r() * 160, i % 2 ? -1 : 1, r() * 6);
    }
    for (let i = 0; i < 6; i++) {                                            // a few thick ones climbing the middle of the shaft
        vine(1330 + r() * 560, 2400 + r() * 150, 260 + r() * 220, r() < 0.5 ? 1 : -1, r() * 6);
    }
}

function drawMarginPlantsProc(c) {
    datePalm(c, 70, GRASS_Y, 210, -0.5);
    pomegranateTree(c, 250, GRASS_Y, 0.95);
    datePalm(c, 3010, GRASS_Y, 230, 0.4);
    pomegranateTree(c, 2790, GRASS_Y, 1.05);
    datePalm(c, 2900, GRASS_Y, 190, -0.2);
    const r = rng(77);
    for (let i = 0; i < 70; i++) {                                           // grass tufts and flowers
        const x = (r() < 0.5 ? 70 + r() * 330 : 2680 + r() * 370);
        c.strokeStyle = "#4a8a4c"; c.lineWidth = 2; c.lineCap = "round";
        c.beginPath(); c.moveTo(x, GRASS_Y); c.lineTo(x - 3, GRASS_Y - 8 - r() * 8); c.moveTo(x, GRASS_Y); c.lineTo(x + 3, GRASS_Y - 7 - r() * 8); c.stroke();
        if (r() < 0.3) shape(c, p => p.arc(x, GRASS_Y - 12, 2.6, 0, TAU), ["#e8586a", "#f6c84a", "#fff"][i % 3], null);
    }
    c.fillStyle = "#6aa850"; c.fillRect(60, GRASS_Y - 6, 345, 8); c.fillRect(2675, GRASS_Y - 6, 380, 8);
    c.strokeStyle = INK; c.lineWidth = 2;
    c.beginPath(); c.moveTo(60, GRASS_Y - 6); c.lineTo(405, GRASS_Y - 6); c.moveTo(2675, GRASS_Y - 6); c.lineTo(3054, GRASS_Y - 6); c.stroke();
}

/** Seen through the cavity: the underground river's rock ends, and its spill over the cliff. */
function drawCavityEdges(c) {
    // the underground river: cut it open below the basement's thick floor, out to the cliff
    const top = F1 + FLOOR_T;
    c.save();
    c.globalCompositeOperation = "destination-out";
    c.fillRect(BLD.x0, top, 3000 - BLD.x0, RIVER_BOT - top);
    c.restore();
    c.strokeStyle = INK; c.lineWidth = 3;
    c.beginPath(); c.moveTo(BLD.x0, top); c.lineTo(3000, top); c.stroke();
    const r = rng(19);
    for (let x = BLD.x0 + 10; x < 2900; x += 30 + r() * 40) {               // stalactites over the water
        const h = 8 + r() * 24;
        shape(c, p => { p.moveTo(x - 7, top + 2); p.lineTo(x + 7, top + 2); p.lineTo(x, top + 2 + h); p.closePath(); }, "#8a7458", INK, 1.4);
    }
    shape(c, p => p.rect(BLD.x0 - 16, top, 18, RIVER_BOT - top), "#6a5642", INK, 2.4);       // the cavity's left end
}

function drawBasementFloor(c) {
    const x0 = BLD.x0, x1 = BLD.x1;
    const fz = tilePattern(c, "frieze", FLOOR_T / 42, x0, F1);
    c.fillStyle = fz || "#c8b07a";
    c.fillRect(x0, F1, x1 - x0, FLOOR_T);
    const sh = c.createLinearGradient(0, F1, 0, F1 + FLOOR_T);
    sh.addColorStop(0, "rgba(255,240,200,0.12)"); sh.addColorStop(1, "rgba(50,28,22,0.38)");
    c.fillStyle = sh; c.fillRect(x0, F1, x1 - x0, FLOOR_T);
    // glass panes onto the river: cut through, then framed in gold with iron bars
    c.save();
    c.globalCompositeOperation = "destination-out";
    for (const [a, b] of LAYOUT.panes) c.fillRect(a, F1, b - a, FLOOR_T);
    c.restore();
    for (const [a, b] of LAYOUT.panes) {
        shape(c, p => p.rect(a, F1, b - a, FLOOR_T), null, GOLD_D, 5);
        c.strokeStyle = INK; c.lineWidth = 2.4;
        c.beginPath(); c.rect(a, F1, b - a, FLOOR_T); c.stroke();
        c.strokeStyle = "#5a4a3a"; c.lineWidth = 4;
        for (let x = a + (b - a) / 3; x < b - 4; x += (b - a) / 3) { c.beginPath(); c.moveTo(x, F1 + 2); c.lineTo(x, F1 + FLOOR_T - 2); c.stroke(); }
    }
    c.fillStyle = GOLD; c.fillRect(x0, F1, x1 - x0, 5);
    c.fillStyle = GOLD_D; c.fillRect(x0, F1 + FLOOR_T - 4, x1 - x0, 4);
    shape(c, p => p.rect(x0, F1, x1 - x0, FLOOR_T), null, INK, 2.6);
}

export function drawIslandBase(c) {
    drawRock(c);
    cutPool(c);
    drawMarginPlants(c);
    drawLedge(c);
    drawPoolRim(c);
    drawAntNest(c);
    drawPillarBase(c);
}

// -------------------------------------------------------------- the palace

const WARM = ["#f3e6c4", "#ecdcb2", "#f7edd0", "#e6d4a8", "#efe0bc"];
const COOL = ["#c9ccdc", "#bfc3d6", "#d2d5e4", "#b6bad0"];

/** Dressed stone: real courses of blocks, for walls that look like they could hold the weight. */
function ashlar(c, x0, y0, x1, y1, seed, palette, mortar, rowH) {
    c.save();
    c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
    blocks(c, x0, y0, x1, y1, rowH || 56, palette, seed, mortar);
    brushwork(c, x0, y0, x1 - x0, y1 - y0, Math.floor((x1 - x0) * (y1 - y0) / 4200), seed + 5);
    c.restore();
}

function brushwork(c, x, y, w, h, n, seed) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
        const px = x + r() * w, py = y + r() * h, len = 8 + r() * 22, ang = -0.7 + r() * 0.4;
        c.strokeStyle = r() < 0.5 ? `rgba(70,40,24,${0.03 + r() * 0.07})` : `rgba(255,245,215,${0.03 + r() * 0.06})`;
        c.lineWidth = 1 + r() * 2.2;
        c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len); c.stroke();
    }
}

function drawInterior(c) {
    const gTop = 70;                                            // the garden's back wall stops here; above is sky
    ashlar(c, BLD.x0, gTop, 1045, F3 + SLAB_T, 11, WARM, "#8a6a48");           // the garden court's high wall
    ashlar(c, 1045, -66, 1750, F3 + SLAB_T, 12, WARM, "#8a6a48");              // the prayer hall
    ashlar(c, BLD.x0, F3 + SLAB_T, 1750, F2 + SLAB_T, 13, WARM, "#8a6a48");    // the library and the desk
    ashlar(c, BLD.x0, F2 + SLAB_T, BLD.x1, F1, 14, COOL, "#5a5a7a");           // the vaulted basement
    // carved relief panels in the walls, and shadow where wall meets floor and ceiling (depth, not fog)
    if (ART.panel) {
        const pan = (x, yBot, h) => {
            const w = ART.panel.width * (h / ART.panel.height);
            shape(c, p => p.rect(x - w / 2 - 6, yBot - h - 6, w + 12, h + 12), GOLD, GOLD_D, 2.4);
            c.drawImage(ART.panel, x - w / 2, yBot - h, w, h);
            shape(c, p => p.rect(x - w / 2, yBot - h, w, h), null, INK, 1.8);
        };
        pan(1262, F3 - 40, 190); pan(1730, F3 - 40, 190);
        pan(1262, F2 - 40, 170); pan(1660, F2 - 40, 170);
    }
    for (const [x0, x1, yB] of [[BLD.x0, 1750, F2], [BLD.x0, BLD.x1, F1], [444, 1045, F3], [BLD.x0, 1750, F3]]) {
        const ao = c.createLinearGradient(0, yB - 90, 0, yB);
        ao.addColorStop(0, "rgba(80,40,30,0)"); ao.addColorStop(1, "rgba(80,40,30,0.24)");
        c.fillStyle = ao; c.fillRect(x0, yB - 90, x1 - x0, 90);
    }
    // the basement is vaulted: piers and pointed arches, so it reads as a crypt of stone rather than a cellar
    for (const px of [996, 1230, 1400]) drawColumn(c, px, F2 + SLAB_T, F1, 44);
    for (const [ax, aw] of [[470, 240], [740, 230]]) {
        shape(c, p => gothic(c, ax, F2 + SLAB_T + 8, aw, F1 - F2 - SLAB_T - 8), null, "rgba(90,70,110,0.85)", 6);
        shape(c, p => gothic(c, ax + 10, F2 + SLAB_T + 18, aw - 20, F1 - F2 - SLAB_T - 18), null, GOLD_D, 2.4);
    }
    // windows: cut real holes so the live world shows through
    c.save();
    c.globalCompositeOperation = "destination-out";
    LAYOUT.windows.forEach(w => { c.beginPath(); gothic(c, w.x, w.y, w.w, w.h); c.fill(); });
    c.restore();
}

function drawWindowFrame(c, win) {
    const { x, y, w, h } = win;
    c.save(); c.beginPath(); gothic(c, x, y, w, h); c.fillStyle = "rgba(255,236,190,0.16)"; c.fill(); c.restore();     // a trace of tint
    c.strokeStyle = "rgba(217,171,76,0.9)"; c.lineWidth = 2.2;
    c.save(); c.beginPath(); gothic(c, x, y, w, h); c.clip();
    for (let k = -8; k < 14; k++) {
        c.beginPath(); c.moveTo(x + k * 34, y); c.lineTo(x + k * 34 + h * 0.5, y + h); c.stroke();
        c.beginPath(); c.moveTo(x + k * 34 + h * 0.5, y); c.lineTo(x + k * 34, y + h); c.stroke();
    }
    c.restore();
    shape(c, p => gothic(c, x, y, w, h), null, TURQ_D, 5);
    shape(c, p => gothic(c, x - 8, y - 8, w + 16, h + 8), null, GOLD, 3);
    shape(c, p => gothic(c, x - 12, y - 12, w + 24, h + 12), null, INK, 2);
    star8(c, x + w / 2, y + w * 0.46, w * 0.17, "rgba(58,169,176,0.7)");
    shape(c, p => p.rect(x - 20, y + h, w + 40, 12), CREAM, INK, 2.2);
}

function drawColumn(c, x, y0, y1, w) {
    w = w || 52;
    const car = ART.carve;
    if (car) {
        c.save();
        c.beginPath(); c.rect(x, y0, w, y1 - y0); c.clip();
        const sc = w / iw(car), th = ih(car) * sc;
        for (let y = y0, i = 0; y < y1; y += th, i++) {                        // carved tile, flipped alternately so it never shows a seam
            c.save(); c.translate(x, y + (i % 2 ? th : 0)); c.scale(1, i % 2 ? -1 : 1); c.drawImage(car, 0, 0, w, th + 1); c.restore();
        }
        const g = c.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, "rgba(60,30,20,0.35)"); g.addColorStop(0.4, "rgba(255,240,200,0.12)"); g.addColorStop(1, "rgba(60,30,20,0.4)");
        c.fillStyle = g; c.fillRect(x, y0, w, y1 - y0);
        c.restore();
        shape(c, p => p.rect(x, y0, w, y1 - y0), null, INK, 2.6);
    } else {
        const g = c.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, "#8ed0d4"); g.addColorStop(0.35, "#eefcfc"); g.addColorStop(0.7, "#b2dcdf"); g.addColorStop(1, "#6ab0b8");
        shape(c, p => p.rect(x, y0, w, y1 - y0), g, INK, 2.6);
        facets(c, x, y0, w, y1 - y0, 12, x, 0.2);
    }
    shape(c, p => p.rect(x - 11, y0 - 4, w + 22, 22), GOLD, GOLD_D, 2.4);
    scallops(c, x - 8, x + w + 8, y0 + 18, 8, "#f6e6b4");
    shape(c, p => p.rect(x - 10, y1 - 22, w + 20, 22), GOLD, GOLD_D, 2.4);
    hatch(c, x + w * 0.55, y0 + 20, w * 0.45, y1 - y0 - 44, 9, 0.12);
}

function drawOuterWalls(c) {
    const wTop = 204, wx = BLD.x0, ww = 60, doorTop = F2 - 252;
    const stone = (x, y, w, h, seed) => {
        c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
        blocks(c, x, y, x + w, y + h, 50, ["#e9dab4", "#dfcc9e", "#f1e4c2", "#d6c08e"], seed, "#7a5a3c");
        const g = c.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, "rgba(60,30,20,0.34)"); g.addColorStop(1, "rgba(255,240,200,0.1)");
        c.fillStyle = g; c.fillRect(x, y, w, h);
        c.restore();
        shape(c, p => p.rect(x, y, w, h), null, INK, 3);
    };
    // the left wall: the garden wall above the doorway, the basement wall below the floor; the doorway at ground level is open
    stone(wx, wTop, ww, doorTop - wTop, 31);
    stone(wx, F2, ww, F1 - F2, 32);
    for (let x = wx; x < wx + ww; x += 16) shape(c, p => p.rect(x, wTop - 14, 12, 14), "#efe3c0", INK, 1.8);       // merlons
    shape(c, p => p.rect(wx - 8, doorTop - 6, ww + 16, 18), GOLD, GOLD_D, 2.6);                                  // lintel
    for (const dx of [wx - 6, wx + ww - 8]) shape(c, p => p.rect(dx, doorTop + 10, 14, F2 - doorTop - 10), "#f1e4c2", INK, 2.2);   // jambs
    // a stepped buttress outside, and ivy over the top
    for (let i = 0; i < 4; i++) stone(wx - 22 - i * 0, F2 - 60 - i * 72 - 0, 22, 72, 40 + i);
    c.strokeStyle = "#3f8a48"; c.lineWidth = 3; c.lineCap = "round";
    for (let i = 0; i < 12; i++) {
        const y = wTop + 10 + i * 18;
        if (y > doorTop - 6) break;
        c.beginPath(); c.moveTo(wx - 2, y); c.quadraticCurveTo(wx - 14, y + 10, wx - 6, y + 24); c.stroke();
        shape(c, p => p.ellipse(wx - 10, y + 12, 5, 3, 0.6, 0, TAU), "#4a9a52", null);
    }
    // the right: the basement's stone wall, and a gate onto the terrace garden above it
    stone(BLD.x1 - 60, F2 + SLAB_T, 60, F1 - F2 - SLAB_T, 33);
    drawColumn(c, BLD.x1 - 84, F2 - 380, F2, 44);
    drawColumn(c, BLD.x1 + 22, F2 - 380, F2, 44);
    shape(c, p => gothic(c, BLD.x1 - 84, F2 - 440, 150, 80), null, GOLD, 5);
    shape(c, p => p.rect(BLD.x1 - 96, F2 - 386, 174, 16), GOLD, GOLD_D, 2.4);
}

function dome(c, cx, rx, ry, base) {
    c.save();
    const g = c.createRadialGradient(cx - rx * 0.25, base - ry * 0.8, 10, cx, base - ry * 0.4, rx);
    g.addColorStop(0, "#e8fbfb");
    g.addColorStop(0.55, "#6fcfd0");
    g.addColorStop(1, "#2a8e9c");
    c.beginPath();
    c.moveTo(cx - rx, base);
    c.ellipse(cx, base, rx, ry, 0, Math.PI, TAU);
    c.closePath();
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK; c.lineWidth = 2.8; c.stroke();
    c.clip();
    // glazed tile pattern: diamond lattice
    c.strokeStyle = "rgba(255,255,255,0.25)"; c.lineWidth = 1.6;
    for (let k = -30; k < 40; k++) {
        c.beginPath(); c.moveTo(cx - rx + k * 26, base); c.lineTo(cx - rx + k * 26 + ry, base - ry); c.stroke();
        c.beginPath(); c.moveTo(cx - rx + k * 26 + ry, base); c.lineTo(cx - rx + k * 26, base - ry); c.stroke();
    }
    facets(c, cx - rx, base - ry, rx * 2, ry, 22, cx, 0.16);
    c.strokeStyle = GOLD; c.lineWidth = 3;
    for (let k = -4; k <= 4; k++) {
        c.beginPath(); c.moveTo(cx + (k * rx) / 4.2, base); c.quadraticCurveTo(cx + (k * rx) / 7, base - ry * 1.15, cx, base - ry); c.stroke();
    }
    c.restore();
    shape(c, p => p.rect(cx - rx - 8, base - 14, rx * 2 + 16, 20), GOLD, GOLD_D, 2.4);
    shape(c, p => p.rect(cx - 3, base - ry - 38, 6, 40), GOLD, GOLD_D, 1.6);
    shape(c, p => p.arc(cx, base - ry - 42, 12, 0, TAU), GOLD, GOLD_D, 2);
    shape(c, p => { p.moveTo(cx, base - ry - 52); p.lineTo(cx + 4, base - ry - 78); p.lineTo(cx - 4, base - ry - 78); p.closePath(); }, GOLD, GOLD_D, 1.4);
}

function goldDome(c, cx, cy, r) {
    const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.5, 2, cx, cy, r);
    g.addColorStop(0, "#fff1b0"); g.addColorStop(0.5, "#e2b244"); g.addColorStop(1, "#9b7428");
    shape(c, p => { p.moveTo(cx - r, cy); p.ellipse(cx, cy, r, r * 1.05, 0, Math.PI, TAU); p.closePath(); }, g, INK, 2.2);
    shape(c, p => p.rect(cx - 3, cy - r * 1.05 - 20, 6, 22), GOLD, GOLD_D, 1.4);
    shape(c, p => p.arc(cx, cy - r * 1.05 - 22, 6, 0, TAU), GOLD, GOLD_D, 1.4);
}

function minaret(c, x, baseY, h, flagSide) {
    const w = 36;
    const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, TURQ_D); g.addColorStop(0.4, TURQ_L); g.addColorStop(1, TURQ_D);
    const topY = baseY - h;
    shape(c, p => p.rect(x - w / 2, baseY - h * 0.62, w, h * 0.62), g, INK, 2.6);
    c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 1.6;
    for (let y = baseY - 12; y > baseY - h * 0.62; y -= 18) { c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y - 9); c.moveTo(x - w / 2, y - 9); c.lineTo(x + w / 2, y); c.stroke(); }
    shape(c, p => p.rect(x - w / 2 - 3, baseY - h * 0.62 - 3, w + 6, 8), GOLD, GOLD_D, 1.6);
    const by = baseY - h * 0.62 - 14;                                                    // the balcony
    shape(c, p => p.rect(x - w / 2 - 12, by - 6, w + 24, 14), "#f6e6b4", INK, 2);
    for (let i = 0; i < 5; i++) shape(c, p => p.rect(x - w / 2 - 10 + i * 11, by - 18, 4, 14), GOLD, GOLD_D, 1);
    shape(c, p => p.rect(x - w / 2 + 6, topY + 40, w - 12, by - topY - 46), g, INK, 2.4);
    shape(c, p => gothic(c, x - 6, by - 34, 12, 26), "#16505c", INK, 1.2);
    goldDome(c, x, topY + 40, w * 0.55);
    if (flagSide) {
        const fx = x, fy = topY - 14;
        c.strokeStyle = INK; c.lineWidth = 3;
        c.beginPath(); c.moveTo(fx, topY + 8); c.lineTo(fx, fy - 70); c.stroke();
        shape(c, p => { p.moveTo(fx, fy - 70); p.quadraticCurveTo(fx + 36 * flagSide, fy - 82, fx + 78 * flagSide, fy - 64); p.quadraticCurveTo(fx + 52 * flagSide, fy - 40, fx + 82 * flagSide, fy - 22); p.quadraticCurveTo(fx + 40 * flagSide, fy - 34, fx, fy - 30); p.closePath(); }, "#1f3a30", GOLD_D, 2);
        c.strokeStyle = GOLD; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(fx + 10 * flagSide, fy - 62); c.quadraticCurveTo(fx + 34 * flagSide, fy - 66, fx + 58 * flagSide, fy - 54); c.stroke();
        star8(c, fx + 36 * flagSide, fy - 52, 9, "rgba(217,171,76,0.85)");
    }
}

function roofGarden(c, x0, x1, seed) {
    shape(c, p => p.rect(x0, -86, x1 - x0, 24), "#a88a64", INK, 2.6);          // a stone planter on the parapet
    const gp = tilePattern(c, "grass", 0.8, x0, -100);
    c.fillStyle = gp || "#6aa850"; c.fillRect(x0 + 3, -96, x1 - x0 - 6, 14);
    const r = rng(seed);
    for (let x = x0 + 8; x < x1 - 6; x += 10) {
        c.strokeStyle = "#4a8a4c"; c.lineWidth = 2; c.beginPath(); c.moveTo(x, -92); c.lineTo(x - 2, -102 - r() * 8); c.stroke();
        if (r() < 0.3) shape(c, p => p.arc(x, -108, 2.6, 0, TAU), ["#e8586a", "#f6c84a", "#fff"][Math.floor(r() * 3)], null);
    }
}

function drawRoof(c) {
    dome(c, 1397, 250, 175, -66);
    minaret(c, 424, 204, 430, 1);
    minaret(c, 1752, -60, 330, -1);
    // gardens and trees on top of the hall, either side of the dome
    treeSprite(c, "palms", 1100, -90, 190);
    treeSprite(c, "pomA", 1670, -90, 130, true);
    roofGarden(c, 1050, 1150, 3);
    roofGarden(c, 1650, 1740, 4);
}

function drawCeiling(c) {
    const x0 = 1045, x1 = 1750;
    const g = c.createLinearGradient(0, -66, 0, 46);
    g.addColorStop(0, "#e2cf9a");
    g.addColorStop(1, "#f6ecd0");
    shape(c, p => p.rect(x0, -72, x1 - x0, 118), g, INK, 2.6);
    ashlar(c, x0, -72, x1, -30, 77, WARM, "#8a6a48", 40);
    c.strokeStyle = GOLD; c.lineWidth = 4;
    c.beginPath(); c.moveTo(x0, -14); c.lineTo(x1, -14); c.moveTo(x0, 36); c.lineTo(x1, 36); c.stroke();
    for (let x = x0 + 55; x < x1; x += 150) star8(c, x, 11, 15, "rgba(58,169,176,0.55)");
    for (let x = x0 + 20; x < x1 - 10; x += 56) {                           // corbels under the cornice: heavy, stepped
        shape(c, p => { p.moveTo(x, 46); p.lineTo(x + 22, 46); p.lineTo(x + 22, 56); p.lineTo(x + 16, 56); p.lineTo(x + 16, 66); p.lineTo(x + 6, 66); p.lineTo(x + 6, 56); p.lineTo(x, 56); p.closePath(); }, "#d9c595", INK, 1.8);
    }
    scallops(c, x0, x1, 46, 14, "#cfeceb");
    shape(c, p => p.rect(x0 - 10, -84, x1 - x0 + 20, 14), GOLD, GOLD_D, 2.6);          // parapet cornice
    for (let x = x0 - 6; x < x1 + 6; x += 22) shape(c, p => p.rect(x, -96, 14, 12), "#efe3c0", INK, 1.6);
}

function drawSlab(c, y, segs) {
    for (const [x0, x1] of segs) {
        const fz = tilePattern(c, "frieze", SLAB_T / 42, x0, y);
        if (fz) {
            c.fillStyle = fz; c.fillRect(x0, y, x1 - x0, SLAB_T);
            const sh = c.createLinearGradient(0, y, 0, y + SLAB_T);
            sh.addColorStop(0, "rgba(255,240,200,0.1)"); sh.addColorStop(1, "rgba(60,30,20,0.3)");
            c.fillStyle = sh; c.fillRect(x0, y, x1 - x0, SLAB_T);
            shape(c, p => p.rect(x0, y, x1 - x0, SLAB_T), null, INK, 2.6);
        } else {
            const g = c.createLinearGradient(0, y, 0, y + SLAB_T);
            g.addColorStop(0, "#fff8e6"); g.addColorStop(0.5, "#e9d9ae"); g.addColorStop(1, "#c8b07a");
            shape(c, p => p.rect(x0, y, x1 - x0, SLAB_T), g, INK, 2.6);
        }
        c.fillStyle = GOLD; c.fillRect(x0, y, x1 - x0, 5);
        c.fillRect(x0, y + SLAB_T - 3, x1 - x0, 3);
        scallops(c, x0, x1, y + SLAB_T, 16, "#f3e7c4");
        const sg = c.createLinearGradient(0, y + SLAB_T + 6, 0, y + SLAB_T + 70);          // the shadow it casts on the room below
        sg.addColorStop(0, "rgba(60,30,36,0.3)"); sg.addColorStop(1, "rgba(60,30,36,0)");
        c.fillStyle = sg; c.fillRect(x0, y + SLAB_T + 6, x1 - x0, 64);
        hatch(c, x0, y + SLAB_T + 6, x1 - x0, 28, 8, 0.08);
    }
}

function drawShaft(c) {
    // the lift's shaft: a recess in the stone, gilt guide rails, and the pulley housing at the top
    const x0 = SHAFT.x0, x1 = SHAFT.x1;
    c.fillStyle = "rgba(60,40,34,0.28)"; c.fillRect(x0, 46, x1 - x0, F1 - 46);
    for (const rx of [x0 + 10, x1 - 10]) {
        shape(c, p => p.rect(rx - 4, 70, 8, F1 - 70), "#8a6a3a", INK, 2);
        c.strokeStyle = "rgba(255,230,160,0.5)"; c.lineWidth = 1.4;
        for (let y = 90; y < F1; y += 30) { c.beginPath(); c.moveTo(rx - 3, y); c.lineTo(rx + 3, y); c.stroke(); }
    }
    shape(c, p => p.rect(x0 - 6, 40, x1 - x0 + 12, 44), "#6a5236", INK, 2.8);
    shape(c, p => p.arc(SHAFT.x, 70, 26, 0, TAU), "#b8903a", INK, 2.6);
    c.strokeStyle = INK; c.lineWidth = 2.4;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.beginPath(); c.moveTo(SHAFT.x, 70); c.lineTo(SHAFT.x + Math.cos(a) * 24, 70 + Math.sin(a) * 24); c.stroke(); }
    shape(c, p => p.arc(SHAFT.x, 70, 6, 0, TAU), "#4a3a2a", INK, 2);
    shape(c, p => p.rect(x0 + 4, F1 - 18, x1 - x0 - 8, 18), "#7a6040", INK, 2.4);        // buffers at the bottom of the shaft
}

/** The lift: a plank deck on ropes, a counterweight on the other rail, a lamp. */
export function drawLift(c, lift, t) {
    const x = lift.x, y = lift.y, w = 150;
    const cwY = F3 + (F1 - y);                                              // the counterweight rises as the deck falls
    c.strokeStyle = INK; c.lineWidth = 4.4; c.lineCap = "round";
    for (const rx of [x - 62, x + 62]) { c.beginPath(); c.moveTo(rx, 76); c.lineTo(rx, y); c.stroke(); }
    c.beginPath(); c.moveTo(SHAFT.x1 - 24, 76); c.lineTo(SHAFT.x1 - 24, cwY - 36); c.stroke();
    c.strokeStyle = "#a88a54"; c.lineWidth = 2;
    for (const rx of [x - 62, x + 62]) { c.beginPath(); c.moveTo(rx, 76); c.lineTo(rx, y); c.stroke(); }
    c.beginPath(); c.moveTo(SHAFT.x1 - 24, 76); c.lineTo(SHAFT.x1 - 24, cwY - 36); c.stroke();
    shape(c, p => p.rect(SHAFT.x1 - 40, cwY - 36, 32, 52), "#5a5f68", INK, 2.6);                // counterweight
    c.fillStyle = "rgba(255,255,255,0.3)"; c.fillRect(SHAFT.x1 - 37, cwY - 33, 5, 46);
    // deck, posts, chain rail, lamp
    shape(c, p => p.rect(x - w / 2, y, w, 16), "#8a5e3c", INK, 2.6);
    c.fillStyle = GOLD; c.fillRect(x - w / 2, y, w, 4);
    c.strokeStyle = "rgba(60,30,10,0.4)"; c.lineWidth = 1.4;
    for (let k = 1; k < 6; k++) { c.beginPath(); c.moveTo(x - w / 2 + k * w / 6, y + 4); c.lineTo(x - w / 2 + k * w / 6, y + 16); c.stroke(); }
    for (const px of [x - w / 2 + 6, x + w / 2 - 6]) shape(c, p => p.rect(px - 4, y - 74, 8, 74), "#b8903a", INK, 2.2);
    c.strokeStyle = INK; c.lineWidth = 3.4;
    for (const hy of [y - 50, y - 24]) { c.beginPath(); c.moveTo(x - w / 2 + 6, hy); c.quadraticCurveTo(x, hy + 10, x + w / 2 - 6, hy); c.stroke(); }
    c.strokeStyle = "#c8c0a8"; c.lineWidth = 1.6;
    for (const hy of [y - 50, y - 24]) { c.beginPath(); c.moveTo(x - w / 2 + 6, hy); c.quadraticCurveTo(x, hy + 10, x + w / 2 - 6, hy); c.stroke(); }
    shape(c, p => { p.moveTo(x + w / 2 - 14, y - 76); p.lineTo(x + w / 2 + 2, y - 76); p.lineTo(x + w / 2 + 6, y - 96); p.lineTo(x + w / 2 - 18, y - 96); p.closePath(); }, "#fff2c8", GOLD_D, 2);
}

/** A plate closes the opening on every floor the lift is not standing at. */
export function drawShutters(c, lift) {
    for (const fy of [F3, F2, F1]) {
        if (Math.abs(lift.y - fy) <= 8) continue;
        shape(c, p => p.rect(SHAFT.x0, fy, SHAFT.x1 - SHAFT.x0, 18), "#8a5e3c", INK, 2.6);
        c.fillStyle = GOLD; c.fillRect(SHAFT.x0, fy, SHAFT.x1 - SHAFT.x0, 4);
        c.strokeStyle = "rgba(60,30,10,0.45)"; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(SHAFT.x, fy + 4); c.lineTo(SHAFT.x, fy + 18); c.stroke();
        for (let k = 0; k < 5; k++) { c.fillStyle = k % 2 ? "#2a2018" : "#e0b040"; c.fillRect(SHAFT.x0 + 8 + k * 8, fy + 6, 6, 6); c.fillRect(SHAFT.x1 - 14 - k * 8, fy + 6, 6, 6); }
    }
}

// ---------------------------------------------- ground floor: the terrace garden

function drawTerrace(c) {
    const fy = F2, tx0 = 1752, tx1 = BLD.x1 - 90;
    // a long reflecting channel with a gilded rim, and planter beds
    const ch = c.createLinearGradient(0, fy - 10, 0, fy);
    ch.addColorStop(0, "#9ae6ee"); ch.addColorStop(1, "#3aa9b0");
    shape(c, p => p.rect(2090, fy - 10, 400, 10), ch, GOLD_D, 2);
    for (const [bx, bw] of [[1770, 70], [1975, 100], [2272, 100], [2520, 90]]) {
        shape(c, p => p.rect(bx, fy - 28, bw, 28), "#a88a64", INK, 2.4);
        const gp = tilePattern(c, "grass", 0.8, bx, fy - 40);
        c.fillStyle = gp || "#6aa850"; c.fillRect(bx + 3, fy - 36, bw - 6, 10);
        hatch(c, bx + bw * 0.6, fy - 26, bw * 0.4, 24, 7, 0.1);
    }
    // trees: real ones
    treeSprite(c, "pomA", 1812, fy - 28, 215);
    treeSprite(c, "palms", 2038, fy - 28, 310, true);
    treeSprite(c, "pomB", 2175, fy - 28, 190);
    treeSprite(c, "palms", 2330, fy - 28, 290);
    treeSprite(c, "pomA", 2480, fy - 28, 230, true);
    treeSprite(c, "pomB", 2565, fy - 28, 185, true);
    const r = rng(9);
    for (let i = 0; i < 46; i++) {                                           // flowers in the beds
        const bed = [[1770, 70], [1975, 100], [2272, 100], [2520, 90]][i % 4];
        const x = bed[0] + 6 + r() * (bed[1] - 12);
        c.strokeStyle = "#3f8a48"; c.lineWidth = 2; c.beginPath(); c.moveTo(x, fy - 36); c.lineTo(x, fy - 46 - r() * 10); c.stroke();
        shape(c, p => p.arc(x, fy - 50 - r() * 6, 3.4, 0, TAU), ["#e8586a", "#f6c84a", "#f08ab0", "#fff"][i % 4], INK, 0.8);
    }
    // a vine-hung pergola over the channel
    for (const px of [2100, 2480]) shape(c, p => p.rect(px - 7, fy - 270, 14, 270), "#a87a4e", INK, 2.4);
    shape(c, p => p.rect(2090, fy - 282, 400, 16), "#b8946a", INK, 2.6);
    for (let x = 2100; x < 2480; x += 28) shape(c, p => p.rect(x, fy - 292, 8, 12), "#a87a4e", INK, 1.4);
    for (let x = 2108; x < 2484; x += 16) {
        const len = 24 + r() * 56;
        c.strokeStyle = "#3f8a48"; c.lineWidth = 2.6; c.beginPath(); c.moveTo(x, fy - 266); c.quadraticCurveTo(x + (r() - 0.5) * 8, fy - 266 + len / 2, x + (r() - 0.5) * 6, fy - 266 + len); c.stroke();
        shape(c, p => p.ellipse(x, fy - 266 + len * 0.6, 7, 4.5, r(), 0, TAU), "#4a9a52", INK, 1);
        if (r() < 0.35) for (let k = 0; k < 6; k++) shape(c, p => p.arc(x + (k % 3) * 4 - 4, fy - 266 + len + Math.floor(k / 3) * 6, 4.2, 0, TAU), "#6a3a8c", INK, 1);
    }
    // lamp posts with lanterns
    for (const lx of [1990, 2260, 2570]) {
        shape(c, p => p.rect(lx - 3, fy - 160, 6, 160), "#5a4a3a", INK, 2);
        shape(c, p => { p.moveTo(lx - 10, fy - 160); p.lineTo(lx + 10, fy - 160); p.lineTo(lx + 14, fy - 134); p.lineTo(lx - 14, fy - 134); p.closePath(); }, "#fff2c8", GOLD_D, 2);
        shape(c, p => p.rect(lx - 12, fy - 168, 24, 8), GOLD, GOLD_D, 1.6);
    }
}

// ------------------------------------------------------ top floor: the garden

function trellis(c, x0, x1, y0, y1) {
    shape(c, p => p.rect(x0, y0, x1 - x0, y1 - y0), "rgba(120,80,40,0.25)", "#8a5e3c", 2.4);
    c.strokeStyle = "#a87a4e"; c.lineWidth = 2.4;
    for (let x = x0 + 14; x < x1; x += 22) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke(); }
    for (let y = y0 + 14; y < y1; y += 22) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); }
    const r = rng(x0);
    for (let i = 0; i < 26; i++) shape(c, p => p.ellipse(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 9 + r() * 5, 6 + r() * 3, r() * 3, 0, TAU), "#4a9a52", INK, 1.2);
    for (let i = 0; i < 7; i++) {
        const gx = x0 + 20 + r() * (x1 - x0 - 40), gy = y0 + 30 + r() * (y1 - y0 - 50);
        for (let k = 0; k < 8; k++) shape(c, p => p.arc(gx + (k % 3) * 5 - 5, gy + Math.floor(k / 3) * 6, 4.4, 0, TAU), "#6a3a8c", INK, 1);
    }
}

function drawGarden(c) {
    const gx0 = 444, gx1 = 1045, gTop = 70, fy = F3;
    // the high back wall, with pointed alcoves and a crenellated top
    for (let x = gx0; x < gx1; x += 26) shape(c, p => p.rect(x, gTop - 14, 18, 14), "#efe3c0", INK, 1.8);
    for (const ax of [520, 640, 880, 980]) {
        shape(c, p => gothic(c, ax - 34, fy - 214, 68, 190), "#e8d7aa", GOLD_D, 2.6);
        shape(c, p => gothic(c, ax - 24, fy - 202, 48, 178), "#3aa9b0", INK, 1.6);
    }
    if (!ART.pomA) trellis(c, 700, 860, fy - 200, fy - 24);
    // raised beds, a water channel, a fountain
    shape(c, p => p.rect(gx0 + 10, fy - 26, 250, 26), "#7a5a3a", INK, 2.2);
    shape(c, p => p.rect(gx1 - 270, fy - 26, 260, 26), "#7a5a3a", INK, 2.2);
    c.fillStyle = "#58a050"; c.fillRect(gx0 + 10, fy - 30, 250, 6); c.fillRect(gx1 - 270, fy - 30, 260, 6);
    (treeSprite(c, "pomA", 770, fy - 26, 215) || pomegranateTree(c, 880, fy - 26, 0.75));
    (treeSprite(c, "palms", 575, fy - 26, 262) || datePalm(c, 500, fy - 26, 230, -0.15));
    (treeSprite(c, "palms", 932, fy - 26, 225, true) || datePalm(c, 980, fy - 26, 210, 0.2));
    treeSprite(c, "pomB", 478, fy - 26, 150);
    const r = rng(5);
    for (let i = 0; i < 40; i++) {                                         // flowers
        const x = gx0 + 20 + r() * 235 + (i % 2 ? 540 : 0);
        c.strokeStyle = "#3f8a48"; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x, fy - 28); c.lineTo(x, fy - 40 - r() * 10); c.stroke();
        shape(c, p => p.arc(x, fy - 44 - r() * 6, 3.4, 0, TAU), ["#e8586a", "#f6c84a", "#f08ab0", "#fff"][i % 4], INK, 0.8);
    }
    // the fountain basin (the jet is live)
    const fx = LAYOUT.fountain.x;
    shape(c, p => { p.moveTo(fx - 56, fy); p.lineTo(fx - 48, fy - 28); p.lineTo(fx + 48, fy - 28); p.lineTo(fx + 56, fy); p.closePath(); }, "#f1e6c6", INK, 2.4);
    shape(c, p => p.rect(fx - 54, fy - 34, 108, 8), GOLD, GOLD_D, 1.8);
    shape(c, p => p.rect(fx - 6, fy - 70, 12, 38), "#e9d9ae", INK, 1.8);
    shape(c, p => { p.moveTo(fx - 26, fy - 62); p.quadraticCurveTo(fx, fy - 40, fx + 26, fy - 62); p.closePath(); }, "#f1e6c6", INK, 1.8);
}

export function drawFountain(c, t) {
    const { x, y } = LAYOUT.fountain;
    c.save();
    c.fillStyle = "rgba(140,225,235,0.9)"; c.fillRect(x - 46, y - 31, 92, 5);
    c.strokeStyle = "rgba(200,245,250,0.9)"; c.lineWidth = 2.4; c.lineCap = "round";
    for (let i = 0; i < 9; i++) {
        const ph = (t * 1.3 + i / 9) % 1, dir = i % 2 ? 1 : -1, sp = 6 + (i % 4) * 4;
        const px = x + dir * sp * 3.2 * ph, py = y - 70 - 42 * Math.sin(ph * Math.PI) + 34 * ph * ph;
        c.beginPath(); c.arc(px, py, 2.4, 0, TAU); c.fillStyle = "rgba(220,250,255,0.95)"; c.fill();
    }
    c.beginPath(); c.moveTo(x, y - 70); c.quadraticCurveTo(x, y - 106, x, y - 100); c.stroke();
    c.restore();
}

// ------------------------------------------------------ top floor: prayer hall

function drawPrayerHall(c) {
    const fy = F3;
    // a balustrade where the hall ends above the terrace
    for (let x = 1700; x < 1748; x += 12) shape(c, p => { p.moveTo(x, fy); p.lineTo(x + 7, fy); p.lineTo(x + 8, fy - 36); p.lineTo(x - 1, fy - 36); p.closePath(); }, "#efe3c0", INK, 1.6);
    shape(c, p => p.rect(1696, fy - 46, 56, 12), GOLD, GOLD_D, 2);
    // an arcade between the garden and the hall
    drawColumn(c, 1008, 60, fy, 36);
    drawColumn(c, 1216, 60, fy, 36);
    shape(c, p => gothic(c, 1008, 52, 244, fy - 52), null, GOLD, 3);
    // the mihrab: a pointed niche, a shell-vault, a lamp
    const mx = 1480;
    shape(c, p => gothic(c, mx - 74, fy - 262, 148, 262), "#efe0b0", INK, 2.8);
    shape(c, p => gothic(c, mx - 62, fy - 250, 124, 250), GOLD, GOLD_D, 3);
    const ng = c.createLinearGradient(0, fy - 250, 0, fy);
    ng.addColorStop(0, "#1f6a78"); ng.addColorStop(1, "#0d3a46");
    shape(c, p => gothic(c, mx - 54, fy - 242, 108, 242), ng, INK, 2);
    for (let i = 0; i < 6; i++) {                                           // the shell
        const a0 = Math.PI + (i / 6) * Math.PI;
        c.strokeStyle = "rgba(217,171,76,0.7)"; c.lineWidth = 1.8;
        c.beginPath(); c.moveTo(mx, fy - 180); c.lineTo(mx + Math.cos(a0) * 54, fy - 180 + Math.sin(a0) * 54); c.stroke();
    }
    star8(c, mx, fy - 120, 22, "rgba(217,171,76,0.4)");
    // tall brass lamps either side, a lectern with an open book
    for (const lx of [mx - 100, mx + 100]) {
        shape(c, p => p.rect(lx - 3, fy - 130, 6, 130), "#b8903a", INK, 1.8);
        shape(c, p => p.ellipse(lx, fy - 6, 16, 5, 0, 0, TAU), "#b8903a", INK, 1.8);
        shape(c, p => p.rect(lx - 9, fy - 146, 18, 16), "#fff2c0", GOLD_D, 1.8);
    }
    const lq = 1660;                                                        // the lectern and its open book
    shape(c, p => p.rect(lq - 3, fy - 70, 6, 70), "#8a5e3c", INK, 1.8);
    shape(c, p => { p.moveTo(lq - 26, fy - 76); p.lineTo(lq + 26, fy - 76); p.lineTo(lq + 34, fy - 104); p.lineTo(lq - 34, fy - 104); p.closePath(); }, "#a87a4e", INK, 2);
    shape(c, p => { p.moveTo(lq - 22, fy - 82); p.lineTo(lq - 1, fy - 80); p.lineTo(lq - 1, fy - 104); p.lineTo(lq - 24, fy - 102); p.closePath(); }, "#f7efd8", INK, 1.4);
    shape(c, p => { p.moveTo(lq - 1, fy - 80); p.lineTo(lq + 20, fy - 82); p.lineTo(lq + 22, fy - 102); p.lineTo(lq - 1, fy - 104); p.closePath(); }, "#fbf3dc", INK, 1.4);
    // a carved screen along the top, potted palms
    for (let x = 1220; x < 1750; x += 24) { c.strokeStyle = "rgba(155,116,40,0.55)"; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 52); c.lineTo(x + 12, 80); c.lineTo(x + 24, 52); c.stroke(); }
    pot(c, 1280, fy);
    pot(c, 1735, fy, true);
}

function pot(c, x, y, small) {
    const s = small ? 0.8 : 1;
    shape(c, p => { p.moveTo(x - 20 * s, y); p.lineTo(x - 24 * s, y - 34 * s); p.lineTo(x + 24 * s, y - 34 * s); p.lineTo(x + 20 * s, y); p.closePath(); }, TURQ, INK, 2.2);
    c.fillStyle = GOLD; c.fillRect(x - 24 * s, y - 38 * s, 48 * s, 6 * s);
    c.strokeStyle = "#2f7a52"; c.lineCap = "round";
    for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.42;
        c.lineWidth = 3.2;
        c.beginPath(); c.moveTo(x, y - 38 * s); c.quadraticCurveTo(x + Math.cos(a) * 30 * s, y - 38 * s + Math.sin(a) * 40 * s, x + Math.cos(a) * 54 * s, y - 38 * s + Math.sin(a) * 56 * s + 14 * s); c.stroke();
    }
}

// ----------------------------------------------- ground floor: library and desk

function drawBookRect(c, b, alpha) {
    c.save();
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.translate(b.x + b.w / 2, b.bottom);
    c.rotate(b.lean || 0);
    shape(c, p => p.rect(-b.w / 2, -b.h, b.w, b.h), b.col, INK, 1.8);
    c.fillStyle = "rgba(255,255,255,0.28)";
    c.fillRect(-b.w / 2 + 2, -b.h + 4, 2, b.h - 8);
    c.fillStyle = "rgba(240,205,120,0.9)";
    c.fillRect(-b.w / 2, -b.h + 8, b.w, 3);
    c.fillRect(-b.w / 2, -b.h * 0.42, b.w, 2);
    c.restore();
}

/** Draw the books currently sitting in their slots. `presence(i)` is 0..1 for each. */
export function drawSlotBooks(c, presence) {
    let i = 0;
    LIB_BOOKS.forEach(b => {
        if (!b.slot) return;
        const a = presence(i++);
        if (a > 0) drawBookRect(c, b, a);
    });
}

function drawBookcase(c, x0, x1) {
    const top = CASE_TOP, boards = [top, ...ROW_BOTTOMS];
    shape(c, p => p.rect(x0, top, x1 - x0, F2 - top), "#4a3426", INK, 2.6);
    ROW_BOTTOMS.forEach(bot => {
        const g = c.createLinearGradient(0, bot - 76, 0, bot);
        g.addColorStop(0, "#6a5240"); g.addColorStop(1, "#3a2a1e");
        c.fillStyle = g;
        c.fillRect(x0 + 6, bot - 76, x1 - x0 - 12, 76);
    });
    for (const b of LIB_BOOKS) {
        if (b.slot || b.x < x0 || b.x > x1) continue;
        drawBookRect(c, b);
    }
    const cab = ROW_BOTTOMS[2];
    shape(c, p => p.rect(x0 - 8, cab, x1 - x0 + 16, F2 - cab), "#5a4030", INK, 2.6);
    for (let x = x0 + 14; x < x1 - 40; x += 62) {
        shape(c, p => p.rect(x, cab + 12, 50, F2 - cab - 22), "#6a4a38", INK, 1.8);
        shape(c, p => p.arc(x + 25, cab + 28, 3.6, 0, TAU), GOLD, GOLD_D, 1.4);
    }
    boards.forEach((by, i) => {
        shape(c, p => p.rect(x0 - 6, by + (i ? 0 : -12), x1 - x0 + 12, 12), "#8a6038", INK, 2.2);
        c.fillStyle = "rgba(255,225,160,0.4)";
        c.fillRect(x0 - 6, by + (i ? 0 : -12), x1 - x0 + 12, 2);
    });
    shape(c, p => p.rect(x0 - 12, top - 14, 16, F2 - top + 14), "#8a6038", INK, 2.4);
    shape(c, p => p.rect(x1 - 4, top - 14, 16, F2 - top + 14), "#8a6038", INK, 2.4);
    scallops(c, x0 - 6, x1 + 6, top - 12, 11, GOLD);
}

function drawLibrary(c) {
    drawBookcase(c, CASES[0][0] - 10, CASES[0][1] + 10);
    drawBookcase(c, CASES[1][0] - 10, CASES[1][1] + 10);
    pot(c, 695, F2, true);
    pot(c, 818, F2, true);
}

function drawDesk(c) {
    const { x0, x1, top } = LAYOUT.desk;
    const ledgerX = x0 + 66;
    shape(c, p => p.rect(x0 + 10, top, 14, F2 - top), "#f1ecde", INK, 2.2);
    shape(c, p => p.rect(x1 - 24, top, 14, F2 - top), "#f1ecde", INK, 2.2);
    shape(c, p => p.rect(x0 + 24, top + 8, x1 - x0 - 48, 44), "#e6dfce", INK, 2.2);
    for (let i = 0; i < 2; i++) {
        const dx = x0 + 38 + i * ((x1 - x0 - 76) / 2);
        shape(c, p => p.rect(dx, top + 14, (x1 - x0 - 96) / 2, 32), "#f4f0e4", INK, 1.8);
        shape(c, p => p.arc(dx + (x1 - x0 - 96) / 4, top + 30, 4, 0, TAU), GOLD, GOLD_D, 1.4);
    }
    const g = c.createLinearGradient(0, top - 14, 0, top + 2);
    g.addColorStop(0, "#fffaf0"); g.addColorStop(1, "#d9d0bc");
    shape(c, p => p.rect(x0 - 8, top - 14, x1 - x0 + 16, 16), g, INK, 2.6);
    c.fillStyle = GOLD; c.fillRect(x0 - 8, top - 2, x1 - x0 + 16, 3);
    shape(c, p => p.rect(x0 - 50, F2 - 54, 60, 12), "#2b4a9c", INK, 2.2);                   // stool with a lapis cushion
    shape(c, p => p.rect(x0 - 44, F2 - 42, 8, 42), GOLD, GOLD_D, 1.8);
    shape(c, p => p.rect(x0 - 4, F2 - 42, 8, 42), GOLD, GOLD_D, 1.8);
    const ly = top - 14;                                                                     // the ledger
    shape(c, p => { p.moveTo(ledgerX - 52, ly); p.lineTo(ledgerX, ly + 2); p.lineTo(ledgerX, ly - 14); p.lineTo(ledgerX - 44, ly - 16); p.closePath(); }, "#f3ead0", INK, 2);
    shape(c, p => { p.moveTo(ledgerX, ly + 2); p.lineTo(ledgerX + 52, ly); p.lineTo(ledgerX + 44, ly - 16); p.lineTo(ledgerX, ly - 14); p.closePath(); }, "#f7efd8", INK, 2);
    shape(c, p => p.rect(ledgerX - 56, ly + 2, 112, 4), "#7a3a2c", INK, 1.6);
    shape(c, p => { p.moveTo(x0 + 8, ly); p.lineTo(x0 + 24, ly); p.lineTo(x0 + 21, ly - 15); p.lineTo(x0 + 11, ly - 15); p.closePath(); }, "#5ac0d6", INK, 2);
    c.fillStyle = "rgba(255,255,255,0.7)"; c.fillRect(x0 + 12, ly - 12, 2, 8);
    shape(c, p => p.ellipse(x0 + 184, ly - 3, 18, 6, 0, 0, TAU), "#bfe4ee", INK, 2);
    shape(c, p => { p.moveTo(x0 + 168, ly - 5); p.quadraticCurveTo(x0 + 184, ly - 25, x0 + 200, ly - 5); p.closePath(); }, "#ffffff", INK, 1.8);
    for (let i = 0; i < 3; i++) shape(c, p => p.ellipse(x0 + 268, ly - 5 - i * 9, 18, 5, 0, 0, TAU), "#f1e2b8", INK, 1.6);
    const [cx] = LAYOUT.candle;
    shape(c, p => p.ellipse(cx, ly - 1, 14, 4, 0, 0, TAU), GOLD, GOLD_D, 1.8);
    shape(c, p => p.rect(cx - 6, ly - 34, 12, 32), "#fff6dc", INK, 2);
    pot(c, 1680, F2);
}

function drawPanelFrame(c) {
    const { x0, x1, y0, y1 } = LAYOUT.panel;
    shape(c, p => p.rect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20), GOLD, GOLD_D, 2.6);
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "#fbf3dc"); g.addColorStop(1, "#efe1bd");
    shape(c, p => p.rect(x0, y0, x1 - x0, y1 - y0), g, INK, 2);
    for (const [px, py] of [[x0 - 10, y0 - 10], [x1 + 10, y0 - 10], [x0 - 10, y1 + 10], [x1 + 10, y1 + 10]]) shape(c, p => p.arc(px, py, 8, 0, TAU), "#fff2c0", GOLD_D, 2);
    c.strokeStyle = "rgba(120,90,50,0.22)"; c.lineWidth = 1;
    for (let y = y0 + 56; y < y1 - 6; y += 56) { c.beginPath(); c.moveTo(x0 + 118, y); c.lineTo(x1 - 8, y); c.stroke(); }
    c.beginPath(); c.moveTo(x0 + 112, y0 + 8); c.lineTo(x0 + 112, y1 - 8); c.stroke();
}

// ----------------------------------------------------------- the basement

function hangLamp(c, x, y, top) {
    c.strokeStyle = GOLD_D; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(x, top); c.lineTo(x, y - 14); c.stroke();
    shape(c, p => { p.moveTo(x - 8, y - 14); p.lineTo(x + 8, y - 14); p.lineTo(x + 13, y + 14); p.lineTo(x - 13, y + 14); p.closePath(); }, "#fff2c8", GOLD_D, 2);
    shape(c, p => p.rect(x - 10, y + 14, 20, 5), GOLD, GOLD_D, 1.4);
}

function saltCluster(c, x, y, s) {
    const r = rng(Math.floor(x));
    for (let i = 0; i < 7; i++) {
        const bx = x + (i - 3) * 14 * s, h = (30 + r() * 46) * s, w = (9 + r() * 7) * s, tilt = (r() - 0.5) * 0.4;
        c.save(); c.translate(bx, y); c.rotate(tilt);
        const g = c.createLinearGradient(-w, 0, w, 0);
        g.addColorStop(0, "#c8dcf0"); g.addColorStop(0.5, "#ffffff"); g.addColorStop(1, "#a8c4e0");
        shape(c, p => { p.moveTo(-w, 0); p.lineTo(-w * 0.7, -h * 0.82); p.lineTo(0, -h); p.lineTo(w * 0.7, -h * 0.82); p.lineTo(w, 0); p.closePath(); }, g, INK, 1.6);
        c.restore();
    }
}

function drawBasementDecor(c) {
    // the store: barrels, jars on a shelf, clusters of salt
    for (const [bx, bw] of [[470, 52], [540, 48], [940, 52]]) {
        const bh = 84;
        shape(c, p => { p.moveTo(bx, F1); p.quadraticCurveTo(bx - 7, F1 - bh / 2, bx + 2, F1 - bh); p.lineTo(bx + bw - 2, F1 - bh); p.quadraticCurveTo(bx + bw + 7, F1 - bh / 2, bx + bw, F1); p.closePath(); }, "#b88a58", INK, 2.6);
        for (const f of [0.22, 0.78]) shape(c, p => p.rect(bx - 3, F1 - bh * f - 4, bw + 6, 7), "#b9693c", INK, 1.8);
    }
    shape(c, p => p.rect(640, F1 - 190, 220, 10), "#a87a4e", INK, 2.2);
    for (let i = 0; i < 6; i++) shape(c, p => { p.moveTo(650 + i * 34, F1 - 190); p.lineTo(678 + i * 34, F1 - 190); p.lineTo(674 + i * 34, F1 - 226); p.lineTo(654 + i * 34, F1 - 226); p.closePath(); }, ["#c75a3a", "#e8d6a8", "#2fa8a8"][i % 3], INK, 1.8);
    saltCluster(c, 590, F1, 1.1);
    saltCluster(c, 1040, F1, 0.9);
    // the sack of salt by the ore
    const sx = LAYOUT.ore.x + 110;
    shape(c, p => { p.moveTo(sx - 24, F1); p.quadraticCurveTo(sx - 38, F1 - 36, sx - 18, F1 - 52); p.quadraticCurveTo(sx, F1 - 62, sx + 18, F1 - 50); p.quadraticCurveTo(sx + 36, F1 - 34, sx + 22, F1); p.closePath(); }, "#ece9de", INK, 2.6);
    shape(c, p => p.ellipse(sx, F1 - 52, 14, 5, 0, 0, TAU), "#ffffff", INK, 1.6);
    // a stairwell-less niche: an arch painted on the wall
    for (const ax of [560, 800]) shape(c, p => gothic(c, ax - 44, F1 - 250, 88, 200), "rgba(255,255,255,0.18)", GOLD_D, 2.4);
    for (const [lx, ly] of LAYOUT.lamps) {
        if (ly > 750 && ly < 900) hangLamp(c, lx, ly, F2 + SLAB_T);
    }
}

function drawOrePile(c) {
    const r = rng(81);
    const { x } = LAYOUT.ore;
    for (let i = 0; i < 26; i++) {
        const px = x - 48 + r() * 96, py = F1 - 4 - r() * 34 * (1 - Math.abs(px - x) / 70);
        const rad = 9 + r() * 12;
        shape(c, p => {
            for (let k = 0; k < 7; k++) {
                const a = (k / 7) * TAU, rr = rad * (0.75 + r() * 0.35);
                k ? p.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.8) : p.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.8);
            }
            p.closePath();
        }, ["#7a5a48", "#8a6650", "#5a4a44", "#9a6e50"][Math.floor(r() * 4)], INK, 2);
        c.fillStyle = "rgba(255,220,180,0.35)";
        c.fillRect(px - rad * 0.3, py - rad * 0.5, 4, 2);
    }
}

function drawRack(c) {
    const { x0, x1, rows } = LAYOUT.rack;
    shape(c, p => p.rect(x0, rows[0] - 34, x1 - x0, rows[3] - rows[0] + 62), "#e9e0cb", INK, 2.4);
    shape(c, p => p.rect(x0 + 6, rows[0] - 28, x1 - x0 - 12, rows[3] - rows[0] + 50), "#6a4a34", INK, 1.8);
    rows.forEach(ry => {
        for (const px of [x0 + 20, x1 - 30]) {
            shape(c, p => p.rect(px - 4, ry + 6, 9, 14), GOLD, GOLD_D, 1.6);
            shape(c, p => p.rect(px - 9, ry + 5, 22, 6), GOLD, GOLD_D, 1.6);
        }
    });
}

// ------------------------------------------------------------------ forge

const SAND = ["#cfae82", "#c6a276", "#d6b78e", "#bf9b70", "#cba97d"];

function drawFurnace(c) {
    const { x0, x1, mouthX, mouthY0, mouthY1, hoodTop } = LAYOUT.furnace;
    const chimTop = F2 - 470;                                              // the chimney is a stone tower standing in the terrace garden
    c.save();
    c.beginPath(); c.rect(mouthX - 50, chimTop, 100, hoodTop + 30 - chimTop); c.clip();
    blocks(c, mouthX - 50, chimTop, mouthX + 50, hoodTop + 30, 38, SAND, 71, "#7a5a3c");
    const cs = c.createLinearGradient(mouthX - 50, 0, mouthX + 50, 0);
    cs.addColorStop(0, "rgba(50,28,20,0.3)"); cs.addColorStop(0.5, "rgba(255,240,200,0.08)"); cs.addColorStop(1, "rgba(50,28,20,0.36)");
    c.fillStyle = cs; c.fillRect(mouthX - 50, chimTop, 100, hoodTop + 30 - chimTop);
    c.restore();
    shape(c, p => p.rect(mouthX - 50, chimTop, 100, hoodTop + 30 - chimTop), null, INK, 3.4);
    shape(c, p => p.rect(mouthX - 62, chimTop - 14, 124, 18), "#b9693c", INK, 2.6);
    shape(c, p => p.rect(mouthX - 56, F2 - 150, 112, 12), "#b9693c", INK, 2.2);
    c.save();                                                              // body with a tapering hood
    c.beginPath();
    c.moveTo(x0, F1); c.lineTo(x0, F1 - 190); c.lineTo(mouthX - 45, hoodTop); c.lineTo(mouthX + 45, hoodTop); c.lineTo(x1, F1 - 190); c.lineTo(x1, F1); c.closePath();
    c.clip();
    blocks(c, x0, hoodTop, x1, F1, 40, SAND, 72, "#7a5a3c");
    const soot = c.createLinearGradient(0, hoodTop, 0, hoodTop + 220);
    soot.addColorStop(0, "rgba(40,24,16,0.45)"); soot.addColorStop(1, "rgba(40,24,16,0)");
    c.fillStyle = soot; c.fillRect(x0, hoodTop, x1 - x0, 220);
    c.restore();
    shape(c, p => { p.moveTo(x0, F1); p.lineTo(x0, F1 - 190); p.lineTo(mouthX - 45, hoodTop); p.lineTo(mouthX + 45, hoodTop); p.lineTo(x1, F1 - 190); p.lineTo(x1, F1); p.closePath(); }, null, INK, 3.4);
    for (const [by, inset] of [[F1 - 262, 36], [F1 - 160, 0]]) {            // copper bands
        shape(c, p => p.rect(x0 + inset, by, x1 - x0 - inset * 2, 12), "#b9693c", INK, 2.2);
        c.fillStyle = "rgba(255,230,190,0.4)"; c.fillRect(x0 + inset, by, x1 - x0 - inset * 2, 3);
    }
    const mw = 52;                                                         // the mouth
    const arch = p => {
        p.moveTo(mouthX - mw, mouthY1);
        p.lineTo(mouthX - mw, mouthY0 + 40);
        p.quadraticCurveTo(mouthX - mw, mouthY0 - 8, mouthX, mouthY0 - 8);
        p.quadraticCurveTo(mouthX + mw, mouthY0 - 8, mouthX + mw, mouthY0 + 40);
        p.lineTo(mouthX + mw, mouthY1);
        p.closePath();
    };
    shape(c, arch, "#150c08", INK, 4.5);
    c.save(); c.beginPath(); arch(c); c.clip();
    const inner = c.createRadialGradient(mouthX, mouthY1, 4, mouthX, mouthY1, 120);
    inner.addColorStop(0, "#5a2410"); inner.addColorStop(1, "#150c08");
    c.fillStyle = inner; c.fillRect(mouthX - mw, mouthY0 - 10, mw * 2, mouthY1 - mouthY0 + 10);
    c.restore();
    c.strokeStyle = "#7a5a3c"; c.lineWidth = 2.6;
    for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        c.beginPath();
        c.moveTo(mouthX + Math.cos(a) * mw, mouthY0 + 40 + Math.sin(a) * (mw + 32) * 0.8);
        c.lineTo(mouthX + Math.cos(a) * (mw + 26), mouthY0 + 40 + Math.sin(a) * (mw + 56) * 0.8);
        c.stroke();
    }
    shape(c, p => p.rect(mouthX - 82, mouthY1, 164, F1 - mouthY1), "#b9966f", INK, 3);
    c.fillStyle = "rgba(255,255,255,0.2)"; c.fillRect(mouthX - 82, mouthY1, 164, 3);
    for (let i = 0; i < 12; i++) {                                         // coal at the base
        const r = rng(i + 90);
        shape(c, p => p.ellipse(x0 - 36 + r() * 28, F1 - 8 - r() * 9, 8 + r() * 6, 5 + r() * 3, 0, 0, TAU), "#2a2422", INK, 1.6);
    }
    for (const [bx, bw] of [[x1 - 40, 52], [x1 + 26, 44]]) {               // barrels by the furnace
        const bh = bw === 52 ? 86 : 62;
        shape(c, p => { p.moveTo(bx, F1); p.quadraticCurveTo(bx - 7, F1 - bh / 2, bx + 2, F1 - bh); p.lineTo(bx + bw - 2, F1 - bh); p.quadraticCurveTo(bx + bw + 7, F1 - bh / 2, bx + bw, F1); p.closePath(); }, "#a87a4e", INK, 2.6);
        for (const f of [0.22, 0.78]) shape(c, p => p.rect(bx - 3, F1 - bh * f - 4, bw + 6, 7), "#b9693c", INK, 1.8);
    }
}

function drawAnvil(c) {
    const { x, top } = LAYOUT.anvil;
    shape(c, p => p.rect(x - 32, top + 32, 64, F1 - top - 32), "#8a5e3c", INK, 2.6);
    c.strokeStyle = "rgba(60,30,10,0.35)"; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x - 28 + i * 18, top + 40); c.lineTo(x - 26 + i * 18, F1 - 4); c.stroke(); }
    shape(c, p => p.rect(x - 30, top + 30, 60, 6), "#4a5058", INK, 2);
    shape(c, p => {
        p.moveTo(x - 38, top); p.lineTo(x + 38, top); p.lineTo(x + 78, top + 10); p.lineTo(x + 38, top + 18);
        p.lineTo(x + 22, top + 24); p.lineTo(x + 22, top + 30); p.lineTo(x + 36, top + 34); p.lineTo(x - 36, top + 34);
        p.lineTo(x - 22, top + 30); p.lineTo(x - 22, top + 24); p.lineTo(x - 36, top + 16); p.closePath();
    }, "#6e7a88", INK, 2.8);
    shape(c, p => p.rect(x - 38, top, 76, 5), "#c4d0dc", null);
    // the tool wall above it
    shape(c, p => p.rect(x - 90, F1 - 263, 100, 12), "#8a5e3c", INK, 2.4);
    for (let i = 0; i < 3; i++) {
        const px = x - 74 + i * 36;
        c.strokeStyle = INK; c.lineWidth = 7;
        c.beginPath(); c.moveTo(px, F1 - 251); c.lineTo(px + 4, F1 - 177); c.stroke();
        c.strokeStyle = i === 1 ? "#a87a4e" : "#8a96a4"; c.lineWidth = 3.4;
        c.beginPath(); c.moveTo(px, F1 - 251); c.lineTo(px + 4, F1 - 177); c.stroke();
    }
    shape(c, p => p.rect(x - 88, F1 - 183, 24, 14), "#7a8694", INK, 2);
}

function drawTroughAndWheelFrames(c) {
    const { x0, x1, rim } = LAYOUT.trough;
    shape(c, p => p.rect(x0, rim - 2, x1 - x0, F1 - rim + 2), "#c6a276", INK, 2.8);
    c.fillStyle = "#143a4a"; c.fillRect(x0 + 6, rim, x1 - x0 - 12, 24);
    for (const bx of [x0 + 10, x1 - 22]) shape(c, p => p.rect(bx, rim - 2, 12, F1 - rim + 2), "#b9693c", INK, 2);
    shape(c, p => p.rect(x0 - 5, rim - 6, x1 - x0 + 10, 8), "#d6b78e", INK, 2.4);
    const { x, y } = LAYOUT.wheel;
    shape(c, p => p.rect(x - 50, F1 - 36, 100, 36), "#8a5e3c", INK, 2.8);
    shape(c, p => p.rect(x - 44, y + 20, 10, F1 - 36 - y - 20), "#a87a4e", INK, 2.4);
    shape(c, p => p.rect(x + 34, y + 20, 10, F1 - 36 - y - 20), "#a87a4e", INK, 2.4);
}

// ---------------------------------------------------------------- bakeStatic

export function bakeStatic() {
    const cv = offscreen(W, BH);
    const c = cv.getContext("2d");
    c.translate(0, -BY0);                  // so negative world y is addressable

    drawIslandBase(c);
    drawInterior(c);
    drawCavityEdges(c);
    drawBasementFloor(c);
    drawRoof(c);
    LAYOUT.windows.forEach(w => drawWindowFrame(c, w));
    drawOuterWalls(c);
    drawColumn(c, 1746, -20, F2 + SLAB_T, 50);
    drawCeiling(c);
    drawSlab(c, F3, SLAB_F3);
    drawSlab(c, F2, SLAB_F2);
    drawShaft(c);
    drawTerrace(c);
    drawGarden(c);
    drawPrayerHall(c);
    drawLibrary(c);
    drawDesk(c);
    drawPanelFrame(c);
    [[620, 430], [960, 430], [1400, 430], [1680, 430]].forEach(([x, y]) => hangLamp(c, x, y, F3 + SLAB_T));
    [[1300, 120], [1620, 120]].forEach(([x, y]) => hangLamp(c, x, y, 46));
    drawBasementDecor(c);
    drawOrePile(c);
    drawRack(c);
    drawFurnace(c);
    drawAnvil(c);
    drawTroughAndWheelFrames(c);
    return { canvas: cv, x: 0, y: BY0, w: W, h: BH };
}

/** Glass over the river, in the basement floor's panes: drawn after the river. */
export function drawPanes(c, t) {
    for (const [a, b] of LAYOUT.panes) {
        const g = c.createLinearGradient(0, F1, 0, F1 + FLOOR_T);
        g.addColorStop(0, "rgba(255,255,255,0.5)"); g.addColorStop(1, "rgba(160,225,240,0.18)");
        c.fillStyle = g; c.fillRect(a + 2, F1 + 2, b - a - 4, FLOOR_T - 4);
        c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 2;
        const o = (t * 20) % 60;
        for (let x = a - 40 + o; x < b; x += 60) { c.beginPath(); c.moveTo(Math.max(a + 2, x), F1 + FLOOR_T - 3); c.lineTo(Math.min(b - 2, x + 40), F1 + 3); c.stroke(); }
    }
}

/** The outdoor pool at the cliff's edge: the water behind the rim. */
export function drawPool(c, t) {
    const { x0, x1, surface, floor } = LAYOUT.pool;
    c.save();
    c.beginPath(); c.rect(x0, surface - 4, x1 - x0, floor - surface + 4); c.clip();
    const g = c.createLinearGradient(0, surface, 0, floor);
    g.addColorStop(0, "#9aeaea"); g.addColorStop(0.5, "#3fb4c6"); g.addColorStop(1, "#14587c");
    c.fillStyle = g; c.fillRect(x0, surface - 4, x1 - x0, floor - surface + 4);
    const wp = tilePattern(c, "river", 1.4, t * 30, surface);
    if (wp) { c.globalAlpha = 0.6; c.fillStyle = wp; c.fillRect(x0, surface, x1 - x0, floor - surface); c.globalAlpha = 1; }
    c.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 9; i++) {
        const bx = x0 + ((i * 53 + 20) % (x1 - x0)), by = floor - ((t * (12 + (i % 4) * 5) + i * 31) % (floor - surface));
        c.beginPath(); c.arc(bx + Math.sin(t + i) * 4, by, 1.6 + (i % 3), 0, TAU); c.fill();
    }
    c.restore();
}

/** In front of a swimmer: the water's surface, and a translucent body over whatever is under it. */
export function drawPoolFront(c, t, agitation) {
    const { x0, x1, surface, floor } = LAYOUT.pool;
    const amp = 1.6 + agitation * 4;
    c.save();
    c.beginPath(); c.rect(x0, surface - 6, x1 - x0, floor - surface + 6); c.clip();
    c.beginPath();
    c.moveTo(x0, floor);
    for (let x = x0; x <= x1; x += 4) c.lineTo(x, surface + Math.sin(x * 0.12 + t * 3) * amp);
    c.lineTo(x1, floor); c.closePath();
    c.fillStyle = "rgba(90,200,220,0.34)"; c.fill();
    c.strokeStyle = "rgba(255,255,255,0.75)"; c.lineWidth = 2.2;
    c.beginPath();
    for (let x = x0; x <= x1; x += 4) { const y = surface + Math.sin(x * 0.12 + t * 3) * amp; x === x0 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.stroke();
    c.restore();
}

/** The pool spills over the cliff beside the boulder. */
export function drawPoolFall(c, t) {
    const x = LAYOUT.pool.x1 + 12, top = LAYOUT.pool.surface, bot = 1900;
    c.save();
    const g = c.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, "rgba(170,230,238,0.95)"); g.addColorStop(1, "rgba(235,250,252,0.7)");
    c.fillStyle = g; c.fillRect(x, top, 20, bot - top);
    c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) {
        const o = (t * 160 + i * 70) % 240;
        c.beginPath(); c.moveTo(x + 4 + i * 6, top + o * 5); c.lineTo(x + 5 + i * 6, top + o * 5 + 50); c.stroke();
    }
    c.restore();
}

// ------------------------------------------------------- the world behind it

export const ridgeFar = x => 606 + Math.sin(x * 0.006) * 16 + Math.sin(x * 0.019 + 1) * 6;
export const ridgeNear = x => 664 + Math.sin(x * 0.005 + 1) * 14 + Math.sin(x * 0.021) * 5;
const BACKDROP_Y0 = 240;

/** Distant mountains, a far city and two rows of hills, in golden haze. */
/** Three little floating islands, each with a pale palace, for the sky. */
const ISLANDS = [
    { v: 0, x: 150, y: -60, s: 0.9, ph: 0.2, sp: 0.5 },
    { v: 1, x: 2800, y: -140, s: 1.0, ph: 1.9, sp: 0.4 },
    { v: 2, x: 780, y: -320, s: 0.55, ph: 3.1, sp: 0.6 },
    { v: 0, x: 2150, y: -360, s: 0.5, ph: 4.4, sp: 0.5 },
    { v: 1, x: 1500, y: -440, s: 0.4, ph: 5.2, sp: 0.45 }
];

const CLOUDS = (() => {
    const r = rng(23);
    return Array.from({ length: 14 }, () => ({ x: r() * W, y: -500 + r() * 800, s: 0.6 + r() * 1.1, v: 4 + r() * 8 }));
})();

// ---------- the armies of the far hills

const PATTERNS = (() => {
    const r = rng(88);
    const mk = len => {
        const items = [];
        let x = 20;
        while (x < len - 40) {
            const kind = r() < 0.12 ? "rider" : r() < 0.2 ? "banner" : "foot";
            items.push({ dx: x, kind, hue: Math.floor(r() * 3), ph: r() * 6 });
            x += kind === "rider" ? 48 : 22 + r() * 8;
        }
        return items;
    };
    return [mk(520), mk(520), mk(520)];
})();
const PERIOD = 520;

function drawSoldier(c, x, y, sc, t, it, tint, far) {
    const bob = Math.abs(Math.sin(t * (far ? 5 : 6) + it.ph)) * 2.2 * sc;
    const col = [tint[0], tint[1], tint[2]][it.hue];
    c.save();
    c.translate(x, y - bob);
    c.scale(sc, sc);
    if (it.kind === "rider") {
        const g = Math.sin(t * 9 + it.ph) * 4;
        c.fillStyle = "#6a5240";
        c.beginPath(); c.ellipse(0, -22, 22, 9, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(16, -26); c.lineTo(26, -42); c.lineTo(32, -38); c.lineTo(22, -22); c.fill();
        c.strokeStyle = "#5a4232"; c.lineWidth = 3;
        for (const [lx, d] of [[-14, g], [-6, -g], [8, g], [16, -g]]) { c.beginPath(); c.moveTo(lx, -16); c.lineTo(lx + d, 0); c.stroke(); }
        c.fillStyle = col; c.fillRect(-5, -52, 10, 28);
        c.fillStyle = "#c58e63"; c.beginPath(); c.arc(0, -58, 5, 0, TAU); c.fill();
        c.fillStyle = "#f3eee0"; c.beginPath(); c.ellipse(0, -62, 6, 3.4, 0, 0, TAU); c.fill();
        c.strokeStyle = "#4a3522"; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(8, -34); c.lineTo(14, -90); c.stroke();
    } else {
        c.fillStyle = col; c.fillRect(-5, -30, 10, 26);
        c.fillStyle = "#4a3a30"; c.fillRect(-4, -6, 3, 6); c.fillRect(1 + Math.sin(t * 6 + it.ph) * 1.5, -6, 3, 6);
        c.fillStyle = "#c58e63"; c.beginPath(); c.arc(0, -36, 5, 0, TAU); c.fill();
        c.fillStyle = "#e8e0c8"; c.beginPath(); c.ellipse(0, -40, 6, 3.4, 0, 0, TAU); c.fill();
        c.strokeStyle = "#4a3522"; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(7, -2); c.lineTo(9, -66); c.stroke();
        c.fillStyle = "#b8c4cc"; c.beginPath(); c.moveTo(7, -66); c.lineTo(11, -66); c.lineTo(9, -76); c.fill();
        if (it.kind === "banner") {
            c.strokeStyle = "#4a3522"; c.lineWidth = 1.8;
            c.beginPath(); c.moveTo(-8, -2); c.lineTo(-8, -84); c.stroke();
            const wv = Math.sin(t * 5 + it.ph) * 3;
            c.fillStyle = it.hue === 0 ? "#8a2f2a" : it.hue === 1 ? "#1f6a60" : "#b8903a";
            c.beginPath(); c.moveTo(-8, -84); c.quadraticCurveTo(-22, -80 + wv, -34, -82); c.lineTo(-30, -66 + wv); c.quadraticCurveTo(-20, -68, -8, -66); c.closePath(); c.fill();
        } else {
            c.fillStyle = it.hue === 1 ? "#d9ab4c" : "#9b7428";
            c.beginPath(); c.arc(-7, -20, 7, 0, TAU); c.fill();
        }
    }
    c.restore();
}

function drawArmies(c, t, x0, x1) {
    const bands = [
        { ridge: ridgeFar, sc: 0.42, speed: 24, tint: ["#8a8aa8", "#7aa0a0", "#b09a70"], far: true, off: 2 },
        { ridge: ridgeNear, sc: 0.74, speed: 36, tint: ["#a0485a", "#2f8a8c", "#c89a40"], far: false, off: 6 }
    ];
    bands.forEach((b, bi) => {
        const shift = (t * b.speed) % PERIOD;
        const k0 = Math.floor((x0 - 120 - shift) / PERIOD), k1 = Math.floor((x1 + 120 - shift) / PERIOD);
        for (let k = k0; k <= k1; k++) {
            const pat = PATTERNS[((k % 3) + 3 + bi) % 3];
            for (const it of pat) {
                const x = k * PERIOD + shift + it.dx;
                if (x < x0 - 60 || x > x1 + 60) continue;
                drawSoldier(c, x, b.ridge(x) + b.off, b.sc, t, it, b.tint, b.far);
            }
        }
        // a drift of dust where they walk
        c.fillStyle = bi ? "rgba(236,214,160,0.14)" : "rgba(236,214,160,0.1)";
        c.fillRect(x0, b.ridge((x0 + x1) / 2) - 8, x1 - x0, 14);
    });
}

function drawBirds(c, t, x0, x1) {
    c.strokeStyle = "rgba(90,70,110,0.75)"; c.lineWidth = 2; c.lineCap = "round";
    for (let f = 0; f < 5; f++) {
        const bx = ((t * (46 + f * 6) + f * 760) % (W + 600)) - 300, by = 40 + f * 70 + Math.sin(t * 0.3 + f) * 14;
        if (bx < x0 - 200 || bx > x1 + 200) continue;
        for (let i = 0; i < 7; i++) {
            const off = Math.abs(i - 3), px = bx - off * 20, py = by + off * 12 + (i % 2) * 3;
            const w = Math.sin(t * 7 + i * 0.6 + f) * 6;
            c.beginPath(); c.moveTo(px - 9, py + w); c.quadraticCurveTo(px - 4, py - 4, px, py); c.quadraticCurveTo(px + 4, py - 4, px + 9, py + w); c.stroke();
        }
    }
}

const PLATE_K = 1.55, PLATE_BOTTOM = 800;
const HILL_TREES = (() => {
    const r = rng(404);
    return Array.from({ length: 70 }, (_, i) => ({ x: 30 + i * 46 + r() * 30, k: r() < 0.5 ? "palms" : "pomA", h: 54 + r() * 40, flip: r() < 0.5, far: r() < 0.45 }));
})();

function drawHills(c, x0, x1) {
    const gp = tilePattern(c, "grass", 1.2, 0, 560);
    const band = (ridge, haze) => {
        c.beginPath(); c.moveTo(x0 - 12, 790);
        for (let x = x0 - 12; x <= x1 + 24; x += 24) c.lineTo(x, ridge(x));
        c.lineTo(x1 + 24, 790); c.closePath();
        c.fillStyle = gp || "#a8b070"; c.fill();
        c.fillStyle = haze; c.fill();
        c.strokeStyle = "rgba(58,44,64,0.4)"; c.lineWidth = 2.6;
        c.beginPath();
        for (let x = x0 - 12; x <= x1 + 24; x += 24) { const y = ridge(x); x === x0 - 12 ? c.moveTo(x, y) : c.lineTo(x, y); }
        c.stroke();
    };
    band(ridgeFar, "rgba(248,226,168,0.5)");
    for (const t of HILL_TREES) {                                             // a far row of trees on the ridge
        if (!t.far || t.x < x0 - 80 || t.x > x1 + 80) continue;
        treeSprite(c, t.k, t.x, ridgeFar(t.x) + 6, t.h * 0.7, t.flip, 0.8);
    }
    band(ridgeNear, "rgba(248,226,168,0.16)");
    for (const t of HILL_TREES) {
        if (t.far || t.x < x0 - 80 || t.x > x1 + 80) continue;
        treeSprite(c, t.k, t.x, ridgeNear(t.x) + 8, t.h * 1.1, t.flip, 1);
    }
}

function drawValley(c, camX, camY, x0, x1, y1) {
    const v = ART.valley;
    const py = (camY - 640) * 0.12, px = (camX - W / 2) * 0.12;
    const top = 1690 + py;
    c.fillStyle = "#f1d795";
    c.fillRect(x0 - 10, PLATE_BOTTOM, x1 - x0 + 20, top - PLATE_BOTTOM + 2);
    if (!v) { c.fillStyle = "#3f7a48"; c.fillRect(x0 - 10, top, x1 - x0 + 20, y1 - top + 10); return; }
    const k = 2.7, vw = iw(v) * k, vh = ih(v) * k;
    const i0 = Math.floor((x0 - px) / vw), i1 = Math.floor((x1 - px) / vw);
    for (let i = i0; i <= i1; i++) {
        const x = px + i * vw;
        if (i & 1) { c.save(); c.translate(x + vw, top); c.scale(-1, 1); c.drawImage(v, 0, 0, vw, vh); c.restore(); }
        else c.drawImage(v, x, top, vw, vh);
    }
    c.fillStyle = "#1f4a34"; c.fillRect(x0 - 10, top + vh - 2, x1 - x0 + 20, Math.max(0, y1 - top - vh + 12));
    const hz = c.createLinearGradient(0, top - 2, 0, top + 260);
    hz.addColorStop(0, "#f1d795"); hz.addColorStop(1, "rgba(241,215,149,0)");
    c.fillStyle = hz; c.fillRect(x0 - 10, top - 2, x1 - x0 + 20, 262);
}

/** The world behind the palace: the painted sky and far city (slid slowly for parallax), hills, armies, birds, the valley. */
export function drawBackground(c, t, x0, x1, y0, y1, camX, camY) {
    const plate = ART.plate;
    const px = (camX - W / 2) * 0.5, py = (camY - 640) * 0.3;
    const pw = plate ? iw(plate) * PLATE_K : 1290, ph = plate ? ih(plate) * PLATE_K : 868;
    const top = PLATE_BOTTOM - ph + py;
    const g = c.createLinearGradient(0, top - 1000, 0, top + 30);
    g.addColorStop(0, "#d08a2a"); g.addColorStop(1, "#e0b363");
    c.fillStyle = g;
    c.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, Math.max(0, top + 30 - y0 + 10));
    c.fillStyle = "#f1d795";
    c.fillRect(x0 - 10, top + ph - 6, x1 - x0 + 20, Math.max(0, y1 - (top + ph) + 16));
    if (plate) {
        const i0 = Math.floor((x0 - px) / pw), i1 = Math.floor((x1 - px) / pw);
        for (let i = i0; i <= i1; i++) {
            const x = px + i * pw;
            if (i & 1) { c.save(); c.translate(x + pw, top); c.scale(-1, 1); c.drawImage(plate, 0, 0, pw, ph); c.restore(); }
            else c.drawImage(plate, x, top, pw, ph);
        }
    }
    drawValley(c, camX, camY, x0, x1, y1);
    drawHills(c, x0, x1);
    drawBirds(c, t, x0, x1);
    drawArmies(c, t, x0, x1);
}

// -------- live things on the island

export function drawAnts(c, t) {
    const n = 11, speed = 24;
    const { segs, total } = ANT_PATH;
    for (let i = 0; i < n; i++) {
        let d = (t * speed + (i * total) / n) % total;
        let s = segs[0];
        for (const sg of segs) { if (d >= sg.start && d < sg.start + sg.len) { s = sg; break; } }
        const u = clamp((d - s.start) / s.len, 0, 1);
        if (s.a[2] === "h" || s.b[2] === "h") {
            if (s.a[2] === "h" && s.b[2] === "h") continue;
            if (u > 0.5 && s.b[2] === "h") continue;
            if (u < 0.5 && s.a[2] === "h") continue;
        }
        const x = lerp(s.a[0], s.b[0], u), y = lerp(s.a[1], s.b[1], u);
        const ang = Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]);
        const carry = s.a[2] === "c" && s.b[2] === "c";
        c.save();
        c.translate(x, y); c.rotate(ang);
        c.fillStyle = "#2a1c16"; c.strokeStyle = "#2a1c16"; c.lineWidth = 1.5; c.lineCap = "round";
        for (let k = -1; k <= 1; k++) {                                 // legs
            const w = Math.sin(t * 22 + i * 2 + k * 2) * 3.2;
            c.beginPath(); c.moveTo(k * 4, 0); c.lineTo(k * 4 + w, -8); c.moveTo(k * 4, 0); c.lineTo(k * 4 - w, 8); c.stroke();
        }
        c.beginPath(); c.ellipse(-8, 0, 6.4, 4.4, 0, 0, TAU); c.fill();            // abdomen
        c.beginPath(); c.ellipse(0, 0, 4.6, 3.2, 0, 0, TAU); c.fill();             // thorax
        c.beginPath(); c.arc(7, 0, 3.6, 0, TAU); c.fill();                         // head
        c.beginPath(); c.moveTo(9, -1); c.lineTo(15, -6); c.moveTo(9, 1); c.lineTo(15, 6); c.stroke();    // antennae
        c.fillStyle = "rgba(255,220,180,0.5)"; c.fillRect(-9, -3, 4, 1.6);
        if (carry) {
            c.save(); c.translate(12, -2); c.rotate(-ang);
            c.fillStyle = "#58a050"; c.strokeStyle = "#2f6a38"; c.lineWidth = 1;
            c.beginPath(); c.ellipse(0, -6, 7, 4, 0.5, 0, TAU); c.fill(); c.stroke();
            c.restore();
        }
        c.restore();
    }
}

/** Two men who come up the ladder and over the garden wall, then wander the garden for a while. */
export function drawWaterfall(c, t) {
    // the river's spill over the cliff, and its mist where it lands in the valley
    const sx = rightEdgeAt(1180) + 6, top = 1180, bot = 1900, w = 46;
    const sheet = () => {
        c.beginPath();
        c.moveTo(sx - 10, top); c.quadraticCurveTo(sx + 30, top + 6, sx + 38, top + 70); c.lineTo(sx + 38 + w * 0.7, bot); c.lineTo(sx + 38 - w * 0.3, bot);
        c.lineTo(sx + 38 - w, top + 120); c.quadraticCurveTo(sx + 10, top + 40, sx - 10, top + 40); c.closePath();
    };
    c.save();
    sheet();
    const g = c.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, "rgba(170,225,235,0.96)"); g.addColorStop(1, "rgba(235,250,252,0.86)");
    c.fillStyle = g; c.fill();
    c.clip();
    const wf = ART.waterfall;
    if (wf) {                                                                // the painted fall, streaming downward
        const sc = 2.0, tw = iw(wf) * sc, th = ih(wf) * sc;
        const off = (t * 150) % th;
        c.globalAlpha = 0.9;
        for (let y = top - th + off; y < bot; y += th) c.drawImage(wf, sx + 38 - tw * 0.46, y, tw, th + 1);
        c.globalAlpha = 1;
    }
    c.strokeStyle = "rgba(255,255,255,0.65)"; c.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
        const k = i / 8, xx = lerp(sx + 38 - w + 6, sx + 38 + w * 0.6, k);
        const o = (t * 140 + i * 90) % 220;
        c.beginPath(); c.moveTo(xx, top + 120 + o * 3.2); c.lineTo(xx + 2, top + 150 + o * 3.2 + 40); c.stroke();
    }
    c.restore();
    sheet(); c.strokeStyle = "rgba(60,90,100,0.55)"; c.lineWidth = 2.4; c.stroke();
    for (let i = 0; i < 6; i++) {                                           // mist
        const mx = sx + 52 + Math.sin(t * 0.6 + i) * 24, my = bot - 10 - ((t * 20 + i * 30) % 90);
        const mg = c.createRadialGradient(mx, my, 0, mx, my, 70);
        mg.addColorStop(0, "rgba(255,255,255,0.4)"); mg.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = mg; c.fillRect(mx - 70, my - 70, 140, 140);
    }
}

export function drawRiver(c, t, x0, x1) {
    const top = RIVER_TOP, bot = RIVER_BOT;
    x0 = Math.max(BLD.x0, x0); x1 = Math.min(3040, x1);
    if (x1 <= x0) return;
    c.save();
    c.beginPath(); c.moveTo(x0, top); c.lineTo(Math.min(x1, rightEdgeAt(top)), top); c.lineTo(Math.min(x1, rightEdgeAt(bot)), bot); c.lineTo(x0, bot); c.closePath(); c.clip();
    const g = c.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, "#a8ece8");
    g.addColorStop(0.4, "#3fb4c6");
    g.addColorStop(1, "#12507a");
    c.fillStyle = g;
    c.fillRect(x0, top, x1 - x0, bot - top);
    const wp = tilePattern(c, "river", 1.9, t * 46, top);                    // the painted river, sliding along
    if (wp) { c.globalAlpha = 0.62; c.fillStyle = wp; c.fillRect(x0, top, x1 - x0, bot - top); c.globalAlpha = 1; }
    c.globalCompositeOperation = "lighter";                                  // light falling through the glass
    for (let i = 0; i < 20; i++) {
        const cx = ((i * 170 + t * 24) % (W + 200)) - 100;
        if (cx < x0 - 120 || cx > x1 + 120) continue;
        const cy = top + 20 + (i % 4) * 26;
        const g2 = c.createRadialGradient(cx, cy, 0, cx, cy, 90);
        g2.addColorStop(0, "rgba(220,255,250,0.24)"); g2.addColorStop(1, "rgba(220,255,250,0)");
        c.fillStyle = g2;
        c.fillRect(cx - 90, cy - 90, 180, 180);
    }
    c.globalCompositeOperation = "source-over";
    c.lineWidth = 3;                                                         // the current, running right
    for (let k = 0; k < 6; k++) {
        const y = top + 20 + k * 26;
        c.strokeStyle = `rgba(255,255,255,${0.22 - k * 0.02})`;
        c.beginPath();
        let first = true;
        const sx = Math.floor(x0 / 24) * 24;
        for (let x = sx; x <= x1 + 24; x += 24) {
            const yy = y + Math.sin((x - t * (44 + k * 10)) * 0.011 + k) * (4 + k * 0.7);
            first ? c.moveTo(x, yy) : c.lineTo(x, yy);
            first = false;
        }
        c.stroke();
    }
    for (const f of FISH) {
        const x = (((f.x + t * f.v) % (W + 200)) + W + 200) % (W + 200) - 100;
        if (x < x0 - 60 || x > x1 + 60) continue;
        const y = f.y + Math.sin(t * 1.4 + f.ph) * 6;
        c.save(); c.translate(x, y); c.scale(f.s, f.s);
        c.fillStyle = f.col; c.globalAlpha = 0.88;
        c.beginPath(); c.ellipse(0, 0, 18, 7, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(-16, 0); c.lineTo(-30, -9 + Math.sin(t * 8 + f.ph) * 3); c.lineTo(-30, 9 + Math.sin(t * 8 + f.ph) * 3); c.closePath(); c.fill();
        c.fillStyle = "#12304a"; c.beginPath(); c.arc(10, -2, 1.6, 0, TAU); c.fill();
        c.restore();
    }
    c.fillStyle = "rgba(255,255,255,0.45)";
    for (let i = 0; i < 28; i++) {
        const bx = BLD.x0 + ((i * 97 + 40) % (3000 - BLD.x0));
        if (bx < x0 - 10 || bx > x1 + 10) continue;
        const by = bot - ((t * (14 + (i % 5) * 4) + i * 41) % (bot - top));
        c.beginPath(); c.arc(bx + Math.sin(t + i) * 6, by, 1.5 + (i % 3), 0, TAU); c.fill();
    }
    c.restore();
}

const FISH = (() => {
    const r = rng(77);
    return Array.from({ length: 12 }, (_, i) => ({
        x: r() * W, y: RIVER_TOP + 34 + r() * 100, v: 18 + r() * 40, s: 0.7 + r() * 0.8,
        col: i % 3 === 0 ? "#f0a050" : i % 3 === 1 ? "#e8f4f8" : "#2a6a90", ph: r() * 6
    }));
})();

// ------------------------------------------------ curtains and lanterns (screen)

/** Ornate drapes and hanging lanterns at the top corners of the free area. */
export function drawCurtains(c, left, right, size, t) {
    const L = ART.curtL, R = ART.curtR;
    if (!L || !R) return;
    const sl = size / ih(L), sr = size / ih(R);
    // the drapes hang still; the lanterns on them rock a little
    c.save(); c.translate(left, 0); c.rotate(Math.sin(t * 0.9) * 0.004); c.drawImage(L, 0, 0, iw(L) * sl, ih(L) * sl); c.restore();
    c.save(); c.translate(right - iw(R) * sr, 0); c.rotate(Math.sin(t * 0.8 + 1) * 0.004); c.drawImage(R, 0, 0, iw(R) * sr, ih(R) * sr); c.restore();
}


// ------------------------------------------------------------ workpiece

export function workShape(w) {
    const s = w.stage;
    const len = lerp(40, 150, Math.pow(s, 0.85));
    const wid = s < 0.4 ? lerp(15, 10, s / 0.4) : lerp(10, 17, (s - 0.4) / 0.6);
    const tang = 36 * clamp((s - 0.45) / 0.3, 0, 1);
    const tip = 38 * clamp((s - 0.55) / 0.35, 0, 1);
    return { len, wid, tang, tip };
}

/** Origin at the pommel end, pointing along +x after rotation `a`. */
export function drawWork(c, ox, oy, a, w) {
    const { len, wid, tang, tip } = workShape(w);
    const t = 7;
    c.save();
    c.translate(ox, oy);
    c.rotate(a);
    const base = w.polish ? mix("#8e9aa6", "#dbe6ee", w.polish) : "#8e9aa6";
    const col = w.temp > 0.06 ? heat(w.temp) : base;
    if (w.temp > 0.28) {
        c.save();
        c.globalCompositeOperation = "lighter";
        const g = c.createRadialGradient(len / 2, 0, 2, len / 2, 0, len * 0.6 + 26);
        g.addColorStop(0, `rgba(255,150,60,${clamp(w.temp, 0, 1) * 0.55})`);
        g.addColorStop(1, "rgba(255,120,40,0)");
        c.fillStyle = g;
        c.fillRect(-30, -len, len + 60, len * 2);
        c.restore();
    }
    shape(c, p => {
        p.moveTo(0, -t / 2);
        p.lineTo(tang, -t / 2);
        p.lineTo(tang, -wid / 2);
        p.lineTo(len - tip, -wid / 2);
        p.lineTo(len, 0);
        p.lineTo(len - tip, wid / 2);
        p.lineTo(tang, wid / 2);
        p.lineTo(tang, t / 2);
        p.lineTo(0, t / 2);
        p.closePath();
    }, col, INK, 2.2);
    if (w.stage > 0.8 && w.temp < 0.5) {
        c.strokeStyle = "rgba(40,50,70,0.4)";
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(tang + 8, 0); c.lineTo(len - tip - 6, 0); c.stroke();
        if (w.polish > 0.3) {
            c.strokeStyle = `rgba(255,255,255,${0.8 * w.polish})`;
            c.lineWidth = 1.6;
            c.beginPath(); c.moveTo(tang + 6, -wid / 2 + 3); c.lineTo(len - tip + 4, -2); c.stroke();
        }
    }
    if (w.hilt) {
        shape(c, p => p.rect(-1, -5, tang + 1, 10), "#7a3a2c", INK, 2);
        c.strokeStyle = "rgba(0,0,0,0.4)"; c.lineWidth = 1.4;
        for (let x = 5; x < tang; x += 6) { c.beginPath(); c.moveTo(x, -5); c.lineTo(x + 3, 5); c.stroke(); }
        shape(c, p => p.arc(-3, 0, 7, 0, TAU), GOLD, GOLD_D, 2.2);
        shape(c, p => p.rect(tang - 3, -22, 8, 44), w.variant ? GOLD : "#b6c2cc", w.variant ? GOLD_D : INK, 2.4);
    }
    c.restore();
}

// ------------------------------------------------------------ the scribe

const THIGH = 54, SHIN = 54, TORSO = 82, UPARM = 46, FOREARM = 44;
const COL = {
    skin: "#c58e63", skinHi: "#e2ae84", skinSh: "#8c5a3c",
    thobe: "#ece6d6", thobeHi: "#fffaf0", thobeSh: "#b2a98f",
    cloak: "#2f6f62", cloakHi: "#4d9484", cloakSh: "#1d4a43",
    turban: "#f3eee0", turbanSh: "#bdb59c",
    beard: "#2f2623", grey: "#8f8883",
    belt: "#5a3a22", sandal: "#7a5230"
};

export function rigOf(p, bob) {
    const hipY = lerp(-(THIGH + SHIN) * 0.97, -58, p.sit) + p.crouch * 42 + (bob || 0);
    const hipX = lerp(0, -12, p.sit) + p.shift;
    const sn = Math.sin(p.lean), cs = Math.cos(p.lean);
    const sh = [hipX + sn * (TORSO - 8), hipY - cs * (TORSO - 8)];
    const neck = [hipX + sn * TORSO, hipY - cs * TORSO];
    const hs = Math.sin(p.lean + p.tilt), hc = Math.cos(p.lean + p.tilt);
    const head = [neck[0] + hs * 21 + 3, neck[1] - hc * 21];
    return { hip: [hipX, hipY], sh, neck, head };
}

function ik(ax, ay, tx, ty, l1, l2, dir) {
    let dx = tx - ax, dy = ty - ay;
    let d = Math.hypot(dx, dy);
    const max = l1 + l2 - 0.01;
    if (d > max) { dx *= max / d; dy *= max / d; d = max; }
    d = Math.max(d, 10);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ux = dx / d, uy = dy / d;
    return { j: [ax + ux * a - uy * h * dir, ay + uy * a + ux * h * dir], end: [ax + dx, ay + dy] };
}

/** A limb with a rounded, lit volume: outlined, then each segment shaded across its width. */
function limb(c, pts, w, hi, base, sh) {
    c.lineCap = "round"; c.lineJoin = "round";
    c.strokeStyle = INK; c.lineWidth = w + 5.5;
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const L = Math.hypot(nx, ny) || 1;
        nx /= L; ny /= L;
        if (ny > 0) { nx = -nx; ny = -ny; }                       // light comes from above
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const g = c.createLinearGradient(mx + nx * w * 0.5, my + ny * w * 0.5, mx - nx * w * 0.5, my - ny * w * 0.5);
        g.addColorStop(0, hi); g.addColorStop(0.45, base); g.addColorStop(1, sh);
        c.strokeStyle = g; c.lineWidth = w;
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
}

function sandal(c, ax, ay, dark) {
    shape(c, p => {
        p.moveTo(ax - 8, ay - 8);
        p.lineTo(ax + 7, ay - 8);
        p.lineTo(ax + 9, ay - 1);
        p.quadraticCurveTo(ax + 28, ay - 2, ax + 29, ay + 3);
        p.lineTo(ax - 9, ay + 3);
        p.closePath();
    }, dark ? "#a98a68" : "#d8a878", INK, 2.2);
    c.strokeStyle = COL.sandal; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(ax - 5, ay - 8); c.lineTo(ax + 12, ay - 1); c.moveTo(ax + 6, ay - 8); c.lineTo(ax - 2, ay - 1); c.stroke();
    c.fillStyle = COL.sandal; c.fillRect(ax - 9, ay + 1, 38, 3);
}

export function drawHead(c, hx, hy, o) {
    o = o || {};
    if (o.glow > 0.02) {                                   // knowledge arriving
        c.save(); c.globalCompositeOperation = "lighter";
        const g = c.createRadialGradient(hx, hy, 6, hx, hy, 90);
        g.addColorStop(0, `rgba(255,236,160,${0.8 * o.glow})`); g.addColorStop(1, "rgba(255,210,120,0)");
        c.fillStyle = g; c.fillRect(hx - 90, hy - 90, 180, 180);
        c.restore();
    }
    limb(c, [[hx - 4, hy + 20], [hx - 6, hy + 34]], 18, COL.skinHi, COL.skin, COL.skinSh);          // neck
    shape(c, p => { p.moveTo(hx - 16, hy - 12); p.quadraticCurveTo(hx - 34, hy + 8, hx - 30, hy + 44); p.lineTo(hx - 16, hy + 40); p.quadraticCurveTo(hx - 20, hy + 12, hx - 8, hy - 4); p.closePath(); }, COL.turbanSh, INK, 2);
    const sg = c.createRadialGradient(hx + 6, hy - 6, 4, hx, hy, 26);
    sg.addColorStop(0, COL.skinHi); sg.addColorStop(0.7, COL.skin); sg.addColorStop(1, COL.skinSh);
    shape(c, p => p.ellipse(hx, hy, 19.5, 22, 0, 0, TAU), sg, INK, 2.6);
    shape(c, p => p.ellipse(hx - 5, hy + 2, 4, 6, 0, 0, TAU), COL.skinSh, INK, 1.4);               // ear
    shape(c, p => {                                                                                // beard: full, dark, flecked grey
        p.moveTo(hx - 4, hy + 2);
        p.quadraticCurveTo(hx + 4, hy + 8, hx + 17, hy + 8);
        p.quadraticCurveTo(hx + 25, hy + 22, hx + 12, hy + 42 + (o.speak ? Math.sin(o.t * 18) * 1.8 : 0));
        p.quadraticCurveTo(hx - 6, hy + 46, hx - 14, hy + 20);
        p.quadraticCurveTo(hx - 12, hy + 6, hx - 4, hy + 2);
        p.closePath();
    }, COL.beard, INK, 2.4);
    c.strokeStyle = COL.grey; c.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(hx + 14 - i * 4, hy + 20 + i); c.lineTo(hx + 11 - i * 4, hy + 36); c.stroke(); }
    c.strokeStyle = "#6a3a2a"; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(hx + 12, hy + 14 + (o.speak ? Math.abs(Math.sin(o.t * 14)) * 2.5 : 0)); c.lineTo(hx + 19, hy + 14); c.stroke();
    shape(c, p => { p.moveTo(hx + 4, hy + 10); p.quadraticCurveTo(hx + 14, hy + 8, hx + 22, hy + 11); p.quadraticCurveTo(hx + 14, hy + 15, hx + 4, hy + 13); p.closePath(); }, COL.beard, INK, 1.6);
    shape(c, p => { p.moveTo(hx + 15, hy - 3); p.lineTo(hx + 26, hy + 7); p.lineTo(hx + 16, hy + 9); p.closePath(); }, COL.skin, INK, 2.2);
    c.strokeStyle = COL.beard; c.lineWidth = 4;
    c.beginPath(); c.moveTo(hx + 2, hy - 8); c.quadraticCurveTo(hx + 10, hy - 12, hx + 18, hy - 7); c.stroke();
    if (o.blink) {
        c.strokeStyle = INK; c.lineWidth = 1.8;
        c.beginPath(); c.moveTo(hx + 7, hy - 2); c.lineTo(hx + 14, hy - 2); c.stroke();
    } else {
        c.fillStyle = "#f6f2ea"; c.beginPath(); c.ellipse(hx + 11, hy - 2, 4.4, 3.2, 0, 0, TAU); c.fill();
        c.fillStyle = "#3a2418"; c.beginPath(); c.arc(hx + 12.4, hy - 2, 2.4, 0, TAU); c.fill();
        c.fillStyle = "#fff"; c.fillRect(hx + 13, hy - 3.2, 1.2, 1.2);
    }
    const tg = c.createLinearGradient(hx - 22, hy - 30, hx + 18, hy - 6);                          // the turban: a thick, layered wrap
    tg.addColorStop(0, COL.turban); tg.addColorStop(1, COL.turbanSh);
    shape(c, p => p.ellipse(hx - 1, hy - 14, 25, 17, -0.08, 0, TAU), tg, INK, 2.6);
    c.strokeStyle = "rgba(120,110,85,0.55)"; c.lineWidth = 1.8;
    for (let i = 0; i < 4; i++) {
        c.beginPath(); c.moveTo(hx - 22, hy - 8 - i * 3.5); c.quadraticCurveTo(hx, hy - 24 - i * 3.5, hx + 22, hy - 12 - i * 2); c.stroke();
    }
    c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(hx - 14, hy - 22); c.quadraticCurveTo(hx, hy - 29, hx + 14, hy - 24); c.stroke();
}

/** His face, for the dialogue panel. */
export function drawPortrait(canvas) {
    const c = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    c.clearRect(0, 0, w, h);
    const bg = c.createRadialGradient(w * 0.6, h * 0.3, 4, w * 0.5, h * 0.5, w * 0.8);
    bg.addColorStop(0, "#fff3d0"); bg.addColorStop(0.5, "#a8d8e8"); bg.addColorStop(1, "#4a7aa8");
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.save();
    const s = w / 84;
    c.scale(s, s);
    c.translate(36, 36);
    shape(c, p => { p.moveTo(-40, 64); p.quadraticCurveTo(-36, 32, -12, 34); p.lineTo(18, 34); p.quadraticCurveTo(44, 36, 48, 64); p.closePath(); }, COL.thobe, INK, 2.6);
    shape(c, p => { p.moveTo(-6, 34); p.lineTo(34, 34); p.lineTo(44, 60); p.lineTo(8, 60); p.closePath(); }, COL.cloak, INK, 2.2);
    drawHead(c, 0, 0, { t: 0 });
    c.restore();
}

// -------------------------------------------------------------- held items

function itemHammer(c, h, a) {
    c.save(); c.translate(h[0], h[1]); c.rotate(a);
    c.lineCap = "round";
    c.strokeStyle = INK; c.lineWidth = 9; c.beginPath(); c.moveTo(-10, 0); c.lineTo(56, 0); c.stroke();
    c.strokeStyle = "#a87a4e"; c.lineWidth = 5.4; c.beginPath(); c.moveTo(-10, 0); c.lineTo(56, 0); c.stroke();
    shape(c, p => p.rect(50, -11, 24, 22), "#7a8694", INK, 2.6);
    c.fillStyle = "rgba(255,255,255,0.55)"; c.fillRect(52, -9, 20, 3);
    c.restore();
}

function itemQuill(c, h, a) {
    c.save(); c.translate(h[0], h[1]); c.rotate(a);
    c.lineCap = "round";
    c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.moveTo(-34, 0); c.lineTo(30, 0); c.stroke();
    c.strokeStyle = "#fffaf0"; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-34, 0); c.lineTo(30, 0); c.stroke();
    shape(c, p => { p.moveTo(-36, 0); p.quadraticCurveTo(-62, -16, -54, 10); p.quadraticCurveTo(-44, 6, -36, 0); }, "#ffffff", INK, 1.6);
    c.restore();
}

function itemOre(c, h) {
    shape(c, p => {
        p.moveTo(h[0] - 9, h[1] - 3); p.lineTo(h[0] - 4, h[1] - 11); p.lineTo(h[0] + 8, h[1] - 8);
        p.lineTo(h[0] + 11, h[1] + 3); p.lineTo(h[0] + 2, h[1] + 10); p.lineTo(h[0] - 8, h[1] + 7); p.closePath();
    }, "#8a6650", INK, 2.4);
    c.fillStyle = "rgba(255,220,180,0.4)"; c.fillRect(h[0] - 3, h[1] - 7, 5, 2);
}

export function drawCrucible(c, cr, tint) {
    shape(c, p => { p.moveTo(-21, -16); p.lineTo(21, -16); p.lineTo(14, 22); p.lineTo(-14, 22); p.closePath(); }, "#6a5a52", INK, 2.6);
    const molten = cr.state === "molten";
    c.save();
    c.beginPath(); c.moveTo(-18, -13); c.lineTo(18, -13); c.lineTo(13, 4); c.lineTo(-13, 4); c.closePath(); c.clip();
    c.fillStyle = molten ? heat(0.7 + 0.25 * Math.sin(tint * 6)) : cr.state === "ore" ? mix("#5a4638", "#e0602a", clamp(cr.melt, 0, 1)) : "#2a2422";
    c.fillRect(-20, -14, 40, 18);
    c.restore();
    if (molten || (cr.state === "ore" && cr.melt > 0.4)) {
        c.save(); c.globalCompositeOperation = "lighter";
        const g = c.createRadialGradient(0, -14, 2, 0, -14, 40);
        g.addColorStop(0, `rgba(255,170,70,${molten ? 0.7 : 0.35})`); g.addColorStop(1, "rgba(255,110,30,0)");
        c.fillStyle = g; c.fillRect(-44, -56, 88, 80);
        c.restore();
    }
    c.fillStyle = "rgba(255,255,255,0.3)"; c.fillRect(-20, -15, 40, 2);
}

function itemTongs(c, h, a, load, world, t) {
    c.save(); c.translate(h[0], h[1]); c.rotate(a);
    c.lineCap = "round";
    for (const sgn of [-1, 1]) {
        c.strokeStyle = INK; c.lineWidth = 7;
        c.beginPath(); c.moveTo(-10, sgn * 6); c.lineTo(28, sgn * 2.5); c.lineTo(82, sgn * 1.6); c.stroke();
        c.strokeStyle = "#8a96a4"; c.lineWidth = 3.4;
        c.beginPath(); c.moveTo(-10, sgn * 6); c.lineTo(28, sgn * 2.5); c.lineTo(82, sgn * 1.6); c.stroke();
    }
    shape(c, p => p.arc(30, 0, 3.4, 0, TAU), "#4a5058", INK, 1.8);
    if (load === "work") {
        drawWork(c, 76, 0, 0, world.work);
    } else if (load === "crucible") {
        c.translate(84, 6);
        c.rotate(-a + world.crucible.tilt);
        world.lipM = c.getTransform();
        drawCrucible(c, world.crucible, t);
    }
    c.restore();
}

function itemSword(c, h, a, world) {
    drawWork(c, h[0] - 18 * Math.cos(a), h[1] - 18 * Math.sin(a), a, world.work);
}

const DEF_HOLD = {
    hammer: { dx: 12, dy: 84, a: 1.15 },
    ore: { dx: 24, dy: 46, a: 0 },
    quill: { dx: 30, dy: 44, a: 0.7 },
    sword: { dx: 24, dy: 54, a: -1.4 },
    tongs: { dx: 22, dy: 62, a: 0.2 }
};
export function defHold(type) { return DEF_HOLD[type] || { dx: 8, dy: 80, a: 0 }; }

function heldItem(c, item, h, a, world, t) {
    switch (item.type) {
        case "hammer": itemHammer(c, h, a); break;
        case "quill": itemQuill(c, h, a); break;
        case "ore": itemOre(c, h); break;
        case "sword": itemSword(c, h, a, world); break;
        case "tongs": itemTongs(c, h, a, item.load, world, t); break;
        default: break;
    }
}

function arm(c, sh, a, far) {
    const hi = far ? COL.thobeSh : COL.thobeHi, base = far ? "#c9c1aa" : COL.thobe, sd = COL.thobeSh;
    limb(c, [[sh[0], sh[1] + 2], a.elbow], 23, hi, base, sd);
    const cx = lerp(sh[0], a.elbow[0], 0.84), cy = lerp(sh[1] + 2, a.elbow[1], 0.84);      // rolled cuff at the elbow
    c.strokeStyle = INK; c.lineWidth = 27; c.lineCap = "round";
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(a.elbow[0], a.elbow[1]); c.stroke();
    c.strokeStyle = COL.thobeSh; c.lineWidth = 23;
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(a.elbow[0], a.elbow[1]); c.stroke();
    limb(c, [a.elbow, a.hand], 19, far ? COL.skin : COL.skinHi, far ? "#a8714c" : COL.skin, COL.skinSh);   // bare, broad forearm
    const mx = lerp(a.elbow[0], a.hand[0], 0.3), my = lerp(a.elbow[1], a.hand[1], 0.3);
    c.fillStyle = "rgba(255,225,190,0.28)";
    c.beginPath(); c.ellipse(mx, my - 3, 9, 6, Math.atan2(a.hand[1] - a.elbow[1], a.hand[0] - a.elbow[0]), 0, TAU); c.fill();
    c.fillStyle = far ? "#a8714c" : COL.skin; c.strokeStyle = INK; c.lineWidth = 2.2;                     // a wide hand with a thumb
    c.beginPath(); c.arc(a.hand[0], a.hand[1], 8, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(a.hand[0] + 3, a.hand[1] - 6, 3.2, 5, 0.6, 0, TAU); c.fill(); c.stroke();
}

/** Draw the scribe. `n` is the npc state from scene.js, `cur` its smoothed pose. */
export function drawNpc(c, n, cur, world, t, reflect) {
    const bob = n.walkAmt > 0.05 ? -Math.abs(Math.sin(n.walkPhase)) * 3.2 : Math.sin(t * 1.7) * 0.9;
    const rig = rigOf(cur, bob);
    const { hip, sh, head } = rig;
    const wk = n.walkAmt, ph = n.walkPhase;

    const stance = [[hip[0] - 13 - cur.crouch * 9, 0], [hip[0] + 15 + cur.crouch * 12, 0]];
    const sitFeet = [[hip[0] + 56, 0], [hip[0] + 40, 0]];
    const feet = [0, 1].map(i => {
        let f = [lerp(stance[i][0], sitFeet[i][0], cur.sit), 0];
        if (wk > 0.01) {
            const s = Math.sin(ph + i * Math.PI) * 28 * wk;
            const lift = Math.max(0, Math.cos(ph + i * Math.PI)) * 15 * wk;
            f = [lerp(f[0], hip[0] + s, wk), -lift];
        }
        if (cur.fo && cur.fo[i]) f = [lerp(f[0], cur.fo[i][0], cur.foW), lerp(f[1], cur.fo[i][1], cur.foW)];
        return f;
    });
    const legs = feet.map(f => {
        const k = ik(hip[0], hip[1], f[0], f[1] - 6, THIGH, SHIN, -1);
        return { knee: k.j, ankle: [f[0], f[1] - 6], foot: f };
    });
    const arms = [cur.hF, cur.hB].map(h => {
        const k = ik(sh[0] - 2, sh[1] + 2, h[0], h[1], UPARM, FOREARM, 1);
        return { elbow: k.j, hand: k.end };
    });
    const F = arms[0], B = arms[1];

    c.save();
    if (!reflect) {
        c.fillStyle = "rgba(60,70,110,0.22)";
        c.beginPath(); c.ellipse(hip[0] + 4, 2, 54, 8, 0, 0, TAU); c.fill();
    }

    arm(c, sh, B, true);                                                   // far arm and its item
    if (n.hold.B) {
        if (world.quenchClip) {                                            // the blade is under the water: cut it at the surface
            c.save();
            c.beginPath();
            c.rect(-4000, -4000, 8000, 4000 + (LAYOUT.trough.rim + 6 - n.y));
            c.clip();
            heldItem(c, n.hold.B, B.hand, cur.aB, world, t);
            c.restore();
        } else {
            heldItem(c, n.hold.B, B.hand, cur.aB, world, t);
        }
    }

    limb(c, [hip, legs[0].knee], 24, "#d4cdb8", "#c2baa2", COL.thobeSh);   // far leg
    limb(c, [legs[0].knee, legs[0].ankle], 19, "#d4cdb8", "#c2baa2", COL.thobeSh);
    sandal(c, legs[0].ankle[0], legs[0].foot[1] + 4, true);

    const sway = Math.sin(t * 2.3 + ph) * 3 + (wk > 0.1 ? -16 * wk : 0);   // cloak hanging at his back
    const sn = Math.sin(cur.lean), cs = Math.cos(cur.lean);
    const at = (tt, o) => [hip[0] + sn * TORSO * tt + cs * o, hip[1] - cs * TORSO * tt + sn * o];
    {
        const p1 = at(0.98, -16), p2 = at(0.6, -26), p5 = at(0.9, 4);
        const cg = c.createLinearGradient(p2[0], p2[1], hip[0] + 20, hip[1] + 60);
        cg.addColorStop(0, COL.cloakHi); cg.addColorStop(1, COL.cloakSh);
        shape(c, p => {
            p.moveTo(p1[0], p1[1]);
            p.quadraticCurveTo(p2[0] - 10, p2[1], hip[0] - 32 + sway, hip[1] + 62);
            p.quadraticCurveTo(hip[0] - 12 + sway * 0.6, hip[1] + 76, hip[0] + 4, hip[1] + 60);
            p.lineTo(p5[0], p5[1]);
            p.closePath();
        }, cg, INK, 2.4);
        c.strokeStyle = "rgba(255,255,255,0.25)"; c.lineWidth = 2;
        c.beginPath(); c.moveTo(p2[0] + 4, p2[1] + 20); c.quadraticCurveTo(hip[0] - 20 + sway, hip[1] + 20, hip[0] - 22 + sway, hip[1] + 58); c.stroke();
    }

    const tg = c.createLinearGradient(...at(0.5, -20), ...at(0.5, 22));    // torso: broad chest, narrow waist
    tg.addColorStop(0, COL.thobeSh); tg.addColorStop(0.55, COL.thobe); tg.addColorStop(1, COL.thobeHi);
    shape(c, p => {
        const a1 = at(0, -17), a2 = at(0, 16), a3 = at(0.55, 22), a4 = at(0.94, 15), a5 = at(1.03, -6), a6 = at(0.62, -22);
        p.moveTo(a1[0], a1[1]);
        p.lineTo(a2[0], a2[1]);
        p.quadraticCurveTo(a3[0] + 6, a3[1], a4[0], a4[1]);
        p.lineTo(a5[0], a5[1]);
        p.quadraticCurveTo(a6[0] - 6, a6[1], a1[0], a1[1]);
        p.closePath();
    }, tg, INK, 2.8);
    const skirtA = 1 - clamp(cur.sit * 1.8, 0, 1);                        // long thobe; gives way to visible legs when he sits
    if (skirtA > 0.02) {
        c.save();
        c.globalAlpha = skirtA;
        const hemY = -10;
        const left = Math.min(legs[0].ankle[0], legs[1].ankle[0]) - 16 + sway * 0.4;
        const right = Math.max(legs[0].ankle[0], legs[1].ankle[0]) + 18;
        const sg = c.createLinearGradient(left, 0, right, 0);
        sg.addColorStop(0, "#c9c1aa"); sg.addColorStop(0.5, COL.thobe); sg.addColorStop(1, COL.thobeHi);
        const b = at(0.04, -19), f = at(0.04, 19);
        shape(c, p => {
            p.moveTo(b[0], b[1]);
            p.lineTo(f[0], f[1]);
            p.quadraticCurveTo(right + 2, hip[1] + 52, right, hemY);
            p.quadraticCurveTo((left + right) / 2, hemY + 7, left, hemY);
            p.quadraticCurveTo(left - 2, hip[1] + 52, b[0], b[1]);
            p.closePath();
        }, sg, INK, 2.6);
        c.strokeStyle = "rgba(120,110,85,0.35)"; c.lineWidth = 1.8;
        for (let i = 1; i < 4; i++) {
            const fx = lerp(b[0], f[0], i / 4), tx = lerp(left, right, i / 4);
            c.beginPath(); c.moveTo(fx, hip[1] + 8); c.quadraticCurveTo(lerp(fx, tx, 0.5), hip[1] + 40, tx, hemY - 2); c.stroke();
        }
        c.strokeStyle = GOLD; c.lineWidth = 2;
        c.beginPath(); c.moveTo(left + 2, hemY - 3); c.quadraticCurveTo((left + right) / 2, hemY + 4, right - 2, hemY - 3); c.stroke();
        c.restore();
    }
    const b1 = at(0.1, -19), b2 = at(0.1, 19);                            // belt with a gold buckle
    c.strokeStyle = INK; c.lineWidth = 11; c.lineCap = "butt"; c.beginPath(); c.moveTo(b1[0], b1[1]); c.lineTo(b2[0], b2[1]); c.stroke();
    c.strokeStyle = COL.belt; c.lineWidth = 7; c.beginPath(); c.moveTo(b1[0], b1[1]); c.lineTo(b2[0], b2[1]); c.stroke();
    shape(c, p => p.rect(b2[0] - 6, b2[1] - 5, 9, 10), GOLD, GOLD_D, 1.6);
    {                                                                      // the cloak across his near shoulder and chest
        const q1 = at(1.0, -8), q2 = at(1.0, 14), q3 = at(0.4, 20), q4 = at(0.3, 2);
        const cg = c.createLinearGradient(q1[0], q1[1], q3[0], q3[1]);
        cg.addColorStop(0, COL.cloakHi); cg.addColorStop(1, COL.cloak);
        shape(c, p => { p.moveTo(q1[0], q1[1]); p.lineTo(q2[0], q2[1]); p.quadraticCurveTo(q3[0] + 4, q3[1] - 4, q3[0], q3[1]); p.lineTo(q4[0], q4[1]); p.quadraticCurveTo(q1[0] - 6, q1[1] + 30, q1[0], q1[1]); p.closePath(); }, cg, INK, 2.4);
        c.strokeStyle = GOLD; c.lineWidth = 1.8;
        c.beginPath(); c.moveTo(q4[0], q4[1]); c.lineTo(q3[0], q3[1]); c.stroke();
    }
    {                                                                      // a rounded deltoid on the near side
        const g2 = c.createRadialGradient(sh[0] + 3, sh[1] - 4, 2, sh[0], sh[1], 17);
        g2.addColorStop(0, COL.thobeHi); g2.addColorStop(1, COL.thobe);
        shape(c, p => p.ellipse(sh[0] + 1, sh[1] + 2, 16, 15, 0, 0, TAU), g2, INK, 2.4);
    }

    limb(c, [hip, legs[1].knee], 25, COL.thobeHi, COL.thobe, COL.thobeSh); // near leg
    limb(c, [legs[1].knee, legs[1].ankle], 20, COL.thobeHi, COL.thobe, COL.thobeSh);
    sandal(c, legs[1].ankle[0], legs[1].foot[1] + 4, false);

    drawHead(c, head[0], head[1], { blink: n.blink, speak: n.speaking, t, glow: world.headGlow });
    arm(c, sh, F, false);
    if (n.hold.F) heldItem(c, n.hold.F, F.hand, cur.aF, world, t);

    c.restore();
    if (!reflect) {
        n.shoulderLocal = sh;
        n.headLocal = head;
        n.handsLocal = [F.hand, B.hand];
    }
}

// ---------------------------------------------------------- live props

export function drawFlame(c, x, y, s, t, seed) {
    const sway = Math.sin(t * 7 + seed) * 3 * s + Math.sin(t * 13 + seed * 2) * 1.6 * s;
    const hgt = (24 + Math.sin(t * 9 + seed) * 5) * s;
    c.save();
    c.globalCompositeOperation = "lighter";
    for (const [k, col] of [[1, "rgba(220,90,20,0.55)"], [0.66, "rgba(255,160,50,0.65)"], [0.34, "rgba(255,230,160,0.8)"]]) {
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(x - 9 * s * k, y);
        c.quadraticCurveTo(x - 10 * s * k, y - hgt * 0.5 * k, x + sway * k, y - hgt * k);
        c.quadraticCurveTo(x + 10 * s * k, y - hgt * 0.5 * k, x + 9 * s * k, y);
        c.closePath();
        c.fill();
    }
    c.restore();
}

export function drawFurnaceFire(c, world, t) {
    const { mouthX, mouthY0, mouthY1 } = LAYOUT.furnace;
    const f = world.fire;
    c.save();
    c.beginPath();
    c.rect(mouthX - 50, mouthY0 - 6, 100, mouthY1 - mouthY0 + 6);
    c.clip();
    const bed = c.createLinearGradient(0, mouthY1 - 26, 0, mouthY1);
    bed.addColorStop(0, `rgba(160,40,10,${0.3 + f * 0.5})`);
    bed.addColorStop(1, `rgba(255,150,50,${0.5 + f * 0.5})`);
    c.fillStyle = bed;
    c.fillRect(mouthX - 50, mouthY1 - 26, 100, 26);
    for (let i = 0; i < 12; i++) {
        const px = mouthX - 44 + i * 8 + Math.sin(i * 2.2) * 3;
        c.fillStyle = heat(0.38 + 0.5 * f * (0.6 + 0.4 * Math.sin(t * 3 + i)));
        c.beginPath(); c.ellipse(px, mouthY1 - 8 - (i % 3) * 3, 6, 4, 0, 0, TAU); c.fill();
    }
    const cr = world.crucible;
    if (cr.where === "furnace") {
        c.save(); c.translate(mouthX, mouthY1 - 26); drawCrucible(c, cr, t); c.restore();
    }
    if (world.work.where === "furnace") drawWork(c, mouthX - 36, mouthY1 - 34, 0, world.work);
    for (let i = 0; i < 7; i++) drawFlame(c, mouthX - 40 + i * 13.5, mouthY1 - 14, 0.9 + f * 1.6, t, i * 1.7);
    c.restore();
}

export function drawBellows(c, k) {
    const { x0, hinge, rodX } = LAYOUT.bellows;
    const th = 0.04 + 0.46 * k;
    const len = 96;
    const fx = hinge[0] - len * Math.cos(th), fy = hinge[1] - len * Math.sin(th);
    shape(c, p => p.rect(x0, hinge[1] + 2, hinge[0] - x0 + 8, 9), "#8a5e3c", INK, 2.4);
    shape(c, p => { p.moveTo(x0 + 6, hinge[1] + 2); p.lineTo(fx + 4, fy + 8); p.lineTo(hinge[0], hinge[1] - 2); p.lineTo(hinge[0], hinge[1] + 2); p.closePath(); }, "#a8683a", INK, 2.4);
    c.strokeStyle = "rgba(60,30,10,0.45)"; c.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
        const u = i / 4;
        c.beginPath(); c.moveTo(lerp(x0 + 6, fx + 4, u), lerp(hinge[1] + 2, fy + 8, u)); c.lineTo(hinge[0] - 2, hinge[1] + 1); c.stroke();
    }
    c.save(); c.translate(hinge[0], hinge[1]); c.rotate(-th);
    shape(c, p => p.rect(-len, -9, len + 8, 9), "#a87a4e", INK, 2.4);
    c.restore();
    c.strokeStyle = INK; c.lineWidth = 8; c.beginPath(); c.moveTo(rodX, fy - 4); c.lineTo(rodX, fy - 78); c.stroke();
    c.strokeStyle = "#8a96a4"; c.lineWidth = 4; c.beginPath(); c.moveTo(rodX, fy - 4); c.lineTo(rodX, fy - 78); c.stroke();
    shape(c, p => p.arc(rodX, fy - 84, 8, 0, TAU), null, GOLD_D, 4);
    shape(c, p => p.rect(hinge[0], hinge[1] - 3, LAYOUT.furnace.x0 - hinge[0] + 6, 10), "#4a5058", INK, 2);
}

export function drawMoldAndIngot(c, world) {
    const { x, y } = LAYOUT.mold;
    shape(c, p => p.rect(x - 34, y - 4, 68, 15), "#8a96a4", INK, 2.4);
    c.fillStyle = "#2a2422"; c.fillRect(x - 28, y - 2, 56, 6);
    const w = world.work;
    if (world.mold.fill > 0) {
        const fill = clamp(world.mold.fill, 0, 1);
        const col = world.mold.fill >= 1 && w.where === "mold" ? heat(w.temp) : heat(0.92);
        c.fillStyle = col;
        c.fillRect(x - 27, y - 3 - 7 * fill, 54, 5 + 7 * fill);
        c.save(); c.globalCompositeOperation = "lighter";
        const g = c.createRadialGradient(x, y - 4, 2, x, y - 4, 60);
        const a = (w.where === "mold" ? w.temp : 0.9) * 0.55;
        g.addColorStop(0, `rgba(255,150,60,${a})`); g.addColorStop(1, "rgba(255,110,40,0)");
        c.fillStyle = g; c.fillRect(x - 70, y - 64, 140, 80);
        c.restore();
    }
}

export function drawAnvilWork(c, world) {
    const { x, top } = LAYOUT.anvil;
    if (world.hammerAt === "anvil") {
        c.save(); c.translate(x + 38, top - 3); c.rotate(-0.1);
        itemHammer(c, [-8, -4], 0);
        c.restore();
    }
}

export function drawWater(c, world, t) {
    const { x0, x1, rim } = LAYOUT.trough;
    const amp = 1.2 + world.splash * 3;
    c.save();
    c.beginPath(); c.rect(x0 + 6, rim, x1 - x0 - 12, 24); c.clip();
    const g = c.createLinearGradient(0, rim, 0, rim + 24);
    g.addColorStop(0, "#7ad8e6"); g.addColorStop(1, "#1d6a8a");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x0 + 6, rim + 24);
    for (let x = x0 + 6; x <= x1 - 6; x += 4) c.lineTo(x, rim + 5 + Math.sin(x * 0.18 + t * 3) * amp);
    c.lineTo(x1 - 6, rim + 24);
    c.closePath(); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 1.4;
    c.beginPath();
    for (let x = x0 + 6; x <= x1 - 6; x += 4) { const y = rim + 5 + Math.sin(x * 0.18 + t * 3) * amp; x === x0 + 6 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.stroke();
    c.restore();
}

export function drawWheel(c, world) {
    const { x, y, r } = LAYOUT.wheel;
    c.save(); c.translate(x, y); c.rotate(world.wheelA);
    shape(c, p => p.arc(0, 0, r, 0, TAU), "#b6bec6", INK, 3);
    shape(c, p => p.arc(0, 0, r * 0.55, 0, TAU), "#9aa4ae", INK, 2);
    c.strokeStyle = "rgba(40,50,70,0.4)"; c.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); c.lineTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4)); c.stroke(); }
    c.fillStyle = "rgba(255,255,255,0.35)";
    c.beginPath(); c.arc(-8, -10, r * 0.6, Math.PI, Math.PI * 1.5); c.lineTo(0, 0); c.fill();
    shape(c, p => p.arc(0, 0, 5, 0, TAU), "#4a5058", INK, 1.8);
    c.restore();
    const pedalY = FLOOR - 7 + world.pedal * 8;
    shape(c, p => { p.moveTo(x - 140, pedalY); p.lineTo(x - 60, FLOOR - 9); p.lineTo(x - 60, FLOOR - 1); p.lineTo(x - 140, pedalY + 6); p.closePath(); }, "#a87a4e", INK, 2.4);
    const px = x + Math.cos(world.wheelA) * 15, py = y + Math.sin(world.wheelA) * 15;
    c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(x - 110, pedalY - 3); c.lineTo(px, py); c.stroke();
    c.strokeStyle = "#8a96a4"; c.lineWidth = 2.6; c.beginPath(); c.moveTo(x - 110, pedalY - 3); c.lineTo(px, py); c.stroke();
}

export function drawRackSwords(c, world) {
    const { x0, rows } = LAYOUT.rack;
    const n = Math.min(world.swords, rows.length);
    for (let i = 0; i < n; i++) {
        drawWork(c, x0 + 22, rows[i] + 3, 0, { stage: 1, temp: 0, hilt: true, polish: 1, variant: i % 2 });
    }
}

export function drawCandleFlame(c, t) {
    const [x, y] = LAYOUT.candle;
    drawFlame(c, x, y - 48, 0.55, t, 3);
}

export function drawLamps(c, t) {
    c.save();
    c.globalCompositeOperation = "lighter";
    LAYOUT.lamps.forEach(([x, y], i) => {
        const g = c.createRadialGradient(x, y, 0, x, y, 46);
        const a = 0.55 + 0.08 * Math.sin(t * 6 + i * 2);
        g.addColorStop(0, `rgba(255,236,170,${a})`); g.addColorStop(1, "rgba(255,220,140,0)");
        c.fillStyle = g; c.fillRect(x - 46, y - 46, 92, 92);
    });
    c.restore();
}

// ------------------------------------------------- the scribe's illuminations

export const PHRASES = ["العلم نور", "الكتابة صنعة", "الحديقة جنة", "نخلة وماء", "الرمان فاكهة", "الخلية أصل الحياة", "القلم والورق"];
export const PICS = ["palm", "pomegranate", "garden", "flower", "grapes", "cell"];

const PEN = "#4a3522";

function drawPic(c, kind) {
    c.lineCap = "round"; c.lineJoin = "round";
    const circ = (x, y, r, f, s) => { c.beginPath(); c.arc(x, y, r, 0, TAU); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = 1.2; c.stroke(); } };
    switch (kind) {
        case "palm": {
            c.strokeStyle = "#7a5230"; c.lineWidth = 5;
            c.beginPath(); c.moveTo(50, 68); c.quadraticCurveTo(56, 46, 52, 24); c.stroke();
            c.strokeStyle = "#4a3520"; c.lineWidth = 1;
            for (let y = 60; y > 28; y -= 5) { c.beginPath(); c.moveTo(48, y); c.lineTo(56, y - 1); c.stroke(); }
            c.strokeStyle = "#2f8a52"; c.lineWidth = 2.4;
            for (let i = 0; i < 7; i++) {
                const a = -2.9 + i * 0.46;
                c.beginPath(); c.moveTo(52, 24); c.quadraticCurveTo(52 + Math.cos(a) * 22, 24 + Math.sin(a) * 22 - 10, 52 + Math.cos(a) * 36, 24 + Math.sin(a) * 30 + 6); c.stroke();
            }
            for (let i = 0; i < 9; i++) circ(44 + (i % 3) * 6 + (i > 4 ? 12 : 0), 30 + Math.floor(i / 3) * 4, 2.4, "#d9702a", PEN);
            break;
        }
        case "pomegranate": {
            const g = c.createRadialGradient(34, 34, 2, 40, 40, 24);
            g.addColorStop(0, "#e5564a"); g.addColorStop(1, "#9a2430");
            circ(40, 42, 22, g, PEN);
            c.fillStyle = "#9a2430"; c.beginPath(); c.moveTo(32, 21); c.lineTo(36, 14); c.lineTo(40, 20); c.lineTo(44, 14); c.lineTo(48, 21); c.closePath(); c.fill(); c.strokeStyle = PEN; c.stroke();
            circ(74, 44, 18, "#c63a44", PEN);
            circ(74, 44, 14, "#f6dcd0", null);
            for (let i = 0; i < 16; i++) { const a = i * 2.4; circ(74 + Math.cos(a) * (3 + (i % 4) * 2.6), 44 + Math.sin(a) * (3 + (i % 4) * 2.6), 2.2, "#c42a40", null); }
            break;
        }
        case "garden": {
            c.fillStyle = "#cfe6b8"; c.fillRect(16, 6, 68, 58); c.strokeStyle = PEN; c.lineWidth = 1.6; c.strokeRect(16, 6, 68, 58);
            c.fillStyle = "#6fbfd8"; c.fillRect(46, 6, 8, 58); c.fillRect(16, 31, 68, 8);
            circ(50, 35, 8, "#8fd3e6", PEN);
            for (const [qx, qy] of [[30, 18], [70, 18], [30, 52], [70, 52]]) {
                circ(qx, qy, 7, "#2f8a52", PEN);
                for (let i = 0; i < 5; i++) circ(qx + Math.cos(i * 1.26) * 12, qy + Math.sin(i * 1.26) * 9, 1.6, i % 2 ? "#e8586a" : "#f6c84a", null);
            }
            break;
        }
        case "flower": {
            c.strokeStyle = "#2f8a52"; c.lineWidth = 3;
            c.beginPath(); c.moveTo(46, 68); c.quadraticCurveTo(42, 46, 48, 28); c.stroke();
            c.fillStyle = "#4aa86a";
            c.beginPath(); c.ellipse(36, 54, 11, 4.5, -0.6, 0, TAU); c.fill(); c.beginPath(); c.ellipse(58, 48, 11, 4.5, 0.6, 0, TAU); c.fill();
            for (const [dx, col] of [[-8, "#e8586a"], [8, "#e8586a"], [0, "#f07a86"]]) {
                c.fillStyle = col; c.beginPath(); c.moveTo(48, 30); c.quadraticCurveTo(48 + dx * 1.8, 14, 48 + dx * 0.4, 6); c.quadraticCurveTo(48 + dx * 0.2, 16, 48, 30); c.fill();
                c.strokeStyle = PEN; c.lineWidth = 1; c.stroke();
            }
            c.fillStyle = "#f6c84a"; c.beginPath(); c.ellipse(76, 22, 5, 3.4, 0, 0, TAU); c.fill(); c.strokeStyle = PEN; c.stroke();
            c.strokeStyle = PEN; c.beginPath(); c.moveTo(74, 19); c.lineTo(74, 25); c.moveTo(78, 19); c.lineTo(78, 25); c.stroke();
            break;
        }
        case "grapes": {
            c.strokeStyle = "#7a5230"; c.lineWidth = 2.4;
            c.beginPath(); c.moveTo(46, 8); c.quadraticCurveTo(48, 14, 46, 20); c.stroke();
            let n = 0;
            for (let row = 0; row < 5; row++) for (let i = 0; i <= 4 - row; i++) circ(46 + (i - (4 - row) / 2) * 9, 24 + row * 8, 4.6, n++ % 2 ? "#7a3a8c" : "#6a2f7c", PEN);
            c.fillStyle = "#3f9a5a"; c.beginPath(); c.moveTo(72, 22); c.lineTo(84, 18); c.lineTo(80, 28); c.lineTo(90, 34); c.lineTo(78, 36); c.lineTo(76, 46); c.lineTo(68, 36); c.lineTo(58, 36); c.lineTo(66, 28); c.closePath(); c.fill(); c.strokeStyle = PEN; c.lineWidth = 1; c.stroke();
            break;
        }
        case "cell": {
            circ(32, 36, 26, "#dff2d8", PEN);
            circ(32, 36, 9, "#b6a0d8", PEN); circ(33, 35, 3.2, "#6a4a9a", null);
            for (const [x, y] of [[18, 26], [46, 28], [20, 50], [44, 52]]) { c.fillStyle = "#e8a050"; c.beginPath(); c.ellipse(x, y, 5, 2.6, x, 0, TAU); c.fill(); c.strokeStyle = PEN; c.lineWidth = 0.9; c.stroke(); }
            c.fillStyle = "#4aa86a"; c.beginPath(); c.moveTo(66, 58); c.quadraticCurveTo(62, 22, 90, 14); c.quadraticCurveTo(94, 46, 66, 58); c.fill(); c.strokeStyle = PEN; c.lineWidth = 1.2; c.stroke();
            c.strokeStyle = "#2f7a52"; c.lineWidth = 1.2;
            c.beginPath(); c.moveTo(68, 56); c.quadraticCurveTo(78, 38, 90, 16); c.stroke();
            for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(72 + i * 4, 50 - i * 9); c.lineTo(66 + i * 6, 44 - i * 9); c.stroke(); }
            break;
        }
        default: break;
    }
}

/** The framed parchment above the desk: 3 Arabic lines and 2 pictures, each with a 0..1 progress. */
export function drawPanel(c, panel) {
    const { x0, x1, y0, y1 } = LAYOUT.panel;
    c.save();
    c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
    panel.pics.forEach((pic, i) => {                                       // pictures grow upward as they are drawn
        if (!pic || pic.p <= 0) return;
        c.save();
        c.translate(x0 + 4, y0 + 8 + i * 84);
        c.beginPath(); c.rect(0, 74 * (1 - pic.p), 108, 74 * pic.p + 2); c.clip();
        drawPic(c, pic.kind);
        c.restore();
    });
    c.font = '27px Amiri, "Noto Naskh Arabic", "Traditional Arabic", serif';   // calligraphy runs in from the right edge
    c.textAlign = "right";
    c.textBaseline = "alphabetic";
    c.direction = "rtl";
    c.fillStyle = "#2a1c10";
    panel.lines.forEach((ln, i) => {
        if (!ln || ln.p <= 0) return;
        const wR = x1 - 12, wL = x0 + 118;
        c.save();
        c.beginPath(); c.rect(wR - (wR - wL) * ln.p, y0 + 10 + i * 56, (wR - wL) * ln.p + 2, 54); c.clip();
        c.fillText(ln.text, wR, y0 + 48 + i * 56);
        c.restore();
    });
    c.direction = "ltr";
    c.restore();
}

export function drawBookSprite(c, x, y, ang, open, flap, col, scale, glow) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.scale(scale, scale);
    if (glow > 0) {
        c.save(); c.globalCompositeOperation = "lighter";
        const g = c.createRadialGradient(0, 0, 2, 0, 0, 44);
        g.addColorStop(0, `rgba(255,230,150,${0.5 * glow})`); g.addColorStop(1, "rgba(255,210,120,0)");
        c.fillStyle = g; c.fillRect(-44, -44, 88, 88);
        c.restore();
    }
    const spread = 0.12 + open * (0.95 + 0.35 * Math.sin(flap));
    for (const sgn of [-1, 1]) {
        c.save();
        c.rotate(sgn * spread);
        shape(c, p => { p.moveTo(0, 0); p.lineTo(sgn * 26, -3); p.lineTo(sgn * 26, 24); p.lineTo(0, 22); p.closePath(); }, col, INK, 1.8);
        shape(c, p => { p.moveTo(sgn * 2, 2); p.lineTo(sgn * 23, 0); p.lineTo(sgn * 23, 20); p.lineTo(sgn * 2, 19); p.closePath(); }, "#fbf2d8", null);
        c.strokeStyle = "rgba(90,70,40,0.4)"; c.lineWidth = 1;
        for (let k = 5; k < 18; k += 4) { c.beginPath(); c.moveTo(sgn * 4, k); c.lineTo(sgn * 21, k - 1); c.stroke(); }
        c.restore();
    }
    c.restore();
}
