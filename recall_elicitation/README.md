# resume.md → resume.docx

An ATS-safe Word resume, built from Markdown.

## Quick start (after cloning)

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r recall_elicitation/requirements.txt
```

Then either double-click **`run_resume_gui.bat`**, or:

```bash
python recall_elicitation/resume_gui.py
```

A small window: pick the `.md`, pick where the `.docx` goes, press **Build**.
The output pane shows what your Markdown parsed into and the full ATS audit.
Tkinter ships with CPython, so `python-docx` is the only thing you install.

Prefer the command line:

```bash
python recall_elicitation/build_resume.py content/my_resume.md -o build/resume.docx --pdf
```

Output: the `.docx`, an optional `.pdf`, the intermediate `.spec.json`, and an
ATS audit printed to stdout. **The build exits non-zero if the audit finds a
blocker**, so a structurally broken resume can never be shipped by accident.

---

## Why this shape

Recruiters funnel hundreds of resumes through an ATS or an LLM screener, and
only the survivors reach a human. So the document has to clear two very
different bars, and the constraints only *look* like they conflict.

### Bar 1 — the machine

Nearly every resume parser flattens `.docx` to a plain string before it does
anything else. The cheapest and most common implementation is python-docx's
`document.paragraphs`, which walks only *top-level* `<w:p>` elements. Anything
inside `<w:tbl>`, `<w:txbxContent>`, or a header/footer part is not in that
list and vanishes **with no error at all**.

That is not a theory. Measured against the previous master resume:

```
tables in doc: 1
characters living INSIDE tables: 1485
>>> naive extraction SILENTLY DROPS 1485 chars of skills/keywords <<<
```

The table held **Core Competencies** — the single densest keyword block in the
document, and the exact section keyword matching depends on. So the answer to
"do tables hurt?" is not "parsers handle them badly", it is **"a large share of
parsers never see them"**. Same mechanism for text boxes and for contact
details parked in a header.

Two-column layouts fail differently and worse: the parser reads across the
full line width, interleaving sidebar text into the main column and producing
scrambled output. Single column is genuinely non-negotiable.

The subtler defect in the old resume was invisible: **it used no Word styles at
all.** Every heading was hand-bolded body text. Bold is a font attribute, not
structure — a parser looking for sections sees an undifferentiated wall. This
pipeline emits real `Title` / `Heading 1` / `Heading 2` / `Heading 3` and real
list numbering, so the document has a machine-readable outline.

### Bar 2 — the human

Fonts and colour have **zero** effect on ATS parsing — `.docx` stores text
separately from formatting. So every visual decision here is spent purely on
the reviewer reading resume #180:

- **One accent colour**, on the name, section rules and bullet labels only.
  Body copy stays near-black (`#1A1A1A`, not pure black) so nothing competes.
- **Georgia headings against a Calibri body** — an editorial serif/sans pairing
  that reads as deliberate beside a stack of all-Calibri documents. Both ship
  with Windows *and* macOS Word, so the layout will not reflow on the
  reviewer's machine.
- **A hairline rule under each section heading**, giving the eye fixed anchors
  when skimming.
- **Job title on its own line**, employer and right-aligned dates beneath it —
  scannable for a human, and the layout parsers are trained on.
- **A4**, not US Letter.

---

## Files

| file | role |
| --- | --- |
| `resume_gui.py` | the window: pick files, press Build. Tkinter, stdlib only. |
| `build_resume.py` | one-command driver: parse → render → audit. Also importable. |
| `md_to_spec.py` | Markdown → `spec.json`. Owns the dialect and the table flattening. |
| `render_resume.py` | `spec.json` → `.docx`. Owns styles, themes, page setup. |
| `ats_check.py` | audits any `.docx` (not just ours) and exits 1 on a blocker. |
| `_legacy/` | the previous versions, kept for reference. |

The `spec.json` middle layer is the seam the web workflow plugs into: anything
that can emit that JSON gets the same rendering, and `ats_check.py` will audit
a `.docx` from any source.

---

## The Markdown dialect

Written to match what Google Docs and LLM output actually produce — **bold
lines as headings**, `*` bullets, and backslash-escaped punctuation (`\+65`,
`\~6 Years`) — because that is what your resume is written in. Clean ATX
Markdown (`#`, `##`, `###`) also parses, so hand-written files work too.

```markdown
**SHAIK REZA SHAFIQ**                              → name
Singapore Citizen | +65 ... | [LinkedIn](url)      → contact (links extracted)
**Automation Lead | Change Management · GenAI**    → headline
MSc Quantitative Finance, SMU · ~6 Years ...       → subline

**PROFESSIONAL SUMMARY**                           → section  (all-caps bold)
**Role Title | Organisation** *Jul 2025 – Jul 2026*→ role
*Recruited on a fixed-term contract to ...*        → context (grey italic)
***Measurement & Analytics***                      → sub-block heading
* **Label:** body text                             → bullet with coloured label
| Category | item · item · item |                  → FLATTENED to a skill line
**Master of Science** – University *2020*          → education entry
```

