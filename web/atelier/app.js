// Wiring: the scholar's body (scene.js), his memory (tree.js) and his mind
// (brain.js) meet here, along with every piece of chrome the visitor touches.
//
// The rule that keeps this honest: the ! and ? are never on a timer. ! means a
// node in the tree is genuinely testable; ? means he has run out of testable
// nodes and wants new material. Nothing else raises them.

import { createAtelier } from "./scene.js";
import * as brain from "./brain.js";
import {
    NODES, STATIONS, DISCLAIMER, PASS_SCORE,
    loadState, saveState, resetState, exportState,
    allNodes, statusOf, nextTestable, summary,
    pickQuestion, recordAttempt, addScroll, scrollsFor
} from "./tree.js";

const NAME = "Al-Kātib";

let state = loadState();
let atelier = null;
let markerTimer = null;
let currentMarker = null;
let dialogue = null;      // { mode, node, keepOpen } -- which exchange is on screen

// ------------------------------------------------------------------ elements

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const marker = $("npc-marker");
const ticker = $("ticker");
const majlis = $("majlis");
const majlisBody = $("majlis-body");
const veil = $("veil");
const atlas = $("atlas");
const atlasBody = $("atlas-body");
const questBadge = $("quest-badge");

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

// ------------------------------------------------------------------- the 3D

atelier = createAtelier({
    canvas: stage,
    markerEl: marker,
    onNpcClick: openMajlis,
    onStatus: describe
});

if (!atelier) {
    document.body.classList.add("no-webgl");
    ticker.innerHTML = "";
    ticker.append(el("span", "who", NAME), document.createTextNode(
        " cannot be drawn here — this needs WebGL. His questions still work: open the Skill Atlas."));
}

function describe(status) {
    if (!atelier) return;
    const place = (STATIONS[status.station] || {}).label || "the courtyard";
    const verb = (STATIONS[status.station] || {}).verb || "standing at";
    let line;
    if (status.marker === "!") {
        line = "has put his work down. He is waiting for you.";
    } else if (status.marker === "?") {
        line = "is looking through empty pages. He wants something to work with.";
    } else if (status.state === "walk") {
        line = "is crossing the courtyard toward " + place + ".";
    } else if (status.pose === "think") {
        line = "is turning something over, half-way to " + place + ".";
    } else {
        line = "is " + verb + " " + place + ".";
    }
    ticker.innerHTML = "";
    ticker.append(el("span", "who", NAME), document.createTextNode(" " + line));
    if (status.marker) {
        ticker.append(el("span", "hint", "Click him, or the mark above his head."));
    }
}

// ---------------------------------------------------------------- the marker

/** How many subjects are open to be tested, shown on the menu button. */
function updateBadge() {
    const counts = summary(state).counts;
    const open = counts.available + counts.contested;
    questBadge.textContent = open ? String(open) : "";
}

/**
 * Decide what floats over his head. A ! whenever the tree has something he can
 * examine you on, a ? when it does not.
 */
function refreshMarker(delay) {
    clearTimeout(markerTimer);
    markerTimer = setTimeout(() => {
        const pending = nextTestable(state);
        currentMarker = pending ? "!" : "?";
        if (atelier) {
            atelier.setMarker(currentMarker);
            if (pending) atelier.setInterest(pending.station);
        }
        updateBadge();
        describe({ state: "alert", station: atelier ? atelier.station : "sabil", marker: currentMarker });
    }, delay == null ? 1800 : delay);
}

function clearMarker() {
    clearTimeout(markerTimer);
    currentMarker = null;
    if (atelier) atelier.setMarker(null);
}

// -------------------------------------------------------------- majlis shell

/** Raise the panel and pull the camera in. Says nothing -- the caller fills it. */
function showMajlis() {
    majlis.classList.add("open");
    veil.classList.add("open");
    document.body.classList.add("talking");
    if (atelier) atelier.setFocus(true);
}

