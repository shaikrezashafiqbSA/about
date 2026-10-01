// The crystal palace: a 2D cutaway on a canvas, and Al-Katib living in it.
//
// art.js owns what things look like. This file owns what happens. His day is a
// loop of three jobs, each a generator (`yield` waits a frame and hands back dt,
// so a job reads top to bottom like a script):
//
//   study  upstairs in the library: the books leave their shelves, open, flutter
//          in a ring of sparks around him, and pour into his head
//   scribe at his desk downstairs: Arabic calligraphy and drawings of gardens,
//          fruit and living things appear on the framed parchment as he writes
//   forge  ore to sword, the whole chain, ending on the rack
//
// The floor of the lower hall is glass, with a river running under it.

import {
    W, F1, F2, F3, FLOOR, LEVEL_Y, BLD, SHAFT, TAU, LAYOUT, STATIONS, PHRASES, PICS,
    clamp, lerp, ease, easeOut, easeIn, approach, rand,
    loadArt, bakeStatic, drawBackground,
    drawNpc, rigOf, defHold,
    drawRiver, drawFurnaceFire, drawBellows, drawMoldAndIngot, drawAnvilWork, drawWater, drawWheel,
    drawRackSwords, drawCandleFlame, drawLamps, drawSlotBooks, drawPanel, drawBookSprite,
    drawAnts, drawWaterfall, drawFountain, drawCurtains,
    drawLift, drawShutters, drawPanes, drawPool, drawPoolFront, drawPoolFall
} from "./art.js";

const FORGED_KEY = "sanctuary.forged.v1";
const WALK_SPEED = 150;

