import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmp, render, PNG } from "./helpers.mjs";

function docWithImage(dir, md = "# Doc\n\n## A\n\n![screen](img/shot.png)\n") {
  writeFileSync(join(dir, "doc.md"), md);
  return join(dir, "doc.md");
}

test("a local image is embedded as a data URI", () => {
  const dir = tmp();
  mkdirSync(join(dir, "img"));
  writeFileSync(join(dir, "img", "shot.png"), PNG);
  const { html, stdout } = render(docWithImage(dir));
  assert.match(html, /<img alt="screen" src="data:image\/png;base64,iVBOR/);
  assert.match(stdout, /images: 1 embedded \(\d+ KB\)/);
});

test("a remote image is left as it is", () => {
  const dir = tmp();
  const { html, stdout } = render(docWithImage(dir, "# Doc\n\n## A\n\n![logo](https://example.com/l.png)\n"));
  assert.match(html, /<img alt="logo" src="https:\/\/example.com\/l.png">/);
  assert.doesNotMatch(stdout, /images/);
});

test("a missing image shows a placeholder with its path and is listed", () => {
  const dir = tmp();
  const { html, stdout } = render(docWithImage(dir, "# Doc\n\n## A\n\n![screen](nope.png)\n"));
  assert.match(html, /<span class="img-missing" role="img" aria-label="screen">Imagen no encontrada: nope.png<\/span>/);
  assert.match(stdout, /images missing .*: nope\.png/);
});

test("--base finds the images of a copy rendered from another folder", () => {
  const orig = tmp(), copy = tmp();
  mkdirSync(join(orig, "img"));
  writeFileSync(join(orig, "img", "shot.png"), PNG);
  const file = docWithImage(copy);
  assert.match(render(file).html, /class="img-missing"/);
  const { html } = render(file, "--base", orig);
  assert.match(html, /<img alt="screen" src="data:image\/png;base64,/);
  assert.doesNotMatch(html, /class="img-missing"/);
});

test("big images print a size warning", () => {
  const dir = tmp();
  mkdirSync(join(dir, "img"));
  writeFileSync(join(dir, "img", "shot.png"), Buffer.alloc(5 * 1024 * 1024));
  const { stdout } = render(docWithImage(dir));
  assert.match(stdout, /warning: images add 5\.0 MB/);
});