function openMajlis() {
    showMajlis();
    if (dialogue && dialogue.keepOpen) return;   // re-entering a live exchange

    const pending = nextTestable(state);
    if (pending) {
        startTest(pending);
    } else {
        askForMaterial();
    }
}

function closeMajlis() {
    majlis.classList.remove("open");
    veil.classList.remove("open");
    document.body.classList.remove("talking");
    if (atelier) atelier.setFocus(false);
    dialogue = null;
    refreshMarker(14000);   // he goes back to work for a while before asking again
}

function setSpeech(parent, text) {
    const p = el("p", "speech");
    p.textContent = text;
    parent.append(p);
    return p;
}

function subjectChip(node) {
    const chip = el("div", "subject");
    chip.append(el("span", null, node.title));
    if (node.arabic) {
        const ar = el("span", "arabic", node.arabic);
        chip.append(ar);
    }
    return chip;
}

function thinkingRow(label) {
    const row = el("div", "thinking");
    row.append(el("span", "quill"), el("span", null, label));
    return row;
}

// ------------------------------------------------------------------ the test

async function startTest(node) {
    clearMarker();
    if (atelier) atelier.goTo(node.station || "maktab", { pose: "think" });

    dialogue = { mode: "test", node, keepOpen: true };
    majlisBody.innerHTML = "";
    majlisBody.append(subjectChip(node));

    const bankQuestion = pickQuestion(state, node);
    if (!bankQuestion) {
        setSpeech(majlisBody, "I have nothing prepared on this. Give me something to read first.");
        const row = el("div", "majlis-actions");
        const back = el("button", "btn go", "Let me dictate something");
        back.onclick = askForMaterial;
        row.append(back);
        majlisBody.append(row);
        return;
    }

    const speech = setSpeech(majlisBody, "");
    const composing = thinkingRow("He is choosing his question...");
    if (brain.isAwake()) majlisBody.append(composing);

    const composed = await brain.composeQuestion(state, node, bankQuestion);
    composing.remove();
    if (!dialogue || dialogue.node !== node) return;   // visitor moved on mid-flight

    speech.textContent = composed.text;

    // Everything below closes over this rather than reading `dialogue` later:
    // the visitor can close the panel at any point, and a stale handler must not
    // be able to fault on a nulled dialogue.
    const exchange = { node, question: bankQuestion, questionText: composed.text };

    const answer = el("textarea");
    answer.placeholder = "Answer from memory. Half-remembered is still worth writing down — he grades what you actually recall.";
    answer.setAttribute("aria-label", "Your answer");
    majlisBody.append(answer);

    const actions = el("div", "majlis-actions");
    const submit = el("button", "btn go", "Submit my answer");
    const skip = el("button", "btn quiet", "I don't know this yet");
    actions.append(submit, skip);
    if (!brain.isAwake()) actions.append(awakenButton());
    majlisBody.append(actions);

    answer.focus();
    submit.onclick = () => finishTest(exchange, answer.value);
    skip.onclick = () => {
        // Not scored as a failure -- an honest "not yet" shouldn't dirty the tree.
        majlisBody.innerHTML = "";
        majlisBody.append(subjectChip(node));
        setSpeech(majlisBody, "Then go and read it, and come back when you can say it without the book. " +
            "I will keep this one waiting for you.");
        const row = el("div", "majlis-actions");
        const done = el("button", "btn", "Close");
        done.onclick = closeMajlis;
        row.append(done);
        majlisBody.append(row);
    };
    answer.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit.click();
    });
}

async function finishTest(exchange, answerText) {
    const node = exchange.node;
    const answer = (answerText || "").trim();
    majlisBody.innerHTML = "";
    majlisBody.append(subjectChip(node));

    // Material the visitor dictated has no rubric -- it is graded against their
    // own words, by the model if it is awake and by their own honesty if not.
    if (node.custom) {
        const original = (scrollsFor(state, node).slice(-1)[0] || {}).text || node.text || "";
        const judging = thinkingRow("He is comparing it with what you told him...");
        majlisBody.append(judging);
        const modelVerdict = brain.isAwake()
            ? await brain.judgeAgainstScroll(node, exchange.questionText, answer, original)
            : null;
        judging.remove();
        if (modelVerdict) {
            modelVerdict.answer = answer;
            showVerdict(exchange, modelVerdict);
        } else {
            showSelfGrade(exchange, answer, original);
        }
        return;
    }

    const judging = thinkingRow(brain.isAwake() ? "He is weighing your answer..." : "He is checking his notes...");
    majlisBody.append(judging);
    const verdict = await brain.judge(state, node, exchange.questionText, exchange.question, answer);
    judging.remove();
    verdict.answer = answer;
    showVerdict(exchange, verdict);
}

