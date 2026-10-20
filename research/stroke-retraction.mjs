/** Authored centerlines guide masks; the original filled artwork is never scaled. */
import { path2curve } from "../dist/core.js";
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function sample(d) {
  if (
    typeof d !== "string" ||
    d.length > 10000 ||
    !/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\s-]*$/.test(d)
  )
    throw Error("Invalid guide");
  const points = [];
  let p,
    moves = 0;
  for (const [cmd, ...v] of path2curve(d)) {
    if (!v.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e6))
      throw Error("Invalid guide coordinates");
    if (cmd === "M") {
      p = v;
      points.push(p);
      moves++;
      continue;
    }
    const a = p,
      b = v.slice(0, 2),
      c = v.slice(2, 4),
      e = v.slice(4, 6),
      n = Math.max(
        1,
        Math.min(
          512,
          Math.ceil((distance(a, b) + distance(b, c) + distance(c, e)) / 0.08),
        ),
      );
    for (let i = 1; i <= n; i++) {
      const t = i / n,
        s = 1 - t;
      points.push([
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
    p = e;
    if (points.length > 4096) throw Error("Guide budget exceeded");
  }
  if (moves !== 1 || points.length < 2)
    throw Error("Expected one continuous guide");
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]));
  return { points, lengths };
}
function project(guide, p) {
  let best = { distance: Infinity };
  for (let i = 1; i < guide.points.length; i++) {
    const a = guide.points[i - 1],
      b = guide.points[i],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      len2 = dx * dx + dy * dy;
    if (!len2) continue;
    const t = Math.max(
      0,
      Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2),
    );
    const d = Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
    if (d < best.distance)
      best = {
        distance: d,
        length: guide.lengths[i - 1] + Math.sqrt(len2) * t,
      };
  }
  return best;
}
function slice(guide, start, end) {
  const result = [];
  for (let i = 1; i < guide.points.length; i++) {
    const l = guide.lengths[i - 1],
      r = guide.lengths[i];
    if (r < start || l > end || r === l) continue;
    const at = (s) =>
      guide.points[i - 1].map(
        (v, j) => v + ((guide.points[i][j] - v) * (s - l)) / (r - l),
      );
    if (!result.length) result.push(at(Math.max(start, l)));
    result.push(at(Math.min(end, r)));
  }
  return result;
}
export function createStrokeRetractions(pieces, guides) {
  if (!Array.isArray(guides) || !guides.length || guides.length > 16)
    throw Error("Expected authored centerline guides");
  const prepared = guides.map((g) => {
    if (!(g.width > 0 && g.width <= 16)) throw Error("Invalid guide width");
    return { ...sample(g.d), width: g.width };
  });
  return pieces.map((piece) => {
    const candidates = prepared
      .map((guide) => {
        const hits = piece.samples.map((p) => project(guide, p));
        return {
          guide,
          hits,
          score: hits.reduce((s, h) => s + h.distance, 0) / hits.length,
        };
      })
      .sort((a, b) => a.score - b.score);
    const { guide, hits } = candidates[0];
    if (
      !Number.isFinite(candidates[0].score) ||
      candidates[0].score > guide.width / 2
    )
      throw Error("A difference piece is outside its authored guide");
    const start = Math.max(0, Math.min(...hits.map((h) => h.length)) - 0.18),
      end = Math.min(
        guide.lengths.at(-1),
        Math.max(...hits.map((h) => h.length)) + 0.18,
      );
    const points = slice(guide, start, end),
      length = end - start;
    // The surviving end is fixed. The disappearing end advances along the centerline.
    return {
      d: points.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(""),
      length,
      width: guide.width,
      tip: [...points.at(-1)],
    };
  });
}
