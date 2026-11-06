
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CircleUserRound,
  LoaderCircle,
  Plus,
  Search,
  Shield,
  UserRound,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";

type UserRole = "ADMIN" | "MANAGER" | "EMPLOYEE";

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

type Props = {
  initialUsers: UserItem[];
};

const roleLabels: Record<UserRole, string> = {
  ADMIN: "مدیر اصلی",
  MANAGER: "مدیر پروژه",
  EMPLOYEE: "کارمند",
};

const roleClasses: Record<UserRole, string> = {
  ADMIN: "bg-violet-50 text-violet-700",
  MANAGER: "bg-blue-50 text-blue-700",
  EMPLOYEE: "bg-slate-100 text-slate-600",
};

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10";

export default function UsersManager({ initialUsers }: Props) {
  const router = useRouter();

  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(
    null
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "EMPLOYEE" as UserRole,
  });

  const filteredUsers = users.filter((user) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query);

    const matchesRole =
      roleFilter === "ALL" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const activeCount = users.filter((user) => user.isActive).length;
  const managersCount = users.filter(
    (user) => user.role === "MANAGER"
  ).length;

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "ساخت کاربر ناموفق بود");
      }

      setUsers((previous) => [data.user, ...previous]);

      setForm({
        name: "",
        email: "",
        password: "",
        role: "EMPLOYEE",
      });

      setShowForm(false);
      setNotice("کاربر جدید با موفقیت ایجاد شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطایی در ایجاد کاربر رخ داد"
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(
    user: UserItem,
    changes: {
      role?: "MANAGER" | "EMPLOYEE";
      isActive?: boolean;
    }
  ) {
    if (busyUserId) return;

    setBusyUserId(user.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/v1/users/${user.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(changes),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "به‌روزرسانی ناموفق بود"
        );
      }

      setUsers((previous) =>
        previous.map((item) =>
          item.id === user.id
            ? { ...item, ...changes }
            : item
        )
      );

      setNotice("تغییرات کاربر ذخیره شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطایی در ذخیره تغییرات رخ داد"
      );
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="کل کاربران"
          value={users.length}
          icon={<Users size={21} />}
        />
        <StatCard
          title="کاربران فعال"
          value={activeCount}
          icon={<UserRoundCheck size={21} />}
        />
        <StatCard
          title="مدیران پروژه"
          value={managersCount}
          icon={<Shield size={21} />}
        />
      </div>

      {/* Main panel */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              فهرست کاربران
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {users.length.toLocaleString("fa-IR")} کاربر ثبت شده
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setNotice("");
              setShowForm((previous) => !previous);
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? "بستن فرم" : "افزودن کاربر"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={createUser}
            className="border-b border-indigo-100 bg-indigo-50/40 p-5 sm:p-6"
          >
            <h3 className="mb-5 font-bold text-slate-900">
              ایجاد حساب کاربری جدید
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="نام و نام خانوادگی">
                <input
                  className={inputClass}
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                  placeholder="مثلاً علی رضایی"
                />
              </Field>

              <Field label="ایمیل">
                <input
                  className={inputClass}
                  type="email"
                  dir="ltr"
                  required
                  autoComplete="off"
                  value={form.email}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      email: event.target.value,
                    })
                  }
                  placeholder="user@example.com"
                />
              </Field>

              <Field label="رمز عبور اولیه">
                <input
                  className={inputClass}
                  type="password"
                  dir="ltr"
                  required
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      password: event.target.value,
                    })
                  }
                  placeholder="حداقل ۱۰ کاراکتر"
                />
              </Field>

              <Field label="نقش کاربر">
                <select
                  className={inputClass}
                  value={form.role}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      role: event.target.value as UserRole,
                    })
                  }
                >
                  <option value="EMPLOYEE">کارمند</option>
                  <option value="MANAGER">مدیر پروژه</option>
                  <option value="ADMIN">مدیر اصلی</option>
                </select>
              </Field>
            </div>

            <p className="mt-3 text-xs leading-6 text-slate-500">
              رمز عبور باید حداقل ۱۰ کاراکتر باشد. آن را
              از یک مسیر امن به کاربر اطلاع بده.
            </p>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving && (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                )}
                {saving ? "در حال ذخیره..." : "ثبت کاربر"}
              </button>
            </div>
          </form>
        )}

        {(error || notice) && (
          <div className="space-y-2 px-5 pt-5 sm:px-6">
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
              >
                {notice}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:p-6">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className={`${inputClass} pr-11`}
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="جست‌وجو بر اساس نام یا ایمیل..."
            />
          </div>

          <select
            className={`${inputClass} sm:w-44`}
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(event.target.value)
            }
            aria-label="فیلتر نقش"
          >
            <option value="ALL">همه نقش‌ها</option>
            <option value="ADMIN">مدیر اصلی</option>
            <option value="MANAGER">مدیر پروژه</option>
            <option value="EMPLOYEE">کارمند</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">
                  کاربر
                </th>
                <th className="px-6 py-4 font-medium">
                  نقش
                </th>
                <th className="px-6 py-4 font-medium">
                  وضعیت
                </th>
                <th className="px-6 py-4 font-medium">
                  تاریخ عضویت
                </th>
                <th className="px-6 py-4 font-medium">
                  مدیریت
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const isAdmin = user.role === "ADMIN";
                const isBusy = busyUserId === user.id;

                return (
                  <tr
                    key={user.id}
                    className="transition hover:bg-slate-50/70"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                          <CircleUserRound size={21} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">
                            {user.name}
                          </p>
                          <p
                            dir="ltr"
                            className="mt-1 text-left text-xs text-slate-400"
                          >
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-lg px-3 py-1.5 text-xs font-medium ${roleClasses[user.role]}`}
                      >
                        {roleLabels[user.role]}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ${
                          user.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            user.isActive
                              ? "bg-emerald-500"
                              : "bg-rose-500"
                          }`}
                        />
                        {user.isActive ? "فعال" : "غیرفعال"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-slate-500">
                      {new Date(
                        user.createdAt
                      ).toLocaleDateString("fa-IR")}
                    </td>

                    <td className="px-6 py-4">
                      {isAdmin ? (
                        <span className="text-xs text-slate-400">
                          حساب مدیریتی
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`نقش ${user.name}`}
                            disabled={
                              Boolean(busyUserId)
                            }
                            value={user.role}
                            onChange={(event) =>
                              updateUser(user, {
                                role: event.target.value as
                                  | "MANAGER"
                                  | "EMPLOYEE",
                              })
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs outline-none focus:border-indigo-500 disabled:opacity-50"
                          >
                            <option value="EMPLOYEE">
                              کارمند
                            </option>
                            <option value="MANAGER">
                              مدیر پروژه
                            </option>
                          </select>

                          <button
                            type="button"
                            disabled={Boolean(busyUserId)}
                            onClick={() =>
                              updateUser(user, {
                                isActive: !user.isActive,
                              })
                            }
                            className={`rounded-lg border px-3 py-2 text-xs transition disabled:opacity-50 ${
                              user.isActive
                                ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {isBusy
                              ? "..."
                              : user.isActive
                                ? "غیرفعال‌کردن"
                                : "فعال‌کردن"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-16 text-center"
                  >
                    <UserRound
                      size={32}
                      className="mx-auto mb-3 text-slate-300"
                    />
                    <p className="text-sm text-slate-500">
                      کاربری با این مشخصات پیدا نشد.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-xs text-slate-500">
          <span>
            نمایش{" "}
            {filteredUsers.length.toLocaleString("fa-IR")}{" "}
            کاربر
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={15} />
            اطلاعات از دیتابیس خوانده می‌شود
          </span>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500">{title}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">
          {value.toLocaleString("fa-IR")}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
