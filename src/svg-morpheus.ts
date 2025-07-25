import { 
  styleNormCalc, 
  styleNormToString, 
  styleToNorm, 
  transCalc, 
  trans2string, 
  curveCalc, 
  clone,
  reqAnimFrame,
  cancelAnimFrame,
  extractViewBoxInfo,
  extractDefsInfo,
  extractSvgRootAttributes
} from './helpers';

import { easings } from './easings';
import { path2curve, path2string, curvePathBBox } from './svg-path';
import { 
  calculateTransformMatrix,
  transformPath,
  transformGradientDefs,
  updateDefsReferences
} from './coordinate-transform';
import { 
  Icon, 
  IconItem, 
  MorphNode, 
  SVGMorpheusOptions, 
  ToMethodOptions, 
  CallbackFunction, 
  AnimationFrameId, 
  BoundingBox,
  StyleAttributes,
  ViewBoxInfo,
  DefsInfo
} from './types';

export class SVGMorpheus {
  private _icons: Record<string, Icon> = {};
  private _curIconId: string = '';
  private _toIconId: string = '';
  private _curIconItems: IconItem[] = [];
  private _fromIconItems: IconItem[] = [];
  private _toIconItems: IconItem[] = [];
  private _morphNodes: MorphNode[] = [];
  private _morphG: SVGGElement | null = null;
  private _startTime: number | undefined;
  private _defDuration: number;
  private _defEasing: string;
  private _defRotation: string;
  private _defCallback: CallbackFunction;
  private _duration: number;
  private _easing: string;
  private _rotation: string;
  private _callback: CallbackFunction;
  private _rafid: AnimationFrameId | undefined;
  private _svgDoc: SVGSVGElement | null = null;
  private _fnTick: (timePassed: number) => void;

  /**
   * SVGMorpheus Constructor | SVGMorpheus 构造器
   * Creates a new SVGMorpheus instance for morphing SVG icons | 创建一个新的 SVGMorpheus 实例用于变形 SVG 图标
   * 
   * @param element Target SVG element or CSS selector | 目标 SVG 元素或 CSS 选择器
   *                - string: CSS selector to find the SVG element | 字符串：用于查找 SVG 元素的 CSS 选择器
   *                - HTMLElement: Direct reference to HTML element containing SVG | HTML 元素：直接引用包含 SVG 的 HTML 元素
   *                - SVGSVGElement: Direct reference to SVG element | SVG 元素：直接引用 SVG 元素
   * 
   * @param options Configuration options for default behavior | 默认行为的配置选项
   *                - iconId: Initial icon to display | 初始显示的图标
   *                - duration: Default animation duration (ms) | 默认动画持续时间（毫秒）
   *                - easing: Default easing function name | 默认缓动函数名称
   *                - rotation: Default rotation direction | 默认旋转方向
   * 
   * @param callback Default callback function executed after animations complete | 动画完成后执行的默认回调函数
   *                 Called when any morphing animation finishes | 当任何变形动画完成时被调用
   *                 Can be overridden by individual to() method calls | 可以被单独的 to() 方法调用覆盖
   */
  constructor(
    element: string | HTMLElement | SVGSVGElement,
    options?: SVGMorpheusOptions,
    callback?: CallbackFunction
  ) {
    if (!element) {
      throw new Error('SVGMorpheus > "element" is required');
    }

    let targetElement: HTMLElement | SVGSVGElement;
    if (typeof element === 'string') {
      const found = document.querySelector(element);
      if (!found) {
        throw new Error('SVGMorpheus > "element" query is not related to an existing DOM node');
      }
      targetElement = found as HTMLElement | SVGSVGElement;
    } else {
      targetElement = element;
    }

    if (!!options && typeof options !== 'object') {
      throw new Error('SVGMorpheus > "options" parameter must be an object');
    }
    options = options || {};

    if (!!callback && typeof callback !== 'function') {
      throw new Error('SVGMorpheus > "callback" parameter must be a function');
    }

    const that = this;

    this._icons = {};
    this._curIconId = options.iconId || '';
    this._toIconId = '';
    this._curIconItems = [];
    this._fromIconItems = [];
    this._toIconItems = [];
    this._morphNodes = [];
    this._morphG = null;
    this._startTime = undefined;
    this._defDuration = options.duration || 750;
    this._defEasing = options.easing || 'quad-in-out';
    this._defRotation = options.rotation || 'clock';
    this._defCallback = callback || function () {};
    this._duration = this._defDuration;
    this._easing = this._defEasing;
    this._rotation = this._defRotation;
    this._callback = this._defCallback;
    this._rafid = undefined;

    this._fnTick = function(timePassed: number) {
      if (!that._startTime) {
        that._startTime = timePassed;
      }
      const progress = Math.min((timePassed - that._startTime) / that._duration, 1);
      that._updateAnimationProgress(progress);
      if (progress < 1) {
        that._rafid = reqAnimFrame(that._fnTick);
      } else {
        if (that._toIconId !== '') {
          that._animationEnd();
        }
      }
    };

    if (targetElement.nodeName.toUpperCase() === 'SVG') {
      this._svgDoc = targetElement as SVGSVGElement;
    } else {
      this._svgDoc = (targetElement as any).getSVGDocument();
    }
    if (!this._svgDoc) {
      targetElement.addEventListener("load", function() {
        that._svgDoc = (targetElement as any).getSVGDocument();
        that._init();
      }, false);
    } else {
      that._init();
    }
  }

