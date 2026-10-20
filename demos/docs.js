import SVGMorpheus, { easings, springProgress } from "../src/index.ts";
import { analyzeSharedBoundaries } from "../research/shared-boundaries.mjs";
import { eyePair, eyeCenterlines } from "../research/fixtures.mjs";
import { createSharedStrokePlan } from "../research/shared-stroke.mjs";
import { createSharedFillPlan } from "../research/shared-fill.mjs";
import pkg from "../package.json";
import { createIconGallery } from "./icon-gallery.mjs";

const english = {
  skip: "Skip to content",
  tryGallery: "Open the icon playground",
  readStart: "Start with a minimal example →",
  featureMotion: "Change targets at any time",
  featureMotionHint:
    "Continue geometry and paint from the displayed frame when another target is selected.",
  featurePaint: "Color and gradients move together",
  featurePaintHint:
    "Retain multicolor, alpha, compound holes and opacity-group compositing.",
  featureCore: "Browser controller + independent core",
  featureCoreHint:
    "TypeScript, ESM/CJS, no runtime dependencies; the core works in Node/SSR.",
  migration: "Upgrade to 2.0",
  changelog: "Changelog",
  migrationHint:
    "The package name, DOM controller and core import paths are unchanged. Keep your to() calls and destroy() on cleanup. Try custom artwork in the playground before updating visual snapshots.",
  migrationDraw:
    "New or disappearing stroke-only contours draw/retract along their paths. Filled artwork does not use this rule.",
  migrationPaint:
    "Interrupted paint layers stay on one logical geometry path instead of multiplying geometry paths.",
  migrationDefaults:
    "Defaults remain 750ms, quad-in-out easing and clock spin. Use rotation: 'none' to disable extra spin.",
  migrationCore:
    "Custom core renderers can set draw: true on stroked MorphPath inputs. Centerline inference and locking shared filled regions are not automatic features.",
  releaseStroke:
    "Native stroked contours can draw and retract along their original paths.",
  releaseInterrupt:
    "Fixed path growth during repeated interruption, retaining current color and gradient continuity.",
  releaseDots:
    "Fixed round-capped disappearing strokes lingering as endpoint dots when switching to solid artwork.",
  releaseDocs:
    "Added a 43-icon, 17-pair playground and refreshed bilingual usage and upgrade guides.",
  allReleases: "Read the full release history →",
  researchScope: "EXPERIMENTAL · NOT INCLUDED IN THE NPM PACKAGE",
  researchScopeHint:
    "Shared-boundary and centerline prototypes are shown below. Use the controller or core API for applications. Authored centerlines do not imply automatic drawing inference for arbitrary filled SVG.",
  coreDraw:
    "Set draw: true on stroked paths to draw or retract unmatched contours along their original paths. Keep it off for filled artwork; matched contours still use geometry morphing.",
  gallery: "Icon playground",
  galleryHint:
    "Click any icon, switch across categories, or choose another while the animation is running. One preview instance continues from the displayed frame toward the new target.",
  galleryFilter: "Category",
  galleryPairs: "Common state pairs",
  galleryPairsHint: "Click a pair repeatedly to switch between its two states.",
  galleryLimit:
    "New or disappearing native strokes draw or retract along their paths. Other geometry and paint morph normally, including filled shapes, holes, multiple contours, multicolor, alpha and gradients. Filled-eye centerlines still need to be authored.",
  eyeTitle: "Eye transition: keep the shared region fixed",
  eyeHint:
    "The disappearing arcs retract along their own centerlines, preserving their radius, width and original vector edges. Shared areas stay fixed. Scrub to see the moving endpoint, or compare the previous scaling and fading experiments.",
  eyeActual: "Actual appearance",
  eyeRegions: "Green stays · Orange retracts · Blue reveals",
  eyeRetract: "Contract toward connection tips",
  eyeDraw: "Retract along the stroke direction",
  eyeFade: "Fade (previous approach)",
  eyeLimit:
    "These filled icons do not store their construction strokes. This example supplies four authored centerline guides, projects the difference pieces onto them, and trims the visible length. Centerline inference from arbitrary filled SVG remains unsolved. Not connected to production core.",
  strokeTitle: "Keep AB, animate only BC",
  strokeHint:
    "Green shared geometry stays fixed while the blue difference retracts or extends along its original curve. Supports lines, curves and reversed paths. Open-stroke research only; filled regions and holes are not supported.",
  strokeLine: "Line: B is not a source node",
  strokeCurve: "Cubic curve: keep the first half",
  strokeReverse: "Target drawn in reverse",
  strokePlay: "Play / reverse",
  strokeProgress: "Progress",
  strokeLegend:
    "Green: preserved AB. Blue: changing BC. Scrub to inspect individual frames. Playback takes 1.6 seconds.",
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
const gallery = createIconGallery();
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
  gallery.setLanguage(value);
  document
    .querySelector("#eye-motion")
    .setAttribute(
      "aria-label",
      language === "zh" ? "差异动画方式" : "Difference motion",
    );
  for (const [id, zh, en] of [
    ["eye-animation", "眼睛共区动画", "Eye shared-region animation"],
    ["eye-regions", "眼睛区域分解", "Eye region breakdown"],
  ])
    document
      .querySelector(`#${id}`)
      .setAttribute("aria-label", language === "zh" ? zh : en);
  document
    .querySelector("#stroke-case")
    .setAttribute(
      "aria-label",
      language === "zh" ? "共边实验示例" : "Shared stroke example",
    );
  document
    .querySelector("#stroke-preview")
    .setAttribute(
      "aria-label",
      language === "zh" ? "公共描边动画" : "Shared stroke animation",
    );
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
const strokeCases = {
  line: ["M2 12H30", "M2 12H16"],
  curve: ["M2 20C2 0 30 0 30 20", "M2 20C2 10 9 5 16 5"],
  reverse: ["M2 12H30", "M16 12H2"],
};
let strokePlan,
  strokeRAF,
  strokeProgress = 0,
  strokeDestination = 1;
const slider = document.querySelector("#stroke-progress");
function drawStroke(value) {
  strokeProgress = value;
  slider.value = String(value);
  const frame = strokePlan.frame(value);
  document.querySelector("#stroke-preview").innerHTML =
    `<path data-shared d="${frame.shared}" stroke="#15956b"/><path data-difference d="${frame.difference}" stroke="#3569ed"/>`;
}
function resetStroke() {
  cancelAnimationFrame(strokeRAF);
  strokePlan = createSharedStrokePlan(
    ...strokeCases[document.querySelector("#stroke-case").value],
  );
  strokeDestination = 1;
  drawStroke(0);
}
document.querySelector("#stroke-case").addEventListener("change", resetStroke);
slider.addEventListener("input", () => {
  cancelAnimationFrame(strokeRAF);
  drawStroke(Number(slider.value));
});
document.querySelector("#stroke-play").addEventListener("click", () => {
  cancelAnimationFrame(strokeRAF);
  const from = strokeProgress,
    to = strokeDestination,
    start = performance.now();
  strokeDestination = to === 1 ? 0 : 1;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    drawStroke(to);
    return;
  }
  const tick = (now) => {
    const t = Math.min(1, (now - start) / 1600);
    drawStroke(from + (to - from) * (t * t * (3 - 2 * t)));
    if (t < 1) strokeRAF = requestAnimationFrame(tick);
  };
  strokeRAF = requestAnimationFrame(tick);
});
resetStroke();
const eyePlan = createSharedFillPlan(eyePair.from, eyePair.to, {
  prefix: "eye-actual",
  sourceGuides: eyeCenterlines,
});
const regionPlan = createSharedFillPlan(eyePair.from, eyePair.to, {
  prefix: "eye-regions",
  sourceGuides: eyeCenterlines,
});
const eyeSlider = document.querySelector("#eye-progress");
let eyeProgress = 0,
  eyeDestination = 1,
  eyeRAF;
