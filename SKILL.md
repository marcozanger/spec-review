---
name: spec-review
description: Turns a Markdown spec or implementation plan into a review page (a claude.ai Artifact that sends the review back to the session, or a local HTML file) — sections with OK / Change per section, progress, copy-comments button, plus short AI summaries, key decisions and flow diagrams. Use when the user says "/spec-review <file.md>", "convert this spec/plan to HTML", "make a review page for this spec", or "armá el html de la spec / del plan".
argument-hint: <file.md> [--fast] [--no-ai] [--lang en] [--html]
allowed-tools: Bash(node:*), Artifact, ArtifactComments
---

# Spec review

Scripts write all the HTML. Your job is to run them and have a subagent write the notes JSON. Don't read the Markdown file yourself, and never write or edit the HTML.

Arguments: `$ARGUMENTS` — a Markdown file, plus optional flags:
- `--fast`: notes by Haiku instead of Sonnet (about 1/20 of the cost; summaries are as good, flow diagrams come out shorter)
- `--no-ai`: plain page, no notes
- `--lang en`: page labels in English (default Spanish)
- `--html`: local HTML file only, even when the Artifact tool is available

## Artifact or local HTML

If the `Artifact` tool is available in this session and `--html` was not passed, use **artifact mode**: the page is published as a private claude.ai Artifact with a "Send to Claude" button, and the review arrives in this session as a comment. Otherwise use **HTML mode** (local file, the reviewer copies and pastes their comments).

## Steps

1. Check the notes:
   `node "${CLAUDE_SKILL_DIR}/scripts/render.mjs" "<file>" --status`
   It prints `fresh`, `stale` or `missing`. If `fresh`, or `--no-ai` was passed, go to step 3.

2. Write the notes with one subagent (Agent tool), `model: "sonnet"`, or `model: "haiku"` when `--fast` was passed. Use this prompt, with the paths filled in:

   > Run `node "<CLAUDE_SKILL_DIR>/scripts/outline.mjs" "<absolute path of the file>"`. Then read `<CLAUDE_SKILL_DIR>/reference/notes.md` and follow it exactly: write the notes JSON to the path the outline prints. Reply with one line.

   Wait for it to finish. Don't read the JSON it wrote.

3. Render the page:
   `node "${CLAUDE_SKILL_DIR}/scripts/render.mjs" "<file>" [--lang en] [--artifact] [--base <folder>]`
   When `<file>` is a translated or otherwise moved copy (for example in the scratchpad), pass `--base` with the original document's folder so its local images are found. The script lists any image it could not find; fix the path or the flag before publishing.
   Pass `--artifact` in artifact mode. It prints the HTML path and how many notes it kept or dropped.

4. HTML mode: reply in two or three lines: the HTML path (the user opens it in a browser), and the script's notes line. If it dropped many notes and `--fast` was used, suggest running without it.

   Artifact mode: publish the HTML path with the `Artifact` tool, `capabilities: {"comments": {}}`, `icon: "review"`, and a one-sentence `description`. To update a page already published in this conversation, publish the same path again (same URL). Don't load the artifact-design skill and don't edit the HTML: the scripts own it. Then reply in two or three lines: the link, the notes line, and "marcá cada sección y tocá *Enviar a Claude*". If the publish result does not confirm comment auto-replies are armed, say the button may stay disabled and the copy button is the fallback.

## When the review comes back (artifact mode)

The review arrives as a comment sent to Claude, starting with `[spec-review]`: one line per section marked CAMBIAR / CHANGE or with a note, and the OK sections folded into one line. Treat it as the user's feedback on the Markdown file:

1. Apply each requested change to the `.md` (that is the source; never edit the HTML). If a note is ambiguous, ask in the thread instead of guessing.
2. Re-render (steps 1–3: the notes go stale when the `.md` changes) and publish the same path again so the page updates in place.
3. Reply in the thread with `ArtifactComments` (`action: "reply"`): what you changed per section, in a few lines, and what you left open. Then `resolve` the thread.
