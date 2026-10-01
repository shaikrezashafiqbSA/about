# The Sanctuary

A floating-island palace in golden light, seen in cutaway on a 2D canvas behind the
portfolio menu, with **Al-Katib**, the scribe, living in it. The look is built from
painted assets cut from two reference paintings (`assets/art/`, see its README) plus
inked, hatched vector drawing in the same spirit; there is no darkness, fog or vignette.

## The place (bottom to top)

- **River and glass floor.** A river runs through the island's rock under the forge's
  glass floor and pours off the cliff as a waterfall into a painted valley. He is
  reflected in the glass.
- **Basement: the forge.** Ore, bellows, furnace, anvil, quench trough, grindstone, rack.
- **Ground floor: the library and the desk, side by side.** A flying carpet is the lift
  between floors; it sweeps over to him when he needs it.
- **Top floor: a walled garden and a prayer hall** (fountain, palms, pomegranates, a
  mihrab niche). Two men periodically climb a ladder against the garden wall and drop in.
- **Outside:** painted far palaces and floating islands (parallax), armies marching on the
  hills without end, birds, and ants carrying crumbs up their mound and into the nest
  (with the tunnels cut away in the soil).

## What he does (a loop, or click the library / desk / forge to send him)

1. **Studies:** twelve books leave the shelves, open, flutter in a ring of sparks, and
   pour into his head, then return.
2. **Scribes:** Arabic calligraphy and drawings of gardens, fruit and living things
   appear on the framed parchment as he writes.
3. **Forges:** ore to sword, the whole chain, ending on the rack (each sword is counted in
   `localStorage`).

## The camera

Deliberately zoomed out (`VIEW_X` in `scene.js`), but not static: it leads in the direction
he walks, eases in for the hammer, the pour, the grinder, the quill and the books, eases out
while he travels, drifts slowly, jolts a little when the hammer lands, and the far world
slides at a fraction of the camera's pace for parallax. It keeps the world out of the menu's
way (the menu can be collapsed with the button beside it).

## Files

| File | What it owns |
|---|---|
| `art.js` | How everything looks: asset loading, the baked palace, the sky/hills/armies/ants backdrop, the rigged scribe, tools, parchment drawings, `LAYOUT` and `STATIONS`. |
| `scene.js` | What happens: his jobs (generators), the carpet, fire/metal/sparks, the library sequence, camera, input. |
| `chat.js` | Preset answers and the on-device model engines. |
| `app.js` | Wiring: ticker, dialogue panel, menu. |
| `sanctuary.css` | Everything that floats over the canvas. |

## Speak with Al-Katib

Preset questions are hand-written from `content/elevator_pitch.md` and the CV and answer
instantly. A free question needs the opt-in on-device model (WebLLM over WebGPU, or Chrome's
Gemini Nano), grounded only in the bio and CV. Nothing leaves the browser.

## Running it

Needs HTTP (ES modules, images and `fetch` don't work from `file://`):

```bash
powershell -ExecutionPolicy Bypass -File dev/serve.ps1
```

Then open <http://localhost:8000/>.
