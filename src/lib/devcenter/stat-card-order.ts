/**
 * Ordering for the Overview stat grid at /admin/dev-command.
 *
 * The three risk/blocker cards (security blockers, failed reviews, experience
 * issues) are pinned first so they never get lost among routine activity
 * counts — even when their value is zero. All other cards keep their
 * existing relative order after them.
 */

export const RISK_CARD_KEYS = ["security_warnings", "failed_runs", "xp_failures"] as const;

export function reorderStatCards<T extends { key: string }>(cards: T[]): T[] {
  const riskCards = RISK_CARD_KEYS
    .map((key) => cards.find((c) => c.key === key))
    .filter((c): c is T => Boolean(c));

  const riskKeys: readonly string[] = RISK_CARD_KEYS;
  const restCards = cards.filter((c) => !riskKeys.includes(c.key));

  return [...riskCards, ...restCards];
}
