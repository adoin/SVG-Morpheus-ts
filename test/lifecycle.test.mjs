import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  SVGMorpheus,
  styleToNorm,
  styleNormCalc,
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
const effectiveOpacity = (node) => {
  let opacity = 1;
  while (node && node.localName !== "svg") {
    opacity *= Number(node.getAttribute("opacity") ?? 1);
    node = node.parentElement;
  }
  return opacity;
};

test("multicolor paths interpolate fill, stroke and alpha independently", () => {
  const el = svg(
    '<g id="a"><path fill="#ff0000" stroke="#00ff00" fill-opacity="0.2" d="M1 1h3v3h-3Z"/><path fill="#0000ff" d="M18 1h3v3h-3Z"/></g><g id="b"><path fill="#ffffff" d="M18 1h3v3h-3Z"/><path fill="#0000ff" stroke="#ff0000" fill-opacity="0.8" d="M1 1h3v3h-3Z"/></g>',
  );
  const m = make(el);
  m.to("b", { easing: "linear" });
  tick(0);
  tick(50);
  const [right, left] = el.querySelectorAll("g path");
  assert.equal(right.getAttribute("fill"), "rgba(128,128,255,1)");
  assert.equal(left.getAttribute("fill"), "rgba(128,0,128,1)");
  assert.equal(left.getAttribute("stroke"), "rgba(128,128,0,1)");
  assert.equal(Number(left.getAttribute("fill-opacity")), 0.5);
  tick(100);
  assert.equal(left.getAttribute("fill"), "rgba(0,0,255,1)");
  m.destroy();
});

test("RGBA colors interpolate alpha without mixing unrelated paths", () => {
  const [a, b] = styleToNorm(
    { fill: "rgba(255,0,0,0.2)" },
    { fill: "rgba(0,0,255,0.8)" },
  );
  assert.deepEqual(styleNormCalc(a, b, 0.5).fill, {
    r: 127.5,
    g: 0,
    b: 127.5,
    opacity: 0.5,
  });
});

test("nested paint overrides and opacity multiplication are retained for separate paths", () => {
  const el = svg(
    '<g id="a" fill="red" opacity="0.5"><g fill="blue" opacity="0.4"><path d="M1 1h3v3h-3Z"/></g><path fill="green" d="M18 1h3v3h-3Z"/></g>',
  );
  const m = make(el);
  const [blue, green] = el.querySelectorAll("g path");
  assert.equal(blue.getAttribute("fill"), "rgba(0,0,255,1)");
  assert.equal(effectiveOpacity(blue), 0.2);
  assert.equal(green.getAttribute("fill"), "rgba(0,128,0,1)");
  assert.equal(effectiveOpacity(green), 0.5);
  m.destroy();
});

test("gradient paint is a discrete switch, not stop interpolation", () => {
  const [a, b] = styleToNorm(
    { fill: "url(#red-blue)" },
    { fill: "url(#green-yellow)" },
  );
  assert.equal(styleNormCalc(a, b, 0.49).fill, "url(#red-blue)");
  assert.equal(styleNormCalc(a, b, 0.5).fill, "url(#green-yellow)");
});

test("controller interpolates inherited linear-gradient stops and coordinates", () => {
  const el = svg(
    '<defs><linearGradient id="base"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient><linearGradient id="first" href="#base"/><linearGradient id="second" x2="0%" y2="100%"><stop offset="0" stop-color="blue"/><stop offset="1" stop-color="red"/></linearGradient></defs><g id="a"><path fill="url(#first)" d="M0 0H20V20Z"/></g><g id="b"><path fill="url(#second)" d="M0 0H20V20Z"/></g>',
  );
  const m = make(el);
  m.to("b", { easing: "linear" });
  tick(0);
  tick(50);
  const path = el.querySelector("g path");
  const id = path.getAttribute("fill").slice(5, -1);
  const g = el.querySelector(`[id="${id}"]`);
  assert.equal(g.getAttribute("x2"), "0.5");
  assert.equal(g.getAttribute("y2"), "0.5");
  assert.equal(
    g.querySelector("stop").getAttribute("stop-color"),
    "rgba(128,0,128,1)",
  );
  const before = path.getAttribute("fill");
  m.cancel();
  m.to("a", { easing: "linear" });
  tick(60);
  const currentId = el
    .querySelector("g path")
    .getAttribute("fill")
    .slice(5, -1);
  assert.equal(
    el.querySelector(`[id="${currentId}"] stop`).getAttribute("stop-color"),
    "rgba(128,0,128,1)",
  );
  tick(160);
  valid(el);
  m.destroy();
});

