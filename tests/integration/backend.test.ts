import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertTestDatabase } from "../database/guard";
import {
  commentFactory,
  projectFactory,
  projectHistoryFactory,
  sessionFactory,
  sprintFactory,
  taskFactory,
  userFactory,
} from "../database/fixtures";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));

type Actor = { id: string; role: "ADMIN" | "MANAGER" | "EMPLOYEE" | "CONTROLLER" };
let actor: Actor | null = null;
const auth = await import("@/lib/auth");
vi.mocked(auth.getCurrentUser).mockImplementation(async () => actor as never);

let db: PrismaClient;
let projectsRoute: typeof import("../../app/api/v1/projects/route");
let projectRoute: typeof import("../../app/api/v1/projects/[id]/route");
let taskListRoute: typeof import("../../app/api/v1/projects/[id]/tasks/route");
let taskRoute: typeof import("../../app/api/v1/tasks/[id]/route");
let sprintRoute: typeof import("../../app/api/v1/projects/[id]/sprints/route");
let membersRoute: typeof import("../../app/api/v1/projects/[id]/members/route");
let kanbanRoute: typeof import("../../app/api/v1/projects/[id]/kanban/route");
let progressRoute: typeof import("../../app/api/v1/projects/[id]/progress/route");
let usersRoute: typeof import("../../app/api/v1/users/route");
let userRoute: typeof import("../../app/api/v1/users/[id]/route");

const url = (path: string) => `http://localhost:3000/api/v1/${path}`;
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (method: string, path: string, body?: unknown, origin = true) =>
  new NextRequest(url(path), {
    method,
    headers: origin ? { origin: "http://localhost:3000", "content-type": "application/json" } : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeAll(async () => {
  const testUrl = await assertTestDatabase();
  process.env.DATABASE_URL = testUrl;
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) });
  await db.$connect();
  [projectsRoute, projectRoute, taskListRoute, taskRoute, sprintRoute, membersRoute, kanbanRoute, progressRoute, usersRoute, userRoute] = await Promise.all([
    import("../../app/api/v1/projects/route"),
    import("../../app/api/v1/projects/[id]/route"),
    import("../../app/api/v1/projects/[id]/tasks/route"),
    import("../../app/api/v1/tasks/[id]/route"),
    import("../../app/api/v1/projects/[id]/sprints/route"),
    import("../../app/api/v1/projects/[id]/members/route"),
    import("../../app/api/v1/projects/[id]/kanban/route"),
    import("../../app/api/v1/projects/[id]/progress/route"),
    import("../../app/api/v1/users/route"),
    import("../../app/api/v1/users/[id]/route"),
  ]);
});