  private _init(): void {
    if (!this._svgDoc) return;
    
    if (this._svgDoc.nodeName.toUpperCase() !== 'SVG') {
      const svgElements = this._svgDoc.getElementsByTagName('svg');
      this._svgDoc = svgElements[0] as SVGSVGElement;
    }

    if (!!this._svgDoc) {
      let lastIconId = '';
      
      // 提取SVG文档级别的ViewBox和defs信息
      const svgOuterHTML = this._svgDoc.outerHTML;
      const documentViewBox = extractViewBoxInfo(svgOuterHTML);
      const documentDefs = extractDefsInfo(svgOuterHTML);
      const documentRootAttrs = extractSvgRootAttributes(svgOuterHTML);

      // Read Icons Data
      // Icons = 1st tier G nodes having ID
      for (let i = this._svgDoc.childNodes.length - 1; i >= 0; i--) {
        const nodeIcon = this._svgDoc.childNodes[i];
        if (nodeIcon.nodeName.toUpperCase() === 'G') {
          const iconElement = nodeIcon as SVGGElement;
          const id = iconElement.getAttribute('id');
          if (!!id) {
            const items: IconItem[] = [];
            
            // 初始化图标的坐标系统信息（继承文档级别）
            let iconViewBox: ViewBoxInfo | undefined = documentViewBox || undefined;
            let iconDefs: DefsInfo = documentDefs;
            let iconRootAttrs: Record<string, string> = documentRootAttrs;
            
            // 检查图标g元素是否保存了原始ViewBox信息
            const originalViewBox = iconElement.getAttribute('data-original-viewbox');
            if (originalViewBox) {
              // 解析保存的ViewBox信息
              const values = originalViewBox.trim().split(/\s+/).map(Number);
              if (values.length === 4) {
                iconViewBox = {
                  values: [values[0], values[1], values[2], values[3]],
                  original: originalViewBox
                };
              }
            }
            
            // 检查是否有defs信息需要提取（从原始SVG内容中）
            const iconHTML = iconElement.outerHTML;
            const iconSpecificDefs = extractDefsInfo(iconHTML);
            
            // 合并defs信息（图标特定的defs优先）
            iconDefs = {
              gradients: { ...documentDefs.gradients, ...iconSpecificDefs.gradients },
              patterns: { ...documentDefs.patterns, ...iconSpecificDefs.patterns },
              others: { ...documentDefs.others, ...iconSpecificDefs.others },
              raw: iconSpecificDefs.raw || documentDefs.raw
            };
            
            // 合并根属性
            iconRootAttrs = { ...documentRootAttrs, ...extractSvgRootAttributes(iconHTML) };

            for (let j = 0, len2 = iconElement.childNodes.length; j < len2; j++) {
              const nodeItem = iconElement.childNodes[j] as SVGElement;
              const item: IconItem = {
                path: '',
                attrs: {},
                style: {}
              };

              // Get Item Path (Convert all shapes into Path Data)
              switch (nodeItem.nodeName.toUpperCase()) {
                case 'PATH':
                  item.path = (nodeItem as SVGPathElement).getAttribute('d') || '';
                  break;
                case 'CIRCLE':
                  const circleElement = nodeItem as SVGCircleElement;
                  const cx = parseFloat(circleElement.getAttribute('cx') || '0');
                  const cy = parseFloat(circleElement.getAttribute('cy') || '0');
                  const r = parseFloat(circleElement.getAttribute('r') || '0');
                  item.path = `M${cx - r},${cy}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 -${r * 2},0z`;
                  break;
                case 'ELLIPSE':
                  const ellipseElement = nodeItem as SVGEllipseElement;
                  const ecx = parseFloat(ellipseElement.getAttribute('cx') || '0');
                  const ecy = parseFloat(ellipseElement.getAttribute('cy') || '0');
                  const rx = parseFloat(ellipseElement.getAttribute('rx') || '0');
                  const ry = parseFloat(ellipseElement.getAttribute('ry') || '0');
                  item.path = `M${ecx - rx},${ecy}a${rx},${ry} 0 1,0 ${rx * 2},0a${rx},${ry} 0 1,0 -${rx * 2},0z`;
                  break;
                case 'RECT':
                  const rectElement = nodeItem as SVGRectElement;
                  const x = parseFloat(rectElement.getAttribute('x') || '0');
                  const y = parseFloat(rectElement.getAttribute('y') || '0');
                  const w = parseFloat(rectElement.getAttribute('width') || '0');
                  const h = parseFloat(rectElement.getAttribute('height') || '0');
                  const rectRx = parseFloat(rectElement.getAttribute('rx') || '0');
                  const rectRy = parseFloat(rectElement.getAttribute('ry') || '0');
                  if (!rectRx && !rectRy) {
                    item.path = `M${x},${y}l${w},0l0,${h}l-${w},0z`;
                  } else {
                    item.path = `M${x + rectRx},${y}` +
                              `l${w - rectRx * 2},0` +
                              `a${rectRx},${rectRy} 0 0,1 ${rectRx},${rectRy}` +
                              `l0,${h - rectRy * 2}` +
                              `a${rectRx},${rectRy} 0 0,1 -${rectRx},${rectRy}` +
                              `l${rectRx * 2 - w},0` +
                              `a${rectRx},${rectRy} 0 0,1 -${rectRx},-${rectRy}` +
                              `l0,${rectRy * 2 - h}` +
                              `a${rectRx},${rectRy} 0 0,1 ${rectRx},-${rectRy}` +
                              'z';
                  }
                  break;
                case 'POLYGON':
                  const polygonElement = nodeItem as SVGPolygonElement;
                  const points = polygonElement.getAttribute('points') || '';
                  const p = points.split(/\s+/);
                  let path = "";
                  for (let k = 0, len = p.length; k < len; k++) {
                    path += (k && "L" || "M") + p[k]
                  }
                  item.path = path + 'z';
                  break;
                case 'LINE':
                  const lineElement = nodeItem as SVGLineElement;
                  const x1 = parseFloat(lineElement.getAttribute('x1') || '0');
                  const y1 = parseFloat(lineElement.getAttribute('y1') || '0');
                  const x2 = parseFloat(lineElement.getAttribute('x2') || '0');
                  const y2 = parseFloat(lineElement.getAttribute('y2') || '0');
                  item.path = `M${x1},${y1}L${x2},${y2}z`;
                  break;
              }
              
              if (item.path !== '') {
                // Traverse all attributes and get style values
                for (let k = 0, len3 = nodeItem.attributes.length; k < len3; k++) {
                  const attrib = nodeItem.attributes[k];
                  if (attrib.specified) {
                    const name = attrib.name.toLowerCase();
                    switch (name) {
                      case 'fill':
                      case 'fill-opacity':
                      case 'opacity':
                      case 'stroke':
                      case 'stroke-opacity':
                      case 'stroke-width':
                        (item.attrs as any)[name] = attrib.value;
                    }
                  }
                }

                // Traverse all inline styles and get supported values
                const elementStyle = (nodeItem as any).style;
                for (let l = 0, len4 = elementStyle.length; l < len4; l++) {
                  const styleName = elementStyle[l];
                  switch (styleName) {
                    case 'fill':
                    case 'fill-opacity':
                    case 'opacity':
                    case 'stroke':
                    case 'stroke-opacity':
                    case 'stroke-width':
                      (item.style as any)[styleName] = elementStyle[styleName];
                  }
                }

                items.push(item);
              }
            }

            // Add Icon
            if (items.length > 0) {
              const icon: Icon = {
                id: id,
                items: items,
                viewBox: iconViewBox,
                defs: iconDefs,
                rootAttrs: iconRootAttrs
              };
              this._icons[id] = icon;
            }

            // Init Node for Icons Items and remove Icon Nodes
            if (!this._morphG) {
              lastIconId = id;
              this._morphG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
              this._svgDoc.replaceChild(this._morphG, nodeIcon);
            } else {
              this._svgDoc.removeChild(nodeIcon);
            }
          }
        }
      }
      // To Default Icon
      const defaultIcon = this._curIconId || lastIconId;
      if (defaultIcon !== '') {
        this._setupAnimation(defaultIcon);
        this._updateAnimationProgress(1);
        this._animationEnd();
      }
    }
  }

  private _setupAnimation(toIconId: string): void {
    if (!!toIconId && !!this._icons[toIconId]) {
      this._toIconId = toIconId;
      this._startTime = undefined;
      let i: number, len: number;
      this._fromIconItems = clone(this._curIconItems);
      this._toIconItems = clone(this._icons[toIconId].items);

      // **坐标系统标准化处理** 
      const fromIcon = this._icons[this._curIconId];
      const toIcon = this._icons[toIconId];
      
      // 使用目标图标的ViewBox作为最终坐标系统
      const targetViewBox = toIcon.viewBox || fromIcon?.viewBox || { values: [0, 0, 24, 24], original: '0 0 24 24' };
      
      // 立即更新SVG根元素的ViewBox为目标ViewBox
      if (this._svgDoc) {
        this._svgDoc.setAttribute('viewBox', targetViewBox.original);
      }
      
      // 处理fromIcon的坐标转换 - 转换到目标坐标系统
      if (fromIcon && fromIcon.viewBox && toIcon.viewBox) {
        const fromTransformMatrix = calculateTransformMatrix(fromIcon.viewBox, targetViewBox);
        const fromIdPrefix = `from_${this._curIconId}_`;
        const fromOldToNewIdMap: Record<string, string> = {};
        
        // 先建立fromIcon的defs ID映射
        if (fromIcon.defs) {
          Object.keys(fromIcon.defs.gradients).forEach(oldId => {
            fromOldToNewIdMap[oldId] = fromIdPrefix + oldId;
          });
          Object.keys(fromIcon.defs.patterns).forEach(oldId => {
            fromOldToNewIdMap[oldId] = fromIdPrefix + oldId;
          });
          Object.keys(fromIcon.defs.others).forEach(oldId => {
            fromOldToNewIdMap[oldId] = fromIdPrefix + oldId;
          });
        }
        
        // 转换fromIcon的路径和引用到目标坐标系统
        this._fromIconItems = this._fromIconItems.map(item => {
          const transformedPath = transformPath(item.path, fromTransformMatrix);
          const updatedAttrsRefs = updateDefsReferences(transformedPath, item.attrs, fromOldToNewIdMap);
          const updatedStyleRefs = updateDefsReferences(transformedPath, item.style, fromOldToNewIdMap);
          
          return {
            ...item,
            path: transformedPath,
            attrs: updatedAttrsRefs.attrs,
            style: updatedStyleRefs.attrs
          };
        });
      }
      
      // toIcon已经在目标坐标系统中，只需要处理defs ID冲突
      if (toIcon.defs) {
        const toIdPrefix = `to_${toIconId}_`;
        const toOldToNewIdMap: Record<string, string> = {};
        
        // 先建立toIcon的defs ID映射
        Object.keys(toIcon.defs.gradients).forEach(oldId => {
          toOldToNewIdMap[oldId] = toIdPrefix + oldId;
        });
        Object.keys(toIcon.defs.patterns).forEach(oldId => {
          toOldToNewIdMap[oldId] = toIdPrefix + oldId;
        });
        Object.keys(toIcon.defs.others).forEach(oldId => {
          toOldToNewIdMap[oldId] = toIdPrefix + oldId;
        });
        
        // 再更新toIcon的defs引用以避免ID冲突
        this._toIconItems = this._toIconItems.map(item => {
          const updatedAttrsRefs = updateDefsReferences(item.path, item.attrs, toOldToNewIdMap);
          const updatedStyleRefs = updateDefsReferences(item.path, item.style, toOldToNewIdMap);
          return {
            ...item,
            attrs: updatedAttrsRefs.attrs,
            style: updatedStyleRefs.attrs
          };
        });
        
        // 动态插入转换后的defs到SVG文档中
        this._injectTransformedDefs(fromIcon, toIcon);
      }

      for (i = 0, len = this._morphNodes.length; i < len; i++) {
        const morphNode = this._morphNodes[i];
        morphNode.fromIconItemIdx = i;
        morphNode.toIconItemIdx = i;
      }

      const maxNum = Math.max(this._fromIconItems.length, this._toIconItems.length);
      let toBB: BoundingBox;
      for (i = 0; i < maxNum; i++) {
        // Add items to fromIcon/toIcon if needed
        if (!this._fromIconItems[i]) {
          if (!!this._toIconItems[i]) {
            toBB = curvePathBBox(path2curve(this._toIconItems[i].path));
            this._fromIconItems.push({
              path: 'M' + toBB.cx + ',' + toBB.cy + 'l0,0',
              attrs: {},
              style: {},
              trans: {
                'rotate': [0, toBB.cx, toBB.cy]
              }
            });
          } else {
            this._fromIconItems.push({
              path: 'M0,0l0,0',
              attrs: {},
              style: {},
              trans: {
                'rotate': [0, 0, 0]
              }
            });
          }
        }
        if (!this._toIconItems[i]) {
          if (!!this._fromIconItems[i]) {
            toBB = curvePathBBox(path2curve(this._fromIconItems[i].path));
            this._toIconItems.push({
              path: 'M' + toBB.cx + ',' + toBB.cy + 'l0,0',
              attrs: {},
              style: {},
              trans: {
                'rotate': [0, toBB.cx, toBB.cy]
              }
            });
          } else {
            this._toIconItems.push({
              path: 'M0,0l0,0',
              attrs: {},
              style: {},
              trans: {
                'rotate': [0, 0, 0]
              }
            });
          }
        }

        // Add Node to DOM if needed
        if (!this._morphNodes[i] && this._morphG) {
          const node = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          this._morphG.appendChild(node);
          this._morphNodes.push({
            node: node,
            fromIconItemIdx: i,
            toIconItemIdx: i
          });
        }
      }

      for (i = 0; i < maxNum; i++) {
        const fromIconItem = this._fromIconItems[i];
        const toIconItem = this._toIconItems[i];

        // Calculate from/to curve data and set to fromIcon/toIcon
        const curves = path2curve(this._fromIconItems[i].path, this._toIconItems[i].path);
        fromIconItem.curve = curves[0];
        toIconItem.curve = curves[1];

        // Normalize from/to attrs
        const attrsNorm = styleToNorm(this._fromIconItems[i].attrs, this._toIconItems[i].attrs);
        fromIconItem.attrsNorm = attrsNorm[0];
        toIconItem.attrsNorm = attrsNorm[1];
        fromIconItem.attrs = styleNormToString(fromIconItem.attrsNorm);
        toIconItem.attrs = styleNormToString(toIconItem.attrsNorm);

        // Normalize from/to style
        const styleNorm = styleToNorm(this._fromIconItems[i].style, this._toIconItems[i].style);
        fromIconItem.styleNorm = styleNorm[0];
        toIconItem.styleNorm = styleNorm[1];
        fromIconItem.style = styleNormToString(fromIconItem.styleNorm);
        toIconItem.style = styleNormToString(toIconItem.styleNorm);

        // Calculate from/to transform
        toBB = curvePathBBox(toIconItem.curve!);
        
        // 计算统一的旋转中心（所有路径几何中心的平均值）
        let centerX = 0, centerY = 0, pathCount = 0;
        
        for (let j = 0; j < this._toIconItems.length; j++) {
          if (this._toIconItems[j].curve) {
            const bbox = curvePathBBox(this._toIconItems[j].curve!);
            if (bbox && !isNaN(bbox.cx) && !isNaN(bbox.cy)) {
              centerX += bbox.cx;
              centerY += bbox.cy;
              pathCount++;
            }
          }
        }
        
        const svgCenter = pathCount > 0 ? 
          { x: centerX / pathCount, y: centerY / pathCount } : 
          { x: 12, y: 12 };
        
        toIconItem.trans = {
          'rotate': [0, svgCenter.x, svgCenter.y]
        };
        
        // 为fromIcon设置统一旋转中心并重置角度
        if (!fromIconItem.trans) {
          fromIconItem.trans = {
            'rotate': [0, svgCenter.x, svgCenter.y]
          };
        } else if (fromIconItem.trans.rotate) {
          fromIconItem.trans.rotate[0] = 0; // 重置角度避免累积
          fromIconItem.trans.rotate[1] = svgCenter.x;
          fromIconItem.trans.rotate[2] = svgCenter.y;
        }
        
        let rotation = this._rotation;
        let degAdd: number;
        if (rotation === 'random') {
          rotation = Math.random() < 0.5 ? 'counterclock' : 'clock';
        }
        
        switch (rotation) {
          case 'none':
            if (fromIconItem.trans?.rotate && toIconItem.trans?.rotate) {
              toIconItem.trans.rotate[0] = fromIconItem.trans.rotate[0];
            }
            break;
          case 'counterclock':
            if (fromIconItem.trans?.rotate && toIconItem.trans?.rotate) {
              toIconItem.trans.rotate[0] = fromIconItem.trans.rotate[0] - 360;
              degAdd = -fromIconItem.trans.rotate[0] % 360;
              toIconItem.trans.rotate[0] += (degAdd < 180 ? degAdd : degAdd - 360);
            } else if (toIconItem.trans?.rotate) {
              toIconItem.trans.rotate[0] = -360;
            }
            break;
          default: // Clockwise
            if (fromIconItem.trans?.rotate && toIconItem.trans?.rotate) {
              toIconItem.trans.rotate[0] = fromIconItem.trans.rotate[0] + 360;
              degAdd = fromIconItem.trans.rotate[0] % 360;
              toIconItem.trans.rotate[0] += (degAdd < 180 ? -degAdd : 360 - degAdd);
            } else if (toIconItem.trans?.rotate) {
              toIconItem.trans.rotate[0] = 360;
            }
            break;
        }
      }

      this._curIconItems = clone(this._fromIconItems);
    }
  }

  private _updateAnimationProgress(progress: number): void {
    progress = (easings as any)[this._easing](progress);

    let i: number, j: string, k: string, len: number;
    // Update path/attrs/transform
    for (i = 0, len = this._curIconItems.length; i < len; i++) {
      if (this._fromIconItems[i].curve && this._toIconItems[i].curve) {
        this._curIconItems[i].curve = curveCalc(this._fromIconItems[i].curve!, this._toIconItems[i].curve!, progress);
        this._curIconItems[i].path = path2string(this._curIconItems[i].curve);
      }

      if (this._fromIconItems[i].attrsNorm && this._toIconItems[i].attrsNorm) {
        this._curIconItems[i].attrsNorm = styleNormCalc(this._fromIconItems[i].attrsNorm!, this._toIconItems[i].attrsNorm!, progress);
        this._curIconItems[i].attrs = styleNormToString(this._curIconItems[i].attrsNorm!);
      }

      if (this._fromIconItems[i].styleNorm && this._toIconItems[i].styleNorm) {
        this._curIconItems[i].styleNorm = styleNormCalc(this._fromIconItems[i].styleNorm!, this._toIconItems[i].styleNorm!, progress);
        this._curIconItems[i].style = styleNormToString(this._curIconItems[i].styleNorm!);
      }

      if (this._fromIconItems[i].trans && this._toIconItems[i].trans) {
        this._curIconItems[i].trans = transCalc(this._fromIconItems[i].trans!, this._toIconItems[i].trans!, progress);
        this._curIconItems[i].transStr = trans2string(this._curIconItems[i].trans!);
      }
    }

    // Update DOM
    for (i = 0, len = this._morphNodes.length; i < len; i++) {
      const morphNode = this._morphNodes[i];
      morphNode.node.setAttribute("d", this._curIconItems[i].path);
      const attrs = this._curIconItems[i].attrs as StyleAttributes;
      for (j in attrs) {
        morphNode.node.setAttribute(j, (attrs as any)[j]);
      }
      const style = this._curIconItems[i].style as StyleAttributes;
      for (k in style) {
        (morphNode.node.style as any)[k] = (style as any)[k];
      }
      morphNode.node.setAttribute("transform", this._curIconItems[i].transStr || '');
    }
  }

