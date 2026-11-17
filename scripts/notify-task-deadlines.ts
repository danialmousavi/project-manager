import "dotenv/config";

import { notifyTaskDeadlines } from "../lib/task-deadline-notifications";

async function main() {
  const result = await notifyTaskDeadlines();
  console.info(`Deadline notifications: ${result.dueSoonCount} due soon, ${result.overdueCount} overdue.`);
}

main().catch((error) => {
  console.error("Deadline notification job failed:", error);
  process.exitCode = 1;
});