beforeEach(async () => {
  await assertTestDatabase();
  actor = null;
  await db.taskComment.deleteMany();
  await db.progressHistory.deleteMany();
  await db.task.deleteMany();
  await db.sprint.deleteMany();
  await db.projectMember.deleteMany();
  await db.project.deleteMany();
  await db.session.deleteMany();
  await db.loginAttempt.deleteMany();
  await db.user.deleteMany();
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("authorization and input validation through real route handlers", () => {
  it("rejects unauthenticated requests and invalid Origin", async () => {
    expect((await projectsRoute.POST(request("POST", "projects", {}))).status).toBe(401);
    const admin = await userFactory(db, "ADMIN");
    actor = admin;
    expect((await projectsRoute.POST(request("POST", "projects", {}, false))).status).toBe(403);
    expect((await usersRoute.POST(request("POST", "users", {}, false))).status).toBe(403);
  });

  it("blocks manager and employee IDOR across projects", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const employee = await userFactory(db);
    const otherManager = await userFactory(db, "MANAGER");
    const own = await projectFactory(db, admin.id, manager.id, [employee.id]);
    const foreign = await projectFactory(db, admin.id, otherManager.id);
    const foreignTask = await taskFactory(db, foreign.id, admin.id);
    actor = manager;
    expect((await kanbanRoute.GET(request("GET", `projects/${foreign.id}/kanban`), context(foreign.id))).status).toBe(403);
    expect((await taskRoute.PATCH(request("PATCH", `tasks/${foreignTask.id}`, { status: "DONE" }), context(foreignTask.id))).status).toBe(403);
    expect((await projectRoute.PATCH(request("PATCH", `projects/${foreign.id}`, { status: "ACTIVE" }), context(foreign.id))).status).toBe(403);
    actor = employee;
    expect((await kanbanRoute.GET(request("GET", `projects/${foreign.id}/kanban`), context(foreign.id))).status).toBe(403);
    expect((await taskListRoute.POST(request("POST", `projects/${own.id}/tasks`, {}), context(own.id))).status).toBe(403);
    expect((await taskRoute.DELETE(request("DELETE", `tasks/${foreignTask.id}`), context(foreignTask.id))).status).toBe(403);
    expect((await usersRoute.POST(request("POST", "users", {}))).status).toBe(403);
    expect((await db.task.findUnique({ where: { id: foreignTask.id } }))?.status).toBe("TODO");
  });

  it("rejects invalid UUID, extra fields and cross-project sprint assignment", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const one = await projectFactory(db, admin.id, manager.id);
    const two = await projectFactory(db, admin.id, manager.id);
    const sprint = await sprintFactory(db, two.id);
    const task = await taskFactory(db, one.id, admin.id);
    actor = admin;
    expect((await taskRoute.PATCH(request("PATCH", "tasks/nope", { status: "DONE" }), context("nope"))).status).toBe(400);
    expect((await taskRoute.PATCH(request("PATCH", `tasks/${task.id}`, { status: "DONE", role: "ADMIN" }), context(task.id))).status).toBe(400);
    expect((await sprintRoute.PATCH(request("PATCH", `projects/${two.id}/sprints`, { action: "ASSIGN_TASK", sprintId: sprint.id, taskId: task.id }), context(two.id))).status).toBe(409);
    expect((await db.task.findUnique({ where: { id: task.id } }))?.sprintId).toBeNull();
  });

  it("blocks unauthorized assignee and projectId mass assignment", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const employee = await userFactory(db);
    const one = await projectFactory(db, admin.id, manager.id);
    const two = await projectFactory(db, admin.id, manager.id, [employee.id]);
    actor = manager;
    const body = { title: "Audit assignment", description: "", priority: "MEDIUM", status: "TODO", startDate: null, dueDate: null, assigneeId: employee.id };
    expect((await taskListRoute.POST(request("POST", `projects/${one.id}/tasks`, body), context(one.id))).status).toBe(400);
    expect((await taskListRoute.POST(request("POST", `projects/${one.id}/tasks`, { ...body, assigneeId: null, projectId: two.id }), context(one.id))).status).toBe(400);
    expect(await db.task.count()).toBe(0);
  });

  it("creates, reads, validates, and updates Scrum task fields", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const project = await projectFactory(db, admin.id, manager.id);
    actor = manager;

    const payload = {
      title: "Plan the backlog",
      description: "",
      type: "STORY",
      storyPoints: 8,
      rank: 42,
      acceptanceCriteria: "The backlog can be ordered.",
      priority: "HIGH",
      status: "TODO",
      assigneeId: null,
      startDate: null,
      dueDate: null,
    };

    const created = await taskListRoute.POST(
      request("POST", `projects/${project.id}/tasks`, payload),
      context(project.id)
    );
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      task: {
        type: "STORY",
        storyPoints: 8,
        rank: 42,
        acceptanceCriteria: "The backlog can be ordered.",
      },
    });

    expect((await taskListRoute.POST(
      request("POST", `projects/${project.id}/tasks`, { ...payload, storyPoints: 2.5 }),
      context(project.id)
    )).status).toBe(400);

    expect((await taskListRoute.POST(
      request("POST", `projects/${project.id}/tasks`, { ...payload, storyPoints: 101 }),
      context(project.id)
    )).status).toBe(400);

    const task = await db.task.findFirstOrThrow({ where: { projectId: project.id } });
    const updated = await taskRoute.PATCH(
      request("PATCH", `tasks/${task.id}`, {
        ...payload,
        type: "BUG",
        storyPoints: null,
        rank: 84,
        acceptanceCriteria: null,
      }),
      context(task.id)
    );
    expect(updated.status).toBe(200);
    expect(await db.task.findUnique({ where: { id: task.id } })).toMatchObject({
      type: "BUG",
      storyPoints: null,
      rank: 84,
      acceptanceCriteria: null,
    });

    expect((await taskRoute.PATCH(
      request("PATCH", `tasks/${task.id}`, { ...payload, rank: 100_001 }),
      context(task.id)
    )).status).toBe(400);
  });

  it("starts one future sprint and preserves its planned-task snapshot", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const project = await projectFactory(db, admin.id, manager.id);
    const firstTask = await taskFactory(db, project.id, admin.id, {
      type: "STORY",
      storyPoints: 8,
      rank: 1,
    });
    const secondTask = await taskFactory(db, project.id, admin.id, {
      type: "BUG",
      storyPoints: null,
      rank: 2,
    });
    actor = manager;

    const created = await sprintRoute.POST(
      request("POST", `projects/${project.id}/sprints`, {
        name: "Sprint one",
        goal: "Deliver the first increment",
        startDate: "2026-11-12",
        endDate: "2026-11-26",
      }),
      context(project.id)
    );
    expect(created.status).toBe(201);
    const { sprint } = await created.json() as { sprint: { id: string; status: string; goal: string | null } };
    expect(sprint).toMatchObject({ status: "FUTURE", goal: "Deliver the first increment" });

    for (const taskId of [firstTask.id, secondTask.id]) {
      expect((await sprintRoute.PATCH(
        request("PATCH", `projects/${project.id}/sprints`, {
          action: "ASSIGN_TASK",
          sprintId: sprint.id,
          taskId,
        }),
        context(project.id)
      )).status).toBe(200);
    }

    const started = await sprintRoute.PATCH(
      request("PATCH", `projects/${project.id}/sprints`, {
        action: "START",
        sprintId: sprint.id,
      }),
      context(project.id)
    );
    expect(started.status).toBe(200);
    expect(await db.sprint.findUnique({ where: { id: sprint.id } })).toMatchObject({ status: "ACTIVE" });
    expect(await db.sprintStartSnapshot.findUnique({
      where: { sprintId: sprint.id },
      include: { tasks: { orderBy: { rank: "asc" } } },
    })).toMatchObject({
      plannedTaskCount: 2,
      plannedStoryPoints: 8,
      tasks: [
        { taskId: firstTask.id, type: "STORY", storyPoints: 8 },
        { taskId: secondTask.id, type: "BUG", storyPoints: null },
      ],
    });

    const another = await sprintFactory(db, project.id);
    expect((await sprintRoute.PATCH(
      request("PATCH", `projects/${project.id}/sprints`, {
        action: "START",
        sprintId: another.id,
      }),
      context(project.id)
    )).status).toBe(409);
  });

  it("allows only an admin to change another user's role and protects admin accounts", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const employee = await userFactory(db);
    actor = manager;
    expect((await userRoute.PATCH(request("PATCH", `users/${employee.id}`, { role: "MANAGER" }), context(employee.id))).status).toBe(403);
    expect((await db.user.findUnique({ where: { id: employee.id } }))?.role).toBe("EMPLOYEE");
    actor = admin;
    expect((await userRoute.PATCH(request("PATCH", `users/${admin.id}`, { isActive: false }), context(admin.id))).status).toBe(403);
    expect((await userRoute.PATCH(request("PATCH", `users/${employee.id}`, { role: "MANAGER" }), context(employee.id))).status).toBe(200);
    expect((await db.user.findUnique({ where: { id: employee.id } }))?.role).toBe("MANAGER");
  });
});

