#!/usr/bin/env node
// Writes the review page for a Markdown spec or plan. The AI notes JSON is
// optional: without it (or when it is stale) the page has no summaries or flows.
//
//   node render.mjs <file.md> [--notes path] [--out path] [--lang es|en]
//   node render.mjs <file.md> --status     → prints fresh | stale | missing
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDoc, bodyLines } from "./lib/doc.mjs";
import { renderBlocks, inline, plain, esc } from "./lib/md.mjs";
import { checkNotes, KINDS } from "./lib/notes.mjs";
import { notesPath, htmlPath } from "./lib/paths.mjs";
import { STRINGS, fill } from "./lib/strings.mjs";

const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs";
const OPEN_MAX_LINES = 120; // longer sections start with the full text folded when they have notes

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const file = args.find((a, i) => !a.startsWith("--") && !["--notes", "--out", "--lang"].includes(args[i - 1]));
if (!file) { console.error("usage: node render.mjs <file.md> [--notes path] [--out path] [--lang es|en] [--status]"); process.exit(2); }

const doc = parseDoc(readFileSync(file, "utf8"), basename(file));
const nPath = opt("--notes") || notesPath(file);

let raw = null;
if (existsSync(nPath)) {
  try { raw = JSON.parse(readFileSync(nPath, "utf8")); } catch (e) { raw = { parseError: e.message }; }
}

if (args.includes("--status")) {
  console.log(!raw ? "missing" : raw.source_hash === doc.hash ? "fresh" : "stale");
  process.exit(0);
}

const S = STRINGS[opt("--lang") || "es"] || STRINGS.es;
const { notes, report } = raw ? checkNotes(raw, doc) : { notes: null, report: null };
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../assets/page.css"), "utf8");
const js = readFileSync(join(here, "../assets/page.js"), "utf8");

const aiTag = `<span class="ai-tag" title="${esc(S.aiTitle)}">${esc(S.aiTag)}</span>`;
const linesText = ([a, b]) => a === b ? fill(S.line, { a }) : fill(S.lines, { a, b });
const cite = range => `<span class="cite">${esc(linesText(range))}</span>`;
const usedKinds = new Set();