/** Offline recall grading: you see your own words back and grade yourself. */
function showSelfGrade(exchange, answer, original) {
    setSpeech(majlisBody, "Here is what you dictated to me. Read it against what you just said, " +
        "and tell me honestly how much of it you had.");

    const back = el("div", "scroll-back", original);
    majlisBody.append(back);

    const actions = el("div", "majlis-actions");
    [["I had it, in full", 95], ["Most of it", 75], ["Fragments", 45], ["I had lost it", 15]]
        .forEach(([label, score]) => {
            const b = el("button", score >= PASS_SCORE ? "btn go" : "btn", label);
            b.onclick = () => showVerdict(exchange, {
                score,
                missed: score >= PASS_SCORE ? [] : ["the passage as you first gave it to me"],
                hit: [],
                feedback: score >= 90
                    ? "Good. It is yours now, not the page's."
                    : score >= PASS_SCORE
                        ? "Most of it held. The gaps are where you will lose it first — go back to those."
                        : "Then it was never fixed. Read it once more, sit with it, and let me ask you again.",
                source: "self",
                answer
            });
            actions.append(b);
        });
    majlisBody.append(actions);
}

function showVerdict(exchange, verdict) {
    const node = exchange.node;
    majlisBody.innerHTML = "";
    majlisBody.append(subjectChip(node));

    const record = recordAttempt(state, node.id, {
        score: verdict.score,
        feedback: verdict.feedback,
        missed: verdict.missed,
        question: exchange.questionText,
        answer: verdict.answer || null
    });

    const passed = verdict.score >= PASS_SCORE;
    const box = el("div", "verdict" + (passed ? "" : " fail"));

    const score = el("div", "score");
    score.append(document.createTextNode(String(verdict.score)));
    score.append(el("span", null, " / 100 · " + record.status));
    box.append(score);

    const p = el("p");
    p.textContent = verdict.feedback;
    box.append(p);

    if (verdict.missed && verdict.missed.length) {
        box.append(el("p", null, passed ? "Thin, but not absent:" : "What was missing:"));
        const ul = document.createElement("ul");
        verdict.missed.slice(0, 6).forEach(m => ul.append(el("li", null, m)));
        box.append(ul);
    }

    box.append(el("div", "from", verdict.source === "model"
        ? "Judged by the model running in your browser."
        : verdict.source === "self"
            ? "Graded by you, against your own scroll."
            : "Graded against a fixed rubric — awaken his mind for prose judgement."));

    majlisBody.append(box);

    const actions = el("div", "majlis-actions");
    const next = el("button", "btn go", "Continue");
    next.onclick = () => {
        const following = nextTestable(state);
        if (following && following.id !== node.id) {
            startTest(following);
        } else {
            closeMajlis();
        }
    };
    // A retry rotates to the next question in the bank rather than re-asking the
    // one whose missing points are on screen right now -- otherwise the retry is
    // just reading the feedback back to him. Your own scrolls carry a single
    // question, so there it really is the same one again.
    const rotates = (node.questions || []).length > 1;
    const again = el("button", "btn", rotates
        ? (passed ? "Ask me the other one" : "Ask me another")
        : "Ask me again");
    again.onclick = () => startTest(node);
    const done = el("button", "btn quiet", "Leave him to his work");
    done.onclick = closeMajlis;
    actions.append(next, again, done);
    majlisBody.append(actions);

    if (atelier) {
        atelier.goTo(node.station || "maktab");
    }
    updateBadge();
    saveState(state);
}

