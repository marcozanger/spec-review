// Embeds the page's local images as data URIs, so one HTML file works the
// same as a local file and as a published Artifact. Relative paths resolve
// against a base folder (the document's own unless --base says otherwise).
// Remote and anchor URLs are left alone; an unreadable image becomes a
// visible placeholder and is listed in the report.
import { readFileSync } from "node:fs";
import { resolve, extname, isAbsolute } from "node:path";
import { esc } from "./md.mjs";
import { fill } from "./strings.mjs";

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" };
export const WARN_BYTES = 4 * 1024 * 1024;
const IMG = /<img alt="([^"]*)" src="([^"]*)">/g; // the exact tag md.mjs inline() writes
const unesc = s => s.replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");

export function imageEmbedder(baseDir, labels) {
  const report = { embedded: 0, bytes: 0, missing: [] };
  const cache = new Map();

  function embed(html) {
    return html.replace(IMG, (tag, alt, src) => {
      const url = unesc(src);
      if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//") || url.startsWith("#")) return tag;
      let rel = url.split(/[?#]/)[0];
      try { rel = decodeURIComponent(rel); } catch { /* keep it as written */ }
      const path = isAbsolute(rel) ? rel : resolve(baseDir, rel);
      if (!cache.has(path)) {
        const mime = MIME[extname(path).toLowerCase()];
        let buf = null;
        if (mime) { try { buf = readFileSync(path); } catch { buf = null; } }
        if (buf) { report.embedded++; report.bytes += buf.length; }
        else report.missing.push(rel);
        cache.set(path, buf ? `data:${mime};base64,${buf.toString("base64")}` : null);
      }
      const data = cache.get(path);
      if (!data) return `<span class="img-missing" role="img" aria-label="${alt}">${esc(fill(labels.imgMissing, { path: rel }))}</span>`;
      return `<img alt="${alt}" src="${data}">`;
    });
  }
  return { embed, report };
}