function drawEye(p) {
  eyeProgress = p;
  eyeSlider.value = String(p);
  const motion = document.querySelector("#eye-motion").value;
  document.querySelector("#eye-animation").innerHTML = eyePlan.frame(p, {
    motion,
  });
  document.querySelector("#eye-regions").innerHTML = regionPlan.frame(p, {
    highlight: true,
    motion,
  });
}
document.querySelector("#eye-motion").addEventListener("change", () => {
  cancelAnimationFrame(eyeRAF);
  drawEye(eyeProgress);
});
eyeSlider.addEventListener("input", () => {
  cancelAnimationFrame(eyeRAF);
  drawEye(Number(eyeSlider.value));
});
document.querySelector("#eye-play").addEventListener("click", () => {
  cancelAnimationFrame(eyeRAF);
  const from = eyeProgress,
    to = eyeDestination,
    start = performance.now();
  eyeDestination = to === 1 ? 0 : 1;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    drawEye(to);
    return;
  }
  const tick = (now) => {
    const t = Math.min(1, (now - start) / 1600);
    drawEye(from + (to - from) * t * t * (3 - 2 * t));
    if (t < 1) eyeRAF = requestAnimationFrame(tick);
  };
  eyeRAF = requestAnimationFrame(tick);
});
drawEye(0);
setLanguage(
  new URLSearchParams(location.search).get("lang") === "en" ? "en" : "zh",
);
window.addEventListener("pagehide", (event) => {
  gallery.pause();
  cancelAnimationFrame(eyeRAF);
  cancelAnimationFrame(strokeRAF);
  if (!event.persisted) {
    controller.destroy();
    gallery.destroy();
  }
});
