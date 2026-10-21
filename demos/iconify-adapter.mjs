// Application-side example adapter. This is not an export of svg-morpheus-ts.
import { getIconData, iconToSVG, iconToHTML, replaceIDs } from "@iconify/utils";

export function iconifyToSVG(data) {
  const { attributes, body } = iconToSVG(data);
  return iconToHTML(replaceIDs(body), attributes);
}
export function registerIconifySet(controller, collection, names) {
  const resolved = names.map((name) => {
    const data = getIconData(collection, name);
    if (!data)
      throw Error(`Unknown Iconify icon: ${collection.prefix}:${name}`);
    return { name, svg: iconifyToSVG(data) };
  });
  for (const { name, svg } of resolved)
    controller.addIcon(`${collection.prefix}:${name}`, svg);
}
