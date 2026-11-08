import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/password";

if (process.env.DEMO_SEED !== "true") {
  throw new Error(
    "Demo seed is disabled. Set DEMO_SEED=true before running this script.",
  );
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const demoPassword = process.env.DEMO_PASSWORD || "Demo123!";

const ids = {
  admin: "11111111-1111-4111-8111-111111111111",
  manager: "22222222-2222-4222-8222-222222222222",
  employee: "33333333-3333-4333-8333-333333333333",
  reviewer: "44444444-4444-4444-8444-444444444444",
  platformProject: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  mobileProject: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  platformSprint: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  platformSprintDone: "aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  mobileSprint: "bbbbbba1-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  taskDashboard: "c0000001-0000-4000-8000-000000000001",
  taskAuth: "c0000002-0000-4000-8000-000000000002",
  taskReports: "c0000003-0000-4000-8000-000000000003",
  taskMobile: "c0000004-0000-4000-8000-000000000004",
  taskRelease: "c0000005-0000-4000-8000-000000000005",
  commentDashboard: "d0000001-0000-4000-8000-000000000001",
  commentAuth: "d0000002-0000-4000-8000-000000000002",
  projectProgress: "e0000001-0000-4000-8000-000000000001",
  sprintProgress: "e0000002-0000-4000-8000-000000000002",
} as const;

const dates = {
  projectStart: new Date("2026-10-01T00:00:00.000Z"),
  platformDue: new Date("2026-12-20T00:00:00.000Z"),
  mobileStart: new Date("2026-11-01T00:00:00.000Z"),
  mobileDue: new Date("2027-01-15T00:00:00.000Z"),
  sprintDoneStart: new Date("2026-10-01T00:00:00.000Z"),
  sprintDoneEnd: new Date("2026-10-21T00:00:00.000Z"),
  sprintStart: new Date("2026-10-22T00:00:00.000Z"),
  sprintEnd: new Date("2026-11-12T00:00:00.000Z"),
  mobileSprintStart: new Date("2026-11-03T00:00:00.000Z"),
  mobileSprintEnd: new Date("2026-11-24T00:00:00.000Z"),
  dashboardDue: new Date("2026-11-10T00:00:00.000Z"),
  authDue: new Date("2026-11-14T00:00:00.000Z"),
  reportsDue: new Date("2026-11-20T00:00:00.000Z"),
  mobileDueDate: new Date("2026-11-18T00:00:00.000Z"),
  releaseDue: new Date("2026-12-05T00:00:00.000Z"),
} as const;

async function main() {
  const passwordHash = await hashPassword(demoPassword);

  await prisma.user.upsert({
    where: { id: ids.admin },
    update: {
      name: "Demo Admin",
      email: "demo-admin@example.com",
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
    create: {
      id: ids.admin,
      name: "Demo Admin",
      email: "demo-admin@example.com",
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { id: ids.manager },
    update: {
      name: "Sara Ahmadi",
      email: "demo-manager@example.com",
      passwordHash,
      role: "MANAGER",
      isActive: true,
    },
    create: {
      id: ids.manager,
      name: "Sara Ahmadi",
      email: "demo-manager@example.com",
      passwordHash,
      role: "MANAGER",
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { id: ids.employee },
    update: {
      name: "Reza Karimi",
      email: "demo-employee@example.com",
      passwordHash,
      role: "EMPLOYEE",
      isActive: true,
    },
    create: {
      id: ids.employee,
      name: "Reza Karimi",
      email: "demo-employee@example.com",
      passwordHash,
      role: "EMPLOYEE",
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { id: ids.reviewer },
    update: {
      name: "Mina Hosseini",
      email: "demo-reviewer@example.com",
      passwordHash,
      role: "EMPLOYEE",
      isActive: true,
    },
    create: {
      id: ids.reviewer,
      name: "Mina Hosseini",
      email: "demo-reviewer@example.com",
      passwordHash,
      role: "EMPLOYEE",
      isActive: true,
    },
  });

  await prisma.project.upsert({
    where: { id: ids.platformProject },
    update: {
      name: "سامانه مدیریت پروژه سازمانی",
      description: "طراحی و توسعه مرکز مدیریت پروژه‌ها، وظایف و گزارش‌های تیم.",
      status: "ACTIVE",
      priority: "HIGH",
      startDate: dates.projectStart,
      dueDate: dates.platformDue,
      progress: 68,
      createdById: ids.admin,
      archivedAt: null,
    },
    create: {
      id: ids.platformProject,
      name: "سامانه مدیریت پروژه سازمانی",
      description: "طراحی و توسعه مرکز مدیریت پروژه‌ها، وظایف و گزارش‌های تیم.",
      status: "ACTIVE",
      priority: "HIGH",
      startDate: dates.projectStart,
      dueDate: dates.platformDue,
      progress: 68,
      createdById: ids.admin,
    },
  });

  await prisma.project.upsert({
    where: { id: ids.mobileProject },
    update: {
      name: "اپلیکیشن همراه مشتریان",
      description: "نسخه موبایل برای پیگیری وضعیت درخواست‌ها و اعلان‌ها.",
      status: "PLANNED",
      priority: "MEDIUM",
      startDate: dates.mobileStart,
      dueDate: dates.mobileDue,
      progress: 18,
      createdById: ids.admin,
      archivedAt: null,
    },
    create: {
      id: ids.mobileProject,
      name: "اپلیکیشن همراه مشتریان",
      description: "نسخه موبایل برای پیگیری وضعیت درخواست‌ها و اعلان‌ها.",
      status: "PLANNED",
      priority: "MEDIUM",
      startDate: dates.mobileStart,
      dueDate: dates.mobileDue,
      progress: 18,
      createdById: ids.admin,
    },
  });

  for (const membership of [
    [ids.platformProject, ids.manager, "MANAGER"],
    [ids.platformProject, ids.employee, "MEMBER"],
    [ids.platformProject, ids.reviewer, "MEMBER"],
    [ids.mobileProject, ids.manager, "MANAGER"],
    [ids.mobileProject, ids.employee, "MEMBER"],
  ] as const) {
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: membership[0],
          userId: membership[1],
        },
      },
      update: { role: membership[2] },
      create: {
        projectId: membership[0],
        userId: membership[1],
        role: membership[2],
      },
    });
  }

  await prisma.sprint.upsert({
    where: { id: ids.platformSprintDone },
    update: {
      name: "اسپرینت اول - تحلیل و زیرساخت",
      goal: "آماده‌سازی مدل داده و زیرساخت احراز هویت.",
      status: "COMPLETED",
      progress: 100,
      startDate: dates.sprintDoneStart,
      endDate: dates.sprintDoneEnd,
      projectId: ids.platformProject,
    },
    create: {
      id: ids.platformSprintDone,
      name: "اسپرینت اول - تحلیل و زیرساخت",
      goal: "آماده‌سازی مدل داده و زیرساخت احراز هویت.",
      status: "COMPLETED",
      progress: 100,
      startDate: dates.sprintDoneStart,
      endDate: dates.sprintDoneEnd,
      projectId: ids.platformProject,
    },
  });

  await prisma.sprint.upsert({
    where: { id: ids.platformSprint },
    update: {
      name: "اسپرینت دوم - تجربه کاربری",
      goal: "تکمیل داشبورد و جریان مدیریت وظایف.",
      status: "ACTIVE",
      progress: 68,
      startDate: dates.sprintStart,
      endDate: dates.sprintEnd,
      projectId: ids.platformProject,
    },
    create: {
      id: ids.platformSprint,
      name: "اسپرینت دوم - تجربه کاربری",
      goal: "تکمیل داشبورد و جریان مدیریت وظایف.",
      status: "ACTIVE",
      progress: 68,
      startDate: dates.sprintStart,
      endDate: dates.sprintEnd,
      projectId: ids.platformProject,
    },
  });

  await prisma.sprint.upsert({
    where: { id: ids.mobileSprint },
    update: {
      name: "اسپرینت آماده‌سازی اپلیکیشن",
      goal: "تعیین محدوده نسخه اول و آماده‌سازی طراحی.",
      status: "PLANNED",
      progress: 20,
      startDate: dates.mobileSprintStart,
      endDate: dates.mobileSprintEnd,
      projectId: ids.mobileProject,
    },
    create: {
      id: ids.mobileSprint,
      name: "اسپرینت آماده‌سازی اپلیکیشن",
      goal: "تعیین محدوده نسخه اول و آماده‌سازی طراحی.",
      status: "PLANNED",
      progress: 20,
      startDate: dates.mobileSprintStart,
      endDate: dates.mobileSprintEnd,
      projectId: ids.mobileProject,
    },
  });

  const tasks = [
    {
      id: ids.taskDashboard,
      title: "طراحی داشبورد مدیریتی",
      description: "نمایش خلاصه پروژه‌ها، وظایف باز و وضعیت پیشرفت.",
      status: "DONE" as const,
      priority: "HIGH" as const,
      dueDate: dates.dashboardDue,
      position: 1,
      sprintId: ids.platformSprintDone,
      assigneeId: ids.manager,
    },
    {
      id: ids.taskAuth,
      title: "تکمیل احراز هویت کاربران",
      description: "بررسی ورود، session و محدودسازی تلاش‌های ناموفق.",
      status: "IN_PROGRESS" as const,
      priority: "URGENT" as const,
      dueDate: dates.authDue,
      position: 2,
      sprintId: ids.platformSprint,
      assigneeId: ids.employee,
    },
    {
      id: ids.taskReports,
      title: "گزارش پیشرفت پروژه",
      description: "افزودن نمایش روند پیشرفت در صفحه پروژه.",
      status: "IN_REVIEW" as const,
      priority: "MEDIUM" as const,
      dueDate: dates.reportsDue,
      position: 3,
      sprintId: ids.platformSprint,
      assigneeId: ids.reviewer,
    },
    {
      id: ids.taskMobile,
      title: "جمع‌آوری نیازمندی‌های اپلیکیشن",
      description: "مصاحبه با کاربران و تهیه فهرست قابلیت‌های نسخه اول.",
      status: "TODO" as const,
      priority: "MEDIUM" as const,
      dueDate: dates.mobileDueDate,
      position: 1,
      sprintId: ids.mobileSprint,
      assigneeId: ids.manager,
      projectId: ids.mobileProject,
    },
    {
      id: ids.taskRelease,
      title: "آماده‌سازی نسخه نمایشی",
      description: "بررسی نهایی داده‌های نمونه و آماده‌سازی ارائه.",
      status: "TODO" as const,
      priority: "LOW" as const,
      dueDate: dates.releaseDue,
      position: 2,
      sprintId: ids.mobileSprint,
      assigneeId: ids.employee,
      projectId: ids.mobileProject,
    },
  ];

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        position: task.position,
        version: 1,
        deletedAt: null,
        deletedById: null,
        projectId: task.projectId || ids.platformProject,
        sprintId: task.sprintId,
        assigneeId: task.assigneeId,
        createdById: ids.admin,
      },
      create: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        position: task.position,
        projectId: task.projectId || ids.platformProject,
        sprintId: task.sprintId,
        assigneeId: task.assigneeId,
        createdById: ids.admin,
      },
    });
  }

  await prisma.taskComment.upsert({
    where: { id: ids.commentDashboard },
    update: {
      content: "نسخه اولیه داشبورد آماده بررسی تیم است.",
      taskId: ids.taskDashboard,
      authorId: ids.manager,
    },
    create: {
      id: ids.commentDashboard,
      content: "نسخه اولیه داشبورد آماده بررسی تیم است.",
      taskId: ids.taskDashboard,
      authorId: ids.manager,
    },
  });

  await prisma.taskComment.upsert({
    where: { id: ids.commentAuth },
    update: {
      content: "لطفاً رفتار ورود ناموفق و محدودسازی را هم بررسی کن.",
      taskId: ids.taskAuth,
      authorId: ids.reviewer,
    },
    create: {
      id: ids.commentAuth,
      content: "لطفاً رفتار ورود ناموفق و محدودسازی را هم بررسی کن.",
      taskId: ids.taskAuth,
      authorId: ids.reviewer,
    },
  });

  await prisma.progressHistory.upsert({
    where: { id: ids.projectProgress },
    update: {
      target: "PROJECT",
      progress: 68,
      note: "پیشرفت کلی پروژه پس از تکمیل داشبورد.",
      projectId: ids.platformProject,
      sprintId: null,
      updatedById: ids.manager,
    },
    create: {
      id: ids.projectProgress,
      target: "PROJECT",
      progress: 68,
      note: "پیشرفت کلی پروژه پس از تکمیل داشبورد.",
      projectId: ids.platformProject,
      updatedById: ids.manager,
    },
  });

  await prisma.progressHistory.upsert({
    where: { id: ids.sprintProgress },
    update: {
      target: "SPRINT",
      progress: 68,
      note: "تکمیل بخش اصلی تجربه کاربری.",
      projectId: null,
      sprintId: ids.platformSprint,
      updatedById: ids.manager,
    },
    create: {
      id: ids.sprintProgress,
      target: "SPRINT",
      progress: 68,
      note: "تکمیل بخش اصلی تجربه کاربری.",
      sprintId: ids.platformSprint,
      updatedById: ids.manager,
    },
  });

  console.log("Demo records seeded successfully.");
  console.log("Demo accounts:");
  console.log("  demo-admin@example.com");
  console.log("  demo-manager@example.com");
  console.log("  demo-employee@example.com");
  console.log("  demo-reviewer@example.com");
  console.log("Password: use DEMO_PASSWORD (default: Demo123!)");
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
