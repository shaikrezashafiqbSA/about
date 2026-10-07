// Raw parse → the skill tree's data model, plus everything derived from it
// (ranks, merge groups, synergies, earned dates, attribute scores). Pure data;
// no DOM. Never invents or recomputes a figure: metrics are carried as written.

import { parse, expandEvidence, parseMetrics, parseTreeLinks, EU_ID } from './parse.js';

const RANK = { strong: 3, moderate: 2, weak: 1, advisory: 1, context: 1 };
const splitCodes = s => (s || '').split(',').map(c => c.trim()).filter(Boolean);
const first = (eu, key) => (eu.fields[key] || [])[0]?.value || '';
const all = (eu, key) => (eu.fields[key] || []).map(f => f.value);
const findTable = (raw, name) => raw.tables[name] || { head: [], rows: [] };

// Table rows as objects keyed by lower-cased header.
function rowsOf(table) {
    const keys = table.head.map(h => h.toLowerCase());
    return table.rows.map(r => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}

export function monthLabel(m) {
    if (m == null) return 'present';
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[m % 12]} ${Math.floor(m / 12)}`;
}

// "GIC, Alpha Stone Capital, Call Levels." → ["GIC", "AS", "CL"]
function rolePrefixes(text, names) {
    const out = [];
    for (let part of text.replace(/\.$/, '').split(',')) {
        part = part.trim().toLowerCase();
        if (!part) continue;
        const hit = Object.entries(names).find(([n]) => n === part)
            || Object.entries(names).find(([n]) => n.startsWith(part) || part.startsWith(n));
        if (hit) out.push(hit[1]);
    }
    return [...new Set(out)];
}

export function build(source) {
    const raw = parse(source);
    const issues = [...raw.issues];
    const report = (kind, msg) => issues.push({ kind, msg });

    // ---- taxonomy, roles ---------------------------------------------------
    const taxonomy = rowsOf(findTable(raw, 'Competency taxonomy')).map(r => ({
        code: r.code, name: r.competency,
        vocabulary: (r['typical jd vocabulary that maps here'] || '').split(',').map(s => s.trim()).filter(Boolean),
    }));
    const regionIcons = Object.fromEntries(rowsOf(findTable(raw, 'Region icons')).map(r => [r.code, r.icon]));
    const regions = taxonomy.map(t => ({ ...t, icon: regionIcons[t.code] || '◆' }));
    const codes = new Set(regions.map(r => r.code));

    const roles = {};
    const prefixToName = Object.fromEntries(Object.entries(raw.prefixNames).map(([n, p]) => [p, n]));
    for (const s of raw.sections) {
        if (!s.prefix || roles[s.prefix]) continue;
        roles[s.prefix] = { prefix: s.prefix, name: s.role || s.name, dates: s.dates, section: s };
    }
    for (const [p, n] of Object.entries(prefixToName)) roles[p] ||= { prefix: p, name: n, dates: null };

    // ---- evidence units ----------------------------------------------------
    const eus = new Map();
    for (const r of raw.eus) {
        if (eus.has(r.id)) { report('duplicate', `Duplicate EU ID ${r.id} (line ${r.line + 1})`); continue; }
        const prefix = r.id.split('-')[1];
        const roleList = r.fields.roles ? rolePrefixes(first(r, 'roles'), raw.prefixNames) : [prefix];
        const spans = roleList.map(p => roles[p]?.dates).filter(Boolean);
        const dates = spans.length
            ? { start: Math.min(...spans.map(d => d.start)), end: spans.some(d => d.end == null) ? null : Math.max(...spans.map(d => d.end)) }
            : null;
        const tags = splitCodes(first(r, 'tags'));
        for (const t of tags) if (!codes.has(t)) report('tag', `${r.id}: tag ${t} is not in the taxonomy`);
        const known = new Set(['tags', 'roles', 'scale and tools', 'metrics', 'canonical', 'claim boundary', 'relationship', 'tree links', 'interview notes', 'tailoring note', 'variants', 'wording variant', 'positioning note']);
        eus.set(r.id, {
            id: r.id, prefix, title: r.title, variantOnly: r.variantOnly, line: r.line,
            role: roleList, dates, tags,
            scale: first(r, 'scale and tools'),
            metrics: r.fields.metrics ? parseMetrics(first(r, 'metrics')) : [],
            canonical: first(r, 'canonical'),
            claimBoundary: all(r, 'claim boundary'),
            relationship: first(r, 'relationship'),
            links: r.fields['tree links'] ? parseTreeLinks(first(r, 'tree links')) : { merge: [], link: [] },
            extra: Object.fromEntries(Object.entries(r.fields).filter(([k]) => !known.has(k)).map(([k, v]) => [k, v.map(f => f.value)])),
            skills: [],
        });
    }
    const euIds = [...eus.keys()];

    for (const eu of eus.values()) {
        for (const id of [...eu.links.merge, ...eu.links.link])
            if (!eus.has(id)) report('missing', `${eu.id}: Tree links point at missing ${id}`);
    }

    // ---- merge groups: two-way, transitive -----------------------------------
    const parent = new Map(euIds.map(id => [id, id]));
    const find = id => parent.get(id) === id ? id : (parent.set(id, find(parent.get(id))), parent.get(id));
    for (const eu of eus.values())
        for (const m of eu.links.merge) if (eus.has(m)) parent.set(find(m), find(eu.id));
    const groups = new Map();
    for (const id of euIds) {
        const root = find(id);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(id);
    }
    const groupOf = new Map();
    for (const members of groups.values()) for (const id of members) groupOf.set(id, members);
    const mergeGroups = [...groups.values()].filter(g => g.length > 1);

    // ---- skills register -----------------------------------------------------
    const skills = new Map();
    for (const r of rowsOf(findTable(raw, 'Skills register'))) {
        if (!r.id) continue;
        if (skills.has(r.id)) { report('duplicate', `Duplicate skill ID ${r.id}`); continue; }
        const { ids, notes } = expandEvidence(r.evidence || '', euIds);
        for (const id of (r.evidence || '').match(EU_ID) || [])
            if (!eus.has(id)) report('missing', `${r.id}: register evidence points at missing ${id}`);
        const evidence = ids.filter(id => eus.has(id));
        const strength = r.strength || '';
        skills.set(r.id, {
            id: r.id, name: r.skill, family: r.family, strength, status: (r.status || '').toLowerCase(),
            icon: r.icon || '◆', evidence, evidenceNotes: notes, rule: r['claim strength and rule'] || '',
            rank: evidence.length ? RANK[strength.toLowerCase().split(/\W/)[0]] || 1 : 0,
            keywords: [],
        });
        if (!codes.has(r.family)) report('tag', `${r.id}: family ${r.family} is not in the taxonomy`);
    }

    for (const sk of skills.values()) {
        for (const id of sk.evidence) eus.get(id).skills.push(sk.id);
        if (!sk.evidence.length) report('locked', `${sk.id} has no EU evidence (renders locked)`);
        const units = new Set(sk.evidence.map(id => groupOf.get(id)[0]));
        sk.unitCount = units.size;
        const starts = sk.evidence.map(id => eus.get(id).dates?.start).filter(d => d != null);
        sk.earned = starts.length ? Math.min(...starts) : null;
        const ends = sk.evidence.map(id => eus.get(id).dates).filter(Boolean);
        sk.lastActive = ends.length ? (ends.some(d => d.end == null) ? null : Math.max(...ends.map(d => d.end))) : null;
        sk.roles = [...new Set(sk.evidence.flatMap(id => eus.get(id).role))];
        const region = regions.find(r => r.code === sk.family);
        const tools = sk.evidence.map(id => eus.get(id).scale).join(' ');
        sk.keywords = [sk.name, ...(region?.vocabulary || []), tools].join(' ').toLowerCase();
    }

    const unassigned = euIds.filter(id => !eus.get(id).skills.length);
    for (const id of unassigned) report('unlinked', `${id} is linked to no skill`);

    // ---- synergies -----------------------------------------------------------
    const syn = new Map();
    const bump = (a, b, n = 1) => {
        if (a === b) return;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        syn.set(key, (syn.get(key) || 0) + n);
    };
    const skillList = [...skills.values()];
    for (let i = 0; i < skillList.length; i++)
        for (let j = i + 1; j < skillList.length; j++) {
            const a = new Set(skillList[i].evidence);
            const shared = skillList[j].evidence.filter(id => a.has(id)).length;
            if (shared) bump(skillList[i].id, skillList[j].id, shared);
        }
    for (const eu of eus.values())
        for (const other of eu.links.link)
            for (const a of eu.skills) for (const b of eus.get(other)?.skills || []) bump(a, b);
    const synergies = [...syn].map(([k, weight]) => { const [a, b] = k.split('|'); return { a, b, weight }; });

    // ---- configuration -------------------------------------------------------
    const classes = rowsOf(findTable(raw, 'Classes')).map(r => ({
        id: r.id, name: r.class, source: r.source, headline: r.headline,
        primary: splitCodes(r.primary), secondary: splitCodes(r.secondary), icon: r.icon,
    }));
    const attributes = rowsOf(findTable(raw, 'Attributes')).map(r => ({ name: r.attribute, codes: splitCodes(r.codes) }));
    const keystones = rowsOf(findTable(raw, 'Keystones')).map(r => ({
        id: r.id, name: r.keystone, icon: r.icon, members: r.members.match(EU_ID) || [], basis: r.basis,
    }));
    const growth = rowsOf(findTable(raw, 'Growth targets')).map(r => ({
        id: r.id, target: r.target, source: r.source, state: r['current state'],
    }));
    for (const k of keystones) for (const id of k.members) if (!eus.has(id)) report('missing', `${k.id}: member ${id} is missing`);

    const identity = Object.fromEntries(findTable(raw, 'Identity block').rows.map(r => [r[0], r[1]]));
    const certifications = rowsOf(findTable(raw, 'Certifications and professional development'));
    const character = {
        name: identity.Name || '',
        origin: raw.education,
        equipped: certifications.filter(c => /^(Held|Completed)/.test(c.status)).map(c => ({ name: c.certification, year: c.year })),
        traits: rowsOf(findTable(raw, 'Languages')).map(r => ({ language: r.language, level: r.level })),
    };

    const model = {
        raw, regions, roles, eus, skills, classes, attributes, keystones, growth, character,
        mergeGroups, groupOf, synergies, unassigned, issues,
    };
    return model;
}

// ---- derived views ---------------------------------------------------------

// Attribute scores 8..20 under a class: raw tag counts × class weight, scaled
// so the strongest attribute reads 20, floored at 8.
export function attributeScores(model, cls) {
    const raw = {};
    for (const eu of model.eus.values()) for (const t of eu.tags) raw[t] = (raw[t] || 0) + 1;
    const w = code => cls.primary.includes(code) ? 3 : cls.secondary.includes(code) ? 1 : 0.5;
    const vals = model.attributes.map(a => a.codes.reduce((s, c) => s + (raw[c] || 0) * w(c), 0));
    const max = Math.max(...vals, 1);
    return model.attributes.map((a, i) => ({ ...a, value: Math.max(8, Math.round(20 * vals[i] / max)) }));
}

// 'lit' | 'half' | 'base' for a skill under a class.
export function pathState(skill, cls) {
    if (cls.primary.includes(skill.family)) return 'lit';
    if (cls.secondary.includes(skill.family)) return 'half';
    return 'base';
}

// EU visible under a class? "(V-X only)" units belong to their variant's class.
export const euInClass = (eu, cls) => !eu.variantOnly || eu.variantOnly === cls.source;

// Evidence counted at a timeline month (null = now; undated units count only then).
export function evidenceAt(model, skill, month) {
    return skill.evidence.filter(id => {
        const d = model.eus.get(id).dates;
        return month == null ? true : d ? d.start <= month : false;
    });
}

export const earnedBy = (model, skill, month) => evidenceAt(model, skill, month).length > 0;

export function search(model, query) {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const hits = new Set();
    for (const sk of model.skills.values()) {
        if (sk.keywords.includes(q) || sk.evidence.some(id => model.eus.get(id).title.toLowerCase().includes(q))) hits.add(sk.id);
    }
    return hits;
}

// Next EU ID for a prefix: highest existing number + 1, never filling a gap.
export function nextEuId(model, prefix) {
    let max = 0, width = 2;
    for (const id of model.eus.keys()) {
        const m = id.match(/^EU-([A-Z]+)-(\d+)$/);
        if (m[1] === prefix) { max = Math.max(max, +m[2]); width = Math.max(width, m[2].length); }
    }
    return `EU-${prefix}-${String(max + 1).padStart(width, '0')}`;
}

export function synergiesOf(model, skillId) {
    return model.synergies.filter(s => s.a === skillId || s.b === skillId)
        .map(s => ({ id: s.a === skillId ? s.b : s.a, weight: s.weight }))
        .sort((x, y) => y.weight - x.weight);
}

export function logReport(model) {
    if (!model.issues.length) return;
    console.groupCollapsed(`Skill tree: ${model.issues.length} validation notes`);
    for (const i of model.issues) console.info(`[${i.kind}] ${i.msg}`);
    console.groupEnd();
}
