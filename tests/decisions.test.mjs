import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmp, render, count } from "./helpers.mjs";
import { parseDecision } from "../scripts/lib/decisions.mjs";

test("a full decision parses into its parts", () => {
  assert.deepEqual(parseDecision("**Use X.** Alternatives: Y; Z. Pros: fast. Cons: new code. Why: tested it."), {
    choice: "Use X.",
    alternatives: { label: "Alternatives", text: "Y; Z." },
    pros: { label: "Pros", text: "fast." },
    cons: { label: "Cons", text: "new code." },
    why: { label: "Why", text: "tested it." },
  });
});

test("Spanish labels, and labels across a line break", () => {
  const d = parseDecision("**Usar X.** Alternativas: Y. Pros: rápido. Contras: código\nnuevo. Por\nqué: lo probamos.");
  assert.equal(d.cons.label, "Contras");
  assert.equal(d.why.label, "Por qué");
  assert.equal(d.why.text, "lo probamos.");
});

test("labels inside backticks are text, not labels", () => {
  const d = parseDecision("**Use X.** Alternatives: Y. Pros: a. Cons: b. Why: the format has `Pros:` and `Why:` labels.");
  assert.equal(d.why.text, "the format has `Pros:` and `Why:` labels.");
  assert.equal(parseDecision("**Use X.** It has `Alternatives:` `Pros:` `Cons:` `Why:` inside code."), null);
});

test("an incomplete or out-of-order decision is not a card", () => {
  assert.equal(parseDecision("**Use X.** Alternatives: Y. Pros: a. Why: c."), null);
  assert.equal(parseDecision("**Use X.** Pros: a. Alternatives: Y. Cons: b. Why: c."), null);
  assert.equal(parseDecision("**Use X.** Because. Alternatives: Y. Pros: a. Cons: b. Why: c."), null);
  assert.equal(parseDecision("**Use X.** Alternatives: Pros: a. Cons: b. Why: c."), null);
  assert.equal(parseDecision("Use X. Alternatives: Y. Pros: a. Cons: b. Why: c."), null);
});

test("complete decisions render as cards; an incomplete one stays a list item", () => {
  const dir = tmp();
  writeFileSync(join(dir, "doc.md"), [
    "# Doc", "", "## Decisions", "",
    "- **Embed images.** Alternatives: separate files. Pros: one file.",
    "  Cons: bigger page. Why: screenshots are small.",
    "- **Opt-in folding.** Alternatives: fold by depth. Pros: the writer decides. Cons: a magic string. Why: fixed rules fold the wrong things.",
    "", "## Other", "",
    "- **No cons.** Alternatives: a. Pros: b. Why: c.", "",
  ].join("\n"));
  const { html } = render(join(dir, "doc.md"));
  assert.equal(count(html, '<li class="dcard">'), 2);
  assert.equal(count(html, '<ul class="dcards">'), 1);
  assert.match(html, /<li class="dcard"><p class="choice"><strong>Embed images.<\/strong><\/p><dl><dt>Alternatives<\/dt><dd>separate files.<\/dd><dt>Pros<\/dt><dd>one file.<\/dd><dt>Cons<\/dt><dd>bigger page.<\/dd><dt>Why<\/dt><dd>screenshots are small.<\/dd><\/dl><\/li>/);
  assert.match(html, /<li><strong>No cons.<\/strong> Alternatives: a. Pros: b. Why: c.<\/li>/);
});
