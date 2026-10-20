import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseColor,
  interpolateColor,
  createPaintPlan,
  renderPaintFrame,
} from "../dist/core.js";

const gradient = (
  type = "linearGradient",
  stops = [
    { offset: 0, color: "red" },
    { offset: 1, color: "blue" },
  ],
  attributes = {},
) => ({ type, attributes, stops });
const style = (fill, groups = []) => ({
  attributes: { fill: "black", stroke: "none", opacity: "1" },
  fill,
  groups,
});

test("interrupted composited paint keeps weights and compacts identical ungrouped paints", () => {
  let snapshot = {
    attributes: {},
    layers: [
      { style: style("red"), weight: 0.4 },
      { style: style("blue"), weight: 0.6 },
    ],
  };
  const input = JSON.stringify(snapshot);
  const first = createPaintPlan([snapshot], [style("green")]).frame(0.25)[0];
  first.forEach((layer, i) =>
    assert.ok(Math.abs(layer.weight - [0.3, 0.45, 0.25][i]) < 1e-12),
  );
  assert.equal(JSON.stringify(snapshot), input);
  for (let i = 0; i < 200; i++) {
    const frame = createPaintPlan(
      [snapshot],
      [style(i % 2 ? "red" : "blue")],
    ).frame(0.2);
    snapshot = { attributes: {}, layers: frame[0] };
    assert.ok(frame[0].length <= 2);
    assert.ok(
      Math.abs(frame[0].reduce((sum, l) => sum + l.weight, 0) - 1) < 1e-9,
    );
  }
  const end = createPaintPlan([snapshot], [style("green")]).frame(1);
  assert.equal(end[0].length, 1);
  assert.equal(end[0][0].style.fill, "green");
});
test("DOM-free parser covers CSS names, short/long alpha hex and modern RGB/HSL", () => {
  assert.equal(parseColor("rebeccapurple").r, 102);
  assert.equal(parseColor("#f008").opacity, 136 / 255);
  assert.equal(parseColor("#ff000080").opacity, 128 / 255);
  assert.equal(parseColor("rgb(100% 0% 0% / 25%)").opacity, 0.25);
  assert.equal(parseColor("hsl(.5turn 100% 50% / 50%)").g, 255);
  assert.equal(parseColor("hsl(-180deg 100% 50%)").b, 255);
  assert.equal(parseColor("currentColor"), undefined);
  assert.equal(parseColor("var(--paint)"), undefined);
});
test("alpha interpolation is premultiplied and none fades the colored paint", () => {
  assert.equal(
    interpolateColor("transparent", "red", 0.5),
    "rgba(255,0,0,0.5)",
  );
  assert.equal(interpolateColor("none", "blue", 0.5), "rgba(0,0,255,0.5)");
  assert.equal(interpolateColor("red", "none", 0.5), "rgba(255,0,0,0.5)");
});
test("linear gradients interpolate color stops, geometry and transform without midpoint jumps", () => {
  const a = gradient(),
    b = gradient(
      "linearGradient",
      [
        { offset: 0, color: "blue" },
        { offset: 0.5, color: "white", opacity: 0.5 },
        { offset: 1, color: "red" },
      ],
      { x2: "0%", y2: "100%", gradientTransform: "matrix(2 0 0 2 4 6)" },
    );
  const before = JSON.stringify([a, b]);
  const plan = createPaintPlan([style(a)], [style(b)]);
  const middle = plan.frame(0.5)[0][0].style.fill;
  assert.equal(middle.stops.length, 3);
  assert.equal(middle.stops[0].color, "rgba(128,0,128,1)");
  assert.equal(middle.attributes.x2, ".5".replace(/^\./, "0."));
  assert.equal(middle.attributes.y2, "0.5");
  assert.equal(middle.attributes.gradientTransform, "matrix(1.5 0 0 1.5 2 3)");
  const x = parseColor(plan.frame(0.499)[0][0].style.fill.stops[0].color);
  const y = parseColor(plan.frame(0.501)[0][0].style.fill.stops[0].color);
  assert.ok(Math.abs(x.r - y.r) <= 1);
  assert.equal(JSON.stringify([a, b]), before);
  assert.throws(() => plan.frame(NaN), /Nonfinite/);
});
test("radial focal geometry, solid-to-gradient and transparent stops remain finite", () => {
  const a = gradient("radialGradient", [
    { offset: 0, color: "#ff000000" },
    { offset: 1, color: "red" },
  ]);
  const b = gradient(
    "radialGradient",
    [
      { offset: 0, color: "blue" },
      { offset: 1, color: "yellow" },
    ],
    { cx: "75%", r: "25%" },
  );
  const frame = createPaintPlan([style(a)], [style(b)]).frame(0.5);
  assert.equal(frame[0][0].style.fill.attributes.cx, "0.625");
  assert.equal(frame[0][0].style.fill.attributes.fx, "0.625");
  assert.equal(frame[0][0].style.fill.stops[0].color, "rgba(0,0,255,0.5)");
  const mixed = createPaintPlan([style("red")], [style(b)]).frame(0.5)[0][0]
    .style.fill;
  assert.equal(mixed.type, "radialGradient");
  assert.doesNotMatch(
    renderPaintFrame(["M0 0H10V10Z"], frame, "radial"),
    /NaN|undefined/,
  );
});
test("different gradient types crossfade and have independently scoped definitions", () => {
  const frame = createPaintPlan(
    [style(gradient())],
    [style(gradient("radialGradient"))],
  ).frame(0.5);
  assert.deepEqual(
    frame[0].map((s) => s.weight),
    [0.5, 0.5],
  );
  const markup = renderPaintFrame(["M0 0H10V10Z"], frame, "instance-a");
  assert.match(markup, /linearGradient/);
  assert.match(markup, /radialGradient/);
  assert.match(markup, /isolation:isolate/);
  assert.match(markup, /mix-blend-mode:plus-lighter/);
  const ids = [...markup.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.doesNotMatch(
    renderPaintFrame(["M0 0H10V10Z"], frame, "instance-b"),
    /instance-a/,
  );
});
test("duplicate gradient stops retain hard edges", () => {
  const g = gradient("linearGradient", [
    { offset: 0, color: "red" },
    { offset: 0.5, color: "red" },
    { offset: 0.5, color: "blue" },
    { offset: 1, color: "blue" },
  ]);
  const mid = createPaintPlan([style(g)], [style(g)]).frame(0.5)[0][0].style
    .fill;
  assert.equal(mid.stops.filter((s) => s.offset === 0.5).length, 2);
});
test("nested groups match by depth and membership and interpolate opacity once", () => {
  const a = style("red", [
    { id: "a", opacity: 0.5 },
    { id: "b", opacity: 0.4 },
  ]);
  const b = style("blue", [
    { id: "x", opacity: 0.7 },
    { id: "y", opacity: 0.8 },
  ]);
  const frame = createPaintPlan([a], [b]).frame(0.5);
  assert.deepEqual(
    frame[0][0].style.groups.map((g) => +g.opacity.toFixed(3)),
    [0.6, 0.6],
  );
});
