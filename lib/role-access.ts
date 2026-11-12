import "server-only";

export type AppRole = "ADMIN" | "MANAGER" | "EMPLOYEE" | "CONTROLLER";

/** A project-control supervisor has read-only access across the portfolio. */
export function canViewAllProjects(role: AppRole) {
  return role === "ADMIN" || role === "CONTROLLER";
}

export function isProjectController(role: AppRole) {
  return role === "CONTROLLER";
}
