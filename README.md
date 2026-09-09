# Resume Render

Markdown resume in, formatted `.docx` out. Runs as a static page on GitHub Pages.
No build step, no server, no upload: the file is parsed and the Word document is
packaged entirely in your browser.

## Use it

The middle column is a Markdown editor. Type in it and the A4 preview on the
right rebuilds as you go, from the same model that packages the `.docx`.

1. Write, or paste a resume, into the editor. **Open file** and dropping a `.md`
   onto the editor both load a file into it. From Google Docs, use
   **File → Download → Markdown (.md)**.
2. Type the organisation name. It is substituted into the first section heading.
3. Rename any section heading you want.
4. Press **Download .docx** and drag the result back into Drive.

Your draft, heading names, organisation and theme are kept in this browser's
local storage, so a reload picks up where you left off. **Sample** replaces the
editor with the bundled resume.

Opening `index.html` straight off disk works, but the browser will block loading
the bundled sample. Type or paste instead, or serve the folder over HTTP.

## Section headings

Headings in the source are matched to seven fixed slots and always render in this
order, whatever order they appeared in:

| Slot | Default heading |
| --- | --- |
| `SUMMARY` | WHO I AM & THE VALUE I BRING TO [ORGANISATION NAME] |
| `SKILLS` | SKILLS AND CORE COMPETENCIES |
| `EXPERIENCE` | PROFESSIONAL EXPERIENCE |
| `EDUCATION` | EDUCATION |
| `CERTIFICATIONS` | CERTIFICATIONS AND PROFESSIONAL DEVELOPMENT |
| `COMMUNITY` | COMMUNITY ENGAGEMENT |
| `LANGUAGES` | LANGUAGES |

Matching is by keyword, so `Professional Summary`, `Profile` and `About Me` all
land in `SUMMARY`. A heading that matches nothing keeps its own name and is
placed after the seven. The `[ORGANISATION NAME]` token is replaced by whatever
you type; leave the field empty and the whole `TO [ORGANISATION NAME]` clause
disappears, so the heading still reads as a sentence.

Edit the defaults in `js/parse.js` if you want different starting text.

## Markdown the parser understands

It targets the dialect Google Docs and language models actually emit, not clean
CommonMark. Both work.

```
**SHAIK REZA SHAFIQ**                    first bold line   -> name
Singapore | +65 ... | [LinkedIn](url)    next line         -> contact
**Headline | With | Pipes**              next bold line    -> headline
MSc Quantitative Finance                 next plain line   -> tagline

**PROFESSIONAL SUMMARY**                 all-caps bold     -> section heading
## Professional Summary                  ATX equivalent    -> section heading
**Role | Organisation** *Dates*                            -> job
**Degree** - School *Year*               inside EDUCATION  -> qualification
***Sub-block heading***                                    -> subheading
*Guiding Principle: ...*                                   -> callout
*Any other italic line*                                    -> scope note
* **Label:** body text                                     -> bullet with label
| Category | items |                     two-column table  -> "Category: items"
```

Tables are flattened to `Label: items` paragraphs rather than rendered as tables.
The document is one linear column by design, and text inside a table cell sits
outside that stream.

Inline `**bold**`, `*italic*` and `[text](url)` are honoured everywhere. Nothing
else is parsed.

## Page limit

The preview is A4 at the same margins and type scale as the `.docx`, with a
dashed rule at each page boundary. The page count is an estimate, because a
browser and Word break lines differently. Treat three-and-a-bit as "open it in
Word and check".

Over three pages, trim in this order: Languages, then Community Engagement, then
the lowest-relevance bullets in the oldest roles first.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Three-column layout, styling, theme tokens |
| `js/parse.js` | Markdown → ordered sections and blocks |
| `js/render.js` | Blocks → `.docx`, page geometry and type scale |
| `js/app.js` | Editor, panel, live preview, page ruler, download |
| `content/` | Sample and working resumes |

The only external dependency is the `docx` library, pinned to 9.7.1 and loaded
from a CDN. Vendor it into the repo if you want the page to work offline.

## Deploy

Push to GitHub, then in the repository settings enable Pages from the `main`
branch at the root. There is nothing to build.

## Not included

No ATS scoring, no job-description matching, no Google Drive integration. Drive
read and write from a Pages site is possible, but it needs a Google Cloud
project, an OAuth client ID, an API key, and your Pages origin registered as an
allowed source. Downloading and dragging the file back is one step and no setup.
