import { getAllTenants } from "@/lib/data/saRepo";
import ImplClient from "./ImplClient";

// Server component: fetch real tenants (RLS-gated to superadmin) and render the
// onboarding kanban grouped by impl_status. Returns [] in MOCK_MODE.
export default async function SAImplPage() {
  const tenants = await getAllTenants();
  return <ImplClient tenants={tenants} />;
}
