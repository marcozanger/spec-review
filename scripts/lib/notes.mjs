// Validates the AI's notes JSON against the parsed document. Anything that
// does not cite real lines of its section is dropped, so the page never shows
// a claim the source does not back.
export const KINDS = ["system", "ai", "user", "decision"];
const MAX = { docSummary: 320, summary: 220, decisionText: 180, why: 220, label: 60, detail: 90, title: 100 };

const str = (v, max) => typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null;

function validLines(v, s) {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [a, b] = v.map(Number);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a > b || a < s.start || b > s.end) return null;
  return [a, b];
}

// cards: 1-based line ranges of decision cards (decisions.mjs cardRanges); the
// page already shows those decisions as written, so AI decisions citing them go.
export function checkNotes(raw, doc, cards = []) {
  const report = { summaries: 0, decisions: 0, flows: 0, dropped: [] };
  const drop = msg => report.dropped.push(msg);
  const out = { doc: {}, sections: {} };

  if (!raw || typeof raw !== "object") return { notes: null, report: { ...report, error: "not a JSON object" } };
  if (raw.source_hash !== doc.hash) return { notes: null, report: { ...report, error: `stale: notes are for ${raw.source_hash}, document is ${doc.hash}` } };

  out.doc.summary = str(raw.doc?.summary, MAX.docSummary);
  if (raw.doc?.summary && !out.doc.summary) drop("doc summary (empty or too long)");

  const byId = new Map(doc.sections.map(s => [s.id, s]));
  for (const n of Array.isArray(raw.sections) ? raw.sections : []) {
    const s = byId.get(n?.id);
    if (!s) { drop(`section ${n?.id}: unknown id`); continue; }
    const note = {};

    if (n.summary != null) {
      note.summary = str(n.summary, MAX.summary);
      if (note.summary) report.summaries++; else drop(`${s.id} summary (empty or too long)`);
    }

    note.decisions = [];
    for (const d of Array.isArray(n.decisions) ? n.decisions.slice(0, 8) : []) {
      const text = str(d?.text, MAX.decisionText), lines = validLines(d?.lines, s);
      if (!text || !lines) { drop(`${s.id} decision "${String(d?.text).slice(0, 40)}" (${!text ? "text" : "lines"})`); continue; }
      if (cards.some(([a, b]) => lines[0] <= b && lines[1] >= a)) { drop(`${s.id} decision "${text.slice(0, 40)}" (shown as a card)`); continue; }
      note.decisions.push({ text, why: str(d.why, MAX.why), lines });
    }
    report.decisions += note.decisions.length;

    if (n.flow) {
      const flow = checkFlow(n.flow, s, drop);
      if (flow) { note.flow = flow; report.flows++; }
    }
    out.sections[s.id] = note;
  }
  return { notes: out, report };
}

function checkFlow(f, s, drop) {
  const nodes = [];
  const seen = new Set();
  for (const n of Array.isArray(f.nodes) ? f.nodes.slice(0, 12) : []) {
    const id = typeof n?.id === "string" && /^[A-Za-z][\w-]{0,20}$/.test(n.id) ? n.id : null;
    const label = str(n?.label, MAX.label), lines = validLines(n?.lines, s);
    if (!id || seen.has(id) || !label || !lines || !KINDS.includes(n.kind)) {
      drop(`${s.id} flow node "${n?.label ?? n?.id}" (${!lines ? "lines" : !KINDS.includes(n?.kind) ? "kind" : "id/label"})`);
      continue;
    }
    seen.add(id);
    nodes.push({ id, kind: n.kind, label, detail: str(n.detail, MAX.detail), lines });
  }
  if (nodes.length < 3) { drop(`${s.id} flow (fewer than 3 valid nodes)`); return null; }

  const edges = [];
  for (const e of Array.isArray(f.edges) ? f.edges : []) {
    if (!Array.isArray(e) || !seen.has(e[0]) || !seen.has(e[1]) || e[0] === e[1]) continue;
    edges.push([e[0], e[1], str(e[2], 30)]);
  }
  if (!edges.length) { drop(`${s.id} flow (no valid edges)`); return null; }

  return { title: str(f.title, MAX.title), nodes, edges, chain: chainOrder(nodes, edges) };
}

// Node order if the flow is one unlabeled straight line, else null.
function chainOrder(nodes, edges) {
  if (edges.length !== nodes.length - 1 || edges.some(e => e[2])) return null;
  const out = new Map(), indeg = new Map(nodes.map(n => [n.id, 0]));
  for (const [a, b] of edges) {
    if (out.has(a)) return null;
    out.set(a, b);
    indeg.set(b, indeg.get(b) + 1);
  }
  const heads = nodes.filter(n => indeg.get(n.id) === 0);
  if (heads.length !== 1 || [...indeg.values()].some(v => v > 1)) return null;
  const order = [];
  for (let id = heads[0].id; id; id = out.get(id)) order.push(id);
  return order.length === nodes.length ? order : null;
}
