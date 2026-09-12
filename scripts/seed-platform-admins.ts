/**
 * Platform-admin seed — C1 bootstrap.
 *
 * Upserts every ADMIN_EMAILS allowlist entry (or the operator defaults) into
 * platform_admins so /admin surfaces can gate on the canonical DB table.
 * Idempotent: re-running only adds missing rows.
 *
 *   npm run admin:seed-platform
 */

import { config } from "dotenv";
import { bootstrapPlatformAdmins } from "@/lib/platform-admin";

config();

async function main() {
  const added = await bootstrapPlatformAdmins();
  console.log(`platform_admins: ${added} allowlisted admin(s) present/added.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });