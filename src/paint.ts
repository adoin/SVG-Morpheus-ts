import { namedColors } from "./named-colors";

export interface Color {
  r: number;
  g: number;
  b: number;
  opacity: number;
}
export interface GradientStop {
  offset: number;
  color: string;
  opacity?: number;
}
export interface Gradient {
  type: "linearGradient" | "radialGradient";
  attributes: Record<string, string>;
  stops: GradientStop[];
}
export type Paint = string | Gradient;
export interface OpacityGroup {
  id: string;
  opacity: number;
  blend?: "plus-lighter";
  isolate?: boolean;
}
export interface PaintStyle {
  attributes: Record<string, string>;
  fill?: Paint;
  stroke?: Paint;
  groups?: OpacityGroup[];
}
export interface PaintLayer {
  style: PaintStyle;
  weight: number;
}
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const number = (v: string, scale = 1) =>
  parseFloat(v) * (String(v).endsWith("%") ? scale / 100 : 1);
const decimal = (v: number) => String(+v.toFixed(6));

/** DOM-free CSS named/hex/RGB/HSL color parsing; unresolved contextual paints stay live. */
export function parseColor(value: string): Color | undefined {
  const s = value.trim().toLowerCase();
  if (s === "transparent") return { r: 0, g: 0, b: 0, opacity: 0 };
  const named = namedColors[s];
  if (named) return { r: named[0], g: named[1], b: named[2], opacity: 1 };
  if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(s)) {
    let h = s.slice(1);
    if (h.length < 5) h = [...h].map((c) => c + c).join("");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      opacity: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1,
    };
  }
  const match = /^(rgba?|hsla?)\((.*)\)$/.exec(s);
  if (!match) return;
  const v = match[2].split(/\s*[,/]\s*|\s+/).filter(Boolean);
  if (
    v.length < 3 ||
    v.length > 4 ||
    !v.every((x) => Number.isFinite(parseFloat(x)))
  )
    return;
  const opacity = clamp(v[3] === undefined ? 1 : number(v[3]));
  if (match[1].startsWith("rgb"))
    return {
      r: clamp(number(v[0], 255), 0, 255),
      g: clamp(number(v[1], 255), 0, 255),
      b: clamp(number(v[2], 255), 0, 255),
      opacity,
    };
  let hue = parseFloat(v[0]);
  if (v[0].endsWith("turn")) hue *= 360;
  else if (v[0].endsWith("grad")) hue *= 0.9;
  else if (v[0].endsWith("rad")) hue *= 180 / Math.PI;
  const h = (((hue % 360) + 360) % 360) / 60,
    sat = clamp(number(v[1])),
    l = clamp(number(v[2]));
  const c = (1 - Math.abs(2 * l - 1)) * sat,
    x = c * (1 - Math.abs((h % 2) - 1)),
    m = l - c / 2;
  const rgb = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][Math.floor(h)];
  return {
    r: (rgb[0] + m) * 255,
    g: (rgb[1] + m) * 255,
    b: (rgb[2] + m) * 255,
    opacity,
  };
}
export const colorString = (c: Color) =>
  `rgba(${Math.round(clamp(c.r, 0, 255))},${Math.round(clamp(c.g, 0, 255))},${Math.round(clamp(c.b, 0, 255))},${decimal(clamp(c.opacity))})`;
