import { getSubscriptions, getAllTenants } from "@/lib/data/saRepo";
import BillingClient from "./BillingClient";

// Server component: fetch the real subscription ledger + tenants (RLS-gated to
// superadmin), pass them to the client UI. Returns [] in MOCK_MODE.
export default async function BillingPage() {
  const [subscriptions, tenants] = await Promise.all([
    getSubscriptions(),
    getAllTenants(),
  ]);
  return <BillingClient subscriptions={subscriptions} tenants={tenants} />;
}
