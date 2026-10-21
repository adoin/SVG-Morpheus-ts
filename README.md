# SVG Morpheus TS

Smooth, interruptible SVG icon morphing for browsers and custom renderers.

**2.0.0** · TypeScript · ESM / CommonJS / UMD · No runtime dependencies · MIT

[Documentation](https://adoin.github.io/SVG-Morpheus-ts/?lang=en#quickstart) · [43-icon playground](https://adoin.github.io/SVG-Morpheus-ts/?lang=en#icon-gallery) · [Changelog](./CHANGELOG.md) · [中文](./README.zh.md)

Morph geometry, color and gradients together. Select another target during an animation to continue from the displayed frame. Native stroked contours draw or retract along their own paths; filled artwork preserves compound contours and holes.

## Install

```sh
npm install svg-morpheus-ts@^2.0.0
```

## Browser controller

Each direct child `g` represents an icon. Give each group a unique id and use a common coordinate system.

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
// On component/application cleanup: icons.destroy()
```

The constructor accepts an SVG element, selector, or loaded SVG `object`. Construct after mounting; module imports themselves are safe in Node/SSR.

| Option          | Default         | Behavior                                                                                                 |
| --------------- | --------------- | -------------------------------------------------------------------------------------------------------- |
| `iconId`        | Last group      | Initially displayed icon.                                                                                |
| `duration`      | `750`           | Milliseconds; `0` commits immediately.                                                                   |
| `easing`        | `'quad-in-out'` | Registered easing name.                                                                                  |
| `rotation`      | `'clock'`       | Extra spin: `clock`, `counterclock`, `none`, `random`. `none` still permits an intrinsic geometric turn. |
| `reducedMotion` | `'user'`        | Follow the OS; `always` skips animation, `never` keeps it enabled.                                       |
| `algorithm`     | `'matched'`     | Matched geometry; `'legacy'` remains a compatibility option.                                             |

| Method                        | Behavior                                                      |
| ----------------------------- | ------------------------------------------------------------- |
| `to(id, options?, callback?)` | Animate; per-call duration/easing/rotation override defaults. |
| `set(id)`                     | Switch immediately.                                           |
| `cancel(finish = false)`      | Stop at the displayed frame, or finish to the target.         |
| `addIcon(id, svg)`            | Add/replace from an SVG string or element.                    |
| `removeIcon(id)`              | Remove an icon; return whether it existed.                    |
| `getIconIds()`                | Return registered ids.                                        |
| `isAnimating`                 | Return whether an animation frame is pending.                 |
| `destroy()`                   | Cancel work and detach listeners; safe to repeat.             |

### Spring motion

`easing` accepts a name. Register a spring function explicitly:

```ts
import { easings, springProgress } from "svg-morpheus-ts";

easings["spring-snappy"] = (t) => springProgress(t, "snappy");
icons.to("close", { duration: 600, easing: "spring-snappy" });
```

Presets: `smooth`, `snappy`, `bouncy`. Reduced motion is respected by default.

## Connect existing project SVGs

Create a stable host such as `<svg id="project-icon" viewBox="0 0 24 24"></svg>`. Keep that element mounted while switching targets.

For Vite, import the existing file **as text** with `?raw`:

```ts
import SVGMorpheus from "svg-morpheus-ts";
import menu from "./assets/menu.svg?raw";
import close from "./assets/close.svg?raw";

const morph = new SVGMorpheus("#project-icon", { rotation: "none" });
morph.addIcon("menu", menu);
morph.addIcon("close", close);
morph.set("menu");
// When application state changes:
morph.to("close");
// On cleanup: morph.destroy()
```

For URL-based assets, `fetch(url)`, check `response.ok`, and pass `await response.text()` to `addIcon`. A URL string, imported Vue/React component, `img`, CSS mask or icon font is not SVG path data. Existing inline SVG elements work too: `morph.addIcon('logo', document.querySelector('#source-logo'))`.

Keep each file's `viewBox`, paint attributes and definitions. Instantiate after mounting and destroy on unmount. See the [complete URL-loading example and editable local-file demo](https://adoin.github.io/SVG-Morpheus-ts/?lang=en#project-svg).

## Connect Iconify data

Iconify is optional; these packages belong to your application, not the morphing library's runtime dependencies.

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
// On cleanup: morph.destroy()
```

`getIconData` resolves collection defaults and aliases; `iconToSVG` applies icon dimensions, rotation and flips. If you already have an `IconifyIcon` object, pass it directly to `iconToSVG` instead of installing the collection. JSON from the Iconify API can be processed in the same way.

Registered ids are your application's mapping: the library does **not** automatically fetch `prefix:name`. Keep imports/subset extraction in your build pipeline; the docs demo bundles three Lucide icons, not a complete collection. Icons using unsupported masks or filters cannot morph directly. [Integration guide](https://adoin.github.io/SVG-Morpheus-ts/?lang=en#iconify) · [Official Iconify conversion guide](https://iconify.design/docs/libraries/utils/examples/export-svg-from-icon-set.html).

## DOM-free core

```ts
import { createMorphPlan, springProgress } from "svg-morpheus-ts/core";

const plan = createMorphPlan(
  [{ d: "M4 12H20", draw: true }],
  [{ d: "M4 12H20" }, { d: "M12 4V20", draw: true }],
);
const paths: string[] = plan.frame(springProgress(0.5, "snappy"));
```

This entry never accesses `window` or `document`. `MorphPath` accepts `d` and optional `closed`, `allowReverse`, `draw`. Enable `draw` for stroked artwork to reveal/retract unmatched contours along their arc length; leave it off for fills. Matched contours still interpolate geometry. The DOM controller detects stroke-only artwork automatically.

Use `createPaintPlan()` and `renderPaintFrame()` for paint, with an instance-unique render prefix to isolate SVG ids. Color parsing/interpolation and structured linear/radial gradient types are exported too. See the [core guide](https://adoin.github.io/SVG-Morpheus-ts/?lang=en#core).

## Support and limits

- Path, line, polyline, polygon, rect, circle, ellipse; nested groups and transforms.
- Multicolor, alpha, compound fills and holes, shared opacity-group compositing.
- Compatible gradient stops/geometry interpolate continuously; incompatible gradients use isolated crossfades.
- Interrupted geometry and paint continue from the displayed frame.

The controller does not support masks, clipping, filters, patterns or nested SVG viewports. Resolve `currentColor` and CSS variables before numeric interpolation in a DOM-free renderer. Geometric matching does not guarantee semantic or topology-preserving transitions for arbitrary unrelated artwork.

## Research is separate

[Shared-boundary experiments](https://adoin.github.io/SVG-Morpheus-ts/?lang=en#research) investigate fixed common regions. The filled-eye drawing experiment uses **authored centerlines**, not automatic inference from arbitrary filled SVG. Research modules are not exported or shipped in npm. See [research/README.md](./research/README.md).

## Development

```sh
pnpm install --frozen-lockfile
pnpm test          # geometry, paint, lifecycle, icon matrix, Node-only types
pnpm build:demo    # library and documentation / playground
pnpm demo         # local documentation server
```

The playground has 43 original fixtures and 17 state pairs. Tests cover 1,806 ordered icon pairs, intermediate frames, rapid retargeting and reduced motion. Automated checks complement visual review.

MIT. Based on [Alex Kaul's SVG-Morpheus](https://github.com/alexk111/SVG-Morpheus), extended in TypeScript. Separate Carbon eye research fixtures are © IBM, Apache-2.0; see [their license](./research/CARBON-LICENSE.txt).
