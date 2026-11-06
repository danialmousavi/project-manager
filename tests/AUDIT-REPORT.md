# گزارش فاز دوم ممیزی بک‌اند

> وضعیت این گزارش تاریخی است. یافته‌های تأییدشدهٔ فاز دوم در فاز سوم اصلاح و با تست رگرسیون بازآزمایی شدند؛ نتیجهٔ نهایی در [PHASE3-REPORT.md](PHASE3-REPORT.md) ثبت شده است.

تاریخ اجرا: ۲۰۲۶-۱۱-۰۶، حدود ۱۹:۵۸ به وقت تهران. محیط: Windows/PowerShell، Node 24.21.0، Next 16.4.5، Prisma 7.10.1، PostgreSQL 17 در Docker. تمام تغییرات داده فقط روی `pm_audit_test` با کاربر مستقل `pm_audit_runner` انجام شد. Guard پیش از هر تست یکپارچگی، host، port، نام دیتابیس، کاربر و marker داخل schema مستقل `audit_guard` را تأیید کرد. هیچ داده واقعی در تست‌ها استفاده نشد. این تست‌ها Route Handler واقعی را مستقیم فراخوانی می‌کنند؛ سرور HTTP کامل را راه‌اندازی نمی‌کنند.

## فایل‌های تحویلی

- `tests/unit/utilities.test.ts`: ۵ تست برای اعتبارسنجی، تاریخ و سریال‌سازی تاریخچه.
- `tests/integration/backend.test.ts`: ۱۶ تست برای دسترسی، روابط، حذف، تراکنش، version و پیشرفت.
- `tests/integration/auth.test.ts`: ۳ تست برای ورود، نشست، خروج و تلاش مکرر ورود.
- `tests/integration/security-headers.test.ts`: ۱ تست سیاست تنظیمات header.
- `tests/database/fixtures.ts` و `tests/database/guard.ts`: factoryهای داده ساختگی و محافظ اتصال.
- `vitest.unit.config.ts`، `vitest.integration.config.ts`، `docker-compose.test.yml`، `tests/database/marker.sql`، `scripts/verify-test-db.mjs`، `scripts/backup-restore-test.mjs`، `.github/workflows/backend-audit.yml`، `tests/README.md` و `tests/RELATIONS.md`.
- `package.json` و `package-lock.json`: runner و دستورهای تست/coverage. کد عملیاتی، API، Prisma schema و migration تغییر نکردند.

## نتایج اجرای واقعی

| دستور/آزمون | نتیجه | شاهد |
|---|---|---|
| Guard دیتابیس و `npx prisma validate` | PASS | marker و schema تأیید شد |
| `npx prisma migrate deploy` روی دیتابیس تست | PASS | ۳ migration اعمال شد |
| `npx prisma generate` | PASS | Client 7.10.1 ساخته شد |
| `npm run test:unit` | PASS | ۵ موفق، ۰ شکست، ۰ skip |
| `npm run test:integration` | FAIL | ۱۶ موفق، ۴ شکست، ۰ skip؛ شکست‌ها در پایین |
| `npm run test:coverage:unit` | PASS | statements 83.33%، branches 73.33%، functions 88.23%، lines 86.11%؛ فقط چهار فایل utility |
| `npm run test:coverage:integration` | FAIL | گزارش با وجود شکست ساخته شد؛ statements 43.11%، branches 31.30%، functions 41.66%، lines 43.90% برای `app/api/v1/**` و `lib/auth.ts` |
| `npx tsc --noEmit` | PASS | بدون خطا |
| `npm run build` | PASS | همه Routeها و صفحه‌ها کامپایل شدند |
| `npm run lint` | FAIL | ۶ خطا و ۱ هشدار قبلی در کامپوننت‌های عملیاتی؛ فایل‌های تست/اسکریپت با ESLint مستقل پاس شدند |
| `npm audit --omit=dev --offline` | PASS محدود | کش محلی ۰ آسیب‌پذیری گزارش داد؛ استعلام زنده رجیستری انجام نشد |
| Backup/Restore آزمایشی | PASS | شمارش هر ۸ مدل و رابطه‌های نمونه پس از بازگردانی یکسان بود |

