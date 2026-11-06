# ماتریس روابط و حذف

منبع: `prisma/schema.prisma` و SQL سه migration موجود. تمام Foreign Keyها در PostgreSQL `ON UPDATE CASCADE` دارند. وضعیت «اجباری» یعنی ستون FK `NOT NULL` است؛ «اختیاری» یعنی nullable است. حذف دائمی پروژه یا کاربر API ندارد؛ جدول زیر رفتار واقعی Foreign Key در صورت حذف مستقیم از دیتابیس را نشان می‌دهد.

| والد → فرزند | FK | نوع | ON DELETE | پیامد حذف والد |
|---|---|---|---|---|
| User → Project | `Project.createdById` | اجباری | RESTRICT | حذف سازنده تا وقتی پروژه وجود دارد رد می‌شود |
| User → ProjectMember | `ProjectMember.userId` | اجباری | RESTRICT | حذف عضو تا زمان وجود عضویت رد می‌شود |
| Project → ProjectMember | `ProjectMember.projectId` | اجباری | CASCADE | عضویت‌های همان پروژه حذف می‌شوند |
| Project → Sprint | `Sprint.projectId` | اجباری | CASCADE | اسپرینت‌های همان پروژه حذف می‌شوند |
| Project → Task | `Task.projectId` | اجباری | CASCADE | تسک‌های همان پروژه حذف می‌شوند؛ کامنت و تاریخچه تسک هم حذف می‌شود |
| Sprint → Task | `Task.sprintId` | اختیاری | SET NULL | تسک به backlog برمی‌گردد |
| User → Task (assignee) | `Task.assigneeId` | اختیاری | SET NULL | مسئول تسک خالی می‌شود |
| User → Task (creator) | `Task.createdById` | اجباری | RESTRICT | حذف سازنده تسک رد می‌شود |
| Task → TaskComment | `TaskComment.taskId` | اجباری | CASCADE | همه کامنت‌ها، از جمله تاریخچه ذخیره‌شده در کامنت، حذف می‌شوند |
| User → TaskComment | `TaskComment.authorId` | اجباری | RESTRICT | حذف نویسنده کامنت رد می‌شود |
| Project → ProgressHistory | `ProgressHistory.projectId` | اختیاری | CASCADE | تاریخچه پیشرفت پروژه حذف می‌شود |
| Sprint → ProgressHistory | `ProgressHistory.sprintId` | اختیاری | CASCADE | تاریخچه پیشرفت اسپرینت حذف می‌شود |
| User → ProgressHistory | `ProgressHistory.updatedById` | اجباری | RESTRICT | حذف ثبت‌کننده پیشرفت رد می‌شود |
| User → Session | `Session.userId` | اجباری | CASCADE | نشست‌های کاربر حذف می‌شوند |

خطر مهم: حذف دائمی پروژه باعث حذف آبشاری تسک‌ها، کامنت‌ها و تاریخچه می‌شود. حذف تسک از API نیز کامنت‌های معمولی و رویدادهای تاریخچه را حذف می‌کند. مدل `ProgressHistory` اجازه می‌دهد هر دو FK پروژه/اسپرینت تهی باشند یا هم‌زمان پر شوند؛ قاعده «دقیقاً یک هدف» در constraint دیتابیس نیست. `Task.sprintId` فقط به Sprint اشاره می‌کند و constraint مرکب برای هم‌پروژه بودن Task و Sprint ندارد؛ API آن را کنترل می‌کند.
