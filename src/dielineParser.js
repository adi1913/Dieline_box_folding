// Reads a dieline image (white background, green cut lines, red crease
// lines) and turns it into panels + a fold tree.
//
// Steps:
// 1. classify each pixel as background / cut / crease
// 2. flood fill the background to find each panel's bounding box
// 3. for touching panels, check the color of the shared border:
//    red = hinged (crease), green = just adjacent (cut, no hinge)
// 4. build a tree from the largest panel outward using those hinges

const WHITE = 245;
const MAX_SIZE = 1500;

function classify(r, g, b) {
  if (r > WHITE && g > WHITE && b > WHITE) return 'bg';
  if (g > r + 12 && g > b + 12) return 'cut';
  if (r > g + 12 && r > b + 12) return 'crease';
  return 'other';
}

// draw the image onto a canvas, downscaled with block-min sampling so thin
// lines survive (a normal resize would blur 1px lines away)
function rasterize(img) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) throw new Error('This file has no image data to read.');

  const src = document.createElement('canvas');
  src.width = iw;
  src.height = ih;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const data = sctx.getImageData(0, 0, iw, ih).data;

  const block = Math.max(1, Math.floor(Math.max(iw, ih) / MAX_SIZE));
  const W = Math.floor(iw / block);
  const H = Math.floor(ih / block);
  if (W < 8 || H < 8) throw new Error('This image is too small to read as a dieline.');

  const label = new Uint8Array(W * H); // 0 bg, 1 cut, 2 crease
  const rr = new Uint8Array(W * H);
  const gg = new Uint8Array(W * H);
  const bb = new Uint8Array(W * H);

  for (let by = 0; by < H; by++) {
    for (let bx = 0; bx < W; bx++) {
      let cutVotes = 0, creaseVotes = 0, otherVotes = 0, sr = 0, sg = 0, sb = 0, n = 0;
      for (let dy = 0; dy < block; dy++) {
        const py = by * block + dy;
        if (py >= ih) continue;
        for (let dx = 0; dx < block; dx++) {
          const px = bx * block + dx;
          if (px >= iw) continue;
          const idx = (py * iw + px) * 4;
          const r = data[idx], g = data[idx + 1], b = data[idx + 2];
          const c = classify(r, g, b);
          if (c === 'cut') cutVotes++;
          else if (c === 'crease') creaseVotes++;
          else if (c === 'other') otherVotes++;
          sr += r; sg += g; sb += b; n++;
        }
      }
      const i = by * W + bx;
      if (cutVotes === 0 && creaseVotes === 0 && otherVotes === 0) label[i] = 0;
      else if (cutVotes >= creaseVotes && cutVotes >= otherVotes) label[i] = 1;
      else label[i] = 2;
      rr[i] = sr / n; gg[i] = sg / n; bb[i] = sb / n;
    }
  }
  return { W, H, label, rr, gg, bb };
}

// flood fill the background pixels to find each enclosed panel shape
function findPanels(W, H, label) {
  const seen = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  const panels = [];

  for (let start = 0; start < W * H; start++) {
    if (label[start] !== 0 || seen[start]) continue;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    let minX = W, maxX = -1, minY = H, maxY = -1, area = 0, border = false;

    while (sp > 0) {
      const cell = stack[--sp];
      const x = cell % W, y = (cell / W) | 0;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border = true;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (label[ni] === 0 && !seen[ni]) { seen[ni] = 1; stack[sp++] = ni; }
      }
    }
    if (!border && area > W * H * 0.0006) panels.push(makePanel(minX, maxX, minY, maxY));
  }
  return panels;
}

