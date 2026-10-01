// Wiring: the scene (scene.js), his answers (chat.js) and the chrome around them.

import { createSanctuary } from "./scene.js";
import { drawPortrait } from "./art.js";
import { PRESETS, GREETING, NEEDS_MIND, createMind } from "./chat.js";

const NAME = "Shaik";
const $ = id => document.getElementById(id);

const stage = $("stage");
const ticker = $("ticker");
const panel = $("chat");
const thread = $("thread");
const chips = $("chips");
const input = $("question");
const askBtn = $("ask");
const veil = $("veil");
const menu = $("menu");
const mindBox = $("mind");
const mindLog = $("mind-log");
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
    onNpcClick: openChat,
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

// ------------------------------------------------------------------------- chat

const mind = createMind((text, bad) => {
    mindLog.textContent = text;
    mindLog.classList.toggle("bad", !!bad);
});

drawPortrait($("portrait"));

let pending = null;      // a free question waiting on the model to wake
let busy = false;
let typing = 0;

function scrollDown() { thread.scrollTop = thread.scrollHeight; }

function addUser(text) {
    const m = el("div", "msg user", text);
    thread.append(m);
    scrollDown();
}

/** Type a reply out, so he seems to be speaking it. */
function addBot(text, instant) {
    const m = el("div", "msg bot");
    thread.append(m);
    if (instant) { m.textContent = text; scrollDown(); return Promise.resolve(m); }
    const token = ++typing;
    if (scene) scene.setSpeaking(true);
    return new Promise(resolve => {
        let i = 0;
        const tick = () => {
            if (token !== typing) { m.textContent = text; resolve(m); return; }
            i = Math.min(text.length, i + 2);
            m.textContent = text.slice(0, i);
            scrollDown();
            if (i < text.length) setTimeout(tick, 14);
            else { if (scene) scene.setSpeaking(false); resolve(m); }
        };
        tick();
    });
}

function addThinking() {
    const m = el("div", "msg bot pending", "Thinking...");
    thread.append(m);
    scrollDown();
    if (scene) scene.setSpeaking(true);
    return m;
}

function setBusy(v) {
    busy = v;
    askBtn.disabled = v;
    chips.classList.toggle("disabled", v);
}

function buildChips() {
    chips.innerHTML = "";
    PRESETS.forEach(p => {
        const b = el("button", "chip", p.q);
        b.type = "button";
        b.onclick = () => {
            if (busy) return;
            setBusy(true);
            addUser(p.q);
            addBot(p.a).then(() => setBusy(false));
        };
        chips.append(b);
    });
}
buildChips();

async function askFree(question) {
    if (!mind.isReady()) {
        pending = question;
        mindBox.classList.add("open");
        await addBot(NEEDS_MIND, true);
        return;
    }
    const thinking = addThinking();
    try {
        const reply = await mind.ask(question);
        thinking.remove();
        await addBot(reply || "I have nothing in the ledger on that.");
    } catch (err) {
        thinking.remove();
        await addBot("That failed: " + err.message, true);
    } finally {
        if (scene) scene.setSpeaking(false);
    }
}

async function submit() {
    const q = input.value.trim();
    if (!q || busy) return;
    input.value = "";
    setBusy(true);
    addUser(q);
    await askFree(q);
    setBusy(false);
    input.focus();
}

askBtn.onclick = submit;
input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });

function awakenWith(engineName) {
    if (mind.isLoading()) return;
    mind.select(engineName);
    document.querySelectorAll(".engine").forEach(b => b.classList.toggle("active", b.dataset.engine === engineName));
    mindLog.textContent = "Starting the model...";
    mind.awaken().then(async ok => {
        if (!ok || !pending) return;
        const q = pending;
        pending = null;
        setBusy(true);
        await askFree(q);
        setBusy(false);
    });
}
document.querySelectorAll(".engine").forEach(b => {
    b.onclick = () => awakenWith(b.dataset.engine);
});

// -------------------------------------------------------------- open and close

let greeted = false;

function openChat() {
    document.body.classList.remove("menu-open");
    talking = true;
    panel.classList.add("open");
    veil.classList.add("open");
    document.body.classList.add("talking");
    if (scene) scene.setTalking(true);
    if (!greeted) {
        greeted = true;
        addBot(GREETING);
    }
    setTimeout(() => input.focus(), 250);
}

function closeChat() {
    talking = false;
    panel.classList.remove("open");
    veil.classList.remove("open");
    document.body.classList.remove("talking");
    typing++;
    if (scene) { scene.setTalking(false); scene.setSpeaking(false); }
}

$("speak-npc").onclick = openChat;
$("chat-close").onclick = closeChat;
veil.onclick = closeChat;
$("npc-marker").onclick = openChat;
$("menu-toggle").onclick = () => {
    // on a wide screen the menu collapses to give the palace the whole window; on a phone it is a drawer
    document.body.classList.toggle(window.innerWidth >= 900 ? "menu-collapsed" : "menu-open");
};
document.addEventListener("keydown", e => { if (e.key === "Escape" && talking) closeChat(); });

window.sanctuary = { scene };
