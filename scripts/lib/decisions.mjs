// The decision card format, a contract shared with arkimedes review-layers:
// a list item that starts with the chosen option in bold, then has the labels
// Alternatives:, Pros:, Cons:, Why: in that order (or Alternativas:, Pros:,
// Contras:, Por qué:), each with text. Labels inside backticks do not count.
// Anything less is not a card and renders as an ordinary list item.
const LABELS = [["Alternatives", "Alternativas"], ["Pros"], ["Cons", "Contras"], ["Why", "Por qué"]];
export const KEYS = ["alternatives", "pros", "cons", "why"];
const BOLD_START = /^\*\*(?=\S)([\s\S]*?\S)\*\*\s*/;
const LI = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(.*)$/;
const HEADING_OR_FENCE = /^\s{0,3}(#{1,6}\s|`{3,}|~{3,})/;

// Inline code spans replaced by same-length filler, so indexes still match the source.
const maskCode = s => s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, m => "\u0001".repeat(m.length));

export function parseDecision(text) {
  const t = text.trim();
  const b = t.match(BOLD_START);
  if (!b) return null;
  const masked = maskCode(t);
  const found = [];
  let pos = b[0].length;
  for (const variants of LABELS) {
    let best = null;
    for (const v of variants) {
      const re = new RegExp(`(^|[\\s.;,*])(${v.replace(/ /g, "\\s+")}):`, "g");
      re.lastIndex = Math.max(0, pos - 1);
      const m = re.exec(masked);
      if (m && (!best || m.index < best.index)) best = { index: m.index + m[1].length, end: m.index + m[0].length, label: m[2] };
    }
    if (!best) return null;
    found.push(best);
    pos = best.end;
  }
  if (t.slice(b[0].length, found[0].index).trim()) return null;
  const out = { choice: b[1] };
  for (let k = 0; k < found.length; k++) {
    const text = t.slice(found[k].end, k + 1 < found.length ? found[k + 1].index : t.length).trim();
    if (!text) return null;
    out[KEYS[k]] = { label: found[k].label.replace(/\s+/g, " "), text };
  }
  return out;
}

// 1-based [first, last] line ranges of the list items in `lines` that are cards.
// The page drops AI decisions that cite these lines (notes.mjs).
export function cardRanges(lines, inFence) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (inFence[i]) continue;
    const m = lines[i].match(LI);
    if (!m || !m[4].startsWith("**")) continue;
    const text = [m[4]];
    let j = i + 1;
    while (j < lines.length && lines[j].trim() && !inFence[j] && !LI.test(lines[j]) && !HEADING_OR_FENCE.test(lines[j])) {
      text.push(lines[j].trim());
      j++;
    }
    if (parseDecision(text.join("\n"))) out.push([i + 1, j]);
  }
  return out;
}
