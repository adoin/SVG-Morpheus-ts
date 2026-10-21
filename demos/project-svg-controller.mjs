import { iconifyToSVG } from "./iconify-adapter.mjs";
import { getIconData } from "@iconify/utils";

export function mountProjectIcons(
  root,
  { createController, menuSVG, closeSVG, lucide },
) {
  const a = root.querySelector("#project-a"),
    b = root.querySelector("#project-b"),
    output = root.querySelector("#project-status");
  let controller,
    language = "zh",
    alive = true,
    generation = 0;
  const copy = {
    zh: {
      ready: "两份 SVG 已注册。点击 A 或 B 切换，也可以编辑源码后重新注册。",
      error: "无法注册 SVG：",
      first: "切换到 A",
      second: "切换到 B",
      files: "请选择两份 SVG 文件。",
      preview: "项目 SVG 变形预览",
      choice: "当前目标：",
    },
    en: {
      ready:
        "Both SVGs are registered. Switch to A or B, or edit the sources and register again.",
      error: "Cannot register SVG: ",
      first: "Switch to A",
      second: "Switch to B",
      files: "Choose two SVG files.",
      preview: "Project SVG morph preview",
      choice: "Current target: ",
    },
  };
  let message = "ready",
    detail = "";
  function status() {
    output.textContent = copy[language][message] + detail;
    output.dataset.state = message === "error" ? "error" : "ready";
  }
  function register() {
    if (!alive) return;
    generation++;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "project-preview";
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", copy[language].preview);
    let candidate;
    try {
      candidate = createController(svg, { duration: 600, rotation: "none" });
      candidate.addIcon("a", a.value);
      candidate.addIcon("b", b.value);
      candidate.set("a");
      controller?.destroy();
      root.querySelector("#project-preview").replaceWith(svg);
      controller = candidate;
      message = "ready";
      detail = "";
      status();
    } catch (error) {
      candidate?.destroy();
      message = "error";
      detail = error instanceof Error ? error.message : String(error);
      status();
    }
  }
  function useLocal() {
    a.value = menuSVG;
    b.value = closeSVG;
    register();
  }
  function useIconify() {
    a.value = iconifyToSVG(getIconData(lucide, "menu"));
    b.value = iconifyToSVG(getIconData(lucide, "x"));
    register();
  }
  for (const id of ["a", "b"])
    root.querySelector(`#project-show-${id}`).addEventListener("click", () => {
      if (!controller) return;
      controller.to(id);
      message = "choice";
      detail = id.toUpperCase();
      status();
    });
  root.querySelector("#project-register").addEventListener("click", register);
  root.querySelector("#project-local").addEventListener("click", useLocal);
  root.querySelector("#project-iconify").addEventListener("click", useIconify);
  root
    .querySelector("#project-files")
    .addEventListener("change", async (event) => {
      const ticket = ++generation;
      const files = [...event.target.files];
      if (files.length !== 2) {
        message = "files";
        detail = "";
        status();
        return;
      }
      try {
        const values = await Promise.all(files.map((file) => file.text()));
        if (!alive || ticket !== generation) return;
        [a.value, b.value] = values;
        register();
      } catch (error) {
        if (!alive || ticket !== generation) return;
        message = "error";
        detail = String(error);
        status();
      }
    });
  useLocal();
  return {
    setLanguage(value) {
      language = value;
      root
        .querySelector("#project-preview")
        .setAttribute("aria-label", copy[language].preview);
      root.querySelector("#project-show-a").textContent = copy[language].first;
      root.querySelector("#project-show-b").textContent = copy[language].second;
      status();
    },
    destroy() {
      alive = false;
      generation++;
      controller?.destroy();
    },
  };
}