describe("deletion and relational integrity", () => {
  it("soft-deletes only the selected task and preserves its comments/history", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const employee = await userFactory(db);
    const one = await projectFactory(db, admin.id, manager.id, [employee.id]);
    const two = await projectFactory(db, admin.id, manager.id, [employee.id]);
    const sprint = await sprintFactory(db, one.id);
    const target = await taskFactory(db, one.id, admin.id, { sprintId: sprint.id, assigneeId: employee.id, status: "DONE" });
    const other = await taskFactory(db, two.id, admin.id);
    const comment = await commentFactory(db, target.id, employee.id);
    const event = await commentFactory(db, target.id, admin.id, "__TASK_CHANGE_EVENT_V1__:{}");
    actor = admin;
    expect((await taskRoute.DELETE(request("DELETE", `tasks/${target.id}`), context(target.id))).status).toBe(200);
    expect(await db.task.findUnique({ where: { id: target.id } })).toMatchObject({
      deletedById: admin.id,
      sprintId: sprint.id,
    });
    expect((await db.task.findUnique({ where: { id: target.id } }))?.deletedAt).toBeInstanceOf(Date);
    expect(await db.task.findUnique({ where: { id: other.id } })).not.toBeNull();
    expect(await db.sprint.findUnique({ where: { id: sprint.id } })).not.toBeNull();
    expect(await db.user.findUnique({ where: { id: employee.id } })).not.toBeNull();
    expect(await db.taskComment.findMany({ where: { id: { in: [comment.id, event.id] } } })).toHaveLength(2);
    expect((await taskListRoute.GET(request("GET", `projects/${one.id}/tasks`), context(one.id))).status).toBe(200);
    await expect((await taskListRoute.GET(request("GET", `projects/${one.id}/tasks`), context(one.id))).json()).resolves.toMatchObject({ tasks: [] });
    expect((await taskRoute.PATCH(request("PATCH", `tasks/${target.id}`, { status: "TODO" }), context(target.id))).status).toBe(404);
    expect((await db.project.findUniqueOrThrow({ where: { id: one.id } })).progress).toBe(0);
  });

  it("deletes a sprint but preserves task, comments, status and other project", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const employee = await userFactory(db);
    const one = await projectFactory(db, admin.id, manager.id, [employee.id]);
    const two = await projectFactory(db, admin.id, manager.id);
    const sprint = await sprintFactory(db, one.id);
    const foreignSprint = await sprintFactory(db, two.id);
    const task = await taskFactory(db, one.id, admin.id, { sprintId: sprint.id, assigneeId: employee.id, status: "DONE" });
    const comment = await commentFactory(db, task.id, employee.id);
    actor = admin;
    expect((await sprintRoute.DELETE(request("DELETE", `projects/${one.id}/sprints`, { sprintId: sprint.id }), context(one.id))).status).toBe(200);
    const saved = await db.task.findUnique({ where: { id: task.id } });
    expect(saved).toMatchObject({ sprintId: null, status: "DONE", assigneeId: employee.id });
    expect(await db.taskComment.findUnique({ where: { id: comment.id } })).not.toBeNull();
    expect(await db.sprint.findUnique({ where: { id: foreignSprint.id } })).not.toBeNull();
  });

  it("removing one membership preserves user and membership in another project", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const employee = await userFactory(db);
    const one = await projectFactory(db, admin.id, manager.id, [employee.id]);
    const two = await projectFactory(db, admin.id, manager.id, [employee.id]);
    await db.projectMember.delete({ where: { projectId_userId: { projectId: one.id, userId: employee.id } } });
    expect(await db.user.findUnique({ where: { id: employee.id } })).not.toBeNull();
    expect(await db.projectMember.count({ where: { userId: employee.id, projectId: two.id } })).toBe(1);
    expect(await db.projectMember.count({ where: { userId: employee.id, projectId: one.id } })).toBe(0);
  });

  it("refuses to remove the last manager and revokes a removed employee's project access", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const employee = await userFactory(db);
    const one = await projectFactory(db, admin.id, manager.id, [employee.id]);
    const two = await projectFactory(db, admin.id, manager.id, [employee.id]);
    actor = admin;
    expect((await membersRoute.PUT(request("PUT", `projects/${one.id}/members`, { managerIds: [], memberIds: [] }), context(one.id))).status).toBe(400);
    expect(await db.projectMember.count({ where: { projectId: one.id, role: "MANAGER" } })).toBe(1);
    expect((await membersRoute.PUT(request("PUT", `projects/${one.id}/members`, { managerIds: [manager.id], memberIds: [] }), context(one.id))).status).toBe(200);
    actor = employee;
    expect((await kanbanRoute.GET(request("GET", `projects/${one.id}/kanban`), context(one.id))).status).toBe(403);
    expect((await kanbanRoute.GET(request("GET", `projects/${two.id}/kanban`), context(two.id))).status).toBe(200);
    expect(await db.projectMember.count({ where: { projectId: two.id, userId: employee.id } })).toBe(1);
  });

  it("restricts deleting a user with historical authorship", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const project = await projectFactory(db, admin.id, manager.id);
    await projectHistoryFactory(db, project.id, admin.id);
    await expect(db.user.delete({ where: { id: admin.id } })).rejects.toThrow();
    expect(await db.project.findUnique({ where: { id: project.id } })).not.toBeNull();
    expect(await db.user.findUnique({ where: { id: admin.id } })).not.toBeNull();
  });

  it("rejects mutation after archiving while preserving related rows", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const project = await projectFactory(db, admin.id, manager.id);
    const task = await taskFactory(db, project.id, admin.id);
    await db.project.update({ where: { id: project.id }, data: { archivedAt: new Date() } });
    actor = admin;
    expect((await projectRoute.PATCH(request("PATCH", `projects/${project.id}`, { status: "ACTIVE" }), context(project.id))).status).toBe(403);
    expect((await taskRoute.PATCH(request("PATCH", `tasks/${task.id}`, { status: "DONE" }), context(task.id))).status).toBe(403);
    expect(await db.task.findUnique({ where: { id: task.id } })).not.toBeNull();
  });
});