  private _animationEnd(): void {
    for (let i = this._morphNodes.length - 1; i >= 0; i--) {
      const morphNode = this._morphNodes[i];
      if (!!this._toIconItems[i]) {
        // 使用更新后的_toIconItems而不是原始的this._icons[this._toIconId].items
        morphNode.node.setAttribute("d", this._toIconItems[i].path);
        
        // 设置最终的attributes（包含更新后的defs引用）
        const attrs = this._toIconItems[i].attrs as StyleAttributes;
        for (const attrName in attrs) {
          morphNode.node.setAttribute(attrName, (attrs as any)[attrName]);
        }
        
        // 设置最终的styles
        const styles = this._toIconItems[i].style as StyleAttributes;
        for (const styleName in styles) {
          (morphNode.node.style as any)[styleName] = (styles as any)[styleName];
        }
        
        // 设置最终的transform
        const finalTransform = this._toIconItems[i].transStr || "";
        morphNode.node.setAttribute("transform", finalTransform);
      } else {
        if (morphNode.node.parentNode) {
          morphNode.node.parentNode.removeChild(morphNode.node);
        }
        this._morphNodes.splice(i, 1);
      }
    }

    this._curIconId = this._toIconId;
    this._toIconId = '';

    this._callback();
  }

  // Public methods | 公共方法