در مجموع ۲۵ تست اجرا شد: ۲۱ PASS، ۴ FAIL، ۰ SKIP. `npm test` و `npm run test:coverage` به علت همان چهار تست باید با exit code ناموفق تمام شوند؛ اجرای جداگانه هر دو بخش فوق ثبت شد. Workflow CI نوشته شده اما روی GitHub اجرا نشده است؛ در وضعیت کنونی به‌درستی روی integration و lint شکست خواهد خورد. تعداد سناریوهای فهرست‌شده در بخش «محدودیت‌ها» BLOCKED از نظر پوشش/اثبات است، نه اینکه test runner آن‌ها را skip کرده باشد.

## سلامت داده و حذف

ماتریس کامل FK، nullable بودن و `ON DELETE` در `tests/RELATIONS.md` است؛ همه FKها `ON UPDATE CASCADE` دارند. نتیجه‌های مشاهده‌شده:

| عملیات | قبل | بعد |
|---|---|---|
| حذف تسک از API | دو پروژه، تسک هدف با اسپرینت/مسئول/دو کامنت، تسک مستقل | فقط تسک هدف و دو کامنتش حذف شدند؛ پروژه، اسپرینت، کاربر و تسک دیگر ماندند |
| حذف اسپرینت از API | دو پروژه، یک تسک DONE در اسپرینت، یک کامنت، اسپرینت مستقل | اسپرینت هدف حذف شد؛ `sprintId=null`، status/assignee/comment و اسپرینت مستقل ماندند |
| حذف عضویت | کاربر مشترک عضو دو پروژه | عضویت یک پروژه ۱→۰، عضویت دیگر ۱→۱ و User محفوظ |
| حذف آخرین مدیر پروژه | یک مدیر پروژه | پاسخ ۴۰۰ و تعداد مدیر ۱→۱ |
| حذف کاربر با سابقه | Project/ProgressHistory وابسته | خطای FK، User و Project محفوظ؛ حذف مستقیم کاربر با سابقه مجاز نیست |
| آرشیو پروژه | پروژه و تسک ساختگی | `archivedAt` مستقیماً در دیتابیس آزمایشی ثبت شد؛ تغییر پروژه و تسک از API رد شد و تسک ماند |
| شکست وسط تراکنش | تسک TODO بدون کامنت | درج کامنت با author نامعتبر خطا داد؛ task همچنان TODO و تعداد کامنت صفر |
| دو update با version=1 | یک تسک version=1 | فقط یکی موفق؛ شمارش نتایج `[0,1]` و version نهایی ۲ |

حذف دائمی پروژه و کاربر از طریق API وجود ندارد؛ بنابراین رفتار حذف پروژه از مسیر واقعی سیستم تست نشده است. FKها نشان می‌دهند حذف مستقیم پروژه، اعضا، اسپرینت‌ها، تسک‌ها، کامنت‌ها و تاریخچه را آبشاری حذف می‌کند. حذف تسک از API نیز رویدادهای حسابرسی ذخیره‌شده در `TaskComment` را پاک می‌کند. برای نیاز به حفظ تاریخچه باید سیاست soft delete یا نگهداری رویداد جدا از تسک تعریف شود. حذف کاربرِ نویسندهٔ تاریخچه توسط FK رد می‌شود و به خودی خود باگ نیست. `ProgressHistory` قید «دقیقاً یکی از projectId/sprintId» ندارد؛ `Task.sprintId` هم قید مرکب هم‌پروژه‌بودن ندارد. API اتصال بین‌پروژه‌ای را در سناریوی تست‌شده رد کرد، اما نوشتن مستقیم در دیتابیس هنوز ممکن است.

Backup/Restore: گراف مصنوعی ۲ User، ۱ Project، ۱ ProjectMember، ۱ Sprint، ۱ Task، ۱ TaskComment، ۱ ProgressHistory و ۲ Session dump شد. نام یک User در مبدأ تغییر کرد؛ restore در دیتابیس آزمایشی تازه `pm_audit_restore_d4860edf` همان شمارش‌ها، نام اصلی و روابط تسک/اسپرینت/پروژه/کامنت را برگرداند. این فقط آزمون بازگردانی داده ساختگی است و جای سیاست پشتیبان‌گیری Production را نمی‌گیرد.

