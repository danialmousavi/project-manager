import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest } from "next/server";
import { PrismaClient } from "../../generated/prisma/client";
import { assertTestDatabase } from "../database/guard";
import { sprintFactory, taskFactory, userFactory } from "../database/fixtures";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));

let db: PrismaClient;
let companyAccess: typeof import("../../lib/company-access");
let membersRoute: typeof import("../../app/api/v1/companies/[id]/members/route");
let memberWriteRoute: typeof import("../../app/api/v1/companies/[id]/members/[memberId]/route");
let candidatesRoute: typeof import("../../app/api/v1/companies/[id]/member-candidates/route");
let createUserRoute: typeof import("../../app/api/v1/companies/[id]/members/create-user/route");
let projectsRoute: typeof import("../../app/api/v1/projects/route");
let projectTasksRoute: typeof import("../../app/api/v1/projects/[id]/tasks/route");
let taskRoute: typeof import("../../app/api/v1/tasks/[id]/route");
let sprintRoute: typeof import("../../app/api/v1/projects/[id]/sprints/route");
let milestonesRoute: typeof import("../../app/api/v1/projects/[id]/milestones/route");
let commentsRoute: typeof import("../../app/api/v1/tasks/[id]/comments/route");
let attachmentRoute: typeof import("../../app/api/v1/task-attachments/[id]/route");
let progressRoute: typeof import("../../app/api/v1/projects/[id]/progress/route");
let kanbanRoute: typeof import("../../app/api/v1/projects/[id]/kanban/route");
let lettersRoute: typeof import("../../app/api/v1/projects/[id]/letters/route");
let taskAccess: typeof import("../../lib/task-access");
let workspaceAccess: typeof import("../../lib/workspace-access");
let actor: { id: string; role: "ADMIN" | "MANAGER" | "EMPLOYEE" | "CONTROLLER" } | null = null;
const auth = await import("../../lib/auth");
vi.mocked(auth.getCurrentUser).mockImplementation(async () => actor as never);

beforeAll(async () => {
  const testUrl = await assertTestDatabase();
  process.env.DATABASE_URL = testUrl;
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) });
  await db.$connect();
  [companyAccess, membersRoute, memberWriteRoute, candidatesRoute, createUserRoute, projectsRoute, projectTasksRoute, taskRoute, sprintRoute, milestonesRoute, commentsRoute, attachmentRoute, progressRoute, kanbanRoute, lettersRoute, taskAccess, workspaceAccess] = await Promise.all([
    import("../../lib/company-access"),
    import("../../app/api/v1/companies/[id]/members/route"),
    import("../../app/api/v1/companies/[id]/members/[memberId]/route"),
    import("../../app/api/v1/companies/[id]/member-candidates/route"),
    import("../../app/api/v1/companies/[id]/members/create-user/route"),
    import("../../app/api/v1/projects/route"),
    import("../../app/api/v1/projects/[id]/tasks/route"),
    import("../../app/api/v1/tasks/[id]/route"),
    import("../../app/api/v1/projects/[id]/sprints/route"),
    import("../../app/api/v1/projects/[id]/milestones/route"),
    import("../../app/api/v1/tasks/[id]/comments/route"),
    import("../../app/api/v1/task-attachments/[id]/route"),
    import("../../app/api/v1/projects/[id]/progress/route"),
    import("../../app/api/v1/projects/[id]/kanban/route"),
    import("../../app/api/v1/projects/[id]/letters/route"),
    import("../../lib/task-access"),
    import("../../lib/workspace-access"),
  ]);
});