test("controller preserves real group compositing throughout an opacity transition", () => {
  const el = svg(
    '<g id="a" opacity="0.5"><path fill="red" d="M0 0H20V20Z"/><path fill="blue" d="M0 0H20V20Z"/></g><g id="b" opacity="0.9"><path fill="red" d="M0 0H20V20Z"/><path fill="blue" d="M0 0H20V20Z"/></g>',
  );
  const m = make(el);
  m.to("b", { easing: "linear" });
  tick(0);
  tick(50);
  const [a, b] = el.querySelectorAll("g path");
  assert.equal(a.parentElement.parentElement, b.parentElement.parentElement);
  assert.equal(effectiveOpacity(a.parentElement.parentElement), 0.7);
  tick(100);
  assert.equal(effectiveOpacity(el.querySelector("g path")), 0.9);
  m.destroy();
});

test("eight-digit hexadecimal alpha is retained", () => {
  const [a] = styleToNorm({ fill: "#ff000080" }, { fill: "blue" });
  assert.equal(a.fill.r, 255);
  assert.ok(Math.abs(a.fill.opacity - 128 / 255) < 0.001);
});

test("percentage group and gradient-stop opacity retain their fractional values", () => {
  const el = svg(
    '<defs><linearGradient id="p"><stop offset="0" stop-color="red" stop-opacity="50%"/><stop offset="1" stop-color="blue"/></linearGradient></defs><g id="a" opacity="50%"><path fill="url(#p)" d="M0 0H20V20Z"/></g>',
  );
  const m = make(el);
  const path = el.querySelector("g path");
  assert.equal(effectiveOpacity(path), 0.5);
  const id = path.getAttribute("fill").slice(5, -1);
  assert.equal(
    el.querySelector(`[id="${id}"] stop`).getAttribute("stop-opacity"),
    "0.5",
  );
  m.destroy();
});

test("modern CSS space-separated RGB is parsed", () => {
  const [a] = styleToNorm({ fill: "rgb(255 0 0 / 50%)" }, { fill: "blue" });
  assert.equal(a.fill.r, 255);
  assert.equal(a.fill.opacity, 0.5);
});

test("overlapping paths retain a shared group opacity", () => {
  const el = svg(
    '<g id="a" opacity="0.5"><path fill="red" d="M0 0h10v10H0Z"/><path fill="blue" d="M0 0h10v10H0Z"/></g>',
  );
  const m = make(el);
  // Two opaque overlapping children in a 0.5-opacity group must remain alpha 0.5.
  const [a, b] = [...el.querySelectorAll("g path")];
  assert.equal(a.parentElement.parentElement, b.parentElement.parentElement);
  assert.equal(effectiveOpacity(a.parentElement.parentElement), 0.5);
  assert.equal(Number(a.getAttribute("opacity")), 1);
  m.destroy();
});
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

