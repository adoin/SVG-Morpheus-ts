import { path2curve, path2string } from "./svg-path.js";
import type { CurveData } from "./core-types.js";

type Point = [number, number];
type Cubic = [Point, Point, Point, Point];
export interface MorphPath {
  d: string | CurveData;
  /** Omit to infer closure from each contour's endpoints. */
  closed?: boolean;
  /** Closed filled contours preserve winding unless explicitly enabled. */
  allowReverse?: boolean;
  /** Reveal/retract an unmatched stroked contour along its existing arc length. */
  draw?: boolean;
}
export interface MorphPair {
  fromIndex: number | null;
  toIndex: number | null;
}
export interface MorphPlan {
  /** Target paths first, then disappearing source paths. */
  readonly pairs: readonly MorphPair[];
  /** Exact cubic geometry; progress may overshoot for spring animation. */
  frame(progress: number): string[];
}
interface Contour {
  curves: Cubic[];
  closed: boolean;
  length: number;
  knots: number[];
  tables: { t: number; length: number }[][];
}
interface Feature {
  center: Point;
  radius: number;
  length: number;
  closed: boolean;
  area: number;
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pointMix = (a: Point, b: Point, t: number): Point => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
];
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const rotate = ([x, y]: Point, a: number): Point => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];
const evaluate = (c: Cubic, t: number): Point => {
  const s = 1 - t;
  return [0, 1].map(
    (i) =>
      s ** 3 * c[0][i] +
      3 * s * s * t * c[1][i] +
      3 * s * t * t * c[2][i] +
      t ** 3 * c[3][i],
  ) as Point;
};
const split = (c: Cubic, t: number): [Cubic, Cubic] => {
  const a = pointMix(c[0], c[1], t),
    b = pointMix(c[1], c[2], t),
    d = pointMix(c[2], c[3], t);
  const e = pointMix(a, b, t),
    f = pointMix(b, d, t),
    p = pointMix(e, f, t);
  return [
    [c[0], a, e, p],
    [p, f, d, c[3]],
  ];
};
const cut = (c: Cubic, a: number, b: number): Cubic => {
  if (a >= 1 - 1e-12) return [c[3], c[3], c[3], c[3]];
  const right = a <= 0 ? c : split(c, a)[1];
  return b >= 1 ? right : split(right, Math.max(0, (b - a) / (1 - a)))[0];
};

function prepare(curves: Cubic[], closed: boolean): Contour {
  const knots = [0],
    tables: Contour["tables"] = [];
  let length = 0;
  for (const curve of curves) {
    const table = [{ t: 0, length: 0 }];
    let accumulated = 0,
      previous = curve[0];
    const walk = (c: Cubic, a: number, b: number, depth: number) => {
      const polygon =
        distance(c[0], c[1]) + distance(c[1], c[2]) + distance(c[2], c[3]);
      if (
        depth >= 10 ||
        (depth >= 4 &&
          polygon - distance(c[0], c[3]) <= Math.max(1e-6, polygon * 0.0001))
      ) {
        accumulated += distance(previous, c[3]);
        previous = c[3];
        table.push({ t: b, length: accumulated });
      } else {
        const [left, right] = split(c, 0.5),
          middle = (a + b) / 2;
        walk(left, a, middle, depth + 1);
        walk(right, middle, b, depth + 1);
      }
    };
    walk(curve, 0, 1, 0);
    tables.push(table);
    length += accumulated;
    knots.push(length);
  }
  return {
    curves,
    closed,
    length,
    tables,
    knots:
      length > 1e-12
        ? knots.map((n) => n / length)
        : knots.map((_, i) => i / curves.length),
  };
}

function contours(input: MorphPath): Contour[] {
  const output: Contour[] = [];
  let current: Cubic[] = [],
    start: Point = [0, 0],
    point: Point = [0, 0];
  const commit = () => {
    if (!current.length) return;
    output.push(
      prepare(current, input.closed ?? distance(start, point) < 1e-7),
    );
    current = [];
  };
  const curve = path2curve(input.d) as CurveData;
  if (curve.length > 2048)
    throw new Error("Morph path exceeds the geometry budget");
  for (const [command, ...values] of curve) {
    if (!values.every((v) => typeof v === "number" && Number.isFinite(v)))
      throw new Error("Invalid morph coordinates");
    const n = values as number[];
    if (command === "M") {
      commit();
      start = point = [n[0], n[1]];
    } else if (command === "C" && n.length === 6) {
      const end: Point = [n[4], n[5]];
      current.push([point, [n[0], n[1]], [n[2], n[3]], end]);
      point = end;
    } else throw new Error("Invalid normalized morph path");
  }
  commit();
  if (!output.length)
    output.push(prepare([[point, point, point, point]], input.closed ?? false));
  if (output.length > 128) throw new Error("Too many morph contours");
  return output;
}

