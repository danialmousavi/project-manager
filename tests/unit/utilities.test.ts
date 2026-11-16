import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  isValidIranianMobile,
  isValidNationalId,
  normalizeNationalId,
  normalizePhone,
} from "../../lib/iranian-identity";
import { isoToJalali, jalaliToIso } from "../../lib/jalali";
import {
  encodeAssignmentEvent,
  decodeAssignmentEvent,
} from "../../lib/task-assignment-history";
import {
  encodeTaskChangeEvent,
  decodeTaskChangeEvent,
} from "../../lib/task-change-history";
import { calculateProjectProgress } from "../../lib/project-progress";

describe("input and date rules", () => {
  it("rejects malformed UUID and extra fields", () => {
    const schema = z.object({ projectId: z.uuid(), status: z.enum(["TODO", "DONE"]) }).strict();
    expect(schema.safeParse({ projectId: "../x", status: "DONE" }).success).toBe(false);
    expect(schema.safeParse({ projectId: crypto.randomUUID(), status: "UNKNOWN" }).success).toBe(false);
    expect(schema.safeParse({ projectId: crypto.randomUUID(), status: "DONE", role: "ADMIN" }).success).toBe(false);
  });

  it("normalizes and validates Iranian identity", () => {
    expect(normalizeNationalId("۰۰۸۴۵۷۵۹۴۸")).toBe("0084575948");
    expect(isValidNationalId("0084575948")).toBe(true);
    expect(isValidNationalId("1111111111")).toBe(false);
    expect(normalizePhone("+۹۸۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789");
    expect(isValidIranianMobile("09123456789")).toBe(true);
    expect(isValidIranianMobile("1234")).toBe(false);
  });

  it("round-trips Jalali dates and rejects impossible dates", () => {
    expect(jalaliToIso("۱۴۰۳/۰۱/۰۱")).toBe("2024-03-20");
    expect(isoToJalali("2024-03-20")).toBe("1403/01/01");
    expect(jalaliToIso("1403/13/01")).toBeNull();
    expect(jalaliToIso("bad-date")).toBeNull();
  });
});

describe("history serialization", () => {
  it("round-trips assignment and field changes", () => {
    const assignment = { fromUserId: null, fromUserName: null, toUserId: "a", toUserName: "A", note: "audit" };
    expect(decodeAssignmentEvent(encodeAssignmentEvent(assignment))).toEqual(assignment);
    const event = { note: "audit", changes: [
      { field: "status" as const, from: "TODO", to: "DONE" },
      { field: "storyPoints" as const, from: null, to: "8" },
    ] };
    expect(decodeTaskChangeEvent(encodeTaskChangeEvent(event))).toEqual(event);
  });

  it("rejects invalid history payloads", () => {
    expect(decodeTaskChangeEvent("__TASK_CHANGE_EVENT_V1__:{bad")).toBeNull();
    expect(decodeTaskChangeEvent("__TASK_CHANGE_EVENT_V1__:{\"changes\":[{\"field\":\"role\",\"from\":null,\"to\":\"ADMIN\"}]}")).toBeNull();
    expect(decodeAssignmentEvent("plain comment")).toBeNull();
  });
});

describe("project progress", () => {
  it.each([
    ["no tasks", [], 0],
    ["all TODO", [{ status: "TODO" as const, count: 3 }], 0],
    ["all DONE", [{ status: "DONE" as const, count: 3 }], 100],
    [
      "mixed statuses",
      [
        { status: "TODO" as const, count: 1 },
        { status: "IN_PROGRESS" as const, count: 1 },
        { status: "IN_REVIEW" as const, count: 1 },
        { status: "DONE" as const, count: 1 },
      ],
      60,
    ],
    [
      "weighted counts",
      [
        { status: "TODO" as const, count: 3 },
        { status: "DONE" as const, count: 1 },
      ],
      25,
    ],
  ])("calculates %s", (_name, groups, expected) => {
    expect(calculateProjectProgress(groups)).toBe(expected);
  });
});