  /**
   * Morph to target icon | 变形到目标图标
   * Triggers morphing animation from current icon to specified target icon | 触发从当前图标到指定目标图标的变形动画
   * 
   * @param iconId Target icon ID to morph to | 要变形到的目标图标ID
   *               Must match an ID of a <g> element in the SVG | 必须匹配 SVG 中某个 <g> 元素的ID
   * 
   * @param options Animation options for this specific morph | 此次特定变形的动画选项
   *                Overrides constructor defaults for this animation only | 仅为此次动画覆盖构造器默认值
   *                - duration: Animation duration (ms) | 动画持续时间（毫秒）
   *                - easing: Easing function name | 缓动函数名称
   *                - rotation: Rotation direction | 旋转方向
   * 
   * @param callback Callback function for this specific morph | 此次特定变形的回调函数
   *                 Overrides constructor default callback for this animation only | 仅为此次动画覆盖构造器默认回调
   *                 Called when this specific morphing animation completes | 当此次特定变形动画完成时被调用
   */
  public to(iconId: string, options?: ToMethodOptions, callback?: CallbackFunction): void {
    if (iconId !== this._toIconId) {
      if (!!options && typeof options !== 'object') {
        throw new Error('SVGMorpheus.to() > "options" parameter must be an object');
      }
      options = options || {};

      if (!!callback && typeof callback !== 'function') {
        throw new Error('SVGMorpheus.to() > "callback" parameter must be a function');
      }

      if (this._rafid) {
        cancelAnimFrame(this._rafid);
      }

      this._duration = options.duration || this._defDuration;
      this._easing = options.easing || this._defEasing;
      this._rotation = options.rotation || this._defRotation;
      this._callback = callback || this._defCallback;

      this._setupAnimation(iconId);
      this._rafid = reqAnimFrame(this._fnTick);
    }
  }

