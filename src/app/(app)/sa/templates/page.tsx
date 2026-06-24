import { getSaTemplates } from "@/lib/data/saRepo";
import TemplatesClient from "./TemplatesClient";

// Server component: load the real global template library (RLS-gated to Reliance
// superadmins) and hand it to the client view. Empty in MOCK_MODE.
export default async function SATemplatesPage() {
  const templates = await getSaTemplates();
  return <TemplatesClient initialTemplates={templates} />;
}
