"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendDemoBookingAlert, sendDemoBookingAck } from "@/lib/email/demo-booking";
import { demoBookingSchema, toDemoBookingRow, firstSchemaIssue } from "./schema";

export type SubmitResult = { ok: true; id: string } | { ok: false; error: string };

export async function submitDemoBooking(formData: FormData): Promise<SubmitResult> {
  const raw: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    const parts = key.split(".");
    if (parts.length === 1) {
      raw[parts[0]] = value;
    } else if (parts.length === 2) {
      raw[parts[0]] = raw[parts[0]] ?? {};
      (raw[parts[0]] as Record<string, unknown>)[parts[1]] = value;
    }
  }

  const goals = formData.getAll("organisation.goals");
  const englishLevels = formData.getAll("organisation.englishLevels");

  if (raw.organisation && typeof raw.organisation === "object") {
    (raw.organisation as Record<string, unknown>).goals = goals;
    (raw.organisation as Record<string, unknown>).englishLevels = englishLevels;
  }

  raw.source = "website";

  const parsed = demoBookingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstSchemaIssue(parsed.error) };
  }

  const row = toDemoBookingRow(parsed.data);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("demo_bookings")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  await sendDemoBookingAlert(parsed.data);
  await sendDemoBookingAck(parsed.data);

  return { ok: true, id: data.id };
}
