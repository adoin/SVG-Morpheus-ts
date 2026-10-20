/** Research only. One open stroke that is a geometric prefix of another. */
import { path2curve, path2string } from "../dist/core.js";
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function split(c, t) {
  const a = lerp(c[0], c[1], t),
    b = lerp(c[1], c[2], t),
    d = lerp(c[2], c[3], t);
  const e = lerp(a, b, t),
    f = lerp(b, d, t),
    g = lerp(e, f, t);
  return [
    [c[0], a, e, g],
    [g, f, d, c[3]],
  ];
}
const point = (c, t) => split(c, t)[0][3];
const serialize = (cs) =>
  cs.length
    ? path2string([
        ["M", ...cs[0][0]],
        ...cs.map((c) => ["C", ...c[1], ...c[2], ...c[3]]),
      ])
    : "";
function read(d) {
  if (typeof d !== "string" || d.length > 50000 || /z/i.test(d))
    throw Error("Only one open stroke is supported");
  let p,
    moves = 0;
  const cs = [];
  for (const [cmd, ...v] of path2curve(d)) {
    if (!v.every(Number.isFinite)) throw Error("Invalid coordinates");
    if (cmd === "M") {
      p = v;
      moves++;
    } else {
      cs.push([p, v.slice(0, 2), v.slice(2, 4), v.slice(4, 6)]);
      p = v.slice(4, 6);
    }
  }
  if (moves !== 1 || !cs.length || cs.length > 128 || dist(cs[0][0], p) < 1e-7)
    throw Error("Only one non-closed stroke is supported");
  return cs;
}
const reverse = (cs) => [...cs].reverse().map((c) => [...c].reverse());
function nearest(cs, p) {
  let best = { distance: Infinity };
  cs.forEach((c, index) => {
    // Bracket every sampled local minimum; do not assume a whole cubic is unimodal.
    for (let j = 0; j < 64; j++) {
      let a = j / 64,
        b = (j + 1) / 64;
      for (let k = 0; k < 35; k++) {
        const x = (2 * a + b) / 3,
          y = (a + 2 * b) / 3;
        if (dist(point(c, x), p) < dist(point(c, y), p)) b = y;
        else a = x;
      }
      for (const t of [a, b, j / 64, (j + 1) / 64]) {
        const distance = dist(point(c, t), p);
        if (distance < best.distance) best = { distance, index, t };
      }
    }
  });
  return best;
}
function samples(cs) {
  return cs.flatMap((c) =>
    Array.from({ length: 65 }, (_, i) => point(c, i / 64)),
  );
}
function matches(a, b, tolerance) {
  // Ordered polyline comparison prevents accepting an unrelated crossing or a detour.
  const normalize = (cs) => {
    const ps = samples(cs),
      lengths = [0];
    for (let i = 1; i < ps.length; i++)
      lengths.push(lengths[i - 1] + dist(ps[i - 1], ps[i]));
    const total = lengths.at(-1);
    let j = 1;
    return Array.from({ length: 257 }, (_, i) => {
      const x = (total * i) / 256;
      while (j < ps.length - 1 && lengths[j] < x) j++;
      return lerp(
        ps[j - 1],
        ps[j],
        (x - lengths[j - 1]) / (lengths[j] - lengths[j - 1] || 1),
      );
    });
  };
  const x = normalize(a),
    y = normalize(b);
  return x.every((p, i) => dist(p, y[i]) <= tolerance);
}
export function createSharedStrokePlan(from, to, { tolerance = 0.002 } = {}) {
  if (!(tolerance > 0 && tolerance <= 0.05)) throw Error("Invalid tolerance");
  const source = read(from),
    target = read(to);
  for (const growing of [false, true])
    for (const flip of [false, true]) {
      const long = growing ? target : source,
        raw = growing ? source : target;
      const short = flip ? reverse(raw) : raw;
      if (dist(long[0][0], short[0][0]) > tolerance) continue;
      const hit = nearest(long, short.at(-1)[3]);
      if (hit.distance > tolerance) continue;
      const [head, tail] = split(long[hit.index], hit.t);
      const common = [...long.slice(0, hit.index), head];
      if (!matches(common, short, tolerance)) continue;
      const rest = [tail, ...long.slice(hit.index + 1)];
      return {
        shared: serialize(common),
        growing,
        frame(progress) {
          if (!Number.isFinite(progress)) throw Error("Invalid progress");
          const p = Math.max(0, Math.min(1, progress)),
            amount = growing ? p : 1 - p;
          const count = amount * rest.length,
            whole = Math.floor(count),
            fraction = count - whole;
          const visible = rest.slice(0, whole);
          if (fraction > 1e-10 && whole < rest.length)
            visible.push(split(rest[whole], fraction)[0]);
          return { shared: serialize(common), difference: serialize(visible) };
        },
      };
    }
  throw Error("No compatible shared prefix; use the regular morph planner");
}
