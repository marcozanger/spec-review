# spec-review

A Claude Code skill that turns a Markdown spec or plan into a review page (HTML): sections with OK / Change per section, a progress rail, and a "Copy feedback" button.

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

Output, next to the source file:
- `my-feature.review.html` — open it in a browser
- `my-feature.review.json` — the AI's notes; reused while the `.md` does not change (re-render costs 0 tokens)

Render without AI (plain page, no summaries or diagrams):

```
node scripts/render.mjs docs/specs/my-feature.md
```

No dependencies: the Markdown renderer is in `scripts/lib/md.mjs`. Branching flow diagrams load Mermaid from a CDN when the page opens; offline they show as a list.
