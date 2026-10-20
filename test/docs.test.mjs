import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
test("documentation anchors and English/Chinese copy stay complete", () => {
  const doc = new JSDOM(read("../demos/index.html")).window.document;
  const source = ts.createSourceFile(
    "docs.js",
    read("../demos/docs.js"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const keys = new Set();
  function walk(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === "english"
    )
      for (const p of node.initializer.properties) keys.add(p.name.text);
    ts.forEachChild(node, walk);
  }
  walk(source);
  for (const el of doc.querySelectorAll("[data-i18n]")) {
    assert.ok(keys.has(el.dataset.i18n), el.dataset.i18n);
    assert.ok(el.textContent.trim());
  }
  for (const el of doc.querySelectorAll('a[href^="#"]')) {
    const id = el.getAttribute("href").slice(1);
    if (id) assert.ok(doc.getElementById(id), id);
  }
  assert.ok(doc.querySelector("#changelog"));
  assert.ok(doc.querySelector("#migration"));
  assert.ok(doc.querySelector(".research-notice"));
});
test("README and on-site release notes match the published manifest version", () => {
  const pkg = JSON.parse(read("../package.json"));
  for (const p of ["../README.md", "../README.zh.md"]) {
    const text = read(p);
    assert.ok(text.includes(pkg.version));
    assert.ok(text.includes("svg-morpheus-ts/core"));
    assert.ok(text.includes("#icon-gallery"));
    assert.ok(text.includes("centerline") || text.includes("中心线"));
    assert.doesNotMatch(text, /v1\.2\.0|Gulp.*modern/);
  }
  assert.ok(read("../CHANGELOG.md").includes(`## [${pkg.version}]`));
  assert.ok(read("../demos/index.html").includes(pkg.version));
});