export function createSanctuary(options) {
    const { canvas, markerEl, getFrame, onNpcClick, onStatus } = options;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;

    // the palace is baked once the painted assets (trees, rock, water, drapes) have loaded
    let bake = null;
    // a still sheet of paper grain over everything: it reads as paint on canvas, not as a filter that moves
    const paperPat = (() => {
        const cv = document.createElement("canvas");
        cv.width = cv.height = 192;
        const g = cv.getContext("2d");
        const im = g.createImageData(192, 192);
        for (let i = 0; i < im.data.length; i += 4) { const v = 100 + Math.random() * 110; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
        g.putImageData(im, 0, 0);
        return ctx.createPattern(cv, "repeat");
    })();
    loadArt().then(() => { bake = bakeStatic(); });

    let forged = 0;
    try { forged = parseInt(localStorage.getItem(FORGED_KEY) || "0", 10) || 0; } catch (e) { /* private mode */ }

    // ---------------------------------------------------------------- world

    const world = {
        fire: 0.4, fireTarget: 0.4, inFire: false,
        crucible: { where: "furnace", state: "empty", melt: 0, tilt: 0 },
        mold: { fill: 0 },
        work: { where: "none", stage: 0, temp: 0, hilt: false, polish: 0, variant: 0 },
        pouring: 0, lip: [0, 0], lipM: null, workPos: null,
        bell: 0.1, hammerAt: "anvil",
        wheelA: 0, wheelSpin: 0, pedal: 0, grinding: 0,
        swords: Math.min(4, 2 + forged), splash: 0, quenching: false, quenchClip: false, flash: 0,
        headGlow: 0,
        lift: { x: SHAFT.x, y: F2, goal: F2 },
        panel: { lines: [null, null, null], pics: [null, null] }
    };

    // the library: twelve books that leave their shelves
    const lib = { active: false, t: 0, total: 0, books: [], presence: LAYOUT.slots.map(() => 1) };

    // --------------------------------------------------------------- the npc

    const npc = {
        x: 755, y: F2, level: 2, face: 1, faceVis: 1, walkPhase: 0, walkAmt: 0,
        hold: { F: null, B: null }, blink: false, blinkAt: 2, speaking: false,
        shoulderLocal: [0, -170], headLocal: [0, -200], handsLocal: [[0, 0], [0, 0]]
    };

    const pose = {};
    const cur = {
        sit: 0, crouch: 0, lean: 0, tilt: 0, shift: 0,
        hF: [10, -100], hB: [10, -100], aF: 1, aB: 1, fo: [null, null], foW: 0
    };

    function beginPose() {
        pose.walk = 0; pose.sit = 0; pose.crouch = 0; pose.lean = 0; pose.tilt = 0; pose.shift = 0;
        pose.hF = null; pose.hB = null; pose.aF = null; pose.aB = null; pose.rate = 9; pose.fo = [null, null];
        return pose;
    }
    beginPose();

    const L = (wx, wy) => [(wx - npc.x) * npc.face, wy - npc.y];
    const shoulder = p => rigOf(p, 0).sh;
    const lerpV = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    const rot = (a, x, y) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    const headWorld = () => [npc.x + npc.faceVis * npc.headLocal[0], npc.y + npc.headLocal[1]];

    /** Hand position that puts a pair of tongs' jaws at world point (tx, ty). */
    function tongsHand(tx, ty, a) {
        const t = L(tx, ty);
        return [t[0] - 84 * Math.cos(a), t[1] - 84 * Math.sin(a)];
    }

    /** Hand position that puts a held crucible's lip at world point (lx, ly). */
    function crucibleHand(lx, ly, a, tilt) {
        const l = L(lx, ly);
        const lipOff = rot(tilt, 20, -16);
        const orig = rot(a, 84, 6);
        return [l[0] - lipOff[0] - orig[0], l[1] - lipOff[1] - orig[1]];
    }

    const say = text => onStatus && onStatus(text);

    // ------------------------------------------------------- job primitives

    function* act(dur, fn) {
        let t = 0;
        while (t < dur) {
            const dt = yield;
            t += dt;
            beginPose();
            fn(clamp(t / dur, 0, 1), dt, pose, t);
        }
    }

    function* until(cond, fn) {
        let t = 0;
        while (!cond()) {
            const dt = yield;
            t += dt;
            beginPose();
            fn && fn(dt, pose, t);
        }
    }

    function* walkFlat(x) {
        if (Math.abs(x - npc.x) <= 3) return;
        const dir = Math.sign(x - npc.x);
        npc.face = dir;
        const fy = LEVEL_Y[npc.level];
        while (Math.abs(x - npc.x) > 2) {
            const dt = yield;
            const step = Math.min(WALK_SPEED * dt, Math.abs(x - npc.x));
            npc.x += dir * step;
            npc.y = fy;
            npc.walkPhase += step * 0.034;
            beginPose();
            pose.walk = 1;
            pose.lean = 0.05;
        }
    }

    /** The lift: it comes to his floor, he steps on, it carries him to another. */
    function* ride(level) {
        if (npc.level === level) return;
        yield* walkFlat(SHAFT.x);
        const L = world.lift;
        L.goal = LEVEL_Y[npc.level];
        while (Math.abs(L.y - L.goal) > 1) { yield; beginPose(); pose.lean = 0.02; }
        npc.y = L.y;
        yield* act(0.45, (u, dt, p) => { p.lean = 0.02; });
        L.goal = LEVEL_Y[level];
        while (Math.abs(L.y - L.goal) > 1) {
            yield;
            npc.y = L.y;
            beginPose();
            pose.crouch = 0.05; pose.lean = 0.02;
            const S = shoulder(pose);
            pose.hF = [S[0] + 30, S[1] + 34]; pose.hB = [S[0] - 12, S[1] + 40];       // a hand on the rail
        }
        npc.level = level;
        npc.y = LEVEL_Y[level];
    }

    /** Walk to a stand on a given floor, taking the lift if it is a different one. */
    function* walkTo(x, face, level) {
        level = level || npc.level;
        if (npc.level !== level) yield* ride(level);
        yield* walkFlat(x);
        if (face) npc.face = face;
    }

    function* beat(dur) { yield* act(dur, (u, dt, p) => { p.lean = 0.02; }); }

    // ------------------------------------------------------------- particles

    const parts = [];
    function emit(p) { if (parts.length < 900) parts.push(p); }

    function sparksAt(x, y, n, speed, dir) {
        for (let i = 0; i < n; i++) {
            const a = (dir == null ? rand(-Math.PI, 0) : dir + rand(-0.6, 0.6));
            const v = rand(0.35, 1) * speed;
            emit({ k: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 620, life: 0, max: rand(0.35, 0.9), sz: rand(1, 2.2) });
        }
    }

    function gold(x, y, n, speed) {
        for (let i = 0; i < n; i++) {
            const a = rand(0, TAU), v = rand(0.2, 1) * speed;
            emit({ k: "gold", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, ay: -6, life: 0, max: rand(0.7, 1.6), sz: rand(2.5, 6) });
        }
    }

    function splash(x, y, n) {
        for (let i = 0; i < n; i++) emit({ k: "drop", x: x + rand(-14, 14), y, vx: rand(-90, 90), vy: rand(-260, -80), ay: 820, life: 0, max: rand(0.5, 1.0), sz: rand(1.6, 3.4) });
    }

    function puff(k, x, y, n, vx, vy, size, max) {
        for (let i = 0; i < n; i++) {
            emit({ k, x: x + rand(-6, 6), y, vx: vx + rand(-12, 12), vy: vy * rand(0.7, 1.2), ay: 0, life: 0, max: max * rand(0.7, 1.2), sz: size * rand(0.7, 1.2) });
        }
    }

    // ------------------------------------------------------- the library sim

    const bez = (a, b, c, t) => [
        (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0],
        (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]
    ];

    const LAUNCH = 1.35, ABSORB = 1.25, RETURN_AFTER = 0.7, RETURN_FADE = 1.2;

    function startLibrary() {
        lib.active = true;
        lib.t = 0;
        lib.books = LAYOUT.slots.map((s, i) => ({
            i, s, t0: 0.9 + i * 0.78 + rand(0, 0.25), orbit: rand(0, TAU), dir: i % 2 ? 1 : -1,
            rx: 150 + (i % 4) * 24, ry: 42 + (i % 3) * 15, orbitT: 3.1 + (i % 3) * 0.35,
            state: "rest", pos: [s.x, s.y], ang: 0, open: 0, flap: rand(0, 6), z: 0, scale: 1, glow: 0, burst: false
        }));
        lib.total = Math.max(...lib.books.map(b => b.t0 + LAUNCH + b.orbitT + ABSORB + RETURN_AFTER + RETURN_FADE)) + 0.4;
    }

    function orbitPos(b, tt) {
        const cx = npc.x, cy = npc.y - 128;
        const th = b.orbit + b.dir * tt * 1.45;
        return { x: cx + Math.cos(th) * b.rx, y: cy + Math.sin(th) * b.ry - 16 + Math.sin(tt * 2 + b.i) * 10, z: Math.sin(th) * b.dir };
    }

    function updateLibrary(dt) {
        if (!lib.active) return;
        lib.t += dt;
        const H = headWorld();
        let allDone = true;
        lib.books.forEach(b => {
            const tt = lib.t - b.t0;
            b.flap += dt * (9 + (b.i % 3));
            if (tt < 0) { b.state = "rest"; lib.presence[b.i] = 1; allDone = false; return; }
            const aStart = LAUNCH + b.orbitT;
            if (tt < LAUNCH) {
                b.state = "launch";
                const u = ease(tt / LAUNCH);
                const to = orbitPos(b, 0);
                const from = [b.s.x, b.s.y];
                const ctrl = [lerp(from[0], to.x, 0.3), Math.min(from[1], to.y) - 110];
                b.pos = bez(from, ctrl, [to.x, to.y], u);
                b.open = u; b.ang = (1 - u) * 0.9 * b.dir; b.scale = lerp(1, 1.5, u); b.z = 1; b.glow = u;
                lib.presence[b.i] = 0;
                if (Math.random() < dt * 28) gold(b.pos[0], b.pos[1], 1, 40);
                allDone = false;
            } else if (tt < aStart) {
                b.state = "orbit";
                const o = orbitPos(b, tt - LAUNCH);
                b.pos = [o.x, o.y]; b.z = o.z; b.open = 1; b.ang = Math.sin(tt * 2 + b.i) * 0.25; b.scale = 1.5; b.glow = 1;
                lib.presence[b.i] = 0;
                if (Math.random() < dt * 32) gold(b.pos[0] + rand(-14, 14), b.pos[1] + rand(-12, 8), 1, 30);
                allDone = false;
            } else if (tt < aStart + ABSORB) {
                b.state = "absorb";
                const u = easeIn((tt - aStart) / ABSORB);
                const from = orbitPos(b, b.orbitT);
                const mid = [lerp(from.x, H[0], 0.5) + b.dir * 40, lerp(from.y, H[1], 0.5) - 50];
                b.pos = bez([from.x, from.y], mid, [H[0], H[1]], u);
                b.open = lerp(1, 0.7, u); b.scale = lerp(1.5, 0.35, u); b.z = 1; b.glow = 1; b.ang += dt * 4 * b.dir;
                lib.presence[b.i] = 0;
                if (Math.random() < dt * 60) gold(b.pos[0], b.pos[1], 2, 60);
                allDone = false;
            } else {
                if (!b.burst) {
                    b.burst = true;
                    world.headGlow = Math.min(1.2, world.headGlow + 0.55);
                    gold(H[0], H[1], 14, 150);
                    say("feels the words enter him.");
                }
                const r = tt - aStart - ABSORB - RETURN_AFTER;
                if (r < 0) { b.state = "away"; lib.presence[b.i] = 0; allDone = false; }
                else if (r < RETURN_FADE) {
                    b.state = "return"; lib.presence[b.i] = r / RETURN_FADE;
                    if (Math.random() < dt * 20) gold(b.s.x, b.s.y, 1, 20);
                    allDone = false;
                } else { b.state = "done"; lib.presence[b.i] = 1; }
            }
        });
        if (allDone || lib.t > lib.total) {
            lib.active = false;
            lib.presence.fill(1);
            lib.books.forEach(b => { b.state = "done"; });
        }
    }

    function drawLibBooks(c, front) {
        lib.books.forEach(b => {
            if (b.state === "rest" || b.state === "away" || b.state === "return" || b.state === "done") return;
            const isFront = b.state !== "orbit" || b.z >= 0;
            if (isFront !== front) return;
            const depthScale = b.state === "orbit" ? 1 + b.z * 0.12 : 1;
            drawBookSprite(c, b.pos[0], b.pos[1], b.ang, b.open, b.flap, b.s.col, b.scale * depthScale * 0.9, b.glow);
        });
    }

    // ----------------------------------------------------------------- jobs

    function resetProps() {
        world.work = { where: "none", stage: 0, temp: 0, hilt: false, polish: 0, variant: 0 };
        world.crucible = { where: "furnace", state: "empty", melt: 0, tilt: 0 };
        world.mold.fill = 0;
        world.pouring = 0;
        world.hammerAt = "anvil";
        world.fireTarget = 0.4;
        world.quenching = false; world.quenchClip = false; world.grinding = 0;
        npc.hold.F = null; npc.hold.B = null;
        lib.active = false; lib.presence.fill(1);
    }

    const PIC_TEXT = {
        palm: "is sketching a date palm, heavy with fruit.",
        pomegranate: "is drawing a pomegranate, and one cut open.",
        garden: "is laying out a walled garden with four rivers.",
        flower: "is drawing a flower, and the bee that found it.",
        grapes: "is drawing a vine, grapes and leaf.",
        cell: "is drawing a living cell, and a leaf beside it."
    };

    const JOBS = {
        *read() {
            say("is heading to the library.");
            yield* walkTo(STATIONS.lib.x, 1, 2);
            say("raises his hands. The books wake on their shelves.");
            startLibrary();
            yield* act(lib.total, (u, dt, p, t) => {
                p.lean = -0.03; p.tilt = -0.2 + Math.sin(t * 1.3) * 0.04;
                p.shift = Math.sin(t * 1.1) * 2;
                const S = shoulder(p);
                const lift = Math.min(1, t / 0.9);
                p.hF = [S[0] + 30 * lift + 4, S[1] + 76 - 108 * lift + Math.sin(t * 2.2) * 4];
                p.hB = [S[0] - 4 * lift + 6, S[1] + 76 - 122 * lift + Math.sin(t * 2.2 + 1) * 4];
                p.aF = -0.5; p.aB = -0.5;
            });
            lib.active = false;
            say("lowers his hands, eyes bright.");
            yield* act(1.2, (u, dt, p) => { p.lean = 0.03; p.tilt = -0.1 * (1 - u); });
        },

        *write() {
            say("is going to his desk.");
            yield* walkTo(STATIONS.desk.x, 1, 2);
            yield* act(1.0, (u, dt, p) => { p.sit = ease(u); p.lean = 0.2 * u; });
            npc.hold.F = { type: "quill" };

            // this session's page: three lines of script and two drawings, shuffled
            const lineIdx = [...PHRASES.keys()].sort(() => Math.random() - 0.5).slice(0, 3);
            const picKinds = [...PICS].sort(() => Math.random() - 0.5).slice(0, 2);
            world.panel = {
                lines: lineIdx.map(i => ({ text: PHRASES[i], p: 0 })),
                pics: picKinds.map(k => ({ kind: k, p: 0 }))
            };
            const segs = [["line", 0, 2.8], ["pic", 0, 5.0], ["line", 1, 2.8], ["pic", 1, 5.0], ["line", 2, 2.8]];
            const total = segs.reduce((a, s) => a + s[2], 0);
            const ledgerX = LAYOUT.desk.x0 + 66, top = LAYOUT.desk.top;
            const P = LAYOUT.panel;
            let segNo = -1;

            yield* act(total, (u, dt, p, t) => {
                p.sit = 1; p.lean = 0.45; p.tilt = 0.4;
                // which segment are we in?
                let acc = 0, seg = segs[segs.length - 1], local = 1;
                for (let i = 0; i < segs.length; i++) {
                    if (t < acc + segs[i][2]) { seg = segs[i]; local = (t - acc) / segs[i][2]; if (i !== segNo) { segNo = i; say(seg[0] === "line" ? "is writing the script, right to left." : PIC_TEXT[picKinds[seg[1]]]); } break; }
                    acc += segs[i][2];
                }
                if (t >= total) local = 1;
                const arr = seg[0] === "line" ? world.panel.lines : world.panel.pics;
                if (arr[seg[1]]) arr[seg[1]].p = ease(local);

                const drawing = seg[0] === "pic";
                const phase = t % 6.5;
                const inkW = [LAYOUT.desk.x0 + 16, top - 20];
                const lw = drawing
                    ? [ledgerX + 14 + Math.sin(t * 2.4) * 22, top - 22 + Math.sin(t * 5.1) * 4]
                    : [ledgerX + 18 + Math.sin(t * 6.2) * 14, top - 22 + Math.sin(t * 11) * 2];
                let nib;
                if (phase < 1.1) {
                    const k = Math.sin((phase / 1.1) * Math.PI);
                    const tgt = lerpV(lw, inkW, ease(Math.min(1, phase / 0.5)) * (phase < 0.55 ? 1 : 1 - ease((phase - 0.55) / 0.55)));
                    nib = [tgt[0], tgt[1] - 6 * k];
                } else nib = lw;
                const nl = L(nib[0], nib[1]);
                p.aF = 0.85;
                p.hF = [nl[0] - 30 * Math.cos(0.85), nl[1] - 30 * Math.sin(0.85)];
                p.hB = L(ledgerX - 34, top - 20);

                // a thread of light from the nib to where the page is filling
                if (phase >= 1.1 && Math.random() < dt * 16) {
                    const tx = seg[0] === "line" ? P.x1 - 40 - 50 * (1 - local) : P.x0 + 54;
                    const ty = seg[0] === "line" ? P.y0 + 30 + seg[1] * 56 : P.y0 + 50 + seg[1] * 84 - 30 * local;
                    const dx = tx - nib[0], dy = ty - nib[1], dist = Math.hypot(dx, dy) || 1;
                    emit({ k: "gold", x: nib[0], y: nib[1], vx: (dx / dist) * 150, vy: (dy / dist) * 150, ay: 0, life: 0, max: Math.min(1.6, dist / 150), sz: rand(2, 4) });
                }
            });
            yield* act(1.0, (u, dt, p) => { p.sit = 1 - ease(u); p.lean = 0.2 * (1 - u); });
            npc.hold.F = null;
        },

        *forge() {
            // the whole thing, start to finish: ore, furnace, smelt, pour, heat,
            // hammer, quench, grind, hilt, and onto the rack.
            const F = STATIONS;
            world.work = { where: "none", stage: 0, temp: 0, hilt: false, polish: 0, variant: forged % 2 };

            // 1. fetch ore
            say("is fetching a lump of iron ore.");
            yield* walkTo(F.ore.x, 1, 1);
            yield* act(1.6, (u, dt, p) => {
                p.crouch = Math.sin(Math.min(u / 0.5, 1) * Math.PI / 2) * (u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45);
                p.lean = 0.5 * (u < 0.55 ? Math.min(u / 0.4, 1) : 1 - (u - 0.55) / 0.45);
                const S = shoulder(p);
                if (u < 0.5) { p.hF = L(LAYOUT.ore.x - 4, LAYOUT.ore.y - 6); }
                else { npc.hold.F = { type: "ore" }; p.hF = lerpV(L(LAYOUT.ore.x - 4, LAYOUT.ore.y - 6), [S[0] + 24, S[1] + 46], ease((u - 0.5) / 0.5)); }
                p.hB = [S[0] + 6, S[1] + 70];
            });

            // 2. load the crucible
            say("is loading the furnace.");
            yield* walkTo(F.furnace.x, 1);
            const mx = LAYOUT.furnace.mouthX;
            let dropped = false;
            yield* act(1.5, (u, dt, p) => {
                p.lean = 0.12;
                const S = shoulder(p);
                p.hF = lerpV([S[0] + 24, S[1] + 46], L(mx - 30, 612), ease(Math.min(u / 0.6, 1)));
                p.hB = [S[0] + 6, S[1] + 70];
                if (!dropped && u > 0.62) { dropped = true; npc.hold.F = null; world.crucible.state = "ore"; world.crucible.melt = 0; puff("smoke", mx, 650, 4, 0, -30, 14, 1.6); }
            });

            // 3. bellows until the iron runs
            say("is working the bellows. The ore begins to run.");
            yield* walkTo(F.bellows.x, 1);
            world.fireTarget = 1;
            for (let i = 0; i < 6; i++) {
                yield* act(1.05, (u, dt, p) => {
                    const k = 0.5 - 0.5 * Math.cos(u * TAU);
                    world.bell = k;
                    p.lean = 0.14; p.crouch = 0.1; p.tilt = 0.15;
                    const handleY = 612 - 48 * k;
                    p.hF = L(LAYOUT.bellows.rodX + 2, handleY);
                    p.hB = L(LAYOUT.bellows.rodX - 3, handleY + 10);
                });
            }
            world.bell = 0.1;

            // 4. watch it
            say("is watching the crucible, waiting for it to come clear.");
            yield* walkTo(F.furnace.x, 1);
            yield* until(() => world.crucible.state === "molten", (dt, p, t) => {
                p.lean = 0.06; p.tilt = 0.1;
                const S = shoulder(p);
                const wipe = Math.sin(t * 1.4) > 0.6;
                const Hd = rigOf(p, 0).head;
                p.hF = wipe ? [Hd[0] + 14, Hd[1] - 6] : [S[0] + 8, S[1] + 76];
                p.hB = [S[0] + 6, S[1] + 74];
            });
            yield* beat(0.5);

            // 5. tong the crucible out, pour it
            say("is lifting the crucible out with the tongs.");
            npc.hold.B = { type: "tongs", load: "none" };
            const crucOut = [mx + 20, LAYOUT.furnace.mouthY1 - 26 - 16];
            yield* act(1.5, (u, dt, p) => {
                p.lean = 0.14; p.crouch = 0.1;
                const a = 0.08;
                const rest = crucibleHand(crucOut[0], crucOut[1], a, 0);
                const S = shoulder(p);
                if (u < 0.45) {
                    p.hB = lerpV([S[0] + 22, S[1] + 62], rest, ease(u / 0.45));
                } else {
                    if (npc.hold.B.load !== "crucible") { npc.hold.B.load = "crucible"; world.crucible.where = "tongs"; }
                    const up = crucibleHand(crucOut[0] + 4, crucOut[1] - 60, a, 0);
                    p.hB = lerpV(rest, up, ease((u - 0.45) / 0.55));
                }
                p.aB = a;
                p.hF = [S[0] + 6, S[1] + 76];
            });
            say("is pouring the molten iron into the mould.");
            const pourLip = [LAYOUT.mold.x, LAYOUT.mold.y - 34];
            let poured = false;
            yield* act(3.4, (u, dt, p) => {
                p.lean = 0.16; p.crouch = 0.1; p.tilt = 0.2;
                const a = 0.08;
                const tilt = u < 0.3 ? lerp(0, 1.95, ease(u / 0.3)) : u < 0.82 ? 1.95 : lerp(1.95, 0, ease((u - 0.82) / 0.18));
                world.crucible.tilt = tilt;
                const from = crucibleHand(crucOut[0] + 4, crucOut[1] - 60, a, 0);
                const to = crucibleHand(pourLip[0], pourLip[1], a, tilt);
                p.hB = lerpV(from, to, ease(Math.min(u / 0.3, 1)));
                if (u > 0.82) p.hB = crucibleHand(pourLip[0], pourLip[1], a, tilt);
                p.aB = a;
                const S = shoulder(p);
                p.hF = [S[0] + 6, S[1] + 76];
                const pouring = tilt > 1.4 && u < 0.8 && world.crucible.state === "molten";
                world.pouring = approach(world.pouring, pouring ? 1 : 0, dt * 6);
                if (pouring) world.mold.fill = clamp(world.mold.fill + dt * 0.5, 0, 1);
                if (world.pouring > 0.5) sparksAt(world.lip[0], world.lip[1] + 8, 1, 90, Math.PI / 2);
                if (!poured && u > 0.8) {
                    poured = true;
                    world.crucible.state = "empty"; world.crucible.melt = 0;
                    world.work = { where: "mold", stage: 0, temp: 0.95, hilt: false, polish: 0, variant: forged % 2 };
                }
            });
            world.fireTarget = 0.55;
            yield* act(1.3, (u, dt, p) => {
                p.lean = 0.14; p.crouch = 0.1;
                world.crucible.tilt = 0;
                const a = 0.08;
                const up = crucibleHand(crucOut[0] + 4, crucOut[1] - 60, a, 0);
                const rest = crucibleHand(crucOut[0], crucOut[1], a, 0);
                p.hB = lerpV(up, rest, ease(Math.min(u / 0.7, 1)));
                p.aB = a;
                if (u > 0.7 && npc.hold.B.load === "crucible") { npc.hold.B.load = "none"; world.crucible.where = "furnace"; }
                const S = shoulder(p);
                p.hF = [S[0] + 6, S[1] + 76];
            });
            say("lets the ingot cool a moment.");
            yield* beat(1.6);

            // 6. take the ingot, heat it
            say("is lifting the ingot out of the mould.");
            const ingotTip = [LAYOUT.mold.x - 26, LAYOUT.mold.y - 8];
            yield* act(1.4, (u, dt, p) => {
                p.lean = 0.18; p.crouch = 0.25;
                const S = shoulder(p);
                const a = 0.12;
                const hold = tongsHand(ingotTip[0], ingotTip[1], a);
                if (u < 0.5) p.hB = lerpV([S[0] + 22, S[1] + 62], hold, ease(u / 0.5));
                else {
                    if (npc.hold.B.load !== "work") { npc.hold.B.load = "work"; world.work.where = "tongs"; world.mold.fill = 0; }
                    p.hB = lerpV(hold, tongsHand(ingotTip[0], ingotTip[1] - 44, a), ease((u - 0.5) / 0.5));
                }
                p.aB = a;
                p.hF = [S[0] + 6, S[1] + 76];
            });
            yield* heatInFurnace("is putting the ingot back into the fire.", 2.8);

            // 7. hammer it out
            yield* walkTo(F.anvil.x, 1);
            yield* pickHammer();
            yield* hammer(6, 0.0, 0.42);
            yield* heatInFurnace("heads back to the fire; the iron has gone dark.", 2.4, true);
            yield* walkTo(F.anvil.x, 1);
            yield* hammer(7, 0.42, 0.8);
            yield* heatInFurnace("is reheating the blade before the last drawing out.", 2.4, true);
            yield* walkTo(F.anvil.x, 1);
            yield* hammer(5, 0.8, 1.0);
            yield* layHammerDown();

            // 8. quench
            say("is carrying the blade to the quench.");
            yield* walkTo(F.trough.x, 1);
            yield* quench();

            // 9. grind
            say("is carrying the blade to the grindstone.");
            yield* walkTo(F.grind.x, 1);
            yield* grind();

            // 10. hilt
            yield* walkTo(F.anvil.x, 1);
            yield* fitHilt();
            yield* inspect();

            // 11. hang it
            say("is hanging the finished sword on the rack.");
            yield* walkTo(F.rack.x, 1);
            yield* hang();
            yield* beat(0.6);
        }
    };

    // ----------------------------------------------------- forge sub-steps

    function* heatInFurnace(text, dur, walk) {
        say(text);
        if (walk) yield* walkTo(STATIONS.furnace.x, 1);
        const mx = LAYOUT.furnace.mouthX;
        world.fireTarget = 0.8;
        yield* act(dur, (u, dt, p) => {
            p.lean = 0.16; p.crouch = 0.12;
            const a = 0.1;
            const S = shoulder(p);
            const out = tongsHand(mx - 30, 620, a);
            const inn = tongsHand(mx - 38, 678, a);
            const k = u < 0.2 ? ease(u / 0.2) : u > 0.82 ? 1 - ease((u - 0.82) / 0.18) : 1;
            p.hB = lerpV(out, inn, k);
            p.aB = a;
            p.hF = [S[0] + 6, S[1] + 76];
            if (k > 0.8) world.inFire = true;
            if (k > 0.8 && Math.random() < 0.3) sparksAt(mx - 20, 660, 1, 120);
        });
        world.fireTarget = 0.5;
    }

    function* pickHammer() {
        yield* act(0.9, (u, dt, p) => {
            p.lean = 0.12;
            const S = shoulder(p);
            const hammerHand = L(LAYOUT.anvil.x + 30, LAYOUT.anvil.top - 6);
            p.hF = lerpV([S[0] + 12, S[1] + 76], hammerHand, ease(Math.min(u / 0.55, 1)));
            p.aF = 0.4;
            p.hB = tongsHand(LAYOUT.anvil.tipX, LAYOUT.anvil.top - 6, 0.05);
            p.aB = 0.05;
            if (u > 0.55) { world.hammerAt = "hand"; npc.hold.F = { type: "hammer" }; }
        });
    }

    function* layHammerDown() {
        yield* act(0.9, (u, dt, p) => {
            p.lean = 0.12;
            const S = shoulder(p);
            const target = L(LAYOUT.anvil.x + 30, LAYOUT.anvil.top - 6);
            p.hF = lerpV([S[0] + 12, S[1] + 76], target, ease(Math.min(u / 0.6, 1)));
            p.aF = 0.4;
            p.hB = tongsHand(LAYOUT.anvil.tipX, LAYOUT.anvil.top - 6, 0.05); p.aB = 0.05;
            if (u > 0.6) { world.hammerAt = "anvil"; npc.hold.F = null; }
        });
    }

    function* hammer(blows, s0, s1) {
        say(s0 === 0 ? "is hammering the ingot into a bar." : s0 < 0.5 ? "is drawing the bar out into a blade." : "is dressing the blade: fuller, edge, point.");
        for (let i = 0; i < blows; i++) {
            let hit = false;
            yield* act(0.86, (u, dt, p) => {
                p.lean = 0.17; p.crouch = 0.28; p.tilt = 0.22; p.rate = 14;
                const S = shoulder(p);
                const len = 40 + (150 - 40) * Math.pow(world.work.stage, 0.85);
                const strikeX = clamp(LAYOUT.anvil.tipX + len - 18, LAYOUT.anvil.tipX + 18, LAYOUT.anvil.x + 36);
                const imp = L(strikeX, LAYOUT.anvil.top - 9);
                const thI = 0.5;
                const handImp = [imp[0] - 62 * Math.cos(thI), imp[1] - 62 * Math.sin(thI)];
                const handUp = [S[0] + 4, S[1] - 48], thUp = -1.3;
                let hand, th;
                if (u < 0.55) { const k = easeOut(u / 0.55); hand = lerpV(handImp, handUp, k); th = lerp(thI, thUp, k); }
                else if (u < 0.66) { const k = easeIn((u - 0.55) / 0.11); hand = lerpV(handUp, handImp, k); th = lerp(thUp, thI, k); p.rate = 60; }
                else { hand = handImp; th = thI; p.rate = 40; }
                p.hF = hand; p.aF = th;
                p.hB = tongsHand(LAYOUT.anvil.tipX, LAYOUT.anvil.top - 9, 0.04); p.aB = 0.04;
                if (!hit && u >= 0.66) {
                    hit = true;
                    world.flash = 1;
                    world.work.stage = clamp(world.work.stage + (s1 - s0) / blows, 0, 1);
                    sparksAt(strikeX, LAYOUT.anvil.top - 10, 11, 330);
                    world.work.temp = Math.max(0, world.work.temp - 0.02);
                }
            });
        }
    }

    function* quench() {
        say("is quenching the blade. Steam and a hiss.");
        const { x0, rim } = LAYOUT.trough;
        yield* act(3.0, (u, dt, p) => {
            p.lean = 0.14; p.crouch = 0.2; p.tilt = 0.15;
            const a = 0.1;
            const above = tongsHand(x0 + 14, rim - 70, a);
            const below = tongsHand(x0 + 18, rim + 3, a);
            const k = u < 0.28 ? ease(u / 0.28) : u > 0.8 ? 1 - ease((u - 0.8) / 0.2) : 1;
            p.hB = lerpV(above, below, k);
            p.aB = a;
            const S = shoulder(p);
            p.hF = [S[0] + 6, S[1] + 76];
            const inWater = k > 0.85;
            world.quenchClip = k > 0.55;
            world.quenching = inWater;
            if (inWater && u < 0.8) {
                if (Math.random() < 0.6) puff("steam", x0 + rand(10, 150), rim, 1, rand(-8, 8), -70, 18, 1.7);
                world.splash = Math.max(world.splash, 0.8);
            }
        });
        world.quenchClip = false;
        world.quenching = false;
        world.work.temp = 0;
    }

    function* grind() {
        say("is grinding the edge. Sparks.");
        const wx = LAYOUT.wheel.x, wy = LAYOUT.wheel.y - LAYOUT.wheel.r;
        const tip = [wx - 66, wy - 4];
        yield* act(5.4, (u, dt, p, t) => {
            p.lean = 0.2; p.crouch = 0.12; p.tilt = 0.3;
            const a = 0.06 + Math.sin(t * 5) * 0.015;
            const press = u > 0.1 && u < 0.92 ? 1 : 0;
            const S = shoulder(p);
            p.hB = tongsHand(tip[0], tip[1] - 8 + press * 7 + Math.sin(t * 9) * 1.2, a); p.aB = a;
            p.hF = [S[0] + 52, S[1] + 60 + Math.sin(t * 9) * 3];
            const pedalDown = Math.sin(t * 8.4) > 0 ? 1 : 0;
            world.pedal = lerp(world.pedal, pedalDown, 0.3);
            const pedalY = FLOOR - 7 + world.pedal * 8;
            p.fo = [null, [(wx - 112 - npc.x) * npc.face, pedalY - FLOOR - 4]];
            world.grinding = press;
            if (press) {
                world.work.polish = clamp(world.work.polish + dt / 4.6, 0, 1);
                sparksAt(wx + 2, wy + 3, 3, 340, -0.12 + rand(-0.3, 0.2));
            }
        });
        world.grinding = 0;
    }

    function* fitHilt() {
        say("is fitting the hilt: crossguard, grip, pommel.");
        yield* pickHammer();
        let taps = 0;
        for (let i = 0; i < 4; i++) {
            let hit = false;
            yield* act(0.7, (u, dt, p) => {
                p.lean = 0.14; p.crouch = 0.22; p.tilt = 0.28; p.rate = 14;
                const S = shoulder(p);
                const imp = L(LAYOUT.anvil.tipX + 8, LAYOUT.anvil.top - 11);
                const thI = 0.7;
                const handImp = [imp[0] - 62 * Math.cos(thI), imp[1] - 62 * Math.sin(thI)];
                const handUp = [S[0] + 14, S[1] - 6], thUp = -0.8;
                let hand, th;
                if (u < 0.55) { const k = easeOut(u / 0.55); hand = lerpV(handImp, handUp, k); th = lerp(thI, thUp, k); }
                else if (u < 0.68) { const k = easeIn((u - 0.55) / 0.13); hand = lerpV(handUp, handImp, k); th = lerp(thUp, thI, k); p.rate = 50; }
                else { hand = handImp; th = thI; p.rate = 36; }
                p.hF = hand; p.aF = th;
                p.hB = tongsHand(LAYOUT.anvil.tipX + 8, LAYOUT.anvil.top - 11, 0.04); p.aB = 0.04;
                if (!hit && u >= 0.68) {
                    hit = true; taps++;
                    sparksAt(LAYOUT.anvil.tipX + 8, LAYOUT.anvil.top - 12, 3, 130);
                    if (taps === 3) world.work.hilt = true;
                }
            });
        }
        yield* layHammerDown();
    }

    function* inspect() {
        yield* act(0.8, (u, dt, p) => {
            p.lean = 0.05;
            const S = shoulder(p);
            p.hB = lerpV(tongsHand(LAYOUT.anvil.tipX, LAYOUT.anvil.top - 9, 0.04), [S[0] + 10, S[1] + 72], ease(u));
            if (u > 0.5) { npc.hold.B = null; npc.hold.F = { type: "sword" }; world.work.where = "hand"; }
            p.hF = [S[0] + 24, S[1] + 56]; p.aF = -1.4;
        });
        say("is holding the finished sword up to the light.");
        let glint = false;
        yield* act(3.2, (u, dt, p, t) => {
            p.lean = 0.02;
            const S = shoulder(p);
            const up = ease(Math.min(u / 0.25, 1));
            p.hF = lerpV([S[0] + 24, S[1] + 56], [S[0] + 30, S[1] - 6], up);
            p.aF = -1.4 + Math.sin(t * 1.6) * 0.12;
            p.tilt = -0.15;
            p.hB = [S[0] + 6, S[1] + 76];
            if (!glint && u > 0.5) {
                glint = true;
                const g = [npc.x + npc.face * (S[0] + 34), npc.y + S[1] - 80];
                for (let i = 0; i < 6; i++) emit({ k: "glint", x: g[0] + rand(-12, 12), y: g[1] + rand(-40, 20), vx: 0, vy: 0, ay: 0, life: 0, max: rand(0.5, 0.9), sz: rand(5, 9) });
            }
        });
    }

    function* hang() {
        const row = LAYOUT.rack.rows[world.swords % LAYOUT.rack.rows.length];
        const target = L(LAYOUT.rack.x0 + 22, row + 2);
        yield* act(2.0, (u, dt, p) => {
            p.lean = 0.04;
            const S = shoulder(p);
            const from = [S[0] + 30, S[1] - 6];
            p.hF = lerpV(from, target, ease(Math.min(u / 0.7, 1)));
            p.aF = lerp(-1.4, 0, ease(Math.min(u / 0.5, 1)));
            p.hB = [S[0] + 6, S[1] + 76];
            if (u > 0.85 && npc.hold.F) {
                npc.hold.F = null;
                world.work = { where: "none", stage: 0, temp: 0, hilt: false, polish: 0, variant: 0 };
                world.swords += 1;
                forged += 1;
                try { localStorage.setItem(FORGED_KEY, String(forged)); } catch (e) { /* private mode */ }
            }
        });
    }

    // --------------------------------------------------------- the life loop

    function* life() {
        for (;;) {
            yield* JOBS.read();
            yield* JOBS.write();
            yield* JOBS.forge();
        }
    }

    let gen = life();
    gen.next();

    function startJob(name) {
        mode = "routine"; nav = null; clearInput();
        if (manual.swim) { npc.x = LAYOUT.pool.x0 - 24; npc.y = F2; manual.swim = false; }
        // if he is mid-ride or on the ledge, set him down on the nearest floor
        const lv = Object.keys(LEVEL_Y).map(Number).sort((a, b) => Math.abs(LEVEL_Y[a] - npc.y) - Math.abs(LEVEL_Y[b] - npc.y))[0];
        if (Math.abs(npc.y - LEVEL_Y[lv]) > 4 || npc.level !== lv) { npc.level = lv; npc.y = LEVEL_Y[lv]; world.lift.y = world.lift.goal = LEVEL_Y[lv]; }
        resetProps();
        gen = (function* () { yield* JOBS[name](); yield* life(); })();
        gen.next();
    }

    // --------------------------------------------------------- talk overrides

    let talking = false;
    function idlePose() {
        beginPose();
        pose.lean = 0.03;
        pose.sit = cur.sit > 0.5 ? 1 : 0;
        if (pose.sit) pose.lean = 0.2;
        return pose;
    }

    // ------------------------------------------------ the world he can walk through
    // MapleStory-style: arrow keys or WASD, Space to jump, Up and Down at the lift, click anywhere to walk there.
    // Floors are solid; the rock ledge is one-way (jump up onto it, or hold Down and jump to drop off).
    // After a few quiet seconds he goes back to his routine.

    const { ledge, pool } = LAYOUT;
    const IDLE_RETURN = 5;
    const STATIC_PLAT = [
        { x0: 62, x1: 1045, y: F2 }, { x0: 1215, x1: pool.x0 + 2, y: F2 }, { x0: pool.x1 - 2, x1: 3042, y: F2 },
        { x0: 448, x1: 1045, y: F3 }, { x0: 1215, x1: 1743, y: F3 },
        { x0: 448, x1: 2632, y: F1 },
        { x0: ledge.x0, x1: ledge.x1, y: ledge.y, oneWay: true },
        { x0: pool.x0 + 2, x1: pool.x1 - 2, y: pool.floor }
    ];
    const manual = { vx: 0, vy: 0, ground: false, plat: null, swim: false, drop: 0, noSwim: 0 };
    const keys = new Set();
    const input = { left: false, right: false, up: false, down: false, jump: false, upP: false, downP: false, jumpP: false };
    let mode = "routine";           // "routine": he lives his day; "manual": you are in charge
    let lastInput = 0;
    let nav = null;                 // a click-to-move journey, run as synthetic key presses
    let poolAgit = 0;

    function clearInput() {
        input.left = input.right = input.up = input.down = input.jump = false;
        input.upP = input.downP = input.jumpP = false;
    }

    function platforms() {
        const L = world.lift;
        const list = [{ x0: L.x - 75, x1: L.x + 75, y: L.y, tag: "lift" }];
        for (const fy of [F3, F2, F1]) if (Math.abs(L.y - fy) > 8) list.push({ x0: SHAFT.x0, x1: SHAFT.x1, y: fy, tag: "shutter" });
        return list.concat(STATIC_PLAT);
    }

    const levelAt = y => { for (const lv of [1, 2, 3]) if (Math.abs(LEVEL_Y[lv] - y) <= 10) return lv; return 0; };

    function xBounds(x, y) {
        if (y > F2 + 30 && x < 2660) return [450, 2630];                   // the basement
        if (y > F2 + 30) return [pool.x0 + 6, pool.x1 - 6];                // the pool
        if (y < F2 - 250 && x < 1800) return [462, 1743];                  // the top floor
        return [70, 3040];                                                  // everywhere else, doors and all
    }

    const inShaft = () => Math.abs(npc.x - SHAFT.x) < 78;

    /** Up and Down at the lift: call it to this floor, or send it to the next one. */
    function liftPress(dir) {
        const L = world.lift;
        if (Math.abs(L.y - L.goal) > 1 || !inShaft()) return;
        const here = levelAt(npc.y);
        if (!here) return;
        const onLift = manual.plat && manual.plat.tag === "lift";
        if (!onLift) { L.goal = LEVEL_Y[here]; return; }
        if (LEVEL_Y[here + dir] != null) L.goal = LEVEL_Y[here + dir];
    }

    function takeControl() {
        lastInput = time;
        if (mode === "manual") return;
        mode = "manual";
        gen = null;
        resetProps();                     // put down whatever he was holding
        manual.vx = manual.vy = 0; manual.plat = null; manual.ground = false;
        say("is yours to move around.");
    }

    function resumeRoutine() {
        mode = "routine"; nav = null; clearInput();
        manual.vx = manual.vy = 0; manual.swim = false;
        const lv = levelAt(npc.y) || (npc.y > F2 + 40 ? 1 : 2);
        npc.level = lv; npc.y = LEVEL_Y[lv]; npc.walkPhase = 0;
        resetProps();
        gen = life(); gen.next();
        say("goes back to his routine.");
    }

    function stepManual(dt) {
        const m = manual, L = world.lift;
        if (m.plat && m.plat.tag === "lift") { npc.y = L.y; m.vy = 0; }       // carried by the lift
        const ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        const swimming = m.swim;
        const crouch = input.down && m.ground && !swimming;
        const speed = swimming ? 130 : crouch ? 0 : 205;
        m.vx += (ax * speed - m.vx) * (1 - Math.exp(-(m.ground ? 16 : swimming ? 4 : 5) * dt));
        if (ax) npc.face = ax > 0 ? 1 : -1;
        if (input.upP) liftPress(1);
        if (input.downP) liftPress(-1);
        if (input.jumpP) {
            if (swimming) {
                const nearBank = npc.x < pool.x0 + 44 || npc.x > pool.x1 - 44;
                if (nearBank) {                                           // hop out onto the bank
                    m.vy = -830; m.vx = npc.x < pool.x0 + 44 ? -210 : 210; m.noSwim = 0.55;
                    splash(npc.x, pool.surface, 10); poolAgit = 1;
                } else if (npc.y < pool.surface + 130 || m.ground) {      // a hop on the spot
                    m.vy = m.ground ? -520 : -520;
                    splash(npc.x, pool.surface, 6); poolAgit = 1;
                }
            } else if (m.ground) {
                if (input.down && m.plat && m.plat.oneWay) { m.drop = 0.3; npc.y += 6; m.ground = false; }
                else if (!crouch) { m.vy = -790; m.ground = false; }
            }
        }
        if (swimming) {
            m.vy += ((pool.surface + 88 - npc.y) * 7 - m.vy * 3.2) * dt;            // float with the head above water
            if (input.up) m.vy -= 700 * dt;
            if (input.down) m.vy += 520 * dt;
        } else m.vy = Math.min(1500, m.vy + 2200 * dt);

        const prevY = npc.y;
        npc.x += m.vx * dt; npc.y += m.vy * dt;
        const [lo, hi] = xBounds(npc.x, npc.y);
        if (npc.x < lo) { npc.x = lo; m.vx = 0; } else if (npc.x > hi) { npc.x = hi; m.vx = 0; }
        m.drop = Math.max(0, m.drop - dt);
        m.noSwim = Math.max(0, m.noSwim - dt);
        m.ground = false; m.plat = null;
        if (m.vy >= 0) {
            for (const pl of platforms()) {
                if (npc.x > pl.x0 && npc.x < pl.x1 && prevY <= pl.y + 5 && npc.y >= pl.y && !(pl.oneWay && m.drop > 0)) {
                    npc.y = pl.y; m.vy = 0; m.ground = true; m.plat = pl; break;
                }
            }
        }
        const nowSwim = !m.noSwim && npc.x > pool.x0 + 4 && npc.x < pool.x1 - 4 && npc.y > pool.surface + 4;
        if (nowSwim !== m.swim) { splash(npc.x, pool.surface, 14); poolAgit = 1; m.swim = nowSwim; }
        if (npc.y > F1 + 300) { npc.x = 2600; npc.y = F2; m.vy = 0; }        // never lost for good

        // pose
        beginPose();
        const p = pose, sp = Math.abs(m.vx);
        if (m.swim) {
            p.lean = 0.3; p.tilt = 0.1;
            const S = shoulder(p), a = time * 6;
            p.hF = [S[0] + 26 + Math.sin(a) * 18, S[1] + 22 + Math.cos(a) * 16];
            p.hB = [S[0] + 14 + Math.sin(a + 3) * 18, S[1] + 30 + Math.cos(a + 3) * 14];
        } else if (!m.ground) {
            p.lean = clamp(m.vx / 800, -0.1, 0.2); p.crouch = m.vy < 0 ? 0 : 0.18; p.rate = 14;
            const S = shoulder(p);
            p.hF = [S[0] + 26, S[1] - 28]; p.hB = [S[0] - 6, S[1] - 16];
            p.fo = [[-8, -36], [18, -22]];
        } else {
            p.walk = sp > 25 ? 1 : 0; p.lean = sp > 25 ? 0.05 : 0.02; p.crouch = crouch ? 0.6 : 0;
            npc.walkPhase += sp * dt * 0.034;
        }
        input.upP = input.downP = input.jumpP = false;
    }

    // click-to-move: a generator that presses the same keys you would
    function* waitS(sec) { let t = 0; while (t < sec) { t += yield; } }
    function* goX(tx, tol, maxT) {
        let t = 0;
        while (Math.abs(npc.x - tx) > (tol || 10) && t < (maxT || 16)) {
            t += yield;
            input.left = npc.x > tx; input.right = npc.x < tx;
        }
        input.left = input.right = false;
    }
    const moving = () => Math.abs(world.lift.y - world.lift.goal) > 1;
    function* useLift(level) {
        let guard = 0;
        while (levelAt(npc.y) !== level && guard++ < 8) {
            yield* goX(SHAFT.x, 14);
            const here = levelAt(npc.y);
            if (!here) { yield* waitS(0.2); continue; }
            while (moving()) yield;
            if (!(manual.plat && manual.plat.tag === "lift")) { input.upP = true; yield; while (moving()) yield; yield* waitS(0.2); }
            yield* waitS(0.1);
            if (level > here) input.upP = true; else input.downP = true;
            yield;
            while (moving()) yield;
        }
    }
    function* navTo(target) {
        // leave the pool or the ledge first
        if (manual.swim) {
            let t = 0;
            while (manual.swim && t < 8) { t += yield; input.left = true; if (npc.x < pool.x0 + 40) input.jumpP = true; }
            input.left = false;
            yield* waitS(0.3);
        } else if (manual.plat && manual.plat.oneWay) {
            yield* goX(ledge.x0 - 40, 8, 3);
            yield* waitS(0.4);
        }
        if (target.kind === "pool") {
            yield* goX(pool.x0 - 14, 8);
            let t = 0;
            while (!manual.swim && t < 3) { t += yield; input.right = true; }
            input.right = false;
            t = 0;
            while (Math.abs(npc.x - target.x) > 14 && t < 4) { t += yield; input.left = npc.x > target.x; input.right = npc.x < target.x; }
            input.left = input.right = false;
            return;
        }
        if (target.kind === "ledge") {
            yield* goX(ledge.x0 - 56, 8);
            for (let tries = 0; tries < 2 && !(manual.plat && manual.plat.oneWay); tries++) {
                input.right = true; input.jumpP = true; yield;
                let t = 0;
                while (t < 1.3 && !(manual.plat && manual.plat.oneWay)) { t += yield; input.right = true; }
                input.right = false;
            }
            if (manual.plat && manual.plat.oneWay) yield* goX(target.x, 8, 4);
            return;
        }
        if (levelAt(npc.y) !== target.level) yield* useLift(target.level);
        yield* goX(target.x, 8);
    }

    function targetAt(wx, wy) {
        if (wx > pool.x0 && wx < pool.x1 && wy > pool.surface - 70 && wy < pool.floor + 10) return { kind: "pool", x: wx };
        if (wx > ledge.x0 - 10 && wx < ledge.x1 + 10 && wy > ledge.y - 230 && wy < ledge.y + 60) return { kind: "ledge", x: clamp(wx, ledge.x0 + 16, ledge.x1 - 16) };
        let best = null, bestCost = 1e9;
        for (const [level, x0, x1] of [[3, 470, 1735], [2, 70, 3036], [1, 458, 2624]]) {
            if (wx < x0 || wx > x1) continue;
            const dy = LEVEL_Y[level] - wy;                                  // how far the click is above that floor
            if (dy > -80 && dy < 360) {
                const cost = Math.abs(dy - 140);
                if (cost < bestCost) { bestCost = cost; best = { kind: "ground", level, x: wx }; }
            }
        }
        return best;
    }

    // --------------------------------------------------------------- camera

    let cw = 0, ch = 0, dpr = 1;
    let s = 0.45, anchorX = 0, anchorY = 0;
    const cam = { x: W / 2, y: 640, init: false };
    let frameNow = { x0: 0, x1: 0, y0: 0, y1: 0 };
    let focusZoom = 1;                 // eases in on what he is doing, and out while he travels
    const shake = { x: 0, y: 0 };      // a slow drift, plus a jolt when the hammer lands
    const VIEW_X = 2700;          // world units across the free area: deliberately zoomed far out, Terraria-style
    const SKY_TOP = -700, GROUND_BOTTOM = 2400;

    function resize() {
        const r = canvas.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 1.6);
        cw = r.width; ch = r.height;
        canvas.width = Math.max(2, Math.round(cw * dpr));
        canvas.height = Math.max(2, Math.round(ch * dpr));
    }

    function layout(dt) {
        const f = getFrame ? getFrame() : { x0: 0, x1: cw, y0: 0, y1: ch };
        frameNow = f;
        const fw = Math.max(200, f.x1 - f.x0);
        let target = Math.max(fw / VIEW_X, fw / W, ch / (GROUND_BOTTOM - SKY_TOP));
        // the camera has opinions: in for the hammer, the crucible and the books, out while he walks
        let fz = 1;
        if (lib.active) fz = 1.22;
        else if (npc.hold.F && npc.hold.F.type === "hammer") fz = 1.3;
        else if (world.pouring > 0.1 || world.grinding || world.quenching) fz = 1.26;
        else if (npc.hold.F && npc.hold.F.type === "quill") fz = 1.2;
        else if (mode === "manual") fz = 1.1;
        else if (npc.walkAmt > 0.6) fz = 0.95;
        focusZoom += (fz - focusZoom) * (1 - Math.exp(-1.4 * dt));
        target *= focusZoom;
        if (talking) target *= 1.7;                       // lean in when he is speaking to you
        target = clamp(target, 0.15, 1.5);
        const ax = (f.x0 + f.x1) / 2, ay = (f.y0 + f.y1) / 2;
        if (!cam.init) { s = target; anchorX = ax; anchorY = ay; }
        else {
            const k = 1 - Math.exp(-5 * dt);
            s += (target - s) * k; anchorX += (ax - anchorX) * k; anchorY += (ay - anchorY) * k;
        }
        // keep the world, not the menu, in charge of the frame: the palace's edge may reach the free area's edge
        const halfW = (f.x1 - f.x0) / 2 / s;
        const loX = halfW, hiX = W - halfW;
        const visW = (f.x1 - f.x0) / s, visH = ch / s;
        const closeness = clamp((focusZoom - 1) * 3.2, 0, 1);
        const driving = mode === "manual";
        const followX = talking ? 1 : Math.max(clamp((W - visW) / (W * 0.3), 0, 1) * 0.9, closeness, driving ? 0.92 : 0);
        const lead = npc.face * (50 + npc.walkAmt * 130 + (driving ? Math.abs(manual.vx) * 0.35 : 0));   // look where he is going
        const wantX = clamp(lerp(W / 2, npc.x + lead, followX), loX, Math.max(loX, hiX));
        const followY = talking ? 1 : Math.max(clamp((2200 - visH) / 500, 0, 1), closeness, driving ? 0.9 : 0);
        let wantY = lerp(640, npc.y - 110, followY);
        const loY = SKY_TOP + anchorY / s, hiY = GROUND_BOTTOM - (ch - anchorY) / s;
        wantY = clamp(wantY, loY, Math.max(loY, hiY));
        if (!cam.init) { cam.x = wantX; cam.y = wantY; cam.init = true; }
        else {
            const k2 = 1 - Math.exp(-(1.8 + npc.walkAmt * 1.4) * dt);
            cam.x += (wantX - cam.x) * k2; cam.y += (wantY - cam.y) * k2;
        }
        cam.x = clamp(cam.x, loX, Math.max(loX, hiX));
        cam.y = clamp(cam.y, loY, Math.max(loY, hiY));
    }

    const toScreen = (wx, wy) => [anchorX + (wx - cam.x - shake.x) * s, anchorY + (wy - cam.y - shake.y) * s];
    const toWorld = (sx, sy) => [(sx - anchorX) / s + cam.x + shake.x, (sy - anchorY) / s + cam.y + shake.y];

    // ---------------------------------------------------------------- update

    let time = 0;

    function updateWorld(dt) {
        world.lift.y = approach(world.lift.y, world.lift.goal, 210 * dt);
        poolAgit = Math.max(0, poolAgit - dt * 1.2);
        world.fire = approach(world.fire, world.fireTarget, dt * 1.1);
        world.flash = Math.max(0, world.flash - dt * 4);
        world.splash = Math.max(0, world.splash - dt * 1.4);
        world.headGlow = Math.max(0, world.headGlow - dt * 1.6);

        const cr = world.crucible;
        if (cr.state === "ore" && cr.where === "furnace") {
            const rate = 0.015 + 0.16 * clamp((world.fire - 0.45) / 0.5, 0, 1);
            cr.melt = Math.min(1, cr.melt + dt * rate);
            if (cr.melt >= 1) cr.state = "molten";
        }

        const w = world.work;
        if (w.where !== "none") {
            if (world.quenching) w.temp = Math.max(0, w.temp - dt * 2.2);
            else if (world.inFire) w.temp = Math.min(1, w.temp + dt * 0.7);
            else w.temp = Math.max(0, w.temp - dt * (w.where === "mold" ? 0.05 : w.where === "hand" ? 0.08 : 0.07));
        }

        world.wheelSpin = approach(world.wheelSpin, world.grinding ? 9 : 0, dt * (world.grinding ? 10 : 2.4));
        world.wheelA += world.wheelSpin * dt;

        updateLibrary(dt);

        // ambient emissions
        const f = world.fire;
        if (Math.random() < dt * (3 + 22 * f)) {
            emit({ k: "ember", x: LAYOUT.furnace.mouthX + rand(-40, 40), y: LAYOUT.furnace.mouthY1 - 20, vx: rand(-14, 14), vy: rand(-60, -120), ay: -8, life: 0, max: rand(1.2, 2.8), sz: rand(1, 2.2) });
        }
        if (Math.random() < dt * (0.7 + 3.6 * f)) puff("smoke", LAYOUT.furnace.mouthX, F2 - 490, 1, 22, -34, 18, 5);
        if (Math.random() < dt * 4) {
            const win = LAYOUT.windows[Math.floor(Math.random() * LAYOUT.windows.length)];
            emit({ k: "mote", x: win.x + rand(20, win.w + 220), y: rand(win.y + 80, (win.floor || F1) - 40), vx: rand(-6, 6), vy: rand(-4, 5), ay: 0, life: 0, max: rand(5, 11), sz: rand(0.9, 2) });
        }
        if (Math.random() < dt * 2.5) {
            emit({ k: "mote", x: rand(450, 1040), y: rand(F2 - 300, F2 - 30), vx: rand(-5, 5), vy: rand(-6, 2), ay: 0, life: 0, max: rand(5, 10), sz: rand(0.9, 2) });
        }
        if (w.where === "tongs" && w.temp > 0.5 && Math.random() < dt * 5 * w.temp && world.workPos) {
            emit({ k: "ember", x: world.workPos[0], y: world.workPos[1], vx: rand(-10, 10), vy: rand(-30, -60), ay: 0, life: 0, max: rand(0.5, 1), sz: 1.4 });
        }
        if (w.temp > 0.3 && w.where === "mold" && Math.random() < dt * 4) {
            puff("smoke", LAYOUT.mold.x + rand(-20, 20), LAYOUT.mold.y - 10, 1, 0, -22, 10, 1.4);
        }

        for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i];
            p.life += dt;
            if (p.life >= p.max) { parts.splice(i, 1); continue; }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += p.ay * dt;
            if (p.k === "smoke" || p.k === "steam") { p.vx *= 0.99; p.sz += dt * 12; }
            if (p.k === "spark" && p.y > F1 - 2 && p.y < F1 + 20) { p.y = FLOOR - 2; p.vy *= -0.3; p.vx *= 0.6; }
        }
    }

    function step(dt) {
        shake.x = Math.sin(time * 0.31) * 9 + (Math.random() - 0.5) * world.flash * 7;
        shake.y = Math.sin(time * 0.23 + 1) * 6 + (Math.random() - 0.5) * world.flash * 7;
        world.inFire = false;
        if (talking) {
            idlePose();       // he stops and turns to you; whatever was in his hands stays there
        } else if (mode === "manual") {
            if (nav) { if (!nav.idle) lastInput = time; const r = nav.gen.next(dt); if (r.done) { nav = null; clearInput(); lastInput = nav && nav.idle ? lastInput : time; } }
            stepManual(dt);
            // a few quiet seconds and he goes back to what he was doing
            if (!nav && time - lastInput > IDLE_RETURN) {
                if (manual.swim || (manual.plat && manual.plat.oneWay) || !manual.ground) {
                    nav = { gen: (function* () { yield* navTo({ kind: "ground", level: 2, x: npc.x < 2700 ? npc.x : 2700 }); })(), idle: true };
                    nav.gen.next();
                } else resumeRoutine();
            }
        } else if (gen) {
            gen.next(dt);
        }
        updateWorld(dt);

        const k = 1 - Math.exp(-pose.rate * dt);
        const ks = 1 - Math.exp(-6 * dt);
        cur.sit += (pose.sit - cur.sit) * ks;
        cur.crouch += (pose.crouch - cur.crouch) * k;
        cur.lean += (pose.lean - cur.lean) * k;
        cur.tilt += (pose.tilt - cur.tilt) * k;
        cur.shift += (pose.shift - cur.shift) * k;
        npc.walkAmt += (pose.walk - npc.walkAmt) * (1 - Math.exp(-10 * dt));
        npc.faceVis += (npc.face - npc.faceVis) * (1 - Math.exp(-14 * dt));

        const S = rigOf(pose, 0).sh;
        const swing = Math.sin(npc.walkPhase) * 20 * npc.walkAmt;
        const natural = (side, item) => {
            if (item) {
                const d = defHold(item.type);
                return { p: [S[0] + d.dx, S[1] + d.dy - Math.abs(swing) * 0.1], a: d.a };
            }
            const sgn = side === "F" ? 1 : -1;
            return { p: [S[0] + 6 + swing * sgn, S[1] + 80 - Math.abs(swing) * 0.2], a: 1 };
        };
        const nF = natural("F", npc.hold.F), nB = natural("B", npc.hold.B);
        const tF = pose.hF || nF.p, tB = pose.hB || nB.p;
        const aF = pose.aF != null ? pose.aF : nF.a, aB = pose.aB != null ? pose.aB : nB.a;
        cur.hF[0] += (tF[0] - cur.hF[0]) * k; cur.hF[1] += (tF[1] - cur.hF[1]) * k;
        cur.hB[0] += (tB[0] - cur.hB[0]) * k; cur.hB[1] += (tB[1] - cur.hB[1]) * k;
        cur.aF += (aF - cur.aF) * k;
        cur.aB += (aB - cur.aB) * k;
        const hasFo = pose.fo[0] || pose.fo[1];
        cur.foW += ((hasFo ? 1 : 0) - cur.foW) * (1 - Math.exp(-10 * dt));
        if (hasFo) cur.fo = pose.fo;

        npc.blinkAt -= dt;
        if (npc.blinkAt <= 0) {
            npc.blink = !npc.blink;
            npc.blinkAt = npc.blink ? 0.12 : rand(2.2, 5.5);
        }
    }

    // ------------------------------------------------------------------ draw

    function drawParticles(c, layer) {
        for (const p of parts) {
            const u = p.life / p.max;
            const back = p.k === "smoke";
            if (layer === "back" && !back) continue;
            if (layer === "front" && back) continue;
            switch (p.k) {
                case "spark": {
                    c.save(); c.globalCompositeOperation = "lighter";
                    c.strokeStyle = u < 0.35 ? "rgba(255,240,190,0.95)" : `rgba(255,${(150 - 60 * u) | 0},40,${1 - u})`;
                    c.lineWidth = p.sz;
                    c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); c.stroke();
                    c.restore(); break;
                }
                case "ember": {
                    c.save(); c.globalCompositeOperation = "lighter";
                    c.fillStyle = `rgba(255,${(170 - 80 * u) | 0},50,${(1 - u) * 0.9})`;
                    c.beginPath(); c.arc(p.x, p.y, p.sz, 0, TAU); c.fill();
                    c.restore(); break;
                }
                case "drop": {
                    c.fillStyle = `rgba(215,245,252,${(1 - u) * 0.9})`;
                    c.beginPath(); c.arc(p.x, p.y, p.sz, 0, TAU); c.fill(); break;
                }
                case "gold": {
                    c.save(); c.globalCompositeOperation = "lighter";
                    const a = Math.sin(Math.min(1, u) * Math.PI);
                    const r = p.sz * (0.6 + 0.4 * a);
                    c.fillStyle = `rgba(255,226,140,${0.85 * a})`;
                    c.beginPath(); c.moveTo(p.x, p.y - r * 1.5); c.lineTo(p.x + r * 0.4, p.y - r * 0.4); c.lineTo(p.x + r * 1.5, p.y); c.lineTo(p.x + r * 0.4, p.y + r * 0.4);
                    c.lineTo(p.x, p.y + r * 1.5); c.lineTo(p.x - r * 0.4, p.y + r * 0.4); c.lineTo(p.x - r * 1.5, p.y); c.lineTo(p.x - r * 0.4, p.y - r * 0.4); c.closePath(); c.fill();
                    c.restore(); break;
                }
                case "smoke": {
                    const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.sz);
                    const a = Math.sin(u * Math.PI) * 0.3;
                    g.addColorStop(0, `rgba(120,118,124,${a})`); g.addColorStop(1, "rgba(120,118,124,0)");
                    c.fillStyle = g; c.fillRect(p.x - p.sz, p.y - p.sz, p.sz * 2, p.sz * 2); break;
                }
                case "steam": {
                    const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.sz);
                    const a = Math.sin(u * Math.PI) * 0.5;
                    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, "rgba(255,255,255,0)");
                    c.fillStyle = g; c.fillRect(p.x - p.sz, p.y - p.sz, p.sz * 2, p.sz * 2); break;
                }
                case "mote": {
                    c.fillStyle = `rgba(255,248,215,${Math.sin(u * Math.PI) * (0.5 + 0.3 * Math.sin(time * 3 + p.x))})`;
                    c.beginPath(); c.arc(p.x, p.y, p.sz, 0, TAU); c.fill(); break;
                }
                case "glint": {
                    c.save(); c.globalCompositeOperation = "lighter";
                    const a = Math.sin(u * Math.PI);
                    c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 1.6;
                    c.beginPath(); c.moveTo(p.x - p.sz, p.y); c.lineTo(p.x + p.sz, p.y); c.moveTo(p.x, p.y - p.sz); c.lineTo(p.x, p.y + p.sz); c.stroke();
                    c.restore(); break;
                }
                default: break;
            }
        }
    }

    function drawShafts(c) {
        c.save();
        c.globalCompositeOperation = "lighter";
        const wins = LAYOUT.windows;
        wins.forEach((w, i) => {
            const fl = w.floor || F1;
            const pulse = 0.85 + 0.15 * Math.sin(time * 0.5 + i * 2);
            const g = c.createLinearGradient(0, w.y + w.h * 0.4, 0, fl + 30);
            g.addColorStop(0, `rgba(255,244,205,${0.2 * pulse})`);
            g.addColorStop(1, "rgba(255,244,205,0)");
            c.fillStyle = g;
            c.beginPath();
            c.moveTo(w.x + 8, w.y + w.h * 0.4); c.lineTo(w.x + w.w - 8, w.y + w.h * 0.4);
            c.lineTo(w.x + w.w + 220, fl + 30); c.lineTo(w.x + 160, fl + 30);
            c.closePath(); c.fill();
        });
        c.restore();
    }

    function drawStream(c) {
        if (world.pouring < 0.05) return;
        const [lx, ly] = world.lip;
        const ty = LAYOUT.mold.y - 4;
        c.save();
        c.globalCompositeOperation = "lighter";
        c.strokeStyle = `rgba(255,170,60,${0.9 * world.pouring})`;
        c.lineWidth = 5;
        c.lineCap = "round";
        c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + 3, ty); c.stroke();
        c.strokeStyle = `rgba(255,235,170,${world.pouring})`;
        c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + 3, ty); c.stroke();
        c.restore();
    }

    /** Warm pools of light. There is no darkness to punch holes in: this only adds glow. */
    function glows() {
        const out = [];
        const flick = 0.9 + 0.1 * Math.sin(time * 13) + 0.05 * Math.sin(time * 31);
        const f = world.fire;
        out.push({ x: LAYOUT.furnace.mouthX, y: F1 - 60, r: 420 + 140 * f, a: (0.4 + 0.5 * f) * flick, c: "255,140,60" });
        out.push({ x: LAYOUT.candle[0], y: LAYOUT.candle[1] - 40, r: 180, a: 0.45 * (0.92 + 0.08 * Math.sin(time * 15)), c: "255,200,110" });
        if (lib.active) out.push({ x: npc.x, y: npc.y - 130, r: 330, a: 0.4 + 0.3 * world.headGlow, c: "255,226,140" });
        const wk = world.work;
        if (wk.temp > 0.25 && world.workPos) out.push({ x: world.workPos[0], y: world.workPos[1], r: 90 + 140 * wk.temp, a: wk.temp * 0.7, c: "255,150,70" });
        if (world.flash > 0.02) out.push({ x: LAYOUT.anvil.x, y: LAYOUT.anvil.top - 6, r: 260, a: world.flash * 0.8, c: "255,170,80" });
        if (world.grinding) out.push({ x: LAYOUT.wheel.x, y: LAYOUT.wheel.y - 30, r: 230, a: 0.75 * (0.7 + 0.3 * Math.random()), c: "255,180,90" });
        if (world.mold.fill > 0) out.push({ x: LAYOUT.mold.x, y: LAYOUT.mold.y - 8, r: 200, a: 0.5, c: "255,150,70" });
        return out;
    }

    function drawGlows() {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const l of glows()) {
            const [sx, sy] = toScreen(l.x, l.y);
            const r = l.r * s;
            if (sx + r < 0 || sx - r > cw || sy + r < 0 || sy - r > ch) continue;
            const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
            g.addColorStop(0, `rgba(${l.c},${(0.3 * l.a).toFixed(3)})`);
            g.addColorStop(1, `rgba(${l.c},0)`);
            ctx.fillStyle = g;
            ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
        }
        ctx.restore();
    }

    function draw() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#f3d58a";
        ctx.fillRect(0, 0, cw, ch);
        if (!bake) return;      // the paintings are still arriving

        const vx0 = cam.x - anchorX / s - 40, vx1 = cam.x + (cw - anchorX) / s + 40;
        const vy0 = cam.y - anchorY / s - 40, vy1 = cam.y + (ch - anchorY) / s + 40;

        ctx.save();
        ctx.translate(anchorX, anchorY);
        ctx.scale(s, s);
        ctx.translate(-cam.x - shake.x, -cam.y - shake.y);

        // the world behind: sky, drifting islands, far hills, the armies on the march
        drawBackground(ctx, time, vx0, vx1, vy0, vy1, cam.x, cam.y);
        drawWaterfall(ctx, time);
        drawRiver(ctx, time, vx0, vx1);
        drawPool(ctx, time);

        ctx.drawImage(bake.canvas, bake.x, bake.y, bake.w, bake.h);

        // outside, on the island
        drawAnts(ctx, time);
        drawPoolFall(ctx, time);

        // his reflection in the glass panes of the basement floor, then the glass itself
        if (Math.abs(npc.y - F1) < 6) {
            ctx.save();
            ctx.beginPath();
            for (const [a, b] of LAYOUT.panes) ctx.rect(a, F1 + 2, b - a, 56);
            ctx.clip();
            ctx.globalAlpha = 0.3;
            ctx.translate(npc.x, 2 * F1 - npc.y + 6);
            ctx.scale(npc.faceVis, -1);
            drawNpc(ctx, npc, cur, world, time, true);
            ctx.restore();
        }
        drawPanes(ctx, time);
        drawShutters(ctx, world.lift);
        drawLift(ctx, world.lift, time);

        // props that move
        drawRackSwords(ctx, world);
        drawSlotBooks(ctx, i => lib.presence[i]);
        drawPanel(ctx, world.panel);
        drawFountain(ctx, time);
        drawFurnaceFire(ctx, world, time);
        drawBellows(ctx, world.bell);
        drawAnvilWork(ctx, world);
        drawWater(ctx, world, time);
        drawWheel(ctx, world);
        drawParticles(ctx, "back");
        drawCandleFlame(ctx, time);
        drawLamps(ctx, time);
        drawLibBooks(ctx, false);

        world.workPos = null;
        const w = world.work;
        drawMoldAndIngot(ctx, world);
        if (w.where === "mold") world.workPos = [LAYOUT.mold.x, LAYOUT.mold.y - 10];
        if (w.where === "furnace") world.workPos = [LAYOUT.furnace.mouthX, LAYOUT.furnace.mouthY1 - 34];

        // him
        ctx.save();
        if (manual.swim) {                                    // only what is above the water shows
            ctx.beginPath(); ctx.rect(npc.x - 300, npc.y - 600, 600, 600 + (pool.surface - npc.y)); ctx.clip();
        }
        ctx.translate(npc.x, npc.y);
        ctx.scale(npc.faceVis, 1);
        drawNpc(ctx, npc, cur, world, time, false);
        ctx.restore();

        drawLibBooks(ctx, true);
        drawPoolFront(ctx, time, poolAgit);

        if (world.lipM) {
            const pt = world.lipM.transformPoint(new DOMPoint(20, -16));
            world.lip = toWorld(pt.x / dpr, pt.y / dpr);
        }
        if (npc.hold.B && npc.hold.B.type === "tongs" && npc.hold.B.load === "work") {
            const h = npc.handsLocal[1];
            world.workPos = [npc.x + npc.faceVis * (h[0] + 110), npc.y + h[1] + 6];
        } else if (npc.hold.F && npc.hold.F.type === "sword") {
            const h = npc.handsLocal[0];
            world.workPos = [npc.x + npc.faceVis * (h[0] + 60), npc.y + h[1] - 20];
        }

        drawStream(ctx);
        drawShafts(ctx);
        drawParticles(ctx, "front");
        ctx.restore();

        drawGlows();

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "soft-light";
        ctx.fillStyle = "rgba(255,214,150,0.12)";                       // a warm ink grade
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = paperPat;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        // ornate drapes and lanterns frame the free area
        const csize = clamp(Math.min(frameNow.x1 - frameNow.x0, ch) * 0.34, 110, 300);
        drawCurtains(ctx, 0, frameNow.x1, csize, time);

        if (markerEl) {
            const hl = npc.headLocal;
            const [sx, sy] = toScreen(npc.x + npc.faceVis * hl[0], npc.y + hl[1] - 56 / s);
            markerEl.style.transform = `translate(${(sx - 22).toFixed(1)}px, ${(sy - 22).toFixed(1)}px)`;
        }
    }

    // ------------------------------------------------------------------ loop

    let raf = 0, last = 0, running = true;

    function frame(now) {
        raf = requestAnimationFrame(frame);
        if (!running) return;
        const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
        last = now;
        time += dt;
        layout(dt);
        step(dt);
        draw();
    }

    function onVisibility() { last = 0; running = !document.hidden; }
    document.addEventListener("visibilitychange", onVisibility);

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("resize", resize);
    layout(0.016);
    raf = requestAnimationFrame(frame);

    // ----------------------------------------------------------------- input

    function npcHit(wx, wy) {
        return Math.abs(wx - (npc.x + npc.faceVis * 10)) < 52 && wy > npc.y - 260 && wy < npc.y + 6;
    }

    canvas.addEventListener("pointermove", e => {
        const r = canvas.getBoundingClientRect();
        const [wx, wy] = toWorld(e.clientX - r.left, e.clientY - r.top);
        canvas.style.cursor = npcHit(wx, wy) ? "pointer" : (!talking && targetAt(wx, wy)) ? "crosshair" : "default";
    });
    canvas.addEventListener("click", e => {
        const r = canvas.getBoundingClientRect();
        const [wx, wy] = toWorld(e.clientX - r.left, e.clientY - r.top);
        if (npcHit(wx, wy)) { onNpcClick && onNpcClick(); return; }
        clickWorld(wx, wy);
    });
    /** Walk (or climb, or jump, or swim) to a point in the world, as if you had clicked it. */
    function clickWorld(wx, wy) {
        if (talking) return;
        const t = targetAt(wx, wy);
        if (!t) return;
        takeControl();
        clearInput();
        nav = { gen: navTo(t) };
        nav.gen.next();
    }

    const KEYMAP = {
        ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
        Space: "jump", AltLeft: "jump", AltRight: "jump", KeyZ: "jump"
    };
    function onKeyDown(e) {
        const act = KEYMAP[e.code];
        if (!act || talking || e.ctrlKey || e.metaKey) return;
        const tag = (e.target && e.target.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
        e.preventDefault();
        if (nav) { nav = null; clearInput(); }
        takeControl();
        input[act] = true;
        if (!e.repeat) { if (act === "jump") input.jumpP = true; if (act === "up") input.upP = true; if (act === "down") input.downP = true; }
    }
    function onKeyUp(e) {
        const act = KEYMAP[e.code];
        if (!act) return;
        input[act] = false;
        lastInput = time;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return {
        goTo(job) { if (JOBS[job]) startJob(job); },
        setTalking(v) { talking = !!v; if (!v) lastInput = time; },
        isManual: () => mode === "manual",
        clickWorld,
        debug: () => ({ x: Math.round(npc.x), y: Math.round(npc.y), level: npc.level, mode, ground: manual.ground, swim: manual.swim, lift: Math.round(world.lift.y), nav: !!nav }),
        setSpeaking(v) { npc.speaking = !!v; },
        forged: () => forged,
        dispose() {
            cancelAnimationFrame(raf);
            ro.disconnect();
            window.removeEventListener("resize", resize);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            document.removeEventListener("visibilitychange", onVisibility);
        }
    };
}
