# اجرای تست‌های بک‌اند

تست‌های یکپارچگی فقط با PostgreSQL ایزوله اجرا می‌شوند. Guard قبل از هر تغییر داده، host، port، نام دیتابیس، user و marker ذخیره‌شده در schema مستقل را بررسی می‌کند. هر اتصال دیگر با خطا متوقف می‌شود. تست‌ها رکوردهای داخل دیتابیس آزمایشی را بین سناریوها پاک می‌کنند؛ هیچ داده واقعی در این دیتابیس قرار ندهید.

در PowerShell از ریشه پروژه:

```powershell
docker compose -f docker-compose.test.yml -p pm-audit-isolated up -d --wait
$env:TEST_DATABASE_URL = 'postgresql://pm_audit_runner:test_only_local_9f47a6@127.0.0.1:55433/pm_audit_test?schema=public'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
$env:LOGIN_RATE_LIMIT_SECRET = 'a-long-unique-test-secret'
$env:TRUST_PROXY_IP_HEADER = 'x-test-client-ip'
node scripts/verify-test-db.mjs
npx prisma migrate deploy
npx prisma generate
npm run test:unit
npm run test:integration
npm run test:coverage
```

`test:coverage` ابتدا پوشش unit و سپس پوشش integration را گزارش می‌کند. گزارش integration حتی در صورت شکست تست‌ها تولید می‌شود. نتیجه فعلی این دستور به‌دلیل چهار تست شکست‌خورده ناموفق است.

تست Backup/Restore روی همین سرویس و یک دیتابیس بازگردانی تازه، با داده ساختگی اجرا می‌شود:

```powershell
node scripts/backup-restore-test.mjs
```

`npm test` هر دو گروه را اجرا می‌کند. فایل‌های تست یکپارچگی در `tests/integration` و تست‌های مستقل در `tests/unit` هستند. Coverage فعلی تنها فایل‌های utility فهرست‌شده در `vitest.unit.config.ts` را می‌سنجد؛ coverage کل بک‌اند نیست. Workflow مشابه در `.github/workflows/backend-audit.yml` ثبت شده است. تا زمان اصلاح باگ‌های گزارش‌شده، شکست تست پیشرفت و lint در CI عمداً باعث شکست pipeline می‌شود.
