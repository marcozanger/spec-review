import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { tmp, render, PNG, count } from "./helpers.mjs";

const SAMPLE = `# Layers sample

## Screens

![Before: home today](img/before.png)
![After: home with the ring](img/after.png)
[Open mockup](https://claude.ai/artifact/abc)

## Decisions

- **Embed images.** Alternatives: separate files. Pros: one file. Cons: bigger page. Why: screenshots are small.
- **Opt-in folding.** Alternatives: fold by depth. Pros: the writer decides. Cons: a magic string. Why: fixed rules fold the wrong things.

## Tasks
<!-- fold -->

### Task A

\`\`\`js
const a = 1;
\`\`\`

### Task B

Text B.
`;

function sample() {
  const dir = tmp();
  mkdirSync(join(dir, "img"));
  writeFileSync(join(dir, "img", "before.png"), PNG);
  writeFileSync(join(dir, "img", "after.png"), PNG);
  writeFileSync(join(dir, "sample.md"), SAMPLE);
  return dir;
}

function assertLayers(html) {
  assert.equal(count(html, '<div class="pair">'), 1);
  assert.equal(count(html, 'class="mockup"'), 1);
  assert.equal(count(html, "data:image/png;base64,"), 2);
  assert.equal(count(html, '<li class="dcard">'), 2);
  assert.equal(count(html, '<details class="fold">'), 2);
  assert.equal(count(html, 'class="img-missing"'), 0);
}

test("the sample renders all four layers, as a local file and as an Artifact page", () => {
  const dir = sample();
  assertLayers(render(join(dir, "sample.md")).html);
  assertLayers(render(join(dir, "sample.md"), "--artifact").html);
});

test("a copy in another folder needs --base to find the images", () => {
  const dir = sample(), copy = tmp();
  copyFileSync(join(dir, "sample.md"), join(copy, "sample.md"));
  const without = render(join(copy, "sample.md"));
  assert.equal(count(without.html, 'class="img-missing"'), 2);
  assert.match(without.stdout, /images missing .*img\/before\.png, img\/after\.png/);
  assertLayers(render(join(copy, "sample.md"), "--base", dir).html);
});
