#!/usr/bin/env python3
"""
md_to_spec.py — convert a resume written in this pipeline's Markdown convention
into the JSON spec that render_resume.py consumes.

Usage:
    python3 md_to_spec.py resume.md spec.json

Markdown convention (produced by Stage 5 of the job-apply skill):

    # SHAIK REZA SHAFIQ                      -> name
    Singapore Citizen | ... | [LinkedIn](url) | [CSP](url)
                                             -> contact line (links extracted)
    **Project Manager | ...**                -> headline
    MSc Quantitative Finance, SMU · ...      -> subline
    ## PROFESSIONAL SUMMARY                  -> section heading
    ### Role | Organisation | *Dates*        -> role heading
    ***Sub-block heading***                  -> sub-block heading
    ***Guiding Principle: ...***             -> callout (any line starting "Guiding Principle")
    *Italic line*                            -> grey italic context line
    - **Label:** body text                   -> bullet with coloured label
    - body text                              -> plain bullet
    | **A** | B |                            -> table row (separator rows dropped)
    anything else                            -> body paragraph

ALWAYS render the result and read the PDF before shipping. This parser is
deliberately simple; it will not catch every hand-edit the candidate makes in
Google Docs.
"""
import json
import re
import sys

LINK_RE = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
ROW_RE = re.compile(r'^\|(.+)\|\s*$')
SEP_RE = re.compile(r'^\|[\s:\-|]+\|\s*$')


def strip_emph(s):
    """Remove wrapping *** / ** / * from a whole-line emphasis marker."""
    s = s.strip()
    for n in (3, 2, 1):
        mark = '*' * n
        if s.startswith(mark) and s.endswith(mark) and len(s) > 2 * n:
            return s[n:-n].strip()
    return s


def is_wrapped(s, n):
    mark = '*' * n
    s = s.strip()
    return s.startswith(mark) and s.endswith(mark) and len(s) > 2 * n and \
        not s[n:-n].strip().startswith('*')


def parse(md):
    lines = md.split('\n')
    spec = {"name": "", "contact_text": "", "contact_links": [],
            "headline": "", "subline": "", "blocks": []}
    blocks = spec['blocks']
    i = 0
    header_done = 0          # 0 name, 1 contact, 2 headline, 3 subline, 4 done
    table = None

    def flush_table():
        nonlocal table
        if table:
            blocks.append({"t": "table", "rows": table})
            table = None

    while i < len(lines):
        raw = lines[i]
        line = raw.strip()
        i += 1

        if not line:
            flush_table()
            continue

        # ---- tables -------------------------------------------------
        if ROW_RE.match(line):
            if SEP_RE.match(line):
                continue
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            cells = [strip_emph(c) if is_wrapped(c, 2) else c for c in cells]
            if not any(cells):
                continue
            if table is None:
                table = []
            table.append(cells[:2] if len(cells) >= 2 else [cells[0], ""])
            continue
        flush_table()

        # ---- header block -------------------------------------------
        if line.startswith('# ') and header_done == 0:
            spec['name'] = line[2:].strip()
            header_done = 1
            continue
        if header_done == 1:
            links = LINK_RE.findall(line)
            spec['contact_links'] = [{"label": l, "url": u} for l, u in links]
            text = LINK_RE.sub('', line)
            text = re.sub(r'(\s*\|\s*){2,}', '  |  ', text)   # collapse pipes orphaned by links
            text = re.sub(r'(\s*\|\s*)+$', '', text).rstrip()
            spec['contact_text'] = text + ("  |  " if links else "")
            header_done = 2
            continue
        if header_done == 2 and is_wrapped(line, 2):
            spec['headline'] = strip_emph(line)
            header_done = 3
            continue
        if header_done == 3 and not line.startswith('#'):
            spec['subline'] = line
            header_done = 4
            continue
        header_done = 4

        # ---- structural markers -------------------------------------
        if line.startswith('### '):
            body = line[4:].strip()
            parts = [p.strip() for p in body.split('|')]
            role = strip_emph(parts[0]) if parts else body
            org = strip_emph(parts[1]) if len(parts) > 1 else ""
            dates = strip_emph(parts[2]) if len(parts) > 2 else ""
            blocks.append({"t": "role", "role": role, "org": org, "dates": dates})
            continue

        if line.startswith('## '):
            blocks.append({"t": "section", "text": strip_emph(line[3:])})
            continue

        if line.startswith('- '):
            body = line[2:].strip()
            m = re.match(r'^\*\*(.+?):?\*\*:?\s*(.*)$', body)
            if m and m.group(2):
                blocks.append({"t": "bullet",
                               "label": m.group(1).rstrip(':').strip(),
                               "text": m.group(2).strip()})
            else:
                blocks.append({"t": "bullet", "text": body})
            continue

        if is_wrapped(line, 3):
            inner = strip_emph(line)
            kind = "callout" if inner.lower().startswith("guiding principle") else "subhead"
            blocks.append({"t": kind, "text": inner})
            continue

        if is_wrapped(line, 1):
            blocks.append({"t": "context", "text": strip_emph(line)})
            continue

        blocks.append({"t": "para", "text": line})

    flush_table()
    return spec


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 1
    with open(sys.argv[1], encoding='utf-8') as fh:
        spec = parse(fh.read())
    with open(sys.argv[2], 'w', encoding='utf-8') as fh:
        json.dump(spec, fh, indent=2, ensure_ascii=False)
    n = len(spec['blocks'])
    print("parsed %d blocks -> %s" % (n, sys.argv[2]))
    kinds = {}
    for b in spec['blocks']:
        kinds[b['t']] = kinds.get(b['t'], 0) + 1
    print("  " + ", ".join("%s=%d" % kv for kv in sorted(kinds.items())))
    return 0


if __name__ == '__main__':
    sys.exit(main())