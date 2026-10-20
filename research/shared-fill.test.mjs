import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createSharedFillPlan as plan } from "./shared-fill.mjs";
import { eyePair } from "./fixtures.mjs";
test("filled eye common geometry is invariant and difference layers alone change", () => {
  const p = plan(eyePair.from, eyePair.to, { prefix: "eye" });
  for (const t of [0.01, 0.25, 0.5, 0.75, 0.99]) {
    const doc = new JSDOM(`<svg>${p.frame(t, { motion: "fade" })}</svg>`).window
      .document;
    assert.equal(
      doc.querySelector("[data-shared-fill]").outerHTML,
      new JSDOM(`<svg>${p.frame(0.5)}</svg>`).window.document.querySelector(
        "[data-shared-fill]",
      ).outerHTML,
    );
    assert.equal(
      Number(doc.querySelector("[data-source-only]").getAttribute("opacity")),
      1 - t,
    );
    assert.ok(
      doc.querySelector("[data-target-only]").getAttribute("clip-path"),
    );
  }
});
test("retraction moves opaque disconnected pieces toward their own fixed tips", () => {
  const p = plan(eyePair.from, eyePair.to, { prefix: "eye" });
  assert.ok(p.pieces.length >= 2 && p.pieces.length < 10);
  for (const t of [0.25, 0.5, 0.75]) {
    const doc = new JSDOM(`<svg>${p.frame(t)}</svg>`).window.document;
    assert.equal(
      doc.querySelector("[data-source-only]").hasAttribute("opacity"),
      false,
    );
    const pieces = [...doc.querySelectorAll("[data-retract-piece]")];
    assert.equal(pieces.length, p.pieces.length);
    pieces.forEach((el, i) => {
      const values = el
        .getAttribute("transform")
        .match(/-?[\d.]+(?:e[-+]?\d+)?/g)
        .map(Number);
      const [x, y] = p.pieces[i].anchor;
      assert.equal(values[0], 1 - t);
      assert.equal(values[3], 1 - t);
      assert.ok(Math.abs(values[0] * x + values[4] - x) < 1e-9);
      assert.ok(Math.abs(values[3] * y + values[5] - y) < 1e-9);
    });
  }
});
test("endpoints render exact original paths, including compound holes", () => {
  const p = plan(eyePair.from, eyePair.to, { prefix: "eye" });
  for (const [t, paths] of [
    [0, eyePair.from],
    [1, eyePair.to],
  ]) {
    const doc = new JSDOM(`<svg>${p.frame(t)}</svg>`).window.document;
    assert.deepEqual(
      [...doc.querySelectorAll("path")].map((e) => e.getAttribute("d")),
      paths,
    );
    assert.equal(doc.querySelector("mask"), null);
  }
});
test("IDs are isolated and unsafe input rejected", () => {
  const a = plan(eyePair.from, eyePair.to, { prefix: "one" }),
    b = plan(eyePair.from, eyePair.to, { prefix: "two" });
  assert.ok(!b.frame(0.5).includes("one-"));
  assert.throws(() => plan(['M0 0" onload="x'], [], { prefix: "x" }));
  assert.throws(() => plan([], [], { prefix: 'bad"' }));
  assert.throws(() => a.frame(NaN));
  assert.throws(() => plan([], [], { prefix: "x", direction: [0, 0] }));
});
