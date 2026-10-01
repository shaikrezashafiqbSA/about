# about

Portfolio site for Shaik Reza Shafiq. Static, no build step, no backend — deployable
straight to GitHub Pages.

| Path | What it is |
|---|---|
| `index.html` | The landing page: a crystal palace, drawn in code, where a scribe (you can walk him around) studies, writes and forges swords. Menu docked right. See `web/sanctuary/README.md`. |
| `web/render.html` | The styled CV, rendered from `content/`. |
| `web/sanctuary/` | The 2D scene, the scribe, his controls, and the "Speak with him" chat behind `index.html`. |
| `content/` | Resume and pitch in Markdown — the source of truth for the pages above and the chat. |
| `dev/serve.ps1` | Minimal local static server. |

**Resume Render** (markdown → styled CV / .docx) lives in its own repo and is linked from the menu:
<https://shaikrezashafiqbsa.github.io/md-to-docx-resume/>
