import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertTestDatabase } from "../database/guard";
import { commentFactory, projectFactory, taskFactory, userFactory } from "../database/fixtures";

vi.mock("server-only", () => ({}));

let db: PrismaClient;
let getDashboardData: typeof import("../../lib/dashboard-data").getDashboardData;

beforeAll(async () => {
  const url = await assertTestDatabase();
  process.env.DATABASE_URL = url;
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  await db.$connect();
  ({ getDashboardData } = await import("../../lib/dashboard-data"));
});

beforeEach(async () => {
  await assertTestDatabase();
  await db.taskComment.deleteMany();
  await db.progressHistory.deleteMany();
  await db.task.deleteMany();
  await db.sprint.deleteMany();
  await db.projectMember.deleteMany();
  await db.project.deleteMany();
  await db.companyMember.deleteMany();
  await db.company.deleteMany();
  await db.session.deleteMany();
  await db.loginAttempt.deleteMany();
  await db.user.deleteMany();
});

afterAll(async () => { await db?.$disconnect(); });

describe("dashboard visibility and accuracy", () => {
  it("keeps employee metrics and activity within assigned tasks in accessible projects", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const employee = await userFactory(db);
    const outsider = await userFactory(db);
    const project = await projectFactory(db, admin.id, manager.id, [employee.id]);
    const foreign = await projectFactory(db, admin.id, manager.id, [outsider.id]);
    const assigned = await taskFactory(db, project.id, admin.id, { assigneeId: employee.id, status: "IN_PROGRESS" });
    const unassigned = await taskFactory(db, project.id, admin.id, { status: "IN_REVIEW" });
    const hidden = await taskFactory(db, foreign.id, admin.id, { assigneeId: outsider.id });
    await commentFactory(db, assigned.id, manager.id, "Visible comment");
    await commentFactory(db, assigned.id, manager.id, "__TASK_CHANGE_EVENT_V1__:{}");
    await commentFactory(db, unassigned.id, manager.id, "Private team comment");
    await commentFactory(db, hidden.id, manager.id, "Foreign comment");
    const deleted = await taskFactory(db, project.id, admin.id, { assigneeId: employee.id, status: "DONE" });
    await db.task.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });

    const data = await getDashboardData(employee);
    expect(data.metrics).toMatchObject({ projects: 1, openTasks: 1, reviewTasks: 0 });
    expect(data.myTasks.map((task) => task.id)).toEqual([assigned.id]);
    expect(data.projects[0].progress).toBe(70);
    expect(data.comments.map((comment) => comment.content)).toEqual(["Visible comment"]);
    expect(data.workload).toEqual([]);
  });

  it("shows managers their team workload and the overdue task count", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const employee = await userFactory(db);
    const project = await projectFactory(db, admin.id, manager.id, [employee.id]);
    const task = await taskFactory(db, project.id, manager.id, { assigneeId: employee.id });
    await db.task.update({ where: { id: task.id }, data: { dueDate: new Date("2020-01-01T00:00:00.000Z") } });

    const data = await getDashboardData(manager);
    expect(data.metrics).toMatchObject({ openTasks: 1, overdueTasks: 1 });
    expect(data.projects[0].overdue).toBe(1);
    expect(data.workload).toEqual([expect.objectContaining({ id: employee.id, count: 1, overdue: 1 })]);
  });
});
