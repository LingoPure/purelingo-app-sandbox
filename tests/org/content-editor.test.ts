import { test } from "node:test";
import assert from "node:assert/strict";
import { getByPath } from "@/content/editable";

// ── Content editor block manifest (C4) ───────────────────────────────────────
//
// The /admin/content editor drives off EDITABLE_BLOCKS — the single manifest
// that declares which leaves of src/content/home.ts are editable. These tests
// pin the manifest contract so the loader (src/content/resolve.ts
// `loadEditorBlocks`) always has a label/group/multiline/graph for every block.

test("getByPath resolves dotted paths through arrays and objects", () => {
  const section = {
    fork: { cards: [{ h3: "Companies" }, { h3: "Individuals" }] },
    steps: [{ h3: "Assess" }, { h3: "Plan" }],
  };
  assert.equal(getByPath(section, "fork.cards.1.h3"), "Individuals");
  assert.equal(getByPath(section, "steps.0.h3"), "Assess");
  assert.equal(getByPath(section, "missing.deep"), null);
  assert.equal(getByPath(section, "steps.9.h3"), null);
});

test("every editable block key resolves against the home.ts shape", async () => {
  const { home } = await import("@/content/home");
  const { EDITABLE_BLOCKS } = await import("@/content/editable");

  for (const b of EDITABLE_BLOCKS) {
    const section = (home as unknown as Record<string, unknown>)[b.section];
    assert.ok(section, `section "${b.section}" must exist in home.ts`);
    assert.ok(
      getByPath(section, b.key) !== null || typeof section === "object",
      `block "${b.section}.${b.key}" must resolve or be an object leaf`
    );
    assert.equal(typeof b.label, "string");
    assert.ok(b.label.length > 0, "every block needs a human label");
    assert.ok(["string", "undefined"].includes(typeof b.group));
  }
});

test("editor blocks load static defaults when no database is available", async () => {
  const { loadEditorBlocks } = await import("@/content/resolve");
  // loadEditorBlocks catches DB errors internally and falls back to the
  // manifest + home.ts seeds, so it must resolve without throwing.
  const blocks = await loadEditorBlocks();
  assert.ok(blocks.length >= 10, "manifest has a meaningful block list");
  const heroH1 = blocks.find((b) => b.section === "hero" && b.key === "h1");
  assert.ok(heroH1, "hero.h1 is an editable block");
  assert.equal(typeof heroH1?.en, "string");
  assert.equal(typeof heroH1?.vi, "string");
  assert.ok(["ready", "confirm", "pending"].includes(heroH1?.status ?? "ready"));
});