## امنیت، دسترسی و نشست

ماتریس زیر نتیجه مسیرهای **تست‌شده** است؛ برای بقیه endpointها حکم کلی صادر نمی‌شود.

| نقش/نشست | Endpoint و عمل | نتیجه |
|---|---|---|
| بدون نشست | `POST /projects` | 401 |
| ADMIN با Origin نامعتبر | `POST /projects` و `POST /users` | 403 |
| MANAGER پروژه دیگر | `GET /kanban`، `PATCH /projects/{id}`، `PATCH /tasks/{id}` | 403 |
| EMPLOYEE پروژه دیگر | `GET /kanban`، `DELETE /tasks/{id}` | 403 |
| EMPLOYEE پروژه خودش | `POST /projects/{id}/tasks` | 403 |
| MANAGER | `PATCH /users/{id}` برای تغییر نقش | 403؛ نقش تغییر نکرد |
| ADMIN | `PATCH /users/{id}` برای کاربر دیگر | 200؛ نقش در DB تغییر کرد |
| ADMIN حساب خودش | `PATCH /users/{id}` برای غیرفعال‌سازی | 403 |
| ADMIN | اتصال Task به Sprint پروژه دیگر | 409؛ `sprintId` خالی ماند |
| MANAGER | تخصیص تسک به غیرعضو یا ارسال `projectId` اضافی | 400؛ هیچ تسکی ساخته نشد |
| EMPLOYEE پس از حذف عضویت | `GET /kanban` پروژه حذف‌شده/پروژه دیگر عضو آن | 403/200 |

UUID نامعتبر و فیلد اضافی در `PATCH /tasks/{id}` پاسخ ۴۰۰ دادند. رمز درست نشست ایجاد کرد، رمز غلط ۴۰۱ داد، پاسخ رمز hash نداشت، cookie دارای HttpOnly و SameSite=Lax بود. توکن جعلی و منقضی رد شدند؛ logout توکن فعلی را باطل کرد و نشست دیگر کاربر باقی ماند. نشست منقضی همچنان در جدول ماند؛ پاک‌سازی زمان‌بندی‌شده پیشنهاد می‌شود. خروج از همه دستگاه‌ها قابلیت جداگانه است و نبود آن به تنهایی نقص logout فعلی نیست.

## یافته‌ها و اولویت اصلاح

