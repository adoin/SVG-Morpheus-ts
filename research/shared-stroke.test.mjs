import test from "node:test";
import assert from "node:assert/strict";
import { createSharedStrokePlan as plan } from "./shared-stroke.mjs";
test("AB stays byte-identical while BC retracts and expands; B is not a source node", () => {
  for (const [a, b, growing] of [
    ["M0 0H20", "M0 0H10", false],
    ["M0 0H10", "M0 0H20", true],
  ]) {
    const p = plan(a, b);
    assert.equal(p.growing, growing);
    for (const t of [0, 0.1, 0.5, 0.9, 1])
      assert.equal(p.frame(t).shared, p.shared);
    assert.equal(p.frame(growing ? 0 : 1).difference, "");
    assert.ok(p.frame(0.5).difference);
  }
});
test("accepts exact cubic subcurve with different segmentation and reverse direction", () => {
  const p = plan("M0 0C0 20 20 20 20 0", "M10 15C5 15 0 10 0 0");
  assert.ok(p.shared);
  assert.equal(p.frame(1).difference, "");
});
test("rejects point-only overlap, different trajectories, closed shapes and invalid frames", () => {
  for (const target of ["M0 0L10 10", "M0 0Q5 10 10 0", "M5 0H10"])
    assert.throws(() => plan("M0 0H20", target));
  assert.throws(() => plan("M0 0H20Z", "M0 0H10"));
  assert.throws(() => plan("M0 0H20", "M0 0H10").frame(NaN));
});
