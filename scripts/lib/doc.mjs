// Splits a Markdown document into review sections with 1-based line ranges.
// Both outline.mjs (what the AI reads) and render.mjs (the page) use this, so
// section ids and line numbers always agree.
import { createHash } from "node:crypto";

const FENCE_OPEN = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;

// A section this big, with sub-headings, is split one level down (plans keep
// every task under one "##").
const SPLIT_SHARE = 0.4;
const SPLIT_MIN_LINES = 150;

export function normalize(src) {
  return src.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

export function hashSource(src) {
  return createHash("sha256").update(normalize(src)).digest("hex").slice(0, 16);
}

export function isFenceClose(line, fence) {
  const t = line.trim();
  return t.length >= fence.length && t.split("").every(c => c === fence[0]) && /^\s{0,3}\S/.test(line);
}

// Marks each line as inside a fenced code block or not.
export function fenceMap(lines) {
  const inFence = new Array(lines.length).fill(false);
  let fence = null;
  lines.forEach((line, i) => {
    if (fence) {
      inFence[i] = true;
      if (isFenceClose(line, fence)) fence = null;
      return;
    }
    const f = line.match(FENCE_OPEN);
    if (f) { fence = f[1]; inFence[i] = true; }
  });
  return inFence;
}

export function parseDoc(src, fileName) {
  const lines = normalize(src).split("\n");
  const inFence = fenceMap(lines);
  const heads = [];
  lines.forEach((line, i) => {
    if (inFence[i]) return;
    const h = line.match(HEADING);
    if (h) heads.push({ level: h[1].length, text: h[2].trim(), line: i + 1 });
  });

  const h1 = heads.find(h => h.level === 1);
  const title = h1 ? h1.text : fileName.replace(/\.md$/i, "");
  const sub = heads.filter(h => h.level > 1);
  const top = sub.length ? Math.min(...sub.map(h => h.level)) : null;

  let sections = [];
  if (top) {
    const tops = sub.filter(h => h.level === top);
    tops.forEach((h, k) => {
      const end = k + 1 < tops.length ? tops[k + 1].line - 1 : lines.length;
      sections.push({ title: h.text, level: h.level, start: h.line, end, parent: null });
    });
  }

  sections = sections.flatMap(s => {
    const size = s.end - s.start + 1;
    const kids = sub.filter(h => h.level === s.level + 1 && h.line > s.start && h.line <= s.end);
    if (kids.length < 2 || size < lines.length * SPLIT_SHARE || size < SPLIT_MIN_LINES) return [s];
    const out = [];
    if (hasContent(lines, s.start + 1, kids[0].line - 1)) out.push({ ...s, end: kids[0].line - 1 });
    kids.forEach((h, k) => out.push({
      title: h.text, level: h.level, start: h.line,
      end: k + 1 < kids.length ? kids[k + 1].line - 1 : s.end,
      parent: s.title,
    }));
    return out;
  });

  sections.forEach((s, i) => {
    s.id = `s${i + 1}`;
    while (s.end > s.start && !lines[s.end - 1].trim()) s.end--;
    const m = s.title.match(/^(?:§\s*)?(\d+(?:\.\d+)*)[.)]?\s+(.+)$/);
    s.number = m ? m[1] : null;
    s.name = m ? m[2] : s.title;
  });

  const preStart = h1 ? h1.line + 1 : 1;
  const preEnd = sections.length ? sections[0].start - 1 : lines.length;
  const kind = /plan/i.test(fileName) || /\bplan\b/i.test(title) ? "plan" : "spec";

  return { title, kind, lines, inFence, sections, preamble: { start: preStart, end: preEnd }, hash: hashSource(src) };
}

function hasContent(lines, from, to) {
  for (let n = from; n <= to; n++) if (lines[n - 1] && lines[n - 1].trim()) return true;
  return false;
}

// Lines of a section without its heading line.
export function bodyLines(doc, s) {
  return doc.lines.slice(s.start, s.end);
}
