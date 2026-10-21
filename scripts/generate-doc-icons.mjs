// Keep the complete collection in the build tool, not the browser bundle.
import { createRequire } from "node:module";
import { getIconData } from "@iconify/utils";
import { writeFileSync } from "node:fs";
const { icons } = createRequire(import.meta.url)("@iconify-json/lucide");
const selected = Object.fromEntries(
  ["menu", "x", "search"].map((name) => {
    const data = getIconData(icons, name);
    if (!data) throw Error(`Missing Lucide icon: ${name}`);
    return [name, data];
  }),
);
writeFileSync(
  new URL("../demos/assets/iconify-lucide.json", import.meta.url),
  JSON.stringify(
    {
      prefix: "lucide",
      width: icons.width ?? 24,
      height: icons.height ?? 24,
      icons: selected,
    },
    null,
    2,
  ) + "\n",
);
