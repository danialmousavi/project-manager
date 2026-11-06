
export const ASSIGNMENT_PREFIX =
  "__TASK_ASSIGNMENT_EVENT_V1__:";

export type AssignmentEvent = {
  fromUserId: string | null;
  fromUserName: string | null;
  toUserId: string | null;
  toUserName: string | null;
  note: string;
};

export function encodeAssignmentEvent(
  event: AssignmentEvent
) {
  return ASSIGNMENT_PREFIX + JSON.stringify(event);
}

export function decodeAssignmentEvent(content: string) {
  if (!content.startsWith(ASSIGNMENT_PREFIX)) {
    return null;
  }

  try {
    const data: unknown = JSON.parse(
      content.slice(ASSIGNMENT_PREFIX.length)
    );

    if (!data || typeof data !== "object") {
      return null;
    }

    const item = data as Record<string, unknown>;

    const nullableString = (value: unknown) =>
      typeof value === "string" ? value : null;

    return {
      fromUserId: nullableString(item.fromUserId),
      fromUserName: nullableString(item.fromUserName),
      toUserId: nullableString(item.toUserId),
      toUserName: nullableString(item.toUserName),
      note:
        typeof item.note === "string" ? item.note : "",
    } satisfies AssignmentEvent;
  } catch {
    return null;
  }
}