/** Premultiplied alpha prevents a transparent endpoint introducing a dark fringe. */
export function interpolateColor(
  from: string,
  to: string,
  progress: number,
): string {
  if (from === to) return from;
  let a = parseColor(from),
    b = parseColor(to);
  if (from === "none" && b) a = { ...b, opacity: 0 };
  if (to === "none" && a) b = { ...a, opacity: 0 };
  if (!a || !b) return progress < 0.5 ? from : to;
  const t = clamp(progress),
    opacity = lerp(a.opacity, b.opacity, t);
  const channel = (key: "r" | "g" | "b") =>
    opacity
      ? lerp(a![key] * a!.opacity, b![key] * b!.opacity, t) / opacity
      : lerp(a![key], b![key], t);
  return colorString({
    r: channel("r"),
    g: channel("g"),
    b: channel("b"),
    opacity,
  });
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
export const svgAttributes = (attrs: Record<string, string>) =>
  Object.entries(attrs)
    .map(([k, v]) => {
      if (!/^[a-zA-Z][\w:-]*$/.test(k) || /^on/i.test(k))
        throw new Error("Invalid SVG attribute");
      return `${k}="${escape(String(v))}"`;
    })
    .join(" ");
export function gradientMarkup(g: Gradient, id: string): string {
  return `<${g.type} id="${escape(id)}" ${svgAttributes(g.attributes)}>${g.stops.map((s) => `<stop offset="${decimal(s.offset)}" stop-color="${escape(s.color)}" stop-opacity="${decimal(s.opacity ?? 1)}"/>`).join("")}</${g.type}>`;
}
const sample = (g: Gradient, offset: number) => {
  const stops = g.stops;
  let i = 0;
  while (i < stops.length - 1 && stops[i + 1].offset <= offset) i++;
  const a = stops[i],
    b = stops[Math.min(i + 1, stops.length - 1)];
  const color = (s: GradientStop) => {
    const c = parseColor(s.color);
    return c
      ? colorString({ ...c, opacity: c.opacity * (s.opacity ?? 1) })
      : s.color;
  };
  return interpolateColor(
    color(a),
    color(b),
    b.offset === a.offset
      ? 0
      : clamp((offset - a.offset) / (b.offset - a.offset)),
  );
};
const gradientDefaults: Record<string, string> = {
  x1: "0%",
  y1: "0%",
  x2: "100%",
  y2: "0%",
  cx: "50%",
  cy: "50%",
  r: "50%",
  fr: "0%",
  gradientUnits: "objectBoundingBox",
  spreadMethod: "pad",
  gradientTransform: "matrix(1 0 0 1 0 0)",
};
function compatible(a: Paint, b: Paint): boolean {
  if (typeof a === "string" || typeof b === "string") {
    const s = typeof a === "string" ? a : (b as string);
    return !!parseColor(s) || s === "none" || a === b;
  }
  if (
    a.type !== b.type ||
    !["gradientUnits", "spreadMethod"].every(
      (k) =>
        (a.attributes[k] ?? gradientDefaults[k]) ===
        (b.attributes[k] ?? gradientDefaults[k]),
    )
  )
    return false;
  if (
    [...a.stops, ...b.stops].some((s) => !parseColor(s.color)) &&
    JSON.stringify(a.stops) !== JSON.stringify(b.stops)
  )
    return false;
  if (a.attributes.gradientUnits === "userSpaceOnUse") {
    for (const k of [
      "x1",
      "y1",
      "x2",
      "y2",
      "cx",
      "cy",
      "r",
      "fx",
      "fy",
      "fr",
    ]) {
      const x = a.attributes[k] ?? gradientDefaults[k],
        y = b.attributes[k] ?? gradientDefaults[k];
      if (x && y && x.endsWith("%") !== y.endsWith("%")) return false;
    }
  }
  return true;
}

/** Apply a flattened shape transform to a user-space gradient, leaving bbox gradients local. */
export function transformPaint(
  paint: Paint | undefined,
  matrix: readonly number[],
): Paint | undefined {
  if (
    !paint ||
    typeof paint === "string" ||
    paint.attributes.gradientUnits !== "userSpaceOnUse"
  )
    return paint;
  const m = /matrix\(([^)]+)\)/
    .exec(paint.attributes.gradientTransform ?? "matrix(1 0 0 1 0 0)")?.[1]
    .trim()
    .split(/[ ,]+/)
    .map(Number);
  if (!m || m.length !== 6)
    throw new Error("Normalize gradientTransform to a matrix");
  const [a, b, c, d, e, f] = matrix,
    [g, h, i, j, k, l] = m;
  return {
    ...paint,
    attributes: {
      ...paint.attributes,
      gradientTransform: `matrix(${[a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f].map(decimal).join(" ")})`,
    },
  };
}
function gradientMix(a: Paint, b: Paint, t: number): Paint {
  if (typeof a === "string" && typeof b === "string")
    return interpolateColor(a, b, t);
  const base = (typeof b === "object" ? b : a) as Gradient;
  const solid = (s: string): Gradient => ({
    ...base,
    stops: [
      { offset: 0, color: s === "none" ? "transparent" : s },
      { offset: 1, color: s === "none" ? "transparent" : s },
    ],
  });
  const ga = typeof a === "string" ? solid(a) : a,
    gb = typeof b === "string" ? solid(b) : b;
  const attrs: Record<string, string> = {};
  const keys =
    base.type === "linearGradient"
      ? ["x1", "y1", "x2", "y2"]
      : ["cx", "cy", "r", "fx", "fy", "fr"];
  for (const k of keys) {
    const fallbackKey = k === "fx" ? "cx" : k === "fy" ? "cy" : k;
    const x =
      ga.attributes[k] ??
      ga.attributes[fallbackKey] ??
      gradientDefaults[fallbackKey];
    const y =
      gb.attributes[k] ??
      gb.attributes[fallbackKey] ??
      gradientDefaults[fallbackKey];
    // SVG normalized bbox coordinates accept both fractions and percentages.
    if (
      (ga.attributes.gradientUnits ?? "objectBoundingBox") ===
      "objectBoundingBox"
    )
      attrs[k] = decimal(lerp(number(x), number(y), t));
    else if (x.endsWith("%") === y.endsWith("%"))
      attrs[k] =
        decimal(lerp(parseFloat(x), parseFloat(y), t)) +
        (x.endsWith("%") ? "%" : "");
    else throw new Error("Gradient coordinates need a common user-space unit");
  }
  for (const k of ["gradientUnits", "spreadMethod"])
    attrs[k] = gb.attributes[k] ?? ga.attributes[k] ?? gradientDefaults[k];
  const matrix = (g: Gradient) => {
    const m = /matrix\(([^)]+)\)/.exec(
      g.attributes.gradientTransform ?? gradientDefaults.gradientTransform,
    );
    if (!m) throw new Error("Normalize gradientTransform to a matrix");
    return m[1].trim().split(/[ ,]+/).map(Number);
  };
  const ma = matrix(ga),
    mb = matrix(gb);
  attrs.gradientTransform = `matrix(${ma.map((v, i) => decimal(lerp(v, mb[i], t))).join(" ")})`;
  // Retain duplicate stops, including hard edges, by interpolating both sides.
  const offsets = [
    ...new Set([...ga.stops, ...gb.stops].map((s) => s.offset)),
  ].sort((x, y) => x - y);
  const stops = offsets.flatMap((offset) => {
    const aa = ga.stops.filter((s) => s.offset === offset),
      bb = gb.stops.filter((s) => s.offset === offset);
    const count = Math.max(1, aa.length, bb.length);
    return Array.from({ length: count }, (_, i) => {
      const c = (g: Gradient, at: GradientStop[]) => {
        const s = at.length ? at[Math.min(i, at.length - 1)] : undefined;
        if (!s) return sample(g, offset);
        const parsed = parseColor(s.color);
        return parsed
          ? colorString({
              ...parsed,
              opacity: parsed.opacity * (s.opacity ?? 1),
            })
          : s.color;
      };
      return { offset, color: interpolateColor(c(ga, aa), c(gb, bb), t) };
    });
  });
  return { type: base.type, attributes: attrs, stops };
}

