// The atelier: an oasis masjid courtyard at first light, and the scholar who lives in it.
//
// Everything here is generated from Three.js primitives -- no .glb, no textures
// to host, nothing to 404 on GitHub Pages. The trade is that shapes stay simple
// and stylised, which suits the toon shading anyway.
//
// The scene owns the NPC's *body* (where he walks, what he does with his hands).
// It owns none of the knowledge state: app.js tells it where to send him and
// which marker to float, and the scene reports back what he's visibly doing.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

// ------------------------------------------------------------------- palette

const C = {
    sand:      0xe4c9a0,
    sandDark:  0xd0ae82,
    stone:     0xf2e6d2,
    stoneWarm: 0xe6d2b4,
    shadowSt:  0xcbb494,
    dome:      0x69a894,
    domeDark:  0x4d8577,
    trim:      0xc9a24a,
    water:     0x6fc7dd,
    palmTrunk: 0x9a7a52,
    palmLeaf:  0x4f8f5c,
    robe:      0xf6f1e4,
    bisht:     0x2f6b4f,
    turban:    0xf7f4ea,
    skin:      0xe3b98f,
    beard:     0x4a3b33,
    rug:       0x2e6f57,
    rugTrim:   0xc9a24a,
    wood:      0x8a5f3c
};

const STATION_DEFS = {
    kutub:   { stand: [-6.0, -4.6], look: [-6.9, -6.4], pose: "read"  },
    musalla: { stand: [ 0.0, -5.6], look: [ 0.0, -9.9], pose: "dhikr" },
    maktab:  { stand: [ 6.0, -3.9], look: [ 6.9, -5.6], pose: "write" },
    sabil:   { stand: [ 1.9,  2.4], look: [ 0.0,  3.0], pose: "rest"  }
};

const STATION_ORDER = ["kutub", "musalla", "maktab", "sabil"];

// --------------------------------------------------------------- small helpers

/** Four-band ramp so MeshToonMaterial reads as cel shading rather than mush. */
function toonRamp() {
    const canvas = document.createElement("canvas");
    canvas.width = 4; canvas.height = 1;
    const ctx = canvas.getContext("2d");
    ["#5b5148", "#9c8f80", "#d8cbb8", "#ffffff"].forEach((hex, i) => {
        ctx.fillStyle = hex;
        ctx.fillRect(i, 0, 1, 1);
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
}

let RAMP = null;
function toon(color, opts) {
    return new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: RAMP }, opts || {}));
}

function mesh(geometry, material, x, y, z) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
}

/** A pointed (two-centred) arch as a closed path, used both as opening and as relief. */
function archPath(x0, x1, springline, apex) {
    const p = new THREE.Path();
    const xc = (x0 + x1) / 2;
    const shoulder = springline + (apex - springline) * 0.62;
    p.moveTo(x0, 0);
    p.lineTo(x0, springline);
    p.quadraticCurveTo(x0, shoulder, xc, apex);
    p.quadraticCurveTo(x1, shoulder, x1, springline);
    p.lineTo(x1, 0);
    p.lineTo(x0, 0);
    return p;
}

/** A wall panel of `bays` pointed arches, extruded to `depth`. */
function arcadeWall(width, height, bays, depth, material) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2, height);
    shape.lineTo(-width / 2, height);
    shape.lineTo(-width / 2, 0);

    const bayWidth = width / bays;
    const openW = bayWidth * 0.62;
    for (let i = 0; i < bays; i++) {
        const centre = -width / 2 + bayWidth * (i + 0.5);
        shape.holes.push(archPath(centre - openW / 2, centre + openW / 2, height * 0.42, height * 0.86));
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
    geo.translate(0, 0, -depth / 2);
    return new THREE.Mesh(geo, material);
}

// ------------------------------------------------------------------- the face

/**
 * The anime face is drawn to a canvas and mapped onto a patch of the head sphere,
 * so it curves with the skull instead of floating as a billboard. Eyes are drawn
 * open; blinking swaps in a closed variant.
 */
