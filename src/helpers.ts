// 定义包含浏览器前缀方法的接口
interface ExtendedWindow extends Window {
  mozRequestAnimationFrame?: typeof requestAnimationFrame;
  webkitRequestAnimationFrame?: typeof requestAnimationFrame;
  oRequestAnimationFrame?: typeof requestAnimationFrame;
  mozCancelAnimationFrame?: typeof cancelAnimationFrame;
  webkitCancelAnimationFrame?: typeof cancelAnimationFrame;
  oCancelAnimationFrame?: typeof cancelAnimationFrame;
}

// Resolve browser APIs lazily so importing geometry helpers is SSR-safe.
export const reqAnimFrame = (callback: FrameRequestCallback): number => {
  if (typeof window === 'undefined') throw new Error('SVGMorpheus animation requires a browser');
  const host = window as ExtendedWindow;
  const request = host.requestAnimationFrame || host.mozRequestAnimationFrame || host.webkitRequestAnimationFrame || host.oRequestAnimationFrame;
  return request ? request.call(host, callback) : host.setTimeout(() => callback(host.performance.now()), 16);
};
export const cancelAnimFrame = (id: number): void => {
  if (typeof window === 'undefined') return;
  const host = window as ExtendedWindow;
  const cancel = host.cancelAnimationFrame || host.mozCancelAnimationFrame || host.webkitCancelAnimationFrame || host.oCancelAnimationFrame;
  if (cancel) cancel.call(host, id);
  else host.clearTimeout(id);
};

import { NormalizedStyle, RGBColor, StyleAttributes, Transform, CurveData } from './types';

// Calculate style
export function styleNormCalc(styleNormFrom: NormalizedStyle, styleNormTo: NormalizedStyle, progress: number): NormalizedStyle {
  const styleNorm: NormalizedStyle = {};
  
  for (const key in styleNormFrom) {
    const i = key as keyof NormalizedStyle;
    switch (i) {
      case 'fill':
      case 'stroke':
        if (styleNormFrom[i] && styleNormTo[i]) {
          const fromValue = styleNormFrom[i];
          const toValue = styleNormTo[i];
          
          // 检测是否为渐变引用（字符串值）
          if (typeof fromValue === 'string' || typeof toValue === 'string') {
            // 对于渐变引用，根据进度选择源值或目标值
            // 在动画中期（progress < 0.5）使用源值，后期使用目标值
            (styleNorm[i] as any) = progress < 0.5 ? fromValue : toValue;
          } else {
            // 对于RGB颜色值，进行正常插值
            const fromColor = fromValue as RGBColor;
            const toColor = toValue as RGBColor;
            styleNorm[i] = clone(fromColor);
            (styleNorm[i] as RGBColor).r = fromColor.r + (toColor.r - fromColor.r) * progress;
            (styleNorm[i] as RGBColor).g = fromColor.g + (toColor.g - fromColor.g) * progress;
            (styleNorm[i] as RGBColor).b = fromColor.b + (toColor.b - fromColor.b) * progress;
            (styleNorm[i] as RGBColor).opacity = fromColor.opacity + (toColor.opacity - fromColor.opacity) * progress;
          }
        }
        break;
      case 'fill-rule':
      case 'stroke-linecap':
      case 'stroke-linejoin':
        (styleNorm[i] as string | undefined) = progress < 0.5 ? styleNormFrom[i] : styleNormTo[i];
        break;
      case 'opacity':
      case 'fill-opacity':
      case 'stroke-opacity':
      case 'stroke-width':
        if (typeof styleNormFrom[i] === 'number' && typeof styleNormTo[i] === 'number') {
          (styleNorm[i] as number) = styleNormFrom[i] as number + ((styleNormTo[i] as number) - (styleNormFrom[i] as number)) * progress;
        }
        break;
    }
  }
  return styleNorm;
}

export function styleNormToString(styleNorm: NormalizedStyle): StyleAttributes {
  const style: StyleAttributes = {};
  
  for (const key in styleNorm) {
    const i = key as keyof NormalizedStyle;
    switch (i) {
      case 'fill':
      case 'stroke':
        if (styleNorm[i]) {
          const value = styleNorm[i];
          if (typeof value === 'string') {
            // 对于渐变引用，直接使用字符串值
            style[i] = value;
          } else {
            // 对于RGB对象，转换为颜色字符串
            style[i] = rgbToString(value as RGBColor);
          }
        }
        break;
      case 'fill-rule':
      case 'stroke-linecap':
      case 'stroke-linejoin':
        if (styleNorm[i] !== undefined) style[i] = styleNorm[i];
        break;
      case 'opacity':
      case 'fill-opacity':
      case 'stroke-opacity':
      case 'stroke-width':
        if (typeof styleNorm[i] === 'number') {
          (style[i] as any) = styleNorm[i];
        }
        break;
    }
  }
  return style;
}

