# گزارش فاز سوم: اصلاحات امنیت و یکپارچگی داده

تاریخ اجرا: ۲۰۲۶-۱۱-۰۶. تمام تست‌های تخریبی فقط روی PostgreSQL ایزولهٔ `pm_audit_test` با guard اتصال اجرا شدند. هیچ داده یا migrationی روی دیتابیس واقعی، توسعه یا Production اعمال نشد.

## نتیجه

| بررسی | وضعیت |
|---|---|
| حذف تسک و حفظ تاریخچه | PASS |
| یکپارچگی پیشرفت پروژه | PASS |
| محدودسازی ورود | PASS |
| Security headers | PASS |
| Unit tests | PASS — 10 تست |
| Integration tests | PASS — 23 تست |
| Prisma validate / migration status / generate | PASS |
| TypeScript / lint / build | PASS |
| `npm audit --omit=dev --offline` | PASS محدود — 0 آسیب‌پذیری در cache محلی |

## علت ریشه‌ای و اصلاح

1. **حذف تسک:** API، `Task` و کامنت‌ها را به‌صورت فیزیکی حذف می‌کرد؛ بنابراین `TaskComment`های تاریخچه نیز با cascade از بین می‌رفتند. اکنون `DELETE /tasks/:id` فقط `deletedAt` و `deletedById` را در یک transaction ثبت می‌کند. فهرست فعال، کانبان، اسپرینت، صفحات پروژه، شمارش‌ها و محاسبهٔ پیشرفت همگی تسک‌های حذف‌شده را کنار می‌گذارند؛ کامنت‌ها و شناسهٔ sprint باقی می‌مانند. API عمومی restore در این فاز اضافه نشده است.
2. **پیشرفت پروژه:** فرمول در چند محل تکرار و مسیر قدیمی progress امکان ثبت دستی مقدار ناسازگار را فراهم می‌کرد. `lib/project-progress.ts` تنها پیاده‌سازی مشترک است: TODO=۰، IN_PROGRESS=۵۰، IN_REVIEW=۹۰ و DONE=۱۰۰. Taskها منبع حقیقت هستند و `Project.progress` فقط cache سازگارشونده در transactionهای create/update/delete است. API قدیمی مقدار ارسالی `progress` را نادیده می‌گیرد و مقدار محاسبه‌شده را ثبت می‌کند.
3. **ورود:** هیچ محدودیت اشتراکی برای تلاش ناموفق وجود نداشت. `LoginAttempt` با کلیدهای HMAC‌شدهٔ حساب و IP افزوده شد؛ پنجره ۱۵ دقیقه‌ای برای حساب (۵ خطا) و IP (۳۰ خطا) با پاسخ عمومی ۴۰۱/۴۲۹ و `Retry-After` اعمال شده است. برای کاربر ناموجود یا غیرفعال نیز Argon2 با hash ساختگی اجرا می‌شود تا user enumeration و تفاوت زمان کاهش یابد. قفل advisory PostgreSQL از race در شمارش جلوگیری می‌کند.
4. **Headerها:** تنظیمات Next.js فاقد سیاست header بود. CSP متناسب با اسکریپت‌های Next و فونت‌های محلی، `nosniff`، Referrer-Policy، ضد frame، Permissions-Policy و HSTS مشروط به `ENABLE_HSTS=true` افزوده شد.
5. **Lint:** چهار effect بارگذاری اولیه با setState هم‌زمان و یک import بلااستفاده/یک محاسبهٔ memo نامناسب علت خطاها بودند؛ بدون تغییر منطق کانبان، اسپرینت یا تسک اصلاح شدند.

## Migration

`prisma/migrations/20261106172401_add_task_soft_delete_and_login_attempts/migration.sql` فقط افزایشی است: دو ستون nullable روی `Task`، یک FK با `SET NULL`، indexها، enum و جدول `LoginAttempt`. روی دیتابیس آزمایشی اعمال و با `prisma migrate status` تأیید شد. برای هر محیط واقعی باید در پنجرهٔ استقرار و پس از بررسی حجم indexها جداگانه اجرا شود؛ در این مأموریت اجرا نشده است.

## تست‌های افزوده/به‌روزشده

- Unit: پنج سناریوی محاسبهٔ پیشرفت، از جمله پروژهٔ بدون تسک.
- Integration: create/update/delete تسک و همگام‌سازی پیشرفت، soft delete، نگهداری دو کامنت، خارج‌شدن از لیست فعال، منع patch بعد از حذف، RBAC/IDOR و rollback/race موجود.
- Authentication: موفقیت ورود، خطای عمومی برای حساب ناشناخته، قفل حساب، پاک‌سازی bucket حساب بعد از ورود موفق و قفل bucket IP.
- Headerها: CSP، X-Content-Type-Options، Referrer-Policy، X-Frame-Options، Permissions-Policy و HSTS مشروط.

## پوشش تست

| مجموعه | پیش از فاز سوم | پس از فاز سوم |
|---|---:|---:|
| Unit statements / branches / functions / lines | 83.33 / 73.33 / 88.23 / 86.11% | 79.12 / 74.19 / 76.19 / 81.17% |
| Integration statements / branches / functions / lines | 43.11 / 31.30 / 41.66 / 43.90% | 49.01 / 36.07 / 54.45 / 49.71% |

کاهش ظاهری Unit ناشی از اضافه‌شدن `lib/project-progress.ts` به scope است، نه حذف تست. Coverage یک معیار کلی Production نیست؛ integration coverage فقط scope تنظیم‌شدهٔ API و auth را می‌سنجد.

## ریسک‌های باقیمانده برای Production

- قبل از استقرار باید `LOGIN_RATE_LIMIT_SECRET` قوی تنظیم شود. `TRUST_PROXY_IP_HEADER` فقط زمانی تنظیم شود که proxy مورد اعتماد آن header را پاک‌سازی و بازنویسی می‌کند؛ در غیر این صورت bucket IP عمداً فعال نمی‌شود.
- HSTS فقط پشت HTTPS و با `ENABLE_HSTS=true` فعال شود. CSP برای سازگاری Next شامل `unsafe-inline` است؛ سخت‌سازی nonce/hash می‌تواند کار آینده باشد.
- API بازیابی تسک و سیاست retention/cleanup دوره‌ای برای `LoginAttempt` هنوز نیاز محصولی/عملیاتی مستقل دارند. پاک‌سازی منقضی‌ها در مسیر ورود opportunistic است.
- حذف مستقیم Project در دیتابیس هنوز می‌تواند cascade داشته باشد؛ API حذف دائمی پروژه وجود ندارد و باید همچنان محدود بماند.
- `Project.progress` cache در برابر نوشتن مستقیم خارج از API تضمین نمی‌شود؛ نماهای برنامه از Taskهای فعال محاسبه می‌کنند.
- audit فقط offline اجرا شد؛ برای نتیجهٔ registry زنده باید در CI یا محیط دارای دسترسی شبکه `npm audit --omit=dev` اجرا شود.

نتیجه: ایرادهای تأییدشدهٔ فاز دوم با تست‌های رگرسیون PASS شده‌اند. برای ارزیابی مجدد Production، migration باید طبق فرآیند استقرار روی محیط مقصد اعمال و متغیرهای محیطی rate limit/proxy تنظیم شوند.
