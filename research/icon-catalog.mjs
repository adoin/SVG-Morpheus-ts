// Small original fixtures on a common 24×24 grid. No external icon font or network request.
const circle = (x, y, r) =>
  `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const line = (d) => ({ d });
const solid = (d, fill = "currentColor") => ({ d, fill, stroke: "none" });
const icon = (id, zh, en, category, parts, defs = "") => ({
  id,
  zh,
  en,
  category,
  parts,
  defs,
});
const bell = "M5 17H19L17 14V9A5 5 0 0 0 7 9V14Z";
const eye = "M2 12Q6 5 12 5Q18 5 22 12Q18 19 12 19Q6 19 2 12Z";
const heart = "M12 21L3.5 12.5C-1 7 6 0 12 6C18 0 25 7 20.5 12.5Z";
const bookmark = "M6 3H18V21L12 17L6 21Z";
const star =
  "M12 2L15 8.5L22 9.5L17 14.5L18.2 22L12 18.5L5.8 22L7 14.5L2 9.5L9 8.5Z";
export const iconCatalog = [
  icon("menu", "菜单", "Menu", "interface", [
    line("M4 6H20"),
    line("M4 12H20"),
    line("M4 18H20"),
  ]),
  icon("close", "关闭", "Close", "interface", [
    line("M5 5L19 19"),
    line("M19 5L5 19"),
  ]),
  icon("plus", "添加", "Add", "interface", [
    line("M4 12H20"),
    line("M12 4V20"),
  ]),
  icon("minus", "减少", "Minus", "interface", [line("M4 12H20")]),
  icon("check", "完成", "Check", "interface", [line("M4 12L10 18L20 5")]),
  icon("chevron-right", "向右展开", "Expand right", "interface", [
    line("M8 4L16 12L8 20"),
  ]),
  icon("chevron-down", "向下展开", "Expand down", "interface", [
    line("M4 8L12 16L20 8"),
  ]),
  icon("arrow-left", "左箭头", "Arrow left", "interface", [
    line("M3 12H21"),
    line("M10 5L3 12L10 19"),
  ]),
  icon("arrow-right", "右箭头", "Arrow right", "interface", [
    line("M3 12H21"),
    line("M14 5L21 12L14 19"),
  ]),
  icon("search", "搜索", "Search", "interface", [
    line(circle(10, 10, 6)),
    line("M15 15L21 21"),
  ]),
  icon("zoom", "放大", "Zoom in", "interface", [
    line(circle(10, 10, 6)),
    line("M15 15L21 21"),
    line("M7 10H13"),
    line("M10 7V13"),
  ]),
  icon("grid", "网格", "Grid", "interface", [
    line("M3 3H9V9H3Z"),
    line("M15 3H21V9H15Z"),
    line("M3 15H9V21H3Z"),
    line("M15 15H21V21H15Z"),
  ]),
  icon("list", "列表", "List", "interface", [
    line("M3 6H4"),
    line("M8 6H21"),
    line("M3 12H4"),
    line("M8 12H21"),
    line("M3 18H4"),
    line("M8 18H21"),
  ]),
  icon("play", "播放", "Play", "media", [solid("M6 3L21 12L6 21Z")]),
  icon("pause", "暂停", "Pause", "media", [
    solid("M5 3H10V21H5Z"),
    solid("M14 3H19V21H14Z"),
  ]),
  icon("stop", "停止", "Stop", "media", [solid("M4 4H20V20H4Z")]),
  icon("record", "录制", "Record", "media", [
    solid(circle(12, 12, 9), "#ef5b68"),
  ]),
  icon("volume", "有声", "Sound on", "media", [
    line("M3 9H7L12 4V20L7 15H3Z"),
    line("M16 8Q20 12 16 16"),
    line("M19 4Q26 12 19 20"),
  ]),
  icon("mute", "静音", "Mute", "media", [
    line("M3 9H7L12 4V20L7 15H3Z"),
    line("M16 9L22 15"),
    line("M22 9L16 15"),
  ]),
  icon("mic", "麦克风", "Microphone", "media", [
    line("M9 4A3 3 0 0 1 15 4V12A3 3 0 0 1 9 12Z"),
    line("M5 10V12A7 7 0 0 0 19 12V10"),
    line("M12 19V23"),
    line("M8 23H16"),
  ]),
  icon("mic-off", "关闭麦克风", "Microphone off", "media", [
    line("M9 4A3 3 0 0 1 15 4V12A3 3 0 0 1 9 12Z"),
    line("M5 10V12A7 7 0 0 0 19 12V10"),
    line("M12 19V23"),
    line("M8 23H16"),
    line("M2 2L22 22"),
  ]),
  icon("bell", "通知", "Notifications", "state", [
    line(bell),
    line("M10 21H14"),
  ]),
  icon("bell-off", "关闭通知", "Notifications off", "state", [
    line(bell),
    line("M10 21H14"),
    line("M3 3L21 21"),
  ]),
  icon("lock", "锁定", "Lock", "state", [
    line("M5 11H19V22H5Z"),
    line("M8 11V6A4 4 0 0 1 16 6V11"),
    line("M12 15V18"),
  ]),
  icon("unlock", "解锁", "Unlock", "state", [
    line("M5 11H19V22H5Z"),
    line("M8 11V6A4 4 0 0 1 16 6"),
    line("M12 15V18"),
  ]),
  icon("eye", "可见", "Visible", "state", [line(eye), line(circle(12, 12, 3))]),
  icon("eye-off", "隐藏", "Hidden", "state", [
    line(eye),
    line(circle(12, 12, 3)),
    line("M2 2L22 22"),
  ]),
  icon("heart", "喜欢", "Like", "state", [line(heart)]),
  icon("heart-fill", "已喜欢", "Liked", "state", [solid(heart, "#ee6587")]),
  icon("bookmark", "收藏", "Bookmark", "state", [line(bookmark)]),
  icon("bookmark-fill", "已收藏", "Bookmarked", "state", [
    solid(bookmark, "#547af4"),
  ]),
  icon("sun", "日间", "Sun", "state", [
    line(circle(12, 12, 4)),
    line("M12 1V4"),
    line("M12 20V23"),
    line("M1 12H4"),
    line("M20 12H23"),
    line("M4 4L6 6"),
    line("M18 18L20 20"),
    line("M4 20L6 18"),
    line("M18 6L20 4"),
  ]),
  icon("moon", "夜间", "Moon", "state", [
    line("M21 14A9 9 0 0 1 10 3A9 9 0 1 0 21 14Z"),
  ]),
  icon("square", "方形", "Square", "shape", [line("M3 3H21V21H3Z")]),
  icon("circle", "圆形", "Circle", "shape", [line(circle(12, 12, 9))]),
  icon("star", "星形", "Star", "shape", [line(star)]),
  icon("star-fill", "实心星形", "Filled star", "shape", [
    solid(star, "#e9aa2f"),
  ]),
  icon("donut", "带孔圆环", "Ring with hole", "shape", [
    solid(
      "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M8 12a4 4 0 1 1 8 0a4 4 0 1 1-8 0",
    ),
  ]),
  icon("warm", "暖色组合", "Warm colors", "paint", [
    solid("M3 3H14V14H3Z", "#ee775b"),
    solid(circle(16, 16, 5), "#667ce8"),
  ]),
  icon("cool", "冷色组合", "Cool colors", "paint", [
    solid("M3 3H14V14H3Z", "#34b69a"),
    solid(circle(16, 16, 5), "#edb844"),
  ]),
  icon("alpha", "多色透明", "Color and alpha", "paint", [
    { ...solid(circle(9, 12, 7), "#fd6386"), opacity: 0.65 },
    { ...solid(circle(15, 12, 7), "#487ee9"), opacity: 0.65 },
  ]),
  icon(
    "linear",
    "线性渐变",
    "Linear gradient",
    "paint",
    [solid(circle(12, 12, 9), "url(#PAINT)")],
    '<linearGradient id="PAINT"><stop stop-color="#5e7cfc"/><stop offset="1" stop-color="#fa7898"/></linearGradient>',
  ),
  icon(
    "radial",
    "径向渐变",
    "Radial gradient",
    "paint",
    [solid(circle(12, 12, 9), "url(#PAINT)")],
    '<radialGradient id="PAINT"><stop stop-color="#ffe9a8"/><stop offset="1" stop-color="#ee796a"/></radialGradient>',
  ),
];
export const galleryPairs = [
  ["menu", "close"],
  ["plus", "minus"],
  ["chevron-right", "chevron-down"],
  ["play", "pause"],
  ["volume", "mute"],
  ["mic", "mic-off"],
  ["bell", "bell-off"],
  ["lock", "unlock"],
  ["eye", "eye-off"],
  ["heart", "heart-fill"],
  ["bookmark", "bookmark-fill"],
  ["search", "zoom"],
  ["grid", "list"],
  ["square", "circle"],
  ["circle", "donut"],
  ["warm", "cool"],
  ["linear", "radial"],
];
export function iconMarkup(icon, prefix) {
  const id = `${prefix}-${icon.id}-paint`;
  const defs = icon.defs
    ? `<defs>${icon.defs.replaceAll("PAINT", id)}</defs>`
    : "";
  return (
    defs +
    icon.parts
      .map(
        (part) =>
          `<path d="${part.d}" fill="${(part.fill ?? "none").replaceAll("PAINT", id)}" stroke="${part.stroke ?? "currentColor"}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${part.opacity === undefined ? "" : ` opacity="${part.opacity}"`}/>`,
      )
      .join("")
  );
}
export const galleryGroups = (prefix) =>
  iconCatalog
    .map((icon) => `<g id="${icon.id}">${iconMarkup(icon, prefix)}</g>`)
    .join("");