  /**
   * Register custom easing function | 注册自定义缓动函数
   * Adds a custom easing function that can be used in animations | 添加可在动画中使用的自定义缓动函数
   * 
   * @param name Unique name for the easing function | 缓动函数的唯一名称
   *             This name will be used to reference the function in options | 此名称将用于在选项中引用该函数
   *             
   * @param fn Custom easing function | 自定义缓动函数
   *           Takes progress (0-1) and returns eased progress (typically 0-1) | 接受进度值(0-1)并返回缓动后的进度值(通常为0-1)
   *           @param progress Animation progress from 0 to 1 | 从0到1的动画进度
   *           @returns Eased progress value | 缓动后的进度值
   * 
   * @example
   * // Register a custom bounce easing | 注册自定义弹跳缓动
   * morpheus.registerEasing('my-bounce', (t) => {
   *   return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
   * });
   */
  public registerEasing(name: string, fn: (progress: number) => number): void {
    (easings as any)[name] = fn;
  }

  /**
   * 动态插入转换后的defs到SVG文档中
   */
  private _injectTransformedDefs(fromIcon: Icon | undefined, toIcon: Icon): void {
    if (!this._svgDoc) return;
    
    // 查找或创建defs元素
    let defsElement = this._svgDoc.querySelector('defs');
    if (!defsElement) {
      defsElement = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this._svgDoc.insertBefore(defsElement, this._svgDoc.firstChild);
    }
    
    // 插入fromIcon的转换后defs（已经转换到目标坐标系统）
    if (fromIcon && fromIcon.defs && fromIcon.viewBox) {
      const fromIdPrefix = `from_${this._curIconId}_`;
      
      // 计算转换矩阵用于渐变坐标转换
      const targetViewBox = toIcon.viewBox || { values: [0, 0, 24, 24], original: '0 0 24 24' };
      const fromTransformMatrix = calculateTransformMatrix(fromIcon.viewBox, targetViewBox);
      
      // 传入转换矩阵
      const transformedFromDefs = transformGradientDefs(fromIcon.defs, fromIdPrefix, fromTransformMatrix);
      
      this._insertDefsContent(defsElement, transformedFromDefs);
    }
    
    // 插入toIcon的defs（已经在目标坐标系统中，无需坐标转换）
    if (toIcon.defs) {
      const toIdPrefix = `to_${toIcon.id}_`;
      // toIcon不需要坐标转换，只需要ID重命名
      const transformedToDefs = transformGradientDefs(toIcon.defs, toIdPrefix);
      
      this._insertDefsContent(defsElement, transformedToDefs);
    }
  }
  