/** Shared pure paint interpolation, including gradient geometry/stops and opacity groups. */
export function createPaintPlan(
  from: readonly PaintStyle[],
  to: readonly PaintStyle[],
) {
  const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  const a = copy(from),
    b = copy(to);
  const topology = (styles: readonly PaintStyle[]) => {
    const groups = new Map<string, number[]>();
    styles.forEach((s, i) =>
      s.groups?.forEach((g) =>
        groups.set(g.id, [...(groups.get(g.id) ?? []), i]),
      ),
    );
    return groups;
  };
  const ag = topology(a),
    bg = topology(b);
  const groupKey = (id: string, ids: number[], styles: readonly PaintStyle[]) =>
    `${styles[ids[0]].groups!.findIndex((g) => g.id === id)}:${ids.join(",")}:${JSON.stringify(styles[ids[0]].groups!.find((g) => g.id === id)?.blend)}:${styles[ids[0]].groups!.find((g) => g.id === id)?.isolate ?? false}`;
  const sourceGroups = new Map(
    [...ag].map(([id, ids]) => [groupKey(id, ids, a), id]),
  );
  const blendGroups =
    [...bg].every(([id, ids]) => sourceGroups.has(groupKey(id, ids, b))) &&
    ag.size === bg.size;
  const crossfade =
    !blendGroups ||
    a.some((start, i) => {
      const end = b[i];
      return (
        end &&
        (!compatible(
          start.fill ?? start.attributes.fill ?? "black",
          end.fill ?? end.attributes.fill ?? "black",
        ) ||
          !compatible(
            start.stroke ?? start.attributes.stroke ?? "none",
            end.stroke ?? end.attributes.stroke ?? "none",
          ))
      );
    });
  return {
    frame(progress: number): PaintLayer[][] {
      if (!Number.isFinite(progress))
        throw new Error("Nonfinite paint progress");
      const t = clamp(progress);
      return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => {
        const start = a[i],
          end = b[i];
        if (!start || !end)
          return [{ style: copy(start ?? end), weight: start ? 1 - t : t }];
        if (t === 0) return [{ style: copy(start), weight: 1 }];
        if (t === 1) return [{ style: copy(end), weight: 1 }];
        const af = start.fill ?? start.attributes.fill ?? "black",
          bf = end.fill ?? end.attributes.fill ?? "black";
        const as = start.stroke ?? start.attributes.stroke ?? "none",
          bs = end.stroke ?? end.attributes.stroke ?? "none";
        if (crossfade)
          return [
            { style: copy(start), weight: 1 - t },
            { style: copy(end), weight: t },
          ];
        const attributes = { ...start.attributes, ...end.attributes };
        for (const k of [
          "opacity",
          "fill-opacity",
          "stroke-opacity",
          "stroke-width",
        ]) {
          const fallback = "1";
          const x = number(start.attributes[k] ?? fallback),
            y = number(end.attributes[k] ?? fallback);
          attributes[k] = decimal(
            k === "stroke-width"
              ? Math.max(0, lerp(x, y, t))
              : clamp(lerp(x, y, t)),
          );
        }
        for (const k of ["fill-rule", "stroke-linecap", "stroke-linejoin"])
          if (start.attributes[k] || end.attributes[k])
            attributes[k] =
              (t < 0.5 ? start.attributes[k] : end.attributes[k]) ??
              attributes[k];
        const groups = end.groups?.map((g) => {
          const id = sourceGroups.get(groupKey(g.id, bg.get(g.id)!, b));
          const old = a.flatMap((s) => s.groups ?? []).find((s) => s.id === id);
          return { ...g, opacity: lerp(old?.opacity ?? 1, g.opacity, t) };
        });
        return [
          {
            weight: 1,
            style: {
              attributes,
              fill: gradientMix(af, bf, t),
              stroke: gradientMix(as, bs, t),
              groups,
            },
          },
        ];
      });
    },
  };
}

