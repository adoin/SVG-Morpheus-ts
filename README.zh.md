# SVG Morpheus TS

可中断、可连续切换的 SVG 图标变形库，支持浏览器与自定义渲染器。

**2.0.0** · TypeScript · ESM / CommonJS / UMD · 无运行时依赖 · MIT

[使用文档](https://adoin.github.io/SVG-Morpheus-ts/#quickstart) · [43 个图标自由切换](https://adoin.github.io/SVG-Morpheus-ts/#icon-gallery) · [更新日志](./CHANGELOG.md) · [English](./README.md)

同时处理几何、颜色与渐变。在动画中途改变目标，控制器从当前画面继续过渡。原生描边可以沿路径逐段画出或收回；填充图形保留复合轮廓和孔洞。

## 安装

```sh
npm install svg-morpheus-ts@^2.0.0
```

## 浏览器控制器

每个图标放在 SVG 的直接子级 `g` 中，使用唯一 id；同组图标使用相同坐标系。

```html
<svg
  id="icons"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <g id="menu"><path d="M4 6H20M4 12H20M4 18H20" /></g>
  <g id="close"><path d="M6 6L18 18M18 6L6 18" /></g>
</svg>
```

```ts
import SVGMorpheus from "svg-morpheus-ts";

const icons = new SVGMorpheus("#icons", {
  iconId: "menu",
  duration: 600,
  rotation: "none",
});
icons.to("close");
// 在组件或应用销毁时清理：icons.destroy()
```

构造器接受 SVG 元素、CSS 选择器，或已加载 SVG 的 `object`。实例化应在 DOM 挂载后执行；模块导入本身支持 Node/SSR。

| 配置            | 默认值          | 行为                                                                                     |
| --------------- | --------------- | ---------------------------------------------------------------------------------------- |
| `iconId`        | 最后一个分组    | 初始显示的图标。                                                                         |
| `duration`      | `750`           | 毫秒；`0` 立即完成。                                                                     |
| `easing`        | `'quad-in-out'` | 已注册的缓动名称。                                                                       |
| `rotation`      | `'clock'`       | 额外旋转：`clock`、`counterclock`、`none`、`random`。`none` 不禁止几何匹配推断出的转向。 |
| `reducedMotion` | `'user'`        | 遵循系统；`always` 跳过动画，`never` 始终播放。                                          |
| `algorithm`     | `'matched'`     | 几何匹配；`'legacy'` 保留为兼容选项。                                                    |

| 方法                          | 行为                                             |
| ----------------------------- | ------------------------------------------------ |
| `to(id, options?, callback?)` | 动画切换；单次时长、缓动、额外旋转覆盖默认配置。 |
| `set(id)`                     | 立即切换。                                       |
| `cancel(finish = false)`      | 停在当前画面，或完成到目标。                     |
| `addIcon(id, svg)`            | 从 SVG 字符串或元素添加、替换图标。              |
| `removeIcon(id)`              | 删除图标，返回是否存在该 id。                    |
| `getIconIds()`                | 返回已注册图标 id。                              |
| `isAnimating`                 | 返回是否有待执行动画帧。                         |
| `destroy()`                   | 取消动画并移除监听，可重复调用。                 |

### 弹簧效果

`easing` 接受名称；弹簧函数需要先注册：

```ts
import { easings, springProgress } from "svg-morpheus-ts";

easings["spring-snappy"] = (t) => springProgress(t, "snappy");
icons.to("close", { duration: 600, easing: "spring-snappy" });
```

支持 `smooth`、`snappy`、`bouncy`。默认遵循系统减少动态效果设置。

## 接入项目已有的 SVG

准备固定容器，例如 `<svg id="project-icon" viewBox="0 0 24 24"></svg>`，切换期间始终保留同一个元素。

Vite 项目使用 `?raw` 把已有文件作为 **SVG 文本**导入：

```ts
import SVGMorpheus from "svg-morpheus-ts";
import menu from "./assets/menu.svg?raw";
import close from "./assets/close.svg?raw";

const morph = new SVGMorpheus("#project-icon", { rotation: "none" });
morph.addIcon("menu", menu);
morph.addIcon("close", close);
morph.set("menu");
// 项目状态变化时：
morph.to("close");
// 卸载时：morph.destroy()
```

通过 URL 加载时，先 `fetch(url)` 并检查 `response.ok`，再把 `await response.text()` 交给 `addIcon`。URL 字符串、Vue/React 组件、`img`、CSS mask 和字体图标本身都不是 SVG 路径数据。已有内联 SVG 元素也可直接注册：`morph.addIcon('logo', document.querySelector('#source-logo'))`。

保留文件中的 `viewBox`、绘制属性及定义；挂载后创建实例，卸载时销毁。参见[完整 URL 加载代码与本地文件试用区](https://adoin.github.io/SVG-Morpheus-ts/#project-svg)。

## 接入 Iconify 数据

Iconify 是可选接入；以下依赖属于使用方项目，不会成为变形库的运行时依赖。

```sh
npm install @iconify/utils @iconify-json/lucide
```

```ts
import SVGMorpheus from "svg-morpheus-ts";
import { icons } from "@iconify-json/lucide";
import { getIconData, iconToSVG, iconToHTML, replaceIDs } from "@iconify/utils";

const morph = new SVGMorpheus("#project-icon", { rotation: "none" });
for (const name of ["menu", "x"]) {
  const data = getIconData(icons, name);
  if (!data) throw new Error(`Unknown icon: ${name}`);
  const { body, attributes } = iconToSVG(data);
  morph.addIcon(`lucide:${name}`, iconToHTML(replaceIDs(body), attributes));
}
morph.set("lucide:menu");
morph.to("lucide:x");
// 卸载时：morph.destroy()
```

`getIconData` 解析集合默认值与别名，`iconToSVG` 处理图标尺寸、旋转及翻转。如果项目已有 `IconifyIcon` 对象，直接交给 `iconToSVG`，不需要安装集合包；Iconify API 返回的集合 JSON 也能按相同方式处理。

注册 id 是你项目的映射，工具**不会自动根据 `prefix:name` 联网取图**。集合导入与按需提取由构建工具负责；本站示例只打包三枚 Lucide 图标，不包含整个集合。带有不支持的蒙版或滤镜的图标不能直接变形。[接入指南](https://adoin.github.io/SVG-Morpheus-ts/#iconify) · [Iconify 官方转换示例](https://iconify.design/docs/libraries/utils/examples/export-svg-from-icon-set.html)。

## 无 DOM 的 core

```ts
import { createMorphPlan, springProgress } from "svg-morpheus-ts/core";

const plan = createMorphPlan(
  [{ d: "M4 12H20", draw: true }],
  [{ d: "M4 12H20" }, { d: "M12 4V20", draw: true }],
);
const paths: string[] = plan.frame(springProgress(0.5, "snappy"));
```

此入口不访问 `window` 或 `document`。`MorphPath` 提供 `d` 以及可选的 `closed`、`allowReverse`、`draw`。描边路径可用 `draw` 让未配对轮廓沿弧长画出/收回，填充路径不要开启；已有对应轮廓仍采用几何插值。浏览器控制器自动检测纯描边。

颜色与渐变使用 `createPaintPlan()`、`renderPaintFrame()`；渲染时为每个实例提供唯一前缀，隔离 SVG id。core 同时导出颜色解析、插值和结构化渐变类型。详见 [core 文档](https://adoin.github.io/SVG-Morpheus-ts/#core)。

## 支持范围与限制

- path、line、polyline、polygon、rect、circle、ellipse，嵌套分组与变换。
- 多色、透明度、复合填充轮廓、孔洞与共享透明度组合成。
- 兼容渐变的色标与几何连续插值；不兼容渐变使用隔离交叉过渡。
- 中断后从当前几何与绘制结果继续。

控制器不支持蒙版、裁切、滤镜、图案和嵌套 SVG 视口。无 DOM 渲染器做数值插值前，应自行解析 CSS 变量与 `currentColor`。几何匹配不能保证任意不相关图标都具备语义正确、拓扑不变的过渡。

## 研究实验单独提供

[共边研究页](https://adoin.github.io/SVG-Morpheus-ts/#research) 探索共同区域固定等方案。填充眼睛的沿线收回实验使用**人工中心线**，尚不能从任意填充 SVG 自动还原绘制意图。研究模块未从 npm 入口导出，也不包含在发布包中。详见 [research/README.md](./research/README.md)。

## 开发

```sh
pnpm install --frozen-lockfile
pnpm test          # 几何、绘制、生命周期、图标矩阵及 Node 类型检查
pnpm build:demo    # 构建库、文档与试验场
pnpm demo         # 启动本地文档
```

试验场提供 43 个自有简化图标和 17 组状态配对。测试覆盖 1,806 个有序组合、中间帧、连续中断和减少动态效果；自动检查不能替代视觉验收。

MIT。基于 [Alex Kaul 的 SVG-Morpheus](https://github.com/alexk111/SVG-Morpheus) 扩展 TypeScript 实现。独立研究中的 Carbon 眼睛图标 © IBM，Apache-2.0，见[对应许可证](./research/CARBON-LICENSE.txt)。
