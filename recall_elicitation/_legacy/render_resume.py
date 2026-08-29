#!/usr/bin/env python3
"""
render_resume.py — render a resume JSON spec into Shaik's master-resume house style.

Usage:
    python3 render_resume.py spec.json output.docx [--pdf]

The visual style is not invented here. It was extracted from the Google Doc
"Master - Shaik_Reza_Shafiq_Resume" and is reproduced exactly:

    font           Calibri throughout
    name           17pt   bold          #2e74b5
    contact/sub    9.5pt                #595959
    headline       9.5pt  bold          #2e74b5
    section head   11.5pt bold          #2e74b5
    sub-block head 11.5pt bold italic   #2e74b5
    role line      10.5pt bold          role #000000, org #2e74b5, pipes #1f3864
    role context   9.5pt  italic        #595959
    body / bullets 10.5pt               #000000
    bullet label   10.5pt bold          #2e74b5
    callout        10.5pt bold italic   #2e74b5
    table          2 cols 2805/7515 twips, #cccccc borders, #f2f2f2 fill, 9.5pt
    margins        0.75in, US Letter

assets/resume_template.docx is an EMPTY document carrying the master's
styles.xml, numbering.xml (bullet list numId 41) and the Table2 table style.
Embedded fonts are stripped so the output stays around 25 KB.

Spec format (JSON):
{
  "name": "SHAIK REZA SHAFIQ",
  "contact_text": "Singapore Citizen  |  +65 9178 1248  |  shaik.reza.shafiq@gmail.com  |  ",
  "contact_links": [{"label": "LinkedIn", "url": "..."},
                    {"label": "CSP", "url": "..."}],
  "headline": "Project Manager | ...",
  "subline": "MSc Quantitative Finance, SMU · ...",
  "blocks": [
    {"t": "section",  "text": "PROFESSIONAL SUMMARY"},
    {"t": "para",     "text": "Body copy. **Bold** is supported."},
    {"t": "para",     "text": "Italic body copy.", "italic": true},
    {"t": "callout",  "text": "Guiding Principle: ..."},
    {"t": "table",    "rows": [["Label", "Content"], ["Label 2", "Content 2"]]},
    {"t": "role",     "role": "Project Manager", "org": "NHB", "dates": "Jul 2025 – Jul 2026"},
    {"t": "context",  "text": "Italic grey scope-setting line, or a leaving reason."},
    {"t": "subhead",  "text": "Project Execution and Reporting"},
    {"t": "bullet",   "label": "Enterprise Adoption Delivery", "text": "Grew usage **3x**."},
    {"t": "bullet",   "text": "Bullet with no coloured label."},
    {"t": "edu",      "degree": "Master of Science, Quantitative Finance",
                      "school": "Singapore Management University", "year": "2020",
                      "note": "Data modeling, statistical analysis, and applied computation"}
  ]
}

Inline **bold** works in every "text" field. Nothing else is parsed: write
plain sentences, not markdown.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import zipfile

import docx
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Twips

# ------------------------------------------------------------------ tokens
FONT = "Calibri"
BLUE = "2e74b5"
NAVY = "1f3864"
GREY = "595959"
BLACK = "000000"
CELL_FILL = "f2f2f2"
CELL_BORDER = "cccccc"
BULLET_NUMID = 41
COL_W = (2805, 7515)

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_TEMPLATE = os.path.join(HERE, "..", "assets", "resume_template.docx")


# ----------------------------------------------------------------- helpers
def clear_body(doc):
    body = doc.element.body
    sectPr = body.find(qn('w:sectPr'))
    for child in list(body):
        if child is not sectPr:
            body.remove(child)


def set_spacing(p, before=None, after=None):
    pPr = p._element.get_or_add_pPr()
    sp = pPr.find(qn('w:spacing'))
    if sp is None:
        sp = OxmlElement('w:spacing')
        pPr.append(sp)
    if before is not None:
        sp.set(qn('w:before'), str(before))
    if after is not None:
        sp.set(qn('w:after'), str(after))
    sp.set(qn('w:lineRule'), 'auto')


def make_bullet(p):
    pPr = p._element.get_or_add_pPr()
    numPr = OxmlElement('w:numPr')
    ilvl = OxmlElement('w:ilvl'); ilvl.set(qn('w:val'), '0')
    nid = OxmlElement('w:numId'); nid.set(qn('w:val'), str(BULLET_NUMID))
    numPr.append(ilvl); numPr.append(nid)
    pPr.insert(0, numPr)
    ind = OxmlElement('w:ind')
    ind.set(qn('w:left'), '260'); ind.set(qn('w:hanging'), '160')
    pPr.append(ind)
    set_spacing(p, after=30)


def run(p, text, size=10.5, color=BLACK, bold=False, italic=False):
    r = p.add_run(text)
    r.font.name = FONT
    r.font.size = Pt(size)
    r.font.color.rgb = RGBColor.from_string(color.upper())
    r.bold = bold
    r.italic = italic
    rPr = r._element.get_or_add_rPr()
    rf = rPr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts')
        rPr.insert(0, rf)
    for attr in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
        rf.set(qn(attr), FONT)
    return r


def add_hyperlink(p, text, url, size=9.5, color="1155cc"):
    r_id = p.part.relate_to(
        url,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        is_external=True)
    link = OxmlElement('w:hyperlink')
    link.set(qn('r:id'), r_id)
    r = OxmlElement('w:r')
    rPr = OxmlElement('w:rPr')
    rf = OxmlElement('w:rFonts')
    for attr in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
        rf.set(qn(attr), FONT)
    rPr.append(rf)
    sz = OxmlElement('w:sz'); sz.set(qn('w:val'), str(int(size * 2))); rPr.append(sz)
    c = OxmlElement('w:color'); c.set(qn('w:val'), color); rPr.append(c)
    u = OxmlElement('w:u'); u.set(qn('w:val'), 'single'); rPr.append(u)
    r.append(rPr)
    t = OxmlElement('w:t'); t.text = text; t.set(qn('xml:space'), 'preserve')
    r.append(t)
    link.append(r)
    p._element.append(link)


BOLD_RE = re.compile(r'\*\*(.+?)\*\*')


def rich(p, text, size=10.5, color=BLACK, italic=False):
    """Render a string, honouring **bold** spans."""
    pos = 0
    for m in BOLD_RE.finditer(text):
        if m.start() > pos:
            run(p, text[pos:m.start()], size, color, False, italic)
        run(p, m.group(1), size, color, True, italic)
        pos = m.end()
    if pos < len(text):
        run(p, text[pos:], size, color, False, italic)


def cell_borders(cell, color=CELL_BORDER):
    """tcBorders MUST be written before shd — OOXML enforces child order."""
    tcPr = cell._element.get_or_add_tcPr()
    b = OxmlElement('w:tcBorders')
    for edge in ('top', 'left', 'bottom', 'right'):
        e = OxmlElement('w:' + edge)
        e.set(qn('w:val'), 'single'); e.set(qn('w:sz'), '4')
        e.set(qn('w:space'), '0'); e.set(qn('w:color'), color)
        b.append(e)
    tcPr.append(b)


def shade(cell, fill=CELL_FILL):
    tcPr = cell._element.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear'); shd.set(qn('w:fill'), fill)
    tcPr.append(shd)


# ---------------------------------------------------------------- builders
def P(doc, before=None, after=None):
    p = doc.add_paragraph()
    set_spacing(p, before=before, after=after)
    return p


def emit_table(doc, rows):
    t = doc.add_table(rows=len(rows), cols=2)
    try:
        t.style = doc.styles['Table2']
    except KeyError:
        pass
    tblPr = t._element.find(qn('w:tblPr'))
    layout = OxmlElement('w:tblLayout'); layout.set(qn('w:type'), 'fixed')
    tblPr.append(layout)
    tblW = tblPr.find(qn('w:tblW'))
    if tblW is None:
        tblW = OxmlElement('w:tblW'); tblPr.append(tblW)
    tblW.set(qn('w:w'), str(sum(COL_W))); tblW.set(qn('w:type'), 'dxa')
    grid = t._element.find(qn('w:tblGrid'))
    for gc, w in zip(grid.findall(qn('w:gridCol')), COL_W):
        gc.set(qn('w:w'), str(w))
    for i, row in enumerate(rows):
        for j, txt in enumerate(row[:2]):
            cell = t.cell(i, j)
            cell.width = Twips(COL_W[j])
            cell_borders(cell)
            shade(cell)
            p = cell.paragraphs[0]
            set_spacing(p, before=20, after=20)
            rich(p, txt, 9.5, BLUE if j == 0 else BLACK)
            if j == 0:
                for r in p.runs:
                    r.bold = True
    return t


DISPATCH = {}


def block(name):
    def deco(fn):
        DISPATCH[name] = fn
        return fn
    return deco


@block('section')
def _section(doc, b):
    p = P(doc, before=160, after=40)
    run(p, b['text'], 11.5, BLUE, bold=True)


@block('subhead')
def _subhead(doc, b):
    p = P(doc, before=60, after=20)
    run(p, b['text'], 11.5, BLUE, bold=True, italic=True)


@block('role')
def _role(doc, b):
    p = P(doc, before=120, after=20)
    run(p, b['role'], 10.5, BLACK, bold=True)
    if b.get('org'):
        run(p, "  |  ", 10.5, NAVY, bold=True)
        run(p, b['org'], 10.5, BLUE, bold=True)
    if b.get('dates'):
        run(p, "  |  ", 10.5, NAVY, bold=True)
        run(p, b['dates'], 10.5, GREY, bold=True, italic=True)


@block('context')
def _context(doc, b):
    p = P(doc, after=40)
    rich(p, b['text'], 9.5, GREY, italic=True)


@block('para')
def _para(doc, b):
    p = P(doc, after=b.get('after', 60))
    rich(p, b['text'], b.get('size', 10.5), b.get('color', BLACK), b.get('italic', False))


@block('callout')
def _callout(doc, b):
    p = P(doc, before=60, after=40)
    run(p, b['text'], 10.5, BLUE, bold=True, italic=True)


@block('bullet')
def _bullet(doc, b):
    p = P(doc)
    make_bullet(p)
    if b.get('label'):
        run(p, b['label'] + ": ", 10.5, BLUE, bold=True)
    rich(p, b['text'], 10.5, BLACK)


@block('edu')
def _edu(doc, b):
    p = P(doc, after=0)
    run(p, b['degree'], 10.5, BLACK, bold=True)
    run(p, " – " + b['school'] + " ", 10.5, BLACK)
    if b.get('year'):
        run(p, b['year'], 10.5, GREY, italic=True)
    if b.get('note'):
        q = P(doc, after=60)
        run(q, b['note'], 9.5, GREY, italic=True)


@block('table')
def _table(doc, b):
    emit_table(doc, b['rows'])


# ------------------------------------------------------------------- main
def strip_fonts(path):
    """Remove embedded font binaries inherited from the template (~1.3 MB)."""
    tmp = path + '.tmp'
    zin = zipfile.ZipFile(path)
    zout = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
    for n in zin.namelist():
        if n.startswith('word/fonts/'):
            continue
        data = zin.read(n)
        if n in ('word/fontTable.xml', 'word/_rels/fontTable.xml.rels', '[Content_Types].xml'):
            s = data.decode('utf-8')
            s = re.sub(r'<w:embed(Regular|Bold|Italic|BoldItalic)[^/]*/>', '', s)
            s = re.sub(r'<Relationship[^>]*fonts/[^>]*/>', '', s)
            s = re.sub(r'<Override PartName="/word/fonts/[^>]*/>', '', s)
            data = s.encode('utf-8')
        zout.writestr(n, data)
    zin.close(); zout.close()
    os.replace(tmp, path)


def render(spec, out_path, template=DEFAULT_TEMPLATE):
    doc = docx.Document(template)
    clear_body(doc)

    p = P(doc, after=20)
    run(p, spec['name'], 17, BLUE, bold=True)

    p = P(doc, after=20)
    run(p, spec.get('contact_text', ''), 9.5, GREY)
    for i, link in enumerate(spec.get('contact_links', [])):
        if i:
            run(p, "  |  ", 9.5, GREY)
        add_hyperlink(p, link['label'], link['url'])

    if spec.get('headline'):
        p = P(doc, before=60, after=20)
        run(p, spec['headline'], 9.5, BLUE, bold=True)
    if spec.get('subline'):
        p = P(doc, after=40)
        run(p, spec['subline'], 9.5, GREY)

    for b in spec.get('blocks', []):
        fn = DISPATCH.get(b.get('t'))
        if fn is None:
            raise ValueError("unknown block type: %r" % b.get('t'))
        fn(doc, b)

    doc.save(out_path)
    strip_fonts(out_path)
    return out_path


def to_pdf(docx_path):
    outdir = os.path.dirname(os.path.abspath(docx_path)) or '.'
    subprocess.run(['soffice', '--headless', '--convert-to', 'pdf',
                    '--outdir', outdir, docx_path],
                   check=True, capture_output=True)
    return os.path.splitext(docx_path)[0] + '.pdf'


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('spec', help='path to the resume spec JSON')
    ap.add_argument('output', help='path to write the .docx')
    ap.add_argument('--pdf', action='store_true', help='also render a PDF via LibreOffice')
    ap.add_argument('--template', default=DEFAULT_TEMPLATE)
    a = ap.parse_args()

    with open(a.spec, encoding='utf-8') as fh:
        spec = json.load(fh)
    path = render(spec, a.output, a.template)
    print("wrote %s (%d bytes)" % (path, os.path.getsize(path)))
    if a.pdf:
        pdf = to_pdf(path)
        print("wrote %s" % pdf)


if __name__ == '__main__':
    sys.exit(main())