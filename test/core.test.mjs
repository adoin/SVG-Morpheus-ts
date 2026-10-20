import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as main from "../dist/index.js";
import * as core from "../dist/core.js";
const require = createRequire(import.meta.url);

test("ESM and CJS entries import without browser globals", () => {
  assert.equal(typeof window, "undefined");
  assert.equal(typeof main.SVGMorpheus, "function");
  assert.equal(typeof require("../dist/index.cjs").SVGMorpheus, "function");
  assert.equal(typeof require("../dist/core.cjs").path2curve, "function");
  assert.throws(() => new main.SVGMorpheus("svg"), /browser DOM/);
});
test("string and numeric array commands roundtrip without mutation or NUL", () => {
  for (const input of [
    [["M", 1, 2], ["l", 3, 4], ["Z"]],
    [[77, 1, 2], [108, 3, 4], [122]],
  ]) {
    const original = JSON.stringify(input);
    const converted = core.path2curve(input);
    assert.equal(JSON.stringify(input), original);
    const d = core.path2string(converted);
    assert.ok(d.startsWith("M1,2"));
    assert.doesNotMatch(d, /[\u0000]|NaN|Infinity/);
    const [a, b] = core.path2curve(
      converted,
      core.path2curve("M0 0C1 2 3 4 5 6"),
    );
    for (const t of [0, 0.25, 0.5, 1])
      assert.doesNotMatch(
        core.path2string(core.curveCalc(a, b, t)),
        /[\u0000]|NaN|Infinity/,
      );
  }
});
test("a direct path2curve result can be used as another path2curve input", () => {
  const first = core.path2curve("M0 0H10V20Z");
  assert.deepEqual(core.path2curve(first), first);
});
test("currentColor and CSS variables remain contextual and numeric paint interpolates", () => {
  const [a, b] = main.styleToNorm(
    { fill: "currentColor", "stroke-width": "2", opacity: "0" },
    { fill: "currentColor", "stroke-width": "4", opacity: "1" },
  );
  const attrs = main.styleNormToString(main.styleNormCalc(a, b, 0.5));
  assert.equal(attrs.fill, "currentColor");
  assert.equal(attrs["stroke-width"], 3);
  assert.equal(attrs.opacity, 0.5);
  assert.equal(
    main.styleToNorm(
      { fill: "var(--icon-color)" },
      { fill: "var(--icon-color)" },
    )[0].fill,
    "var(--icon-color)",
  );
});

test("consecutive large arcs normalize completely, including compound eye contours", () => {
  const eye =
    "M16 10a6 6 0 1 0 6 6a6 6 0 0 0-6-6m0 10a4 4 0 1 1 4-4a4 4 0 0 1-4 4";
  const curves = core.path2curve(eye);
  assert.ok(
    curves.every((segment) => segment[0] === "M" || segment[0] === "C"),
  );
  assert.equal(curves.filter((s) => s[0] === "M").length, 2);
  let point = [0, 0],
    contour = 0;
  for (const [command, ...v] of curves) {
    if (command === "M") {
      point = v;
      contour++;
      continue;
    }
    assert.equal(v.length, 6);
    for (let i = 0; i <= 24; i++) {
      const t = i / 24,
        u = 1 - t;
      const x =
        u ** 3 * point[0] +
        3 * u * u * t * v[0] +
        3 * u * t * t * v[2] +
        t ** 3 * v[4];
      const y =
        u ** 3 * point[1] +
        3 * u * u * t * v[1] +
        3 * u * t * t * v[3] +
        t ** 3 * v[5];
      assert.ok(
        Math.abs(Math.hypot(x - 16, y - 16) - (contour === 1 ? 6 : 4)) < 0.02,
      );
    }
    point = v.slice(-2);
  }
  const [a, b] = core.path2curve("M0 0L1 1", eye);
  assert.equal(a.length, b.length);
  assert.ok(
    [...a, ...b].every((segment) => segment[0] === "M" || segment[0] === "C"),
  );
});