test("retargeting a gradient crossfade preserves the displayed paints at its first frame", () => {
  const el = svg(
    '<defs><linearGradient id="lin"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient><radialGradient id="rad"><stop stop-color="yellow"/><stop offset="1" stop-color="green"/></radialGradient></defs><g id="a"><path fill="url(#lin)" d="M3 3H21V21H3Z"/></g><g id="b"><path fill="url(#rad)" d="M3 3H21V21H3Z"/></g><g id="c"><path fill="purple" d="M3 3H21V21H3Z"/></g>',
  );
  const m = make(el);
  const displayed = () =>
    [...el.querySelectorAll("g path")]
      .map((path) => {
        let opacity = 1;
        for (let p = path; p && p !== el; p = p.parentElement)
          opacity *= Number(p.getAttribute("opacity") ?? 1);
        const fill = path.getAttribute("fill"),
          id = /url\(#([^\)]+)\)/.exec(fill ?? "")?.[1],
          gradient = id ? el.querySelector(`[id="${id}"]`) : null;
        return {
          d: path.getAttribute("d"),
          opacity: Number(opacity.toFixed(6)),
          fill: gradient ? gradient.localName + gradient.innerHTML : fill,
        };
      })
      .filter((item) => item.opacity > 0)
      .sort((a, b) => a.fill.localeCompare(b.fill));
  m.to("b", { easing: "linear" });
  tick(0);
  tick(40);
  const before = displayed();
  assert.equal(before.length, 2);
  m.to("c", { easing: "linear" });
  tick(40);
  assert.deepEqual(displayed(), before);
  tick(140);
  assert.equal(el.querySelectorAll("g path").length, 1);
  m.destroy();
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

test("native stroke state changes retain shared geometry while the added slash draws from its start", () => {
  const bell = "M5 17H19L17 14V9A5 5 0 0 0 7 9V14Z";
  const el = svg(
      `<g id="a" fill="none" stroke="currentColor"><path d="${bell}"/></g><g id="b" fill="none" stroke="currentColor"><path d="${bell}"/><path d="M3 3L21 21"/></g>`,
    ),
    m = make(el);
  const before = curvePathBBox(
    path2curve(el.querySelector("g path").getAttribute("d")),
  );
  m.to("b", { easing: "linear" });
  tick(0);
  tick(50);
  const common = el.querySelector('path[data-morph-index="0"]'),
    slash = el.querySelector('path[data-morph-index="1"]');
  const box = curvePathBBox(path2curve(common.getAttribute("d"))),
    line = curvePathBBox(path2curve(slash.getAttribute("d")));
  for (const key of ["x", "y", "w", "h"])
    assert.ok(Math.abs(box[key] - before[key]) < 1e-8);
  assert.ok(Math.abs(line.x - 3) < 1e-8 && Math.abs(line.y - 3) < 1e-8);
  assert.ok(Math.abs(line.w - 9) < 0.01 && Math.abs(line.h - 9) < 0.01);
  m.destroy();
});

test("unlock to solid record fades balancing strokes instead of leaving opaque endpoint dots", () => {
  const el = svg(
      '<g id="a" fill="none" stroke="#43546e" stroke-width="1.8" stroke-linecap="round"><path d="M5 11H19V22H5Z"/><path d="M8 11V6A4 4 0 0 1 16 6"/><path d="M12 15V18"/></g><g id="b"><circle fill="#ef5b68" cx="12" cy="12" r="9"/></g>',
    ),
    m = make(el);
  m.to("b", { easing: "linear" });
  tick(0);
  tick(95);
  const balancing = [...el.querySelectorAll("path[data-morph-index]")].filter(
    (p) => p.getAttribute("data-morph-index") !== "0",
  );
  assert.equal(balancing.length, 2);
  for (const node of balancing) {
    let alpha = Number(node.getAttribute("stroke-opacity") ?? 1);
    for (let p = node; p && p !== el; p = p.parentElement)
      alpha *= Number(p.getAttribute("opacity") ?? 1);
    const stroke = node.getAttribute("stroke");
    const colorAlpha = /rgba\([^,]+,[^,]+,[^,]+,([^\)]+)\)/.exec(
      stroke ?? "",
    )?.[1];
    if (colorAlpha !== undefined) alpha *= Number(colorAlpha);
    assert.ok(alpha < 0.01, `Residual stroke alpha ${alpha}`);
  }
  tick(100);
  assert.equal(el.querySelectorAll("g path").length, 1);
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
