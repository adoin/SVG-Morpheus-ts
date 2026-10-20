/** Research only: spatial boundary overlap, not an animation/correspondence planner. */
import { path2curve, path2string } from "../dist/core.js";
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function split(c, t) {
  const a = mix(c[0], c[1], t),
    b = mix(c[1], c[2], t),
    d = mix(c[2], c[3], t),
    e = mix(a, b, t),
    f = mix(b, d, t),
    g = mix(e, f, t);
  return [
    [c[0], a, e, g],
    [g, f, d, c[3]],
  ];
}
function cut(c, a, b) {
  const head = split(c, b)[0];
  return a === 0 ? head : split(head, a / b)[1];
}
function read(paths, maxStep) {
  if (!Array.isArray(paths) || paths.length > 128)
    throw new Error("Expected up to 128 paths");
  const curves = [],
    lines = [];
  for (const [pathIndex, d] of paths.entries()) {
    let current = [0, 0],
      contour = -1;
    const data = path2curve(d);
    if (data.length > 4096) throw new Error("Path budget exceeded");
    for (const [cmd, ...v] of data) {
      if (!v.every((value) => Number.isFinite(value) && Math.abs(value) <= 1e6))
        throw new Error("Invalid coordinates");
      if (cmd === "M") {
        current = v;
        contour++;
        continue;
      }
      const curve = [current, v.slice(0, 2), v.slice(2, 4), v.slice(4, 6)];
      const index = curves.length;
      curves.push({ curve, pathIndex, contour, index });
      current = curve[3];
      const walk = (c, a, b, depth) => {
        const chord = distance(c[0], c[3]),
          polygon =
            distance(c[0], c[1]) + distance(c[1], c[2]) + distance(c[2], c[3]);
        if (depth >= 14 && polygon > maxStep)
          throw new Error("Sampling budget exceeded");
        if (depth >= 14 || (polygon - chord < 0.002 && polygon <= maxStep)) {
          if (chord > 1e-9)
            lines.push({
              a: c[0],
              b: c[3],
              t0: a,
              t1: b,
              index,
              pathIndex,
              length: chord,
            });
          if (lines.length > 20000) throw new Error("Sampling budget exceeded");
        } else {
          const [left, right] = split(c, 0.5),
            m = (a + b) / 2;
          walk(left, a, m, depth + 1);
          walk(right, m, b, depth + 1);
        }
      };
      walk(curve, 0, 1, 0);
    }
  }
  return { curves, lines, length: lines.reduce((sum, l) => sum + l.length, 0) };
}
function detect(source, target, tolerance, minRunLength, maxStep) {
  const size = Math.max(maxStep, tolerance * 2),
    grid = new Map();
  const key = (x, y) => `${x},${y}`;
  for (const line of target.lines) {
    const x0 = Math.floor(Math.min(line.a[0], line.b[0]) / size),
      x1 = Math.floor(Math.max(line.a[0], line.b[0]) / size);
    const y0 = Math.floor(Math.min(line.a[1], line.b[1]) / size),
      y1 = Math.floor(Math.max(line.a[1], line.b[1]) / size);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const k = key(x, y);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(line);
      }
  }
  const nearest = (line) => {
    const p = mix(line.a, line.b, 0.5),
      x = Math.floor(p[0] / size),
      y = Math.floor(p[1] / size);
    const u = [line.b[0] - line.a[0], line.b[1] - line.a[1]];
    let best,
      score = tolerance * tolerance;
    for (let i = x - 1; i <= x + 1; i++)
      for (let j = y - 1; j <= y + 1; j++)
        for (const candidate of grid.get(key(i, j)) ?? []) {
          const v = [
              candidate.b[0] - candidate.a[0],
              candidate.b[1] - candidate.a[1],
            ],
            len = candidate.length;
          if (Math.abs(u[0] * v[0] + u[1] * v[1]) / (line.length * len) < 0.985)
            continue;
          const t = Math.max(
            0,
            Math.min(
              1,
              ((p[0] - candidate.a[0]) * v[0] +
                (p[1] - candidate.a[1]) * v[1]) /
                (len * len),
            ),
          );
          const q = mix(candidate.a, candidate.b, t),
            d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
          if (d <= score) {
            score = d;
            best = candidate;
          }
        }
    return best;
  };
  const runs = [];
  let run;
  const flush = () => {
    if (run && run.length >= minRunLength) runs.push(run);
    run = undefined;
  };
  for (const line of source.lines) {
    const match = nearest(line);
    if (!match) {
      flush();
      continue;
    }
    if (
      !run ||
      run.index !== line.index ||
      Math.abs(run.end - line.t0) > 1e-9
    ) {
      flush();
      run = {
        index: line.index,
        start: line.t0,
        end: line.t1,
        length: 0,
        targetPaths: new Set(),
      };
    }
    run.end = line.t1;
    run.length += line.length;
    run.targetPaths.add(match.pathIndex);
  }
  flush();
  return runs.map((run) => {
    const row = source.curves[run.index],
      c = cut(row.curve, run.start, run.end);
    return {
      pathIndex: row.pathIndex,
      contour: row.contour,
      segmentIndex: row.index,
      range: [run.start, run.end],
      length: run.length,
      targetPaths: [...run.targetPaths].sort((a, b) => a - b),
      d: path2string([
        ["M", ...c[0]],
        ["C", ...c[1], ...c[2], ...c[3]],
      ]),
    };
  });
}
/** Ratios measure sampled boundary length, NOT filled area or semantic similarity. */
export function analyzeSharedBoundaries(
  from,
  to,
  { tolerance = 0.05, maxStep = 0.25, minRunLength = 0.75 } = {},
) {
  if (!(
    tolerance > 0 &&
    tolerance <= 1 &&
    maxStep > 0 &&
    maxStep <= 2 &&
    minRunLength >= 0
  ))
    throw new Error("Invalid research options");
  const a = read(from, maxStep),
    b = read(to, maxStep);
  const fromFragments = detect(a, b, tolerance, minRunLength, maxStep),
    toFragments = detect(b, a, tolerance, minRunLength, maxStep);
  const sum = (items) => items.reduce((s, item) => s + item.length, 0);
  return {
    tolerance,
    fromFragments,
    toFragments,
    coverage: {
      from: a.length ? sum(fromFragments) / a.length : 0,
      to: b.length ? sum(toFragments) / b.length : 0,
    },
    length: {
      from: a.length,
      to: b.length,
      sharedFrom: sum(fromFragments),
      sharedTo: sum(toFragments),
    },
  };
}
