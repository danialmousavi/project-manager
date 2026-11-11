export type OvertimeWorkMode = "ONSITE" | "REMOTE";

type TehranClock = {
  weekday: "Sat" | "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
  hour: number;
};

function tehranClock(now: Date): TehranClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const weekday = value("weekday");
  const hour = Number(value("hour"));

  if (!weekday || !Number.isInteger(hour)) {
    throw new Error("Could not determine Asia/Tehran time");
  }

  return { weekday: weekday as TehranClock["weekday"], hour };
}

export type OvertimeStartEligibility =
  | { allowed: true }
  | { allowed: false; reason: "ONSITE_BEFORE_17" | "ONSITE_FRIDAY" };

/**
 * Remote work can be registered at any time. On-site work is eligible from
 * 17:00 on Saturday–Wednesday and all day Thursday. Friday on-site work is
 * not an available work mode in the agreed policy.
 */
export function canStartOvertime(
  workMode: OvertimeWorkMode,
  now = new Date()
): OvertimeStartEligibility {
  if (workMode === "REMOTE") return { allowed: true };

  const { weekday, hour } = tehranClock(now);
  if (weekday === "Thu") return { allowed: true };
  if (weekday === "Fri") return { allowed: false, reason: "ONSITE_FRIDAY" };
  if (hour >= 17) return { allowed: true };
  return { allowed: false, reason: "ONSITE_BEFORE_17" };
}

export function overtimeStartErrorMessage(reason: "ONSITE_BEFORE_17" | "ONSITE_FRIDAY") {
  return reason === "ONSITE_BEFORE_17"
    ? "ثبت اضافه‌کار حضوری از ساعت ۱۷:۰۰ به بعد امکان‌پذیر است"
    : "ثبت اضافه‌کار حضوری در روز جمعه امکان‌پذیر نیست";
}
