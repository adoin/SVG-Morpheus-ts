import SVGMorpheus, { easings, springProgress } from "../src/index.ts";
import { analyzeSharedBoundaries } from "../research/shared-boundaries.mjs";
import { eyePair } from "../research/fixtures.mjs";
import pkg from "../package.json";

const english = {
  language: "Language",
  start: "Get started",
  try: "Interactive example",
  core: "DOM-free core",
  research: "Shared boundary research",
  support: "Supported SVG",
  legacy: "Object / dynamic loading examples",
  headline: "Morph SVG icons smoothly",
  summary:
    "Group icons by id inside an SVG, create an instance, then call to() to select the target. Use the browser controller or the independent pure-function core.",
  minimal: "Minimal usage",
  markupHint:
    "Each g represents an icon; its id is the name used when switching.",
  tryHint:
    "Click a different target icon. You can select another target while an animation is running.",
  duration: "Duration",
  motion: "Motion style",
  smooth: "Smooth",
  snappy: "Subtle bounce",
  bouncy: "Bouncy",
  menu: "Menu",
  close: "Close",
  check: "Check",
  warm: "Warm colors",
  cool: "Cool colors",
  gradient: "Gradient",
  springHint:
    "This example registers springProgress() presets in easings. The DOM controller always takes a named easing.",
  apiHint:
    "The constructor accepts an SVG element, selector, or object element. Common options and instance methods are listed below.",
  option: "Option",
  default: "Default",
  meaning: "Meaning",
  initial: "Initial group id. Omit to show the last group.",
  durationMeaning: "Milliseconds; 0 switches immediately.",
  easingMeaning:
    "Named easing function; register custom functions through easings.",
  rotationMeaning:
    "Additional spin: clock, counterclock, none, random. none still allows an intrinsic shape rotation.",
  reducedMeaning:
    "user follows the OS; always skips animation; never keeps animations enabled.",
  method: "Method",
  toMeaning: "Morph to a target; per-call options override defaults.",
  setMeaning: "Switch immediately without animation.",
  cancelMeaning:
    "Stop at the displayed frame; finish=true completes to the target.",
  addMeaning: "Add or replace an icon from an SVG string or element.",
  removeMeaning: "Remove an icon; returns whether the id existed.",
  idsMeaning: "Get registered icon ids.",
  destroyMeaning:
    "Stop animation and remove listeners; the instance cannot be reused.",
  coreHint:
    "Use the core entry in Node, SSR or a custom renderer. Supply paths on a common coordinate grid and render the returned frames. The core never accesses document.",
  paint: "Colors and gradients",
  paintHint:
    "createPaintPlan() interpolates paint and renderPaintFrame() generates SVG markup. Multicolor paths, alpha, linear/radial gradients and compositing groups are supported. Incompatible gradients crossfade; do not multiply group opacity into individual paths.",
  contextPaint:
    "currentColor and CSS variables remain browser-resolved. Resolve them to concrete colors before numeric interpolation.",
  experimental: "INDEPENDENT RESEARCH · NOT USED BY THE ANIMATION",
  researchHint:
    "These eye icons have no identical complete paths. The experiment detects approximately coincident curve fragments by position and tangent direction and highlights them in green.",
  tolerance: "Tolerance (icon coordinate units)",
  source: "Source",
  target: "Target",
  shared: "Green: detected shared boundaries",
  researchLimit:
    "Ratios measure sampled boundary length, not filled area or semantic similarity. Splits, merges and hole correspondence are not solved. The detected fragments cannot simply be locked into the production morph planner.",
  researchCode: "Research code and findings",
  supportHint:
    "Supports path, line, polyline, polygon, rect, circle, ellipse, nested groups and transforms. Masks, clipping and filters are unsupported; remove them or retain static artwork. Module imports are Node/SSR-safe; constructing a controller needs a browser.",
  copy: "Copy code",
  copied: "Copied",
  previewLabel: "SVG morph preview",
};
const originals = new Map(
  [...document.querySelectorAll("[data-i18n]")].map((el) => [
    el,
    el.textContent,
  ]),
);
let language = "zh";
const text = (key) =>
  language === "en"
    ? (english[key] ?? key)
    : ({ copy: "复制代码", copied: "已复制", previewLabel: "SVG 变形预览" }[
        key
      ] ?? key);
