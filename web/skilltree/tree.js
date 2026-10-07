// The skill tree view: radial SVG of 12 competency regions around the hub,
// keystones on the inner ring, tooltip on hover/focus, evidence panel on click.
// Layout is deterministic — the same file always yields the same picture.

import { build, pathState, euInClass, search, synergiesOf, monthLabel, logReport } from './model.js';
import { drawPortrait } from '../sanctuary/art.js';

const SRC = '../content/my-skills-tree.md';
const NS = 'http://www.w3.org/2000/svg';
const OWNER = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || new URLSearchParams(location.search).has('edit');

const R0 = 230, STEP = 74, SPACING = 66, SECTOR = Math.PI / 6, USABLE = SECTOR * 0.86;
const LABEL_R = 720, VIEW = 820;

const $ = id => document.getElementById(id);
const svg = $('tree'), tip = $('tip'), panel = $('panel');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
};
const pips = rank => '●'.repeat(rank) + '○'.repeat(3 - rank);
const shortName = s => { s = s.replace(/\s*\(.*\)\s*$/, ''); return s.length > 24 ? s.slice(0, 22) + '…' : s; };
const year = m => m == null ? 'present' : Math.floor(m / 12);

let model, cls, pos = new Map(), selected = null, focusSet = null, keystoneOn = null;

// ---------------------------------------------------------------- layout

function layout() {
    pos = new Map();
    model.regions.forEach((region, i) => {
        const mid = -Math.PI / 2 + i * SECTOR;
        const list = [...model.skills.values()].filter(s => s.family === region.code)
            .sort((a, b) => b.rank - a.rank || (a.earned ?? 1e9) - (b.earned ?? 1e9) || a.id.localeCompare(b.id));
        let ring = 0, k = 0;
        while (k < list.length) {
            const r = R0 + ring * STEP;
            const cap = Math.max(1, Math.floor((r * USABLE) / SPACING));
            const row = list.slice(k, k + cap);
            row.forEach((s, j) => {
                const a = mid + (row.length === 1 ? 0 : (j / (row.length - 1) - 0.5) * USABLE * (row.length / cap));
                pos.set(s.id, { x: r * Math.cos(a), y: r * Math.sin(a), region: i });
            });
            k += cap; ring++;
        }
    });
}

// ---------------------------------------------------------------- drawing

