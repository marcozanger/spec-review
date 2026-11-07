import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmp, render, count } from "./helpers.mjs";

function page(md) {
  const dir = tmp();
  writeFileSync(join(dir, "doc.md"), md);
  return render(join(dir, "doc.md")).html;
}

test("subsections under a marked heading are folded, the intro stays open", () => {
  const html = page("# Doc\n\n## Tasks\n<!-- fold -->\n\nIntro.\n\n### Task A\n\nBody A.\n\n### Task B\n\n```js\nconst b = 1;\n```\n");
  assert.equal(count(html, '<details class="fold">'), 2);
  assert.match(html, /<p>Intro.<\/p>\n<details class="fold"><summary>Task A<\/summary><div class="md"><p>Body A.<\/p><\/div><\/details>/);
  assert.doesNotMatch(html, /&lt;!-- fold/);
});

test("a marker under a sub-heading folds only that heading's children", () => {
  const md = "# Doc\n\n## Design\n\nIntro.\n\n### Screens\n<!-- fold -->\n\n#### Home\n\nHome text.\n\n#### Settings\n\nSettings text.\n\n### Notes\n\nOpen notes.\n";
  const html = page(md);
  assert.match(html, /<h3>Screens<\/h3>/);
  assert.match(html, /<details class="fold"><summary>Home<\/summary>/);
  assert.match(html, /<details class="fold"><summary>Settings<\/summary>/);
  assert.match(html, /<h3>Notes<\/h3>\n<p>Open notes.<\/p>/);
});

const task = name => [`### ${name}`, "", ...Array.from({ length: 80 }, (_, k) => `Line ${k}.`), ""].join("\n");
const big = marker => `# Big\n\n## Goal\n\nShort.\n\n## Tasks\n${marker ? "<!-- fold -->\n" : ""}\n${task("Task A")}\n${task("Task B")}`;

test("a long section is split into review sections, unless it is folded", () => {
  assert.match(page(big(false)), /data-sub="1"/);
  const folded = page(big(true));
  assert.doesNotMatch(folded, /data-sub="1"/);
  assert.equal(count(folded, '<details class="fold">'), 2);
});
