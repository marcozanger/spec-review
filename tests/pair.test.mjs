import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmp, render, PNG, count } from "./helpers.mjs";

function doc(body) {
  const dir = tmp();
  mkdirSync(join(dir, "img"));
  writeFileSync(join(dir, "img", "before.png"), PNG);
  writeFileSync(join(dir, "img", "after.png"), PNG);
  writeFileSync(join(dir, "doc.md"), `# Doc\n\n## Screens\n\n${body}\n`);
  return render(join(dir, "doc.md")).html;
}

test("a before/after pair with a link renders side by side with the mockup link under the after image", () => {
  const html = doc("![Before: home today](img/before.png)\n![After: home with the ring](img/after.png)\n[Open mockup](https://claude.ai/artifact/abc)");
  assert.match(html, /<div class="pair"><figure><img alt="Before: home today" src="data:image\/png;base64,/);
  assert.match(html, /<figcaption>After: home with the ring<\/figcaption><a class="mockup" href="https:\/\/claude.ai\/artifact\/abc">Open mockup<\/a><\/figure><\/div>/);
});

test("Spanish labels and blank lines between the parts work too", () => {
  const html = doc("![Antes: hoy](img/before.png)\n\n![Después: con el anillo](img/after.png)");
  assert.equal(count(html, '<div class="pair">'), 1);
  assert.equal(count(html, 'class="mockup"'), 0);
});

test("a before image without an after image renders alone", () => {
  const html = doc("![Before: home today](img/before.png)\n\nSome text.");
  assert.equal(count(html, '<div class="pair">'), 0);
  assert.match(html, /<p><img alt="Before: home today" src="data:image\/png;base64,/);
});
