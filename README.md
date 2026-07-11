# Dieline → Box

Upload a 2D dieline (cut/crease layout), watch it fold shut into a 3D box, orbit it.
Built for the SiviQuant Labs build challenge.

## Run it

```bash
npm install
npm run dev
```

Open the printed local URL. The sample dieline loads automatically; use
**Upload dieline** to try your own PNG/JPG export of a cut file.

## How it works

**`src/dielineParser.js`** reads the image and produces a fold tree:

1. Rasterize the upload, classify each pixel as background, cut (green),
   or crease (red) - downsampled with block-min sampling so thin 1-2px
   lines survive instead of blurring away.
2. Flood-fill the background to find each enclosed panel's bounding box.
3. For every pair of touching panels, sample the shared border color.
   Red = hinged (crease). Green = just adjacent through a cut, no hinge.
4. Some dielines don't draw a line for every joint at all, so a colorless
   touch is still kept as a fallback hinge - just lower priority than a
   real drawn crease.
5. Build a tree from the largest panel outward, always preferring real
   crease edges over fallback ones (0-1 BFS).

**`src/FoldScene.jsx`** turns that tree into nested Three.js groups, one
per hinge, each parented to its own parent panel like a real hinge. Every
panel's fold direction comes from one rule: rotate it so its centroid
swings toward +Y relative to its own parent's current frame. Because
Three.js composes parent/child transforms automatically, that single rule
recursively closes the whole box - nothing about "this is the front" or
"this is a flap" is hardcoded.

Fold progress is one 0→1 value (the scrubber), staggered by tree depth so
hinges close in sequence, and kept in a ref rather than React state so
animating doesn't trigger re-renders.

## Known limitation

PDF upload isn't parsed directly - export/screenshot the dieline as a PNG
first.