  /**
   * 插入defs内容到defs元素中
   */
  private _insertDefsContent(defsElement: SVGDefsElement, defsInfo: DefsInfo): void {
    const parser = new DOMParser();
    
    // 插入渐变
    Object.values(defsInfo.gradients).forEach(gradientStr => {
      try {
        // 使用DOMParser解析SVG字符串，避免HTML解析器的问题
        const svgDoc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${gradientStr}</svg>`, 'image/svg+xml');
        const gradientElement = svgDoc.documentElement.firstElementChild;
        
        if (gradientElement) {
          // 导入节点到当前文档中
          const importedElement = document.importNode(gradientElement, true);
          defsElement.appendChild(importedElement);
        }
      } catch (error) {
        console.warn('Failed to parse gradient:', gradientStr, error);
      }
    });
    
    // 插入图案
    Object.values(defsInfo.patterns).forEach(patternStr => {
      try {
        const svgDoc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${patternStr}</svg>`, 'image/svg+xml');
        const patternElement = svgDoc.documentElement.firstElementChild;
        
        if (patternElement) {
          const importedElement = document.importNode(patternElement, true);
          defsElement.appendChild(importedElement);
        }
      } catch (error) {
        console.warn('Failed to parse pattern:', patternStr, error);
      }
    });
    
    // 插入其他定义
    Object.values(defsInfo.others).forEach(otherStr => {
      try {
        const svgDoc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${otherStr}</svg>`, 'image/svg+xml');
        const otherElement = svgDoc.documentElement.firstElementChild;
        
        if (otherElement) {
          const importedElement = document.importNode(otherElement, true);
          defsElement.appendChild(importedElement);
        }
      } catch (error) {
        console.warn('Failed to parse other def:', otherStr, error);
      }
    });
  }
}

// Default export for ESM
export default SVGMorpheus; 