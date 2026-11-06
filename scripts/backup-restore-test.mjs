import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";

await import("./verify-test-db.mjs");
const sourceUrl = new URL(process.env.TEST_DATABASE_URL);
const source = new pg.Client({ connectionString: sourceUrl.toString() });
await source.connect();

const tables = ["User", "Project", "ProjectMember", "Sprint", "Task", "TaskComment", "ProgressHistory", "Session"];
async function snapshot(client) {
  const result = {};
  for (const table of tables) {
    const { rows } = await client.query(`SELECT count(*)::int AS count FROM public."${table}"`);
    result[table] = rows[0].count;
  }
  return result;
}

const { rows: users } = await source.query('SELECT id, name FROM public."User" LIMIT 1');
if (users.length === 0) throw new Error("Create synthetic fixture before backup");

const managerId = randomUUID();
const projectId = randomUUID();
const sprintId = randomUUID();
const taskId = randomUUID();
await source.query(
  'INSERT INTO public."User" (id, name, email, "passwordHash", role, "updatedAt") VALUES ($1, $2, $3, $4, $5, now())',
  [managerId, "Synthetic backup manager", `audit-${randomUUID()}@example.invalid`, "fixture-only-no-login", "MANAGER"]
);
await source.query(
  'INSERT INTO public."Project" (id, name, "createdById", "updatedAt") VALUES ($1, $2, $3, now())',
  [projectId, "Synthetic backup project", users[0].id]
);
await source.query(
  'INSERT INTO public."ProjectMember" (id, "projectId", "userId", role) VALUES ($1, $2, $3, $4)',
  [randomUUID(), projectId, managerId, "MANAGER"]
);
await source.query(
  'INSERT INTO public."Sprint" (id, name, "projectId", "updatedAt") VALUES ($1, $2, $3, now())',
  [sprintId, "Synthetic backup sprint", projectId]
);
await source.query(
  'INSERT INTO public."Task" (id, title, "projectId", "sprintId", "createdById", "updatedAt") VALUES ($1, $2, $3, $4, $5, now())',
  [taskId, "Synthetic backup task", projectId, sprintId, users[0].id]
);
await source.query(
  'INSERT INTO public."TaskComment" (id, content, "taskId", "authorId", "updatedAt") VALUES ($1, $2, $3, $4, now())',
  [randomUUID(), "Synthetic backup comment", taskId, users[0].id]
);
await source.query(
  'INSERT INTO public."ProgressHistory" (id, target, progress, "projectId", "updatedById") VALUES ($1, $2, $3, $4, $5)',
  [randomUUID(), "PROJECT", 50, projectId, users[0].id]
);
const before = await snapshot(source);

const suffix = randomUUID().slice(0, 8);
const restoreDb = `pm_audit_restore_${suffix}`;
const archive = `/tmp/pm_audit_${suffix}.dump`;
const compose = ["compose", "-f", "docker-compose.test.yml", "-p", "pm-audit-isolated", "exec", "-T", "postgres-audit-test"];
function docker(args) {
  execFileSync("docker", [...compose, ...args], { stdio: "pipe" });
}

try {
  docker(["pg_dump", "-U", "pm_audit_runner", "-d", "pm_audit_test", "-Fc", "-f", archive]);
  await source.query('UPDATE public."User" SET name = $1 WHERE id = $2', ["Synthetic changed after backup", users[0].id]);
  docker(["createdb", "-U", "pm_audit_runner", "-O", "pm_audit_runner", restoreDb]);
  docker(["pg_restore", "-U", "pm_audit_runner", "--no-owner", "--no-acl", "-d", restoreDb, archive]);

  const restoreUrl = new URL(sourceUrl);
  restoreUrl.pathname = `/${restoreDb}`;
  const restored = new pg.Client({ connectionString: restoreUrl.toString() });
  await restored.connect();
  try {
    const after = await snapshot(restored);
    const { rows } = await restored.query('SELECT name FROM public."User" WHERE id = $1', [users[0].id]);
    const { rows: relation } = await restored.query(
      'SELECT t.id FROM public."Task" t JOIN public."Sprint" s ON s.id = t."sprintId" JOIN public."Project" p ON p.id = t."projectId" JOIN public."TaskComment" c ON c."taskId" = t.id WHERE t.id = $1 AND s."projectId" = p.id',
      [taskId]
    );
    if (JSON.stringify(before) !== JSON.stringify(after) || rows[0]?.name !== users[0].name || relation.length !== 1) {
      throw new Error("Restore content mismatch");
    }
    console.log(JSON.stringify({ result: "PASS", restoreDatabase: restoreDb, before, after }));
  } finally {
    await restored.end();
  }
} finally {
  await source.end();
}