export function styleToNorm(styleFrom: StyleAttributes, styleTo: StyleAttributes): [NormalizedStyle, NormalizedStyle] {
  const styleNorm: [NormalizedStyle, NormalizedStyle] = [{}, {}];
  
  // 检测是否为渐变引用
  const isGradientReference = (value: string): boolean => {
    return /^(?:url\(|var\(|currentcolor$|none$|inherit$|context-fill$|context-stroke$)/i.test(value.trim());
  };
  
  for (const key in styleFrom) {
    const i = key as keyof StyleAttributes;
    switch(i) {
      case 'fill':
      case 'stroke':
        if (styleFrom[i]) {
          if (isGradientReference(styleFrom[i]!)) {
            // Keep contextual paints live.
            (styleNorm[0][i] as any) = styleFrom[i];
            if (styleTo[i] === undefined) {
              (styleNorm[1][i] as any) = styleFrom[i];
            }
          } else {
            // 对于普通颜色值，进行RGB转换
            styleNorm[0][i] = getRGB(styleFrom[i]!);
            if (styleTo[i] === undefined) {
              styleNorm[1][i] = getRGB(styleFrom[i]!);
              (styleNorm[1][i] as RGBColor).opacity = 0;
            }
          }
        }
        break;
      case 'opacity':
      case 'fill-opacity':
      case 'stroke-opacity':
      case 'stroke-width':
        if (styleFrom[i]) {
          (styleNorm[0][i] as any) = parseFloat(styleFrom[i]!);
          if (styleTo[i] === undefined) {
            (styleNorm[1][i] as any) = 1;
          }
        }
        break;
    }
  }
  
  for (const key in styleTo) {
    const i = key as keyof StyleAttributes;
    switch(i) {
      case 'fill':
      case 'stroke':
        if (styleTo[i]) {
          if (isGradientReference(styleTo[i]!)) {
            // Keep contextual paints live.
            (styleNorm[1][i] as any) = styleTo[i];
            if (styleFrom[i] === undefined) {
              (styleNorm[0][i] as any) = styleTo[i];
            }
          } else {
            // 对于普通颜色值，进行RGB转换
            styleNorm[1][i] = getRGB(styleTo[i]!);
            if (styleFrom[i] === undefined) {
              styleNorm[0][i] = getRGB(styleTo[i]!);
              (styleNorm[0][i] as RGBColor).opacity = 0;
            }
          }
        }
        break;
      case 'opacity':
      case 'fill-opacity':
      case 'stroke-opacity':
      case 'stroke-width':
        if (styleTo[i]) {
          (styleNorm[1][i] as any) = parseFloat(styleTo[i]!);
          if (styleFrom[i] === undefined) {
            (styleNorm[0][i] as any) = 1;
          }
        }
        break;
    }
  }
  for (const key of ['fill-rule','stroke-linecap','stroke-linejoin'] as const) {
    if(styleFrom[key]!==undefined||styleTo[key]!==undefined) {
      styleNorm[0][key]=styleFrom[key]??styleTo[key];
      styleNorm[1][key]=styleTo[key]??styleFrom[key];
    }
  }
  return styleNorm;
}

// Calculate transform progress
export function transCalc(transFrom: Transform, transTo: Transform, progress: number): Transform {
  const res: Transform = {};
  for (const key in transFrom) {
    const i = key as keyof Transform;
    switch(i) {
      case 'rotate':
        if (transFrom[i] && transTo[i]) {
          res[i] = [0, 0, 0];
          for (let j = 0; j < 3; j++) {
            const fromVal = transFrom[i]![j];
            const toVal = transTo[i]![j];
            if (isFinite(fromVal) && isFinite(toVal) && isFinite(progress)) {
              res[i]![j] = fromVal + (toVal - fromVal) * progress;
            } else {
              // 如果任何值无效，使用 from 值或默认值
              res[i]![j] = isFinite(fromVal) ? fromVal : 0;
            }
          }
        }
        break;
    }
  }
  return res;
}

export function trans2string(trans: Transform): string {
  let res = '';
  if (trans.rotate && trans.rotate.length === 3) {
    // 检查所有值是否为有效数字
    const [angle, centerX, centerY] = trans.rotate;
    if (isFinite(angle) && isFinite(centerX) && isFinite(centerY)) {
      res += 'rotate(' + trans.rotate.join(' ') + ')';
    } else {
      // 如果有无效值，使用默认的变换
      res += 'rotate(0 0 0)';
    }
  }
  return res;
}

// Calculate curve progress
export function curveCalc(curveFrom: CurveData, curveTo: CurveData, progress: number): CurveData {
  const curve: CurveData = [];
  for (let i = 0, len1 = curveFrom.length; i < len1; i++) {
    curve.push([curveFrom[i][0]]);
    
    // 检查 curveTo[i] 是否存在
    if (!curveTo[i]) {
      // 如果 curveTo[i] 不存在，使用 curveFrom[i] 的值
      for (let j = 1, len2 = curveFrom[i].length; j < len2; j++) {
        curve[i].push(curveFrom[i][j] as number);
      }
      continue;
    }
    
    for (let j = 1, len2 = curveFrom[i].length; j < len2; j++) {
      const fromVal = curveFrom[i][j] as number;
      
      // 检查 curveTo[i][j] 是否存在
      const toVal = (curveTo[i] && curveTo[i][j] !== undefined) ? 
        curveTo[i][j] as number : 
        fromVal; // 如果不存在，使用 fromVal 作为默认值
        
      curve[i].push(fromVal + (toVal - fromVal) * progress);
    }
  }
  return curve;
}

export function clone<T>(obj: T): T {
  let copy: any;

  // Handle Array
  if (obj instanceof Array) {
    copy = [];
    for (let i = 0, len = obj.length; i < len; i++) {
      copy[i] = clone(obj[i]);
    }
    return copy;
  }

  // Handle Object
  if (obj instanceof Object) {
    copy = {};
    for (const attr in obj) {
      if (obj.hasOwnProperty(attr)) {
        (copy as any)[attr] = clone((obj as any)[attr]);
      }
    }
    return copy;
  }

  return obj;
}

// Helper functions for color conversion - from snapsvglite.js
const spaces = "\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029";
const hsrg = {hs: 1, rg: 1};
const has = "hasOwnProperty";
const colourRegExp = /^\s*((#[a-f\d]{6})|(#[a-f\d]{3})|rgba?\(\s*([\d\.]+%?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+%?(?:\s*,\s*[\d\.]+%?)?)\s*\)|hsba?\(\s*([\d\.]+(?:deg|\xb0|%)?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+(?:%?\s*,\s*[\d\.]+)?%?)\s*\)|hsla?\(\s*([\d\.]+(?:deg|\xb0|%)?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+(?:%?\s*,\s*[\d\.]+)?%?)\s*\))\s*$/i;
const commaSpaces = new RegExp("[" + spaces + "]*,[" + spaces + "]*");

// Converts RGB values to a hex representation of the color
const rgbToString = function (rgb: RGBColor): string {
  const round = Math.round;
  return "rgba(" + [round(rgb.r), round(rgb.g), round(rgb.b), +rgb.opacity.toFixed(2)] + ")";
};

const toHex = function (color: string): string | null {
  if (typeof document === 'undefined') return null;
  const probe = document.createElement('span');
  probe.style.color = color;
  if (!probe.style.color) return null;
  probe.style.display = 'none';
  (document.body || document.documentElement).appendChild(probe);
  try { return document.defaultView?.getComputedStyle(probe).color || null; }
  finally { probe.remove(); }
};

const packageRGB = function (r: number, g: number, b: number, o: number): RGBColor {
  const red = Math.round(r * 255);
  const green = Math.round(g * 255);
  const blue = Math.round(b * 255);
  return {
    r: red,
    g: green,
    b: blue,
    opacity: isFinite(o) ? o : 1
  };
};

interface HSBColor {
  h: number;
  s: number;
  b: number;
  o?: number;
}

interface HSLColor {
  h: number;
  s: number;
  l: number;
  o?: number;
}

// Converts HSB values to an RGB object
const hsb2rgb = function (h: number | HSBColor, s?: number, v?: number, o?: number): RGBColor {
  if (typeof h === 'object' && "h" in h && "s" in h && "b" in h) {
    v = h.b;
    s = h.s;
    o = h.o;
    h = h.h;
  }
  
  const hue = (h as number) * 360;
  let R: number, G: number, B: number, X: number, C: number;
  const normalizedHue = (hue % 360) / 60;
  C = (v as number) * (s as number);
  X = C * (1 - Math.abs(normalizedHue % 2 - 1));
  R = G = B = (v as number) - C;

  const hueIndex = ~~normalizedHue;
  R += [C, X, 0, 0, X, C][hueIndex];
  G += [X, C, C, X, 0, 0][hueIndex];
  B += [0, 0, X, C, C, X][hueIndex];
  return packageRGB(R, G, B, o as number);
};

// Converts HSL values to an RGB object
const hsl2rgb = function (h: number | HSLColor, s?: number, l?: number, o?: number): RGBColor {
  if (typeof h === 'object' && "h" in h && "s" in h && "l" in h) {
    l = h.l;
    s = h.s;
    o = h.o;
    h = h.h;
  }
  
  let hue = h as number;
  let saturation = s as number;
  let lightness = l as number;
  
  if (hue > 1 || saturation > 1 || lightness > 1) {
    hue /= 360;
    saturation /= 100;
    lightness /= 100;
  }
  
  hue *= 360;
  let R: number, G: number, B: number, X: number, C: number;
  const normalizedHue = (hue % 360) / 60;
  C = 2 * saturation * (lightness < 0.5 ? lightness : 1 - lightness);
  X = C * (1 - Math.abs(normalizedHue % 2 - 1));
  R = G = B = lightness - C / 2;

  const hueIndex = ~~normalizedHue;
  R += [C, X, 0, 0, X, C][hueIndex];
  G += [X, C, C, X, 0, 0][hueIndex];
  B += [0, 0, X, C, C, X][hueIndex];
  return packageRGB(R, G, B, o as number);
};

interface RGBColorWithError extends RGBColor {
  error?: number;
}

// Parses color string as RGB object
const getRGB = function (colour: string): RGBColorWithError {
  if (!colour || !!((colour = String(colour)).indexOf("-") + 1)) {
    return {r: -1, g: -1, b: -1, opacity: -1, error: 1};
  }
  if (colour === "none") {
    return {r: -1, g: -1, b: -1, opacity: -1};
  }
  
  if (!((hsrg as any)[(has as any)](colour.toLowerCase().substring(0, 2)) || colour.charAt(0) === "#")) {
    const hexColor = toHex(colour);
    colour = hexColor || '';
  }
  
  if (!colour) {
    return {r: -1, g: -1, b: -1, opacity: -1, error: 1};
  }
  
  let red: number = 0;
  let green: number = 0;
  let blue: number = 0;
  let opacity: number = 1;
  let t: string;
  let values: string[];
  const rgb = colour.match(colourRegExp);
  
  if (rgb) {
    if (rgb[2]) {
      blue = parseInt(rgb[2].substring(5), 16);
      green = parseInt(rgb[2].substring(3, 5), 16);
      red = parseInt(rgb[2].substring(1, 3), 16);
    }
    if (rgb[3]) {
      blue = parseInt((t = rgb[3].charAt(3)) + t, 16);
      green = parseInt((t = rgb[3].charAt(2)) + t, 16);
      red = parseInt((t = rgb[3].charAt(1)) + t, 16);
    }
    if (rgb[4]) {
      values = rgb[4].split(commaSpaces);
      red = parseFloat(values[0]);
      values[0].slice(-1) === "%" && (red *= 2.55);
      green = parseFloat(values[1]);
      values[1].slice(-1) === "%" && (green *= 2.55);
      blue = parseFloat(values[2]);
      values[2].slice(-1) === "%" && (blue *= 2.55);
      if (rgb[1].toLowerCase().slice(0, 4) === "rgba") {
        opacity = parseFloat(values[3]);
      }
      if (values[3] && values[3].slice(-1) === "%") {
        opacity /= 100;
      }
    }
    if (rgb[5]) {
      values = rgb[5].split(commaSpaces);
      red = parseFloat(values[0]);
      values[0].slice(-1) === "%" && (red /= 100);
      green = parseFloat(values[1]);
      values[1].slice(-1) === "%" && (green /= 100);
      blue = parseFloat(values[2]);
      values[2].slice(-1) === "%" && (blue /= 100);
      (values[0].slice(-3) === "deg" || values[0].slice(-1) === "\xb0") && (red /= 360);
      if (rgb[1].toLowerCase().slice(0, 4) === "hsba") {
        opacity = parseFloat(values[3]);
      }
      if (values[3] && values[3].slice(-1) === "%") {
        opacity /= 100;
      }
      return hsb2rgb(red, green, blue, opacity);
    }
    if (rgb[6]) {
      values = rgb[6].split(commaSpaces);
      red = parseFloat(values[0]);
      values[0].slice(-1) === "%" && (red /= 100);
      green = parseFloat(values[1]);
      values[1].slice(-1) === "%" && (green /= 100);
      blue = parseFloat(values[2]);
      values[2].slice(-1) === "%" && (blue /= 100);
      (values[0].slice(-3) === "deg" || values[0].slice(-1) === "\xb0") && (red /= 360);
      if (rgb[1].toLowerCase().slice(0, 4) === "hsla") {
        opacity = parseFloat(values[3]);
      }
      if (values[3] && values[3].slice(-1) === "%") {
        opacity /= 100;
      }
      return hsl2rgb(red, green, blue, opacity);
    }
    
    red = Math.min(Math.round(red), 255);
    green = Math.min(Math.round(green), 255);
    blue = Math.min(Math.round(blue), 255);
    opacity = Math.min(Math.max(opacity, 0), 1);
    
    const result: RGBColorWithError = {r: red, g: green, b: blue, opacity: isFinite(opacity) ? opacity : 1};
    return result;
  }
  return {r: -1, g: -1, b: -1, opacity: -1, error: 1};
};

/**
 * 内部函数：动态合并多个 SVG 为类似 iconset.svg 的格式字符串
 * @param svgMap 对象，key 为 g 标签的 id，value 为 svg 路径或 svg 代码
 * @param svgAttributes 可选，生成的 SVG 根元素的属性集合
 * @returns Promise<string> 合并后的 SVG 字符串
 */
async function createBundledSvgString(
  svgMap: Record<string, string>, 
  svgAttributes?: Record<string, string | number>
): Promise<string> {
  const svgGroups: string[] = [];
  
  for (const [id, svgSource] of Object.entries(svgMap)) {
    let svgContent: string;
    
    // 判断是 SVG 代码还是路径
    if (isSvgContent(svgSource)) {
      // 直接是 SVG 代码
      svgContent = svgSource;
    } else {
      // 是路径，需要加载
      try {
        const response = await fetch(svgSource);
        if (!response.ok) {
          console.warn(`Failed to load SVG from ${svgSource}`);
          continue;
        }
        svgContent = await response.text();
      } catch (error) {
        console.warn(`Error loading SVG from ${svgSource}:`, error);
        continue;
      }
    }
    
    // 提取原始SVG的ViewBox信息
    const originalViewBox = extractViewBoxInfo(svgContent);
    const originalDefs = extractDefsInfo(svgContent);
    // 新增：提取SVG根属性（包括fill）
    const rootAttributes = extractSvgRootAttributes(svgContent);
    const svgRootFill = rootAttributes['fill'];
    
    // 提取 SVG 内容（去除外层 svg 标签）
    let innerContent = extractSvgInnerContent(svgContent);

    // 新增：如果svg标签有fill，处理所有可填充元素
    if (svgRootFill) {
      // 需要处理的标签列表
      const fillTags = [
        'path', 'polygon', 'rect', 'circle', 'ellipse', 'line', 'polyline'
      ];
      fillTags.forEach(tag => {
        const tagReg = new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi');
        innerContent = innerContent.replace(tagReg, (match) => {
          // 如果已有fill属性，保持原样
          if (/fill\s*=\s*['"][^'"]*['"]/i.test(match)) {
            return match;
          }
          // 没有fill属性，补上fill
          if (match.endsWith('/>')) {
            return match.replace(new RegExp(`<${tag}(\\s*)`), `<${tag}$1 fill=\"${svgRootFill}\" `);
          } else {
            return match.replace(new RegExp(`<${tag}(\\s*)`), `<${tag}$1 fill=\"${svgRootFill}\" `);
          }
        });
      });
    }
    
    // 构建g标签的属性，保留ViewBox和其他重要信息
    let groupAttributes = `id="${id}"`;
    if (originalViewBox) {
      groupAttributes += ` data-original-viewbox="${originalViewBox.original}"`;
    }
    if (Object.keys(originalDefs.gradients).length > 0 || Object.keys(originalDefs.patterns).length > 0) {
      groupAttributes += ` data-has-defs="true"`;
    }
    
    // 用 g 标签包裹，设置 id 和保留的属性
    const groupContent = `<g ${groupAttributes}>${innerContent}</g>`;
    svgGroups.push(groupContent);
  }
  
  // 构建 SVG 属性字符串
  const defaultAttributes = {
    xmlns: 'http://www.w3.org/2000/svg',
    style: 'display:none;'
  };
  
  // 合并默认属性和用户自定义属性
  const finalAttributes = { ...defaultAttributes, ...svgAttributes };
  
  // 将属性对象转换为字符串
  const attributesString = Object.entries(finalAttributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
  
  // 合并所有 g 标签到一个 SVG 容器中
  const bundledSvg = `<svg ${attributesString}>
${svgGroups.join('\n')}
</svg>`;
  
  return bundledSvg;
}

/**
 * 动态合并多个 SVG 为类似 iconset.svg 的格式，并返回 Blob URL
 * @param svgMap 对象，key 为 g 标签的 id，value 为 svg 路径或 svg 代码
 * @param svgAttributes 可选，生成的 SVG 根元素的属性集合
 * @returns Promise<string> 生成的 Blob URL
 */
export async function bundleSvgs(
  svgMap: Record<string, string>, 
  svgAttributes?: Record<string, string | number>
): Promise<string> {
  const bundledSvg = await createBundledSvgString(svgMap, svgAttributes);
  
  // 创建 Blob 和 URL
  const blob = new Blob([bundledSvg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  
  return url;
}

/**
 * 动态合并多个 SVG 为类似 iconset.svg 的格式，并返回 SVG 字符串（用于需要直接操作 SVG 内容的场景）
 * @param svgMap 对象，key 为 g 标签的 id，value 为 svg 路径或 svg 代码
 * @param svgAttributes 可选，生成的 SVG 根元素的属性集合
 * @returns Promise<string> 合并后的 SVG 字符串
 */
export async function bundleSvgsString(
  svgMap: Record<string, string>, 
  svgAttributes?: Record<string, string | number>
): Promise<string> {
  return createBundledSvgString(svgMap, svgAttributes);
}

/**
 * 判断字符串是否为 SVG 内容
 * @param content 待检查的字符串
 * @returns 是否为 SVG 内容
 */
function isSvgContent(content: string): boolean {
  const trimmedContent = content.trim();
  
  // 检查是否以 XML 声明开头
  if (trimmedContent.startsWith('<?xml')) {
    return trimmedContent.includes('<svg');
  }
  
  // 检查是否直接以 <svg 开头
  if (trimmedContent.startsWith('<svg')) {
    return true;
  }
  
  // 检查是否以 DOCTYPE 开头（某些 SVG 可能只有 DOCTYPE 而没有 XML 声明）
  if (trimmedContent.startsWith('<!DOCTYPE svg')) {
    return true;
  }
  
  return false;
}

/**
 * 提取 SVG 标签内的内容
 * @param svgContent SVG 字符串
 * @returns 内部内容
 */
function extractSvgInnerContent(svgContent: string): string {
  // 移除多余的空白字符
  let cleanContent = svgContent.trim();
  
  // 移除 XML 声明（<?xml ... ?>）
  cleanContent = cleanContent.replace(/<\?xml[^?]*\?>\s*/gi, '');
  
  // 移除 DOCTYPE 声明
  cleanContent = cleanContent.replace(/<!DOCTYPE[^>]*>\s*/gi, '');
  
  // 移除其他可能的处理指令
  cleanContent = cleanContent.replace(/<\?[^?]*\?>\s*/gi, '');
  
  // 重新移除可能产生的多余空白
  cleanContent = cleanContent.trim();
  
  // 使用正则表达式匹配 svg 开始和结束标签
  const svgMatch = cleanContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  
  if (svgMatch && svgMatch[1]) {
    return svgMatch[1].trim();
  }
  
  // 如果没有匹配到 svg 标签，可能内容本身就不是完整的 svg
  // 尝试检查是否以 svg 标签开头
  if (cleanContent.startsWith('<svg')) {
    // 找到第一个 > 后的内容
    const firstTagEnd = cleanContent.indexOf('>');
    if (firstTagEnd !== -1) {
      const withoutOpenTag = cleanContent.substring(firstTagEnd + 1);
      // 移除最后的 </svg>
      const lastSvgTag = withoutOpenTag.lastIndexOf('</svg>');
      if (lastSvgTag !== -1) {
        return withoutOpenTag.substring(0, lastSvgTag).trim();
      }
    }
  }
  
  // 如果都不匹配，返回原内容（可能已经是内部内容）
  return cleanContent;
}

/**
 * 提取SVG的ViewBox信息
 * @param svgContent SVG字符串
 * @returns ViewBox信息
 */
export function extractViewBoxInfo(svgContent: string) {
  const svgMatch = svgContent.match(/<svg[^>]*>/i);
  if (!svgMatch) return null;
  
  const svgTag = svgMatch[0];
  const viewBoxMatch = svgTag.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  
  if (!viewBoxMatch) return null;
  
  const viewBoxStr = viewBoxMatch[1];
  const values = viewBoxStr.trim().split(/\s+/).map(Number);
  
  if (values.length !== 4) return null;
  
  return {
    values: [values[0], values[1], values[2], values[3]] as [number, number, number, number],
    original: viewBoxStr
  };
}

/**
 * 提取SVG的defs信息
 * @param svgContent SVG字符串
 * @returns defs信息
 */
export function extractDefsInfo(svgContent: string) {
  const defsInfo = {
    gradients: {} as Record<string, string>,
    patterns: {} as Record<string, string>,
    others: {} as Record<string, string>,
    raw: undefined as string | undefined
  };
  
  // 提取整个defs块
  const defsMatch = svgContent.match(/<defs[^>]*>([\s\S]*?)<\/defs>/i);
  if (!defsMatch) return defsInfo;
  
  defsInfo.raw = defsMatch[0];
  const defsContent = defsMatch[1];
  
  // 提取线性渐变
  const linearGradients = defsContent.match(/<linearGradient[^>]*>[\s\S]*?<\/linearGradient>/gi);
  if (linearGradients) {
    linearGradients.forEach(gradient => {
      const idMatch = gradient.match(/id\s*=\s*["']([^"']+)["']/i);
      if (idMatch) {
        defsInfo.gradients[idMatch[1]] = gradient;
      }
    });
  }
  
  // 提取径向渐变
  const radialGradients = defsContent.match(/<radialGradient[^>]*>[\s\S]*?<\/radialGradient>/gi);
  if (radialGradients) {
    radialGradients.forEach(gradient => {
      const idMatch = gradient.match(/id\s*=\s*["']([^"']+)["']/i);
      if (idMatch) {
        defsInfo.gradients[idMatch[1]] = gradient;
      }
    });
  }
  
  // 提取图案
  const patterns = defsContent.match(/<pattern[^>]*>[\s\S]*?<\/pattern>/gi);
  if (patterns) {
    patterns.forEach(pattern => {
      const idMatch = pattern.match(/id\s*=\s*["']([^"']+)["']/i);
      if (idMatch) {
        defsInfo.patterns[idMatch[1]] = pattern;
      }
    });
  }
  
  // 提取其他定义（滤镜、遮罩等）
  const others = defsContent.match(/<(?!linearGradient|radialGradient|pattern)[^>]+>[\s\S]*?<\/[^>]+>/gi);
  if (others) {
    others.forEach(other => {
      const idMatch = other.match(/id\s*=\s*["']([^"']+)["']/i);
      if (idMatch) {
        defsInfo.others[idMatch[1]] = other;
      }
    });
  }
  
  return defsInfo;
}

/**
 * 提取SVG根元素的属性
 * @param svgContent SVG字符串
 * @returns 属性对象
 */
export function extractSvgRootAttributes(svgContent: string) {
  const svgMatch = svgContent.match(/<svg([^>]*)>/i);
  if (!svgMatch) return {};
  
  const attributes: Record<string, string> = {};
  const attrStr = svgMatch[1];
  
  // 简单的属性解析（可以用更复杂的解析器）
  const attrMatches = attrStr.match(/(\w+)\s*=\s*["']([^"']*)["']/g);
  if (attrMatches) {
    attrMatches.forEach(attr => {
      const [, name, value] = attr.match(/(\w+)\s*=\s*["']([^"']*)["']/) || [];
      if (name && value) {
        attributes[name] = value;
      }
    });
  }
  
  return attributes;
} 