Inline `**bold**` and `*italic*` work in any body text.

**Tables are deliberately never rendered as tables.** A two-column Markdown
table becomes `Label: items` paragraphs, which keeps every keyword in the
linear text stream. This is the single highest-value transformation in the
pipeline.

Section headings are widened to ATS-canonical names where a token is missing
(`CORE COMPETENCIES` → `CORE COMPETENCIES & TECHNICAL SKILLS`, so the
`skills` token is present). Every rename is printed. Pass `--no-canonical`
to keep your headings verbatim. Headings that already lead with a canonical
token are left alone — the rule only ever *adds* a token, never shortens.

---

## Themes

```bash
--theme navy       # default. Deep navy + Georgia. Authoritative, greyscale-safe.
--theme charcoal   # near-black. Maximum restraint; consultancy/legal.
--theme teal       # deep teal, sans throughout. Modern/technical.
--theme plain      # no colour at all. Conservative sectors, or printing.
```

---

## Python version

This pipeline's only real dependency is `python-docx`, which is pure Python
with no build step — **any CPython from 3.9 to 3.14 works**, so the version is
not a constraint here. Verified on **3.14.7 with python-docx 1.2.0**, which is
what this repo's `.venv` already runs. No reason to change it.

For the wider web service later (Anthropic SDK, a web framework, PDF tooling),
target **Python 3.13**: by now it has the broadest binary-wheel coverage of any
still-current release, and it avoids the occasional missing-wheel gaps that
newer native packages still hit on 3.14.

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r recall_elicitation/requirements.txt
```

PDF export needs LibreOffice on `PATH` (see `requirements.txt`); it is optional
and the `.docx` is what you send to employers regardless.

---

## Auditing any resume

`ats_check.py` works on files this pipeline did not produce, which makes it
useful for checking a resume you were sent or one you exported elsewhere.

```bash
python recall_elicitation/ats_check.py some_resume.docx
```

### What it checks, and where each rule came from

No ATS vendor publishes a spec, so provenance matters. Checks are ordered by
how much damage the defect does, and labelled by how much to trust them.

**Measured** — verified against real extraction on this machine, not inferred:

| # | Check | Level | Basis |
| --- | --- | --- | --- |
| 1 | No tables | BLOCKER | Measured: `document.paragraphs` returned **0 of 1,485** table chars from the old resume. |
| 2 | No hidden containers | BLOCKER | Same mechanism — text boxes, images, shapes and objects are not top-level `<w:p>`. |
| 5 | Real heading styles | BLOCKER | Verified both ways: old resume had 0 `pStyle`; new one exposes 7 `Heading 1`. |

**Well-established convention** — widely documented practice, not measured here:

| # | Check | Level | Basis |
| --- | --- | --- | --- |
| 3 | Single column | BLOCKER | Parsers read across the full line width and interleave sidebar text. |
| 4 | Contact in body, not header | WARN | Header/footer parts are separate XML; commonly skipped. |
| 6 | Real list numbering | WARN | Real `numPr` survives conversion more reliably than typed dashes. |
| 7 | Contact parseable | WARN | Email/phone are regex-extracted; they must be plain text near the top. |
| 8 | Date format | WARN | `Mon YYYY` is the most reliably parsed form; `07/25` is ambiguous. |
| 9 | Canonical section names | WARN | Screeners segment by matching headings against a known vocabulary. |

**My judgement — tune these freely, they are conventions I picked:**

| # | Check | Level | Basis |
| --- | --- | --- | --- |
| 10 | Cross-platform fonts | WARN | Hand-written `SAFE_FONTS` set (stock Windows + macOS Word). Affects *layout stability only* — fonts have zero effect on ATS parsing. |
| 11 | No embedded fonts | WARN | File-size hygiene, not a parsing risk. |
| 12 | Page size | INFO | Reports A4 vs US Letter. Never fails. |
| 13 | Length | WARN over 1,400 words | The 1,400 threshold and the 575 words/page estimate are **my numbers**, not a standard. Page estimate confirmed accurate against Word's own count (6 pages). |

Adjust any threshold in `ats_check.py` — `SAFE_FONTS`, the word limit and the
words-per-page constant are all module-level constants.

The list is deliberately conservative: everything a BLOCKER fires on is a
mechanical fact about the file, never a judgement about your content. The
checker reads structure only — it says nothing about whether the writing is
any good.

---

## Wiring into the web workflow

`build_resume.py` is importable, so the final step of the browser pipeline is
one call:

```python
from recall_elicitation.build_resume import build

result = build(optimised_md_path, "out/resume.docx", theme="navy", pdf=False)
if result["blockers"]:
    ...          # refuse to hand over a structurally broken file
send(result["docx"])
```

`result` carries `docx`, `pdf`, `spec`, `blocks`, `renamed`, `blockers`,
`warnings`, and `stats` (`words`, `pages`, `chars`) — enough to show the user
an audit panel without re-parsing anything.
