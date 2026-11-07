import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDoc } from "../scripts/lib/doc.mjs";
import { checkNotes } from "../scripts/lib/notes.mjs";
import { cardRanges } from "../scripts/lib/decisions.mjs";

const src = "# D\n\n## Decisions\n\n- **Use X.** Alternatives: Y. Pros: fast. Cons: new. Why: tested.\n- Plain point\n";

test("card ranges cover the card's lines", () => {
  const doc = parseDoc(src, "d.md");
  assert.deepEqual(cardRanges(doc.lines, doc.inFence), [[5, 5]]);
});

test("an AI decision citing a card's lines is dropped", () => {
  const doc = parseDoc(src, "d.md");
  const raw = { source_hash: doc.hash, doc: {}, sections: [{ id: "s1", summary: "S", decisions: [
    { text: "Use X", lines: [5, 5] },
    { text: "Plain point", lines: [6, 6] },
  ] }] };
  const { notes, report } = checkNotes(raw, doc, cardRanges(doc.lines, doc.inFence));
  assert.deepEqual(notes.sections.s1.decisions.map(d => d.text), ["Plain point"]);
  assert.match(report.dropped[0], /shown as a card/);
});
