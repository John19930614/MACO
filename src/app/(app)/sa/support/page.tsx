import { getSupportTickets } from "@/lib/data/saRepo";
import SupportClient from "./SupportClient";

// Server component: fetch real support tickets (RLS-gated to superadmin),
// pass them as initial props to the client UI.
export default async function SupportQAPage() {
  const tickets = await getSupportTickets();
  return <SupportClient initialTickets={tickets} />;
}
