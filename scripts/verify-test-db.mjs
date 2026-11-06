import pg from "pg";

const raw = process.env.TEST_DATABASE_URL;
if (!raw) throw new Error("TEST_DATABASE_URL is required");
const url = new URL(raw);
if (
  url.protocol !== "postgresql:" ||
  url.hostname !== "127.0.0.1" ||
  url.port !== "55433" ||
  url.pathname !== "/pm_audit_test" ||
  decodeURIComponent(url.username) !== "pm_audit_runner" ||
  raw === process.env.DEVELOPMENT_DATABASE_URL
) throw new Error("Test database identity mismatch");

const client = new pg.Client({ connectionString: raw });
try {
  await client.connect();
  const result = await client.query(
    `SELECT current_database() AS db, current_user AS role,
      (SELECT identity FROM audit_guard.audit_test_marker LIMIT 1) AS marker`
  );
  const row = result.rows[0];
  if (row?.db !== "pm_audit_test" || row?.role !== "pm_audit_runner" || row?.marker !== "pm-audit-isolated-v1") {
    throw new Error("Test database marker mismatch");
  }
  console.log("Isolated test database verified");
} finally {
  await client.end();
}
