# about

Portfolio site for Shaik Reza Shafiq. Static, no build step, no backend — deployable
straight to GitHub Pages.

| Path | What it is |
|---|---|
| `index.html` | The landing page: a crystal palace, drawn in code, where a scribe (you can walk him around) studies, writes and forges swords. Menu docked right. See `web/sanctuary/README.md`. |
| `web/sanctuary/` | The 2D scene, the scribe, his controls, and the "Talk to me" contact card behind `index.html`. |
| `web/skills.html`, `web/skilltree/` | The career skill tree, read at runtime from `content/my-skills-tree.md`. Owner report on localhost or with `?edit`. |
| `content/my-skills-tree.md` | The source of truth for the skill tree. Public: edit it here or on github.com and the tree updates on the next load. |
| `content/private/private-notes.md` | **Gitignored.** Contact details, interview notes, claim boundaries and reasons for leaving, keyed by EU ID. The skill tree shows them only on your own machine. |
| `content/Shaik_Reza_Shafiq_Resume.md` | The CV in Markdown. |
| `dev/test-parser.html` | Browser-run checks of the skill tree parser, and that the public file leaks nothing private. |
| `dev/serve.ps1` | Minimal local static server. |

**Resume Render** (markdown → styled CV / .docx) lives in its own repo and is linked from the menu:
<https://shaikrezashafiqbsa.github.io/md-to-docx-resume/>
