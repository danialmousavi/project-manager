import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/password";

const url = new URL(process.env.DATABASE_URL ?? "");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "54329" || url.pathname !== "/project_manager") {
  throw new Error("Demo reset is restricted to the local project_manager database on port 54329.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
const day = (n: number) => new Date(Date.now() + n * 86_400_000);

const projects = [
  { name: "فروشگاه آنلاین سپهر", description: "طراحی و توسعه فروشگاه اینترنتی، از انتخاب کالا تا پرداخت و پیگیری سفارش.", status: "ACTIVE", priority: "HIGH", start: -68, due: 42, epics: ["تجربه خرید", "پرداخت و سفارش"], tasks: ["طراحی صفحه جزئیات محصول", "پیاده‌سازی جستجو و فیلتر کالا", "سبد خرید و محاسبه هزینه ارسال", "اتصال درگاه پرداخت", "پیگیری وضعیت سفارش", "رفع خطای اعمال کد تخفیف", "تست خرید با موبایل", "تهیه راهنمای مدیریت محصولات"] },
  { name: "سامانه ارتباط با مشتریان آوید", description: "یکپارچه‌سازی سرنخ‌های فروش، پیگیری فرصت‌ها و گزارش عملکرد تیم فروش.", status: "ACTIVE", priority: "URGENT", start: -50, due: 55, epics: ["مدیریت مشتریان", "گزارش‌های فروش"], tasks: ["ثبت و ویرایش اطلاعات مشتری", "تعریف مراحل فرصت فروش", "داشبورد عملکرد کارشناسان", "یادآوری تماس با مشتری", "ورود اطلاعات مشتریان از فایل", "رفع مشکل ثبت شماره تماس", "سطح دسترسی مدیر فروش", "آزمون پذیرش با تیم فروش"] },
  { name: "اپلیکیشن رزرو نوبت آرامش", description: "رزرو آنلاین نوبت، مدیریت برنامه متخصصان و ارسال یادآوری به مراجعان.", status: "ACTIVE", priority: "MEDIUM", start: -36, due: 72, epics: ["رزرو نوبت", "پنل متخصصان"], tasks: ["نمایش زمان‌های آزاد", "ثبت و لغو نوبت", "طراحی پروفایل متخصص", "مدیریت ساعات کاری", "یادآوری نوبت با پیامک", "جلوگیری از رزرو تکراری", "تست سناریوهای لغو", "طراحی صفحه سوابق نوبت"] },
  { name: "داشبورد منابع انسانی همکار", description: "نمایش اطلاعات کارکنان، درخواست مرخصی و گزارش وضعیت حضور تیم.", status: "PLANNED", priority: "MEDIUM", start: 7, due: 100, epics: ["اطلاعات کارکنان", "مرخصی و حضور"], tasks: ["جمع‌آوری نیازمندی‌های منابع انسانی", "طراحی ساختار اطلاعات کارکنان", "طراحی فرم درخواست مرخصی", "تعریف گردش تأیید مدیر", "گزارش مانده مرخصی", "طراحی داشبورد حضور", "تعیین سطح دسترسی", "برنامه‌ریزی جلسه شروع پروژه"] },
  { name: "وب‌سایت معرفی برند نیلا", description: "بازطراحی وب‌سایت شرکتی و آماده‌سازی صفحات محصولات برای انتشار.", status: "COMPLETED", priority: "LOW", start: -115, due: -15, epics: ["طراحی و محتوا", "انتشار و بهینه‌سازی"], tasks: ["تدوین ساختار صفحات", "طراحی صفحه اصلی", "آماده‌سازی محتوای محصولات", "پیاده‌سازی فرم تماس", "بهینه‌سازی نمایش موبایل", "بهبود سرعت بارگذاری", "بازبینی نهایی محتوا", "انتشار نسخه نهایی"] },
  { name: "سامانه انبار و تأمین پارسا", description: "مدیریت موجودی، درخواست تأمین و گزارش گردش کالا در انبار.", status: "ON_HOLD", priority: "HIGH", start: -80, due: 85, epics: ["موجودی انبار", "فرآیند تأمین"], tasks: ["تعریف کالا و دسته‌بندی", "ثبت ورود و خروج کالا", "گزارش موجودی لحظه‌ای", "هشدار حداقل موجودی", "ثبت درخواست خرید", "تأیید درخواست تأمین", "بررسی اتصال به حسابداری", "مستندسازی گردش انبار"] },
] as const;

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim() || "admin@example.com";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  const adminHash = process.env.ADMIN_PASSWORD?.trim() ? await hashPassword(process.env.ADMIN_PASSWORD.trim()) : existingAdmin?.passwordHash;
  if (!adminHash) throw new Error("Set ADMIN_PASSWORD before resetting the demo.");
  const demoHash = await hashPassword("Demo1234!");

  const counts = await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany();
    await tx.session.deleteMany();
    await tx.loginAttempt.deleteMany();
    await tx.project.deleteMany();
    await tx.companyMember.deleteMany();
    await tx.user.deleteMany();
    await tx.company.deleteMany();
    const admin = await tx.user.create({ data: { name: "مدیر سیستم", email: adminEmail, passwordHash: adminHash, role: "ADMIN" } });
    const people = await Promise.all([
      ["نگار احمدی", "negar@example.com", "MANAGER"], ["امیر رضایی", "amir@example.com", "MANAGER"],
      ["سارا محمدی", "sara@example.com", "MANAGER"], ["علی کریمی", "ali@example.com", "EMPLOYEE"],
      ["مریم حسینی", "maryam@example.com", "EMPLOYEE"], ["پریسا کاظمی", "parisa@example.com", "CONTROLLER"],
      ["محمد نادری", "mohammad@example.com", "MANAGER"], ["کیان مرادی", "kian@example.com", "MANAGER"],
      ["نیلوفر موسوی", "niloufar@example.com", "MANAGER"], ["رضا کریمی", "reza@example.com", "EMPLOYEE"],
      ["الهام رضوی", "elham@example.com", "EMPLOYEE"], ["کامران نوری", "kamran@example.com", "CONTROLLER"],
      ["سمیرا کاظمی", "samira@example.com", "MANAGER"], ["پویا عزیزی", "pooya@example.com", "MANAGER"],
      ["احسان شریفی", "ehsan@example.com", "MANAGER"], ["لیلا احمدی", "leila@example.com", "EMPLOYEE"],
      ["حمید خالقی", "hamid@example.com", "EMPLOYEE"], ["فرهاد محسنی", "farhad@example.com", "CONTROLLER"],
    ].map(([name, email, role]) => tx.user.create({ data: { name, email, role: role as "MANAGER" | "EMPLOYEE" | "CONTROLLER", passwordHash: demoHash } })));

    const companySpecs = [
      {
        name: "فناوری آریا",
        ownerIndex: 0,
        managerIndex: 2,
        expertIndexes: [3, 4],
        controllerIndex: 5,
        members: [[0, "OWNER"], [1, "ADMIN"], [2, "PROJECT_MANAGER"], [3, "EXPERT"], [4, "EXPERT"], [5, "CONTROLLER"]] as const,
      },
      {
        name: "بازرگانی سپهر",
        ownerIndex: 6,
        managerIndex: 8,
        expertIndexes: [9, 10],
        controllerIndex: 11,
        members: [[6, "OWNER"], [7, "ADMIN"], [8, "PROJECT_MANAGER"], [9, "EXPERT"], [10, "EXPERT"], [11, "CONTROLLER"]] as const,
      },
      {
        name: "سلامت آفتاب",
        ownerIndex: 12,
        managerIndex: 14,
        expertIndexes: [15, 16],
        controllerIndex: 17,
        members: [[12, "OWNER"], [13, "ADMIN"], [14, "PROJECT_MANAGER"], [15, "EXPERT"], [16, "EXPERT"], [17, "CONTROLLER"]] as const,
      },
    ];

    const companies = await Promise.all(companySpecs.map((spec) =>
      tx.company.create({ data: { name: spec.name, status: "ACTIVE" } }),
    ));

    await tx.companyMember.createMany({
      data: [
        ...companySpecs.flatMap((spec, companyIndex) =>
          spec.members.map(([personIndex, role]) => ({
            companyId: companies[companyIndex].id,
            userId: people[personIndex].id,
            role,
          })),
        ),
      ],
    });

    for (let p = 0; p < projects.length; p++) {
      const spec = projects[p];
      const companyIndex = p % companySpecs.length;
      const companySpec = companySpecs[companyIndex];
      const manager = people[companySpec.managerIndex];
      const experts = companySpec.expertIndexes.map((index) => people[index]);
      const controller = people[companySpec.controllerIndex];
      const team = [manager, ...experts, controller];
      const project = await tx.project.create({ data: { name: spec.name, description: spec.description, status: spec.status, priority: spec.priority, startDate: day(spec.start), dueDate: day(spec.due), companyId: companies[companyIndex].id, createdById: people[companySpec.ownerIndex].id, createdAt: day(spec.start - 4), members: { create: team.map((person, i) => ({ userId: person.id, role: i === 0 ? "MANAGER" : i === team.length - 1 ? "CONTROLLER" : "MEMBER", joinedAt: day(spec.start - 2) })) } } });
      const epics = await Promise.all(spec.epics.map((name) => tx.epic.create({ data: { name, description: `مجموعه فعالیت‌های مرتبط با ${name} در پروژه ${spec.name}.`, projectId: project.id, createdById: manager.id } })));
      const finished = spec.status === "COMPLETED";
      const planned = spec.status === "PLANNED";
      const sprints = await Promise.all([
        tx.sprint.create({ data: { name: "اسپرینت ۱ — آماده‌سازی", goal: "آماده‌سازی زیرساخت و تکمیل قابلیت‌های پایه", status: planned ? "FUTURE" : "COMPLETED", projectId: project.id, startDate: day(planned ? 7 : -35), endDate: day(planned ? 20 : -21) } }),
        tx.sprint.create({ data: { name: "اسپرینت ۲ — توسعه و تحویل", goal: "تکمیل قابلیت‌های اصلی و آماده‌سازی برای بازبینی", status: planned ? "FUTURE" : finished ? "COMPLETED" : "ACTIVE", projectId: project.id, startDate: day(planned ? 21 : -7), endDate: day(planned ? 35 : finished ? -15 : 7) } }),
      ]);
      const milestones = await Promise.all([
        tx.milestone.create({ data: { title: "تأیید نسخه اولیه", description: "بازبینی و تأیید قابلیت‌های پایه توسط تیم پروژه", status: planned ? "PLANNED" : "COMPLETED", targetDate: day(planned ? 25 : -20), completedAt: planned ? null : day(-20), projectId: project.id } }),
        tx.milestone.create({ data: { title: "تحویل نسخه نهایی", description: "تکمیل آزمون پذیرش و آماده‌سازی تحویل", status: finished ? "COMPLETED" : "PLANNED", targetDate: day(spec.due), completedAt: finished ? day(spec.due) : null, projectId: project.id } }),
      ]);
      const createdTasks = [];
      for (let i = 0; i < spec.tasks.length; i++) {
        const status = finished ? "DONE" : planned ? "TODO" : (["DONE", "DONE", "IN_PROGRESS", "IN_PROGRESS", "IN_REVIEW", "TODO", "TODO", "TODO"] as const)[i];
        const task = await tx.task.create({ data: { title: spec.tasks[i], description: `این فعالیت در چارچوب پروژه ${spec.name} انجام می‌شود. خروجی پس از بازبینی تیم برای تحویل آماده خواهد شد.`, acceptanceCriteria: "خروجی بررسی شده، سناریوهای اصلی آزمون شوند و نتیجه در اختیار تیم قرار گیرد.", type: i === 5 ? "BUG" : i % 3 === 0 ? "STORY" : "TASK", storyPoints: [3, 5, 2, 8, 3, 2, 5, 1][i], rank: i * 1000, position: i * 1000, priority: i === 5 ? "HIGH" : i % 3 === 0 ? "HIGH" : "MEDIUM", status, projectId: project.id, sprintId: sprints[i < 2 ? 0 : 1].id, epicId: epics[i % 2].id, milestoneId: milestones[i < 2 ? 0 : 1].id, assigneeId: experts[i % experts.length].id, createdById: manager.id, startDate: day(planned ? 8 + i : -32 + i * 3), dueDate: day(finished ? -35 + i * 2 : planned ? 20 + i * 4 : -3 + i * 3), createdAt: day(spec.start + i) } });
        createdTasks.push(task);
        if (i < 4) await tx.taskComment.create({ data: { taskId: task.id, authorId: team[(i + 1) % team.length].id, content: ["جزئیات بررسی شد؛ لطفاً نتیجه را در جلسه تیم مرور کنیم.", "نسخه اولیه آماده است و برای بازبینی در اختیار تیم قرار گرفت.", "سناریوهای اصلی بررسی شدند؛ موارد باقی‌مانده در حال پیگیری است.", "با توجه به بازخورد تیم، اصلاحات لازم در این مرحله اعمال می‌شود."][i], createdAt: day(-8 + i) } });
      }
      await tx.taskDependency.create({ data: { dependentTaskId: createdTasks[3].id, prerequisiteTaskId: createdTasks[0].id } });
      const progress = finished ? 100 : planned ? 0 : 25;
      await tx.project.update({ where: { id: project.id }, data: { progress } });
      for (const [offset, value, note] of [[-30, 0, "شروع و برنامه‌ریزی پروژه"], [-14, Math.round(progress / 2), "گزارش میانی تیم"], [-2, progress, "آخرین وضعیت پیشرفت پروژه"]] as const) {
        await tx.progressHistory.create({ data: { target: "PROJECT", projectId: project.id, progress: value, note, updatedById: manager.id, createdAt: day(offset) } });
      }
      if (p < 3) await tx.notification.create({ data: { userId: admin.id, projectId: project.id, type: "TASK_UPDATED", title: "به‌روزرسانی فعالیت پروژه", body: `وضعیت «${spec.tasks[2]}» در پروژه ${spec.name} تغییر کرد.`, href: `/projects/${project.id}`, createdAt: day(-p) } });
    }
    return { users: await tx.user.count(), projects: await tx.project.count(), tasks: await tx.task.count(), sprints: await tx.sprint.count(), milestones: await tx.milestone.count(), comments: await tx.taskComment.count() };
  }, { timeout: 60000 });
  console.log("Demo database ready:", counts);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
