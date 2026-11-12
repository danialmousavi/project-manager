export type SprintStatus =
  | "FUTURE"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

export type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
  startSnapshot: {
    startedAt: string;
    plannedTaskCount: number;
    plannedStoryPoints: number;
  } | null;
};
