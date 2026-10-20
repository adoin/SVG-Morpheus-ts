import { curveCalc, path2curve, path2string, easings } from "../dist/core.js";
import type { CurveData, BoundingBox } from "../dist/core.js";
const shape: CurveData = [
  ["M", 0, 0],
  ["C", 0, 0, 1, 1, 1, 1],
];
const box: BoundingBox = { x: 0, y: 0, w: 1, h: 1, cx: 0.5, cy: 0.5 };
const d: string = path2string(
  curveCalc(shape, path2curve("M0 0L2 2"), easings.linear(box.cx)),
);
void d;

import { createMorphPlan, springProgress } from "../dist/core.js";
import type { MorphPlan, MorphPath } from "../dist/core.js";
const inputs: MorphPath[] = [{ d: shape, allowReverse: false }];
const plan: MorphPlan = createMorphPlan(inputs, inputs);
const frame: string[] = plan.frame(springProgress(0.5));
void frame;
import { createPaintPlan, renderPaintFrame, parseColor } from "../dist/core.js";
import type { PaintStyle, Gradient } from "../dist/core.js";
const gradient: Gradient = {
  type: "linearGradient",
  attributes: {},
  stops: [
    { offset: 0, color: "red" },
    { offset: 1, color: "blue" },
  ],
};
const paint: PaintStyle = { attributes: {}, fill: gradient };
const markup: string = renderPaintFrame(
  ["M0 0L1 1"],
  createPaintPlan([paint], [paint]).frame(0.5),
  "node",
);
void markup;
void parseColor("#ff000080");
