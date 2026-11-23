import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest } from "next/server";
import { PrismaClient } from "../../generated/prisma/client";
import { assertTestDatabase } from "../database/guard";
import { userFactory } from "../database/fixtures";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));

let db: PrismaClient;
let companyAccess: typeof import("../../lib/company-access");
let membersRoute: typeof import("../../app/api/v1/companies/[id]/members/route");
let memberWriteRoute: typeof import("../../app/api/v1/companies/[id]/members/[memberId]/route");
let candidatesRoute: typeof import("../../app/api/v1/companies/[id]/member-candidates/route");
let createUserRoute: typeof import("../../app/api/v1/companies/[id]/members/create-user/route");
let actor: { id: string; role: "ADMIN" | "MANAGER" | "EMPLOYEE" | "CONTROLLER" } | null = null;
const auth = await import("../../lib/auth");
vi.mocked(auth.getCurrentUser).mockImplementation(async () => actor as never);

beforeAll(async () => {
  const testUrl = await assertTestDatabase();
  process.env.DATABASE_URL = testUrl;
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) });
  await db.$connect();
  [companyAccess, membersRoute, memberWriteRoute, candidatesRoute, createUserRoute] = await Promise.all([
    import("../../lib/company-access"),
    import("../../app/api/v1/companies/[id]/members/route"),
    import("../../app/api/v1/companies/[id]/members/[memberId]/route"),
    import("../../app/api/v1/companies/[id]/member-candidates/route"),
    import("../../app/api/v1/companies/[id]/members/create-user/route"),
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
});
