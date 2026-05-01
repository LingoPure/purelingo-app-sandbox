/**
 * POST /api/employer/staff/import — bulk-create or update staff from CSV.
 *
 * Body: { csv: string }
 * Returns: ParseResult (errors only) + ImportResult (per-row outcomes).
 *
 * Gated by the employer cookie. Capped at 1,000 rows per request to keep
 * the auth.admin.listUsers paging predictable; bigger imports should be
 * split client-side.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";
import {
  parseStaffCsv,
  importStaffRows,
} from "@/lib/employer/staff-import";

const BodySchema = z.object({ csv: z.string().min(1).max(500_000) });
const MAX_ROWS = 1000;

export async function POST(request: NextRequest) {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) return auth;
  const employerId = auth.admin.employerId;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const parse = parseStaffCsv(body.csv);
  if (parse.rows.length > MAX_ROWS) {
    return NextResponse.json(
      {
        error: `Too many rows (${parse.rows.length}). Split the file into chunks of ${MAX_ROWS} or fewer.`,
      },
      { status: 400 }
    );
  }

  const importResult = await importStaffRows(
    adminSupabase(),
    employerId,
    parse.rows
  );

  return NextResponse.json({
    ok: true,
    parseErrors: parse.errors,
    parsedCount: parse.rows.length,
    import: importResult,
  });
}
