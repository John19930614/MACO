/**
 * Minimal circuit breaker for the AI provider (server-only, pure).
 *
 * After `threshold` consecutive failures the circuit OPENS: subsequent calls
 * short-circuit immediately for `cooldownMs`, so a provider outage degrades to
 * the deterministic heuristic fallback at once instead of every request waiting
 * out the full 30s network timeout (which is what piles up latency and cost
 * during an incident). After the cooldown the circuit goes HALF-OPEN and lets a
 * single trial request through — success CLOSES it, another failure RE-OPENS it
 * for a fresh cooldown.
 *
 * Deterministic: the clock is injected (`now` epoch-ms) so it is unit-testable
 * without timers.
 */
export type CircuitState = "closed" | "open" | "half_open";

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private trialInFlight = false;

  constructor(
    private readonly threshold = 4,
    private readonly cooldownMs = 30_000,
  ) {}

  /** Current state given the clock. */
  state(now: number): CircuitState {
    if (this.failures < this.threshold) return "closed";
    if (now - this.openedAt >= this.cooldownMs) return "half_open";
    return "open";
  }

  /**
   * Acquire permission to make a call. Returns false when the circuit is open
   * (or a half-open trial is already in flight), in which case the caller should
   * skip the network and fall back. Acquires the single half-open trial slot as
   * a side effect when half-open.
   */
  canRequest(now: number): boolean {
    const s = this.state(now);
    if (s === "open") return false;
    if (s === "half_open") {
      if (this.trialInFlight) return false;
      this.trialInFlight = true;
    }
    return true;
  }

  /** Record a successful call — closes the circuit. */
  onSuccess(): void {
    this.failures = 0;
    this.trialInFlight = false;
  }

  /** Record a failed call — opens the circuit once the threshold is reached. */
  onFailure(now: number): void {
    this.failures += 1;
    this.trialInFlight = false;
    if (this.failures >= this.threshold) this.openedAt = now;
  }
}
