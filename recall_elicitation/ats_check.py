#!/usr/bin/env python3
"""
ats_check.py - audit a .docx for the things that actually break ATS and
LLM resume screeners.

    python ats_check.py build/resume.docx

Every check here is mechanical: it inspects the OOXML, it does not guess at
content quality. Checks are ordered by how much damage the defect does.

THE FAILURE MODEL
-----------------
Most resume parsers convert .docx to a flat string before anything else.
The cheapest and most common implementation is python-docx's
`document.paragraphs`, which walks only top-level <w:p> elements. Anything
living inside <w:tbl>, <w:txbxContent> or a header/footer part is simply not
in that list, and disappears with no error. That is the whole risk surface:
not "the parser handles tables badly", but "half the parsers never see them".

Exit code is 1 if any BLOCKER fires, else 0 - so this can gate a build.
"""
from __future__ import annotations

import argparse
import re
import sys
import zipfile

import docx
from docx.oxml.ns import qn

EMAIL_RE = re.compile(r'[\w.+-]+@[\w-]+\.[\w.]+')
PHONE_RE = re.compile(r'(?:\+?\d[\d\s().-]{6,}\d)')
DATE_RE = re.compile(
    r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b', re.I)

# Fonts present on stock Windows AND macOS Word installs. Anything else risks
# substitution and a reflowed layout on the reviewer's machine.
SAFE_FONTS = {
    'Arial', 'Calibri', 'Cambria', 'Candara', 'Consolas', 'Constantia',
    'Corbel', 'Courier New', 'Franklin Gothic Book', 'Garamond', 'Georgia',
    'Helvetica', 'Lucida Sans', 'Palatino Linotype', 'Book Antiqua',
    'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
}

CANONICAL_SECTIONS = {
    'summary', 'professional summary', 'profile', 'objective',
    'experience', 'professional experience', 'work experience',
    'employment history', 'education', 'skills', 'core competencies',
    'technical skills', 'certifications', 'licenses', 'projects',
    'languages', 'publications', 'awards', 'volunteer', 'community',
}


class Report:
    def __init__(self):
        self.rows = []

    def add(self, level, check, detail):
        self.rows.append((level, check, detail))

    ok = lambda s, c, d='': s.add('PASS', c, d)
    warn = lambda s, c, d='': s.add('WARN', c, d)
    fail = lambda s, c, d='': s.add('BLOCKER', c, d)

    @property
    def blockers(self):
        return [r for r in self.rows if r[0] == 'BLOCKER']

    @property
    def warnings(self):
        return [r for r in self.rows if r[0] == 'WARN']


def audit(path):
    r = Report()
    doc = docx.Document(path)
    zf = zipfile.ZipFile(path)
    names = zf.namelist()
    xml = zf.read('word/document.xml').decode('utf-8', 'replace')

    # ---------------------------------------------------- 1. linear text
    paras = [p.text for p in doc.paragraphs if p.text.strip()]
    naive_chars = sum(len(t) for t in paras)
    tbl_chars = sum(len(c.text) for t in doc.tables for row in t.rows for c in row.cells)

    if doc.tables:
        r.fail('No tables',
               '%d table(s) holding %d chars - invisible to naive extraction'
               % (len(doc.tables), tbl_chars))
    else:
        r.ok('No tables', 'all %d chars are in the linear text stream' % naive_chars)

    # ------------------------------------------------- 2. hidden content
    hidden = {
        'text box': xml.count('<w:txbxContent'),
        'drawing/image': xml.count('<w:drawing'),
        'VML shape': xml.count('<v:shape'),
        'embedded object': xml.count('<w:object'),
        'picture': xml.count('<w:pict'),
    }
    bad = {k: v for k, v in hidden.items() if v}
    if bad:
        r.fail('No hidden containers',
               ', '.join('%s x%d' % kv for kv in bad.items()))
    else:
        r.ok('No hidden containers', 'no text boxes, images, shapes or objects')

    # ------------------------------------------------------ 3. columns
    cols = re.findall(r'<w:cols[^>]*w:num="(\d+)"', xml)
    multi = [c for c in cols if int(c) > 1]
    if multi:
        r.fail('Single column', 'section declares %s columns' % multi[0])
    else:
        r.ok('Single column', 'one text flow, read top to bottom')

    # ------------------------------------------- 4. header / footer parts
    hf = [n for n in names if re.match(r'word/(header|footer)\d*\.xml', n)]
    hf_text = ''
    for n in hf:
        hf_text += re.sub(r'<[^>]+>', '', zf.read(n).decode('utf-8', 'replace'))
    if hf_text.strip():
        r.warn('Contact in body, not header',
               'header/footer carries text - many parsers drop it')
    else:
        r.ok('Contact in body, not header', 'no header/footer content')

    # ------------------------------------------- 5. structural heading styles
    styles = [p.style.name for p in doc.paragraphs if p.text.strip()]
    h1 = styles.count('Heading 1')
    heads = sum(1 for s in styles if s.startswith('Heading')) + styles.count('Title')
    if h1 == 0:
        r.fail('Real heading styles',
               'no Heading 1 - every heading is hand-bolded text, so a '
               'structural parser cannot segment the document')
    else:
        r.ok('Real heading styles',
             '%d Heading 1 sections, %d styled headings total' % (h1, heads))

    # ------------------------------------------------- 6. real list bullets
    n_list = sum(1 for p in doc.paragraphs
                 if p.text.strip() and p.style.name.startswith('List'))
    manual = sum(1 for t in paras if t.lstrip()[:2] in ('- ', '* ', '• '))
    if manual > 3:
        r.warn('Real list numbering',
               '%d bullets typed as literal characters' % manual)
    elif n_list:
        r.ok('Real list numbering', '%d list-styled bullets' % n_list)
    else:
        r.warn('Real list numbering', 'no list-styled paragraphs found')

    # ----------------------------------------------------- 7. contact data
    head = '\n'.join(paras[:6])
    email = EMAIL_RE.search(head)
    phone = PHONE_RE.search(head)
    if email and phone:
        r.ok('Contact parseable', '%s / %s' % (email.group(), phone.group().strip()))
    else:
        r.warn('Contact parseable',
               'email=%s phone=%s in first 6 lines'
               % (bool(email), bool(phone)))

    # -------------------------------------------------------- 8. date format
    dates = DATE_RE.findall('\n'.join(paras))
    if len(dates) >= 4:
        r.ok('Dates parseable', '%d "Mon YYYY" dates' % len(dates))
    else:
        r.warn('Dates parseable',
               'only %d "Mon YYYY" dates - avoid 07/25 style' % len(dates))

    # ------------------------------------------------------ 9. section names
    found = [p.text.strip() for p in doc.paragraphs
             if p.style.name == 'Heading 1' and p.text.strip()]
    unknown = [s for s in found
               if not any(k in s.lower() for k in CANONICAL_SECTIONS)]
    if not found:
        r.warn('Canonical section names',
               'no Heading 1 paragraphs to check - see the heading-styles row')
    elif unknown:
        r.warn('Canonical section names', 'unrecognised: %s' % ', '.join(unknown))
    else:
        r.ok('Canonical section names', ' / '.join(found))

    # ---------------------------------------------------------- 10. fonts
    used = set(re.findall(r'w:ascii="([^"]+)"', xml))
    risky = sorted(used - SAFE_FONTS)
    if risky:
        r.warn('Cross-platform fonts', 'may substitute: %s' % ', '.join(risky))
    else:
        r.ok('Cross-platform fonts', ', '.join(sorted(used)) or 'theme default')

    if any(n.startswith('word/fonts/') for n in names):
        r.warn('No embedded fonts', 'embedded font binaries inflate the file')
    else:
        r.ok('No embedded fonts', '')

    # ------------------------------------------------------- 11. page size
    sec = doc.sections[0]
    w_mm = round(sec.page_width.mm)
    size = 'A4' if abs(w_mm - 210) < 3 else ('US Letter' if abs(w_mm - 216) < 3
                                             else '%dmm wide' % w_mm)
    r.ok('Page size', size)

    # --------------------------------------------------------- 12. length
    words = len(re.findall(r'\S+', '\n'.join(paras)))
    # ~575 words/page at 10pt Calibri on A4 with 0.7in margins
    pages = max(1, round(words / 575))
    if words > 1400:
        r.warn('Length', '%d words, roughly %d pages - long for most screens'
               % (words, pages))
    else:
        r.ok('Length', '%d words, roughly %d pages' % (words, pages))

    zf.close()
    return r, {'words': words, 'pages': pages, 'chars': naive_chars}


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser(description="ATS-safety audit for a .docx resume")
    ap.add_argument('docx')
    ap.add_argument('--quiet', action='store_true', help='only show problems')
    a = ap.parse_args()

    r, stats = audit(a.docx)
    print("\nATS AUDIT  %s" % a.docx)
    print("=" * 72)
    for level, check, detail in r.rows:
        if a.quiet and level == 'PASS':
            continue
        tag = {'PASS': ' ok  ', 'WARN': 'WARN ', 'BLOCKER': 'BLOCK'}[level]
        print("[%s] %-26s %s" % (tag, check, detail))
    print("=" * 72)
    print("%d blockers, %d warnings   |   %d words, ~%d page(s)"
          % (len(r.blockers), len(r.warnings), stats['words'], stats['pages']))
    return 1 if r.blockers else 0


if __name__ == '__main__':
    sys.exit(main())
