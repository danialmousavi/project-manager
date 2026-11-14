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
  controller: "55555555-5555-4555-8555-555555555555",
  platformProject: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  mobileProject: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  platformSprint: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  platformSprintDone: "aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  mobileSprint: "bbbbbba1-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  platformFutureSprint: "aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  epicFoundation: "f0000001-0000-4000-8000-000000000001",
  epicReporting: "f0000002-0000-4000-8000-000000000002",
  milestoneExperience: "f1000001-0000-4000-8000-000000000001",
  milestoneReports: "f1000002-0000-4000-8000-000000000002",
  taskDashboard: "c0000001-0000-4000-8000-000000000001",
  taskAuth: "c0000002-0000-4000-8000-000000000002",
  taskReports: "c0000003-0000-4000-8000-000000000003",
  taskMobile: "c0000004-0000-4000-8000-000000000004",
  taskRelease: "c0000005-0000-4000-8000-000000000005",
  taskBacklogStory: "c0000006-0000-4000-8000-000000000006",
  taskBacklogBug: "c0000007-0000-4000-8000-000000000007",
  taskSprintTodo: "c0000008-0000-4000-8000-000000000008",
  taskFuture: "c0000009-0000-4000-8000-000000000009",
  taskAuthValidation: "c0000010-0000-4000-8000-000000000010",
  taskAuthCopy: "c0000011-0000-4000-8000-000000000011",
  taskReportChart: "c0000012-0000-4000-8000-000000000012",
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
  sprintStart: new Date("2026-11-05T00:00:00.000Z"),
  sprintEnd: new Date("2026-11-19T00:00:00.000Z"),
  platformFutureStart: new Date("2026-11-20T00:00:00.000Z"),
  platformFutureEnd: new Date("2026-12-03T00:00:00.000Z"),
  mobileSprintStart: new Date("2026-11-03T00:00:00.000Z"),
  mobileSprintEnd: new Date("2026-11-24T00:00:00.000Z"),
  dashboardDue: new Date("2026-11-10T00:00:00.000Z"),
  dashboardStart: new Date("2026-10-28T00:00:00.000Z"),
  authDue: new Date("2026-11-14T00:00:00.000Z"),
  authStart: new Date("2026-11-05T00:00:00.000Z"),
  reportsDue: new Date("2026-11-20T00:00:00.000Z"),
  reportsStart: new Date("2026-11-08T00:00:00.000Z"),
  mobileDueDate: new Date("2026-11-18T00:00:00.000Z"),
  mobileTaskStart: new Date("2026-11-04T00:00:00.000Z"),
  futureDue: new Date("2026-11-28T00:00:00.000Z"),
  futureStart: new Date("2026-11-20T00:00:00.000Z"),
  releaseDue: new Date("2026-12-05T00:00:00.000Z"),
  releaseStart: new Date("2026-11-25T00:00:00.000Z"),
  backlogStoryStart: new Date("2026-11-21T00:00:00.000Z"),
  backlogStoryDue: new Date("2026-12-10T00:00:00.000Z"),
  backlogBugStart: new Date("2026-11-12T00:00:00.000Z"),
  backlogBugDue: new Date("2026-11-15T00:00:00.000Z"),
  sprintTodoStart: new Date("2026-11-10T00:00:00.000Z"),
  experienceMilestone: new Date("2026-11-18T00:00:00.000Z"),
  reportsMilestone: new Date("2026-12-05T00:00:00.000Z"),
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

  await prisma.user.upsert({
    where: { id: ids.controller },
    update: {
      name: "Nima Rahimi",
      email: "demo-controller@example.com",
      passwordHash,
      role: "CONTROLLER",
      isActive: true,
    },
    create: {
      id: ids.controller,
      name: "Nima Rahimi",
      email: "demo-controller@example.com",
      passwordHash,
      role: "CONTROLLER",
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
    [ids.platformProject, ids.controller, "CONTROLLER"],
    [ids.mobileProject, ids.manager, "MANAGER"],
    [ids.mobileProject, ids.employee, "MEMBER"],
    [ids.mobileProject, ids.controller, "CONTROLLER"],
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

  for (const epic of [
    {
      id: ids.epicFoundation,
      name: "زیرساخت و تجربه کاربری",
      description: "مجموعه کارهای پایه برای احراز هویت، داشبورد و تجربه اصلی سامانه.",
      projectId: ids.platformProject,
    },
    {
      id: ids.epicReporting,
      name: "گزارش‌گیری مدیریتی",
      description: "کارهای مرتبط با گزارش وضعیت پروژه و خروجی‌های مدیریتی.",
      projectId: ids.platformProject,
    },
  ]) {
    await prisma.epic.upsert({
      where: { id: epic.id },
      update: { name: epic.name, description: epic.description, projectId: epic.projectId, createdById: ids.admin },
      create: { ...epic, createdById: ids.admin },
    });
  }

  for (const milestone of [
    {
      id: ids.milestoneExperience,
      title: "تکمیل تجربه کاربری نسخه آزمایشی",
      description: "خروجی‌های اصلی احراز هویت و داشبورد پیش از تحویل نسخه آزمایشی.",
      targetDate: dates.experienceMilestone,
      status: "PLANNED" as const,
    },
    {
      id: ids.milestoneReports,
      title: "آماده‌سازی گزارش‌های مدیریتی",
      description: "نسخه قابل ارائه گزارش‌های پیشرفت و خروجی‌های مدیریتی.",
      targetDate: dates.reportsMilestone,
      status: "PLANNED" as const,
    },
  ]) {
    await prisma.milestone.upsert({
      where: { id: milestone.id },
      update: { ...milestone, projectId: ids.platformProject, completedAt: null },
      create: { ...milestone, projectId: ids.platformProject },
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
      status: "FUTURE",
      progress: 20,
      startDate: dates.mobileSprintStart,
      endDate: dates.mobileSprintEnd,
      projectId: ids.mobileProject,
    },
    create: {
      id: ids.mobileSprint,
      name: "اسپرینت آماده‌سازی اپلیکیشن",
      goal: "تعیین محدوده نسخه اول و آماده‌سازی طراحی.",
      status: "FUTURE",
      progress: 20,
      startDate: dates.mobileSprintStart,
      endDate: dates.mobileSprintEnd,
      projectId: ids.mobileProject,
    },
  });

  await prisma.sprint.upsert({
    where: { id: ids.platformFutureSprint },
    update: {
      name: "اسپرینت سوم - گزارش‌ها",
      goal: "تکمیل گزارش‌گیری و بهبود تجربه مدیر پروژه.",
      status: "FUTURE",
      progress: 0,
      startDate: dates.platformFutureStart,
      endDate: dates.platformFutureEnd,
      projectId: ids.platformProject,
    },
    create: {
      id: ids.platformFutureSprint,
      name: "اسپرینت سوم - گزارش‌ها",
      goal: "تکمیل گزارش‌گیری و بهبود تجربه مدیر پروژه.",
      status: "FUTURE",
      progress: 0,
      startDate: dates.platformFutureStart,
      endDate: dates.platformFutureEnd,
      projectId: ids.platformProject,
    },
  });

  const tasks = [
    {
      id: ids.taskDashboard,
      title: "طراحی داشبورد مدیریتی",
      description: "نمایش خلاصه پروژه‌ها، وظایف باز و وضعیت پیشرفت.",
      type: "STORY" as const,
      storyPoints: 8,
      rank: 10,
      acceptanceCriteria: "مدیر بتواند وضعیت همه پروژه‌های فعال را در یک نگاه ببیند.",
      status: "DONE" as const,
      priority: "HIGH" as const,
      startDate: dates.dashboardStart,
      dueDate: dates.dashboardDue,
      position: 1,
      sprintId: ids.platformSprintDone,
      assigneeId: ids.manager,
      epicId: ids.epicFoundation,
      milestoneId: ids.milestoneExperience,
    },
    {
      id: ids.taskAuth,
      title: "تکمیل احراز هویت کاربران",
      description: "بررسی ورود، session و محدودسازی تلاش‌های ناموفق.",
      type: "TASK" as const,
      storyPoints: 5,
      rank: 20,
      acceptanceCriteria: "ورود ناموفق و محدودیت تلاش‌ها در محیط تست قابل بررسی باشد.",
      status: "IN_PROGRESS" as const,
      priority: "URGENT" as const,
      startDate: dates.authStart,
      dueDate: dates.authDue,
      position: 2,
      sprintId: ids.platformSprint,
      assigneeId: ids.employee,
      epicId: ids.epicFoundation,
      milestoneId: ids.milestoneExperience,
    },
    {
      id: ids.taskReports,
      title: "گزارش پیشرفت پروژه",
      description: "افزودن نمایش روند پیشرفت در صفحه پروژه.",
      type: "STORY" as const,
      storyPoints: 3,
      rank: 30,
      acceptanceCriteria: "گزارش پیشرفت با داده واقعی پروژه نمایش داده شود.",
      status: "IN_REVIEW" as const,
      priority: "MEDIUM" as const,
      startDate: dates.reportsStart,
      dueDate: dates.reportsDue,
      position: 3,
      sprintId: ids.platformSprint,
      assigneeId: ids.reviewer,
      epicId: ids.epicReporting,
      milestoneId: ids.milestoneReports,
    },
    {
      id: ids.taskMobile,
      title: "جمع‌آوری نیازمندی‌های اپلیکیشن",
      description: "مصاحبه با کاربران و تهیه فهرست قابلیت‌های نسخه اول.",
      type: "STORY" as const,
      storyPoints: 5,
      rank: 10,
      acceptanceCriteria: "فهرست اولویت‌دار نیازمندی‌ها ثبت شود.",
      status: "TODO" as const,
      priority: "MEDIUM" as const,
      startDate: dates.mobileTaskStart,
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
      type: "TASK" as const,
      storyPoints: 2,
      rank: 20,
      acceptanceCriteria: "نسخه نمایشی قابل ارائه باشد.",
      status: "TODO" as const,
      priority: "LOW" as const,
      startDate: dates.releaseStart,
      dueDate: dates.releaseDue,
      position: 2,
      sprintId: ids.mobileSprint,
      assigneeId: ids.employee,
      projectId: ids.mobileProject,
    },
    {
      id: ids.taskBacklogStory,
      title: "افزودن اعلان‌های پروژه",
      description: "ارسال اعلان برای تغییر وضعیت تسک و نزدیک‌شدن موعد.",
      type: "STORY" as const,
      storyPoints: 8,
      rank: 1,
      acceptanceCriteria: "اعلان‌ها در سناریوی تغییر وضعیت تسک قابل تست باشند.",
      status: "TODO" as const,
      priority: "HIGH" as const,
      startDate: dates.backlogStoryStart,
      dueDate: dates.backlogStoryDue,
      position: 1,
      sprintId: null,
      assigneeId: null,
    },
    {
      id: ids.taskBacklogBug,
      title: "رفع خطای نمایش تاریخ شمسی",
      description: "بررسی خطای تبدیل تاریخ در صفحه جزئیات پروژه.",
      type: "BUG" as const,
      storyPoints: 2,
      rank: 2,
      acceptanceCriteria: "تمام تاریخ‌های صفحه با تقویم شمسی درست نمایش داده شوند.",
      status: "TODO" as const,
      priority: "URGENT" as const,
      startDate: dates.backlogBugStart,
      dueDate: dates.backlogBugDue,
      position: 2,
      sprintId: null,
      assigneeId: ids.reviewer,
    },
    {
      id: ids.taskSprintTodo,
      title: "بهبود فیلترهای برد کانبان",
      description: "افزودن فیلتر مسئول، اولویت و جست‌وجوی سریع.",
      type: "TASK" as const,
      storyPoints: 3,
      rank: 15,
      acceptanceCriteria: "کاربر بتواند تسک‌ها را با فیلترهای اصلی پیدا کند.",
      status: "TODO" as const,
      priority: "MEDIUM" as const,
      startDate: dates.sprintTodoStart,
      dueDate: dates.reportsDue,
      position: 4,
      sprintId: ids.platformSprint,
      assigneeId: ids.manager,
    },
    {
      id: ids.taskFuture,
      title: "طراحی خروجی گزارش مدیریتی",
      description: "تهیه ساختار گزارش برای Sprint آینده.",
      type: "STORY" as const,
      storyPoints: 5,
      rank: 5,
      acceptanceCriteria: "ساختار گزارش به تأیید مدیر پروژه برسد.",
      status: "TODO" as const,
      priority: "HIGH" as const,
      startDate: dates.futureStart,
      dueDate: dates.futureDue,
      position: 1,
      sprintId: ids.platformFutureSprint,
      assigneeId: ids.manager,
      epicId: ids.epicReporting,
      milestoneId: ids.milestoneReports,
    },
    {
      id: ids.taskAuthValidation,
      title: "اعتبارسنجی فرم ورود",
      description: "بررسی پیام‌های خطا و اعتبارسنجی ورودی‌های فرم ورود به‌عنوان زیرتسک احراز هویت.",
      type: "TASK" as const,
      storyPoints: 2,
      rank: 21,
      acceptanceCriteria: "پیام خطا برای ورودی نامعتبر و رمز اشتباه قابل مشاهده باشد.",
      status: "DONE" as const,
      priority: "HIGH" as const,
      startDate: dates.authStart,
      dueDate: dates.authDue,
      position: 2.1,
      sprintId: ids.platformSprint,
      assigneeId: ids.employee,
      epicId: ids.epicFoundation,
      parentTaskId: ids.taskAuth,
    },
    {
      id: ids.taskAuthCopy,
      title: "بازبینی متن‌های امنیتی ورود",
      description: "هماهنگ‌سازی متن هشدارهای ورود و محدودیت تلاش ناموفق.",
      type: "TASK" as const,
      storyPoints: 1,
      rank: 22,
      acceptanceCriteria: "متن هشدارها واضح و قابل فهم باشد.",
      status: "IN_REVIEW" as const,
      priority: "MEDIUM" as const,
      startDate: dates.authStart,
      dueDate: dates.authDue,
      position: 2.2,
      sprintId: ids.platformSprint,
      assigneeId: ids.reviewer,
      epicId: ids.epicFoundation,
      parentTaskId: ids.taskAuth,
    },
    {
      id: ids.taskReportChart,
      title: "نمودار روند پیشرفت",
      description: "پیاده‌سازی نمایش نمودار ساده برای گزارش پیشرفت پروژه.",
      type: "TASK" as const,
      storyPoints: 3,
      rank: 31,
      acceptanceCriteria: "روند پیشرفت با داده نمونه در گزارش دیده شود.",
      status: "TODO" as const,
      priority: "MEDIUM" as const,
      startDate: dates.futureStart,
      dueDate: dates.futureDue,
      position: 1.1,
      sprintId: ids.platformFutureSprint,
      assigneeId: ids.manager,
      epicId: ids.epicReporting,
      parentTaskId: ids.taskReports,
    },
  ];

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {
        title: task.title,
        description: task.description,
        type: task.type,
        storyPoints: task.storyPoints,
        rank: task.rank,
        acceptanceCriteria: task.acceptanceCriteria,
        epicId: task.epicId ?? null,
        milestoneId: task.milestoneId ?? null,
        parentTaskId: task.parentTaskId ?? null,
        status: task.status,
        priority: task.priority,
        startDate: task.startDate,
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
        type: task.type,
        storyPoints: task.storyPoints,
        rank: task.rank,
        acceptanceCriteria: task.acceptanceCriteria,
        epicId: task.epicId ?? null,
        milestoneId: task.milestoneId ?? null,
        parentTaskId: task.parentTaskId ?? null,
        status: task.status,
        priority: task.priority,
        startDate: task.startDate,
        dueDate: task.dueDate,
        position: task.position,
        projectId: task.projectId || ids.platformProject,
        sprintId: task.sprintId,
        assigneeId: task.assigneeId,
        createdById: ids.admin,
      },
    });
  }

  for (const dependency of [
    { dependentTaskId: ids.taskAuth, prerequisiteTaskId: ids.taskDashboard },
    { dependentTaskId: ids.taskReports, prerequisiteTaskId: ids.taskDashboard },
    { dependentTaskId: ids.taskReports, prerequisiteTaskId: ids.taskAuth },
    { dependentTaskId: ids.taskSprintTodo, prerequisiteTaskId: ids.taskReports },
    { dependentTaskId: ids.taskFuture, prerequisiteTaskId: ids.taskReports },
    { dependentTaskId: ids.taskBacklogStory, prerequisiteTaskId: ids.taskSprintTodo },
  ]) {
    await prisma.taskDependency.upsert({
      where: { dependentTaskId_prerequisiteTaskId: dependency },
      update: {},
      create: dependency,
    });
  }

  const activeSprintTasks = tasks.filter(
    (task) => task.sprintId === ids.platformSprint
  );

  await prisma.sprintStartSnapshot.upsert({
    where: { sprintId: ids.platformSprint },
    update: {
      plannedTaskCount: activeSprintTasks.length,
      plannedStoryPoints: activeSprintTasks.reduce(
        (total, task) => total + (task.storyPoints ?? 0),
        0,
      ),
    },
    create: {
      sprintId: ids.platformSprint,
      plannedTaskCount: activeSprintTasks.length,
      plannedStoryPoints: activeSprintTasks.reduce(
        (total, task) => total + (task.storyPoints ?? 0),
        0,
      ),
      tasks: {
        create: activeSprintTasks.map((task) => ({
          taskId: task.id,
          title: task.title,
          type: task.type,
          storyPoints: task.storyPoints,
          rank: task.rank,
          statusAtStart: task.status,
          assigneeId: task.assigneeId,
        })),
      },
    },
  });

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
  console.log("  demo-controller@example.com");
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
