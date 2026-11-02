#!/usr/bin/env node
// Prints the document as the AI should read it: section ids, line numbers, and
// long code blocks collapsed to one line (plans are mostly code the notes do
// not need). Usage: node outline.mjs <file.md>
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseDoc } from "./lib/doc.mjs";
import { notesPath } from "./lib/paths.mjs";

const SHORT_CODE = 8;

const file = process.argv[2];
if (!file) { console.error("usage: node outline.mjs <file.md>"); process.exit(2); }

const doc = parseDoc(readFileSync(file, "utf8"), basename(file));
const out = [];
out.push(`# ${doc.title}`);
out.push(`kind: ${doc.kind} · lines: ${doc.lines.length} · sections: ${doc.sections.length}`);
out.push(`source_hash: ${doc.hash}`);
out.push(`write notes to: ${notesPath(file)}`);
out.push("");

const printRange = (from, to) => {
  for (let n = from; n <= to; n++) {
    const line = doc.lines[n - 1];
    if (!doc.inFence[n - 1]) {
      if (line.trim()) out.push(`${n}: ${line}`);
      continue;
    }
    // At a fence opening: print short blocks whole, collapse long ones.
    let end = n;
    while (end < to && doc.inFence[end] && !(end > n && /^\s{0,3}(`{3,}|~{3,})\s*$/.test(doc.lines[end - 1]))) end++;
    const lang = line.trim().replace(/^[`~]+/, "").trim() || "text";
    if (end - n + 1 <= SHORT_CODE || lang === "mermaid") {
      for (let k = n; k <= end; k++) out.push(`${k}: ${doc.lines[k - 1]}`);
    } else {
      out.push(`${n}-${end}: [code block, ${lang}, ${end - n - 1} lines, collapsed]`);
    }
    n = end;
  }
};

if (doc.preamble.end >= doc.preamble.start) {
  out.push(`## (intro) lines ${doc.preamble.start}-${doc.preamble.end}`);
  printRange(doc.preamble.start, doc.preamble.end);
  out.push("");
}
for (const s of doc.sections) {
  out.push(`## ${s.id} · ${s.title}${s.parent ? ` (in: ${s.parent})` : ""} · lines ${s.start}-${s.end}`);
  printRange(s.start + 1, s.end);
  out.push("");
}
process.stdout.write(out.join("\n"));