document.querySelector("[data-version]").textContent = `v${pkg.version}`;
for (const preset of ["snappy", "bouncy"])
  easings[`spring-${preset}`] = (t) => springProgress(t, preset);
const controller = new SVGMorpheus("#demo", {
  iconId: "menu",
  duration: 750,
  rotation: "none",
});
for (const button of document.querySelectorAll("[data-target]"))
  button.addEventListener("click", () => {
    controller.to(button.dataset.target, {
      duration: Number(document.querySelector("#duration").value),
      easing: document.querySelector("#motion").value,
    });
    for (const item of document.querySelectorAll("[data-target]"))
      item.setAttribute("aria-pressed", String(item === button));
  });
for (const pre of document.querySelectorAll("pre")) {
  const button = document.createElement("button");
  button.className = "copy";
  button.textContent = text("copy");
  button.setAttribute("aria-label", text("copy"));
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(
        pre.querySelector("code").textContent,
      );
      button.textContent = text("copied");
      setTimeout(() => (button.textContent = text("copy")), 1200);
    } catch {
      button.textContent = text("copy");
    }
  });
  pre.append(button);
}
const markup = (paths, attributes = 'fill="currentColor"') =>
  paths.map((d) => `<path d="${d}" ${attributes}/>`).join("");
function renderResearch() {
  const tolerance = Number(document.querySelector("#tolerance").value),
    result = analyzeSharedBoundaries(eyePair.from, eyePair.to, { tolerance });
  document.querySelector("#tolerance-value").textContent = tolerance.toFixed(2);
  document.querySelector("#research-from").innerHTML = markup(eyePair.from);
  document.querySelector("#research-to").innerHTML = markup(eyePair.to);
  document.querySelector("#research-shared").innerHTML =
    markup(eyePair.from, 'fill="currentColor" opacity="0.12"') +
    markup(
      result.fromFragments.map((f) => f.d),
      'fill="none" stroke="#15956b" stroke-width="0.7"',
    );
  const from = (result.coverage.from * 100).toFixed(1),
    to = (result.coverage.to * 100).toFixed(1);
  document.querySelector("#coverage").textContent =
    language === "en"
      ? `Sampled shared boundary coverage: source ${from}%, target ${to}%.`
      : `采样公共边界长度覆盖：原图 ${from}%，目标图 ${to}%。`;
}
function setLanguage(value) {
  language = value;
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = `SVG Morpheus TS · ${language === "zh" ? "文档" : "Documentation"}`;
  document
    .querySelector(".sidebar")
    .setAttribute(
      "aria-label",
      language === "zh" ? "文档导航" : "Documentation",
    );
  document
    .querySelector(".targets")
    .setAttribute("aria-label", language === "zh" ? "目标图标" : "Target icon");
  for (const [id, zh, en] of [
    ["research-from", "原图眼睛", "Source eye"],
    ["research-to", "目标眼睛", "Target eye"],
    [
      "research-shared",
      "绿色高亮的公共边界",
      "Shared boundaries highlighted in green",
    ],
  ])
    document
      .querySelector(`#${id}`)
      .setAttribute("aria-label", language === "zh" ? zh : en);
  document.querySelector("#language").value = language;
  for (const [el, original] of originals)
    el.textContent =
      language === "en" ? (english[el.dataset.i18n] ?? original) : original;
  for (const button of document.querySelectorAll(".copy")) {
    button.textContent = text("copy");
    button.setAttribute("aria-label", text("copy"));
  }
  document
    .querySelector("#demo")
    .setAttribute("aria-label", text("previewLabel"));
  document
    .querySelector("#duration")
    .setAttribute("aria-label", language === "en" ? "Duration" : "动画时长");
  document
    .querySelector("#motion")
    .setAttribute(
      "aria-label",
      language === "en" ? "Motion style" : "动画效果",
    );
  renderResearch();
}
document
  .querySelector("#language")
  .addEventListener("change", (event) => setLanguage(event.target.value));
document.querySelector("#tolerance").addEventListener("input", renderResearch);
setLanguage("zh");
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) controller.destroy();
});
