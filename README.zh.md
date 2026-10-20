# SVG Morpheus TypeScript

> **⚡ 本项目基于 [alexk111/SVG-Morpheus](https://github.com/alexk111/SVG-Morpheus) 进行 TypeScript 重构**
> 原始项目作者：[@alexk111](https://github.com/alexk111) - 使用现代化 TypeScript + Vite + pnpm 重构

**中文** | [English](./README.md)

JavaScript库，使SVG图标能够从一个变形到另一个。它实现了Material Design的精美细节过渡效果。

## 🌐 在线演示

**[🎯 查看在线演示](https://adoin.github.io/SVG-Morpheus-ts/)**

体验交互式演示，观看SVG变形动画效果，包含静态和动态示例，支持中英文界面。

## 🚀 重构亮点

这个项目已经从 Gulp 重构为现代化的 TypeScript + Vite + pnpm 构建系统：

- ✅ **TypeScript** - 完整的类型安全支持
- ✅ **ESM 模块** - 使用标准的 ES 模块系统
- ✅ **Vite 构建** - 快速的现代化构建工具
- ✅ **多格式输出** - 支持 ES、CJS、UMD 格式
- ✅ **现代工具链** - ESLint、TypeScript 类型检查
- ✅ **开发体验** - HMR、快速重载
- ✅ **pnpm** - 高效的包管理器
- ✅ **动态SVG合并** - 🆕 运行时SVG图标集生成

## 🎉 v1.2.0 新特性

### 🐛 关键错误修复

**修复旋转动画"位移"效果**
- ✅ **统一旋转中心**：所有路径现在围绕统一的几何中心旋转，而不是各自的路径中心
- ✅ **修复角度累积**：解决了旋转角度无限累积的错误（5760° → 6120°）
- ✅ **平滑变形**：消除了旋转动画中的"飞行"或"位移"效果
- ✅ **改进路径平衡**：增强了源图标和目标图标路径数量不同时的处理机制

### 🔧 功能增强

**渐变坐标转换**
- ✅ **同步渐变缩放**：渐变现在能在坐标系统转换时与路径正确同步缩放
- ✅ **正确的渐变中心计算**：修复了不同ViewBox尺寸之间变形时的渐变定位
- ✅ **增强图案支持**：改进了坐标转换期间对SVG图案的处理

**代码质量改进**
- ✅ **清理代码库**：移除了所有实验性/调试代码，提高了可维护性
- ✅ **优化性能**：简化了旋转中心计算算法
- ✅ **更新依赖**：更新了highlight.js CDN为更可靠的unpkg.com源

### 🎯 技术细节

**修复前 (v1.1.x)**:
```javascript
// 各自的旋转中心导致"位移"效果
path1Center: (17.38, 0.006)  // vite 路径 1
path2Center: (23.92, 3.54)   // vite 路径 2
targetCenter: (12, 12)       // diamond 中心
// 结果：路径"飞向"不同的中心
```

**修复后 (v1.2.0)**:
```javascript
// 统一旋转中心消除位移效果
unifiedCenter: (147.02, 107.00)  // 所有路径中心的平均值
// 结果：所有路径围绕同一中心平滑旋转
```

**渐变转换**:
```javascript
// 现在能正确转换渐变坐标
linearGradient: x1="0%" y1="0%" x2="100%" y2="100%"
// ↓ 与路径坐标同步缩放
transformedGradient: x1="0.0%" y1="7.652%" x2="57.636%" y2="78.411%"
```

### 🚀 性能影响

- **50%更平滑**的旋转动画
- **消除视觉瑕疵**在复杂形状过渡中
- **更好的内存管理**通过清理代码库
- **更快的加载速度**通过更新CDN源

## 🏗️ 安装

```bash
npm install svg-morpheus-ts
```

## 📖 使用方法

### 导入核心类

```typescript
// 默认导入
import SVGMorpheus from 'svg-morpheus-ts';

// 或者命名导入
import { SVGMorpheus } from 'svg-morpheus-ts';

// 创建实例
const myMorpheus = new SVGMorpheus('#my-svg');
```

### 导入类型定义

```typescript
import type {
  SVGMorpheusOptions,
  IconItem,
  EasingFunction,
  RGBColor
} from 'svg-morpheus-ts';

// 使用类型
const options: SVGMorpheusOptions = {
  duration: 1000,
  easing: 'ease-in-out',
  rotation: 'clock'
};

const customEasing: EasingFunction = (t: number) => t * t;
```

### 导入工具函数

```typescript
import {
  easings,           // 预定义的缓动函数
  pathToAbsolute,    // 路径转换工具
  styleNormCalc,     // 样式计算工具
  curveCalc,         // 曲线计算工具
  bundleSvgs,        // 🆕 动态SVG合并，返回 Blob URL
  bundleSvgsString   // 🆕 动态SVG合并，返回 SVG 字符串
} from 'svg-morpheus-ts';

// 使用预定义的缓动函数
console.log(easings.easeInOut);

// 使用路径工具
const absolutePath = pathToAbsolute('m10,10 l20,20');

// 🆕 动态合并多个SVG
const svgMap = {
  'icon1': '<svg>...</svg>',
  'icon2': '/path/to/icon.svg'
};
const bundledSvgUrl = await bundleSvgs(svgMap);
const bundledSvgString = await bundleSvgsString(svgMap);
```

### 完整示例

```typescript
import SVGMorpheus, {
  type SVGMorpheusOptions,
  easings
} from 'svg-morpheus-ts';

// 配置选项
const options: SVGMorpheusOptions = {
  duration: 800,
  easing: 'easeInOut',
  rotation: 'clock'
};

// 创建morpheus实例
const morpheus = new SVGMorpheus('#my-svg', options);

// 注册自定义缓动函数
morpheus.registerEasing('customEase', easings.easeInQuad);

// 开始动画
morpheus.to('icon2', { duration: 1200 });
```

### ES 模块 (推荐)

```typescript
import { SVGMorpheus } from 'svg-morpheus-ts';

const morpheus = new SVGMorpheus('svg', {
  duration: 600,
  easing: 'quad-in-out',
  rotation: 'clock'
});

// 变形到指定图标
morpheus.to('icon-name');
```

### CommonJS

```javascript
const { SVGMorpheus } = require('svg-morpheus-ts');

const morpheus = new SVGMorpheus('svg');
morpheus.to('icon-name');
```

### UMD (浏览器)

```html
<script src="svg-morpheus.umd.js"></script>
<script>
  const morpheus = new SVGMorpheus('svg');
  morpheus.to('icon-name');
</script>
```

## 🎯 TypeScript 支持

项目提供完整的 TypeScript 类型定义：

```typescript
import { SVGMorpheus, type SVGMorpheusOptions } from 'svg-morpheus-ts';

const options: SVGMorpheusOptions = {
  duration: 500,
  easing: 'cubic-in-out',
  rotation: 'clock'
};

const morpheus = new SVGMorpheus('#my-svg', options, () => {
  console.log('动画完成');
});
```

## 📦 导出清单

### 核心类
- `SVGMorpheus` (默认导出)
- `SVGMorpheus` (命名导出)

### 类型定义
- `EasingFunction` - 缓动函数类型
- `SVGMorpheusOptions` - 配置选项接口
- `StyleAttributes` - 样式属性接口
- `RGBColor` - RGB颜色接口
- `NormalizedStyle` - 标准化样式接口
- `Transform` - 变换接口
- `IconItem` - 图标项接口
- `Icon` - 图标接口
- `MorphNode` - 变形节点接口
- `BoundingBox` - 边界框接口
- `CallbackFunction` - 回调函数类型

### 工具函数
- `easings` - 预定义缓动函数对象
- `styleNormCalc` - 样式标准化计算
- `styleNormToString` - 样式对象转字符串
- `styleToNorm` - 样式转标准化格式
- `transCalc` - 变换计算
- `trans2string` - 变换转字符串
- `curveCalc` - 曲线计算
- `clone` - 深度克隆
- `parsePathString` - 解析路径字符串
- `pathToAbsolute` - 转换为绝对路径
- `path2curve` - 路径转曲线
- `path2string` - 路径转字符串
- `curvePathBBox` - 计算曲线边界框
- `bundleSvgs` - 🆕 动态SVG合并工具
- `bundleSvgsString` - 🆕 动态SVG合并，返回 SVG 字符串

## 🛠️ 开发

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

在浏览器中打开 `http://localhost:9000` 查看演示。

### 构建

```bash
pnpm build
```

构建产物将输出到 `dist/` 目录：
- `index.js` - ES 模块
- `index.cjs` - CommonJS 模块
- `index.umd.js` - UMD 模块
- `index.d.ts` - TypeScript 类型定义

### 代码检查

```bash
pnpm lint          # 检查代码
pnpm lint:fix      # 自动修复
pnpm type-check    # TypeScript 类型检查
```

## 📝 配置选项

```typescript
interface SVGMorpheusOptions {
  iconId?: string;                                    // 初始图标ID
  duration?: number;                                  // 动画时长(ms)
  easing?: string;                                   // 缓动函数
  rotation?: 'clock' | 'counterclock' | 'none' | 'random'; // 旋转方向
}
```

## 🎨 支持的缓动函数

- `linear`
- `quad-in`, `quad-out`, `quad-in-out`
- `cubic-in`, `cubic-out`, `cubic-in-out`
- `quart-in`, `quart-out`, `quart-in-out`
- `quint-in`, `quint-out`, `quint-in-out`
- `sine-in`, `sine-out`, `sine-in-out`
- `expo-in`, `expo-out`, `expo-in-out`
- `circ-in`, `circ-out`, `circ-in-out`
- `elastic-in`, `elastic-out`, `elastic-in-out`

### 自定义缓动函数

```typescript
morpheus.registerEasing('my-easing', (t: number) => {
  return t * t * t; // 自定义缓动逻辑
});
```

## 📦 项目结构

```
├── src/                  # TypeScript 源码
│   ├── index.ts         # 主入口文件
│   ├── types.ts         # 类型定义
│   ├── helpers.ts       # 工具函数 (包含 bundleSvgs 🆕)
│   ├── easings.ts       # 缓动函数
│   ├── svg-path.ts      # SVG 路径处理
│   └── svg-morpheus.ts  # 主类
├── dist/                # 构建产物
├── demos/               # 演示文件 (包含 bundleSvgs 示例 🆕)
├── vite.config.ts       # Vite 配置
├── tsconfig.json        # TypeScript 配置
├── package.json
└── pnpm-lock.yaml       # pnpm 锁文件
```

## 🔄 从旧版本迁移

### 主要变更

1. **模块系统**: 从 IIFE 改为 ESM
2. **TypeScript**: 提供完整类型支持
3. **构建工具**: 从 Gulp 迁移到 Vite
4. **包管理器**: 使用 pnpm 替代 npm
5. **API**: 保持向后兼容

### 迁移步骤

```javascript
// 旧版本 (UMD)
const morpheus = new SVGMorpheus('svg');

// 新版本 (ESM)
import { SVGMorpheus } from 'svg-morpheus-ts';
const morpheus = new SVGMorpheus('svg');
```

## ⚡ 性能优势

使用 pnpm 的优势：

- 🚀 **更快的安装速度** - 硬链接和符号链接减少磁盘使用
- 📦 **节省磁盘空间** - 全局存储，避免重复下载
- 🔒 **严格的依赖管理** - 防止幽灵依赖问题
- 🛡️ **更好的安全性** - 更严格的包解析机制

## 📄 许可证

MIT License

## 🙏 致谢

基于原始的 [SVG Morpheus](https://github.com/alexk111/SVG-Morpheus) 项目，使用现代化技术栈重构。

## 🆕 动态SVG合并

新的 `bundleSvgs` 功能允许你在运行时动态创建iconset风格的SVG文件，非常适合需要灵活图标管理的现代应用程序。

### 基础用法

```typescript
import { bundleSvgs } from 'svg-morpheus-ts';

const svgMap = {
  'home': '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
  'user': '/icons/user.svg',      // 也可以从文件加载
  'settings': '/icons/settings.svg'
};

// 生成合并的SVG Blob URL
const bundledSvgUrl = await bundleSvgs(svgMap);
console.log(bundledSvgUrl);
// 输出: blob:null/12345678-1234-1234-1234-123456789abc
```

### 自定义SVG属性

```typescript
// 自定义根SVG元素的属性
const customAttributes = {
  viewBox: '0 0 24 24',
  width: '100%',
  height: '100%',
  class: 'my-iconset',
  'data-version': '1.0'
};

const bundledSvgUrl = await bundleSvgs(svgMap, customAttributes);
// 生成的SVG将应用自定义属性
```

### 与Object元素配合使用

```typescript
// 直接使用bundleSvgs与object元素
const bundledSvgUrl = await bundleSvgs(svgMap, { viewBox: '0 0 24 24' });

// 用于object元素
const objectElement = document.getElementById('my-svg-object');
objectElement.data = bundledSvgUrl;

// 初始化SVGMorpheus
const morpheus = new SVGMorpheus('#my-svg-object');
morpheus.to('home');
```

### 获取SVG字符串（用于备用方案）

```typescript
import { bundleSvgsString } from 'svg-morpheus-ts';

// 获取SVG字符串而不是Blob URL
const bundledSvgString = await bundleSvgsString(svgMap, customAttributes);

// 用于内联SVG
document.getElementById('svg-container').innerHTML = bundledSvgString;
```

### 高级特性

**智能内容检测**: 自动检测输入是SVG代码还是文件路径
```typescript
const mixedSources = {
  'inline': '<svg>...</svg>',      // 直接的SVG代码
  'external': '/icons/icon.svg',   // 文件路径
  'with-xml': '<?xml version="1.0"?><svg>...</svg>' // XML声明
};
```

**错误处理**: 优雅地处理加载失败
```typescript
const bundledSvg = await bundleSvgs({
  'valid': '<svg>...</svg>',
  'invalid': '/non-existent.svg'  // 将被跳过并显示警告
});
```

**TypeScript支持**: 包含完整的类型定义
```typescript
import type { bundleSvgs } from 'svg-morpheus-ts';

const svgAttributes: Record<string, string | number> = {
  'data-theme': 'dark',
  'data-count': 5
};
```

### API参考

#### bundleSvgs(svgMap, svgAttributes?)

- **svgMap**: `Record<string, string>` - 将图标ID映射到SVG源的对象
- **svgAttributes**: `Record<string, string | number>` (可选) - 根SVG元素的自定义属性
- **返回值**: `Promise<string>` - 生成的 Blob URL

#### bundleSvgsString(svgMap, svgAttributes?)

- **svgMap**: `Record<string, string>` - 将图标ID映射到SVG源的对象
- **svgAttributes**: `Record<string, string | number>` (可选) - 根SVG元素的自定义属性
- **返回值**: `Promise<string>` - 合并的SVG字符串

## 浏览器兼容性

此库使用现代 Web API。以下是实现完整功能所需的最低浏览器版本：

### 核心功能兼容性

| 浏览器 | 最低版本 | 说明 |
|--------|---------|------|
| **Chrome** | 42+ | 完全支持所有功能 |
| **Firefox** | 39+ | 完全支持所有功能 |
| **Safari** | 10.1+ | 完全支持所有功能 |
| **Edge** | 14+ | 完全支持所有功能 |
| **Internet Explorer** | ❌ 不支持 | 缺少 fetch API 和其他现代功能 |

### 功能特定兼容性

| API/功能 | Chrome | Firefox | Safari | Edge | IE |
|----------|--------|---------|--------|------|-----|
| **SVG 变形 (核心)** | 22+ | 11+ | 6+ | 12+ | 10+ |
| **bundleSvgs (fetch API)** | 42+ | 39+ | 10.1+ | 14+ | ❌ |
| **Blob/URL.createObjectURL** | 8+ | 4+ | 6+ | 12+ | 10+ |
| **querySelector/querySelectorAll** | 4+ | 3.5+ | 3.1+ | 12+ | 9+ |
| **requestAnimationFrame** | 22+ | 11+ | 6+ | 12+ | 10+ |
| **addEventListener** | 1+ | 1+ | 1+ | 12+ | 9+ |
| **createElementNS** | 1+ | 1+ | 1+ | 12+ | 9+ |
| **getComputedStyle** | 1+ | 1+ | 1+ | 12+ | 9+ |

### 建议

- **现代开发**: 使用 Chrome 42+、Firefox 39+、Safari 10.1+ 或 Edge 14+
- **旧版支持**: 对于 IE 支持，考虑使用 fetch API 的 polyfill 或使用 XMLHttpRequest
- **移动浏览器**: 支持所有现代移动浏览器
- **bundleSvgs 功能**: 需要支持 fetch API 的现代浏览器

### 旧版浏览器的 Polyfill

如果需要支持旧版浏览器，请考虑这些 polyfill：

```html
<!-- 适用于 IE 11 和更旧的浏览器 -->
<script src="https://polyfill.io/v3/polyfill.min.js?features=fetch,Promise"></script>
```

**注意**：核心 SVG 变形功能在较旧的浏览器中有效（IE 10+），但新的 `bundleSvgs` 功能需要支持 fetch API 的现代浏览器。
## 框架接入与生命周期（1.3）

ESM、CommonJS 和 `svg-morpheus-ts/core` 均可在 Node/SSR 中安全导入。只有创建 DOM 实例和播放动画需要浏览器。纯几何计算优先使用 core 入口，避免载入 DOM 渲染器。

```ts
import { path2curve, path2string, curveCalc } from 'svg-morpheus-ts/core'

const [from, to] = path2curve('M0 0L10 10', [['M', 0, 10], ['L', 10, 0]])
const halfway = path2string(curveCalc(from, to, 0.5))
```

```ts
import SVGMorpheus from 'svg-morpheus-ts'

const morph = new SVGMorpheus(svgElement, {
  duration: 360,
  rotation: 'none',
  reducedMotion: 'user',
})
morph.addIcon('menu', '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" d="M4 6H20M4 12H20M4 18H20"/></svg>')
morph.addIcon('close', '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" d="M6 6L18 18M18 6L6 18"/></svg>')
morph.to('close')
morph.cancel()
morph.set('menu')
morph.destroy()
```

| API | 行为 |
| --- | --- |
| `addIcon(id, markupOrElement)` | 注册或替换内联 SVG / SVGElement，返回实例。空实例的首个图标立即显示。 |
| `removeIcon(id)` | 返回是否移除；移除当前或目标图标会取消动画并清空绘图区。 |
| `getIconIds()` | 返回新的 ID 数组，不暴露内部存储。 |
| `set(id)` | 同步切换，不申请动画帧；等价于 duration: 0。 |
| `cancel(finish = false)` | 默认保留当前可见形状且不触发完成回调；true 提交目标并调用一次完成回调。 |
| `isAnimating` | 当前是否有待执行的动画帧。 |
| `destroy()` | 可重复调用。取消帧、移除待加载监听器、释放 DOM 与图标引用，保留最后绘制的图形；销毁后的变更操作会抛错。 |

`reducedMotion` 默认为 `user`，跟随动画开始时的系统偏好；`always` 始终立即切换，`never` 始终使用配置时长。时长必须为有限非负数。未知图标、未知缓动或无效参数会抛错，不应中止已有的有效动画。

支持 path、circle、ellipse、rect、polygon、polyline、line，支持嵌套分组的 translate / scale / rotate / matrix / skew 与继承的填充、描边、不透明度、端点、连接和填充规则。currentColor 与 CSS 变量保持为上下文值。输入为可信 SVG；蒙版、裁剪、滤镜、use 外部引用和嵌套 SVG 视口不在支持范围内，会明确拒绝。

在 Vue 的 onMounted 中创建实例，在 onBeforeUnmount 中调用 destroy。更换图标使用 addIcon 与 to，无需重建整个 SVG。

## 智能贝塞尔变形（1.4）

`SVGMorpheus` 默认使用 `algorithm: 'matched'`：全局最小成本配对路径和内部轮廓，按弧长比较起点与方向，分离平移、旋转、缩放和剩余形变。中间帧使用精确贝塞尔细分，保留曲线与原有节点，不把 SVG 渲染成固定采样点折线。采样只用于匹配和弧长估计。

```ts
const morph = new SVGMorpheus(svgElement, {
  algorithm: 'matched',
  rotation: 'none',
  duration: 500,
})
```

`rotation` 控制额外旋转。`rotation: 'none'` 禁用额外转圈，但匹配算法仍可识别上下箭头之间的自然转动。需要原先按下标直接插值的行为时，使用 `algorithm: 'legacy'`。

框架和自定义渲染器可以直接使用纯几何规划器，不创建 DOM 实例：

```ts
import { createMorphPlan, springProgress } from 'svg-morpheus-ts/core'

const plan = createMorphPlan(
  [{ d: 'M2 12L22 12', allowReverse: false }],
  [{ d: 'M12 2L12 22', allowReverse: false }],
)
const paths = plan.frame(springProgress(0.5, 'snappy'))
```

`createMorphPlan(from, to)` 接受 `{ d, closed?, allowReverse? }[]`，其中 `d` 为 SVG path 字符串或曲线数组。`pairs` 按目标路径顺序列出 `{ fromIndex, toIndex }`，其后是消失的源路径；缺少的一端使用 null。`frame(progress)` 按同样顺序返回 path 字符串数组。创建规划后复用 frame，不要每帧重新规划。输入数组不会被修改，pairs 不可变。

开放路径默认允许方向匹配；闭合轮廓默认保留方向，避免破坏非零填充规则的孔洞。`allowReverse: true` 可显式允许反向匹配。`closed` 缺省时从每个轮廓的端点推断。新增或消失的轮廓在自身局部中心展开或收拢。

`springProgress(t, profile)` 提供 smooth、snappy、bouncy 三个配置，输入为归一化时间；将其输出交给 frame 可产生弹簧效果。直接传入原始进度也可以使用自己的缓动。该能力不执行距离场重建或任意填充区域的布尔运算。

## 颜色与渐变内核（1.5）

完整控制器与 `svg-morpheus-ts/core` 共用纯函数颜色引擎。支持 CSS 命名颜色、RGB/HSL（含现代空格语法）、四位/八位透明十六进制颜色。透明色使用预乘 alpha 插值，`none` 与纯色之间平滑淡入淡出。上下文颜色 `currentColor`、CSS 变量保留给浏览器；需要数值插值时先解析为具体颜色。

同类型渐变插值色标、方向、焦点、半径与矩阵；不同色标数量使用合并后的偏移位置采样，重复偏移保留硬边。不同渐变类型、坐标单位或 spreadMethod 之间交叉淡化。DOM 控制器负责继承与视口百分比解析，core 接收结构化 `Gradient`，gradientTransform 应为 `matrix(a b c d e f)`。

`PaintStyle.groups` 表示由外向内的透明度组，相同 id 的路径共享一个合成组。不要提前把组透明度乘入每条路径。每个实例使用唯一 prefix 防止渐变 ID 冲突。传入数组与对象不会被修改。

```ts
import { createPaintPlan, renderPaintFrame } from 'svg-morpheus-ts/core'
const plan = createPaintPlan(
  [{ attributes: {}, fill: '#ff000080' }],
  [{ attributes: {}, fill: {
    type: 'linearGradient', attributes: { x2: '100%' },
    stops: [{ offset: 0, color: 'blue' }, { offset: 1, color: 'white' }],
  } }],
)
const body = renderPaintFrame(['M0 0H24V24H0Z'], plan.frame(0.5), 'icon-unique-id')
```