describe("transactions, sessions and progress policy", () => {
  it("rolls back task mutation if history insert fails", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const project = await projectFactory(db, admin.id, manager.id);
    const task = await taskFactory(db, project.id, admin.id);
    await expect(db.$transaction(async (tx) => {
      await tx.task.update({ where: { id: task.id }, data: { status: "DONE" } });
      await tx.taskComment.create({ data: { taskId: task.id, authorId: crypto.randomUUID(), content: "invalid author" } });
    })).rejects.toThrow();
    expect((await db.task.findUnique({ where: { id: task.id } }))?.status).toBe("TODO");
    expect(await db.taskComment.count({ where: { taskId: task.id } })).toBe(0);
  });

  it("allows exactly one of two updates using the same version", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const project = await projectFactory(db, admin.id, manager.id);
    const task = await taskFactory(db, project.id, admin.id);
    const results = await Promise.all([
      db.task.updateMany({ where: { id: task.id, version: 1 }, data: { status: "DONE", version: { increment: 1 } } }),
      db.task.updateMany({ where: { id: task.id, version: 1 }, data: { status: "IN_PROGRESS", version: { increment: 1 } } }),
    ]);
    expect(results.map((result) => result.count).sort()).toEqual([0, 1]);
    expect((await db.task.findUnique({ where: { id: task.id } }))?.version).toBe(2);
  });

  it("keeps expired sessions stored but rejects them by time policy", async () => {
    const user = await userFactory(db);
    const session = await sessionFactory(db, user.id, new Date(Date.now() - 60_000));
    expect(session.expiresAt.getTime()).toBeLessThan(Date.now());
    expect(await db.session.count({ where: { id: session.id } })).toBe(1);
  });

  it("ignores manual progress and stores the task-derived value", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const project = await projectFactory(db, admin.id, manager.id);
    await taskFactory(db, project.id, admin.id, { status: "DONE" });
    actor = admin;
    const response = await progressRoute.POST(request("POST", `projects/${project.id}/progress`, { progress: 0, note: "test" }), context(project.id));
    expect(response.status).toBe(200);
    expect((await response.json()).progress).toBe(100);
    const stored = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(stored.progress).toBe(100);
    expect((await db.progressHistory.findFirstOrThrow({ where: { projectId: project.id } })).progress).toBe(100);
  });

  it("updates stored project progress when a task status changes", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const project = await projectFactory(db, admin.id, manager.id);
    const task = await taskFactory(db, project.id, admin.id);
    actor = admin;
    expect((await taskRoute.PATCH(request("PATCH", `tasks/${task.id}`, { status: "DONE" }), context(task.id))).status).toBe(200);
    expect((await db.task.findUnique({ where: { id: task.id } }))?.status).toBe("DONE");
    expect((await db.project.findUnique({ where: { id: project.id } }))?.progress).toBe(100);
  });

  it("syncs progress after creating tasks and uses every task exactly once", async () => {
    const admin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "MANAGER");
    const project = await projectFactory(db, admin.id, manager.id);
    await db.project.update({ where: { id: project.id }, data: { progress: 77 } });
    actor = admin;
    const base = {
      title: "Progress task",
      description: "",
      priority: "MEDIUM",
      assigneeId: null,
      startDate: null,
      dueDate: null,
    };
    expect((await taskListRoute.POST(request("POST", `projects/${project.id}/tasks`, { ...base, status: "TODO" }), context(project.id))).status).toBe(201);
    expect((await db.project.findUniqueOrThrow({ where: { id: project.id } })).progress).toBe(0);
    expect((await taskListRoute.POST(request("POST", `projects/${project.id}/tasks`, { ...base, title: "Review task", status: "IN_REVIEW" }), context(project.id))).status).toBe(201);
    expect((await db.project.findUniqueOrThrow({ where: { id: project.id } })).progress).toBe(45);
    expect(await db.task.count({ where: { projectId: project.id } })).toBe(2);
  });
});
