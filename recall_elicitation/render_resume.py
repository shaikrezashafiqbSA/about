#!/usr/bin/env python3
"""
render_resume.py - render a resume spec JSON into an ATS-safe, human-readable .docx

    python render_resume.py build/resume.json build/resume.docx [--pdf] [--theme navy]

DESIGN CONTRACT
===============
Two audiences, two non-negotiables.

1. THE MACHINE (ATS + LLM screeners)
   - single column, one linear text stream, top to bottom
   - ZERO tables, text boxes, images, shapes, headers or footers
     (a naive `document.paragraphs` extraction must lose nothing at all)
   - real Word heading styles - Title / Heading 1 / Heading 2 / Heading 3 -
     so parsers can segment the document by structure, not by guessing at
     bold text. The previous master resume used NO styles: every heading was
     hand-bolded body text, which is invisible to a structural parser.
   - real list numbering for bullets, not "- " typed by hand
   - canonical section names, plain-text contact details in the BODY
   - dates as "Mon YYYY - Mon YYYY", the format parsers are trained on

2. THE HUMAN (a tired reviewer on resume #180)
   - one accent colour only, used for name / section rules / bullet labels;
     body copy stays near-black so nothing fights for attention
   - serif display face for headings against a sans body: an editorial
     pairing that reads as deliberate next to the wall of default Calibri
   - a hairline rule under each section heading to give the eye anchors
   - job title on its own line, employer + right-aligned dates beneath it

Fonts are chosen from the set that ships with BOTH Windows and macOS Word,
so the layout does not reflow on the reviewer's machine. Font choice has no
effect on ATS parsing (docx stores text separately from formatting) - it is
purely a human-legibility decision.

SPEC FORMAT
-----------
{
  "name": "...", "contact_text": "...", "headline": "...", "subline": "...",
  "contact_links": [{"label": "LinkedIn", "url": "..."}],
  "blocks": [
    {"t": "section", "text": "PROFESSIONAL EXPERIENCE"},
    {"t": "para",    "text": "Body copy, **bold** supported."},
    {"t": "callout", "text": "Guiding Principle: ..."},
    {"t": "skill",   "label": "Automation", "text": "Python - SQL - RPA"},
    {"t": "role",    "role": "Project Manager", "org": "NHB", "dates": "Jul 2025 - Jul 2026"},
    {"t": "context", "text": "Italic scope-setting line."},
    {"t": "subhead", "text": "Measurement & Analytics"},
    {"t": "bullet",  "label": "Adoption Delivery", "text": "Grew usage **3x**."},
    {"t": "edu",     "degree": "MSc ...", "school": "SMU", "year": "2020"}
  ]
}

Inline **bold** is honoured in every "text" field. Nothing else is parsed.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys

import docx
from docx.enum.section import WD_SECTION_START
from docx.enum.text import WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Mm, Pt, RGBColor, Twips

# ------------------------------------------------------------------ themes
# accent: name, section headings + rules, bullet labels
# ink   : body copy (never pure black - softer and reads as more considered)
# muted : dates, context lines, contact strip
# rule  : hairline under section headings
THEMES = {
    # Deep navy + Georgia headings. Authoritative, prints well in greyscale.
    "navy": {
        "head_font": "Georgia", "body_font": "Calibri",
        "accent": "1F3A5F", "ink": "1A1A1A", "muted": "5A5A5A", "rule": "B8C4D4",
    },
    # Warm near-black. Maximum restraint; reads as consultancy/legal.
    "charcoal": {
        "head_font": "Georgia", "body_font": "Calibri",
        "accent": "2B2B2B", "ink": "1A1A1A", "muted": "606060", "rule": "C6C6C6",
    },
    # Deep teal, sans throughout. Modern/technical without shouting.
    "teal": {
        "head_font": "Calibri", "body_font": "Calibri",
        "accent": "14524B", "ink": "1A1A1A", "muted": "5A5A5A", "rule": "B5CCC8",
    },
    # No colour at all. For employers who print, or ultra-conservative sectors.
    "plain": {
        "head_font": "Calibri", "body_font": "Calibri",
        "accent": "000000", "ink": "000000", "muted": "444444", "rule": "999999",
    },
}

# ------------------------------------------------------------- type scale
SZ_NAME, SZ_CONTACT, SZ_HEADLINE = 20, 9, 10
SZ_SECTION, SZ_ROLE, SZ_ORG = 10.5, 10.5, 9.5
SZ_SUBHEAD, SZ_BODY, SZ_SMALL = 9.5, 10, 9.5

# A4 (Singapore / most of the world). US Letter is the wrong default here.
PAGE_W_MM, PAGE_H_MM = 210, 297
MARGIN_X_IN, MARGIN_Y_IN = 0.7, 0.55
TEXT_W_TWIPS = int((PAGE_W_MM / 25.4 - 2 * MARGIN_X_IN) * 1440)

BULLET_STYLE = "List Bullet"


# ----------------------------------------------------------------- helpers
def force_font(rpr, name):
    """Pin a font across all four scripts and strip theme-font indirection.

    Word resolves `w:asciiTheme` ahead of `w:ascii`; leaving the theme
    attributes in place silently reverts headings to the document theme font.
    """
    rf = rpr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts')
        rpr.insert(0, rf)
    for attr in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
        rf.set(qn(attr), name)
    for attr in ('w:asciiTheme', 'w:hAnsiTheme', 'w:cstheme', 'w:eastAsiaTheme'):
        if rf.get(qn(attr)) is not None:
            del rf.attrib[qn(attr)]


# OOXML enforces a strict child SEQUENCE inside <w:rPr> and <w:pPr>. Appending
# is not good enough: Word (stricter than LibreOffice) reports an out-of-order
# child as a corrupt document and offers to "repair" it, silently dropping the
# formatting. These are the canonical orders from CT_RPr / CT_PPr.
RPR_ORDER = [qn(t) for t in (
    'w:rStyle', 'w:rFonts', 'w:b', 'w:bCs', 'w:i', 'w:iCs', 'w:caps',
    'w:smallCaps', 'w:strike', 'w:dstrike', 'w:outline', 'w:shadow', 'w:emboss',
    'w:imprint', 'w:noProof', 'w:snapToGrid', 'w:vanish', 'w:webHidden',
    'w:color', 'w:spacing', 'w:w', 'w:kern', 'w:position', 'w:sz', 'w:szCs',
    'w:highlight', 'w:u', 'w:effect', 'w:bdr', 'w:shd', 'w:fitText',
    'w:vertAlign', 'w:rtl', 'w:cs', 'w:em', 'w:lang', 'w:eastAsianLayout',
    'w:specVanish', 'w:oMath')]

PPR_ORDER = [qn(t) for t in (
    'w:pStyle', 'w:keepNext', 'w:keepLines', 'w:pageBreakBefore', 'w:framePr',
    'w:widowControl', 'w:numPr', 'w:suppressLineNumbers', 'w:pBdr', 'w:shd',
    'w:tabs', 'w:suppressAutoHyphens', 'w:kinsoku', 'w:wordWrap',
    'w:overflowPunct', 'w:topLinePunct', 'w:autoSpaceDE', 'w:autoSpaceDN',
    'w:bidi', 'w:adjustRightInd', 'w:snapToGrid', 'w:spacing', 'w:ind',
    'w:contextualSpacing', 'w:mirrorIndents', 'w:suppressOverlap', 'w:jc',
    'w:textDirection', 'w:textAlignment', 'w:textboxTightWrap', 'w:outlineLvl',
    'w:divId', 'w:cnfStyle', 'w:rPr', 'w:sectPr', 'w:pPrChange')]


def insert_ordered(parent, elem, order):
    """Place elem at its schema position, replacing any element of the same tag.

    The replace half matters as much as the order half: the built-in Title
    style already carries a <w:spacing>, and a second one is invalid.
    """
    for old in parent.findall(elem.tag):
        parent.remove(old)
    try:
        rank = order.index(elem.tag)
    except ValueError:
        parent.append(elem)
        return
    for child in parent:
        crank = order.index(child.tag) if child.tag in order else -1
        if crank > rank:
            child.addprevious(elem)
            return
    parent.append(elem)


def char_spacing(rpr, twentieths):
    """Letter-spacing, in twentieths of a point. Opens up all-caps headings."""
    sp = OxmlElement('w:spacing')
    sp.set(qn('w:val'), str(twentieths))
    insert_ordered(rpr, sp, RPR_ORDER)


def bottom_rule(ppr, color, size=6, space=2):
    pbdr = OxmlElement('w:pBdr')
    b = OxmlElement('w:bottom')
    b.set(qn('w:val'), 'single')
    b.set(qn('w:sz'), str(size))
    b.set(qn('w:space'), str(space))
    b.set(qn('w:color'), color)
    pbdr.append(b)
    insert_ordered(ppr, pbdr, PPR_ORDER)


def style_font(style, name, size, color, bold=False, italic=False, caps=False,
               spacing=None):
    f = style.font
    f.name = name
    f.size = Pt(size)
    f.color.rgb = RGBColor.from_string(color.upper())
    f.bold = bold
    f.italic = italic
    rpr = style.element.get_or_add_rPr()
    force_font(rpr, name)
    if caps:
        insert_ordered(rpr, OxmlElement('w:caps'), RPR_ORDER)
    if spacing:
        char_spacing(rpr, spacing)


def para_space(style, before=0, after=0, line=None, keep_next=False):
    pf = style.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    if line:
        pf.line_spacing = line
    pf.keep_with_next = keep_next
    pf.widow_control = True


def run(p, text, font, size, color, bold=False, italic=False):
    r = p.add_run(text)
    r.font.name = font
    r.font.size = Pt(size)
    r.font.color.rgb = RGBColor.from_string(color.upper())
    r.bold = bold
    r.italic = italic
    force_font(r._element.get_or_add_rPr(), font)
    return r


# **bold** first, then *italic* - the negative look-arounds stop a lone '*'
# in prose (or a stray bullet char) from swallowing the rest of the line.
INLINE_RE = re.compile(r'\*\*(.+?)\*\*|\*(?!\s)([^*]+?)(?<!\s)\*')


def rich(p, text, font, size, color, italic=False):
    """Emit a string honouring **bold** and *italic* spans."""
    pos = 0
    for m in INLINE_RE.finditer(text):
        if m.start() > pos:
            run(p, text[pos:m.start()], font, size, color, italic=italic)
        if m.group(1) is not None:
            run(p, m.group(1), font, size, color, bold=True, italic=italic)
        else:
            run(p, m.group(2), font, size, color, italic=True)
        pos = m.end()
    if pos < len(text):
        run(p, text[pos:], font, size, color, italic=italic)


def hyperlink(p, text, url, font, size, color):
    rid = p.part.relate_to(
        url,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        is_external=True)
    link = OxmlElement('w:hyperlink')
    link.set(qn('r:id'), rid)
    r = OxmlElement('w:r')
    rpr = OxmlElement('w:rPr')
    force_font(rpr, font)
    sz = OxmlElement('w:sz'); sz.set(qn('w:val'), str(int(size * 2))); rpr.append(sz)
    c = OxmlElement('w:color'); c.set(qn('w:val'), color); rpr.append(c)
    u = OxmlElement('w:u'); u.set(qn('w:val'), 'single'); rpr.append(u)
    r.append(rpr)
    t = OxmlElement('w:t'); t.text = text; t.set(qn('xml:space'), 'preserve')
    r.append(t)
    link.append(r)
    p._element.append(link)


def right_tab(p):
    p.paragraph_format.tab_stops.add_tab_stop(
        Twips(TEXT_W_TWIPS), WD_TAB_ALIGNMENT.RIGHT)


# ------------------------------------------------------------------ styles
def build_styles(doc, th):
    """Redefine the built-in Word styles to our design tokens.

    Using the BUILT-IN style ids (Title / Heading1..3 / ListBullet / Normal)
    rather than custom ones is deliberate: parsers and Word's own outline view
    recognise them, and no external .dotx template is needed.
    """
    head, body = th['head_font'], th['body_font']

    st = doc.styles['Normal']
    style_font(st, body, SZ_BODY, th['ink'])
    para_space(st, after=0, line=1.06)

    st = doc.styles['Title']
    style_font(st, head, SZ_NAME, th['accent'], bold=True, spacing=6)
    para_space(st, after=2, keep_next=True)
    ppr = st.element.get_or_add_pPr()
    for bad in ppr.findall(qn('w:pBdr')):        # Word's Title has its own rule
        ppr.remove(bad)

    st = doc.styles['Heading 1']                  # section headings
    style_font(st, head, SZ_SECTION, th['accent'], bold=True, caps=True, spacing=24)
    para_space(st, before=11, after=4, keep_next=True)
    bottom_rule(st.element.get_or_add_pPr(), th['rule'])

    st = doc.styles['Heading 2']                  # job titles
    style_font(st, body, SZ_ROLE, th['ink'], bold=True)
    para_space(st, before=8, after=0, keep_next=True)

    st = doc.styles['Heading 3']                  # sub-block headings
    style_font(st, body, SZ_SUBHEAD, th['accent'], bold=True)
    para_space(st, before=6, after=1, keep_next=True)

    st = doc.styles[BULLET_STYLE]
    style_font(st, body, SZ_BODY, th['ink'])
    para_space(st, after=2.5, line=1.06)
    pf = st.paragraph_format
    pf.left_indent = Pt(13)
    pf.first_line_indent = Pt(-13)
    ppr = st.element.get_or_add_pPr()
    for cs in ppr.findall(qn('w:contextualSpacing')):
        ppr.remove(cs)                            # keep breathing room between bullets


def page_setup(doc):
    s = doc.sections[0]
    s.start_type = WD_SECTION_START.NEW_PAGE
    s.page_width, s.page_height = Mm(PAGE_W_MM), Mm(PAGE_H_MM)
    s.left_margin = s.right_margin = docx.shared.Inches(MARGIN_X_IN)
    s.top_margin = s.bottom_margin = docx.shared.Inches(MARGIN_Y_IN)
    s.header_distance = s.footer_distance = docx.shared.Inches(0.3)
    # Explicitly single-column. Two-column layouts are the single most
    # destructive ATS choice: parsers read across the full line width and
    # interleave the sidebar into the main text.
    cols = s._sectPr.find(qn('w:cols'))
    if cols is None:
        cols = OxmlElement('w:cols')
        s._sectPr.append(cols)
    cols.set(qn('w:num'), '1')


def clear_body(doc):
    body = doc.element.body
    sect = body.find(qn('w:sectPr'))
    for child in list(body):
        if child is not sect:
            body.remove(child)


# ---------------------------------------------------------------- renderer
class Renderer:
    def __init__(self, doc, theme):
        self.doc, self.th = doc, theme
        self.head = theme['head_font']
        self.body = theme['body_font']

    def p(self, style=None, before=None, after=None):
        par = self.doc.add_paragraph(style=style) if style else self.doc.add_paragraph()
        if before is not None:
            par.paragraph_format.space_before = Pt(before)
        if after is not None:
            par.paragraph_format.space_after = Pt(after)
        return par

    # ------------------------------------------------------------- header
    def header(self, spec):
        th = self.th
        par = self.doc.add_paragraph(style='Title')
        par.add_run(spec['name'])

        contact = spec.get('contact_text', '').strip()
        links = spec.get('contact_links', [])
        if contact or links:
            par = self.p(after=1)
            if contact:
                run(par, contact, self.body, SZ_CONTACT, th['muted'])
            for link in links:
                run(par, "  |  ", self.body, SZ_CONTACT, th['muted'])
                hyperlink(par, link['label'], link['url'], self.body,
                          SZ_CONTACT, th['accent'])

        if spec.get('headline'):
            par = self.p(before=4, after=1)
            run(par, spec['headline'], self.body, SZ_HEADLINE, th['accent'], bold=True)
        if spec.get('subline'):
            par = self.p(after=2)
            run(par, spec['subline'], self.body, SZ_CONTACT, th['muted'])

    # ------------------------------------------------------------- blocks
    def section(self, b):
        par = self.doc.add_paragraph(style='Heading 1')
        par.add_run(b['text'])

    def role(self, b):
        par = self.doc.add_paragraph(style='Heading 2')
        par.add_run(b['role'])
        # Employer and dates share line two: the title above can wrap freely
        # without pushing the right-aligned date onto a line of its own.
        if b.get('org') or b.get('dates'):
            par = self.p(before=0, after=2)
            right_tab(par)
            if b.get('org'):
                run(par, b['org'], self.body, SZ_ORG, self.th['accent'], bold=True)
            if b.get('dates'):
                run(par, "\t" + b['dates'], self.body, SZ_ORG, self.th['muted'],
                    italic=True)

    def subhead(self, b):
        par = self.doc.add_paragraph(style='Heading 3')
        par.add_run(b['text'])

    def context(self, b):
        par = self.p(after=3)
        rich(par, b['text'], self.body, SZ_SMALL, self.th['muted'], italic=True)

    def callout(self, b):
        par = self.p(before=4, after=4)
        run(par, b['text'], self.body, SZ_BODY, self.th['accent'],
            bold=True, italic=True)

    def para(self, b):
        par = self.p(after=b.get('after', 4))
        rich(par, b['text'], self.body, b.get('size', SZ_BODY),
             b.get('color', self.th['ink']), b.get('italic', False))

    def skill(self, b):
        """Flattened competency row - the table replacement."""
        par = self.p(after=2.5)
        par.paragraph_format.left_indent = Pt(13)
        par.paragraph_format.first_line_indent = Pt(-13)
        if b.get('label'):
            run(par, b['label'] + ": ", self.body, SZ_SMALL, self.th['accent'],
                bold=True)
        rich(par, b.get('text', ''), self.body, SZ_SMALL, self.th['ink'])

    def bullet(self, b):
        par = self.doc.add_paragraph(style=BULLET_STYLE)
        if b.get('label'):
            run(par, b['label'] + ": ", self.body, SZ_BODY, self.th['accent'],
                bold=True)
        rich(par, b['text'], self.body, SZ_BODY, self.th['ink'])

    def edu(self, b):
        par = self.p(before=4, after=0)
        right_tab(par)
        run(par, b['degree'], self.body, SZ_BODY, self.th['ink'], bold=True)
        if b.get('school'):
            run(par, " - " + b['school'], self.body, SZ_BODY, self.th['ink'])
        if b.get('year'):
            run(par, "\t" + b['year'], self.body, SZ_ORG, self.th['muted'],
                italic=True)
        if b.get('note'):
            # Coursework carries real keyword weight - keep it in ink, not
            # muted, and let inline *italic* mark the leading descriptor.
            q = self.p(before=0, after=3)
            rich(q, b['note'], self.body, SZ_SMALL, self.th['ink'])

    def emit(self, b):
        fn = getattr(self, b.get('t', ''), None)
        if fn is None or b.get('t') == 'emit':
            raise ValueError("unknown block type: %r" % b.get('t'))
        fn(b)


def render(spec, out_path, theme="navy"):
    th = THEMES[theme]
    doc = docx.Document()
    clear_body(doc)
    page_setup(doc)
    build_styles(doc, th)

    r = Renderer(doc, th)
    r.header(spec)
    for b in spec.get('blocks', []):
        r.emit(b)

    doc.save(out_path)
    return out_path


# -------------------------------------------------------------------- pdf
def find_soffice():
    for cand in ("soffice", "libreoffice"):
        p = shutil.which(cand)
        if p:
            return p
    for p in (r"C:\Program Files\LibreOffice\program\soffice.exe",
              r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
              "/Applications/LibreOffice.app/Contents/MacOS/soffice"):
        if os.path.exists(p):
            return p
    return None


def to_pdf(docx_path):
    exe = find_soffice()
    if not exe:
        raise RuntimeError("LibreOffice not found - install it or drop --pdf")
    outdir = os.path.dirname(os.path.abspath(docx_path)) or '.'
    subprocess.run([exe, '--headless', '--convert-to', 'pdf', '--outdir',
                    outdir, os.path.abspath(docx_path)],
                   check=True, capture_output=True, timeout=180)
    return os.path.splitext(docx_path)[0] + '.pdf'


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('spec')
    ap.add_argument('output')
    ap.add_argument('--theme', default='navy', choices=sorted(THEMES))
    ap.add_argument('--pdf', action='store_true')
    a = ap.parse_args()

    with open(a.spec, encoding='utf-8') as fh:
        spec = json.load(fh)
    path = render(spec, a.output, a.theme)
    print("wrote %s (%.1f KB, theme=%s)"
          % (path, os.path.getsize(path) / 1024, a.theme))
    if a.pdf:
        print("wrote %s" % to_pdf(path))
    return 0


if __name__ == '__main__':
    sys.exit(main())
