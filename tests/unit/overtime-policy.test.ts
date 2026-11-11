import { describe, expect, it } from "vitest";

import { canStartOvertime } from "../../lib/overtime-policy";

// ISO timestamps are chosen so their Asia/Tehran local time is explicit.
describe("overtime start policy", () => {
  it("allows remote overtime at any time, including Friday", () => {
    expect(canStartOvertime("REMOTE", new Date("2026-11-13T07:00:00.000Z"))).toEqual({ allowed: true });
  });

  it("allows onsite overtime all Thursday", () => {
    expect(canStartOvertime("ONSITE", new Date("2026-11-12T04:30:00.000Z"))).toEqual({ allowed: true });
  });

  it("rejects onsite work before 17:00 from Saturday through Wednesday", () => {
    expect(canStartOvertime("ONSITE", new Date("2026-11-11T12:00:00.000Z"))).toEqual({
      allowed: false,
      reason: "ONSITE_BEFORE_17",
    });
  });

  it("allows onsite work from exactly 17:00", () => {
    expect(canStartOvertime("ONSITE", new Date("2026-11-11T13:30:00.000Z"))).toEqual({ allowed: true });
  });

  it("rejects onsite work on Friday", () => {
    expect(canStartOvertime("ONSITE", new Date("2026-11-13T14:00:00.000Z"))).toEqual({
      allowed: false,
      reason: "ONSITE_FRIDAY",
    });
  });
});
