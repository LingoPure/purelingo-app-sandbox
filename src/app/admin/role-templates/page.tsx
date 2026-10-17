// @explanatory-header-exempt — portal surface; the page heading is the explanatory header
import { createClient } from "@/lib/supabase/server";
import { loadPendingRoleTemplates } from "@/lib/platform/role-templates";
import { PageHeading } from "../page-heading";
import { RoleTemplatesClient } from "./role-templates-client";

export default async function AdminRoleTemplatesPage() {
  const supabase = await createClient();
  const pending = await loadPendingRoleTemplates(supabase);

  return (
    <div>
      <PageHeading
        title="Role templates"
        lead="Roles an employer has submitted to share platform-wide. Approving makes the sanitized definition — description, baselines, skill rationale — selectable from every OTHER employer's staff-invite flow. Each adopting employer gets their own copy; nothing here is ever read live cross-employer."
      />
      <RoleTemplatesClient initial={pending} />
    </div>
  );
}