| اولویت | شناسه و شاهد | اثر و پیشنهاد |
|---|---|---|
| High | SEC-001، `app/api/v1/auth/login/route.ts:18`؛ `tests/integration/auth.test.ts:114`: شش تلاش غلط `[401,401,401,401,401,401]`، بدون 429 | حدس رمز بدون محدودیت سطح برنامه؛ rate limit پایدار برای حساب و IP با سیاست پاسخ/زمان‌بندی و تست تکراری اضافه شود. این آزمون فقط ۶ تلاش ساختگی بود، تست فشار نبود. |
| High | PROG-001، `app/api/v1/projects/[id]/progress/route.ts:99`؛ `tests/integration/backend.test.ts:284`: یک تسک DONE، درخواست progress=0 پاسخ ۲۰۰ و مقدار ذخیره‌شده ۰ | API دستی می‌تواند مقدار مشتق‌شده را بازنویسی کند. حذف/محدودکردن مسیر دستی و تعیین یک منبع حقیقت برای محاسبه لازم است. |
| High | PROG-002، `app/api/v1/tasks/[id]/route.ts:219`؛ `tests/integration/backend.test.ts:295`: TODO→DONE اما `Project.progress=0` | فیلد ذخیره‌شده با وضعیت تسک همگام نمی‌شود. پیشرفت را از تسک‌ها محاسبه کنید یا با تغییر تسک به‌شکل تراکنشی به‌روز کنید. صفحات `app/projects/page.tsx:164` و `app/projects/[id]/page.tsx:177` پیشرفت را جداگانه محاسبه می‌کنند؛ برابری تمام نماها هنوز تست نشده است. |
| Medium | SEC-002، `next.config.ts:3`؛ `tests/integration/security-headers.test.ts:6`: تابع `headers` تعریف نشده | سیاست CSP، `X-Content-Type-Options` و `Referrer-Policy` باید برای منابع واقعی پروژه طراحی و با پاسخ HTTP واقعی تأیید شود. تست فعلی فقط تنظیمات را می‌سنجد، نه پاسخ HTTP. |
| Medium | DATA-001، `app/api/v1/tasks/[id]/route.ts:545` و `prisma/schema.prisma:217`؛ تست حذف تسک نشان داد دو کامنت، از جمله event تاریخچه، پاک شدند | خطر حذف غیرقابل بازگشت سابقه؛ سیاست نگهداری/soft delete لازم است. |
| Medium | SEC-003، نبود تست خودکار قبلی | زیرساخت ساخته شد، ولی پوشش API فقط 43.90% خطوط است؛ مسیرهای حساس پوشش‌نداده باید تکمیل شوند. |
| Medium | DATA-002، `prisma/schema.prisma`؛ FK مرکب Task/Sprint و قید هدف ProgressHistory وجود ندارند | ورود داده ناسازگار از مسیرهای غیر API ممکن است؛ constraint دیتابیس با migration بررسی شود. |
| Low/Medium | SEC-004، `lib/auth.ts:43`؛ نشست منقضی رد ولی در DB نگه داشته شد | پاک‌سازی دوره‌ای با job امن و مانیتورینگ حجم جدول پیشنهاد می‌شود. |
| Low/Medium | SEC-005، `lib/auth.ts:79`؛ logout فقط نشست فعلی را حذف کرد | رفتار فعلی را در UI روشن کنید؛ اگر نیاز محصول است، «خروج از همه دستگاه‌ها» جداگانه اضافه شود. |
| Low | QUAL-001، `components/kanban/kanban-board.tsx:264`، `components/sprints/sprints-manager.tsx:276`، `components/tasks/project-tasks.tsx:286`، `components/tasks/task-list-view.tsx:264` | ۶ خطا و ۱ هشدار Lint مانع سبزشدن CI هستند؛ اصلاح کامپوننت عملیاتی نیازمند تأیید جداگانه است. |

## محدودیت‌های اثبات‌نشده

- ماتریس کامل Role × Endpoint × Action، تمام مسیرهای User/Comment/History/Search و نشت داده/کش پوشش نشده‌اند؛ بخشی از آن‌ها در گزارش coverage صفر خط دارند.
- آزمون HTTP واقعی برای header و CSP، و آزمون هم‌زمانی دو درخواست واقعی API با تعارض نسخه، انجام نشده‌اند. تست version فقط update شرطی سطح دیتابیس است.
- شکست تزریق‌شده در وسط مسیر واقعی ساخت پروژه/ثبت تاریخچه/تغییر عضویت تست نشده؛ rollback فقط تراکنش معادل در دیتابیس تست بود.
- مسابقه هم‌زمان حذف اسپرینت و افزودن تسک، حذف دائمی پروژه/کاربر از API (چنین API موجود نیست)، و جریان آرشیو از API (API آرشیو موجود نیست) تست نشده‌اند.
- تمام ۱۲ حالت پیشرفت موردنیاز از جمله وزن وضعیت‌های میانی، کانبان، فهرست/جزئیات، نقش‌ها و حذف تسک اثبات نشده‌اند. دو آزمون ذخیره‌سازی پیشرفت شکست خورده‌اند.
- تاریخ‌های شمسی/میلادی در utility تست شدند؛ تبدیل تاریخ تایم‌لاین و مرزهای تاریخ در Routeها پوشش مستقیم ندارند.
- Workflow فقط به‌صورت فایل آماده شده؛ اجرای GitHub Actions مشاهده نشده است.

**نتیجه:** بک‌اند فعلاً برای Production از نظر معیارهای این ممیزی آماده تأیید نیست. rate limit ورود و یکپارچگی پیشرفت شکست واقعی دارند؛ header policy تعریف نشده، حذف تسک تاریخچه را پاک می‌کند، پوشش تست حساس محدود است و CI با چهار تست و Lint ناموفق می‌شود. اصلاح کد عملیاتی در این فاز انجام نشد و به تأیید مالک پروژه موکول است.
