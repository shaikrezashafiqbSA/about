// Markdown → raw data for the skill tree. Line-oriented on purpose: the file is
// exported from Google Docs and its formatting drifts (bold or plain headings,
// stray escapes), so each rule matches loosely and a bad entry is skipped and
// reported rather than thrown.

const EU_HEAD = /^#{3,4} \**(EU-[A-Z]+-\d+) · (.+?)\**$/;
const EU_FIELD = /^\* \**([^:*(]+?)(?: \(([^)]*)\))?:\**\s*(.*)$/;
const EU_ID = /EU-[A-Z]+-\d+/g;
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

// Google Docs escapes markdown punctuation as \X.
const unescape = s => s.replace(/\\(.)/g, '$1');
const stripBold = s => s.replace(/^\*\*(.*)\*\*$/, '$1').trim();
const heading = line => {
    const m = line.match(/^(#{1,6}) (.*)$/);
    return m ? { level: m[1].length, text: stripBold(m[2].trim()) } : null;
};
const fieldKey = name => name.trim().toLowerCase();

// "Jul 2025", "9 February 2011", "2013", "present" → month index (y*12 + m-1).
function parseDate(s) {
    s = s.trim().toLowerCase();
    if (s === 'present' || s === 'now') return null;
    const m = s.match(/(?:\d{1,2} )?([a-z]+)? ?(\d{4})/);
    if (!m) return undefined;
    const mon = m[1] ? MONTHS[m[1].slice(0, 3)] || 1 : 1;
    return +m[2] * 12 + (mon - 1);
}

export function parseSpan(text) {
    const m = text && text.match(/((?:\d{1,2} )?(?:[A-Za-z]+ )?\d{4})\s+to\s+((?:\d{1,2} )?(?:[A-Za-z]+ )?\d{4}|present)/i);
    if (!m) return null;
    const start = parseDate(m[1]);
    let end = parseDate(m[2]);
    if (start === undefined || end === undefined) return null;
    // "2013 to 2016" means through the end of 2016.
    if (end !== null && !/[a-z]/i.test(m[2])) end += 11;
    return { start, end };
}

function parseTable(lines, i) {
    const rows = [];
    while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = lines[i].replace(/^\||\|$/g, '').split('|').map(c => stripBold(c.trim()));
        if (!cells.every(c => /^:?-+:?$/.test(c))) rows.push(cells);
        i++;
    }
    const [head, ...body] = rows;
    return { head: head || [], rows: body, end: i };
}

// IDs inside a free-text cell, with "EU-A-05 to EU-A-09" expanded against IDs
// that exist. Leftover non-EU text is returned as notes.
export function expandEvidence(cell, known) {
    const ids = [], notes = [];
    for (let part of cell.split(',')) {
        part = part.trim();
        if (!part) continue;
        const range = part.match(/^(EU-([A-Z]+)-(\d+)) to (EU-\2-(\d+))/);
        if (range) {
            const [lo, hi] = [+range[3], +range[5]];
            for (const id of known) {
                const m = id.match(/^EU-([A-Z]+)-(\d+)$/);
                if (m[1] === range[2] && +m[2] >= lo && +m[2] <= hi) ids.push(id);
            }
            continue;
        }
        const found = part.match(EU_ID);
        if (found) {
            ids.push(...found);
            const rest = part.replace(EU_ID, '').replace(/\([^)]*\)/g, '').trim();
            if (rest) notes.push(rest);
        } else notes.push(part);
    }
    return { ids: [...new Set(ids)], notes };
}

function parseTreeLinks(s) {
    const links = { merge: [], link: [] };
    for (const part of s.split(';')) {
        const m = part.trim().match(/^(merge|link)\s+(.*)$/i);
        if (m) links[m[1].toLowerCase()].push(...(m[2].match(EU_ID) || []));
    }
    return links;
}

const parseMetrics = s => s.split(' | ').map(p => {
    const i = p.indexOf(': ');
    return i < 0 ? { label: '', value: p.trim() } : { label: p.slice(0, i).trim(), value: p.slice(i + 2).trim() };
}).filter(m => m.value);

export function parse(source) {
    const text = unescape(source);
    const lines = text.split(/\r?\n/);
    const issues = [];
    const tables = {};       // heading text → { head, rows, line }
    const sections = [];     // role sections, for dating and later for editor inserts
    const eus = [];
    const education = [];
    const prefixNames = {};  // "national heritage board" → "NHB"
    let h2 = '', h3 = '', section = null, eu = null;

    const openSection = (name, line, level) => {
        section = { name, line, level, end: lines.length, prefix: null, dates: parseSpan(name) };
        sections.push(section);
    };
    const closeEu = () => { eu = null; };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const h = heading(line);
        if (h) {
            const isEu = line.match(EU_HEAD);
            if (isEu) {
                const title = isEu[2].trim();
                const v = title.match(/\((V-[A-Z]+) only\)\s*$/);
                eu = {
                    id: isEu[1], title: v ? title.slice(0, v.index).trim() : title,
                    variantOnly: v ? v[1] : null, line: i, fields: {}, section,
                };
                eus.push(eu);
                if (section && !section.prefix) section.prefix = eu.id.split('-')[1];
                continue;
            }
            closeEu();
            if (h.level <= 2) {
                h2 = h.text; h3 = '';
                if (section) { section.end = i; section = null; }
                if (/^Role \d+:|^National Service$|^Cross-role evidence units$/.test(h.text)) openSection(h.text, i, 2);
            } else if (h.level === 3) {
                h3 = h.text;
                if (/^Role \d+:|^Educator & Facilitator|^Community project/.test(h.text)) {
                    if (section) section.end = i;
                    openSection(h.text, i, 3);
                }
            }
            continue;
        }
        if (/^\|/.test(line)) {
            const t = parseTable(lines, i);
            const key = h3 || h2;
            if (!tables[key]) tables[key] = { ...t, line: i };
            if (section && !section.dates) {
                const row = t.rows.find(r => /^(Dates|Service)$/.test(r[0]));
                if (row) section.dates = parseSpan(row[1]);
            }
            i = t.end - 1;
            continue;
        }
        if (/^Role prefixes:/.test(line)) {
            for (const m of line.matchAll(/([A-Z]+) \(([^)]+)\)/g)) prefixNames[m[2].toLowerCase()] = m[1];
            continue;
        }
        if (/^Education/.test(h3)) {
            const m = line.match(/^\*\*(.+?):\s*(.+?),\s*(\d{4})\.\*\*/);
            if (m) education.push({ degree: m[1], school: m[2], year: +m[3] });
        }
        if (eu) {
            const f = line.match(EU_FIELD);
            if (f) {
                const key = fieldKey(f[1]);
                (eu.fields[key] ||= []).push({ qualifier: f[2] || null, value: f[3].trim() });
            } else if (line.trim() && !/^\*/.test(line)) {
                // Prose under an EU heading ends the unit (e.g. a section note).
                closeEu();
            }
        }
    }

    // Section names double as role names ("Role 3: Call Levels Pte Ltd").
    for (const s of sections) {
        if (!s.prefix) continue;
        const name = s.name.replace(/^Role \d+:\s*/, '').split(' · ')[0].toLowerCase();
        prefixNames[name] ||= s.prefix;
        s.role = s.name.replace(/^Role \d+:\s*/, '').split(' · ')[0];
    }

    return { lines, tables, sections, eus, education, prefixNames, issues };
}

export { parseMetrics, parseTreeLinks, parseTable, unescape, EU_ID };
