# طرح Migration فاز سوم

این طرح اجرا شده است: migration افزایشی `20261106172401_add_task_soft_delete_and_login_attempts` ساخته و فقط روی PostgreSQL ایزولهٔ آزمایشی `pm_audit_test` اعمال شده است. هیچ دیتابیس واقعی، توسعه یا Production در این مأموریت تغییر نکرده است. هر دو بخش افزایشی‌اند و هیچ ستون یا رکورد موجودی را حذف یا بازنویسی نمی‌کنند.

## ۱. Soft Delete تسک

تغییر پیشنهادی مدل `Task`:

```prisma
deletedAt   DateTime?
deletedById String?
deletedBy   User? @relation("TaskDeletedBy", fields: [deletedById], references: [id], onDelete: SetNull)

@@index([projectId, deletedAt, status, position])
@@index([deletedAt])
```

و در مدل `User`:

```prisma
deletedTasks Task[] @relation("TaskDeletedBy")
```

رفتار API پس از Migration:

- `DELETE /api/v1/tasks/[id]` در یک تراکنش فقط `deletedAt` و `deletedById` را ثبت می‌کند و کامنت‌ها/رویدادهای تاریخچه را نگه می‌دارد.
- Queryهای فعال در فهرست، کانبان، اسپرینت، صفحه پروژه و محاسبه پیشرفت فقط `deletedAt: null` را می‌خوانند.
- API ویرایش، کامنت و تاریخچه برای تسک حذف‌شده پاسخ 404 می‌دهند.
- بازیابی در این فاز API عمومی ندارد؛ داده برای حسابرسی و بازیابی مدیریتی آینده باقی می‌ماند.
- حذف دائمی Project همچنان طبق FKهای فعلی داده‌های زیرمجموعه را Cascade می‌کند؛ API حذف دائمی Project موجود نیست.

ریسک Migration پایین است: دو ستون nullable، یک FK nullable با `SET NULL` و دو index افزوده می‌شود. رکوردهای موجود همگی فعال می‌مانند. ساخت index روی جدول بسیار بزرگ می‌تواند موقتاً بار I/O و lock ایجاد کند؛ قبل از Production باید حجم جدول و پنجره استقرار بررسی شود. rollback ساختاری، حذف دو index/FK/ستون است؛ بعد از استفاده واقعی، rollback ستون‌ها اطلاعات حذف منطقی را از بین می‌برد و نباید بدون خروجی گرفتن انجام شود.

## ۲. Rate Limiting مشترک Login با PostgreSQL

برای سازگاری با چند نمونه برنامه و پرهیز از وابستگی خارجی، PostgreSQL موجود به‌عنوان store مشترک استفاده می‌شود:

```prisma
enum LoginAttemptScope {
  ACCOUNT
  IP
}

model LoginAttempt {
  id         String            @id @default(uuid())
  scope      LoginAttemptScope
  keyHash    String
  attemptedAt DateTime         @default(now())

  @@index([scope, keyHash, attemptedAt])
  @@index([attemptedAt])
}
```

سیاست پیشنهادی:

- حساب: ۵ شکست در ۱۵ دقیقه؛ تلاش بعدی `429` با `Retry-After`.
- IP: ۳۰ شکست در ۱۵ دقیقه برای کاهش Credential Stuffing.
- email و IP فقط به‌صورت HMAC-SHA-256 با secret محیطی ذخیره می‌شوند.
- موفقیت، شکست‌های account را پاک می‌کند؛ شمارنده IP را پاک نمی‌کند.
- کاربر ناموجود/غیرفعال همان پیام و مسیر محاسباتی رمز نامعتبر را می‌گیرد تا User Enumeration کاهش یابد.
- IP فقط وقتی از Header خوانده می‌شود که `TRUST_PROXY_IP_HEADER` صریحاً تنظیم شده باشد و Proxy مورد اعتماد آن Header را از درخواست ورودی پاک و بازنویسی کند. در غیر این صورت bucket IP مشترک/محافظه‌کار استفاده می‌شود و Header کلاینت قابل اعتماد نیست.
- رکوردهای خارج از پنجره به‌صورت دوره‌ای/فرصت‌طلبانه پاک می‌شوند.

ریسک Migration پایین است: یک enum، جدول و indexهای جدید ایجاد می‌شود و به جداول تجاری FK ندارد. ریسک عملیاتی اصلی، رشد جدول در حمله گسترده و تنظیم نادرست trusted proxy است؛ محدودیت اندازه، پاک‌سازی و مانیتورینگ لازم است. Redis لازم نیست. در مقیاس ورود بسیار بالا، انتقال store به Redis می‌تواند بعداً بدون تغییر قرارداد Route انجام شود.

## اجرای ایمن پس از تأیید

1. تغییر Schema و تولید Migration فقط به‌صورت `--create-only`.
2. بازبینی SQL تولیدشده برای نبود `DROP`، تغییر نوع یا عملیات Data Loss.
3. اعمال فقط روی `pm_audit_test` پس از عبور Guard چندعاملی.
4. تولید Prisma Client و تکمیل کد/تست‌ها.
5. اجرای تست Soft Delete، حفظ تاریخچه، مخفی‌شدن از نماهای فعال، پیشرفت، Rate Limiting، concurrency و rollback.
6. Migration روی دیتابیس واقعی یا Production در این مأموریت اجرا نمی‌شود.
