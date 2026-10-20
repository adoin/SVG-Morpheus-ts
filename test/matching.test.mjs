import test from "node:test";
import assert from "node:assert/strict";
import {
  createMorphPlan,
  path2curve,
  path2string,
  curveCalc,
  curvePathBBox,
  springProgress,
} from "../dist/core.js";

const near = (actual, expected, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} != ${expected}`,
  );
test("unmatched stroked lines draw and retract from their original starting point", () => {
  const line = { d: "M2 4H22", draw: true };
  const birth = createMorphPlan([], [line]),
    death = createMorphPlan([line], []);
  for (const t of [0.25, 0.5, 0.75]) {
    const a = curvePathBBox(path2curve(birth.frame(t)[0])),
      b = curvePathBBox(path2curve(death.frame(t)[0]));
    near(a.x, 2);
    near(a.y, 4);
    near(a.w, 20 * t, 0.02);
    near(b.x, 2);
    near(b.w, 20 * (1 - t), 0.02);
  }
  near(curvePathBBox(path2curve(birth.frame(1.2)[0])).w, 20);
  near(curvePathBBox(path2curve(death.frame(1.2)[0])).w, 0);
});
test("drawing a curved stroke retains its original radius instead of scaling the arc", () => {
  const plan = createMorphPlan(
    [],
    [{ d: "M10 0A10 10 0 0 1 0 10", draw: true }],
  );
  const curve = path2curve(plan.frame(0.5)[0]),
    end = curve.at(-1).slice(-2);
  near(Math.hypot(...end), 10, 0.01);
  near(end[0], Math.SQRT1_2 * 10, 0.02);
  near(end[1], Math.SQRT1_2 * 10, 0.02);
});
const endpoints = (d) => {
  const c = path2curve(d);
  return [c[0].slice(1), c.at(-1).slice(-2)];
};
const span = (d) => {
  const [a, b] = endpoints(d);
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
};
const bounds = (d) => curvePathBBox(path2curve(d));
const box = (x, y = 0) => ({ d: `M${x} ${y}h2v2h-2Z` });
test("opposite winding square/circle and interrupted intermediate contours stay within icon bounds", () => {
  const square = { d: "M3 3H21V21H3Z" },
    circle = { d: "M2 12A10 10 0 1 0 22 12A10 10 0 1 0 2 12Z" };
  for (const [a, b] of [
    [square, circle],
    [circle, square],
  ]) {
    const plan = createMorphPlan([a], [b]);
    for (const t of [0, 0.1, 0.3, 0.5, 0.684757, 0.9, 1, 1.01]) {
      const d = plan.frame(t)[0],
        bb = bounds(d);
      assert.ok(
        bb.x > -1 && bb.y > -1 && bb.w < 25 && bb.h < 25,
        JSON.stringify({ t, bb }),
      );
      const interrupted = bounds(createMorphPlan([{ d }], [a]).frame(0.5)[0]);
      assert.ok(interrupted.w < 25 && interrupted.h < 25);
    }
  }
});
const signedArea = (d) => {
  const result = [];
  let points = [],
    current = [0, 0];
  for (const [command, ...n] of path2curve(d)) {
    if (command === "M") {
      if (points.length) result.push(points);
      points = [];
      current = n;
      points.push(n);
      continue;
    }
    const p = current;
    for (let i = 1; i <= 16; i++) {
      const t = i / 16,
        s = 1 - t;
      points.push(
        [0, 1].map(
          (j) =>
            s ** 3 * p[j] +
            3 * s * s * t * n[j] +
            3 * s * t * t * n[j + 2] +
            t ** 3 * n[j + 4],
        ),
      );
    }
    current = n.slice(-2);
  }
  if (points.length) result.push(points);
  return result.map(
    (p) =>
      p.reduce((sum, a, i) => {
        const b = p[(i + 1) % p.length];
        return sum + a[0] * b[1] - a[1] * b[0];
      }, 0) / 2,
  );
};

test("separates a quarter turn from shape change, avoiding the legacy contraction", () => {
  const from = "M-10 0L10 0",
    to = "M0 -10L0 10";
  const plan = createMorphPlan(
    [{ d: from, allowReverse: false }],
    [{ d: to, allowReverse: false }],
  );
  near(span(plan.frame(0.5)[0]), 20);
  const [a, b] = path2curve(from, to);
  near(span(path2string(curveCalc(a, b, 0.5))), Math.sqrt(200));
});
test("closed cyclic origins and open reversed directions do not collapse stationary geometry", () => {
  const square = createMorphPlan(
    [{ d: "M0 0H10V10H0Z" }],
    [{ d: "M10 10H0V0H10Z" }],
  );
  const actual = bounds(square.frame(0.5)[0]);
  near(actual.x, 0);
  near(actual.y, 0);
  near(actual.w, 10);
  near(actual.h, 10);
  const line = createMorphPlan([{ d: "M0 0L10 0" }], [{ d: "M10 0L0 0" }]);
  near(span(line.frame(0.5)[0]), 10);
});
test("global assignment prevents both reordered paths and greedy pairing traps", () => {
  assert.deepEqual(
    createMorphPlan([box(0), box(20)], [box(20), box(0)]).pairs,
    [
      { fromIndex: 1, toIndex: 0 },
      { fromIndex: 0, toIndex: 1 },
    ],
  );
  const plan = createMorphPlan([box(0), box(4)], [box(3), box(100)]);
  assert.deepEqual(plan.pairs, [
    { fromIndex: 0, toIndex: 0 },
    { fromIndex: 1, toIndex: 1 },
  ]);
});
test("curve endpoints and curved geometry survive subdivision at mismatched knots", () => {
  const a = "M0 0C0 12 12 12 12 0",
    b = "M3 2C3 8 7 8 7 2C7 -4 15 -4 15 2";
  const plan = createMorphPlan([{ d: a }], [{ d: b }]);
  for (const t of [0, 0.1, 0.5, 0.9, 1, 1.05]) {
    const d = plan.frame(t)[0];
    assert.match(d, /C/);
    assert.doesNotMatch(d, /[\u0000]|NaN|Infinity/);
  }
  const source = bounds(a),
    start = bounds(plan.frame(0)[0]);
  const target = bounds(b),
    end = bounds(plan.frame(1)[0]);
  for (const key of ["x", "y", "w", "h"]) {
    near(start[key], source[key]);
    near(end[key], target[key]);
  }
});
test("compound holes retain contour winding and correspondence", () => {
  const a = "M0 0H20V20H0ZM5 5V15H15V5Z";
  const b = "M20 20H0V0H20ZM15 15V5H5V15Z";
  const plan = createMorphPlan([{ d: a }], [{ d: b }]);
  const middle = signedArea(plan.frame(0.5)[0]);
  assert.equal(middle.length, 2);
  assert.ok(middle[0] > 0);
  assert.ok(middle[1] < 0);
  near(middle[0], 400);
  near(middle[1], -100);
});
test("births and disappearances are local, finite and keep target ordering", () => {
  const plan = createMorphPlan([box(80), box(100)], [box(80)]);
  assert.deepEqual(plan.pairs, [
    { fromIndex: 0, toIndex: 0 },
    { fromIndex: 1, toIndex: null },
  ]);
  near(bounds(plan.frame(1)[1]).cx, 101, 1e-3);
  const born = createMorphPlan([], [box(80)]);
  near(bounds(born.frame(0)[0]).cx, 81);
  for (const t of [0, 0.5, 1])
    assert.doesNotMatch(born.frame(t).join(""), /NaN|Infinity/);
  assert.deepEqual(createMorphPlan([], []).frame(0.5), []);
});
test("plans are immutable, do not change caller geometry and reject nonfinite progress", () => {
  const input = [
    {
      d: [
        ["M", 0, 0],
        ["C", 0, 1, 1, 1, 1, 0],
      ],
    },
  ];
  const snapshot = JSON.stringify(input),
    plan = createMorphPlan(input, input);
  plan.frame(0.5);
  assert.equal(JSON.stringify(input), snapshot);
  assert.throws(() => plan.pairs.push({ fromIndex: 0, toIndex: 0 }), TypeError);
  assert.throws(() => plan.frame(NaN), /finite/);
});
test("published spring profiles have stable endpoints and explicit overshoot", () => {
  for (const profile of ["smooth", "snappy", "bouncy"]) {
    assert.equal(springProgress(0, profile), 0);
    assert.equal(springProgress(1, profile), 1);
  }
  assert.ok(
    Math.max(
      ...Array.from({ length: 100 }, (_, i) =>
        springProgress(i / 100, "bouncy"),
      ),
    ) > 1,
  );
});

test("spring bounce does not regrow a disappearing hole or invert a newly born contour", () => {
  const outlined = { d: "M2 2H22V22H2ZM6 6V18H18V6Z" },
    solid = { d: "M2 2H22V22H2Z" };
  const parts = (d) => {
    const groups = [];
    for (const segment of path2curve(d)) {
      if (segment[0] === "M") groups.push([]);
      groups.at(-1).push(segment);
    }
    return groups;
  };
  const disappearing = createMorphPlan([outlined], [solid]);
  for (const t of [1, 1.01, 1.1, 1.3]) {
    const hole = parts(disappearing.frame(t)[0])[1];
    near(curvePathBBox(hole).w, 0);
    near(curvePathBBox(hole).h, 0);
  }
  const appearing = createMorphPlan([solid], [outlined]);
  const before = parts(appearing.frame(-0.2)[0])[1];
  near(curvePathBBox(before).w, 0);
  near(curvePathBBox(before).h, 0);
});

test("spring presets retain visible movement and settle continuously across the duration", () => {
  for (const profile of ["smooth", "snappy", "bouncy"]) {
    assert.ok(
      springProgress(0.25, profile) > 0.05 &&
        springProgress(0.25, profile) < 0.8,
    );
    assert.ok(Math.abs(springProgress(0.99999, profile) - 1) < 0.00001);
    const peak = Math.max(
      ...Array.from({ length: 101 }, (_, i) =>
        springProgress(i / 100, profile),
      ),
    );
    if (profile === "smooth") near(peak, 1);
    if (profile === "snappy") assert.ok(peak > 1 && peak < 1.15);
    if (profile === "bouncy") assert.ok(peak > 1.2 && peak < 1.4);
  }
});

test("eye pupil reaches the correct circular endpoint before raw SVG restoration", () => {
  const target =
    "M16 10a6 6 0 1 0 6 6a6 6 0 0 0-6-6m0 10a4 4 0 1 1 4-4a4 4 0 0 1-4 4";
  const plan = createMorphPlan(
    [{ d: "M12 15.73a4 4 0 0 1 3.7-3.7l1.81-1.82a6 6 0 0 0-7.33 7.33Z" }],
    [{ d: target }],
  );
  for (const t of [0.9999, 1]) {
    const c = path2curve(plan.frame(t)[0]);
    assert.equal(c.filter((s) => s[0] === "M").length, 2);
    assert.doesNotMatch(plan.frame(t)[0], /NaN|Infinity/);
    const extent = bounds(plan.frame(t)[0]);
    near(extent.x, 10, 0.03);
    near(extent.y, 10, 0.03);
    near(extent.w, 12, 0.03);
    near(extent.h, 12, 0.03);
  }
});
