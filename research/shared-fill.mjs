/** Research renderer: set intersection/difference via SVG luminance masks.
 * Opaque, same-color filled paths only. No geometric contour correspondence.
 */
import { findDifferenceComponents } from "./fill-components.mjs";
export function createSharedFillPlan(
  from,
  to,
  {
    prefix,
    bounds = [0, 0, 32, 32],
    direction = [-1, 1],
    fillRule = "nonzero",
  } = {},
) {
  if (!/^[a-zA-Z][\w-]*$/.test(prefix ?? ""))
    throw Error("A unique safe prefix is required");
  if (!["nonzero", "evenodd"].includes(fillRule))
    throw Error("Invalid fill rule");
  const paths = (values) => {
    if (
      !Array.isArray(values) ||
      values.length > 128 ||
      values.some(
        (d) =>
          typeof d !== "string" ||
          d.length > 50000 ||
          !/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\s-]*$/.test(d),
      )
    )
      throw Error("Expected plain SVG path data");
    return values
      .map((d) => `<path d="${d}" fill-rule="${fillRule}"/>`)
      .join("");
  };
  const a = paths(from),
    b = paths(to);
  if (
    bounds.length !== 4 ||
    !bounds.every(Number.isFinite) ||
    bounds[2] <= 0 ||
    bounds[3] <= 0 ||
    direction.length !== 2 ||
    !direction.every(Number.isFinite) ||
    !Math.hypot(...direction)
  )
    throw Error("Invalid projection");
  const [x, y, w, h] = bounds,
    length = Math.hypot(...direction),
    u = direction.map((v) => v / length),
    v = [-u[1], u[0]];
  const corners = [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h],
    ],
    dot = (p, q) => p[0] * q[0] + p[1] * q[1];
  const us = corners.map((p) => dot(p, u)),
    vs = corners.map((p) => dot(p, v));
  const low = Math.min(...us) - 1,
    high = Math.max(...us) + 1,
    left = Math.min(...vs) - 1,
    right = Math.max(...vs) + 1;
  const rect = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white"/>`;
  const mask = (id, body) =>
    `<mask id="${prefix}-${id}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}" style="mask-type:luminance">${body}</mask>`;
  const definitions =
    mask("intersection", `<g fill="white">${b}</g>`) +
    mask("not-target", rect + `<g fill="black">${b}</g>`) +
    mask("not-source", rect + `<g fill="black">${a}</g>`);
  const shared = `<g data-shared-fill mask="url(#${prefix}-intersection)">${a}</g>`;
  const pieces = findDifferenceComponents(from, to, {
    bounds,
    direction,
    fillRule,
  });
  const pieceDefs = pieces
    .map(
      (piece, i) =>
        `<clipPath id="${prefix}-piece-${i}" clipPathUnits="userSpaceOnUse"><path d="${piece.clip}"/></clipPath>`,
    )
    .join("");
  return {
    shared,
    pieces: pieces.map(({ anchor, pixels }) => ({
      anchor: [...anchor],
      pixels,
    })),
    frame(progress, { highlight = false, motion = "retract" } = {}) {
      if (!["retract", "fade"].includes(motion))
        throw Error("Invalid difference motion");
      if (!Number.isFinite(progress)) throw Error("Invalid progress");
      const p = Math.max(0, Math.min(1, progress));
      if (!highlight && (p === 0 || p === 1))
        return `<g fill="currentColor">${p === 0 ? a : b}</g>`;
      const end = low + (high - low) * p;
      const points = [
        [low, left],
        [end, left],
        [end, right],
        [low, right],
      ]
        .map(([s, t]) => `${u[0] * s + v[0] * t},${u[1] * s + v[1] * t}`)
        .join(" ");
      const retract = pieces
        .map((piece, i) => {
          const [ax, ay] = piece.anchor,
            s = 1 - p;
          return `<g data-retract-piece="${i}" data-anchor="${ax},${ay}" transform="matrix(${s} 0 0 ${s} ${ax * p} ${ay * p})"><g clip-path="url(#${prefix}-piece-${i})"><g mask="url(#${prefix}-not-target)">${a}</g></g></g>`;
        })
        .join("");
      const source =
        motion === "retract"
          ? `<g data-source-only fill="${highlight ? "#e29428" : "currentColor"}">${retract}</g>`
          : `<g data-source-only fill="${highlight ? "#e29428" : "currentColor"}" opacity="${1 - p}" mask="url(#${prefix}-not-target)">${a}</g>`;
      return `<defs>${definitions}${motion === "retract" ? pieceDefs : ""}<clipPath id="${prefix}-reveal" clipPathUnits="userSpaceOnUse"><polygon points="${points}"/></clipPath></defs><g fill="${highlight ? "#15956b" : "currentColor"}">${shared}</g>${source}<g data-target-only fill="${highlight ? "#3569ed" : "currentColor"}" mask="url(#${prefix}-not-source)" clip-path="url(#${prefix}-reveal)">${b}</g>`;
    },
  };
}
