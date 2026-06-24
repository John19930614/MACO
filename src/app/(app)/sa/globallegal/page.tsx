import { getGlobalLegal } from "@/lib/data/saRepo";
import { GlobalLegalClient } from "./GlobalLegalClient";

export default async function SAGlobalLegalPage() {
  const items = await getGlobalLegal();
  return <GlobalLegalClient items={items} />;
}