function faceTexture(closed) {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const g = canvas.getContext("2d");
    g.clearRect(0, 0, size, size);

    const eye = (cx, cy, flip) => {
        g.save();
        g.translate(cx, cy);
        if (flip) g.scale(-1, 1);
        if (closed) {
            g.strokeStyle = "#3a2c26";
            g.lineWidth = 7;
            g.lineCap = "round";
            g.beginPath();
            g.moveTo(-22, 0);
            g.quadraticCurveTo(0, 12, 22, -2);
            g.stroke();
        } else {
            // sclera
            g.fillStyle = "#fffdf8";
            g.beginPath();
            g.ellipse(0, 0, 24, 27, 0, 0, Math.PI * 2);
            g.fill();
            // iris
            g.fillStyle = "#3f2a1e";
            g.beginPath();
            g.ellipse(2, 2, 15, 19, 0, 0, Math.PI * 2);
            g.fill();
            // pupil + the two highlights that make it read as "anime"
            g.fillStyle = "#17100b";
            g.beginPath();
            g.ellipse(2, 3, 7, 10, 0, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = "rgba(255,255,255,0.95)";
            g.beginPath();
            g.ellipse(-5, -7, 6, 7, 0, 0, Math.PI * 2);
            g.fill();
            g.beginPath();
            g.ellipse(9, 9, 3, 3, 0, 0, Math.PI * 2);
            g.fill();
            // upper lash line
            g.strokeStyle = "#2b1f19";
            g.lineWidth = 6;
            g.lineCap = "round";
            g.beginPath();
            g.moveTo(-24, -12);
            g.quadraticCurveTo(0, -30, 24, -14);
            g.stroke();
        }
        g.restore();
    };

    eye(84, 120, false);
    eye(172, 120, true);

    // brows
    g.strokeStyle = "#4a3b33";
    g.lineWidth = 8;
    g.lineCap = "round";
    [[56, 78, 84, 66, 112, 76], [200, 78, 172, 66, 144, 76]].forEach(b => {
        g.beginPath();
        g.moveTo(b[0], b[1]);
        g.quadraticCurveTo(b[2], b[3], b[4], b[5]);
        g.stroke();
    });

    // nose, then a small closed smile
    g.strokeStyle = "rgba(120,84,60,0.55)";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(128, 150);
    g.lineTo(122, 168);
    g.stroke();

    g.strokeStyle = "#6b4636";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(110, 190);
    g.quadraticCurveTo(128, 200, 146, 190);
    g.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// ------------------------------------------------------------------ the world

function buildSky(scene) {
    const geo = new THREE.SphereGeometry(300, 32, 20);
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
            zenith:  { value: new THREE.Color(0x3f86c4) },
            middle:  { value: new THREE.Color(0xbfd9e8) },
            horizon: { value: new THREE.Color(0xffdba6) },
            glow:    { value: new THREE.Color(0xffc978) }
        },
        vertexShader: `
            varying vec3 vPos;
            void main() {
                vPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: `
            uniform vec3 zenith, middle, horizon, glow;
            varying vec3 vPos;
            void main() {
                vec3 dir = normalize(vPos);
                float h = clamp(dir.y * 1.15 + 0.06, 0.0, 1.0);
                vec3 col = mix(horizon, middle, smoothstep(0.0, 0.34, h));
                col = mix(col, zenith, smoothstep(0.3, 0.95, h));
                // the sun's bloom, low and to the left -- the barakah of the morning
                float sun = max(dot(dir, normalize(vec3(-0.95, 0.28, -0.12))), 0.0);
                col += glow * pow(sun, 9.0) * 0.85;
                col += glow * pow(sun, 60.0) * 1.6;
                gl_FragColor = vec4(col, 1.0);
            }`
    });
    scene.add(new THREE.Mesh(geo, mat));
}

function buildGround(scene) {
    // Dunes: a big plane pushed around by layered sines so the horizon isn't a ruler line.
    const geo = new THREE.PlaneGeometry(420, 420, 60, 60);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const d = Math.hypot(x, y);
        const rise = Math.max(0, d - 26) * 0.045;
        pos.setZ(i, (Math.sin(x * 0.06) * 1.4 + Math.cos(y * 0.045) * 1.7) * rise * 0.35 + rise);
    }
    geo.computeVertexNormals();
    const sand = mesh(geo, toon(C.sand), 0, -0.05, 0);
    sand.rotation.x = -Math.PI / 2;
    sand.receiveShadow = true;
    scene.add(sand);

    // Courtyard slab.
    const slab = mesh(new THREE.BoxGeometry(26, 0.5, 22), toon(C.stone), 0, 0.25, -3);
    slab.receiveShadow = true;
    scene.add(slab);

    const border = mesh(new THREE.BoxGeometry(26.8, 0.32, 22.8), toon(C.stoneWarm), 0, 0.16, -3);
    border.receiveShadow = true;
    scene.add(border);

    // A few inlaid bands so the floor doesn't read as one flat rectangle.
    const bandMat = toon(C.trim);
    [-9, -3, 3].forEach(z => {
        const band = mesh(new THREE.BoxGeometry(24, 0.04, 0.35), bandMat, 0, 0.51, z);
        scene.add(band);
    });

    // Steps down to the sand at the front edge.
    for (let i = 0; i < 3; i++) {
        const step = mesh(new THREE.BoxGeometry(10 - i * 0.6, 0.16, 0.9), toon(C.stoneWarm),
            0, 0.42 - i * 0.16, 8.4 + i * 0.9);
        step.receiveShadow = true;
        scene.add(step);
    }
}

function buildMasjid(scene) {
    const wall = toon(C.stone);
    const wallWarm = toon(C.stoneWarm);
    const group = new THREE.Group();

    // Prayer hall block, set behind the arcade.
    const hall = mesh(new THREE.BoxGeometry(20, 7, 9), wall, 0, 3.5, -16);
    hall.castShadow = hall.receiveShadow = true;
    group.add(hall);

    // The arcade the courtyard faces (qiblah side).
    const arcade = arcadeWall(20, 6.4, 5, 1.1, wallWarm);
    arcade.position.set(0, 0.5, -11);
    arcade.castShadow = arcade.receiveShadow = true;
    group.add(arcade);

    // Side arcades, shorter, turned to face in.
    [-1, 1].forEach(side => {
        const wing = arcadeWall(13, 5.2, 4, 1.0, wallWarm);
        wing.rotation.y = Math.PI / 2;
        wing.position.set(side * 11.5, 0.5, -5.5);
        wing.castShadow = wing.receiveShadow = true;
        group.add(wing);
    });

    // Main dome on its drum.
    const drum = mesh(new THREE.CylinderGeometry(3.3, 3.5, 1.5, 24), wall, 0, 7.6, -16);
    drum.castShadow = true;
    group.add(drum);

    const domeGeo = new THREE.SphereGeometry(3.4, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.56);
    const dome = mesh(domeGeo, toon(C.dome), 0, 8.2, -16);
    dome.castShadow = true;
    group.add(dome);

    const finialStem = mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 8), toon(C.trim), 0, 10.4, -16);
    group.add(finialStem);
    group.add(mesh(new THREE.SphereGeometry(0.26, 12, 10), toon(C.trim), 0, 10.0, -16));
    // Crescent, as two overlapping discs -- the back one carved out by the sky colour.
    const crescent = new THREE.Group();
    crescent.add(mesh(new THREE.CircleGeometry(0.42, 20), toon(C.trim), 0, 0, 0));
    const bite = mesh(new THREE.CircleGeometry(0.34, 20), toon(C.dome), 0.2, 0.06, 0.01);
    crescent.add(bite);
    crescent.position.set(0, 11.1, -16);
    group.add(crescent);

    // Small flanking domes over the wings.
    [-7.6, 7.6].forEach(x => {
        const d = mesh(new THREE.SphereGeometry(1.5, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
            toon(C.domeDark), x, 7.0, -16);
        d.castShadow = true;
        group.add(d);
        group.add(mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.7, 16), wall, x, 6.7, -16));
    });

    // Minaret.
    const min = new THREE.Group();
    min.add(mesh(new THREE.CylinderGeometry(0.75, 0.95, 11, 12), wall, 0, 5.5, 0));
    const balcony = mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.45, 12), wallWarm, 0, 8.4, 0);
    min.add(balcony);
    min.add(mesh(new THREE.CylinderGeometry(0.62, 0.68, 2.2, 12), wall, 0, 10.2, 0));
    min.add(mesh(new THREE.ConeGeometry(0.85, 1.5, 12), toon(C.dome), 0, 12.1, 0));
    min.add(mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(C.trim), 0, 12.95, 0));
    min.position.set(-11.5, 0.4, -14.5);
    min.traverse(o => { if (o.isMesh) o.castShadow = true; });
    group.add(min);

    scene.add(group);
}

function buildPalm(x, z, scale, lean) {
    const palm = new THREE.Group();
    const trunkMat = toon(C.palmTrunk);
    let y = 0;
    for (let i = 0; i < 7; i++) {
        const seg = mesh(new THREE.CylinderGeometry(0.16 - i * 0.008, 0.19 - i * 0.008, 0.62, 8),
            trunkMat, Math.sin(i * 0.5) * lean * 0.12, y + 0.31, Math.cos(i * 0.7) * lean * 0.06);
        seg.castShadow = true;
        palm.add(seg);
        y += 0.58;
    }
    const crown = new THREE.Group();
    crown.position.set(Math.sin(3) * lean * 0.12, y, 0);
    const leafMat = toon(C.palmLeaf);
    for (let i = 0; i < 9; i++) {
        const frond = mesh(new THREE.ConeGeometry(0.3, 2.3, 4), leafMat, 0, 0, 0);
        frond.scale.set(1, 1, 0.22);
        frond.rotation.z = Math.PI / 2 - 0.35 - Math.random() * 0.25;
        frond.position.set(1.05, 0.1 - Math.random() * 0.2, 0);
        const arm = new THREE.Group();
        arm.rotation.y = (i / 9) * Math.PI * 2;
        arm.add(frond);
        frond.castShadow = true;
        crown.add(arm);
    }
    // Dates.
    for (let i = 0; i < 3; i++) {
        const cluster = mesh(new THREE.SphereGeometry(0.16, 8, 6), toon(0xb8642f),
            Math.cos(i * 2.1) * 0.5, -0.2, Math.sin(i * 2.1) * 0.5);
        crown.add(cluster);
    }
    palm.add(crown);
    palm.position.set(x, 0, z);
    palm.scale.setScalar(scale);
    return palm;
}

function buildOasis(scene) {
    [[-14, 2, 1.15, 1], [-16.5, -6, 0.95, -1], [14.5, 1, 1.1, -1], [17, -7, 1.0, 1],
     [-10, 9, 0.85, 1], [11, 10, 0.9, -1]].forEach(p => scene.add(buildPalm(p[0], p[1], p[2], p[3])));

    // Shrubs at the sand's edge.
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const r = 19 + Math.sin(i * 3.3) * 4;
        const bush = mesh(new THREE.IcosahedronGeometry(0.55 + Math.random() * 0.3, 0),
            toon(0x6f9b5e), Math.cos(a) * r, 0.2, Math.sin(a) * r - 2);
        bush.castShadow = true;
        scene.add(bush);
    }
}

function buildFountain(scene) {
    const group = new THREE.Group();
    group.position.set(0, 0, 3);

    const basin = mesh(new THREE.CylinderGeometry(2.5, 2.7, 0.7, 24), toon(C.stoneWarm), 0, 0.85, 0);
    basin.castShadow = basin.receiveShadow = true;
    group.add(basin);
    group.add(mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.12, 24), toon(C.stone), 0, 1.16, 0));

    const waterGeo = new THREE.CircleGeometry(2.15, 40, 0, Math.PI * 2);
    const water = mesh(waterGeo, new THREE.MeshPhongMaterial({
        color: C.water, transparent: true, opacity: 0.82, shininess: 90, specular: 0x9fe8ff
    }), 0, 1.2, 0);
    water.rotation.x = -Math.PI / 2;
    group.add(water);

    // Spout column.
    group.add(mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.1, 12), toon(C.stone), 0, 1.7, 0));
    group.add(mesh(new THREE.SphereGeometry(0.3, 14, 10), toon(C.trim), 0, 2.35, 0));

    scene.add(group);
    return water;
}

function buildStations(scene) {
    const props = {};

    // --- kutub: bookshelf and a rihal with an open muṣḥaf -----------------
    const kutub = new THREE.Group();
    kutub.position.set(-6.9, 0.5, -6.6);
    const shelf = mesh(new THREE.BoxGeometry(3.0, 2.6, 0.55), toon(C.wood), 0, 1.3, 0);
    shelf.castShadow = shelf.receiveShadow = true;
    kutub.add(shelf);
    const bookColours = [0x2f6b4f, 0x8c3b3b, 0x2b4a7a, 0xa9762c, 0x4a3b6b, 0x2f6b4f];
    for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 8; i++) {
            const h = 0.42 + Math.random() * 0.16;
            const book = mesh(new THREE.BoxGeometry(0.13 + Math.random() * 0.07, h, 0.42),
                toon(bookColours[(row * 8 + i) % bookColours.length]),
                -1.25 + i * 0.32 + Math.random() * 0.04, 0.42 + row * 0.78 + h / 2, 0.1);
            book.rotation.z = Math.random() < 0.12 ? 0.16 : 0;
            kutub.add(book);
        }
    }
    // Rihāl -- the X-frame book rest.
    const rihal = new THREE.Group();
    rihal.position.set(0.9, 0, 1.5);
    [-1, 1].forEach(s => {
        const leg = mesh(new THREE.BoxGeometry(0.08, 1.0, 0.5), toon(C.wood), 0, 0.5, 0);
        leg.rotation.z = s * 0.42;
        rihal.add(leg);
    });
    const openBook = new THREE.Group();
    openBook.position.set(0, 0.98, 0);
    [-1, 1].forEach(s => {
        const leaf = mesh(new THREE.BoxGeometry(0.42, 0.04, 0.56), toon(0xfdf8ec), s * 0.22, 0, 0);
        leaf.rotation.z = -s * 0.24;
        openBook.add(leaf);
    });
    rihal.add(openBook);
    rihal.traverse(o => { if (o.isMesh) o.castShadow = true; });
    kutub.add(rihal);
    scene.add(kutub);

    // --- musalla: the prayer rug, facing the arcade ------------------------
    const musalla = new THREE.Group();
    musalla.position.set(0, 0.51, -6.4);
    const rug = mesh(new THREE.BoxGeometry(1.9, 0.05, 3.1), toon(C.rug), 0, 0.03, 0);
    rug.receiveShadow = true;
    musalla.add(rug);
    musalla.add(mesh(new THREE.BoxGeometry(2.06, 0.03, 3.26), toon(C.rugTrim), 0, 0.015, 0));
    // The woven miḥrāb arch at the head of the rug.
    const archShape = new THREE.Shape();
    archShape.moveTo(-0.42, 0);
    archShape.lineTo(0.42, 0);
    archShape.lineTo(0.42, 0.4);
    archShape.quadraticCurveTo(0.42, 0.78, 0, 0.95);
    archShape.quadraticCurveTo(-0.42, 0.78, -0.42, 0.4);
    archShape.lineTo(-0.42, 0);
    const archMotif = mesh(new THREE.ShapeGeometry(archShape), toon(C.rugTrim), 0, 0.06, -0.9);
    archMotif.rotation.x = -Math.PI / 2;
    musalla.add(archMotif);
    scene.add(musalla);

    // --- maktab: low desk, scroll, inkpot ---------------------------------
    const maktab = new THREE.Group();
    maktab.position.set(6.9, 0.5, -5.7);
    const top = mesh(new THREE.BoxGeometry(2.3, 0.12, 1.2), toon(C.wood), 0, 0.62, 0);
    top.castShadow = top.receiveShadow = true;
    maktab.add(top);
    [[-1.0, -0.45], [1.0, -0.45], [-1.0, 0.45], [1.0, 0.45]].forEach(p => {
        maktab.add(mesh(new THREE.BoxGeometry(0.1, 0.62, 0.1), toon(0x6d4a2e), p[0], 0.31, p[1]));
    });
    const scroll = mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.0, 12), toon(0xfaf3e2), -0.5, 0.74, 0.1);
    scroll.rotation.z = Math.PI / 2;
    maktab.add(scroll);
    maktab.add(mesh(new THREE.BoxGeometry(0.7, 0.02, 0.5), toon(0xfdf8ec), 0.35, 0.69, 0.05));
    maktab.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 10), toon(0x2b2b33), 0.95, 0.76, -0.3));
    maktab.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(maktab);

    // A hanging lantern for warmth in the corner.
    const lantern = new THREE.Group();
    lantern.position.set(-3.4, 3.6, -10.2);
    lantern.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), toon(0x4a4038), 0, 0.8, 0));
    const glass = mesh(new THREE.OctahedronGeometry(0.34, 0), new THREE.MeshBasicMaterial({
        color: 0xffd68a, transparent: true, opacity: 0.9
    }), 0, 0, 0);
    lantern.add(glass);
    scene.add(lantern);
    props.lantern = glass;

    return props;
}

function buildDust(scene) {
    const count = 260;
    const positions = new Float32Array(count * 3);
    const drift = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        positions[i * 3]     = (Math.random() - 0.5) * 34;
        positions[i * 3 + 1] = Math.random() * 9 + 0.3;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 4;
        drift[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0xfff0cf, size: 0.075, transparent: true, opacity: 0.75, depthWrite: false
    }));
    scene.add(points);
    return { points, drift, positions };
}

function buildBirds(scene) {
    const flock = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x4a3f38, side: THREE.DoubleSide });
    const birds = [];
    for (let i = 0; i < 5; i++) {
        const shape = new THREE.Shape();
        shape.moveTo(-0.5, 0);
        shape.quadraticCurveTo(-0.22, 0.2, 0, 0.02);
        shape.quadraticCurveTo(0.22, 0.2, 0.5, 0);
        shape.quadraticCurveTo(0.2, 0.06, 0, -0.04);
        shape.quadraticCurveTo(-0.2, 0.06, -0.5, 0);
        const b = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
        b.userData = {
            radius: 26 + i * 3.4,
            speed: 0.055 + i * 0.008,
            phase: i * 1.3,
            height: 17 + i * 1.6
        };
        birds.push(b);
        flock.add(b);
    }
    scene.add(flock);
    return birds;
}

// ---------------------------------------------------------------- the scholar

function buildScholar() {
    const root = new THREE.Group();

    // Robe: a lathe profile from hem to shoulder gives the flare without any rigging.
    const profile = [
        new THREE.Vector2(0.02, 0.00),
        new THREE.Vector2(0.60, 0.02),
        new THREE.Vector2(0.56, 0.16),
        new THREE.Vector2(0.44, 0.52),
        new THREE.Vector2(0.36, 0.86),
        new THREE.Vector2(0.32, 1.06),
        new THREE.Vector2(0.30, 1.18),
        new THREE.Vector2(0.20, 1.26)
    ];
    const robe = mesh(new THREE.LatheGeometry(profile, 22), toon(C.robe), 0, 0, 0);
    robe.castShadow = true;
    root.add(robe);

    // Bisht: the green over-cloak, a second lathe sitting proud of the robe.
    const cloakProfile = [
        new THREE.Vector2(0.47, 0.30),
        new THREE.Vector2(0.42, 0.62),
        new THREE.Vector2(0.36, 0.94),
        new THREE.Vector2(0.335, 1.10),
        new THREE.Vector2(0.315, 1.20)
    ];
    const cloak = mesh(new THREE.LatheGeometry(cloakProfile, 22, 0.55, Math.PI * 1.9), toon(C.bisht), 0, 0, 0);
    cloak.castShadow = true;
    root.add(cloak);

    // Sash.
    const sash = mesh(new THREE.TorusGeometry(0.345, 0.045, 8, 22), toon(C.trim), 0, 0.86, 0);
    sash.rotation.x = Math.PI / 2;
    root.add(sash);

    // Arms, pivoting at the shoulder so a single rotation swings the whole limb.
    const arms = {};
    [["L", 1], ["R", -1]].forEach(([tag, side]) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.29, 1.14, 0);
        const upper = mesh(new THREE.CapsuleGeometry(0.075, 0.34, 4, 8), toon(C.robe), 0, -0.24, 0);
        upper.castShadow = true;
        pivot.add(upper);
        const fore = new THREE.Group();
        fore.position.set(0, -0.46, 0);
        const lower = mesh(new THREE.CapsuleGeometry(0.062, 0.3, 4, 8), toon(C.robe), 0, -0.19, 0);
        lower.castShadow = true;
        fore.add(lower);
        const hand = mesh(new THREE.SphereGeometry(0.075, 10, 8), toon(C.skin), 0, -0.38, 0);
        fore.add(hand);
        pivot.add(fore);
        root.add(pivot);
        arms[tag] = { pivot, fore, hand };
    });

    // Head, on its own pivot so he can look around without turning his body.
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.28, 0);
    const neck = mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.12, 10), toon(C.skin), 0, 0.04, 0);
    headPivot.add(neck);

    const head = mesh(new THREE.SphereGeometry(0.28, 26, 22), toon(C.skin), 0, 0.32, 0);
    head.scale.set(1, 1.06, 0.96);
    head.castShadow = true;
    headPivot.add(head);

    // Face patch, centred on +Z. phi is measured so that pi/2 points down +Z.
    const phiLen = 1.5, thetaStart = 0.72, thetaLen = 1.1;
    const openTex = faceTexture(false);
    const shutTex = faceTexture(true);
    const face = mesh(
        new THREE.SphereGeometry(0.285, 28, 24, Math.PI / 2 - phiLen / 2, phiLen, thetaStart, thetaLen),
        new THREE.MeshBasicMaterial({ map: openTex, transparent: true, depthWrite: false }),
        0, 0.32, 0
    );
    face.scale.set(1, 1.06, 0.96);
    headPivot.add(face);

    // Beard: a shell hugging the jaw, plus a short point below it.
    const beard = mesh(
        new THREE.SphereGeometry(0.295, 22, 18, Math.PI / 2 - 1.5, 3.0, 1.15, 0.72),
        toon(C.beard), 0, 0.32, 0
    );
    beard.scale.set(1, 1.1, 1.0);
    headPivot.add(beard);
    const beardTip = mesh(new THREE.ConeGeometry(0.13, 0.28, 10), toon(C.beard), 0, 0.02, 0.06);
    beardTip.rotation.x = Math.PI;
    headPivot.add(beardTip);

    // Turban: kufi cap, two wraps, and a tail over the shoulder.
    const turban = new THREE.Group();
    turban.position.set(0, 0.44, 0);
    turban.add(mesh(new THREE.SphereGeometry(0.245, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
        toon(C.turban), 0, 0.02, 0));
    const wrapA = mesh(new THREE.TorusGeometry(0.245, 0.078, 10, 24), toon(C.turban), 0, 0.0, 0);
    wrapA.rotation.x = Math.PI / 2;
    turban.add(wrapA);
    const wrapB = mesh(new THREE.TorusGeometry(0.222, 0.068, 10, 24), toon(C.turban), 0, 0.1, 0);
    wrapB.rotation.set(Math.PI / 2, 0, 0.16);
    turban.add(wrapB);
    const tail = mesh(new THREE.BoxGeometry(0.16, 0.5, 0.05), toon(C.turban), -0.2, -0.24, -0.14);
    tail.rotation.z = 0.22;
    turban.add(tail);
    turban.traverse(o => { if (o.isMesh) o.castShadow = true; });
    headPivot.add(turban);

    root.add(headPivot);

    // Props, hidden until a pose calls for one.
    const propAnchor = new THREE.Group();
    propAnchor.position.set(0, 0.86, 0.34);
    const book = new THREE.Group();
    [-1, 1].forEach(s => {
        const leaf = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.4), toon(0xfdf8ec), s * 0.16, 0, 0);
        leaf.rotation.z = -s * 0.22;
        book.add(leaf);
    });
    book.rotation.x = -0.5;
    propAnchor.add(book);

    const pen = mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.34, 6), toon(0x8a5f3c), 0.16, -0.05, 0.06);
    pen.rotation.set(-0.7, 0, -0.5);
    propAnchor.add(pen);

    const cup = new THREE.Group();
    cup.add(mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.11, 10), toon(0xfaf3e2), 0, 0, 0));
    cup.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 10), toon(0x6b4a2a), 0, 0.05, 0));
    cup.position.set(0.16, -0.02, 0.02);
    propAnchor.add(cup);

    // Misbaḥah -- prayer beads, a simple ring of small spheres.
    const beads = new THREE.Group();
    const beadMat = toon(0x3e2f26);
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        beads.add(mesh(new THREE.SphereGeometry(0.022, 6, 5), beadMat,
            Math.cos(a) * 0.09, Math.sin(a) * 0.09 - 0.06, 0));
    }
    beads.position.set(0.14, -0.04, 0.02);
    propAnchor.add(beads);

    root.add(propAnchor);

    return {
        root, arms, headPivot, head, face,
        props: { book, pen, cup, beads },
        faceTextures: { open: openTex, shut: shutTex }
    };
}

// ------------------------------------------------------------------ the scene

export function createAtelier(options) {
    const canvas = options.canvas;
    const markerEl = options.markerEl;
    const onStatus = options.onStatus || function () {};
    const onNpcClick = options.onNpcClick || function () {};

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    } catch (err) {
        console.warn("[atelier] WebGL unavailable:", err);
        return null;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !reduceMotion;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    RAMP = toonRamp();

    const scene = new THREE.Scene();
    // Haze starts past the courtyard, so the masjid stays crisp and only the
    // dunes behind it dissolve into the morning.
    scene.fog = new THREE.Fog(0xf3ddba, 55, 200);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
    camera.position.set(3.2, 4.2, 18);

    // Morning light: low, warm, and from the front-left, so the facade and the
    // scholar's face are lit rather than silhouetted.
    const sun = new THREE.DirectionalLight(0xffe2b0, 2.1);
    sun.position.set(-19, 6.5, 3);
    sun.castShadow = !reduceMotion;
    sun.shadow.mapSize.set(1024, 1024);
    // A low morning sun throws long shadows -- the box has to be wide enough that
    // the minaret's doesn't get clipped off mid-courtyard.
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.camera.far = 85;
    sun.shadow.bias = -0.0016;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xdcefff, 0xd9b184, 1.15));
    const fill = new THREE.DirectionalLight(0xfff0d8, 0.35);
    fill.position.set(9, 6, 12);
    scene.add(fill);

    buildSky(scene);
    buildGround(scene);
    buildMasjid(scene);
    buildOasis(scene);
    const water = buildFountain(scene);
    const stationProps = buildStations(scene);
    const dust = buildDust(scene);
    const birds = buildBirds(scene);

    const scholar = buildScholar();
    scholar.root.position.set(1.9, 0.5, 2.4);
    scene.add(scholar.root);

    const waterBase = water.geometry.attributes.position.array.slice();

    // ------------------------------------------------------------ npc state

    const npc = {
        state: "idle",              // idle | walk | work | alert
        station: "sabil",
        pose: "rest",
        target: new THREE.Vector3(1.9, 0.5, 2.4),
        facing: new THREE.Vector3(0, 0.5, 3),
        stateUntil: 0,
        blinkAt: 1.5,
        blinking: false,
        marker: null,
        interest: null              // station app.js would like him to gravitate to
    };

    function stationPoint(id) {
        const def = STATION_DEFS[id] || STATION_DEFS.sabil;
        return {
            stand: new THREE.Vector3(def.stand[0], 0.5, def.stand[1]),
            look: new THREE.Vector3(def.look[0], 0.5, def.look[1]),
            pose: def.pose
        };
    }

    function announce() {
        onStatus({ state: npc.state, station: npc.station, pose: npc.pose, marker: npc.marker });
    }

    function goTo(stationId, opts) {
        const id = STATION_DEFS[stationId] ? stationId : "sabil";
        const point = stationPoint(id);
        npc.station = id;
        npc.target.copy(point.stand);
        npc.facing.copy(point.look);
        npc.pose = (opts && opts.pose) || point.pose;
        npc.state = "walk";
        announce();
    }

    /** Ambient behaviour: wander somewhere plausible, lingering near what matters. */
    function chooseNext(now) {
        const pool = STATION_ORDER.filter(s => s !== npc.station);
        let pick;
        if (npc.interest && npc.interest !== npc.station && Math.random() < 0.55) {
            pick = npc.interest;
        } else {
            pick = pool[Math.floor(Math.random() * pool.length)];
        }
        goTo(pick);
        npc.stateUntil = now + 8 + Math.random() * 10;
    }

    // ------------------------------------------------------------- animation

    const clock = new THREE.Clock();
    let elapsed = 0;
    let running = true;
    let frame = 0;

    // Camera framing: a slow drift by default, a tighter frame while in dialogue.
    // Both are set from the viewport in frameViewport() below.
    const camHome = new THREE.Vector3(3.2, 4.2, 18);
    const camLookHome = new THREE.Vector3(3.2, 4.6, -6);
    const camTarget = camHome.clone();
    const camLook = camLookHome.clone();
    const lookAt = camLookHome.clone();
    let focused = false;
    let menuDocked = true;

    /**
     * The menu is docked over the right quarter of the window on wide screens,
     * so the courtyard is aimed left of centre to sit in the space that is
     * actually visible. On narrow screens the menu is a drawer and the whole
     * width is ours, but the stations no longer fit across it -- so the camera
     * pulls back instead of widening into a fisheye.
     */
    function frameViewport(aspect) {
        menuDocked = window.innerWidth > 900;      // matches the CSS breakpoint
        const narrow = aspect < 1.15;
        const shift = menuDocked ? 3.2 : 0;
        camHome.set(shift, narrow ? 4.6 : 4.2, narrow ? 24 : 18);
        camLookHome.set(shift, narrow ? 5.0 : 4.6, -6);
        camera.fov = narrow ? 56 : 40;
    }

    function setFocus(on) {
        focused = !!on;
    }

    function applyPose(dt) {
        const t = elapsed;
        const a = scholar.arms;
        const p = scholar.props;
        const walking = npc.state === "walk";

        // Props visible only for the pose that uses them.
        p.book.visible = !walking && npc.pose === "read";
        p.pen.visible = !walking && npc.pose === "write";
        p.cup.visible = !walking && npc.pose === "rest";
        p.beads.visible = !walking && npc.pose === "dhikr";

        let bodyY = 0.5, lean = 0, headNod = 0, headTurn = 0;
        let armLx = 0, armRx = 0, foreL = -0.35, foreR = -0.35, armSpread = 0.12;

        if (walking) {
            const swing = Math.sin(t * 6.2) * 0.5;
            armLx = swing;
            armRx = -swing;
            foreL = foreR = -0.5;
            bodyY = 0.5 + Math.abs(Math.sin(t * 6.2)) * 0.045;
            lean = 0.05;
            headNod = Math.sin(t * 6.2 + 1) * 0.03;
        } else if (npc.pose === "read") {
            bodyY = 0.5 - 0.34;                       // seated at the rihāl
            lean = 0.16;
            armLx = -1.15; armRx = -1.15;
            foreL = foreR = -0.95;
            armSpread = 0.3;
            headNod = 0.34 + Math.sin(t * 0.7) * 0.05;
            headTurn = Math.sin(t * 0.32) * 0.12;     // eyes tracking the line
        } else if (npc.pose === "write") {
            bodyY = 0.5 - 0.3;
            lean = 0.22;
            armLx = -1.0; armRx = -1.25 + Math.sin(t * 3.4) * 0.06;
            foreL = -0.9; foreR = -1.0 + Math.cos(t * 3.4) * 0.09;
            armSpread = 0.26;
            headNod = 0.4;
        } else if (npc.pose === "dhikr") {
            bodyY = 0.5 - 0.36;                       // seated on the rug
            armLx = -1.25; armRx = -1.25;
            foreL = foreR = -1.05;
            armSpread = 0.22;
            headNod = 0.2 + Math.sin(t * 0.5) * 0.06;
        } else if (npc.pose === "think") {
            armRx = -1.5; foreR = -1.5;               // hand to the beard
            armLx = -0.1;
            headNod = -0.12 + Math.sin(t * 0.6) * 0.05;
            headTurn = 0.22;
        } else {                                       // rest, by the fountain
            armLx = -0.2 + Math.sin(t * 0.8) * 0.05;
            armRx = -0.95;
            foreR = -0.8;
            headTurn = Math.sin(t * 0.34) * 0.4;
            headNod = Math.sin(t * 0.5) * 0.05;
            bodyY = 0.5 + Math.sin(t * 1.1) * 0.012;   // breathing
        }

        if (npc.state === "alert") {
            // Standing, attentive, turned out toward the visitor.
            headNod = -0.08 + Math.sin(t * 2.2) * 0.03;
        }

        const k = reduceMotion ? 1 : Math.min(1, dt * 7);
        scholar.root.position.y += (bodyY - scholar.root.position.y) * k;
        scholar.root.rotation.x += (lean - scholar.root.rotation.x) * k;
        a.L.pivot.rotation.x += (armLx - a.L.pivot.rotation.x) * k;
        a.R.pivot.rotation.x += (armRx - a.R.pivot.rotation.x) * k;
        a.L.pivot.rotation.z += (-armSpread - a.L.pivot.rotation.z) * k;
        a.R.pivot.rotation.z += (armSpread - a.R.pivot.rotation.z) * k;
        a.L.fore.rotation.x += (foreL - a.L.fore.rotation.x) * k;
        a.R.fore.rotation.x += (foreR - a.R.fore.rotation.x) * k;
        scholar.headPivot.rotation.x += (headNod - scholar.headPivot.rotation.x) * k;
        scholar.headPivot.rotation.y += (headTurn - scholar.headPivot.rotation.y) * k;

        // Blink.
        if (!reduceMotion) {
            if (!npc.blinking && elapsed > npc.blinkAt) {
                npc.blinking = true;
                scholar.face.material.map = scholar.faceTextures.shut;
                scholar.face.material.needsUpdate = true;
                npc.blinkAt = elapsed + 0.12;
            } else if (npc.blinking && elapsed > npc.blinkAt) {
                npc.blinking = false;
                scholar.face.material.map = scholar.faceTextures.open;
                scholar.face.material.needsUpdate = true;
                npc.blinkAt = elapsed + 2.4 + Math.random() * 3.6;
            }
        }
    }

    function stepNpc(dt) {
        if (npc.state === "walk") {
            const here = scholar.root.position;
            const dx = npc.target.x - here.x;
            const dz = npc.target.z - here.z;
            const dist = Math.hypot(dx, dz);
            if (dist < 0.08) {
                npc.state = npc.marker ? "alert" : "work";
                npc.stateUntil = elapsed + 10 + Math.random() * 12;
                announce();
            } else {
                const speed = 1.45 * dt;
                here.x += (dx / dist) * Math.min(speed, dist);
                here.z += (dz / dist) * Math.min(speed, dist);
                const want = Math.atan2(dx, dz);
                let diff = want - scholar.root.rotation.y;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                scholar.root.rotation.y += diff * Math.min(1, dt * 6);
            }
        } else {
            // Settle to the station's facing.
            const dx = npc.facing.x - scholar.root.position.x;
            const dz = npc.facing.z - scholar.root.position.z;
            const want = Math.atan2(dx, dz);
            let diff = want - scholar.root.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            scholar.root.rotation.y += diff * Math.min(1, dt * 3);

            // When he has something to say he stands and faces out, waiting.
            if (npc.state !== "alert" && !focused && elapsed > npc.stateUntil) {
                chooseNext(elapsed);
            }
        }

        if (npc.state === "alert") {
            // Face the visitor rather than the furniture.
            const want = Math.atan2(camera.position.x - scholar.root.position.x,
                                    camera.position.z - scholar.root.position.z);
            let diff = want - scholar.root.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            scholar.root.rotation.y += diff * Math.min(1, dt * 2.5);
        }
    }

    const projected = new THREE.Vector3();
    // Cached in resize(): reading getBoundingClientRect() inside the frame loop
    // (and on every pointermove) forces a layout each time.
    let canvasBox = { left: 0, top: 0, width: 0, height: 0 };

    function positionMarker() {
        if (!markerEl) return;
        if (!npc.marker) {
            markerEl.style.opacity = "0";
            markerEl.style.pointerEvents = "none";
            return;
        }
        projected.set(scholar.root.position.x, scholar.root.position.y + 2.05, scholar.root.position.z);
        projected.project(camera);
        const x = (projected.x * 0.5 + 0.5) * canvasBox.width;
        const y = (-projected.y * 0.5 + 0.5) * canvasBox.height;
        const onScreen = projected.z < 1 && x > -60 && x < canvasBox.width + 60;
        markerEl.style.opacity = onScreen ? "1" : "0";
        markerEl.style.pointerEvents = onScreen ? "auto" : "none";
        markerEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }

    function animateWorld(dt) {
        // Fountain ripples.
        const pos = water.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = waterBase[i * 3], y = waterBase[i * 3 + 1];
            pos.setZ(i, Math.sin(x * 2.2 + elapsed * 1.7) * 0.02 + Math.cos(y * 2.6 + elapsed * 1.3) * 0.02);
        }
        pos.needsUpdate = true;

        // Dust motes rising through the light.
        const dp = dust.positions;
        for (let i = 0; i < dust.drift.length; i++) {
            dp[i * 3 + 1] += dt * (0.09 + (i % 5) * 0.012);
            dp[i * 3] += Math.sin(elapsed * 0.4 + dust.drift[i]) * dt * 0.14;
            if (dp[i * 3 + 1] > 10) dp[i * 3 + 1] = 0.2;
        }
        dust.points.geometry.attributes.position.needsUpdate = true;

        // Birds on lazy circuits.
        birds.forEach(b => {
            const d = b.userData;
            const a = elapsed * d.speed + d.phase;
            b.position.set(Math.cos(a) * d.radius, d.height + Math.sin(a * 2.1) * 1.4, Math.sin(a) * d.radius - 10);
            b.rotation.set(-Math.PI / 2 + 0.35, 0, -a + Math.PI / 2);
            b.scale.setScalar(1 + Math.sin(elapsed * 6 + d.phase) * 0.14);
        });

        if (stationProps.lantern) {
            stationProps.lantern.material.opacity = 0.75 + Math.sin(elapsed * 3.1) * 0.12;
        }
    }

    const focusDir = new THREE.Vector3();
    const focusRight = new THREE.Vector3();

    function updateCamera(dt) {
        if (focused) {
            // Close in along the line we were already viewing from, so it reads as
            // a zoom rather than a cut to a new angle...
            const p = scholar.root.position;
            focusDir.subVectors(camHome, p).setY(0).normalize();
            camTarget.copy(p).addScaledVector(focusDir, 5.4);
            camTarget.y = p.y + 2.4;
            // ...then aim low and to his right, which pushes him up and to the
            // left of frame, clear of the dialogue box sitting at the bottom.
            focusRight.set(focusDir.z, 0, -focusDir.x);
            camLook.copy(p);
            camLook.y = p.y + 0.95;
            if (menuDocked) camLook.addScaledVector(focusRight, 1.35);
        } else {
            const sway = reduceMotion ? 0 : 1;
            camTarget.set(
                camHome.x + Math.sin(elapsed * 0.11) * 0.9 * sway,
                camHome.y + Math.sin(elapsed * 0.17) * 0.26 * sway,
                camHome.z + Math.cos(elapsed * 0.09) * 0.6 * sway
            );
            camLook.copy(camLookHome);
        }
        const k = Math.min(1, dt * (focused ? 2.4 : 1.1));
        camera.position.lerp(camTarget, k);
        lookAt.lerp(camLook, k);
        camera.lookAt(lookAt);
    }

    /** Advance the world by `dt` and draw it once. */
    function renderFrame(dt) {
        const step = Math.min(dt == null ? clock.getDelta() : dt, 0.05);
        elapsed += step;
        stepNpc(step);
        applyPose(step);
        animateWorld(step);
        updateCamera(step);
        positionMarker();
        renderer.render(scene, camera);
    }

    function render() {
        if (!running) return;
        frame = requestAnimationFrame(render);
        renderFrame();
    }

    // --------------------------------------------------------------- sizing

    function resize() {
        const w = canvas.clientWidth || window.innerWidth;
        const h = canvas.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false);
        const box = canvas.getBoundingClientRect();
        canvasBox = { left: box.left, top: box.top, width: box.width || w, height: box.height || h };
        camera.aspect = w / Math.max(h, 1);
        frameViewport(camera.aspect);
        camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize);
    // A window resize isn't the only way the canvas changes size -- it can also
    // be laid out at 0x0 (a backgrounded tab on load, a hidden container) and
    // gain its real size later, with no resize event to announce it.
    let sizeWatcher = null;
    if (typeof ResizeObserver !== "undefined") {
        sizeWatcher = new ResizeObserver(() => {
            resize();
            if (!running) renderFrame(0);   // repaint even while the loop is parked
        });
        sizeWatcher.observe(canvas);
    }
    resize();
    // Start already framed rather than gliding in from the default position.
    camera.position.copy(camHome);
    lookAt.copy(camLookHome);

    // ------------------------------------------------------------- pointing

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function hitsScholar(event) {
        pointer.x = ((event.clientX - canvasBox.left) / canvasBox.width) * 2 - 1;
        pointer.y = -((event.clientY - canvasBox.top) / canvasBox.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        return raycaster.intersectObject(scholar.root, true).length > 0;
    }

    canvas.addEventListener("pointerdown", (e) => {
        if (hitsScholar(e)) onNpcClick();
    });
    canvas.addEventListener("pointermove", (e) => {
        canvas.style.cursor = hitsScholar(e) ? "pointer" : "default";
    });

    // Rendering a courtyard nobody is looking at is pure battery burn.
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            running = false;
            cancelAnimationFrame(frame);
        } else if (!running) {
            running = true;
            clock.getDelta();
            render();
        }
    });

    // Draw once up front so the courtyard is there on the very first paint,
    // even if the tab was opened in the background and rAF hasn't run yet.
    renderFrame(0);
    render();
    announce();

    return {
        goTo,
        setFocus,
        renderFrame,
        setInterest(stationId) { npc.interest = stationId; },
        setMarker(kind) {
            npc.marker = kind;
            if (markerEl) {
                markerEl.textContent = kind || "";
                markerEl.dataset.kind = kind === "!" ? "alert" : kind === "?" ? "ask" : "";
                // Faded out is not the same as gone: without this the invisible
                // marker still takes a tab stop and can be triggered by keyboard.
                markerEl.disabled = !kind;
            }
            if (kind && npc.state !== "walk") {
                npc.state = "alert";
            } else if (!kind && npc.state === "alert") {
                npc.state = "work";
                npc.stateUntil = elapsed + 6;
            }
            announce();
        },
        /** Called when the scholar starts pondering something the visitor fed him. */
        ponder(seconds) {
            npc.pose = "think";
            npc.state = "work";
            npc.stateUntil = elapsed + (seconds || 6);
        },
        get station() { return npc.station; },
        dispose() {
            running = false;
            cancelAnimationFrame(frame);
            window.removeEventListener("resize", resize);
            if (sizeWatcher) sizeWatcher.disconnect();
            renderer.dispose();
        }
    };
}
