import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSharedBoundaries as analyze } from "./shared-boundaries.mjs";
import { eyePair } from "./fixtures.mjs";
test("finds a common line across different path segmentation and direction", () => {
  const r = analyze(["M0 0H10"], ["M4 0H0", "M10 0H4"]);
  assert.ok(r.coverage.from > 0.99);
  assert.ok(r.coverage.to > 0.99);
});
test("reports a partial overlap rather than whole-path equality", () => {
  const r = analyze(["M0 0H10"], ["M5 0H15"]);
  assert.ok(Math.abs(r.coverage.from - 0.5) < 0.04);
  assert.ok(Math.abs(r.coverage.to - 0.5) < 0.04);
});
test("does not equate translated shapes or a single crossing point", () => {
  assert.equal(analyze(["M0 0H10"], ["M0 5H10"]).coverage.from, 0);
  assert.equal(analyze(["M0 0H10"], ["M5 -5V5"]).coverage.from, 0);
});
test("finds partial shared boundaries in real Carbon eye icons without equal paths", () => {
  assert.ok(eyePair.from.every((d) => !eyePair.to.includes(d)));
  const before = JSON.stringify(eyePair),
    r = analyze(eyePair.from, eyePair.to),
    reverse = analyze(eyePair.to, eyePair.from);
  assert.ok(r.coverage.from > 0.1 && r.coverage.from < 0.95);
  assert.ok(r.coverage.to > 0.1 && r.coverage.to < 0.95);
  assert.equal(r.coverage.from, reverse.coverage.to);
  assert.equal(JSON.stringify(eyePair), before);
  console.log(
    "Carbon eye boundary coverage",
    r.coverage,
    "fragments",
    r.fromFragments.length,
    r.toFragments.length,
  );
});
test("empty and degenerate geometry remains finite; invalid options fail", () => {
  assert.equal(analyze([], []).coverage.from, 0);
  assert.equal(analyze(["M0 0L0 0"], ["M0 0"]).coverage.to, 0);
  assert.throws(() => analyze([], [], { tolerance: 0 }), /Invalid/);
  assert.throws(() => analyze(["M0 0H10000000"], []), /Invalid coordinates/);
  assert.throws(() => analyze(["M0 0H100"], [], { maxStep: 1e-9 }), /budget/);
});
