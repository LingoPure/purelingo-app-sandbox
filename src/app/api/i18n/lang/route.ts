/**
 * Set / clear the UI language cookie.
 *
 *   POST   { code: "vi" }  → sets lp_lang cookie + persists native_language
 *                            on the student row (if signed in)
 *   DELETE                  → clears the cookie (revert to default / profile)
 */

import { NextRequest, NextResponse } from "next/server";
import { isLanguageCode } from "@/lib/i18n/dictionary";
import { LANG_COOKIE } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

type Body = { code?: string };

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.code || !isLanguageCode(body.code)) {
    return NextResponse.json(
      { error: "Invalid language code" },
      { status: 400 }
    );
  }

  const res = NextResponse.json({ ok: true, code: body.code });
  res.cookies.set({
    name: LANG_COOKIE,
    value: body.code,
    httpOnly: false, // readable from JS so the pill can show the active state
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  // Persist on the students row if the caller is authenticated, so the
  // choice survives cookie clearing across devices.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("students")
        .update({ native_language: body.code })
        .eq("id", user.id);
    }
  } catch {
    // Anonymous request — cookie alone is fine.
  }

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: LANG_COOKIE,
    value: "",
    httpOnly: false,
    path: "/",
    maxAge: 0,
  });
  return res;
}