/** Render compound paths without flattening opacity groups. Prefix must be instance-unique. */
export function renderPaintFrame(
  paths: readonly string[],
  frame: readonly PaintLayer[][],
  prefix: string,
): string {
  let defs = "";
  const layers: string[] = [];
  const count = Math.max(1, ...frame.map((f) => f.length));
  for (let layer = 0; layer < count; layer++) {
    let output = "",
      open: string[] = [];
    const entries = frame.map((f) => f[layer]).filter(Boolean);
    const commonWeight =
      entries.length && entries.every((e) => e.weight === entries[0].weight)
        ? entries[0].weight
        : 1;
    paths.forEach((d, i) => {
      const entry = frame[i]?.[layer];
      if (!entry || entry.weight <= 0) return;
      const { style, weight } = entry;
      const groups = (style.groups ?? []).map((g) => ({
        ...g,
        id: `${layer}-${g.id}`,
      }));
      let common = 0;
      while (
        common < open.length &&
        common < groups.length &&
        open[common] === groups[common].id
      )
        common++;
      output += "</g>".repeat(open.length - common);
      open = open.slice(0, common);
      for (const g of groups.slice(common)) {
        output += `<g opacity="${decimal(clamp(g.opacity))}"${g.blend || g.isolate ? ` style="${g.blend ? "mix-blend-mode:plus-lighter;" : ""}${g.isolate ? "isolation:isolate;" : ""}"` : ""}>`;
        open.push(g.id);
      }
      const attrs = { ...style.attributes };
      for (const key of ["fill", "stroke"] as const) {
        const paint = style[key] ?? attrs[key];
        if (typeof paint === "object") {
          const id = `${prefix}-${layer}-${i}-${key}`;
          defs += gradientMarkup(paint, id);
          attrs[key] = `url(#${id})`;
        } else if (paint !== undefined) attrs[key] = paint;
      }
      output += `<g opacity="${decimal(commonWeight === 1 ? weight : 1)}"><path data-morph-index="${i}" d="${escape(d)}" ${svgAttributes(attrs)}/></g>`;
    });
    layers.push(
      `<g opacity="${decimal(commonWeight)}"${count > 1 ? ' style="mix-blend-mode:plus-lighter"' : ""}>${output}${"</g>".repeat(open.length)}</g>`,
    );
  }
  return (
    (defs ? `<defs>${defs}</defs>` : "") +
    (count > 1
      ? `<g style="isolation:isolate">${layers.join("")}</g>`
      : layers.join(""))
  );
}
