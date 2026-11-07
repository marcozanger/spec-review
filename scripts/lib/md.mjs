// Small Markdown renderer: headings, paragraphs, lists (nested, task lists),
// fenced code, tables, blockquotes, rules, and inline code/bold/italic/links.
// Raw HTML in the source is shown as text, never injected.
import { isFenceClose } from "./doc.mjs";
import { parseDecision, KEYS } from "./decisions.mjs";

const FENCE = /^(\s{0,3})(`{3,}|~{3,})\s*([^\s`]*)/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>/;
const LI = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

export const LONG_CODE_LINES = 25;

export function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeUrl(u) {
  const url = u.replace(/&amp;/g, "&");
  return /^\s*(javascript|vbscript|data):/i.test(url) ? "#" : esc(url);
}

export function inline(src) {
  const codes = [];
  let s = String(src).replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, _t, c) => {
    codes.push(c.length > 2 && c.startsWith(" ") && c.endsWith(" ") ? c.slice(1, -1) : c);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^]*?&quot;)?\)/g, (_, a, u) => `<img alt="${a}" src="${safeUrl(u)}">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^]*?&quot;)?\)/g, (_, t, u) => `<a href="${safeUrl(u)}">${t}</a>`);
  s = s.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_, u) => `<a href="${u}">${u}</a>`);
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, "$1<strong>$2</strong>");
  s = s.replace(/(^|[^*\w])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![*\w])/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_\w])_(?=[^\s_])([^_\n]*?[^\s_])_(?![_\w])/g, "$1<em>$2</em>");
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, "<del>$1</del>");
  s = s.replace(/(?: {2,}|\\)\n/g, "<br>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
}

// Plain text of an inline string (for the rail and titles).
export function plain(src) {
  return String(src).replace(/`([^`]*)`/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_~]{1,2}(?=\S)|(?<=\S)[*_~]{1,2}/g, "");
}

const indentOf = l => l.match(/^\s*/)[0].replace(/\t/g, "    ").length;
const blank = l => !l || !l.trim();

// Before/after pair: an image line whose alt starts with Before:/Antes:, then
// (blank lines allowed) one whose alt starts with After:/Después:, then
// optionally a line that is only a link (the mockup). A typo in a label just
// gives two ordinary images.
const IMG_LINE = /^\s{0,3}!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/;
const LINK_LINE = /^\s{0,3}\[([^\]]+)\]\(([^)\s]+)\)\s*$/;
const BEFORE = /^(before|antes)\s*:/i;
const AFTER = /^(after|despu[eé]s)\s*:/i;

const nextFilled = (lines, i) => { while (i < lines.length && blank(lines[i])) i++; return i; };

function matchPair(lines, i) {
  const b = lines[i].match(IMG_LINE);
  if (!b || !BEFORE.test(b[1].trim())) return null;
  const j = nextFilled(lines, i + 1);
  const a = j < lines.length && lines[j].match(IMG_LINE);
  if (!a || !AFTER.test(a[1].trim())) return null;
  const k = nextFilled(lines, j + 1);
  const link = k < lines.length && lines[k].match(LINK_LINE);
  return { before: b, after: a, link: link || null, next: link ? k + 1 : j + 1 };
}

function pairHtml(p) {
  const side = (m, extra = "") => `<figure>${inline(`![${m[1]}](${m[2]})`)}<figcaption>${inline(m[1])}</figcaption>${extra}</figure>`;
  const mockup = p.link ? `<a class="mockup" href="${safeUrl(esc(p.link[2]))}">${inline(p.link[1])}</a>` : "";
  return `<div class="pair">${side(p.before)}${side(p.after, mockup)}</div>`;
}

function isBlockStart(l) {
  return FENCE.test(l) || HEADING.test(l) || HR.test(l) || QUOTE.test(l);
}