let idCounter = 0;
function makePanel(minX, maxX, minY, maxY) {
  return {
    id: `p${idCounter++}`,
    minX, maxX, minY, maxY,
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

// some dielines draw the fold line between two side-by-side wall panels as
// tiny tick marks (or nothing at all) instead of a full line, so they come
// out of findPanels() as one fused blob. If a panel is a lot wider/taller
// than the tallest row/column it belongs to, split it evenly and hinge the
// pieces directly (we know they're connected - we just made the cut).
function splitFusedPanels(panels) {
  const maxH = Math.max(...panels.map((p) => p.height));
  const maxW = Math.max(...panels.map((p) => p.width));
  const out = [];
  const forcedEdges = [];

  for (const p of panels) {
    const wallRow = p.height > maxH * 0.85 && p.width / p.height > 2.15;
    const wallCol = p.width > maxW * 0.85 && p.height / p.width > 2.15;
    if (!wallRow && !wallCol) { out.push(p); continue; }

    const n = wallRow
      ? Math.min(4, Math.max(2, Math.round(p.width / p.height)))
      : Math.min(4, Math.max(2, Math.round(p.height / p.width)));
    const pieces = [];
    for (let i = 0; i < n; i++) {
      pieces.push(wallRow
        ? makePanel(p.minX + (p.width / n) * i, p.minX + (p.width / n) * (i + 1), p.minY, p.maxY)
        : makePanel(p.minX, p.maxX, p.minY + (p.height / n) * i, p.minY + (p.height / n) * (i + 1)));
    }
    out.push(...pieces);
    for (let i = 0; i < n - 1; i++) {
      forcedEdges.push(wallRow
        ? { a: pieces[i].id, b: pieces[i + 1].id, orientation: 'vertical', hingeCoord: pieces[i].maxX, lo: p.minY, hi: p.maxY, isCrease: true }
        : { a: pieces[i].id, b: pieces[i + 1].id, orientation: 'horizontal', hingeCoord: pieces[i].maxY, lo: p.minX, hi: p.maxX, isCrease: true });
    }
  }
  return { panels: out, forcedEdges };
}

function sampleColor(field, x, y) {
  const xi = Math.max(0, Math.min(field.W - 1, Math.round(x)));
  const yi = Math.max(0, Math.min(field.H - 1, Math.round(y)));
  const i = yi * field.W + xi;
  return [field.rr[i], field.gg[i], field.bb[i]];
}

// for each pair of touching panels, decide if the border is a crease
// (hinge) or a cut (no hinge) by sampling colors along it
function findEdges(panels, field) {
  const TOL = Math.max(3, Math.round(Math.max(field.W, field.H) * 0.006));
  const edges = [];

  const sample = (orientation, coord, lo, hi) => {
    let crease = 0, cut = 0;
    for (let s = 0; s <= 12; s++) {
      const t = lo + ((hi - lo) * s) / 12;
      for (const off of [-1, 0, 1]) {
        const [r, g, b] = orientation === 'vertical'
          ? sampleColor(field, coord + off, t)
          : sampleColor(field, t, coord + off);
        const c = classify(r, g, b);
        if (c === 'crease') crease++;
        else if (c === 'cut') cut++;
      }
    }
    // real dielines don't always draw a line for every joint - keep a
    // colorless touch as a low-priority hinge so the sheet stays connected
    return crease > cut;
  };

  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      const a = panels[i], b = panels[j];

      if (Math.abs(a.maxX - b.minX) <= TOL || Math.abs(b.maxX - a.minX) <= TOL) {
        const overlap = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
        if (overlap > TOL * 3) {
          const [left, right] = a.maxX <= b.minX ? [a, b] : [b, a];
          const coord = (left.maxX + right.minX) / 2;
          const lo = Math.max(a.minY, b.minY) + TOL, hi = Math.min(a.maxY, b.maxY) - TOL;
          edges.push({ a: a.id, b: b.id, orientation: 'vertical', hingeCoord: coord, lo, hi, isCrease: sample('vertical', coord, lo, hi) });
          continue;
        }
      }
      if (Math.abs(a.maxY - b.minY) <= TOL || Math.abs(b.maxY - a.minY) <= TOL) {
        const overlap = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
        if (overlap > TOL * 3) {
          const [top, bottom] = a.maxY <= b.minY ? [a, b] : [b, a];
          const coord = (top.maxY + bottom.minY) / 2;
          const lo = Math.max(a.minX, b.minX) + TOL, hi = Math.min(a.maxX, b.maxX) - TOL;
          edges.push({ a: a.id, b: b.id, orientation: 'horizontal', hingeCoord: coord, lo, hi, isCrease: sample('horizontal', coord, lo, hi) });
        }
      }
    }
  }
  return edges;
}

// build a tree from the biggest panel outward, preferring real crease
// edges over colorless fallback ones (0-1 BFS via a deque)
function buildFoldTree(panels, edges) {
  const byId = new Map(panels.map((p) => [p.id, p]));
  const adj = new Map(panels.map((p) => [p.id, []]));
  for (const e of edges) {
    adj.get(e.a).push({ other: e.b, edge: e });
    adj.get(e.b).push({ other: e.a, edge: e });
  }

  const root = [...panels].sort((x, y) => y.width * y.height - x.width * x.height)[0];
  const nodes = new Map([[root.id, { id: root.id, panel: root, parentId: null, depth: 0 }]]);
  const deque = [root.id];

  while (deque.length) {
    const cur = deque.shift();
    for (const { other, edge } of adj.get(cur)) {
      if (nodes.has(other)) continue;
      const panel = byId.get(other);
      const hingeMid = edge.orientation === 'vertical'
        ? { u: edge.hingeCoord, v: (edge.lo + edge.hi) / 2 }
        : { u: (edge.lo + edge.hi) / 2, v: edge.hingeCoord };

      // fold direction: swing the panel so its centroid moves toward +Y,
      // relative to its own parent's frame. Applied recursively through
      // three.js's parent/child transforms, this alone closes the box.
      let axis, angleSign;
      if (edge.orientation === 'vertical') {
        axis = 'z';
        angleSign = panel.cx - hingeMid.u >= 0 ? -1 : 1;
      } else {
        axis = 'x';
        angleSign = panel.cy - hingeMid.v >= 0 ? 1 : -1;
      }

      nodes.set(other, { id: other, panel, parentId: cur, depth: nodes.get(cur).depth + 1, hingeMid, axis, angleSign });
      if (edge.isCrease) deque.unshift(other); else deque.push(other);
    }
  }
  return { rootId: root.id, nodes };
}

export function parseDielineImage(img) {
  idCounter = 0;
  const field = rasterize(img);
  const rawPanels = findPanels(field.W, field.H, field.label);

  if (rawPanels.length === 0) throw new Error('No panels found - make sure the dieline has clear cut/crease lines on a plain background.');
  if (rawPanels.length === 1) throw new Error('Only one shape found, nothing to hinge. Check the fold lines are drawn as solid lines.');

  const { panels, forcedEdges } = splitFusedPanels(rawPanels);
  const edges = [...forcedEdges, ...findEdges(panels, field)];
  const { rootId, nodes } = buildFoldTree(panels, edges);

  const root = nodes.get(rootId).panel;
  const scale = 3.4 / Math.max(root.width, root.height);
  const bounds = panels.reduce((acc, p) => ({
    minU: Math.min(acc.minU, p.minX), maxU: Math.max(acc.maxU, p.maxX),
    minV: Math.min(acc.minV, p.minY), maxV: Math.max(acc.maxV, p.maxY),
  }), { minU: Infinity, maxU: -Infinity, minV: Infinity, maxV: -Infinity });

  return {
    nodes,
    rootId,
    scale,
    panelCount: panels.length,
    flatSize: { width: (bounds.maxU - bounds.minU) * scale, height: (bounds.maxV - bounds.minV) * scale },
  };
}
