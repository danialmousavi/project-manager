"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCheck, LoaderCircle, X } from "lucide-react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationResponse = {
  success: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
};

const dateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
  timeStyle: "short",
});

function displayCount(count: number) {
  return count > 99 ? "+۹۹" : count.toLocaleString("fa-IR");
}

export default function NotificationMenu({ initialUnreadCount }: { initialUnreadCount: number }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/v1/notifications?limit=8", {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Could not load notifications");

      const payload = await response.json() as NotificationResponse;
      setItems(payload.notifications);
      setUnreadCount(payload.unreadCount);
    } catch {
      setError("دریافت اعلان‌ها انجام نشد. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function openMenu() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) await loadNotifications();
  }

  async function markAllAsRead() {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);

    try {
      const response = await fetch("/api/v1/notifications", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
      });
      if (!response.ok) throw new Error("Could not mark notifications as read");

      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
      setUnreadCount(0);
    } catch {
      setError("خواندن همهٔ اعلان‌ها انجام نشد. دوباره تلاش کنید.");
    } finally {
      setMarkingAll(false);
    }
  }

  async function openNotification(item: NotificationItem) {
    setOpen(false);

    if (!item.readAt) {
      const response = await fetch(`/api/v1/notifications/${item.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
      });

      if (response.ok) {
        const readAt = new Date().toISOString();
        setItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, readAt } : currentItem));
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    }

    router.push(item.href);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => void openMenu()}
        aria-label={unreadCount > 0 ? `${unreadCount.toLocaleString("fa-IR")} اعلان خوانده‌نشده` : "اعلان‌ها"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex size-10 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--muted)] transition hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/15"
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -left-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 py-0.5 text-[10px] font-extrabold leading-none text-white ring-2 ring-white">
            {displayCount(unreadCount)}
          </span>
        )}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="اعلان‌ها"
          className="absolute left-0 top-[calc(100%+0.65rem)] z-[60] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-xl shadow-slate-950/15"
        >
          <header className="flex items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-extrabold text-emerald-950">اعلان‌ها</h2>
              <p className="mt-0.5 text-[11px] text-emerald-700">
                {unreadCount > 0 ? `${unreadCount.toLocaleString("fa-IR")} اعلان خوانده‌نشده` : "همه اعلان‌ها خوانده شده‌اند"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                disabled={unreadCount === 0 || markingAll}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {markingAll ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCheck size={14} />}
                خواندن همه
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="بستن اعلان‌ها" className="rounded-lg p-1.5 text-emerald-700 transition hover:bg-emerald-100">
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="max-h-[min(30rem,calc(100vh-7rem))] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-xs font-semibold text-[var(--muted)]">
                <LoaderCircle size={17} className="animate-spin text-emerald-600" />
                در حال دریافت اعلان‌ها...
              </div>
            ) : error ? (
              <div className="space-y-3 px-4 py-7 text-center">
                <p role="alert" className="text-xs leading-6 text-rose-600">{error}</p>
                <button type="button" onClick={() => void loadNotifications()} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50">تلاش مجدد</button>
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs leading-6 text-[var(--muted)]">فعلاً اعلانی برای شما ثبت نشده است.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void openNotification(item)}
                      className={`w-full px-4 py-3 text-right transition hover:bg-emerald-50/70 ${item.readAt ? "bg-white" : "bg-emerald-50/45"}`}
                    >
                      <div className="flex items-start gap-2">
                        {!item.readAt && <span aria-label="خوانده‌نشده" className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-600" />}
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-xs ${item.readAt ? "font-semibold text-slate-700" : "font-extrabold text-emerald-950"}`}>{item.title}</p>
                          {item.body && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{item.body}</p>}
                          <time dateTime={item.createdAt} className="mt-1.5 block text-[10px] text-slate-400">{dateFormatter.format(new Date(item.createdAt))}</time>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-emerald-100 bg-white px-4 py-3 text-center text-xs font-bold text-emerald-800 transition hover:bg-emerald-50">
            مشاهدهٔ همهٔ اعلان‌ها
          </Link>
        </section>
      )}
    </div>
  );
}
