import test from "node:test";
import { mountProjectIcons } from "../demos/project-svg-controller.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import SVGMorpheus from "../dist/index.js";
import { iconifyToSVG, registerIconifySet } from "../demos/iconify-adapter.mjs";
const { icons } = createRequire(import.meta.url)("@iconify-json/lucide");
function setupUI() {
  const dom = new JSDOM(
    readFileSync(new URL("../demos/index.html", import.meta.url), "utf8"),
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.DOMParser = dom.window.DOMParser;
  const frames = new Map();
  let sequence = 0,
    count = 0;
  window.requestAnimationFrame = (cb) => {
    frames.set(++sequence, cb);
    return sequence;
  };
  window.cancelAnimationFrame = (id) => frames.delete(id);
  window.matchMedia = () => ({ matches: false });
  const root = document.querySelector("#project-svg"),
    menuSVG = readFileSync(
      new URL("../demos/assets/project-menu.svg", import.meta.url),
      "utf8",
    ),
    closeSVG = readFileSync(
      new URL("../demos/assets/project-close.svg", import.meta.url),
      "utf8",
    );
  const ui = mountProjectIcons(root, {
    createController: (svg, options) => {
      count++;
      return new SVGMorpheus(svg, options);
    },
    menuSVG,
    closeSVG,
    lucide: icons,
  });
  return {
    root,
    ui,
    frames,
    menuSVG,
    count: () => count,
    tick(time) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((cb) => cb(time));
    },
    close() {
      ui.destroy();
      dom.window.close();
      delete globalThis.window;
      delete globalThis.document;
      delete globalThis.DOMParser;
    },
  };
}
test("editable project demo reuses its preview on switching and preserves it after invalid registration", () => {
  const e = setupUI();
  try {
    const svg = e.root.querySelector("#project-preview");
    e.root.querySelector("#project-show-b").click();
    e.tick(0);
    e.tick(300);
    assert.equal(e.count(), 1);
    assert.equal(e.root.querySelector("#project-preview"), svg);
    assert.ok(e.frames.size);
    e.root.querySelector("#project-a").value =
      '<svg xmlns="http://www.w3.org/2000/svg"><filter id="f"/></svg>';
    e.root.querySelector("#project-register").click();
    assert.equal(
      e.root.querySelector("#project-status").dataset.state,
      "error",
    );
    assert.equal(e.root.querySelector("#project-preview"), svg);
    e.root.querySelector("#project-iconify").click();
    assert.notEqual(e.root.querySelector("#project-preview"), svg);
    assert.equal(
      e.root.querySelector("#project-status").dataset.state,
      "ready",
    );
    e.ui.setLanguage("en");
    assert.equal(
      e.root.querySelector("#project-show-b").textContent,
      "Switch to B",
    );
    assert.match(
      e.root.querySelector("#project-status").textContent,
      /Both SVGs/,
    );
  } finally {
    e.close();
  }
});
test("local file selection reads both SVGs and ignores a stale selection after a preset change", async () => {
  const e = setupUI();
  try {
    const input = e.root.querySelector("#project-files");
    const a =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="8"/></svg>';
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [{ text: async () => a }, { text: async () => e.menuSVG }],
    });
    input.dispatchEvent(new window.Event("change"));
    await new Promise(setImmediate);
    assert.equal(e.root.querySelector("#project-a").value, a);
    assert.equal(
      e.root.querySelector("#project-preview").getAttribute("viewBox"),
      "0 0 32 32",
    );
    let resolve;
    const pending = new Promise((done) => {
      resolve = done;
    });
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [{ text: () => pending }, { text: () => pending }],
    });
    input.dispatchEvent(new window.Event("change"));
    e.root.querySelector("#project-local").click();
    resolve(a);
    await new Promise(setImmediate);
    assert.equal(e.root.querySelector("#project-a").value, e.menuSVG);
  } finally {
    e.close();
  }
});
function setup() {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>',
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.DOMParser = dom.window.DOMParser;
  const frames = new Map();
  let sequence = 0;
  window.requestAnimationFrame = (cb) => {
    frames.set(++sequence, cb);
    return sequence;
  };
  window.cancelAnimationFrame = (id) => frames.delete(id);
  window.matchMedia = () => ({ matches: false });
  const svg = document.querySelector("svg"),
    morph = new SVGMorpheus(svg, { duration: 600, rotation: "none" });
  return {
    svg,
    morph,
    tick(time) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((cb) => cb(time));
    },
    close() {
      morph.destroy();
      dom.window.close();
      delete globalThis.window;
      delete globalThis.document;
      delete globalThis.DOMParser;
    },
  };
}
test("existing SVG file strings and SVG elements register into one initially empty host", () => {
  const e = setup();
  try {
    const menu = readFileSync(
        new URL("../demos/assets/project-menu.svg", import.meta.url),
        "utf8",
      ),
      close = readFileSync(
        new URL("../demos/assets/project-close.svg", import.meta.url),
        "utf8",
      );
    e.morph.addIcon("menu", menu);
    e.morph.addIcon(
      "close",
      new DOMParser().parseFromString(close, "image/svg+xml").documentElement,
    );
    assert.deepEqual(e.morph.getIconIds(), ["menu", "close"]);
    e.morph.set("menu");
    e.morph.to("close");
    e.tick(0);
    e.tick(300);
    assert.ok(e.morph.isAnimating);
    assert.doesNotMatch(e.svg.innerHTML, /NaN|Infinity/);
    e.tick(600);
    assert.equal(e.morph.isAnimating, false);
    assert.equal(e.svg.getAttribute("viewBox"), "0 0 24 24");
  } finally {
    e.close();
  }
});
test("actual Iconify collection data, alias rotation and flips preserve SVG geometry and viewBox", () => {
  const e = setup();
  try {
    registerIconifySet(e.morph, icons, ["menu", "x", "search"]);
    for (const id of ["lucide:menu", "lucide:x", "lucide:search"]) {
      e.morph.set(id);
      assert.ok(e.svg.querySelector("path"));
      assert.doesNotMatch(e.svg.innerHTML, /NaN|Infinity/);
    }
    const collection = {
      prefix: "fixture",
      width: 16,
      height: 32,
      icons: { base: { body: '<path fill="currentColor" d="M2 4H10V20Z"/>' } },
      aliases: { turned: { parent: "base", rotate: 1, hFlip: true } },
    };
    registerIconifySet(e.morph, collection, ["turned"]);
    e.morph.set("fixture:turned");
    assert.equal(e.svg.getAttribute("viewBox"), "0 0 32 16");
    const raw = iconifyToSVG({
      width: 32,
      height: 16,
      body: '<circle cx="16" cy="8" r="4" fill="currentColor"/>',
    });
    e.morph.addIcon("raw", raw);
    e.morph.set("raw");
    assert.equal(e.svg.getAttribute("viewBox"), "0 0 32 16");
  } finally {
    e.close();
  }
});
test("missing Iconify names are reported before registration and the bundled subset stays small", () => {
  const e = setup();
  try {
    assert.throws(
      () => registerIconifySet(e.morph, icons, ["menu", "not-an-icon"]),
      /Unknown Iconify/,
    );
    assert.deepEqual(e.morph.getIconIds(), []);
    const subset = JSON.parse(
      readFileSync(
        new URL("../demos/assets/iconify-lucide.json", import.meta.url),
        "utf8",
      ),
    );
    assert.equal(Object.keys(subset.icons).length, 3);
    assert.ok(JSON.stringify(subset).length < 5000);
    for (const name of ["menu", "x", "search"])
      assert.equal(subset.icons[name].body, icons.icons[name].body);
  } finally {
    e.close();
  }
});
