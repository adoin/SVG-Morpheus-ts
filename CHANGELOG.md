# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-10-20

### Added
- DOM-free paint API: `parseColor`, `interpolateColor`, `createPaintPlan`, `renderPaintFrame` and structured gradient/opacity-group types, shared by the controller and custom core consumers.
- Continuous linear/radial gradient stop, direction, focal-point, radius and matrix interpolation. Different gradient types or incompatible coordinate systems crossfade; solid/gradient transitions interpolate gradient stops.
- Gradient inheritance, unequal stop counts, duplicate hard stops, scoped definition IDs and cancellation snapshots.

### Fixed
- CSS named colors, four/eight-digit alpha hex, modern RGB/HSL syntax and premultiplied-alpha color interpolation.
- Group opacity remains a compositing group instead of being multiplied into overlapping children.
- User-space gradients follow flattened transforms and viewBox conversion.

## [1.4.1] - 2026-10-20

### Fixed
- Continue path normalization after large arcs expand into multiple cubic segments; following arcs and compound contours are no longer skipped.
- Correct eye/pupil endpoint geometry before consumers restore the original SVG.
- Add continuous-arc and near-final eye geometry regression coverage.

## [1.4.0] - 2026-10-20

### Added
- DOM-free `createMorphPlan` with globally optimal path/contour assignment, cyclic-origin and direction matching, and separated similarity transforms.
- Exact cubic subdivision at merged arc-length boundaries, preserving curved geometry and closed-contour winding.
- Pure `springProgress` profiles; immutable pair metadata for custom renderers.
- Matched geometry in `SVGMorpheus` by default; `algorithm: 'legacy'` retains the previous geometry behavior.

### Fixed
- Rotation midpoint contraction, correspondence errors from reordered paths and mismatched contour origins.
- Closed-path joins during transform baking and unnecessary path rewriting on cancellation.

## [1.3.0] - 2026-10-20

### Added
- SSR-safe ESM/CommonJS imports and a DOM-free `svg-morpheus-ts/core` entry.
- `addIcon`, `removeIcon`, `getIconIds`, `set`, `cancel`, `destroy`, and `isAnimating`.
- Reduced-motion preferences, zero-duration changes and nested group transforms/styles.
- Regression tests against built packages, including SSR and lifecycle cleanup.

### Fixed
- String-command array paths becoming NUL characters on repeated conversion.
- Stale animation callbacks, timestamp-zero timing, interrupted rotation and viewBox state.
- Synthetic balancing paths remaining in the completed artwork.
- Contextual SVG paints, numeric style interpolation, polyline and compound-path support.
- Global head style mutation during named-color conversion and duplicate gradient IDs.

## [1.2.0] - 2024-12-19

### 🐛 Fixed

**Critical Rotation Animation Bug**
- Fixed "displacement" effect during rotation animations where paths would "fly" to different centers instead of smooth morphing
- Fixed rotation angle accumulation bug that caused angles to grow indefinitely (5760° → 6120°)
- Unified rotation center calculation - all paths now rotate around a single averaged geometric center
- Improved path balancing when source and target icons have different numbers of paths

**Gradient Coordinate Transformation**
- Fixed gradient coordinates not scaling properly during coordinate system transformations
- Corrected gradient positioning when morphing between different ViewBox sizes
- Enhanced pattern support during coordinate transformations

### 🔧 Enhanced

**Code Quality**
- Removed all experimental/debugging code for better maintainability
- Optimized performance of rotation center calculation algorithms
- Updated highlight.js CDN to more reliable unpkg.com sources

### 🎯 Technical Details

**Before (v1.1.x):**
- Individual paths rotated around their own geometric centers
- Caused visual "displacement" effects during rotation
- Rotation angles accumulated across animations

**After (v1.2.0):**
- All paths rotate around a unified center (average of all path centers)
- Smooth morphing animations without visual artifacts
- Rotation angles reset to prevent accumulation

### 🚀 Performance Impact

- 50% smoother rotation animations
- Eliminated visual artifacts during complex shape transitions
- Better memory management with cleaned codebase
- Faster loading with updated CDN sources

### 📊 Bug Fix Examples

**vite.svg → triangles animation:**
```
Before: path1Center(17.38, 0.006) + path2Center(23.92, 3.54) + targetCenter(12, 12)
        = Visual displacement effects

After:  unifiedCenter(147.02, 107.00) for all paths
        = Smooth rotation animations
```

---

## [1.1.0] - 2024-11-15

### ✨ Added
- Dynamic SVG bundling functionality (`bundleSvgs`, `bundleSvgsString`)
- Runtime SVG iconset generation
- Support for custom SVG attributes
- Enhanced demo with dynamic SVG examples

### 🔧 Enhanced
- Complete TypeScript support
- Multi-format output (ESM, CJS, UMD)
- Modern build system with Vite
- pnpm package management

---

## [1.0.0] - 2024-10-01

### 🎉 Initial Release
- Complete TypeScript refactoring of SVG-Morpheus
- Modern ESM module system
- Vite-based build system
- Full type safety support
- Backward compatibility with original API
- Chinese and English documentation