// ------------------------------------------------------- feeding him material

function askForMaterial(greeting) {
    clearMarker();
    dialogue = { mode: "feed", keepOpen: true };
    majlisBody.innerHTML = "";

    const fixed = greeting || (state.scrolls.length
        ? "I have examined you on everything I hold. Tell me what you have read since — say it in your own words, not the author's, and I will hold you to it later."
        : "You have my attention. Tell me something you have been studying — a passage, a ruling, an argument. Say it as you understood it. I will not hand it back to you; I will ask you for it.");
    const speech = setSpeech(majlisBody, fixed);

    // With his mind awake he greets you in his own words instead of a fixed line.
    if (brain.isAwake() && !greeting) {
        const verified = summary(state).counts;
        brain.speak(
            "Greet the student and ask them to dictate something they have been studying, so that you can " +
            "examine them on it later. They have " + (verified.verified + verified.mastered) +
            " subjects verified and have dictated " + state.scrolls.length + " passages to you so far.",
            fixed
        ).then(line => {
            if (dialogue && dialogue.mode === "feed") speech.textContent = line;
        });
    }

    const label = el("input");
    label.type = "text";
    label.placeholder = "What shall I file this under? e.g. “Conditions of khiyār al-majlis”";
    label.setAttribute("aria-label", "Subject");
    majlisBody.append(label);

    const body = el("textarea");
    body.placeholder = "Dictate what you learned. The more of it is in your own phrasing, the harder it will be to fake later.";
    body.setAttribute("aria-label", "What you learned");
    majlisBody.append(body);

    const actions = el("div", "majlis-actions");
    const give = el("button", "btn go", "Give it to him");
    give.onclick = () => {
        const added = addScroll(state, { label: label.value, text: body.value });
        if (!added) {
            body.focus();
            return;
        }
        majlisBody.innerHTML = "";
        setSpeech(majlisBody, "Good. Let me sit with this.");
        majlisBody.append(thinkingRow("He carries it to the desk and begins to read..."));
        const row = el("div", "majlis-actions");
        const leave = el("button", "btn quiet", "Leave him to it");
        leave.onclick = closeMajlis;
        row.append(leave);
        majlisBody.append(row);

        if (atelier) {
            atelier.goTo("maktab", { pose: "write" });
            atelier.ponder(9);
        }
        // He needs a believable minute with it before he can examine you on it.
        setTimeout(() => {
            if (dialogue && dialogue.mode === "feed") {
                startTest(added.node);
            } else {
                refreshMarker(500);
            }
        }, 9000);
    };
    actions.append(give);

    // He can also just be told what to examine.
    const testable = allNodes(state).filter(n => {
        const s = statusOf(state, n);
        return s === "available" || s === "contested";
    });
    if (testable.length) {
        const pick = el("button", "btn", "Examine me on something instead");
        pick.onclick = () => startTest(testable[0]);
        actions.append(pick);
    }

    const seeAll = el("button", "btn quiet", "Show me the atlas");
    seeAll.onclick = openAtlas;
    actions.append(seeAll);
    if (!brain.isAwake()) actions.append(awakenButton());
    majlisBody.append(actions);

    label.focus();
}

// ---------------------------------------------------------------- the model

function awakenButton() {
    const b = el("button", "btn quiet");
    b.append(document.createTextNode("Awaken his mind"));
    b.append(el("span", "sub", brain.BRAIN_MODEL + " — a one-off download, then it runs in your browser"));
    b.onclick = () => {
        if (brain.isLoading()) return;
        b.disabled = true;
        const status = el("div", "progress", "Waking him...");
        b.parentElement.after(status);
        brain.awaken(text => { status.textContent = text; }).then(ok => {
            state.brain = ok ? "webllm" : "rubric";
            saveState(state);
            if (ok) {
                status.textContent = "He has his books. From here he writes his own questions.";
                b.remove();
            } else {
                b.disabled = false;
            }
        });
    };
    return b;
}

