export type EasingFunction = (t: number) => number;
export type CurveSegment = (string | number)[];
export type CurveData = CurveSegment[];
export interface BoundingBox {
  /** X coordinate | X 坐标 */
  x: number;
  /** Y coordinate | Y 坐标 */
  y: number;
  /** Width | 宽度 */
  w: number;
  /** Height | 高度 */
  h: number;
  /** Center X coordinate | 中心 X 坐标 */
  cx: number;
  /** Center Y coordinate | 中心 Y 坐标 */
  cy: number;
}