beforeEach(async () => {
  await assertTestDatabase();
  actor = null;
  await db.taskComment.deleteMany();
  await db.letterRecipient.deleteMany();
  await db.letter.deleteMany();
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

describe("company access boundary", () => {
  it("limits a company member to their active company", async () => {
    const user = await userFactory(db, "EMPLOYEE");
    const [first, second] = await Promise.all([
      db.company.create({ data: { name: "First company" } }),
      db.company.create({ data: { name: "Second company" } }),
    ]);
    await db.companyMember.create({ data: { companyId: first.id, userId: user.id, role: "EXPERT" } });

    await expect(companyAccess.getCompanyAccess(user, first.id)).resolves.toMatchObject({ companyId: first.id, role: "EXPERT", isPlatformAdmin: false });
    await expect(companyAccess.getCompanyAccess(user, second.id)).resolves.toBeNull();
  });

  it("rejects inactive memberships and suspended companies", async () => {
    const user = await userFactory(db, "MANAGER");
    const suspended = await db.company.create({ data: { name: "Suspended company", status: "SUSPENDED" } });
    const inactiveMembership = await db.company.create({ data: { name: "Inactive membership company" } });
    await db.companyMember.createMany({ data: [
      { companyId: suspended.id, userId: user.id, role: "PROJECT_MANAGER" },
      { companyId: inactiveMembership.id, userId: user.id, role: "PROJECT_MANAGER", isActive: false },
    ] });

    await expect(companyAccess.getCompanyAccess(user, suspended.id)).resolves.toBeNull();
    await expect(companyAccess.getCompanyAccess(user, inactiveMembership.id)).resolves.toBeNull();
  });

  it("keeps platform-admin visibility while enforcing company management roles", async () => {
    const admin = await userFactory(db, "ADMIN");
    const company = await db.company.create({ data: { name: "Admin visible company", status: "SUSPENDED" } });
    const platformAccess = await companyAccess.getCompanyAccess(admin, company.id);

    expect(platformAccess).toMatchObject({ role: "PLATFORM_ADMIN", isPlatformAdmin: true });
    expect(companyAccess.canManageCompany(platformAccess!)).toBe(true);
    expect(companyAccess.canCreateCompanyProject(platformAccess!)).toBe(true);
    expect(companyAccess.canCreateCompanyProject({ companyId: company.id, role: "PROJECT_MANAGER", isPlatformAdmin: false })).toBe(true);
    expect(companyAccess.canManageCompany({ companyId: company.id, role: "EXPERT", isPlatformAdmin: false })).toBe(false);
  });

  it("derives the effective workspace role from active company memberships", async () => {
    const user = await userFactory(db, "EMPLOYEE");
    const ownerCompany = await db.company.create({ data: { name: "Owner workspace company" } });
    const suspendedCompany = await db.company.create({ data: { name: "Suspended workspace company", status: "SUSPENDED" } });
    await db.companyMember.createMany({ data: [
      { companyId: ownerCompany.id, userId: user.id, role: "OWNER" },
      { companyId: suspendedCompany.id, userId: user.id, role: "PROJECT_MANAGER" },
    ] });

    await expect(workspaceAccess.getWorkspaceAccess(user)).resolves.toMatchObject({
      isPlatformAdmin: false,
      primaryRole: "OWNER",
      primaryRoleLabel: "مالک شرکت",
      companyMemberships: [{ companyId: ownerCompany.id, role: "OWNER" }],
    });
  });

  it("returns members only to a company manager and hides other companies", async () => {
    const owner = await userFactory(db, "EMPLOYEE");
    const member = await userFactory(db, "EMPLOYEE");
    const otherCompany = await db.company.create({ data: { name: "Hidden members company" } });
    const company = await db.company.create({ data: { name: "Visible members company" } });
    await db.companyMember.createMany({ data: [
      { companyId: company.id, userId: owner.id, role: "OWNER" },
      { companyId: company.id, userId: member.id, role: "EXPERT" },
    ] });
    actor = owner;

    const visible = await membersRoute.GET(
      new NextRequest(`http://localhost:3000/api/v1/companies/${company.id}/members`),
      { params: Promise.resolve({ id: company.id }) },
    );
    expect(visible.status).toBe(200);
    expect((await visible.json()).company.members).toHaveLength(2);

    const hidden = await membersRoute.GET(
      new NextRequest(`http://localhost:3000/api/v1/companies/${otherCompany.id}/members`),
      { params: Promise.resolve({ id: otherCompany.id }) },
    );
    expect(hidden.status).toBe(404);
  });

  it("adds, edits, and removes a membership without deleting the user", async () => {
    const owner = await userFactory(db, "EMPLOYEE");
    const candidate = await userFactory(db, "EMPLOYEE");
    const company = await db.company.create({ data: { name: "Managed members company" } });
    const ownerMembership = await db.companyMember.create({ data: { companyId: company.id, userId: owner.id, role: "OWNER" } });
    actor = owner;
    const headers = { origin: "http://localhost:3000", "content-type": "application/json" };

    const created = await membersRoute.POST(
      new NextRequest(`http://localhost:3000/api/v1/companies/${company.id}/members`, { method: "POST", headers, body: JSON.stringify({ email: candidate.email, role: "EXPERT" }) }),
      { params: Promise.resolve({ id: company.id }) },
    );
    expect(created.status).toBe(201);
    const membership = (await created.json()).member as { id: string };

    const updated = (await memberWriteRoute.PATCH!(
      new NextRequest(`http://localhost:3000/api/v1/companies/${company.id}/members/${membership.id}`, { method: "PATCH", headers, body: JSON.stringify({ role: "PROJECT_MANAGER" }) }),
      { params: Promise.resolve({ id: company.id, memberId: membership.id }) },
    ))!;
    expect(updated.status).toBe(200);
    expect((await updated.json()).member.role).toBe("PROJECT_MANAGER");

    const removed = (await memberWriteRoute.DELETE!(
      new NextRequest(`http://localhost:3000/api/v1/companies/${company.id}/members/${membership.id}`, { method: "DELETE", headers }),
      { params: Promise.resolve({ id: company.id, memberId: membership.id }) },
    ))!;
    expect(removed.status).toBe(200);
    expect(await db.user.findUnique({ where: { id: candidate.id } })).not.toBeNull();
    expect(await db.companyMember.findUnique({ where: { companyId_userId: { companyId: company.id, userId: candidate.id } } })).toBeNull();

    const ownerDelete = (await memberWriteRoute.DELETE!(
      new NextRequest(`http://localhost:3000/api/v1/companies/${company.id}/members/${ownerMembership.id}`, { method: "DELETE", headers }),
      { params: Promise.resolve({ id: company.id, memberId: ownerMembership.id }) },
    ))!;
    expect(ownerDelete.status).toBe(403);
  });

  it("searches eligible users and creates a new user inside the company", async () => {
    const owner = await userFactory(db, "EMPLOYEE");
    const candidate = await db.user.create({ data: { name: "Eligible Candidate", email: "eligible-candidate@example.invalid", passwordHash: "test", role: "EMPLOYEE", phone: "09121234567" } });
    const company = await db.company.create({ data: { name: "Candidate search company" } });
    await db.companyMember.create({ data: { companyId: company.id, userId: owner.id, role: "OWNER" } });
    actor = owner;
    const headers = { origin: "http://localhost:3000", "content-type": "application/json" };

    const search = await candidatesRoute.GET!(new NextRequest(`http://localhost:3000/api/v1/companies/${company.id}/member-candidates?q=eligible`), { params: Promise.resolve({ id: company.id }) });
    expect(search?.status).toBe(200);
    expect((await search!.json()).users).toEqual(expect.arrayContaining([expect.objectContaining({ id: candidate.id })]));

    const created = await createUserRoute.POST!(
      new NextRequest(`http://localhost:3000/api/v1/companies/${company.id}/members/create-user`, { method: "POST", headers, body: JSON.stringify({ name: "New Company Expert", email: "new-company-expert@example.invalid", password: "synthetic-password-123", phone: "09129876543", role: "EXPERT" }) }),
      { params: Promise.resolve({ id: company.id }) },
    );
    expect(created?.status).toBe(201);
    const body = await created!.json();
    expect(body.member.role).toBe("EXPERT");
    expect(await db.companyMember.findUnique({ where: { companyId_userId: { companyId: company.id, userId: body.member.user.id } } })).not.toBeNull();
  });

  it("creates a project only in the selected company with company-scoped members", async () => {
    const platformAdmin = await userFactory(db, "ADMIN");
    const owner = await userFactory(db, "EMPLOYEE");
    const projectManager = await userFactory(db, "EMPLOYEE");
    const expert = await userFactory(db, "EMPLOYEE");
    const selectedCompany = await db.company.create({ data: { name: "Selected project company" } });
    const otherCompany = await db.company.create({ data: { name: "Other project company" } });
    await db.companyMember.createMany({ data: [
      { companyId: selectedCompany.id, userId: projectManager.id, role: "PROJECT_MANAGER" },
      { companyId: selectedCompany.id, userId: expert.id, role: "EXPERT" },
      { companyId: otherCompany.id, userId: owner.id, role: "OWNER" },
    ] });
    const headers = { origin: "http://localhost:3000", "content-type": "application/json" };
    const payload = {
      companyId: selectedCompany.id,
      name: "Company scoped project",
      description: "",
      priority: "MEDIUM",
      managerIds: [projectManager.id],
      memberIds: [expert.id],
      controllerIds: [],
      startDate: null,
      dueDate: null,
    };

    actor = platformAdmin;
    const created = await projectsRoute.POST(
      new NextRequest("http://localhost:3000/api/v1/projects", { method: "POST", headers, body: JSON.stringify(payload) }),
    );
    expect(created.status).toBe(201);
    const createdProject = (await created.json()).project as { id: string };
    expect(await db.project.findUnique({ where: { id: createdProject.id }, select: { companyId: true } })).toEqual({ companyId: selectedCompany.id });

    actor = owner;
    const forbidden = await projectsRoute.POST(
      new NextRequest("http://localhost:3000/api/v1/projects", { method: "POST", headers, body: JSON.stringify(payload) }),
    );
    expect(forbidden.status).toBe(403);
  });

  it("lets a company owner manage every project in their active company", async () => {
    const owner = await userFactory(db, "EMPLOYEE");
    const projectManager = await userFactory(db, "MANAGER");
    const outsider = await userFactory(db, "EMPLOYEE");
    const company = await db.company.create({ data: { name: "Owner project visibility company" } });
    await db.companyMember.createMany({ data: [
      { companyId: company.id, userId: owner.id, role: "OWNER" },
      { companyId: company.id, userId: projectManager.id, role: "PROJECT_MANAGER" },
    ] });
    const project = await db.project.create({
      data: {
        name: "Owner managed project",
        companyId: company.id,
        createdById: owner.id,
        members: { create: { userId: projectManager.id, role: "MANAGER" } },
      },
    });

    await expect(taskAccess.getTaskProjectAccess(owner, project.id)).resolves.toMatchObject({ canManage: true, canManageSettings: true });
    await expect(taskAccess.getTaskProjectAccess(outsider, project.id)).resolves.toBeNull();
  });

  it("uses company roles for task assignment and lets a company owner delete tasks", async () => {
    const owner = await userFactory(db, "EMPLOYEE");
    const projectManager = await userFactory(db, "EMPLOYEE");
    const expert = await userFactory(db, "MANAGER");
    const inactiveCompanyMember = await userFactory(db, "EMPLOYEE");
    const company = await db.company.create({ data: { name: "Task assignment company" } });
    const project = await db.project.create({
      data: {
        name: "Company task assignment project",
        companyId: company.id,
        createdById: owner.id,
        members: {
          create: [
            { userId: projectManager.id, role: "MANAGER" },
            { userId: expert.id, role: "MEMBER" },
            { userId: inactiveCompanyMember.id, role: "MEMBER" },
          ],
        },
      },
    });
    await db.companyMember.createMany({ data: [
      { companyId: company.id, userId: owner.id, role: "OWNER" },
      { companyId: company.id, userId: projectManager.id, role: "PROJECT_MANAGER" },
      { companyId: company.id, userId: expert.id, role: "EXPERT" },
    ] });
    actor = owner;
    const headers = { origin: "http://localhost:3000", "content-type": "application/json" };
    const taskPayload = {
      title: "Company role assignment",
      description: "",
      priority: "MEDIUM",
      status: "TODO",
      assigneeId: expert.id,
      startDate: null,
      dueDate: null,
    };

    const created = await projectTasksRoute.POST(
      new NextRequest(`http://localhost:3000/api/v1/projects/${project.id}/tasks`, { method: "POST", headers, body: JSON.stringify(taskPayload) }),
      { params: Promise.resolve({ id: project.id }) },
    );
    expect(created.status).toBe(201);

    const rejected = await projectTasksRoute.POST(
      new NextRequest(`http://localhost:3000/api/v1/projects/${project.id}/tasks`, { method: "POST", headers, body: JSON.stringify({ ...taskPayload, assigneeId: inactiveCompanyMember.id }) }),
      { params: Promise.resolve({ id: project.id }) },
    );
    expect(rejected.status).toBe(400);

    const unassigned = await taskFactory(db, project.id, owner.id);
    const assigned = await taskRoute.PATCH(
      new NextRequest(`http://localhost:3000/api/v1/tasks/${unassigned.id}`, { method: "PATCH", headers, body: JSON.stringify({ assigneeId: expert.id, note: "" }) }),
      { params: Promise.resolve({ id: unassigned.id }) },
    );
    expect(assigned.status).toBe(200);
    expect(await db.task.findUnique({ where: { id: unassigned.id }, select: { assigneeId: true } })).toEqual({ assigneeId: expert.id });

    const deleted = await taskRoute.DELETE(
      new NextRequest(`http://localhost:3000/api/v1/tasks/${unassigned.id}`, { method: "DELETE", headers }),
      { params: Promise.resolve({ id: unassigned.id }) },
    );
    expect(deleted.status).toBe(200);
  });

  it("lets a company owner delete a sprint in their company project", async () => {
    const owner = await userFactory(db, "EMPLOYEE");
    const company = await db.company.create({ data: { name: "Sprint owner company" } });
    const project = await db.project.create({
      data: {
        name: "Sprint owner project",
        companyId: company.id,
        createdById: owner.id,
      },
    });
    const sprint = await sprintFactory(db, project.id);
    await db.companyMember.create({
      data: { companyId: company.id, userId: owner.id, role: "OWNER" },
    });
    actor = owner;

    const deleted = await sprintRoute.DELETE(
      new NextRequest(`http://localhost:3000/api/v1/projects/${project.id}/sprints`, {
        method: "DELETE",
        headers: { origin: "http://localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({ sprintId: sprint.id }),
      }),
      { params: Promise.resolve({ id: project.id }) },
    );

    expect(deleted.status).toBe(200);
    expect(await db.sprint.findUnique({ where: { id: sprint.id } })).toBeNull();
  });

  it("uses the project company-controller role for milestone visibility", async () => {
    const owner = await userFactory(db, "EMPLOYEE");
    const controller = await userFactory(db, "EMPLOYEE");
    const legacyController = await userFactory(db, "CONTROLLER");
    const company = await db.company.create({ data: { name: "Milestone controller company" } });
    const project = await db.project.create({
      data: {
        name: "Milestone controller project",
        companyId: company.id,
        createdById: owner.id,
        members: {
          create: [
            { userId: controller.id, role: "CONTROLLER" },
            { userId: legacyController.id, role: "MEMBER" },
          ],
        },
      },
    });
    const milestone = await db.milestone.create({
      data: { title: "Controlled release", targetDate: new Date("2099-06-15T00:00:00.000Z"), projectId: project.id },
    });
    await taskFactory(db, project.id, owner.id, { milestoneId: milestone.id });
    await db.companyMember.createMany({ data: [
      { companyId: company.id, userId: owner.id, role: "OWNER" },
      { companyId: company.id, userId: controller.id, role: "CONTROLLER" },
      { companyId: company.id, userId: legacyController.id, role: "EXPERT" },
    ] });

    actor = controller;
    const controllerMilestones = await milestonesRoute.GET(
      new NextRequest(`http://localhost:3000/api/v1/projects/${project.id}/milestones`),
      { params: Promise.resolve({ id: project.id }) },
    );
    expect(controllerMilestones.status).toBe(200);
    expect((await controllerMilestones.json()).milestones).toHaveLength(1);
    await expect(taskAccess.getTaskProjectAccess(controller, project.id)).resolves.toMatchObject({ canViewAllTasks: true });

    actor = legacyController;
    const expertMilestones = await milestonesRoute.GET(
      new NextRequest(`http://localhost:3000/api/v1/projects/${project.id}/milestones`),
      { params: Promise.resolve({ id: project.id }) },
    );
    expect(expertMilestones.status).toBe(200);
    expect((await expertMilestones.json()).milestones).toHaveLength(0);
    await expect(taskAccess.getTaskProjectAccess(legacyController, project.id)).resolves.toMatchObject({ canViewAllTasks: false });
  });

  it("uses the company-project controller role for task comments and attachments", async () => {
    const owner = await userFactory(db, "EMPLOYEE");
    const controller = await userFactory(db, "EMPLOYEE");
    const expertWithLegacyControllerRole = await userFactory(db, "CONTROLLER");
    const company = await db.company.create({ data: { name: "Task write access company" } });
    const project = await db.project.create({
      data: {
        name: "Task write access project",
        companyId: company.id,
        createdById: owner.id,
        members: {
          create: [
            { userId: controller.id, role: "CONTROLLER" },
            { userId: expertWithLegacyControllerRole.id, role: "MEMBER" },
          ],
        },
      },
    });
    const task = await taskFactory(db, project.id, owner.id, { assigneeId: expertWithLegacyControllerRole.id });
    const attachment = await db.taskAttachment.create({
      data: {
        taskId: task.id,
        uploadedById: expertWithLegacyControllerRole.id,
        storageKey: "test/company-role-attachment.txt",
        originalName: "company-role-attachment.txt",
        contentType: "text/plain",
        byteSize: 1,
      },
    });
    await db.companyMember.createMany({ data: [
      { companyId: company.id, userId: owner.id, role: "OWNER" },
      { companyId: company.id, userId: controller.id, role: "CONTROLLER" },
      { companyId: company.id, userId: expertWithLegacyControllerRole.id, role: "EXPERT" },
    ] });
    const headers = { origin: "http://localhost:3000", "content-type": "application/json" };

    actor = controller;
    expect((await commentsRoute.POST(
      new NextRequest(`http://localhost:3000/api/v1/tasks/${task.id}/comments`, { method: "POST", headers, body: JSON.stringify({ content: "Controller must remain read-only" }) }),
      { params: Promise.resolve({ id: task.id }) },
    )).status).toBe(403);
    expect((await attachmentRoute.PATCH(
      new NextRequest(`http://localhost:3000/api/v1/task-attachments/${attachment.id}`, { method: "PATCH", headers, body: JSON.stringify({ title: "Not allowed" }) }),
      { params: Promise.resolve({ id: attachment.id }) },
    )).status).toBe(403);

    actor = expertWithLegacyControllerRole;
    expect((await commentsRoute.POST(
      new NextRequest(`http://localhost:3000/api/v1/tasks/${task.id}/comments`, { method: "POST", headers, body: JSON.stringify({ content: "Expert comment is allowed" }) }),
      { params: Promise.resolve({ id: task.id }) },
    )).status).toBe(201);
    expect((await attachmentRoute.PATCH(
      new NextRequest(`http://localhost:3000/api/v1/task-attachments/${attachment.id}`, { method: "PATCH", headers, body: JSON.stringify({ title: "Updated by expert" }) }),
      { params: Promise.resolve({ id: attachment.id }) },
    )).status).toBe(200);
  });

  it("lets a company owner view the kanban and record task-derived project progress", async () => {
    const owner = await userFactory(db, "EMPLOYEE");
    const company = await db.company.create({ data: { name: "Project progress company" } });
    const project = await db.project.create({
      data: { name: "Project progress project", companyId: company.id, createdById: owner.id },
    });
    await taskFactory(db, project.id, owner.id, { status: "DONE" });
    await db.companyMember.create({
      data: { companyId: company.id, userId: owner.id, role: "OWNER" },
    });
    actor = owner;
    const headers = { origin: "http://localhost:3000", "content-type": "application/json" };

    expect((await kanbanRoute.GET(
      new NextRequest(`http://localhost:3000/api/v1/projects/${project.id}/kanban`),
      { params: Promise.resolve({ id: project.id }) },
    )).status).toBe(200);

    const progress = await progressRoute.POST(
      new NextRequest(`http://localhost:3000/api/v1/projects/${project.id}/progress`, { method: "POST", headers, body: JSON.stringify({ note: "Owner progress review" }) }),
      { params: Promise.resolve({ id: project.id }) },
    );
    expect(progress.status).toBe(200);
    expect((await progress.json()).progress).toBe(100);
  });

  it("scopes project letters to active memberships while giving managers and controllers oversight", async () => {
    const owner = await userFactory(db, "EMPLOYEE");
    const platformAdmin = await userFactory(db, "ADMIN");
    const manager = await userFactory(db, "EMPLOYEE");
    const expert = await userFactory(db, "EMPLOYEE");
    const controller = await userFactory(db, "EMPLOYEE");
    const outsider = await userFactory(db, "EMPLOYEE");
    const company = await db.company.create({ data: { name: "Letter access company" } });
    const project = await db.project.create({ data: {
      name: "Letter access project", companyId: company.id, createdById: owner.id,
      members: { create: [
        { userId: manager.id, role: "MANAGER" },
        { userId: expert.id, role: "MEMBER" },
        { userId: controller.id, role: "CONTROLLER" },
      ] },
    } });
    await db.companyMember.createMany({ data: [
      { companyId: company.id, userId: owner.id, role: "OWNER" },
      { companyId: company.id, userId: manager.id, role: "PROJECT_MANAGER" },
      { companyId: company.id, userId: expert.id, role: "EXPERT" },
      { companyId: company.id, userId: controller.id, role: "CONTROLLER" },
      { companyId: company.id, userId: outsider.id, role: "EXPERT" },
    ] });
    await db.letter.create({ data: { projectId: project.id, senderId: manager.id, subject: "Management-only letter", body: "Review", recipients: { create: { userId: manager.id } } } });
    const headers = { origin: "http://localhost:3000", "content-type": "application/json" };

    actor = owner;
    const ownerLetters = await lettersRoute.GET(new NextRequest(`http://localhost:3000/api/v1/projects/${project.id}/letters`), { params: Promise.resolve({ id: project.id }) });
    expect(ownerLetters.status).toBe(200);
    expect((await ownerLetters.json())).toMatchObject({ canViewAll: true, canSend: true, letters: [expect.objectContaining({ subject: "Management-only letter" })] });

    actor = expert;
    const expertLetters = await lettersRoute.GET(new NextRequest(`http://localhost:3000/api/v1/projects/${project.id}/letters`), { params: Promise.resolve({ id: project.id }) });
    expect(expertLetters.status).toBe(200);
    expect((await expertLetters.json()).letters).toHaveLength(0);

    actor = controller;
    const controllerLetters = await lettersRoute.GET(new NextRequest(`http://localhost:3000/api/v1/projects/${project.id}/letters`), { params: Promise.resolve({ id: project.id }) });
    expect((await controllerLetters.json())).toMatchObject({ canViewAll: true, canSend: false, letters: [expect.objectContaining({ subject: "Management-only letter" })] });
    const blocked = await lettersRoute.POST(new NextRequest(`http://localhost:3000/api/v1/projects/${project.id}/letters`, { method: "POST", headers, body: JSON.stringify({ subject: "Blocked", body: "Blocked", recipients: [expert.id] }) }), { params: Promise.resolve({ id: project.id }) });
    expect(blocked.status).toBe(403);

    actor = owner;
    const invalidRecipient = await lettersRoute.POST(new NextRequest(`http://localhost:3000/api/v1/projects/${project.id}/letters`, { method: "POST", headers, body: JSON.stringify({ subject: "Invalid", body: "Invalid", recipients: [outsider.id] }) }), { params: Promise.resolve({ id: project.id }) });
    expect(invalidRecipient.status).toBe(400);

    actor = platformAdmin;
    const platformLetters = await lettersRoute.GET(new NextRequest(`http://localhost:3000/api/v1/projects/${project.id}/letters`), { params: Promise.resolve({ id: project.id }) });
    expect((await platformLetters.json())).toMatchObject({ canViewAll: true, canSend: true, letters: [expect.objectContaining({ subject: "Management-only letter" })] });
    const platformSend = await lettersRoute.POST(new NextRequest(`http://localhost:3000/api/v1/projects/${project.id}/letters`, { method: "POST", headers, body: JSON.stringify({ subject: "Platform review", body: "Review", recipients: [expert.id] }) }), { params: Promise.resolve({ id: project.id }) });
    expect(platformSend.status).toBe(201);
  });
});
