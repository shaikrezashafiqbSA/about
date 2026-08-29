#!/usr/bin/env python3
"""
build_resume.py - one command: resume.md -> resume.docx (+ PDF) + ATS audit

    python recall_elicitation/build_resume.py content/my_resume.md
    python recall_elicitation/build_resume.py content/my_resume.md -o out/cv.docx --pdf
    python recall_elicitation/build_resume.py content/my_resume.md --theme teal

This is the entry point the web workflow will call. Everything it does is
also available as a library:

    from recall_elicitation.build_resume import build
    result = build("resume.md", "resume.docx", theme="navy", pdf=False)
    # result -> {"docx":..., "pdf":..., "spec":..., "blockers":[...], "stats":{...}}

The build FAILS (exit 1) if the audit finds a blocker, so a broken resume
can never be silently shipped to an employer.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import ats_check
import md_to_spec
import render_resume


def build(source, output=None, theme="navy", pdf=False, canonical=True,
          keep_spec=True):
    """Markdown -> docx. Returns a dict describing everything produced."""
    output = output or os.path.splitext(source)[0] + ".docx"
    outdir = os.path.dirname(os.path.abspath(output))
    os.makedirs(outdir, exist_ok=True)

    with open(source, encoding='utf-8') as fh:
        parser = md_to_spec.Parser(canonical=canonical)
        spec = parser.parse(fh.read())

    spec_path = os.path.splitext(output)[0] + ".spec.json"
    if keep_spec:
        with open(spec_path, 'w', encoding='utf-8') as fh:
            json.dump(spec, fh, indent=2, ensure_ascii=False)

    render_resume.render(spec, output, theme)

    pdf_path = render_resume.to_pdf(output) if pdf else None
    report, stats = ats_check.audit(output)

    kinds = {}
    for b in spec['blocks']:
        kinds[b['t']] = kinds.get(b['t'], 0) + 1

    return {
        "docx": output,
        "pdf": pdf_path,
        "spec": spec_path if keep_spec else None,
        "blocks": kinds,
        "renamed": parser.renamed,
        "report": report,
        "stats": stats,
        "blockers": [(c, d) for _, c, d in report.blockers],
        "warnings": [(c, d) for _, c, d in report.warnings],
    }


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser(
        description="Build an ATS-safe .docx resume from Markdown.")
    ap.add_argument('source', help='resume .md')
    ap.add_argument('-o', '--output', help='.docx path (default: alongside source)')
    ap.add_argument('--theme', default='navy',
                    choices=sorted(render_resume.THEMES))
    ap.add_argument('--pdf', action='store_true', help='also write a PDF')
    ap.add_argument('--no-canonical', action='store_true',
                    help='keep section headings exactly as written')
    a = ap.parse_args()

    r = build(a.source, a.output, a.theme, a.pdf, not a.no_canonical)

    print()
    print("BUILD  %s -> %s" % (a.source, r['docx']))
    print("-" * 72)
    print("  blocks   " + ", ".join("%s=%d" % kv for kv in sorted(r['blocks'].items())))
    for old, new in r['renamed']:
        print("  renamed  %r -> %r  (ATS canonical)" % (old, new))
    print("  theme    %s" % a.theme)
    print("  size     %.1f KB" % (os.path.getsize(r['docx']) / 1024))
    if r['pdf']:
        print("  pdf      %s" % r['pdf'])

    for level, check, detail in r['report'].rows:
        if level == 'PASS':
            continue
        print("  %-8s %s: %s" % (level, check, detail))

    print("-" * 72)
    print("  %d blockers, %d warnings   |   %d words, ~%d page(s)"
          % (len(r['blockers']), len(r['warnings']),
             r['stats']['words'], r['stats']['pages']))
    print()
    return 1 if r['blockers'] else 0


if __name__ == '__main__':
    sys.exit(main())