function locate(c: Contour, u: number, segment?: number): [number, number] {
  u = Math.min(1, Math.max(0, u));
  const index =
    segment ??
    Math.min(
      c.curves.length - 1,
      Math.max(0, c.knots.findIndex((end, i) => i > 0 && u <= end + 1e-12) - 1),
    );
  const table = c.tables[index];
  const target = (u - c.knots[index]) * c.length;
  if (c.length < 1e-12) return [index, u];
  let low = 0,
    high = table.length - 1;
  while (low + 1 < high) {
    const middle = (low + high) >> 1;
    if (table[middle].length < target) low = middle;
    else high = middle;
  }
  const a = table[low],
    b = table[high];
  return [
    index,
    Math.min(
      1,
      Math.max(
        0,
        lerp(
          a.t,
          b.t,
          (target - a.length) / Math.max(1e-12, b.length - a.length),
        ),
      ),
    ),
  ];
}
const at = (c: Contour, u: number): Point => {
  const [i, t] = locate(c, u);
  return evaluate(c.curves[i], t);
};
const sample = (c: Contour, count = 48) =>
  Array.from({ length: count }, (_, i) =>
    at(c, i / (c.closed ? count : count - 1)),
  );
const mean = (points: Point[]): Point => [
  points.reduce((s, p) => s + p[0], 0) / points.length,
  points.reduce((s, p) => s + p[1], 0) / points.length,
];
function feature(items: Contour[]): Feature {
  const points = items.flatMap((c) => sample(c, 24)),
    center = mean(points);
  return {
    center,
    radius: Math.sqrt(
      points.reduce((s, p) => s + distance(p, center) ** 2, 0) / points.length,
    ),
    length: items.reduce((s, c) => s + c.length, 0),
    closed: items.every((c) => c.closed),
    area: items.reduce((sum, c) => {
      const p = sample(c, 24);
      return (
        sum +
        (c.closed
          ? p.reduce((s, a, i) => {
              const b = p[(i + 1) % p.length];
              return s + a[0] * b[1] - a[1] * b[0];
            }, 0) / 2
          : 0)
      );
    }, 0),
  };
}
function cost(a: Feature, b: Feature): number {
  const size = Math.max(a.radius, b.radius, 1e-4);
  return (
    (distance(a.center, b.center) / size) ** 2 +
    Math.log((a.length + 1e-4) / (b.length + 1e-4)) ** 2 +
    (a.closed === b.closed ? 0 : 100) +
    (a.area * b.area < -1e-8 ? 20 : 0)
  );
}
/** Global minimum assignment, rather than order-dependent greedy matching. */
function match(from: Feature[], to: Feature[]): MorphPair[] {
  const size = Math.max(from.length, to.length),
    u = Array(size + 1).fill(0),
    v = [...u],
    p = [...u],
    way = [...u];
  for (let i = 1; i <= size; i++) {
    p[0] = i;
    let column = 0;
    const minimum = Array(size + 1).fill(Infinity),
      used = Array(size + 1).fill(false);
    do {
      used[column] = true;
      const row = p[column];
      let delta = Infinity,
        next = 0;
      for (let j = 1; j <= size; j++)
        if (!used[j]) {
          const value =
            (row <= to.length && j <= from.length
              ? cost(from[j - 1], to[row - 1])
              : 0) -
            u[row] -
            v[j];
          if (value < minimum[j]) {
            minimum[j] = value;
            way[j] = column;
          }
          if (minimum[j] < delta) {
            delta = minimum[j];
            next = j;
          }
        }
      for (let j = 0; j <= size; j++)
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minimum[j] -= delta;
      column = next;
    } while (p[column] !== 0);
    do {
      const previous = way[column];
      p[column] = p[previous];
      column = previous;
    } while (column !== 0);
  }
  const assigned = Array(to.length).fill(null) as (number | null)[];
  for (let j = 1; j <= from.length; j++)
    if (p[j] > 0 && p[j] <= to.length) assigned[p[j] - 1] = j - 1;
  const pairs: MorphPair[] = assigned.map((index, toIndex) => ({
    fromIndex: index,
    toIndex,
  }));
  from.forEach((_, fromIndex) => {
    if (!assigned.includes(fromIndex)) pairs.push({ fromIndex, toIndex: null });
  });
  return pairs;
}

