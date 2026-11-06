import pg from "pg";

const EXPECTED = {
  host: "127.0.0.1",
  port: "55433",
  database: "pm_audit_test",
  user: "pm_audit_runner",
  marker: "pm-audit-isolated-v1",
};

export async function assertTestDatabase(): Promise<string> {
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw) throw new Error("TEST_DATABASE_URL is required");
  const url = new URL(raw);
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== EXPECTED.host ||
    url.port !== EXPECTED.port ||
    url.pathname !== `/${EXPECTED.database}` ||
    decodeURIComponent(url.username) !== EXPECTED.user ||
    raw === process.env.DEVELOPMENT_DATABASE_URL
  ) {
    throw new Error("Test database identity mismatch");
  }

  const client = new pg.Client({ connectionString: raw });
  try {
    await client.connect();
    const result = await client.query<{
      database: string;
      username: string;
      marker: string;
    }>(
      `SELECT current_database() AS database, current_user AS username,
        (SELECT identity FROM audit_guard.audit_test_marker LIMIT 1) AS marker`
    );
    const identity = result.rows[0];
    if (
      identity?.database !== EXPECTED.database ||
      identity.username !== EXPECTED.user ||
      identity.marker !== EXPECTED.marker
    ) {
      throw new Error("Test database marker mismatch");
    }
    return raw;
  } finally {
    await client.end();
  }
}
