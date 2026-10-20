import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import SVGMorpheus, {
  createMorphPlan,
  path2curve,
  curvePathBBox,
} from "../dist/index.js";
import { iconCatalog, galleryGroups, galleryPairs } from "./icon-catalog.mjs";

const finite = (svg) => {
  assert.doesNotMatch(svg.innerHTML, /NaN|Infinity|undefined|\u0000/);
  for (const node of svg.querySelectorAll("g path")) {
    const box = curvePathBBox(path2curve(node.getAttribute("d")));
    assert.ok([box.x, box.y, box.w, box.h].every(Number.isFinite));
    assert.ok(
      box.x > -72 && box.y > -72 && box.x + box.w < 96 && box.y + box.h < 96,
      JSON.stringify(box),
    );
  }
};
function environment() {
  const dom = new JSDOM(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="color:#43546e">${galleryGroups("test")}</svg>`,
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.DOMParser = dom.window.DOMParser;
  const frames = new Map();
  let id = 0;
  window.requestAnimationFrame = (cb) => {
    frames.set(++id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => frames.delete(id);
  window.matchMedia = () => ({ matches: false });
  const svg = document.querySelector("svg");
  const controller = new SVGMorpheus(svg, {
    iconId: "menu",
    duration: 100,
    rotation: "none",
  });
  return {
    svg,
    controller,
    frames,
    tick(time) {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((cb) => cb(time));
    },
    destroy() {
      controller.destroy();
      dom.window.close();
      delete globalThis.window;
      delete globalThis.document;
      delete globalThis.DOMParser;
    },
  };
}
test("catalog pairs exist and all ordered geometry transitions remain finite", () => {
  assert.equal(new Set(iconCatalog.map((i) => i.id)).size, iconCatalog.length);
  assert.ok(
    galleryPairs.every((pair) =>
      pair.every((id) => iconCatalog.some((i) => i.id === id)),
    ),
  );
  let count = 0;
  for (const from of iconCatalog)
    for (const to of iconCatalog)
      if (from !== to) {
        const plan = createMorphPlan(
          from.parts.map((p) => ({
            d: p.d,
            allowReverse: p.fill === undefined,
            draw: p.fill === undefined,
          })),
          to.parts.map((p) => ({
            d: p.d,
            allowReverse: p.fill === undefined,
            draw: p.fill === undefined,
          })),
        );
        for (const progress of [0, 0.35, 0.75, 1, 1.08])
          for (const d of plan.frame(progress)) {
            assert.doesNotMatch(d, /NaN|Infinity/);
            const b = curvePathBBox(path2curve(d));
            assert.ok(
              [b.x, b.y, b.w, b.h].every(Number.isFinite),
              `${from.id} → ${to.id}`,
            );
            assert.ok(
              b.w < 96 && b.h < 96,
              `${from.id} → ${to.id}: ${JSON.stringify(b)}`,
            );
          }
        count++;
      }
  console.log(
    `Checked ${iconCatalog.length} icons, ${count} ordered geometry transitions`,
  );
});
test("all ordered controller transitions finish at their target with scoped paint IDs", () => {
  const e = environment();
  let clock = 0,
    count = 0;
  try {
    for (const from of iconCatalog)
      for (const to of iconCatalog)
        if (from !== to) {
          e.controller.set(from.id);
          e.controller.to(to.id, { duration: 100, easing: "quad-in-out" });
          e.tick(clock);
          e.tick(clock + 50);
          finite(e.svg);
          e.tick(clock + 100);
          assert.equal(e.frames.size, 0, `${from.id} → ${to.id}`);
          assert.equal(
            e.svg.querySelectorAll("g path").length,
            to.parts.length,
            `${from.id} → ${to.id}`,
          );
          const ids = [...e.svg.querySelectorAll("[id]")].map((el) => el.id);
          assert.equal(new Set(ids).size, ids.length);
          finite(e.svg);
          clock += 200;
          count++;
        }
    console.log(`Checked ${count} ordered DOM/paint transitions`);
  } finally {
    e.destroy();
  }
});
test("rapid retargeting from real intermediate frames settles without leftover RAFs", () => {
  const e = environment();
  let clock = 0;
  try {
    for (let i = 0; i < 80; i++) {
      const target = iconCatalog[(i * 17 + 11) % iconCatalog.length];
      e.controller.to(target.id, { duration: 100, easing: "quad-in-out" });
      e.tick(clock);
      e.tick(clock + 23);
      finite(e.svg);
      clock += 24;
      assert.ok(
        new Set(
          [...e.svg.querySelectorAll("[data-morph-index]")].map((el) =>
            el.getAttribute("data-morph-index"),
          ),
        ).size <= 9,
      );
    }
    e.controller.to("radial", { duration: 100 });
    e.tick(clock);
    e.tick(clock + 100);
    finite(e.svg);
    assert.equal(e.svg.querySelectorAll("g path").length, 1);
    assert.equal(e.frames.size, 0);
  } finally {
    e.destroy();
  }
});
test("reduced-motion selection jumps to an exact target without scheduling animation", () => {
  const e = environment();
  try {
    window.matchMedia = () => ({ matches: true });
    e.controller.to("donut");
    finite(e.svg);
    assert.equal(e.frames.size, 0);
    assert.equal(e.svg.querySelectorAll("g path").length, 1);
  } finally {
    e.destroy();
  }
});
