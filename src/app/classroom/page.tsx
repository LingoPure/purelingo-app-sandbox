import { redirect } from "next/navigation";

/**
 * Bare /classroom has no session to open — the real surface is
 * /classroom/[sessionId], reached from the dashboard "Schedule a demo class"
 * card. Send a guessed/stray /classroom to the dashboard instead of 404-ing.
 */
export default function ClassroomIndex() {
  redirect("/dashboard");
}
