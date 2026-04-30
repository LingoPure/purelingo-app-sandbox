/**
 * Employer-dashboard auth — single shared password for the demo.
 *   POST   { password } → sets the lp_employer cookie on success
 *   DELETE                → clears the cookie (sign out)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  EMPLOYER_COOKIE_NAME,
  expectedCookieValue,
  passwordMatches,
} from "@/lib/employer/auth";

const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

type Body = { password?: string };

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.password || !passwordMatches(body.password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: EMPLOYER_COOKIE_NAME,
    value: expectedCookieValue(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: EMPLOYER_COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
