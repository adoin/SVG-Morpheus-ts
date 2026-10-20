import SVGMorpheus from "../src/index.ts";
import {
  iconCatalog,
  iconMarkup,
  galleryGroups,
  galleryPairs,
} from "../research/icon-catalog.mjs";

export function createIconGallery() {
  const root = document.querySelector("#icon-gallery"),
    svg = root.querySelector("#gallery-preview"),
    grid = root.querySelector(".gallery-icons"),
    pairs = root.querySelector(".gallery-pairs");
  svg.innerHTML = galleryGroups("gallery-preview");
  const controller = new SVGMorpheus(svg, {
    iconId: "menu",
    duration: 600,
    rotation: "none",
  });
  let language = "zh",
    selected = "menu",
    timer,
    mode = "",
    stressCount = 0;
  const name = (icon) => icon[language === "zh" ? "zh" : "en"];
  const labels = {
    zh: {
      random: "随机一个",
      tour: "自动轮播",
      stop: "停止轮播",
      stress: "快速切换 20 次",
      running: "快速切换中…",
      all: "全部",
      interface: "界面",
      media: "媒体",
      state: "状态",
      shape: "轮廓",
      paint: "颜色",
      preview: "任意图标变形预览",
      group: "选择目标图标",
      pairs: "常见状态配对",
      filter: "图标分类",
    },
    en: {
      random: "Random icon",
      tour: "Auto tour",
      stop: "Stop tour",
      stress: "20 rapid switches",
      running: "Rapid switching…",
      all: "All",
      interface: "Interface",
      media: "Media",
      state: "State",
      shape: "Shapes",
      paint: "Paint",
      preview: "Free icon morph preview",
      group: "Choose target icon",
      pairs: "Common state pairs",
      filter: "Icon category",
    },
  };
  function status() {
    root.querySelector("#gallery-current").textContent = name(
      iconCatalog.find((i) => i.id === selected),
    );
    root.querySelector("#gallery-count").textContent =
      language === "zh"
        ? `${iconCatalog.length} 个图标 · 可跨分类切换`
        : `${iconCatalog.length} icons · Switch across categories`;
    root.querySelector("#gallery-tour").textContent =
      labels[language][mode === "tour" ? "stop" : "tour"];
    root.querySelector("#gallery-stress").textContent =
      labels[language][mode === "stress" ? "running" : "stress"];
    root
      .querySelector("#gallery-tour")
      .setAttribute("aria-pressed", String(mode === "tour"));
    root
      .querySelector("#gallery-stress")
      .setAttribute("aria-pressed", String(mode === "stress"));
    for (const b of grid.querySelectorAll("button"))
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.galleryIcon === selected),
      );
  }
  function stop() {
    clearTimeout(timer);
    mode = "";
    status();
  }
  function choose(id, manual = true) {
    if (manual) stop();
    controller.to(id, {
      duration: Number(root.querySelector("#gallery-duration").value),
      easing: root.querySelector("#gallery-motion").value,
    });
    selected = id;
    status();
  }
  function random() {
    const options = iconCatalog.filter((i) => i.id !== selected);
    return options[Math.floor(Math.random() * options.length)].id;
  }
  function renderButtons() {
    const category = root.querySelector("#gallery-filter").value;
    grid.innerHTML = iconCatalog
      .filter((i) => category === "all" || i.category === category)
      .map(
        (i) =>
          `<button type="button" data-gallery-icon="${i.id}" aria-pressed="${i.id === selected}"><svg viewBox="0 0 24 24" aria-hidden="true">${iconMarkup(i, "gallery-thumb")}</svg><span>${name(i)}</span></button>`,
      )
      .join("");
    for (const button of grid.querySelectorAll("button"))
      button.addEventListener("click", () =>
        choose(button.dataset.galleryIcon),
      );
    pairs.innerHTML = galleryPairs
      .map(
        ([a, b]) =>
          `<button type="button" data-gallery-pair="${a},${b}">${name(iconCatalog.find((i) => i.id === a))} ↔ ${name(iconCatalog.find((i) => i.id === b))}</button>`,
      )
      .join("");
    for (const button of pairs.querySelectorAll("button"))
      button.addEventListener("click", () => {
        const [a, b] = button.dataset.galleryPair.split(",");
        choose(selected === a ? b : a);
      });
    status();
  }
  root
    .querySelector("#gallery-filter")
    .addEventListener("change", renderButtons);
  root
    .querySelector("#gallery-random")
    .addEventListener("click", () => choose(random()));
  root.querySelector("#gallery-tour").addEventListener("click", () => {
    if (mode === "tour") {
      stop();
      return;
    }
    stop();
    mode = "tour";
    const advance = () => {
      choose(random(), false);
      timer = setTimeout(
        advance,
        Math.max(
          800,
          Number(root.querySelector("#gallery-duration").value) + 250,
        ),
      );
    };
    advance();
  });
  root.querySelector("#gallery-stress").addEventListener("click", () => {
    if (mode === "stress") {
      stop();
      return;
    }
    stop();
    mode = "stress";
    stressCount = 0;
    const advance = () => {
      choose(random(), false);
      stressCount++;
      if (stressCount < 20) timer = setTimeout(advance, 80);
      else {
        mode = "";
        status();
      }
    };
    advance();
  });
  function setLanguage(value) {
    language = value;
    for (const [id, key] of [
      ["gallery-random", "random"],
      ["gallery-filter", "filter"],
    ])
      root
        .querySelector(`#${id}`)
        .setAttribute("aria-label", labels[language][key]);
    root.querySelector("#gallery-random").textContent = labels[language].random;
    svg.setAttribute("aria-label", labels[language].preview);
    grid.setAttribute("aria-label", labels[language].group);
    pairs.setAttribute("aria-label", labels[language].pairs);
    for (const o of root.querySelector("#gallery-filter").options)
      o.textContent = labels[language][o.value];
    renderButtons();
  }
  setLanguage("zh");
  return {
    setLanguage,
    pause: stop,
    destroy() {
      clearTimeout(timer);
      controller.destroy();
    },
  };
}
