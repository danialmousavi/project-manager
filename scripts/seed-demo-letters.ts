import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "127.0.0.1" || url.port !== "54329" || url.pathname !== "/project_manager") throw new Error("This script only runs against the local demo database.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
const samples = [
  ["هماهنگی جلسه بررسی پیشرفت", "سلام، لطفاً گزارش پیشرفت فعالیت‌های این هفته و مواردی که به تصمیم تیم نیاز دارند را پیش از جلسه آماده کنید. ممنون از همراهی شما."],
  ["جمع‌بندی بازخورد نسخه اولیه", "سلام، نسخه اولیه بررسی شد. لطفاً اصلاحات مطرح‌شده در جلسه را اولویت‌بندی کنید و زمان تقریبی تحویل را اطلاع دهید."],
  ["برنامه تحویل مرحله بعد", "سلام، برای تحویل مرحله بعد لطفاً وضعیت کارهای باز و موارد وابسته را به‌روز کنید تا برنامه نهایی با تیم هماهنگ شود."],
  ["هماهنگی ارائه پروژه", "سلام، لطفاً نسخه قابل ارائه پروژه و نکات مهم جلسه را آماده کنید تا پیش از ارائه نهایی مرور کنیم."],
];

async function main() {
  const projects = await db.project.findMany({ where: { archivedAt: null }, include: { members: { where: { user: { isActive: true, email: { endsWith: "@example.com" } } }, include: { user: true }, orderBy: { joinedAt: "asc" } } } });
  const admin = await db.user.findUnique({ where: { email: "admin@example.com" } });
  let created = 0;
  for (const project of projects) {
    const members = project.members;
    if (members.length < 2) continue;
    for (let i = 0; i < samples.length; i++) {
      const [subject, body] = samples[i];
      const sender = i === 3 && admin ? admin : members[i % members.length].user;
      const recipient = members[(i + 1) % members.length].user;
      const exists = await db.letter.findFirst({ where: { projectId: project.id, senderId: sender.id, subject, body, recipients: { some: { userId: recipient.id } } }, select: { id: true } });
      if (exists) continue;
      await db.letter.create({ data: { projectId: project.id, senderId: sender.id, subject, body, createdAt: new Date(Date.now() - (i + 1) * 86400000), recipients: { create: { userId: recipient.id } } } });
      created++;
    }
  }
  console.log(`Created ${created} demo letters in ${projects.length} projects.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
