
export const TASK_CHANGE_PREFIX =
  "__TASK_CHANGE_EVENT_V1__:";

export type TaskFieldName =
  | "title"
  | "description"
  | "priority"
  | "status"
  | "type"
  | "storyPoints"
  | "rank"
  | "acceptanceCriteria"
  | "sprintId"
  | "startDate"
  | "dueDate";

export type TaskFieldChange = {
  field: TaskFieldName;
  from: string | null;
  to: string | null;
};

export type TaskChangeEvent = {
  changes: TaskFieldChange[];
  note: string;
};

const allowedFields = new Set<TaskFieldName>([
  "title",
  "description",
  "priority",
  "status",
  "type",
  "storyPoints",
  "rank",
  "acceptanceCriteria",
  "sprintId",
  "startDate",
  "dueDate",
]);

export function encodeTaskChangeEvent(
  event: TaskChangeEvent
) {
  return TASK_CHANGE_PREFIX + JSON.stringify(event);
}

export function decodeTaskChangeEvent(content: string) {
  if (!content.startsWith(TASK_CHANGE_PREFIX)) {
    return null;
  }

  try {
    const raw: unknown = JSON.parse(
      content.slice(TASK_CHANGE_PREFIX.length)
    );

    if (
      !raw ||
      typeof raw !== "object" ||
      !("changes" in raw) ||
      !Array.isArray(raw.changes)
    ) {
      return null;
    }

    const changes: TaskFieldChange[] = [];

    for (const entry of raw.changes) {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const item = entry as Record<string, unknown>;

      if (
        typeof item.field !== "string" ||
        !allowedFields.has(item.field as TaskFieldName)
      ) {
        return null;
      }

      if (
        !(typeof item.from === "string" ||
          item.from === null) ||
        !(typeof item.to === "string" ||
          item.to === null)
      ) {
        return null;
      }

      changes.push({
        field: item.field as TaskFieldName,
        from: item.from as string | null,
        to: item.to as string | null,
      });
    }

    const note =
      "note" in raw && typeof raw.note === "string"
        ? raw.note
        : "";

    return {
      changes,
      note,
    } satisfies TaskChangeEvent;
  } catch {
    return null;
  }
}