function draw() {
    svg.textContent = '';
    const defs = el('defs', {}, svg);
    defs.innerHTML = `
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b"/><feFlood flood-color="#e2bd6a" flood-opacity="0.9"/>
            <feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <clipPath id="hub-clip"><circle r="66"/></clipPath>
        <radialGradient id="sky"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#fffaf0" stop-opacity="0"/></radialGradient>`;
    const world = el('g', { id: 'world' }, svg);
    el('circle', { r: LABEL_R + 40, fill: 'url(#sky)' }, world);

    // Faint constellation texture, seeded so it never moves.
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 140; i++) el('circle', { cx: (rnd() - 0.5) * 1700, cy: (rnd() - 0.5) * 1700, r: rnd() * 1.4 + 0.3, fill: '#b4862f', opacity: 0.25 }, world);

    // Sectors
    const sectors = el('g', {}, world);
    model.regions.forEach((region, i) => {
        const mid = -Math.PI / 2 + i * SECTOR, a0 = mid - SECTOR / 2, a1 = mid + SECTOR / 2;
        const R = LABEL_R - 50, r = 160;
        const p = (rr, a) => `${rr * Math.cos(a)} ${rr * Math.sin(a)}`;
        el('path', {
            d: `M ${p(r, a0)} L ${p(R, a0)} A ${R} ${R} 0 0 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 0 0 ${p(r, a0)} Z`,
            class: 'sector-fill', 'data-code': region.code,
        }, sectors);
        el('line', { x1: r * Math.cos(a0), y1: r * Math.sin(a0), x2: R * Math.cos(a0), y2: R * Math.sin(a0), class: 'sector' }, sectors);
        const lx = LABEL_R * Math.cos(mid), ly = LABEL_R * Math.sin(mid);
        el('text', { x: lx, y: ly - 14, class: 'region-icon' }, sectors).textContent = region.icon;
        el('text', { x: lx, y: ly + 12, class: 'region-label' }, sectors).textContent = region.name.replace(/ and /, ' & ');
    });
    el('circle', { r: LABEL_R - 50, class: 'sector' }, sectors);
    el('circle', { r: 160, class: 'sector' }, sectors);

    // Edges
    const edges = el('g', { id: 'edges' }, world);
    for (const s of model.synergies) {
        const a = pos.get(s.a), b = pos.get(s.b);
        if (!a || !b) continue;
        const cx = (a.x + b.x) * 0.35, cy = (a.y + b.y) * 0.35;  // bow toward the hub
        el('path', {
            d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`, class: 'edge',
            'stroke-width': 0.8 + s.weight * 0.9, 'data-a': s.a, 'data-b': s.b, 'data-w': s.weight,
            display: s.weight >= 2 ? '' : 'none',
        }, edges);
    }

    // Hub: Al-Katib's portrait
    const hub = el('g', {}, world);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 168;
    let href = '';
    try { drawPortrait(cv); href = cv.toDataURL(); } catch { /* portrait is decoration */ }
    if (href) el('image', { href, x: -66, y: -66, width: 132, height: 132, 'clip-path': 'url(#hub-clip)' }, hub);
    el('circle', { r: 66, class: 'hub-ring' }, hub);
    el('title', {}, hub).textContent = model.character.name;

    // Keystones on the inner ring
    model.keystones.forEach((k, i) => {
        const a = -Math.PI / 2 + Math.PI / 4 + i * Math.PI / 2, r = 122;
        const g = el('g', { class: 'keystone', transform: `translate(${r * Math.cos(a)} ${r * Math.sin(a)})`, tabindex: 0, role: 'button', 'aria-label': `Keystone: ${k.name}`, 'data-ks': k.id }, world);
        el('rect', { x: -17, y: -17, width: 34, height: 34, transform: 'rotate(45)' }, g);
        el('text', { 'font-size': 17 }, g).textContent = k.icon;
        g.addEventListener('pointerenter', e => showTip(keystoneTip(k), e));
        g.addEventListener('pointerleave', hideTip);
        g.addEventListener('click', () => toggleKeystone(k));
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleKeystone(k); } });
    });

    // Skill nodes
    const nodes = el('g', { id: 'nodes' }, world);
    for (const sk of model.skills.values()) {
        const p = pos.get(sk.id);
        const r = Math.min(26, 15 + sk.unitCount * 1.3);
        const g = el('g', {
            class: 'node', transform: `translate(${p.x} ${p.y})`, tabindex: 0, role: 'button', 'data-id': sk.id,
            'aria-label': `${sk.name}, rank ${sk.rank} of 3, ${sk.unitCount} evidence units`,
        }, nodes);
        el('circle', { class: 'face', r }, g);
        el('text', { class: 'icon', 'font-size': r * 0.95 }, g).textContent = sk.rank ? sk.icon : '🔒';
        for (let j = 0; j < 3; j++) el('circle', { class: 'pip' + (j < sk.rank ? '' : ' off'), cx: (j - 1) * 7, cy: -r - 6, r: 2.6 }, g);
        el('text', { class: 'name', y: r + 13 }, g).textContent = shortName(sk.name);
        g.addEventListener('pointerenter', e => { showTip(skillTip(sk), e); hot(sk.id); });
        g.addEventListener('pointermove', moveTip);
        g.addEventListener('pointerleave', () => { hideTip(); hot(selected); });
        g.addEventListener('focus', () => { const b = g.getBoundingClientRect(); showTip(skillTip(sk), { clientX: b.right, clientY: b.top }); hot(sk.id); });
        g.addEventListener('blur', () => { hideTip(); hot(selected); });
        g.addEventListener('click', () => { if (!dragged) select(sk.id); });
        g.addEventListener('keydown', e => { if (e.key === 'Enter') select(sk.id); });
    }
    applyView();
    restyle();
}

// Class path, search/keystone focus, dormancy, selection.
function restyle() {
    for (const g of svg.querySelectorAll('.node')) {
        const sk = model.skills.get(g.dataset.id);
        const state = sk.rank ? pathState(sk, cls) : 'base';
        g.classList.toggle('lit', state === 'lit');
        g.classList.toggle('half', state === 'half');
        g.classList.toggle('locked', !sk.rank);
        g.classList.toggle('dormant', sk.status === 'dormant');
        g.classList.toggle('dim', !!focusSet && !focusSet.has(sk.id));
        g.classList.toggle('selected', sk.id === selected);
    }
    for (const f of svg.querySelectorAll('.sector-fill')) {
        f.classList.toggle('lit', cls.primary.includes(f.dataset.code));
        f.classList.toggle('half', cls.secondary.includes(f.dataset.code));
    }
    for (const k of svg.querySelectorAll('.keystone')) k.classList.toggle('on', k.dataset.ks === keystoneOn);
    hot(selected);
}

function hot(id) {
    for (const e of svg.querySelectorAll('.edge')) {
        const on = id && (e.dataset.a === id || e.dataset.b === id);
        e.classList.toggle('hot', !!on);
        e.setAttribute('display', on || +e.dataset.w >= 2 ? '' : 'none');
    }
}

// ---------------------------------------------------------------- tooltip

function rolesLine(sk) {
    const roles = sk.roles.map(p => model.roles[p]).filter(Boolean)
        .sort((a, b) => (a.dates?.start ?? 1e9) - (b.dates?.start ?? 1e9));
    if (!roles.length) return '';
    const names = roles.length > 1 ? `${roles[0].prefix} to ${roles.at(-1).prefix}` : roles[0].prefix;
    if (sk.earned == null) return names;
    const y0 = year(sk.earned), y1 = year(sk.lastActive);
    return `${names} · ${y0 === y1 ? y0 : `${y0} to ${y1}`}`;
}

function topMetrics(sk, n = 3) {
    const units = sk.evidence.map(id => model.eus.get(id))
        .sort((a, b) => (b.dates?.start ?? 1e9) - (a.dates?.start ?? 1e9));
    const out = [];
    for (const eu of units) for (const m of eu.metrics) if (out.length < n) out.push(m);
    return out;
}

function skillTip(sk) {
    const region = model.regions.find(r => r.code === sk.family);
    const syn = synergiesOf(model, sk.id).slice(0, 3).map(s => model.skills.get(s.id)).filter(Boolean);
    const stats = topMetrics(sk);
    return `
        <div class="t-head"><span>${sk.rank ? sk.icon : '🔒'}</span><span>${esc(sk.name)}</span><span class="t-pips">${pips(sk.rank)}</span></div>
        <div class="t-sub">${esc(sk.strength)} · ${esc(region?.name)}${sk.status === 'dormant' ? ' · dormant' : ''}</div>
        ${sk.rank ? `
            ${rolesLine(sk) ? `<div class="t-row"><b>Requires</b> ${esc(rolesLine(sk))}</div>` : ''}
            <div class="t-row"><b>${sk.unitCount}</b> evidence unit${sk.unitCount === 1 ? '' : 's'}</div>
            ${stats.length ? `<div class="t-row">${stats.map(m => `◆ ${esc(m.label ? `${m.label}: ${m.value}` : m.value)}`).join('<br>')}</div>` : ''}
            ${syn.length ? `<div class="t-row"><b>Synergies</b> ${syn.map(s => esc(shortName(s.name))).join(' · ')}</div>` : ''}
        ` : `<div class="t-row empty">No evidence yet</div>`}
        <div class="t-rule">${esc(sk.rule)}</div>`;
}

function keystoneTip(k) {
    return `<div class="t-head"><span>${k.icon}</span><span>${esc(k.name)}</span></div>
        <div class="t-sub">Keystone</div>
        <div class="t-row">${k.members.map(id => esc(model.eus.get(id)?.title || id)).join('<br>')}</div>
        <div class="t-rule">${esc(k.basis)}</div>`;
}

function showTip(html, e) { tip.innerHTML = html; tip.hidden = false; moveTip(e); }
function moveTip(e) {
    const pad = 16, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > innerWidth - 8) x = e.clientX - w - pad;
    if (y + h > innerHeight - 8) y = innerHeight - h - 8;
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${Math.max(8, y)}px`;
}
function hideTip() { tip.hidden = true; }

// ---------------------------------------------------------------- detail panel

function euCard(ids) {
    const units = ids.map(id => model.eus.get(id));
    const lead = units[0];
    const roles = [...new Set(units.flatMap(u => u.role))].map(p => model.roles[p]?.name || p);
    const d = lead.dates;
    const offClass = units.every(u => !euInClass(u, cls));
    return `<article class="card"${offClass ? ' style="opacity:.45"' : ''}>
        <h3>${units.map(u => esc(u.title)).join(' + ')}</h3>
        <div class="meta">${ids.join(', ')} · ${esc(roles.join(', '))}${d ? ` · ${monthLabel(d.start)} to ${monthLabel(d.end)}` : ''}${lead.variantOnly ? ` · ${lead.variantOnly} only` : ''}</div>
        ${units.some(u => u.metrics.length) ? `<div class="chips">${units.flatMap(u => u.metrics).map(m => `<span class="chip">${esc(m.label ? `${m.label}: ${m.value}` : m.value)}</span>`).join('')}</div>` : ''}
        ${units.map(u => `<p>${esc(u.canonical)}</p>`).join('')}
        ${units.filter(u => u.scale).map(u => `<p class="scale">${esc(u.scale)}</p>`).join('')}
        ${OWNER ? units.flatMap(u => u.claimBoundary).map(b => `<div class="boundary">Claim boundary: ${esc(b)}</div>`).join('') : ''}
    </article>`;
}

function select(id) {
    selected = id;
    const sk = model.skills.get(id);
    const seen = new Set(), groups = [];
    for (const eid of sk.evidence) {
        const g = model.groupOf.get(eid);
        if (seen.has(g[0])) continue;
        seen.add(g[0]);
        groups.push(g);
    }
    const start = g => model.eus.get(g[0]).dates?.start ?? 1e9;
    groups.sort((a, b) => start(b) - start(a));
    const region = model.regions.find(r => r.code === sk.family);
    panel.innerHTML = `
        <button class="close" type="button" aria-label="Close">×</button>
        <h2>${sk.rank ? sk.icon : '🔒'} ${esc(sk.name)}</h2>
        <div class="t-sub">${pips(sk.rank)} ${esc(sk.strength)} · ${esc(region?.name)}${rolesLine(sk) ? ` · ${esc(rolesLine(sk))}` : ''}</div>
        <div class="t-rule">${esc(sk.rule)}</div>
        ${groups.length ? groups.map(euCard).join('') : '<p class="empty">No evidence yet</p>'}
        ${sk.evidenceNotes.length ? `<p class="scale">Also: ${esc(sk.evidenceNotes.join('; '))}</p>` : ''}`;
    panel.hidden = false;
    panel.querySelector('.close').addEventListener('click', closePanel);
    restyle();
}

function closePanel() { panel.hidden = true; selected = null; restyle(); }

function showReport() {
    const unassigned = model.unassigned.map(id => model.eus.get(id));
    panel.innerHTML = `
        <button class="close" type="button" aria-label="Close">×</button>
        <h2>Owner report</h2>
        <div class="t-sub">Visible on localhost or with ?edit only.</div>
        <h3>Unassigned evidence (${unassigned.length})</h3>
        ${unassigned.map(u => euCard([u.id])).join('')}
        <h3>Validation (${model.issues.length})</h3>
        <ul class="issues">${model.issues.map(i => `<li>[${esc(i.kind)}] ${esc(i.msg)}</li>`).join('')}</ul>`;
    panel.hidden = false;
    panel.querySelector('.close').addEventListener('click', closePanel);
}

// ---------------------------------------------------------------- controls

function toggleKeystone(k) {
    keystoneOn = keystoneOn === k.id ? null : k.id;
    $('q').value = ''; $('q-count').textContent = '';
    focusSet = keystoneOn ? new Set(k.members.flatMap(id => model.eus.get(id)?.skills || [])) : null;
    restyle();
}

function renderClasses() {
    const box = $('classes');
    box.textContent = '';
    for (const c of model.classes) {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', c === cls);
        b.title = c.headline;
        b.textContent = `${c.icon} ${c.name}`;
        b.addEventListener('click', () => { cls = c; renderClasses(); restyle(); if (selected) select(selected); });
        box.appendChild(b);
    }
}

$('q').addEventListener('input', e => {
    keystoneOn = null;
    focusSet = search(model, e.target.value);
    $('q-count').textContent = focusSet ? String(focusSet.size) : '';
    restyle();
});
addEventListener('keydown', e => { if (e.key === 'Escape') { hideTip(); closePanel(); } });

// ---------------------------------------------------------------- pan & zoom

let view = { x: -VIEW, y: -VIEW, w: VIEW * 2 }, drag = null, dragged = false;
function applyView() {
    const r = svg.getBoundingClientRect();
    const h = view.w * (r.height / Math.max(1, r.width));
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${h}`);
}
function fit() {
    const r = svg.getBoundingClientRect();
    const size = VIEW * 2, aspect = r.width / Math.max(1, r.height);
    view.w = aspect >= 1 ? size * aspect : size;
    const h = view.w / aspect;
    view.x = -view.w / 2; view.y = -h / 2;
    applyView();
}
function zoomAt(factor, cx, cy) {
    const r = svg.getBoundingClientRect();
    const px = view.x + (cx - r.left) / r.width * view.w;
    const py = view.y + (cy - r.top) / r.height * (view.w * r.height / r.width);
    const w = Math.min(VIEW * 6, Math.max(300, view.w * factor));
    const k = w / view.w;
    view.x = px - (px - view.x) * k;
    view.y = py - (py - view.y) * k;
    view.w = w;
    applyView();
}
svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY > 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });
svg.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; dragged = false; });
addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!dragged && Math.hypot(dx, dy) < 4) return;
    dragged = true;
    svg.classList.add('dragging');
    hideTip();
    const s = view.w / svg.getBoundingClientRect().width;
    view.x = drag.vx - dx * s; view.y = drag.vy - dy * s;
    applyView();
});
addEventListener('pointerup', () => { drag = null; svg.classList.remove('dragging'); setTimeout(() => { dragged = false; }); });
for (const b of document.querySelectorAll('[data-zoom]')) b.addEventListener('click', () => {
    const z = +b.dataset.zoom, r = svg.getBoundingClientRect();
    if (!z) fit(); else zoomAt(z > 0 ? 0.8 : 1.25, r.left + r.width / 2, r.top + r.height / 2);
});
addEventListener('resize', applyView);

// ---------------------------------------------------------------- boot

try {
    const res = await fetch(SRC, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    model = build(await res.text());
    logReport(model);
    cls = model.classes[0];
    layout();
    renderClasses();
    draw();
    fit();
    $('status').textContent = `${model.skills.size} skills · ${model.eus.size} evidence units · ${model.mergeGroups.length} merged · ${model.unassigned.length} unassigned`;
    if (OWNER) { $('report-btn').hidden = false; $('report-btn').addEventListener('click', showReport); }
} catch (err) {
    $('status').textContent = location.protocol === 'file:'
        ? 'This page is open via file:// — browsers block reading local files from script for security. Serve the folder over HTTP (any static server, or GitHub Pages) and it will work.'
        : `Could not fetch ${SRC} (${err}).`;
    console.error(err);
}
