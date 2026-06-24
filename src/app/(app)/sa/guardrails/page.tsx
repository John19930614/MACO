import { getGuardrails } from "@/lib/data/saRepo";
import GuardrailsClient from "./GuardrailsClient";

// Server component: fetch persisted guardrail rows (RLS-gated to superadmin),
// pass them as initial props. The client merges them over the default catalog.
export default async function GuardrailsPage() {
  const guardrails = await getGuardrails();
  return <GuardrailsClient initialGuardrails={guardrails} />;
}