// ------------------------------------------------------------------ the atlas

const STATE_LABEL = {
    locked: "locked",
    available: "ready to be tested",
    contested: "unresolved",
    verified: "verified",
    mastered: "mastered"
};

function openAtlas() {
    renderAtlas();
    atlas.classList.add("open");
}

function closeAtlas() {
    atlas.classList.remove("open");
}

function renderAtlas() {
    atlasBody.innerHTML = "";
    const nodes = allNodes(state);
    const tiers = {};
    nodes.forEach(n => {
        (tiers[n.tier] = tiers[n.tier] || []).push(n);
    });

    const tierNames = ["Foundations", "The pillars", "Extension", "Synthesis", "Your own scrolls"];

    Object.keys(tiers).map(Number).sort((a, b) => a - b).forEach(tier => {
        const section = el("section", "tier");
        section.append(el("h3", null, tierNames[tier] || ("Tier " + tier)));
        const row = el("div", "tier-row");

        tiers[tier].forEach(node => {
            const status = statusOf(state, node);
            const rec = state.nodes[node.id];
            const card = el("button", "node");
            card.dataset.state = status;

            const title = el("div", "title");
            title.append(el("span", null, node.title));
            if (node.arabic) title.append(el("span", "arabic", node.arabic));
            card.append(title);

            card.append(el("p", "blurb", node.blurb || ""));
            card.append(el("span", "state", STATE_LABEL[status] +
                (rec && rec.best ? " · best " + rec.best : "")));

            if (status === "locked") {
                const needs = (node.requires || []).map(r => {
                    const req = nodes.find(n => n.id === r);
                    return req ? req.title : r;
                });
                card.append(el("div", "needs", "Opens after: " + needs.join(", ")));
                card.disabled = true;
            } else {
                card.onclick = () => {
                    closeAtlas();
                    showMajlis();
                    startTest(node);
                };
            }
            row.append(card);
        });

        section.append(row);
        atlasBody.append(section);
    });

    const counts = summary(state);
    const note = el("div", "atlas-note");
    note.append(el("div", null,
        counts.counts.verified + counts.counts.mastered + " of " + counts.total +
        " verified · " + counts.scrolls + " scroll(s) dictated · " + DISCLAIMER));

    const actions = el("div", "majlis-actions");
    const dump = el("button", "btn", "Export progress");
    dump.onclick = () => {
        const blob = new Blob([exportState(state)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "atelier-progress.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    const wipe = el("button", "btn", "Erase everything");
    wipe.onclick = () => {
        if (!confirm("Erase all progress and every scroll you have dictated? This cannot be undone.")) return;
        state = resetState();
        renderAtlas();
        refreshMarker(600);
    };
    actions.append(dump, wipe);
    note.append(actions);
    atlasBody.append(note);
}

// -------------------------------------------------------------------- wiring

$("open-atlas").onclick = openAtlas;
$("close-atlas").onclick = closeAtlas;
$("speak-npc").onclick = () => {
    document.body.classList.remove("menu-open");   // the drawer would cover him
    openMajlis();
};
$("majlis-close").onclick = closeMajlis;
veil.onclick = closeMajlis;
marker.onclick = openMajlis;

$("menu-toggle").onclick = () => document.body.classList.toggle("menu-open");

document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (atlas.classList.contains("open")) closeAtlas();
    else if (majlis.classList.contains("open")) closeMajlis();
});

// Someone who already downloaded the model on this device gets it back without
// being asked again -- WebLLM serves it from the browser cache.
if (state.brain === "webllm") {
    brain.awaken(text => {
        ticker.innerHTML = "";
        ticker.append(el("span", "who", NAME), document.createTextNode(" " + text));
    });
}

if (!state.seenIntro) {
    state.seenIntro = true;
    saveState(state);
    refreshMarker(4500);
} else {
    refreshMarker(2500);
}

// Exposed for the console; handy when adding nodes to the tree by hand.
window.atelier = { get state() { return state; }, NODES, refreshMarker, scene: atelier };
