# The Atelier

An oasis masjid at first light, rendered behind the portfolio menu, with a scholar
— **Al-Kātib** — living in it. He walks between stations, works, and when he has
something to test you on he stops and raises a **!**. When he has run out of things
to test you on, he raises a **?** and asks you to dictate something new.

The illusion only works because the marks are never on a timer:

- **!** = a node in the skill tree is genuinely testable (unlocked, not yet verified).
- **?** = every unlocked node is verified, so he needs new material from you.

## Files

| File | What it owns |
|---|---|
| `scene.js` | The 3D world and the scholar's *body* — geometry, walking, poses, camera. Knows nothing about knowledge. |
| `tree.js` | The skill tree, the question banks and their rubrics, scoring, and `localStorage` persistence. |
| `brain.js` | Grading and question-writing, in two tiers (see below). |
| `app.js` | Wiring: decides what floats over his head, runs the dialogue, draws the atlas. |
| `atelier.css` | Every panel that floats over the canvas. |

## Two tiers of mind

**Tier 1 — the rubric (default).** Every seeded node carries two questions and a
keyed rubric: a list of points a full answer covers, each with a set of synonyms.
Scoring is `points hit / points total`, and the miss list is what you failed to
mention. It is crude next to a language model, but it is deterministic, instant,
needs no download, and it can tell you *exactly* what you left out — which is the
part that teaches.

**Tier 2 — WebLLM (opt-in).** Clicking "Awaken his mind" downloads a model that
then runs in-page over WebGPU, the same approach as `web/ask.html`. He writes his
own questions from your notes, judges in prose, and greets you in character. Every
tier-2 path falls back to tier 1 on failure, so he always has something to ask.
The choice is remembered, and a device that already downloaded the model gets it
back from cache without being asked again.

## Feeding him

Dialogue only — there is no paste box on the page. Anything you dictate becomes:

1. a **scroll** (raw text he can quote back at you), and
2. a **custom node** in the tree, at its own tier.

Custom nodes have no rubric, because there is no rubric for your own notes. With
the model awake it compares your recall against what you originally dictated; with
it asleep, you are shown your own words back and grade yourself. That is what
spaced recall actually is.

## The 3D, and why it's built this way

No `.glb`, no textures, no asset hosting: the masjid, palms, fountain, stations and
the scholar himself are all assembled from Three.js primitives at runtime, with
toon shading over a four-band ramp. The scholar's face is drawn to a canvas and
mapped onto a patch of the head sphere so it curves with the skull rather than
floating as a billboard.

Camera framing is computed from the viewport: on wide screens the courtyard is
aimed left of centre so the docked menu doesn't sit on top of it, and on narrow
screens the camera pulls back rather than widening into a fisheye. Rendering stops
entirely when the tab is hidden.

## Running it

Needs to be served over HTTP — ES modules and the Three.js import will not load
from `file://`:

```bash
powershell -ExecutionPolicy Bypass -File dev/serve.ps1
```

Then open <http://localhost:8000/>.

## Adding to the tree

Append to `NODES` in `tree.js`. A node needs `id`, `tier`, `requires`, `station`
(`kutub` / `musalla` / `maktab` / `sabil`), `title`, `blurb`, and `questions`, where
each question is `{ q, rubric: [{ label, any: [synonyms] }] }`. Synonyms are matched
after diacritics and punctuation are folded, so `Ṭahārah` and `taharah` compare
equal. Status is derived from `requires` at read time, so a node cannot be reached
before what it rests on is verified.

The seeded content is standard, widely-taught Sunni textbook material, written to
exercise recall. It is not fatwa; the atlas says so too.
