import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// A valid 1x1 PNG.
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

export const tmp = () => mkdtempSync(join(tmpdir(), "spec-review-"));

// Runs render.mjs on a file and returns the HTML and what the script printed.
export function render(file, ...flags) {
  const out = join(tmp(), "out.html");
  const stdout = execFileSync(process.execPath, [join(ROOT, "scripts/render.mjs"), file, "--out", out, ...flags], { encoding: "utf8" });
  return { html: readFileSync(out, "utf8"), stdout };
}

// The <main> element: the document part of the page, without the inlined CSS and JS.
export const main = html => html.slice(html.indexOf("<main>"), html.indexOf("</main>") + "</main>".length);

export const count = (html, needle) => html.split(needle).length - 1;
