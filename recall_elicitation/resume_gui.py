#!/usr/bin/env python3
"""
resume_gui.py - pick a resume.md, pick where the .docx goes, press Build.

    python recall_elicitation/resume_gui.py

Tkinter only, which ships with CPython - so after `git clone` the sole install
step is `pip install -r recall_elicitation/requirements.txt`. No server, no
browser, no extra GUI dependency.

This is a front end over build_resume.build(); all the real work lives there.
"""
from __future__ import annotations

import os
import subprocess
import sys
import threading
import traceback

import tkinter as tk
from tkinter import filedialog, messagebox, ttk

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_resume
import render_resume

PAD = 10


class App:
    def __init__(self, root):
        self.root = root
        root.title("Resume - Markdown to Word")
        root.minsize(760, 560)

        self.src = tk.StringVar()
        self.dst = tk.StringVar()
        self.theme = tk.StringVar(value="navy")
        self.want_pdf = tk.BooleanVar(value=False)
        self.busy = False

        self.soffice = render_resume.find_soffice()

        frm = ttk.Frame(root, padding=PAD)
        frm.pack(fill="both", expand=True)
        frm.columnconfigure(1, weight=1)
        r = 0

        # ---------------------------------------------------------- input
        ttk.Label(frm, text="Resume Markdown", font=("Segoe UI", 9, "bold")) \
            .grid(row=r, column=0, columnspan=3, sticky="w")
        r += 1
        ttk.Entry(frm, textvariable=self.src).grid(
            row=r, column=0, columnspan=2, sticky="ew", padx=(0, 6), ipady=3)
        ttk.Button(frm, text="Browse…", command=self.pick_src, width=12) \
            .grid(row=r, column=2, sticky="e")
        r += 1
        ttk.Label(frm, text="The .md file to convert.",
                  foreground="#666").grid(row=r, column=0, columnspan=3,
                                          sticky="w", pady=(1, PAD))
        r += 1

        # --------------------------------------------------------- output
        ttk.Label(frm, text="Save Word file to", font=("Segoe UI", 9, "bold")) \
            .grid(row=r, column=0, columnspan=3, sticky="w")
        r += 1
        ttk.Entry(frm, textvariable=self.dst).grid(
            row=r, column=0, columnspan=2, sticky="ew", padx=(0, 6), ipady=3)
        ttk.Button(frm, text="Browse…", command=self.pick_dst, width=12) \
            .grid(row=r, column=2, sticky="e")
        r += 1
        ttk.Label(frm, text="Filled in automatically when you pick the Markdown "
                            "file - change it if you want it elsewhere.",
                  foreground="#666").grid(row=r, column=0, columnspan=3,
                                          sticky="w", pady=(1, PAD))
        r += 1

        # --------------------------------------------------------- options
        opts = ttk.Frame(frm)
        opts.grid(row=r, column=0, columnspan=3, sticky="ew", pady=(0, PAD))
        ttk.Label(opts, text="Theme").pack(side="left")
        ttk.Combobox(opts, textvariable=self.theme, width=12, state="readonly",
                     values=sorted(render_resume.THEMES)).pack(side="left",
                                                               padx=(6, 20))
        pdf_box = ttk.Checkbutton(opts, text="Also write a PDF",
                                  variable=self.want_pdf)
        pdf_box.pack(side="left")
        if not self.soffice:
            pdf_box.state(["disabled"])
            ttk.Label(opts, text="(needs LibreOffice)", foreground="#888") \
                .pack(side="left", padx=(6, 0))
        r += 1

        # ----------------------------------------------------------- build
        self.go = ttk.Button(frm, text="Build resume", command=self.build)
        self.go.grid(row=r, column=0, columnspan=3, sticky="ew", ipady=6)
        r += 1

        self.status = ttk.Label(frm, text="", font=("Segoe UI", 9, "bold"))
        self.status.grid(row=r, column=0, columnspan=3, sticky="w", pady=(PAD, 4))
        r += 1

        # ------------------------------------------------------------- log
        frm.rowconfigure(r, weight=1)
        wrap = ttk.Frame(frm)
        wrap.grid(row=r, column=0, columnspan=3, sticky="nsew")
        wrap.rowconfigure(0, weight=1)
        wrap.columnconfigure(0, weight=1)
        self.log = tk.Text(wrap, height=14, wrap="word", relief="flat",
                           background="#fbfbfb", font=("Consolas", 9),
                           padx=8, pady=8)
        self.log.grid(row=0, column=0, sticky="nsew")
        sb = ttk.Scrollbar(wrap, command=self.log.yview)
        sb.grid(row=0, column=1, sticky="ns")
        self.log.config(yscrollcommand=sb.set, state="disabled")
        for tag, col in (("ok", "#1a7f37"), ("warn", "#9a6700"),
                         ("bad", "#b3261e"), ("dim", "#666666"),
                         ("head", "#1F3A5F")):
            self.log.tag_config(tag, foreground=col)
        self.log.tag_config("head", font=("Consolas", 9, "bold"))
        r += 1

        self.open_btn = ttk.Button(frm, text="Open output folder",
                                   command=self.open_folder, state="disabled")
        self.open_btn.grid(row=r, column=2, sticky="e", pady=(PAD, 0))

        self.write("Pick a Markdown resume and press Build.\n", "dim")

    # ------------------------------------------------------------ helpers
    def write(self, text, tag=None):
        self.log.config(state="normal")
        self.log.insert("end", text, tag or ())
        self.log.see("end")
        self.log.config(state="disabled")

    def clear(self):
        self.log.config(state="normal")
        self.log.delete("1.0", "end")
        self.log.config(state="disabled")

    def pick_src(self):
        path = filedialog.askopenfilename(
            title="Choose the resume Markdown file",
            filetypes=[("Markdown", "*.md"), ("All files", "*.*")])
        if not path:
            return
        self.src.set(os.path.normpath(path))
        # Default the output beside the source, in build/, same base name.
        base = os.path.splitext(os.path.basename(path))[0]
        root_dir = os.path.dirname(os.path.dirname(os.path.abspath(path)))
        self.dst.set(os.path.normpath(
            os.path.join(root_dir, "build", base + ".docx")))

    def pick_dst(self):
        initial = self.dst.get() or "resume.docx"
        path = filedialog.asksaveasfilename(
            title="Save the Word file as",
            defaultextension=".docx",
            initialfile=os.path.basename(initial),
            initialdir=os.path.dirname(initial) or os.getcwd(),
            filetypes=[("Word document", "*.docx")])
        if path:
            self.dst.set(os.path.normpath(path))

    def open_folder(self):
        out = self.dst.get()
        folder = os.path.dirname(os.path.abspath(out))
        if not os.path.isdir(folder):
            return
        if sys.platform == "win32":
            os.startfile(folder)
        elif sys.platform == "darwin":
            subprocess.run(["open", folder])
        else:
            subprocess.run(["xdg-open", folder])

    # -------------------------------------------------------------- build
    def build(self):
        if self.busy:
            return
        src, dst = self.src.get().strip(), self.dst.get().strip()
        if not src or not os.path.isfile(src):
            messagebox.showwarning("Pick a file first",
                                   "Choose the resume Markdown file to convert.")
            return
        if not dst:
            messagebox.showwarning("Pick a destination",
                                   "Choose where to save the Word file.")
            return

        self.busy = True
        self.go.state(["disabled"])
        self.open_btn.state(["disabled"])
        self.status.config(text="Building…", foreground="#666")
        self.clear()
        self.write("%s\n  → %s\n\n" % (src, dst), "dim")

        threading.Thread(target=self._work, args=(src, dst), daemon=True).start()

    def _work(self, src, dst):
        try:
            res = build_resume.build(
                src, dst, theme=self.theme.get(),
                pdf=self.want_pdf.get() and bool(self.soffice),
                keep_spec=False)
            self.root.after(0, self._done, res, None)
        except Exception:
            self.root.after(0, self._done, None, traceback.format_exc())

    def _done(self, res, err):
        self.busy = False
        self.go.state(["!disabled"])

        if err:
            self.status.config(text="Build failed", foreground="#b3261e")
            self.write("The build did not finish:\n\n", "bad")
            self.write(err, "dim")
            return

        # What the Markdown actually parsed into - the tell for a bad parse.
        self.write("Parsed\n", "head")
        for k, v in sorted(res['blocks'].items()):
            self.write("  %-9s %d\n" % (k, v))
        if not res['blocks'].get('section'):
            self.write("  No sections found - the Markdown headings did not "
                       "match the expected format.\n", "warn")
        for old, new in res['renamed']:
            self.write("  renamed %r -> %r for ATS\n" % (old, new), "dim")

        self.write("\nATS audit\n", "head")
        for level, check, detail in res['report'].rows:
            tag = {"PASS": "ok", "WARN": "warn", "BLOCKER": "bad"}[level]
            mark = {"PASS": "ok   ", "WARN": "warn ", "BLOCKER": "BLOCK"}[level]
            self.write("  %s %-26s %s\n" % (mark, check, detail), tag)

        st = res['stats']
        self.write("\n%d words, about %d page(s)\n" % (st['words'], st['pages']),
                   "dim")
        self.write("Wrote %s\n" % res['docx'])
        if res['pdf']:
            self.write("Wrote %s\n" % res['pdf'])

        if res['blockers']:
            self.status.config(
                text="Built, but %d ATS blocker(s) - do not send this yet"
                     % len(res['blockers']), foreground="#b3261e")
        elif res['warnings']:
            self.status.config(
                text="Done - no blockers, %d warning(s)" % len(res['warnings']),
                foreground="#9a6700")
        else:
            self.status.config(text="Done - clean", foreground="#1a7f37")
        self.open_btn.state(["!disabled"])


def main():
    root = tk.Tk()
    try:
        ttk.Style().theme_use("vista" if sys.platform == "win32" else "clam")
    except tk.TclError:
        pass
    App(root)
    root.mainloop()


if __name__ == '__main__':
    main()
