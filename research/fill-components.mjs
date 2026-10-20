/** Bounded sampling locates connected difference pieces; SVG masks retain their vector edges. */
import { path2curve } from "../dist/core.js";
function edges(paths) {
  return paths.map((d) => {
    const result = [];
    let p,
      start,
      count = 0;
    const line = (q) => {
      if (p && (p[0] !== q[0] || p[1] !== q[1])) result.push([p, q]);
      p = q;
    };
    for (const [cmd, ...v] of path2curve(d)) {
      if (!v.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e6))
        throw Error("Invalid component coordinates");
      if (cmd === "M") {
        if (start) line(start);
        p = v;
        start = v;
        continue;
      }
      const a = p,
        b = v.slice(0, 2),
        c = v.slice(2, 4),
        e = v.slice(4, 6);
      const n = Math.max(
        1,
        Math.min(
          512,
          Math.ceil(
            (Math.hypot(b[0] - a[0], b[1] - a[1]) +
              Math.hypot(c[0] - b[0], c[1] - b[1]) +
              Math.hypot(e[0] - c[0], e[1] - c[1])) /
              0.08,
          ),
        ),
      );
      count += n;
      if (count > 16384) throw Error("Component sampling budget exceeded");
      for (let i = 1; i <= n; i++) {
        const t = i / n,
          s = 1 - t;
        line([
          s * s * s * a[0] +
            3 * s * s * t * b[0] +
            3 * s * t * t * c[0] +
            t * t * t * e[0],
          s * s * s * a[1] +
            3 * s * s * t * b[1] +
            3 * s * t * t * c[1] +
            t * t * t * e[1],
        ]);
      }
    }
    if (start) line(start);
    return result;
  });
}
function occupancy(paths, bounds, n, rule) {
  const [x, y, w, h] = bounds,
    out = new Uint8Array(n * n);
  for (const lines of edges(paths))
    for (let row = 0; row < n; row++) {
      const py = y + ((row + 0.5) * h) / n,
        events = [];
      for (const [a, b] of lines)
        if ((a[1] <= py && b[1] > py) || (b[1] <= py && a[1] > py))
          events.push([
            a[0] + ((py - a[1]) * (b[0] - a[0])) / (b[1] - a[1]),
            b[1] > a[1] ? 1 : -1,
          ]);
      events.sort((a, b) => a[0] - b[0]);
      let j = 0,
        winding = 0;
      for (let col = 0; col < n; col++) {
        const px = x + ((col + 0.5) * w) / n;
        while (j < events.length && events[j][0] <= px)
          winding += events[j++][1];
        if (rule === "evenodd" ? Math.abs(winding) % 2 : winding !== 0)
          out[row * n + col] = 1;
      }
    }
  return out;
}
export function findDifferenceComponents(
  from,
  to,
  {
    bounds = [0, 0, 32, 32],
    direction = [-1, 1],
    fillRule = "nonzero",
    resolution = 384,
  } = {},
) {
  if (!Number.isInteger(resolution) || resolution < 32 || resolution > 512)
    throw Error("Invalid component resolution");
  const n = resolution,
    a = occupancy(from, bounds, n, fillRule),
    b = occupancy(to, bounds, n, fillRule),
    labels = new Int32Array(n * n),
    parts = [];
  const [x, y, w, h] = bounds,
    dx = w / n,
    dy = h / n;
  for (let seed = 0; seed < labels.length; seed++) {
    if (!a[seed] || b[seed] || labels[seed]) continue;
    const id = parts.length + 1,
      queue = [seed];
    labels[seed] = id;
    let anchor,
      score = Infinity,
      fallback,
      fallbackScore = Infinity;
    for (let j = 0; j < queue.length; j++) {
      const k = queue[j],
        col = k % n,
        row = Math.floor(k / n),
        p = [x + (col + 0.5) * dx, y + (row + 0.5) * dy],
        s = p[0] * direction[0] + p[1] * direction[1];
      if (s < fallbackScore) {
        fallbackScore = s;
        fallback = p;
      }
      for (const q of [
        col ? k - 1 : -1,
        col < n - 1 ? k + 1 : -1,
        row ? k - n : -1,
        row < n - 1 ? k + n : -1,
      ])
        if (q >= 0) {
          if (a[q] && b[q] && s < score) {
            score = s;
            anchor = p;
          }
          if (a[q] && !b[q] && !labels[q]) {
            labels[q] = id;
            queue.push(q);
          }
        }
    }
    if (parts.length >= 256) throw Error("Too many difference components");
    parts.push({ anchor: anchor ?? fallback, pixels: queue.length });
  }
  // Numeric differences between independently normalized arcs can leave subpixel islands.
  // Assign these to the closest substantial piece instead of spawning dozens of animations.
  const substantial = parts
    .map((p, i) => (p.pixels >= 32 ? i : -1))
    .filter((i) => i >= 0);
  if (!substantial.length && parts.length)
    substantial.push(
      parts.reduce(
        (best, p, i) => (p.pixels > parts[best].pixels ? i : best),
        0,
      ),
    );
  const map = parts.map((p, i) => {
    if (substantial.includes(i)) return substantial.indexOf(i) + 1;
    let best = 0,
      distance = Infinity;
    substantial.forEach((k, j) => {
      const q = parts[k].anchor,
        d = Math.hypot(p.anchor[0] - q[0], p.anchor[1] - q[1]);
      if (d < distance) {
        distance = d;
        best = j;
      }
    });
    return best + 1;
  });
  for (let k = 0; k < labels.length; k++)
    if (labels[k]) labels[k] = map[labels[k] - 1];
  const merged = substantial.map((i) => ({ ...parts[i], pixels: 0 }));
  parts.forEach((p, i) => (merged[map[i] - 1].pixels += p.pixels));
  // Expand ownership into neighboring empty cells so the vector mask, not the sample grid,
  // determines visible curved edges. Never give a cell to two moving components.
  for (let pass = 0; pass < 2; pass++) {
    const next = labels.slice();
    for (let k = 0; k < labels.length; k++)
      if (!labels[k]) {
        const c = k % n,
          r = Math.floor(k / n);
        for (const q of [
          c ? k - 1 : -1,
          c < n - 1 ? k + 1 : -1,
          r ? k - n : -1,
          r < n - 1 ? k + n : -1,
        ])
          if (q >= 0 && labels[q]) {
            next[k] = labels[q];
            break;
          }
      }
    labels.set(next);
  }
  const runs = merged.map(() => []);
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n;) {
      const id = labels[row * n + col],
        start = col;
      while (col < n && labels[row * n + col] === id) col++;
      if (id) {
        const l = x + start * dx,
          t = y + row * dy,
          r = x + col * dx,
          bt = t + dy;
        runs[id - 1].push(`M${l} ${t}H${r}V${bt}H${l}Z`);
      }
    }
  return merged.map((part, i) => ({ ...part, clip: runs[i].join("") }));
}
