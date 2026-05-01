import { test, expect } from "./fixtures";

test.describe("nudges cron endpoint", () => {
  test("rejects unauthenticated requests with 401", async ({ request }) => {
    const res = await request.post("/api/cron/nudges");
    expect(res.status()).toBe(401);
  });

  test("accepts the Vercel cron header and returns a summary", async ({
    request,
  }) => {
    const res = await request.post("/api/cron/nudges", {
      headers: { "x-vercel-cron": "1" },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      ok?: boolean;
      candidates?: number;
      inserted?: number;
      sent?: number;
      failed?: number;
      skipped?: number;
      dedup?: number;
    };
    expect(body.ok).toBe(true);
    // The shape must include the four counters; values depend on cohort.
    expect(typeof body.candidates).toBe("number");
    expect(typeof body.inserted).toBe("number");
    expect(typeof body.sent).toBe("number");
    expect(typeof body.failed).toBe("number");
    expect(typeof body.skipped).toBe("number");
    expect(typeof body.dedup).toBe("number");
  });
});
