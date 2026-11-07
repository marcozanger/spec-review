// Renders a section body, folding the subsections of any heading marked with
// `<!-- fold -->` (see doc.mjs). Without a marker it is exactly renderBlocks.
import { fenceMap, foldMarkerAt } from "./doc.mjs";
import { renderBlocks, inline } from "./md.mjs";

const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;

// lines: the body under a heading of `level` (the heading line itself excluded).
export function renderFoldable(lines, level, labels) {
  const own = foldMarkerAt(lines, 0);
  const body = own === -1 ? lines : [...lines.slice(0, own), ...lines.slice(own + 1)];
  const inFence = fenceMap(body);
  const heads = [];
  body.forEach((l, i) => {
    if (inFence[i]) return;
    const m = l.match(HEADING);
    if (m && m[1].length > level) heads.push({ i, level: m[1].length, text: m[2] });
  });
  const anyMarker = own !== -1 || heads.some(h => foldMarkerAt(body, h.i + 1) !== -1);
  if (!anyMarker || !heads.length) return renderBlocks(body, labels);

  const childLevel = Math.min(...heads.map(h => h.level));
  const kids = heads.filter(h => h.level === childLevel);
  const out = [renderBlocks(body.slice(0, kids[0].i), labels)];
  kids.forEach((h, k) => {
    const end = k + 1 < kids.length ? kids[k + 1].i : body.length;
    const inner = renderFoldable(body.slice(h.i + 1, end), childLevel, labels);
    if (own !== -1) out.push(`<details class="fold"><summary>${inline(h.text)}</summary><div class="md">${inner}</div></details>`);
    else {
      const lv = Math.min(6, Math.max(3, childLevel));
      out.push(`<h${lv}>${inline(h.text)}</h${lv}>`, inner);
    }
  });
  return out.filter(Boolean).join("\n");
}
