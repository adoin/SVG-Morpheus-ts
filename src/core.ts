/** DOM-free runtime and types for Node/SSR geometry consumers. */
import { curveCalc as interpolate, clone as copy } from "./helpers.js";
import { easings as presets } from "./easings.js";
import type { CurveData, EasingFunction } from "./core-types.js";
export {
  parsePathString,
  pathToAbsolute,
  path2curve,
  path2string,
  curvePathBBox,
} from "./svg-path.js";
export const curveCalc: (
  from: CurveData,
  to: CurveData,
  progress: number,
) => CurveData = interpolate;
export const clone: <T>(value: T) => T = copy;
export const easings: Record<string, EasingFunction> = presets;
export type {
  CurveData,
  CurveSegment,
  EasingFunction,
  BoundingBox,
} from "./core-types.js";

export { createMorphPlan, springProgress } from "./morph-plan.js";
export type { MorphPath, MorphPair, MorphPlan } from "./morph-plan.js";
