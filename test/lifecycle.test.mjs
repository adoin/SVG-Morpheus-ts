import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  SVGMorpheus,
  styleToNorm,
  path2curve,
  curvePathBBox,
} from "../dist/index.js";
let dom, frames, seq;
beforeEach(() => {
  dom = new JSDOM(
    '<!doctype html><html><head style="color:green"></head><body></body></html>',
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.DOMParser = dom.window.DOMParser;
  frames = new Map();
  seq = 0;
  window.requestAnimationFrame = (fn) => {
    frames.set(++seq, fn);
    return seq;
  };
  window.cancelAnimationFrame = (id) => frames.delete(id);
  window.matchMedia = () => ({ matches: false });
});
afterEach(() => {
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.DOMParser;
});
const tick = (time) => {
  const work = [...frames.values()];
  frames.clear();
  work.forEach((fn) => fn(time));
};
const svg = (
  groups = '<g id="a"><path fill="currentColor" d="M0 0L10 0L10 10Z"/></g><g id="b"><circle fill="currentColor" cx="12" cy="12" r="8"/></g>',
) => {
  document.body.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${groups}</svg>`;
  return document.querySelector("svg");
};
const make = (el) =>
  new SVGMorpheus(el, { iconId: "a", duration: 100, rotation: "none" });
const valid = (el) =>
  assert.doesNotMatch(el.innerHTML, /[\u0000]|NaN|Infinity|undefined/);
test("zero duration commits synchronously, invalid targets do not cancel a running transition", () => {
  const el = svg(),
    m = make(el);
  let calls = 0;
  m.to("b", { duration: 0 }, () => calls++);
  assert.equal(calls, 1);
  assert.equal(frames.size, 0);
  valid(el);
  m.to("a");
  assert.equal(m.isAnimating, true);
  assert.throws(() => m.to("missing"), /Unknown icon/);
  assert.equal(frames.size, 1);
  m.destroy();
  assert.equal(frames.size, 0);
});
test("cancel preserves the displayed geometry and destroy is idempotent", () => {
  const el = svg(),
    m = make(el);
  let calls = 0;
  m.to("b", {}, () => calls++);
  tick(0);
  tick(40);
  const before = el.querySelector("path").getAttribute("d");
  m.cancel();
  assert.equal(el.querySelector("path").getAttribute("d"), before);
  assert.equal(calls, 0);
  assert.equal(frames.size, 0);
  m.to("a");
  tick(80);
  m.destroy();
  m.destroy();
  assert.equal(frames.size, 0);
  assert.equal(calls, 0);
  assert.throws(() => m.to("a"), /destroyed/);
  assert.throws(() => m.addIcon("c", "<path/>"), /destroyed/);
});
test("finish cancellation fires completion exactly once and trims balancing paths", () => {
  const el = svg(
    '<g id="a"><path d="M0 0L4 0L4 4Z"/><path d="M10 10L14 10L14 14Z"/></g><g id="b"><path d="M0 0L20 0L20 20Z"/></g>',
  );
  const m = make(el);
  let count = 0;
  m.to("b", {}, () => count++);
  tick(0);
  tick(40);
  m.cancel(true);
  assert.equal(count, 1);
  assert.equal(el.querySelectorAll("g path").length, 1);
  assert.equal(frames.size, 0);
  m.cancel(true);
  assert.equal(count, 1);
  valid(el);
  m.destroy();
});
test("nested groups, transforms, inherited paint, polyline, holes and style survive", () => {
  const el = svg(
    '<g id="a" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><g transform="translate(2 3)"><polyline points="0,0 10,0 10,10"/></g></g><g id="b" fill="currentColor" fill-rule="evenodd"><path d="M0 0L20 0L20 20L0 20ZM5 5L5 15L15 15L15 5Z"/></g>',
  );
  const m = make(el);
  const path = el.querySelector("g path");
  assert.match(path.getAttribute("d"), /^M2,3/);
  assert.equal(path.getAttribute("fill"), "none");
  assert.equal(path.getAttribute("stroke"), "currentColor");
  assert.equal(path.getAttribute("stroke-linecap"), "round");
  m.set("b");
  assert.equal(el.querySelector("g path").getAttribute("fill-rule"), "evenodd");
  assert.equal(el.querySelectorAll("g path").length, 1);
  valid(el);
  m.destroy();
});
test("icons can be added, replaced and removed without remounting the SVG", () => {
  const el = svg(""),
    m = new SVGMorpheus(el, { rotation: "none" });
  m.addIcon(
    "first",
    '<svg viewBox="0 0 32 32"><g fill="currentColor"><path d="M0 0H32V32Z"/></g></svg>',
  );
  assert.deepEqual(m.getIconIds(), ["first"]);
  assert.equal(el.getAttribute("viewBox"), "0 0 32 32");
  m.addIcon("second", '<path fill="currentColor" d="M1 1L8 1L8 8Z"/>');
  m.to("second", { duration: 0 });
  const old = el.querySelector("g path").getAttribute("d");
  m.addIcon("second", '<path fill="currentColor" d="M2 2L10 2L10 10Z"/>');
  m.set("second");
  assert.notEqual(el.querySelector("g path").getAttribute("d"), old);
  assert.equal(m.removeIcon("second"), true);
  assert.equal(el.querySelectorAll("g path").length, 0);
  assert.equal(m.removeIcon("unknown"), false);
  valid(el);
  m.destroy();
});
test("rapid updates keep only the newest callback, including timestamp zero", () => {
  const el = svg(),
    m = make(el);
  let stale = 0,
    current = 0;
  m.to("b", {}, () => stale++);
  tick(0);
  tick(30);
  m.to("a", {}, () => current++);
  tick(40);
  tick(140);
  assert.equal(stale, 0);
  assert.equal(current, 1);
  assert.equal(frames.size, 0);
  valid(el);
  m.destroy();
});
test("reduced motion jumps without queuing RAF; named color conversion does not mutate head", () => {
  window.matchMedia = () => ({ matches: true });
  const el = svg();
  const m = make(el);
  m.to("b");
  assert.equal(frames.size, 0);
  const before = document.head.getAttribute("style");
  styleToNorm({ fill: "blue" }, { fill: "green" });
  assert.equal(document.head.getAttribute("style"), before);
  assert.equal(document.querySelectorAll("span").length, 0);
  m.destroy();
});
test("pending object load is detached on destruction", () => {
  const object = document.createElement("object");
  object.getSVGDocument = () => null;
  let removed = 0;
  const remove = object.removeEventListener.bind(object);
  object.removeEventListener = (...args) => {
    removed++;
    return remove(...args);
  };
  const m = new SVGMorpheus(object);
  m.destroy();
  object.dispatchEvent(new window.Event("load"));
  assert.equal(removed, 1);
  assert.equal(frames.size, 0);
});
test("repeating gradient changes replaces definitions rather than duplicating IDs", () => {
  const el = svg(
    '<defs><linearGradient id="paint"><stop offset="0%" stop-color="red"/><stop offset="100%" stop-color="blue"/></linearGradient></defs><g id="a"><path fill="url(#paint)" d="M0 0H5V5Z"/></g><g id="b"><path fill="url(#paint)" d="M0 0H10V10Z"/></g>',
  );
  const m = make(el);
  for (let i = 0; i < 10; i++) m.set(i % 2 ? "a" : "b");
  const ids = [...el.querySelectorAll("defs [id]")].map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  valid(el);
  m.destroy();
});

test("matched controller rotates without contraction while legacy remains selectable", () => {
  const input =
    '<g id="a" fill="none" stroke="currentColor"><path d="M2 12L22 12"/></g><g id="b" fill="none" stroke="currentColor"><path d="M12 2L12 22"/></g>';
  for (const algorithm of ["matched", "legacy"]) {
    const el = svg(input),
      m = new SVGMorpheus(el, {
        algorithm,
        iconId: "a",
        rotation: "none",
        duration: 100,
        reducedMotion: "never",
      });
    m.to("b");
    tick(0);
    tick(50);
    const bounds = curvePathBBox(
      path2curve(el.querySelector("g path").getAttribute("d")),
    );
    const diagonal = Math.hypot(bounds.w, bounds.h);
    assert.ok(
      Math.abs(diagonal - (algorithm === "matched" ? 20 : Math.sqrt(200))) <
        0.001,
    );
    m.cancel();
    valid(el);
    m.destroy();
  }
});
test("controller matches reordered painted paths and preserves their source positions", () => {
  const el = svg(
    '<g id="a"><path fill="red" d="M1 1h3v3h-3Z"/><path fill="blue" d="M18 1h3v3h-3Z"/></g><g id="b"><path fill="blue" d="M18 1h3v3h-3Z"/><path fill="red" d="M1 1h3v3h-3Z"/></g>',
  );
  const m = make(el);
  m.to("b");
  tick(0);
  tick(50);
  const paths = Array.from(el.querySelectorAll("g path"));
  assert.ok(
    Math.abs(curvePathBBox(path2curve(paths[0].getAttribute("d"))).x - 18) <
      0.001,
  );
  assert.ok(
    Math.abs(curvePathBBox(path2curve(paths[1].getAttribute("d"))).x - 1) <
      0.001,
  );
  tick(100);
  valid(el);
  m.destroy();
});