function flowHtml(f) {
  f.nodes.forEach(n => usedKinds.add(n.kind));
  const cap = `<figcaption>${aiTag}${f.title ? inline(f.title) : ""}</figcaption>`;
  const byId = new Map(f.nodes.map(n => [n.id, n]));
  if (f.chain) {
    const nodes = f.chain.map(id => byId.get(id)).map(n =>
      `<div class="node k-${n.kind}" title="${esc(S.kinds[n.kind])} · ${esc(linesText(n.lines))}"><b>${inline(n.label)}</b>${n.detail ? `<span>${inline(n.detail)}</span>` : ""}</div>`);
    return `<figure class="flow">${cap}<div class="pipe">${nodes.join('<span class="arrow" aria-hidden="true">→</span>')}</div></figure>`;
  }
  const q = s => s.replace(/"/g, "#quot;").replace(/[<>]/g, "");
  const shape = n => n.kind === "decision" ? `{"${q(n.label)}"}` : n.kind === "user" ? `(["${q(n.label)}"])` : `["${q(n.label)}"]`;
  const src = [
    `flowchart ${f.nodes.length <= 5 ? "LR" : "TD"}`,
    ...f.nodes.map(n => `  ${n.id}${shape(n)}:::${n.kind}`),
    ...f.edges.map(([a, b, l]) => `  ${a} -->${l ? `|"${q(l)}"|` : ""} ${b}`),
    "  classDef system fill:{{code-bg}},stroke:{{code}},color:{{fg}}",
    "  classDef ai fill:{{ai-bg}},stroke:{{ai}},color:{{fg}},stroke-dasharray:4 3",
    "  classDef user fill:{{accent-bg}},stroke:{{accent}},color:{{fg}}",
    "  classDef decision fill:{{warn-bg}},stroke:{{warn}},color:{{fg}}",
  ].join("\n");
  const list = f.edges.map(([a, b, l]) => `<li>${inline(byId.get(a).label)} → ${inline(byId.get(b).label)}${l ? ` <span class="muted">(${inline(l)})</span>` : ""}</li>`);
  return `<figure class="flow">${cap}<div class="mmd" data-src="${esc(src)}"><div class="mmd-out"></div><div class="mmd-fallback"><p class="muted">${esc(S.flowFallback)}</p><ol class="mmd-fallback">${list.join("")}</ol></div></div></figure>`;
}

function sectionHtml(s) {
  const n = notes?.sections[s.id];
  const body = bodyLines(doc, s);
  const md = `<div class="md">${renderBlocks(body, S)}</div>`;
  const parts = [];
  if (n?.summary) parts.push(`<p class="lead">${aiTag}${inline(n.summary)}</p>`);
  if (n?.flow) parts.push(flowHtml(n.flow));
  if (n?.decisions?.length) {
    parts.push(`<div class="decisions" aria-label="${esc(S.decisions)}">${n.decisions.map(d =>
      `<div class="dec"><p>${inline(d.text)}</p>${d.why ? `<p class="why">${inline(d.why)}</p>` : ""}${cite(d.lines)}</div>`).join("")}</div>`);
  }
  const eyebrow = s.number ? `§${s.number}${s.parent ? " · " + plain(s.parent) : ""}` : s.parent ? plain(s.parent) : "";
  const title = plain(s.number ? s.name : s.title);
  const content = parts.length
    ? `<div class="notes">${parts.join("")}</div><details class="full"${body.length <= OPEN_MAX_LINES ? " open" : ""}><summary>${esc(fill(S.fullText, { n: body.length }))}</summary>${md}</details>`
    : md;
  return `<section id="${s.id}" data-title="${esc(plain(s.title))}"${s.parent ? ' data-sub="1"' : ""}>
  ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}<h2>${inline(title)}</h2>
  ${content}
</section>`;
}

const sectionsHtml = doc.sections.length
  ? doc.sections.map(sectionHtml).join("\n")
  : sectionHtml({ id: "s1", title: S.intro, name: S.intro, start: doc.preamble.start - 1, end: doc.preamble.end, parent: null, number: null });
const pre = doc.sections.length && doc.preamble.end >= doc.preamble.start
  ? renderBlocks(doc.lines.slice(doc.preamble.start - 1, doc.preamble.end), S) : "";
const legend = [...KINDS].filter(k => usedKinds.has(k)).map(k => `<span class="chip k-${k}">${esc(S.kinds[k])}</span>`).join("");

const config = {
  key: basename(file), title: plain(doc.title), file: basename(file), mermaidUrl: MERMAID_URL,
  strings: Object.fromEntries(Object.entries(S).filter(([, v]) => typeof v === "string")),
};

const html = `<!doctype html>
<html lang="${S.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(plain(doc.title))}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Public+Sans:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
${css}
</style>
</head>
<body>
<div class="wrap">
  <nav class="rail" aria-label="${esc(S.sections)}">
    <div class="label">${esc(S.review)}</div>
    <div class="progress"><span id="prog"></span></div>
    <div class="bar"><i id="progbar"></i></div>
    <ol id="toc"></ol>
  </nav>
  <main>
    <header class="hero">
      <div class="eyebrow">${esc(S[doc.kind])} · ${esc(basename(file))}</div>
      <h1>${inline(doc.title)}</h1>
      ${notes?.doc.summary ? `<p class="lead">${aiTag}${inline(notes.doc.summary)}</p>` : ""}
      ${pre ? `<div class="md muted">${pre}</div>` : ""}
      ${legend ? `<div class="meta">${legend}</div>` : ""}
      <p class="muted" style="font-size:.9rem">${S.how}</p>
    </header>
${sectionsHtml}
    <section class="summary" aria-labelledby="send-h">
      <h2 id="send-h">${esc(S.sendTitle)}</h2>
      <p class="muted">${esc(S.sendHelp)}</p>
      <pre id="out"></pre>
      <button class="btn" id="copy" type="button">${esc(S.copy)}</button>
    </section>
  </main>
</div>
<script>window.__REVIEW__ = ${JSON.stringify(config).replace(/</g, "\\u003c")};</script>
<script>
${js}
</script>
</body>
</html>
`;

const out = opt("--out") || htmlPath(file);
writeFileSync(out, html);

console.log(`wrote ${out}`);
if (!report) console.log("notes: none (plain page)");
else if (report.error) console.log(`notes: ignored (${raw.parseError ? "invalid JSON: " + raw.parseError : report.error})`);
else {
  console.log(`notes: ${report.summaries} summaries, ${report.decisions} decisions, ${report.flows} flows${report.dropped.length ? `; dropped ${report.dropped.length}` : ""}`);
  report.dropped.forEach(d => console.log(`  dropped: ${d}`));
}
