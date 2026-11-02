// Review widget (OK / Change per section, progress, copy comments) and
// Mermaid drawing for branching flows. Config comes from window.__REVIEW__.
(function () {
  const D = window.__REVIEW__, S = D.strings;
  const KEY = "spec-review:" + D.key;
  let state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { state = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

  const sections = [...document.querySelectorAll("main section[data-title]")];
  const toc = document.getElementById("toc");

  sections.forEach(sec => {
    const id = sec.id, key = sec.dataset.title;
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#" + id;
    if (sec.dataset.sub) a.className = "sub";
    a.innerHTML = `<span class="dot" id="dot-${id}"></span>`;
    a.appendChild(document.createTextNode(sec.dataset.title));
    li.appendChild(a);
    toc.appendChild(li);

    const box = document.createElement("div");
    box.className = "review";
    box.innerHTML = `<span class="q"></span>
      <button type="button" class="ok" aria-pressed="false"></button>
      <button type="button" class="chg" aria-pressed="false"></button>
      <textarea hidden></textarea>`;
    box.querySelector(".q").textContent = S.question;
    const ok = box.querySelector(".ok"), chg = box.querySelector(".chg"), note = box.querySelector("textarea");
    ok.textContent = S.ok; chg.textContent = S.change; note.placeholder = S.notePh;
    note.setAttribute("aria-label", S.notePh);
    sec.appendChild(box);
    note.value = (state[key] || {}).note || "";

    const paint = () => {
      const s = state[key] || {};
      ok.setAttribute("aria-pressed", s.status === "ok");
      chg.setAttribute("aria-pressed", s.status === "change");
      note.hidden = s.status !== "change" && !s.note;
      document.getElementById("dot-" + id).className = "dot" + (s.status === "ok" ? " ok" : s.status === "change" ? " change" : "");
    };
    const set = status => {
      state[key] = Object.assign({}, state[key], { status: (state[key] || {}).status === status ? null : status });
      save(); paint(); render();
      if (state[key].status === "change") note.focus();
    };
    ok.addEventListener("click", () => set("ok"));
    chg.addEventListener("click", () => set("change"));
    note.addEventListener("input", () => { state[key] = Object.assign({}, state[key], { note: note.value }); save(); render(); });
    paint();
  });

  function render() {
    const done = sections.filter(s => (state[s.dataset.title] || {}).status).length;
    document.getElementById("prog").textContent = fill(S.progress, { done, total: sections.length });
    document.getElementById("progbar").style.width = (sections.length ? done / sections.length * 100 : 0) + "%";
    const lines = [];
    sections.forEach(s => {
      const st = state[s.dataset.title] || {};
      if (!st.status && !(st.note || "").trim()) return;
      const tag = st.status === "ok" ? S.tagOk : st.status === "change" ? S.tagChange : S.tagNote;
      lines.push(`- ${s.dataset.title}: ${tag}${(st.note || "").trim() ? " — " + st.note.trim() : ""}`);
    });
    document.getElementById("out").textContent = lines.length
      ? fill(S.reviewOf, { title: D.title }) + " (" + D.file + ")\n" + lines.join("\n")
      : S.nothing;
  }
  render();

  const btn = document.getElementById("copy");
  btn.addEventListener("click", () => {
    const text = document.getElementById("out").textContent;
    const done = () => { btn.textContent = S.copied; setTimeout(() => btn.textContent = S.copy, 1600); };
    const fallback = () => {
      const r = document.createRange(); r.selectNodeContents(document.getElementById("out"));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); btn.textContent = S.selected;
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  });

  const graphs = [...document.querySelectorAll(".mmd[data-src]")];
  if (!graphs.length) return;
  import(D.mermaidUrl).then(({ default: mermaid }) => {
    let run = 0;
    const draw = async () => {
      const css = getComputedStyle(document.documentElement);
      const v = n => css.getPropertyValue("--" + n).trim();
      mermaid.initialize({
        startOnLoad: false, securityLevel: "strict", theme: "base", fontFamily: v("f-body"),
        themeVariables: {
          primaryColor: v("surface"), primaryTextColor: v("fg"), primaryBorderColor: v("line"),
          lineColor: v("muted"), textColor: v("fg"), background: v("surface"),
          edgeLabelBackground: v("surface"), fontSize: "14px",
        },
      });
      run++;
      for (const [k, el] of graphs.entries()) {
        const src = el.dataset.src.replace(/\{\{([\w-]+)\}\}/g, (_, n) => v(n));
        try {
          const { svg } = await mermaid.render(`mmd-${run}-${k}`, src);
          el.querySelector(".mmd-out").innerHTML = svg;
          el.classList.add("drawn");
        } catch (e) { /* the fallback list stays visible */ }
      }
    };
    draw();
    try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw); } catch (e) {}
  }).catch(() => {});
})();
