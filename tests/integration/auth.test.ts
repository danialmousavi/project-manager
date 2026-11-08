import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertTestDatabase } from "../database/guard";
import { sessionFactory, userFactory } from "../database/fixtures";
import { hashPassword } from "../../lib/password";

let token: string | undefined;
const deleteCookie = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => token ? { value: token } : undefined,
    delete: deleteCookie,
  })),
}));

let db: PrismaClient;
let auth: typeof import("../../lib/auth");
let login: typeof import("../../app/api/v1/auth/login/route");
let logout: typeof import("../../app/api/v1/auth/logout/route");
let rateLimit: typeof import("../../lib/login-rate-limit");

beforeAll(async () => {
  process.env.LOGIN_RATE_LIMIT_SECRET = "integration-test-login-rate-limit-secret";
  process.env.TRUST_PROXY_IP_HEADER = "x-test-client-ip";
  const testUrl = await assertTestDatabase();
  process.env.DATABASE_URL = testUrl;
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) });
  await db.$connect();
  [auth, login, logout, rateLimit] = await Promise.all([
    import("../../lib/auth"),
    import("../../app/api/v1/auth/login/route"),
    import("../../app/api/v1/auth/logout/route"),
    import("../../lib/login-rate-limit"),
  ]);
});

beforeEach(async () => {
  await assertTestDatabase();
  token = undefined;
  deleteCookie.mockClear();
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

afterAll(async () => { await db?.$disconnect(); });

const loginRequest = (email: string, password: string) => new NextRequest("http://localhost:3000/api/v1/auth/login", {
  method: "POST",
  headers: {
    origin: "http://localhost:3000",
    "content-type": "application/json",
    "x-test-client-ip": "203.0.113.10",
  },
  body: JSON.stringify({ email, password }),
});

describe("real session and login flow on isolated database", () => {
  it("accepts correct password, rejects wrong password and avoids password hash in response", async () => {
    const user = await userFactory(db);
    const password = "synthetic-test-only-password";
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
    const bad = await login.POST(loginRequest(user.email, "wrong-password"));
    expect(bad.status).toBe(401);
    const good = await login.POST(loginRequest(user.email, password));
    expect(good.status).toBe(200);
    const payload = await good.json();
    expect(payload.user.id).toBe(user.id);
    expect(JSON.stringify(payload)).not.toContain("passwordHash");
    const cookie = good.cookies.get(auth.getSessionCookieName());
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.value).toBeTruthy();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
  });

  it("rejects expired and forged tokens; logout invalidates only the current token", async () => {
    const user = await userFactory(db);
    token = "synthetic-expired-token";
    await db.session.create({ data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() - 60_000),
    } });
    expect(await auth.getCurrentUser()).toBeNull();
    token = "forged-token";
    expect(await auth.getCurrentUser()).toBeNull();
    const valid = "synthetic-valid-token";
    const other = await sessionFactory(db, user.id);
    await db.session.create({ data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(valid).digest("hex"),
      expiresAt: new Date(Date.now() + 60_000),
    } });
    token = valid;
    expect((await auth.getCurrentUser())?.id).toBe(user.id);
    const response = await logout.POST(new NextRequest("http://localhost:3000/api/v1/auth/logout", {
      method: "POST", headers: { origin: "http://localhost:3000" },
    }));
    expect(response.status).toBe(200);
    expect(await auth.getCurrentUser()).toBeNull();
    expect(await db.session.findUnique({ where: { id: other.id } })).not.toBeNull();
    expect(deleteCookie).toHaveBeenCalledWith(auth.getSessionCookieName());
  });

  it("limits repeated failed login attempts without disclosing account state", async () => {
    const user = await userFactory(db);
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword("synthetic-test-only-password") } });
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      statuses.push((await login.POST(loginRequest(user.email, "incorrect"))).status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    const limited = await login.POST(loginRequest(user.email, "incorrect"));
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
    expect((await login.POST(loginRequest("unknown@example.invalid", "incorrect"))).status).toBe(401);
  });

  it("clears account failures after a successful login", async () => {
    const user = await userFactory(db);
    const password = "synthetic-test-only-password";
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
    for (let attempt = 0; attempt < 4; attempt++) {
      expect((await login.POST(loginRequest(user.email, "incorrect"))).status).toBe(401);
    }
    expect((await login.POST(loginRequest(user.email, password))).status).toBe(200);
    expect((await login.POST(loginRequest(user.email, "incorrect"))).status).toBe(401);
  });

  it("limits distributed account attempts from one trusted proxy IP", async () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      expect(await rateLimit.recordLoginResult({
        email: `ip-rate-${attempt}@example.invalid`,
        ip: "203.0.113.99",
        succeeded: false,
      })).toEqual({ limited: false });
    }

    expect(await rateLimit.recordLoginResult({
      email: "next-ip-rate@example.invalid",
      ip: "203.0.113.99",
      succeeded: false,
    })).toMatchObject({ limited: true });
  });
});
