# spec-review

A Claude Code skill that turns a Markdown spec or plan into a review page: sections with OK / Change per section, a progress rail, and a "Copy feedback" button.

When the session has the Artifact tool (Claude Code signed in to claude.ai), the page is published as a private Artifact with a **Send to Claude** button: the review arrives in the session as a comment, Claude applies it to the `.md`, republishes the page and answers in the thread. Pass `--html` to get only the local file.

Work split:
- **Scripts (Node, no dependencies)** write all the HTML.
- **AI (Sonnet by default, Haiku with `--fast`)** only writes a small JSON per document: one-line summary per section, key decisions with their "why", and a flow diagram where one helps. The script validates it and drops anything that does not cite real lines of the source.

## Install

Copy this folder to `~/.claude/skills/spec-review/` (all projects) or `<repo>/.claude/skills/spec-review/` (one repo). Needs Node 18+.

## Use

```
/spec-review docs/specs/my-feature.md
/spec-review docs/plans/my-plan.md --fast
```

Output, next to the source file (in artifact mode, the HTML is also published and you get a claude.ai link):
- `my-feature.review.html` — open it in a browser
- `my-feature.review.json` — the AI's notes; reused while the `.md` does not change (re-render costs 0 tokens)

Render without AI (plain page, no summaries or diagrams):

```
node scripts/render.mjs docs/specs/my-feature.md
```

Add `--artifact` to render the page for publishing as an Artifact (declare `capabilities: {comments: {}}` when publishing). Outside claude.ai the extra button stays hidden, so the file still works locally.

Local images (`![alt](img/screen.png)`) are embedded in the page, so the same file works locally and as an Artifact. Relative paths resolve against the document's folder; when rendering a copy from elsewhere, pass `--base <original folder>`. A missing image shows as a placeholder with its path, and the script lists it.

Before/after: two consecutive images whose alt text starts with `Before:` and `After:` (or `Antes:` and `Después:`) show side by side. A line right after them that is only a link (`[Open mockup](https://…)`) becomes a button under the after image.

Folded detail: a line `<!-- fold -->` right under a heading folds every subsection under it, one click to open (GitHub and other viewers hide the comment). A folded section stays one review section. Any other raw HTML still shows as text.

Decision cards: a list item that starts with the chosen option in bold and then has `Alternatives:`, `Pros:`, `Cons:` and `Why:` in that order (or `Alternativas:`, `Pros:`, `Contras:`, `Por qué:`) shows as a card with the writer's own words. With a label missing it stays an ordinary list item.

No dependencies: the Markdown renderer is in `scripts/lib/md.mjs`. Branching flow diagrams load Mermaid from a CDN when the page opens; offline they show as a list.
