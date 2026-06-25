import { describe, it, expect } from "vitest";
import { CircuitBreaker } from "@/lib/ai/circuit";

describe("CircuitBreaker", () => {
  it("stays closed and allows requests below the failure threshold", () => {
    const cb = new CircuitBreaker(3, 1000);
    const t = 0;
    expect(cb.state(t)).toBe("closed");
    cb.onFailure(t);
    cb.onFailure(t);
    expect(cb.state(t)).toBe("closed"); // 2 < 3
    expect(cb.canRequest(t)).toBe(true);
  });

  it("opens after the threshold of consecutive failures and short-circuits", () => {
    const cb = new CircuitBreaker(3, 1000);
    cb.onFailure(0);
    cb.onFailure(0);
    cb.onFailure(0); // 3rd → opens
    expect(cb.state(0)).toBe("open");
    expect(cb.canRequest(0)).toBe(false);
    expect(cb.canRequest(999)).toBe(false); // still within cooldown
  });

  it("transitions to half-open after the cooldown and allows ONE trial", () => {
    const cb = new CircuitBreaker(2, 1000);
    cb.onFailure(0);
    cb.onFailure(0); // opens at t=0
    expect(cb.state(1000)).toBe("half_open"); // cooldown elapsed
    expect(cb.canRequest(1000)).toBe(true);    // first trial allowed...
    expect(cb.canRequest(1000)).toBe(false);   // ...but only one in flight
  });

  it("closes again when the half-open trial succeeds", () => {
    const cb = new CircuitBreaker(2, 1000);
    cb.onFailure(0);
    cb.onFailure(0);
    expect(cb.canRequest(1000)).toBe(true); // half-open trial
    cb.onSuccess();
    expect(cb.state(1000)).toBe("closed");
    expect(cb.canRequest(1000)).toBe(true);
  });

  it("re-opens when the half-open trial fails", () => {
    const cb = new CircuitBreaker(2, 1000);
    cb.onFailure(0);
    cb.onFailure(0);
    expect(cb.canRequest(1000)).toBe(true); // half-open trial
    cb.onFailure(1000);                     // trial fails → re-open at t=1000
    expect(cb.state(1500)).toBe("open");    // fresh cooldown from 1000
    expect(cb.state(2000)).toBe("half_open");
  });

  it("a success resets the failure count", () => {
    const cb = new CircuitBreaker(3, 1000);
    cb.onFailure(0);
    cb.onFailure(0);
    cb.onSuccess();
    cb.onFailure(0);
    cb.onFailure(0);
    expect(cb.state(0)).toBe("closed"); // count reset, only 2 since success
  });
});
