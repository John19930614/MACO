import { getEligibleDailySuggestion } from "@/lib/devcenter/suggestions";
import { getConvertedSuggestionIds, getDismissedSuggestionIds } from "@/lib/devcenter/repo";
import { isSuperadmin, getServerProfileId } from "@/lib/auth/session";
import { MOCK_MODE } from "@/lib/env";
import { DailySuggestionCard } from "./DailySuggestionCard";

export async function DailySuggestion() {
  let excludeIds = new Set<string>();

  // MOCK_MODE has no dev_tasks/dismissed_suggestions tables to check against —
  // every suggestion is eligible in that preview.
  if (!MOCK_MODE && (await isSuperadmin())) {
    const profileId = await getServerProfileId();
    const [dismissed, converted] = await Promise.all([
      getDismissedSuggestionIds(profileId),
      getConvertedSuggestionIds(),
    ]);
    excludeIds = new Set([...dismissed, ...converted]);
  }

  const initialSuggestion = getEligibleDailySuggestion(excludeIds);
  return <DailySuggestionCard initialSuggestion={initialSuggestion} />;
}