function splitRow(row) {
  let r = row.trim();
  if (r.startsWith("|")) r = r.slice(1);
  if (r.endsWith("|") && !r.endsWith("\\|")) r = r.slice(0, -1);
  const cells = [];
  let cur = "", tick = 0;
  for (let i = 0; i < r.length; i++) {
    const c = r[i];
    if (c === "\\" && r[i + 1] === "|") { cur += "|"; i++; continue; }
    if (c === "`") tick ^= 1;
    if (c === "|" && !tick) { cells.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

export function codeBlock(code, lang, labels) {
  if (lang === "mermaid") {
    return `<div class="mmd" data-src="${esc(code)}"><div class="mmd-out"></div><pre class="mmd-fallback"><code>${esc(code)}</code></pre></div>`;
  }
  const pre = `<pre><code${lang ? ` class="lang-${esc(lang)}"` : ""}>${esc(code)}</code></pre>`;
  const n = code.split("\n").length;
  if (n <= LONG_CODE_LINES) return pre;
  return `<details class="code"><summary>${esc(labels.code(lang, n))}</summary>${pre}</details>`;
}

export function renderBlocks(lines, labels, minHeading = 3) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (blank(l)) { i++; continue; }

    let m = l.match(FENCE);
    if (m) {
      const indent = m[1].length, fence = m[2], body = [];
      i++;
      while (i < lines.length && !isFenceClose(lines[i], fence)) {
        body.push(lines[i].slice(Math.min(indent, indentOf(lines[i]))));
        i++;
      }
      i++;
      out.push(codeBlock(body.join("\n"), m[3].toLowerCase(), labels));
      continue;
    }

    m = l.match(HEADING);
    if (m) {
      const lv = Math.min(6, Math.max(minHeading, m[1].length));
      out.push(`<h${lv}>${inline(m[2])}</h${lv}>`);
      i++;
      continue;
    }

    if (HR.test(l)) { out.push("<hr>"); i++; continue; }

    const pair = matchPair(lines, i);
    if (pair) { out.push(pairHtml(pair)); i = pair.next; continue; }

    if (l.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const head = splitRow(l);
      const align = splitRow(lines[i + 1]).map(c => c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "");
      i += 2;
      const rows = [];
      while (i < lines.length && !blank(lines[i]) && lines[i].includes("|")) rows.push(splitRow(lines[i++]));
      const cell = (tag, c, k) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ""}>${inline(c)}</${tag}>`;
      out.push(`<div class="tbl"><table><thead><tr>${head.map((c, k) => cell("th", c, k)).join("")}</tr></thead><tbody>${
        rows.map(r => `<tr>${head.map((_, k) => cell("td", r[k] ?? "", k)).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }

    if (QUOTE.test(l)) {
      const body = [];
      while (i < lines.length && !blank(lines[i]) && (QUOTE.test(lines[i]) || !isBlockStart(lines[i]))) {
        body.push(lines[i].replace(/^\s{0,3}> ?/, ""));
        i++;
      }
      out.push(`<blockquote>${renderBlocks(body, labels, minHeading)}</blockquote>`);
      continue;
    }

    if (LI.test(l)) {
      const r = parseList(lines, i, labels, minHeading);
      out.push(r.html);
      i = r.next;
      continue;
    }

    const para = [];
    while (i < lines.length && !blank(lines[i]) && !(para.length && (isBlockStart(lines[i]) || LI.test(lines[i])))) {
      para.push(lines[i].replace(/^\s+/, ""));
      i++;
    }
    out.push(`<p>${inline(para.join("\n"))}</p>`);
  }
  return out.join("\n");
}

// A list item written as a full decision becomes a card. Items with blank
// lines or nested blocks never do.
function cardFor(body) {
  if (body.some((l, k) => blank(l) || (k > 0 && (LI.test(l) || isBlockStart(l))))) return null;
  return parseDecision(body.join("\n"));
}

function cardHtml(d) {
  const row = p => `<dt>${inline(p.label)}</dt><dd>${inline(p.text)}</dd>`;
  return `<p class="choice"><strong>${inline(d.choice)}</strong></p><dl>${KEYS.map(k => row(d[k])).join("")}</dl>`;
}

function parseList(lines, i, labels, minHeading) {
  const first = lines[i].match(LI);
  const base = indentOf(lines[i]);
  const ordered = /\d/.test(first[2]);
  const start = ordered ? parseInt(first[2], 10) : 1;
  const items = [];
  let loose = false;

  while (i < lines.length) {
    const m = lines[i].match(LI);
    if (!m || indentOf(lines[i]) !== base || /\d/.test(m[2]) !== ordered) break;
    const contentIndent = base + m[2].length + Math.min(m[3].length, 4);
    const body = [m[4]];
    i++;
    while (i < lines.length) {
      const l = lines[i];
      if (blank(l)) {
        let j = i + 1;
        while (j < lines.length && blank(lines[j])) j++;
        if (j < lines.length && indentOf(lines[j]) > base) {
          for (; i < j; i++) body.push("");
          loose = true;
          continue;
        }
        break;
      }
      const ind = indentOf(l);
      if (ind > base) { body.push(l.replace(/\t/g, "    ").slice(Math.min(ind, contentIndent))); i++; continue; }
      if (LI.test(l) || isBlockStart(l)) break;
      body.push(l.trim());
      i++;
    }
    items.push(body);
    if (i < lines.length && blank(lines[i])) {
      let j = i;
      while (j < lines.length && blank(lines[j])) j++;
      const n = j < lines.length && lines[j].match(LI);
      if (n && indentOf(lines[j]) === base && /\d/.test(n[2]) === ordered) { loose = true; i = j; }
    }
  }

  const cards = items.map(cardFor);
  const lis = items.map((body, n) => {
    if (cards[n]) return `<li class="dcard">${cardHtml(cards[n])}</li>`;
    let check = "";
    const t = body[0].match(/^\[([ xX])\]\s+(.*)$/);
    if (t) {
      check = `<input type="checkbox" disabled${t[1] === " " ? "" : " checked"}> `;
      body = [t[2], ...body.slice(1)];
    }
    let inner = renderBlocks(body, labels, minHeading);
    if (!loose) inner = inner.replace(/^<p>([\s\S]*?)<\/p>/, "$1");
    return `<li${check ? ' class="task"' : ""}>${check}${inner}</li>`;
  });
  const tag = ordered ? "ol" : "ul";
  const cls = cards.every(Boolean) ? ' class="dcards"' : "";
  return { html: `<${tag}${cls}${ordered && start !== 1 ? ` start="${start}"` : ""}>${lis.join("")}</${tag}>`, next: i };
}
