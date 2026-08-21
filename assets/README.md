# Background images

`index.html` looks for two files here and crossfades between them:

- `assets/bg-1.jpg`
- `assets/bg-2.jpg`

Drop your own images at those exact filenames and reload the page — no code changes needed. If the files are missing, the page falls back to the plain background colour it already had; missing background-images don't show a broken-image icon or throw an error.

## Recommendations

- **Landscape, roughly 1920×1080 or larger.** Both images cover the full viewport, so anything smaller will upscale and blur.
- **Similar tone/exposure between the two.** They crossfade into each other every ~16s, and a big brightness jump between them reads as a flash rather than a drift.
- **Keep the center of the frame relatively uncluttered.** The card sits centered on top; a busy midground fights the resume text.
- **JPEG at ~80% quality** is a good size/quality tradeoff for a background photo; keep each file well under 1MB if possible so the page stays fast to load.

## Why crossfade instead of a literal flag-wave

A cloth-simulation wave effect needs an SVG displacement filter or canvas physics loop — real GPU/CPU cost, and easy to make look janky on lower-end laptops. The slow crossfade + subtle zoom (Ken Burns) used here gets the same "the page is alive" feeling at effectively zero performance cost, which fits a resume site better: the motion should support the content, not compete with it.
