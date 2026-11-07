import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, render, main } from "./helpers.mjs";

const FIXTURE = join(ROOT, "tests/fixtures/plain.md");
const GOLDEN = join(ROOT, "tests/fixtures/plain.main.html");

test("a document without the layer conventions renders as before", () => {
  const got = main(render(FIXTURE).html);
  if (process.env.UPDATE_GOLDEN) writeFileSync(GOLDEN, got);
  assert.equal(got, readFileSync(GOLDEN, "utf8"));
});
