// Wiring: the scene (scene.js), the contact card and the chrome around them.

import { createSanctuary } from "./scene.js";
import { drawPortrait } from "./art.js";

const NAME = "Shaik";
const $ = id => document.getElementById(id);

const stage = $("stage");
const ticker = $("ticker");
const panel = $("contact");
const veil = $("veil");
const menu = $("menu");
const forgedEl = $("forged-count");

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

let talking = false;
let scene = null;
let statusText = "is browsing the shelves.";

// ------------------------------------------------------------------- the frame

/** The part of the window the room should be framed in, in CSS pixels. */
function getFrame() {
    const w = window.innerWidth, h = window.innerHeight;
    const wide = w >= 900;
    const collapsed = document.body.classList.contains("menu-collapsed");
    const menuW = wide && !collapsed ? menu.getBoundingClientRect().width : 0;
    if (!talking) return { x0: 0, x1: w - menuW, y0: 0, y1: h };
    if (wide) return { x0: panel.getBoundingClientRect().right + 10, x1: w - menuW, y0: 0, y1: h };
    return { x0: 0, x1: w, y0: 40, y1: Math.max(220, h * 0.4) };
}

// ------------------------------------------------------------------------ scene

scene = createSanctuary({
    canvas: stage,
    markerEl: $("npc-marker"),
    getFrame,
    onNpcClick: openContact,
    onStatus: text => { statusText = text; renderTicker(); }
});

function renderTicker() {
    ticker.innerHTML = "";
    if (!scene) return;
    const line = el("div", "line");
    line.append(el("span", "who", NAME), document.createTextNode(" " + statusText));
    ticker.append(line);
    const watch = el("div", "watch");
    watch.append(el("span", null, "Watch him at the "));
    [["read", "library"], ["write", "desk"], ["forge", "forge"]].forEach(([job, label], i) => {
        if (i) watch.append(document.createTextNode(" · "));
        const b = el("button", "link", label);
        b.type = "button";
        b.onclick = () => scene.goTo(job);
        watch.append(b);
    });
    ticker.append(watch);
    updateForged();
}

function updateForged() {
    if (!scene || !forgedEl) return;
    const n = scene.forged();
    forgedEl.textContent = n === 0 ? "No swords forged here yet." : n === 1 ? "1 sword forged here so far." : n + " swords forged here so far.";
}
setInterval(updateForged, 4000);

if (!scene) {
    document.body.classList.add("no-canvas");
} else {
    renderTicker();
}

// ---------------------------------------------------------------------- contact
// No bot speaks for him: the card is a direct line to the real person.

drawPortrait($("portrait"));

function openContact() {
    document.body.classList.remove("menu-open");
    talking = true;
    panel.classList.add("open");
    veil.classList.add("open");
    document.body.classList.add("talking");
    if (scene) scene.setTalking(true);
    setTimeout(() => $("contact-linkedin").focus(), 250);
}

function closeContact() {
    talking = false;
    panel.classList.remove("open");
    veil.classList.remove("open");
    document.body.classList.remove("talking");
    if (scene) scene.setTalking(false);
}

$("talk-to-me").onclick = openContact;
$("contact-close").onclick = closeContact;
veil.onclick = closeContact;
$("npc-marker").onclick = openContact;
$("menu-toggle").onclick = () => {
    // on a wide screen the menu collapses to give the palace the whole window; on a phone it is a drawer
    document.body.classList.toggle(window.innerWidth >= 900 ? "menu-collapsed" : "menu-open");
};
document.addEventListener("keydown", e => { if (e.key === "Escape" && talking) closeContact(); });

window.sanctuary = { scene };