function orient(c: Contour, phase: number, reverse: boolean): Contour {
  let curves = c.curves;
  if (c.closed && phase > 1e-8 && phase < 1 - 1e-8) {
    const [index, time] = locate(c, phase),
      [left, right] = split(curves[index], time);
    curves = [
      right,
      ...curves.slice(index + 1),
      ...curves.slice(0, index),
      left,
    ];
  }
  if (reverse)
    curves = [...curves]
      .reverse()
      .map((c) => [c[3], c[2], c[1], c[0]] as Cubic);
  return prepare(curves, c.closed);
}
function fit(a: Point[], b: Point[]) {
  const ac = mean(a),
    bc = mean(b);
  let dot = 0,
    cross = 0,
    energy = 0,
    targetEnergy = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i][0] - ac[0],
      y = a[i][1] - ac[1],
      X = b[i][0] - bc[0],
      Y = b[i][1] - bc[1];
    dot += x * X + y * Y;
    cross += x * Y - y * X;
    energy += x * x + y * y;
    targetEnergy += X * X + Y * Y;
  }
  const correlation = Math.hypot(dot, cross);
  const aligned =
    energy > 1e-10 &&
    targetEnergy > 1e-10 &&
    correlation > 1e-6 * Math.sqrt(energy * targetEnergy);
  const angle = aligned ? Math.atan2(cross, dot) : 0;
  const scale = aligned
    ? Math.max(1e-4, correlation / energy)
    : energy > 1e-10 && targetEnergy > 1e-10
      ? Math.sqrt(targetEnergy / energy)
      : 1;
  let error = 0;
  for (let i = 0; i < a.length; i++) {
    const q = rotate([b[i][0] - bc[0], b[i][1] - bc[1]], -angle);
    error +=
      (q[0] / scale - (a[i][0] - ac[0])) ** 2 +
      (q[1] / scale - (a[i][1] - ac[1])) ** 2;
  }
  return {
    ac,
    bc,
    angle,
    scale,
    score:
      error / a.length +
      Math.abs(angle) * Math.max(energy / a.length, 1e-4) * 0.001,
  };
}
function collapse(c: Contour): Contour {
  const center = feature([c]).center;
  return prepare([[center, center, center, center]], c.closed);
}
function subcurve(c: Contour, a: number, b: number): Cubic {
  const [index] = locate(c, (a + b) / 2);
  return cut(c.curves[index], locate(c, a, index)[1], locate(c, b, index)[1]);
}
function drawnContour(c: Contour, amount: number): string {
  const p = Math.max(0, Math.min(1, amount)),
    first = c.curves[0][0];
  const output: CurveData = [["M", ...first]];
  if (p <= 0) output.push(["C", ...first, ...first, ...first]);
  else
    for (let i = 0; i < c.curves.length; i++) {
      if (c.knots[i] >= p) break;
      const curve =
        p >= c.knots[i + 1]
          ? c.curves[i]
          : cut(c.curves[i], 0, locate(c, p, i)[1]);
      output.push(["C", ...curve[1], ...curve[2], ...curve[3]]);
      if (p < c.knots[i + 1]) break;
    }
  return path2string(output) + (p === 1 && c.closed ? "Z" : "");
}
function contourPlan(a: Contour, original: Contour, allowReverse: boolean) {
  const source = sample(a),
    count = source.length;
  let phase = 0,
    reverse = false,
    best = fit(source, sample(original));
  const phases = original.closed
    ? [
        ...new Set([
          0,
          ...original.knots.slice(0, -1),
          ...Array.from({ length: count }, (_, i) => i / count),
        ]),
      ]
    : [0];
  for (const flipped of allowReverse ? [false, true] : [false])
    for (const offset of phases) {
      const target = source.map((_, i) => {
        let t = original.closed
          ? offset + (flipped ? -i : i) / count
          : flipped
            ? 1 - i / (count - 1)
            : i / (count - 1);
        if (original.closed) t = ((t % 1) + 1) % 1;
        return at(original, t);
      });
      const candidate = fit(source, target);
      if (candidate.score < best.score - 1e-10) {
        best = candidate;
        phase = offset;
        reverse = flipped;
      }
    }
  const b = orient(original, phase, reverse);
  best = fit(source, sample(b));
  const knots = [...a.knots, ...b.knots]
    .sort((x, y) => x - y)
    .filter((x, i, all) => i === 0 || x - all[i - 1] > 1e-9);
  const curves = knots.slice(1).map((end, index) => {
    const from = subcurve(a, knots[index], end),
      raw = subcurve(b, knots[index], end);
    const to = raw.map(
      (p) =>
        rotate([p[0] - best.bc[0], p[1] - best.bc[1]], -best.angle).map(
          (x) => x / best.scale,
        ) as Point,
    ) as Cubic;
    return { from, to };
  });
  return (t: number) => {
    // Bounce rigid motion, never invert a disappearing contour past zero size.
    const shapeProgress = Math.max(0, Math.min(1, t));
    const scale = best.scale ** t,
      rotation = best.angle * t;
    const result: CurveData = [];
    for (const [index, curve] of curves.entries()) {
      const points = curve.from.map((p, i) => {
        const local: Point = [
          lerp(p[0] - best.ac[0], curve.to[i][0], shapeProgress),
          lerp(p[1] - best.ac[1], curve.to[i][1], shapeProgress),
        ];
        const turned = rotate(local, rotation);
        return [
          turned[0] * scale + lerp(best.ac[0], best.bc[0], t),
          turned[1] * scale + lerp(best.ac[1], best.bc[1], t),
        ];
      });
      if (index === 0) result.push(["M", ...points[0]]);
      result.push(["C", ...points[1], ...points[2], ...points[3]]);
    }
    const d = path2string(result);
    return d + (b.closed ? "Z" : "");
  };
}

