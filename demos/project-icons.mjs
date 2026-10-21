import SVGMorpheus from "../src/index.ts";
import menuSVG from "./assets/project-menu.svg?raw";
import closeSVG from "./assets/project-close.svg?raw";
import lucide from "./assets/iconify-lucide.json";
import { mountProjectIcons } from "./project-svg-controller.mjs";

export function createProjectIcons() {
  return mountProjectIcons(document.querySelector("#project-svg"), {
    createController: (svg, options) => new SVGMorpheus(svg, options),
    menuSVG,
    closeSVG,
    lucide,
  });
}
