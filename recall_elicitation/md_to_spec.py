#!/usr/bin/env python3
"""
md_to_spec.py - parse a resume Markdown file into the JSON spec that
render_resume.py consumes.

    python md_to_spec.py content/my_resume.md build/resume.json

WHY THIS EXISTS
---------------
Resume Markdown in this pipeline comes out of Google Docs / LLM output, which
does NOT use ATX headings. It uses *bold lines* as headings and "* " for
bullets, and it backslash-escapes punctuation (\\+65, \\~6 Years). This parser
targets that real-world dialect, and also accepts clean ATX Markdown (# / ##
/ ###) so hand-written files work too.

DIALECT RECOGNISED
------------------
    **SHAIK REZA SHAFIQ**            first bold line          -> name
    Singapore Citizen | +65 ... |    next line, links pulled  -> contact
    **Headline | With | Pipes**      next bold line           -> headline
    MSc Quantitative Finance ...     next plain line          -> subline

    **PROFESSIONAL SUMMARY**         all-caps bold line       -> section
    # / ## / ### Heading             ATX equivalents          -> section/role/subhead
    **Role | Organisation** *Dates*  bold + trailing italic   -> role
    **Degree** - School *Year*       inside EDUCATION         -> edu
    ***Sub-block heading***          triple-star line         -> subhead
    *Guiding Principle: ...*         italic line, that prefix -> callout
    *Any other italic line*                                   -> context
    * **Label:** body text           star/dash bullet         -> bullet + label
    * body text                                               -> bullet
    | Category | items |             pipe table               -> skill (FLATTENED)
    anything else                                             -> para

THE TABLE FLATTENING IS THE POINT
---------------------------------
Two-column Markdown tables become {"t": "skill"} blocks, NOT table blocks.
Tables are the single biggest ATS hazard in a resume: the most common docx
text-extraction path (python-docx `document.paragraphs`, which many resume
parsers use verbatim) returns nothing at all for table cells - the entire
skills block vanishes silently. Flattening to "Label: items" paragraphs keeps
every keyword in the linear text stream where every parser will find it.
"""
from __future__ import annotations

import argparse
import json
import re
import sys

# --------------------------------------------------------------- patterns
ESCAPE_RE    = re.compile(r'\\([\\*_{}\[\]()#+\-.!~|>&$@%^=?/"\':;,`])')
LINK_RE      = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
ROW_RE       = re.compile(r'^\|(.+)\|\s*$')
SEP_RE       = re.compile(r'^\|[\s:|\-]+\|\s*$')
BULLET_RE    = re.compile(r'^[*+\-]\s+(.*)$')
ATX_RE       = re.compile(r'^(#{1,6})\s+(.*)$')
TRIBOLD_RE   = re.compile(r'^\*\*\*(.+?)\*\*\*$')
FULLBOLD_RE  = re.compile(r'^\*\*(.+?)\*\*$')
FULLITAL_RE  = re.compile(r'^\*(?!\*)([^*]+)\*$')
BOLD_ITAL_RE = re.compile(r'^\*\*(.+?)\*\*\s+\*(?!\*)([^*]+)\*\s*$')
EDU_RE       = re.compile(r'^\*\*(.+?)\*\*\s*[–—-]\s*(.+?)\s*\*(?!\*)([^*]+)\*\s*$')
LABEL_RE     = re.compile(r'^\*\*(.+?)\*\*:?\s*(.*)$')

# ATS-canonical section names. Screeners segment a resume by matching heading
# text against a known vocabulary; "CORE COMPETENCIES" alone misses the very
# common "skills" token, so we widen it. Disable with --no-canonical.
CANONICAL = {
    "CORE COMPETENCIES":       "CORE COMPETENCIES & TECHNICAL SKILLS",
    "COMPETENCIES":            "CORE COMPETENCIES & TECHNICAL SKILLS",
    "SKILLS":                  "CORE COMPETENCIES & TECHNICAL SKILLS",
    "PROFESSIONAL SUMMARY":    "PROFESSIONAL SUMMARY",
    "SUMMARY":                 "PROFESSIONAL SUMMARY",
    "PROFESSIONAL EXPERIENCE": "PROFESSIONAL EXPERIENCE",
    "WORK EXPERIENCE":         "PROFESSIONAL EXPERIENCE",
    "EXPERIENCE":              "PROFESSIONAL EXPERIENCE",
    "EDUCATION":               "EDUCATION",
    "LANGUAGES":               "LANGUAGES",
    # NOTE: only widen headings that are MISSING a token screeners look for.
    # "CERTIFICATIONS & PROFESSIONAL DEVELOPMENT" already leads with the
    # canonical token, so shortening it would lose information, not add it.
}