/** Plan globally matched contours with exact cubic subdivision and similarity alignment. */
export function createMorphPlan(
  from: readonly MorphPath[],
  to: readonly MorphPath[],
): MorphPlan {
  if (from.length > 128 || to.length > 128)
    throw new Error("Too many morph paths");
  const source = from.map(contours),
    target = to.map(contours);
  const pairs = match(source.map(feature), target.map(feature));
  const plans = pairs.map((pair) => {
    const a = pair.fromIndex === null ? [] : source[pair.fromIndex];
    let b = pair.toIndex === null ? [] : target[pair.toIndex];
    const option =
      pair.toIndex === null ? from[pair.fromIndex!] : to[pair.toIndex];
    // Reversing every contour of a filled path preserves its fill and holes.
    // Align the dominant winding before fitting instead of dividing by a near-zero
    // correlation for clockwise/counterclockwise versions of the same artwork.
    const dominant = (contours: Contour[]) =>
      contours
        .map((c) => feature([c]).area)
        .sort((x, y) => Math.abs(y) - Math.abs(x))[0] ?? 0;
    if (
      a.length &&
      b.length &&
      a.every((c) => c.closed) &&
      b.every((c) => c.closed) &&
      dominant(a) * dominant(b) < 0
    )
      b = b.map((c) => orient(c, 0, true));
    return match(
      a.map((c) => feature([c])),
      b.map((c) => feature([c])),
    ).map(({ fromIndex, toIndex }) => {
      const draw =
        fromIndex === null
          ? pair.toIndex !== null && to[pair.toIndex].draw
          : pair.fromIndex !== null && from[pair.fromIndex].draw;
      if (draw && (fromIndex === null || toIndex === null)) {
        const contour = fromIndex === null ? b[toIndex!] : a[fromIndex];
        return (progress: number) =>
          drawnContour(contour, fromIndex === null ? progress : 1 - progress);
      }
      const start = fromIndex === null ? collapse(b[toIndex!]) : a[fromIndex];
      const end = toIndex === null ? collapse(start) : b[toIndex];
      return contourPlan(start, end, option.allowReverse ?? !end.closed);
    });
  });
  return {
    pairs: Object.freeze(pairs.map((pair) => Object.freeze({ ...pair }))),
    frame(progress) {
      if (!Number.isFinite(progress))
        throw new Error("Morph progress must be finite");
      return plans.map((path) =>
        path.map((contour) => contour(progress)).join(""),
      );
    },
  };
}

export function springProgress(
  t: number,
  profile: "smooth" | "snappy" | "bouncy" = "snappy",
): number {
  if (t >= 1) return 1;
  if (t <= 0) return 0;
  const [frequency, damping] =
    profile === "bouncy" ? [7.5, 3.5] : profile === "smooth" ? [6, 6] : [8, 5];
  const response = (time: number) => {
    if (frequency === damping)
      return 1 - (1 + frequency * time) * Math.exp(-frequency * time);
    const omega = Math.sqrt(frequency * frequency - damping * damping);
    return (
      1 -
      Math.exp(-damping * time) *
        (Math.cos(omega * time) + (damping / omega) * Math.sin(omega * time))
    );
  };
  // Spread the movement across the requested duration and settle with zero velocity.
  const time = t * t * (3 - 2 * t);
  return response(time) / response(1);
}
