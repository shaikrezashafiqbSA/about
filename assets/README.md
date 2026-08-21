# Background images

**No longer used.** `index.html` used to crossfade `bg-1.jpg` and `bg-2.jpg` as a
full-viewport backdrop. That backdrop has been replaced by the 3D oasis masjid the
page now renders itself (see `web/atelier/README.md`), which draws its own sky,
sand and light.

`bg-1.jpg` and `bg-2.jpg` are still here and are safe to delete if you don't want
them for anything else — nothing references them.

## If you want a photographic backdrop again

The crossfade was about 25 lines of CSS in `index.html`: two fixed `.bg-layer`
elements with a `bgCrossfade` keyframe animation and a translucent `.bg-wash` over
the top. It's in the git history (`git log -- index.html`) if it's ever wanted back.
Note that it and the WebGL canvas would fight for the same space — you'd want one or
the other, not both.
