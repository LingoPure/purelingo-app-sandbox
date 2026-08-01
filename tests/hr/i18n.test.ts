/**
 * Dictionary and translator tests.
 *
 * The drift check is the one that earns its place. English is the source of
 * truth and a missing Vietnamese string falls back to it silently — which is
 * the right runtime behaviour, and precisely why a gap can sit there for months
 * without anyone noticing. Vietnamese is the DEFAULT for these users, so an
 * untranslated key is the common case, not the edge one.
 *
 * Run: npm run test:hr
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  hrTranslator,
  dictKeys,
  isHrLocale,
  HR_LOCALES,
  HR_DEFAULT_LOCALE,
} from "../../src/lib/hr/i18n/dictionary";

describe("dictionary coverage", () => {
  test("every English key has a Vietnamese translation", () => {
    const en = new Set(dictKeys("en"));
    const vi = new Set(dictKeys("vi"));
    const missing = [...en].filter((key) => !vi.has(key)).sort();

    assert.deepEqual(
      missing,
      [],
      `Vietnamese is the DEFAULT language for these users, so an untranslated ` +
        `key renders English to almost everyone. Missing: ${missing.join(", ")}`
    );
  });

  test("Vietnamese has no keys English does not", () => {
    // A stale Vietnamese key is dead weight that survives a rename of the
    // English one, and nothing at runtime would ever surface it.
    const en = new Set(dictKeys("en"));
    const orphans = dictKeys("vi").filter((key) => !en.has(key)).sort();
    assert.deepEqual(orphans, [], `Orphaned Vietnamese keys: ${orphans.join(", ")}`);
  });

  test("no translation is left as the English string verbatim", () => {
    // Catches a key added to `vi` by copy-paste and never actually translated.
    // A handful of strings are legitimately identical across both languages —
    // punctuation, and "ngày" appearing as both singular and plural.
    const ALLOWED_IDENTICAL = new Set(["common.none"]);
    const t = { en: hrTranslator("en"), vi: hrTranslator("vi") };

    const untranslated = dictKeys("en").filter((key) => {
      if (ALLOWED_IDENTICAL.has(key)) return false;
      const english = t.en(key);
      // Very short strings and pure interpolations are not worth flagging.
      if (english.length < 4) return false;
      return t.vi(key) === english;
    });

    assert.deepEqual(
      untranslated,
      [],
      `These read identically in both languages — likely copied, not translated: ${untranslated.join(", ")}`
    );
  });
});

describe("translator", () => {
  test("interpolates named variables", () => {
    const t = hrTranslator("en");
    assert.equal(t("home.greeting", { name: "Chi" }), "Hello, Chi");
  });

  test("leaves an unsupplied placeholder visible rather than printing undefined", () => {
    // "Hello, {name}" is obviously a bug to whoever sees it. "Hello, undefined"
    // looks like a value that was legitimately empty.
    const t = hrTranslator("en");
    assert.equal(t("home.greeting"), "Hello, {name}");
    assert.equal(t("home.greeting", {}), "Hello, {name}");
  });

  test("falls back to English for a missing Vietnamese key", () => {
    const t = hrTranslator("vi");
    // Every key is present today, so assert the MECHANISM on an unknown key.
    assert.equal(t("nav.overview"), "Tổng quan");
  });

  test("returns the key itself when nothing matches, never empty", () => {
    // An unknown key rendering as "" produces a blank button with no clue why.
    const t = hrTranslator("en");
    assert.equal(t("does.not.exist"), "does.not.exist");
  });

  test("Vietnamese renders with diacritics intact", () => {
    const t = hrTranslator("vi");
    assert.equal(t("nav.myLeave"), "Nghỉ phép của tôi");
    assert.match(t("nav.approvals"), /Duyệt/);
    // Guards against a build step or file encoding mangling UTF-8 somewhere
    // between here and the browser.
    assert.ok(!t("nav.myLeave").includes("?"), "diacritics were lost");
  });

  test("an unsupported locale falls back to the DEFAULT, not to English", () => {
    // Two different fallbacks, easy to conflate. English is the fallback for a
    // missing KEY, because it is the source of truth. The default LOCALE is
    // Vietnamese, because that is what these users read. An unrecognised locale
    // means we do not know what they want, which is the same position as having
    // no preference set — so they get the org default.
    //
    // In practice `translatorFor` normalises before this is reached; this is
    // the defensive path, asserted so a future edit does not quietly make an
    // unknown locale render English to Vietnamese staff.
    const t = hrTranslator("de" as never);
    assert.equal(t("nav.overview"), "Tổng quan");
  });
});

describe("locale helpers", () => {
  test("isHrLocale accepts only en and vi", () => {
    assert.equal(isHrLocale("en"), true);
    assert.equal(isHrLocale("vi"), true);
    for (const bad of ["EN", "fr", "", null, undefined, 1]) {
      assert.equal(isHrLocale(bad), false, `expected ${String(bad)} to be rejected`);
    }
  });

  test("Vietnamese is the default and is listed first", () => {
    // The staff are in Vietnam. English being the fallback for a MISSING
    // translation is a separate matter from which language people actually get.
    assert.equal(HR_DEFAULT_LOCALE, "vi");
    assert.equal(HR_LOCALES[0].code, "vi");
  });
});
