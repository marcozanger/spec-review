---
name: spec-review
description: Turns a Markdown spec or implementation plan into an HTML review page — sections with OK / Change per section, progress, copy-comments button, plus short AI summaries, key decisions and flow diagrams. Use when the user says "/spec-review <file.md>", "convert this spec/plan to HTML", "make a review page for this spec", or "armá el html de la spec / del plan".
argument-hint: <file.md> [--fast] [--no-ai] [--lang en]
allowed-tools: Bash(node:*)
---

# Spec review

Scripts write all the HTML. Your job is to run them and have a subagent write the notes JSON. Don't read the Markdown file yourself, and never write or edit the HTML.

Arguments: `$ARGUMENTS` — a Markdown file, plus optional flags:
- `--fast`: notes by Haiku instead of Sonnet (about 1/20 of the cost; summaries are as good, flow diagrams come out shorter)
- `--no-ai`: plain page, no notes
- `--lang en`: page labels in English (default Spanish)

## Steps

1. Check the notes:
   `node "${CLAUDE_SKILL_DIR}/scripts/render.mjs" "<file>" --status`
   It prints `fresh`, `stale` or `missing`. If `fresh`, or `--no-ai` was passed, go to step 3.

2. Write the notes with one subagent (Agent tool), `model: "sonnet"`, or `model: "haiku"` when `--fast` was passed. Use this prompt, with the paths filled in:

   > Run `node "<CLAUDE_SKILL_DIR>/scripts/outline.mjs" "<absolute path of the file>"`. Then read `<CLAUDE_SKILL_DIR>/reference/notes.md` and follow it exactly: write the notes JSON to the path the outline prints. Reply with one line.

   Wait for it to finish. Don't read the JSON it wrote.

3. Render the page:
   `node "${CLAUDE_SKILL_DIR}/scripts/render.mjs" "<file>" [--lang en]`
   It prints the HTML path and how many notes it kept or dropped.

4. Reply in two or three lines: the HTML path (the user opens it in a browser), and the script's notes line. If it dropped many notes and `--fast` was used, suggest running without it.
