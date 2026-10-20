import { path2curve, path2string, pathToAbsolute } from "./svg-path";
import {
  extractDefsInfo,
  extractSvgRootAttributes,
  extractViewBoxInfo,
} from "./helpers";
import type { Icon, IconItem, StyleAttributes } from "./types";

export type Affine = [number, number, number, number, number, number];
const identity: Affine = [1, 0, 0, 1, 0, 0];
const multiply = (a: Affine, b: Affine): Affine => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
export function transformCurve(path: string, matrix: Affine): string {
  const paths: (string | number)[][][] = [];
  for (const segment of pathToAbsolute(path) as (string | number)[][]) {
    if (segment[0] === "M" || !paths.length) paths.push([]);
    paths[paths.length - 1].push(segment);
  }
  return paths
    .map((path) => {
      const closed = path[path.length - 1][0] === "Z";
      const result = path2curve(path).map(
        ([command, ...values]: (string | number)[]) => {
          const output: (string | number)[] = [command];
          for (let i = 0; i < values.length; i += 2) {
            const x = Number(values[i]),
              y = Number(values[i + 1]);
            output.push(
              matrix[0] * x + matrix[2] * y + matrix[4],
              matrix[1] * x + matrix[3] * y + matrix[5],
            );
          }
          return output;
        },
      );
      return path2string(result) + (closed ? "Z" : "");
    })
    .join("");
}
export function parseTransform(value: string): Affine {
  let result = identity;
  for (const match of value.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
    const v = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (!v.every(Number.isFinite)) throw new Error("Invalid SVG transform");
    let next: Affine;
    switch (match[1]) {
      case "matrix":
        if (v.length !== 6) throw new Error("Invalid SVG matrix");
        next = v as Affine;
        break;
      case "translate":
        next = [1, 0, 0, 1, v[0], v[1] || 0];
        break;
      case "scale":
        next = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
        break;
      case "rotate": {
        const c = Math.cos((v[0] * Math.PI) / 180),
          s = Math.sin((v[0] * Math.PI) / 180),
          x = v[1] || 0,
          y = v[2] || 0;
        next = [c, s, -s, c, x - c * x + s * y, y - s * x - c * y];
        break;
      }
      case "skewX":
        next = [1, 0, Math.tan((v[0] * Math.PI) / 180), 1, 0, 0];
        break;
      case "skewY":
        next = [1, Math.tan((v[0] * Math.PI) / 180), 0, 1, 0, 0];
        break;
      default:
        throw new Error(`Unsupported SVG transform: ${match[1]}`);
    }
    result = multiply(result, next);
  }
  return result;
}
function geometry(element: SVGElement): string {
  const n = (key: string) => Number(element.getAttribute(key) || 0);
  switch (element.localName) {
    case "path":
      return element.getAttribute("d") || "";
    case "line":
      return `M${n("x1")} ${n("y1")}L${n("x2")} ${n("y2")}`;
    case "polygon":
    case "polyline": {
      const values = (element.getAttribute("points") || "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (
        values.length < 4 ||
        values.length % 2 ||
        !values.every(Number.isFinite)
      )
        throw new Error("Invalid SVG points");
      return (
        values.map((v, i) => `${i % 2 ? " " : i ? "L" : "M"}${v}`).join("") +
        (element.localName === "polygon" ? "Z" : "")
      );
    }
    case "circle":
    case "ellipse": {
      const x = n("cx"),
        y = n("cy"),
        rx = n(element.localName === "circle" ? "r" : "rx"),
        ry = n(element.localName === "circle" ? "r" : "ry");
      return `M${x - rx} ${y}A${rx} ${ry} 0 1 0 ${x + rx} ${y}A${rx} ${ry} 0 1 0 ${x - rx} ${y}Z`;
    }
    case "rect": {
      const x = n("x"),
        y = n("y"),
        w = n("width"),
        h = n("height"),
        rx = Math.min(w / 2, n("rx") || n("ry")),
        ry = Math.min(h / 2, n("ry") || n("rx"));
      if (!rx || !ry) return `M${x} ${y}h${w}v${h}h${-w}Z`;
      return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
    }
    default:
      throw new Error(`Unsupported SVG element: ${element.localName}`);
  }
}
const paintKeys = [
  "fill",
  "stroke",
  "stroke-width",
  "fill-rule",
  "stroke-linecap",
  "stroke-linejoin",
  "fill-opacity",
  "stroke-opacity",
  "opacity",
] as const;
export function readIcon(
  id: string,
  element: SVGElement,
  root: SVGSVGElement,
): Icon {
  const originalRoot = root.cloneNode(true) as SVGSVGElement;
  originalRoot
    .querySelectorAll("[data-svg-morpheus-owned]")
    .forEach((node) => node.remove());
  const rootInfo = extractDefsInfo(originalRoot.outerHTML),
    localInfo = extractDefsInfo(element.outerHTML);
  const viewBox =
    element.getAttribute("data-original-viewbox") ||
    element.getAttribute("viewBox") ||
    root.getAttribute("viewBox") ||
    "0 0 24 24";
  const parsedViewBox = extractViewBoxInfo(`<svg viewBox="${viewBox}"></svg>`);
  if (
    !parsedViewBox ||
    !parsedViewBox.values.every(Number.isFinite) ||
    parsedViewBox.values[2] <= 0 ||
    parsedViewBox.values[3] <= 0
  )
    throw new Error("Invalid icon viewBox");
  const items: IconItem[] = [];
  const visit = (
    node: SVGElement,
    inherited: StyleAttributes,
    parent: Affine,
    opacity: number,
  ) => {
    if (["defs", "title", "desc", "metadata"].includes(node.localName)) return;
    if (["mask", "clip-path", "filter"].some((key) => node.hasAttribute(key)))
      throw new Error("SVG masks, clipping and filters are not supported");
    const attrs: StyleAttributes = { ...inherited };
    for (const key of paintKeys) {
      const value = node.style.getPropertyValue(key) || node.getAttribute(key);
      if (value !== null && value !== "") attrs[key] = value;
    }
    if ((node.style.display || node.getAttribute("display")) === "none") return;
    const localOpacity = node.style.opacity || node.getAttribute("opacity");
    const cumulativeOpacity =
      opacity *
      (localOpacity === null || localOpacity === "" ? 1 : Number(localOpacity));
    attrs.opacity = String(cumulativeOpacity);
    const matrix = multiply(
      parent,
      parseTransform(node.getAttribute("transform") || ""),
    );
    if (node.localName === "svg" && node !== element)
      throw new Error("Nested SVG viewports are not supported");
    if (["g", "svg", "a"].includes(node.localName)) {
      for (const child of Array.from(node.children))
        visit(child as SVGElement, attrs, matrix, cumulativeOpacity);
    } else {
      const d = geometry(node);
      if (d) {
        attrs["stroke-width"] = String(
          parseFloat(attrs["stroke-width"] || "1") *
            Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2])),
        );
        items.push({ path: transformCurve(d, matrix), attrs, style: {} });
      }
    }
  };
  const defaults: StyleAttributes = {
    fill: root.style.fill || root.getAttribute("fill") || "black",
    stroke: root.style.stroke || root.getAttribute("stroke") || "none",
    "stroke-width":
      root.style.strokeWidth || root.getAttribute("stroke-width") || "1",
  };
  for (const key of paintKeys) {
    const value = root.style.getPropertyValue(key) || root.getAttribute(key);
    if (value !== null && value !== "") defaults[key] = value;
  }
  visit(
    element,
    defaults,
    identity,
    element === root
      ? 1
      : Number(root.style.opacity || root.getAttribute("opacity") || 1),
  );
  if (!items.length)
    throw new Error(`Icon "${id}" contains no supported geometry`);
  return {
    id,
    items,
    viewBox: parsedViewBox,
    rootAttrs: extractSvgRootAttributes(root.outerHTML),
    defs: {
      gradients: { ...rootInfo.gradients, ...localInfo.gradients },
      patterns: { ...rootInfo.patterns, ...localInfo.patterns },
      others: { ...rootInfo.others, ...localInfo.others },
      raw: localInfo.raw || rootInfo.raw,
    },
  };
}