def unescape(s):
    """Drop the backslashes Google Docs / LLM exports sprinkle on punctuation."""
    return ESCAPE_RE.sub(r'\1', s)


def strip_emph(s):
    s = s.strip()
    for n in (3, 2, 1):
        mark = '*' * n
        if s.startswith(mark) and s.endswith(mark) and len(s) > 2 * n:
            return s[n:-n].strip()
    return s


def is_section_heading(text):
    """A fully-bold line whose letters are all uppercase is a section heading."""
    letters = [c for c in text if c.isalpha()]
    return len(letters) >= 3 and all(c.isupper() for c in letters)


def split_role(bold):
    """'Role Title | Organisation' -> ('Role Title', 'Organisation')."""
    parts = [p.strip() for p in bold.split('|')]
    if len(parts) >= 2:
        return parts[0], ' | '.join(parts[1:])
    return bold.strip(), ""


class Parser:
    def __init__(self, canonical=True):
        self.canonical = canonical
        self.spec = {"name": "", "contact_text": "", "contact_links": [],
                     "headline": "", "subline": "", "blocks": []}
        self.blocks = self.spec["blocks"]
        self.section = ""
        self.table = None
        self.renamed = []
        self.header_stage = 0     # 0 name, 1 contact, 2 headline, 3 subline, 4 body

    # ---------------------------------------------------------- table buffer
    def flush_table(self):
        """Emit buffered table rows as flat skill blocks - never as a table."""
        if not self.table:
            self.table = None
            return
        for cells in self.table:
            label = strip_emph(cells[0])
            text = cells[1] if len(cells) > 1 else ""
            if not (label or text):
                continue
            self.blocks.append({"t": "skill", "label": label, "text": text})
        self.table = None

    # -------------------------------------------------------------- sections
    def add_section(self, text):
        text = text.strip()
        key = text.upper()
        if self.canonical and key in CANONICAL and CANONICAL[key] != text:
            self.renamed.append((text, CANONICAL[key]))
            text = CANONICAL[key]
        self.section = text.upper()
        self.blocks.append({"t": "section", "text": text})

    # ---------------------------------------------------------------- bullet
    def add_bullet(self, body):
        m = LABEL_RE.match(body)
        if m and m.group(2):
            self.blocks.append({"t": "bullet",
                                "label": m.group(1).rstrip(':').strip(),
                                "text": m.group(2).strip()})
        else:
            self.blocks.append({"t": "bullet", "text": body})

    # ----------------------------------------------------------------- main
    def parse(self, md):
        for raw in md.split('\n'):
            line = unescape(raw.strip())

            if not line:
                self.flush_table()
                continue

            # ---- pipe tables ------------------------------------------
            if ROW_RE.match(line):
                if SEP_RE.match(line):
                    continue
                cells = [c.strip() for c in line.strip().strip('|').split('|')]
                if not any(cells):
                    continue
                if self.table is None:
                    self.table = []
                self.table.append(cells[:2] if len(cells) >= 2 else [cells[0], ""])
                continue
            self.flush_table()

            # ---- document header --------------------------------------
            if self.header_stage < 4 and self.consume_header(line):
                continue

            # ---- ATX headings (clean-markdown path) --------------------
            m = ATX_RE.match(line)
            if m:
                depth, text = len(m.group(1)), strip_emph(m.group(2))
                if depth <= 2:
                    self.add_section(text)
                elif depth == 3:
                    role, org = split_role(text)
                    self.blocks.append({"t": "role", "role": role,
                                        "org": org, "dates": ""})
                else:
                    self.blocks.append({"t": "subhead", "text": text})
                continue

            # ---- bullets ----------------------------------------------
            m = BULLET_RE.match(line)
            if m:
                self.add_bullet(m.group(1).strip())
                continue

            # ---- ***sub-block heading*** -------------------------------
            m = TRIBOLD_RE.match(line)
            if m:
                self.blocks.append({"t": "subhead", "text": m.group(1).strip()})
                continue

            # ---- **Degree** - School *Year*  (EDUCATION only) ----------
            if self.section.startswith("EDUCATION"):
                m = EDU_RE.match(line)
                if m:
                    self.blocks.append({"t": "edu",
                                        "degree": m.group(1).strip(),
                                        "school": m.group(2).strip(),
                                        "year": m.group(3).strip()})
                    continue

            # ---- **Role | Org** *Dates* --------------------------------
            m = BOLD_ITAL_RE.match(line)
            if m:
                role, org = split_role(m.group(1))
                self.blocks.append({"t": "role", "role": role, "org": org,
                                    "dates": m.group(2).strip()})
                continue

            # ---- **WHOLE LINE BOLD** ----------------------------------
            m = FULLBOLD_RE.match(line)
            if m:
                text = m.group(1).strip()
                if is_section_heading(text):
                    self.add_section(text)
                elif '|' in text:
                    role, org = split_role(text)
                    self.blocks.append({"t": "role", "role": role,
                                        "org": org, "dates": ""})
                else:
                    self.blocks.append({"t": "para", "text": line})
                continue

            # ---- *whole line italic* ----------------------------------
            m = FULLITAL_RE.match(line)
            if m:
                text = m.group(1).strip()
                kind = "callout" if text.lower().startswith("guiding principle") \
                    else "context"
                self.blocks.append({"t": kind, "text": text})
                continue

            # A plain line straight after a degree is its coursework note -
            # fold it into the edu block so it renders tight to the degree.
            if (self.section.startswith("EDUCATION") and self.blocks
                    and self.blocks[-1]['t'] == 'edu'
                    and not self.blocks[-1].get('note')):
                self.blocks[-1]['note'] = line
                continue

            self.blocks.append({"t": "para", "text": line})

        self.flush_table()
        return self.spec

    # ---------------------------------------------------------------- header
    def consume_header(self, line):
        """Absorb the first four meaningful lines: name / contact / headline / subline."""
        st = self.header_stage
        if st == 0:
            m = FULLBOLD_RE.match(line) or ATX_RE.match(line)
            if not m:
                return False
            self.spec['name'] = strip_emph(m.group(m.re.groups)).strip()
            self.header_stage = 1
            return True

        if st == 1:
            links = LINK_RE.findall(line)
            self.spec['contact_links'] = [{"label": l, "url": u} for l, u in links]
            text = LINK_RE.sub('', line)
            text = re.sub(r'(\s*\|\s*){2,}', '  |  ', text)
            text = re.sub(r'(\s*\|\s*)+$', '', text).rstrip()
            self.spec['contact_text'] = text
            self.header_stage = 2
            return True

        if st == 2:
            m = FULLBOLD_RE.match(line)
            if m and not is_section_heading(m.group(1)):
                self.spec['headline'] = m.group(1).strip()
                self.header_stage = 3
                return True
            self.header_stage = 4
            return False

        if st == 3:
            if not line.startswith(('#', '*', '|')):
                self.spec['subline'] = line
                self.header_stage = 4
                return True
            self.header_stage = 4
            return False

        return False


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser(description="Resume Markdown -> render spec JSON")
    ap.add_argument('source', help='resume .md')
    ap.add_argument('output', help='spec .json to write')
    ap.add_argument('--no-canonical', action='store_true',
                    help='keep section headings exactly as written')
    a = ap.parse_args()

    with open(a.source, encoding='utf-8') as fh:
        p = Parser(canonical=not a.no_canonical)
        spec = p.parse(fh.read())

    with open(a.output, 'w', encoding='utf-8') as fh:
        json.dump(spec, fh, indent=2, ensure_ascii=False)

    kinds = {}
    for b in spec['blocks']:
        kinds[b['t']] = kinds.get(b['t'], 0) + 1
    print("parsed %d blocks -> %s" % (len(spec['blocks']), a.output))
    print("  " + ", ".join("%s=%d" % kv for kv in sorted(kinds.items())))
    if not spec['name']:
        print("  WARNING: no name detected - is the first line '**NAME**' or '# NAME'?")
    if kinds.get('section', 0) == 0:
        print("  WARNING: no section headings detected - output will be unstructured.")
    for old, new in p.renamed:
        print("  renamed section for ATS: %r -> %r" % (old, new))
    return 0


if __name__ == '__main__':
    sys.exit(main())
