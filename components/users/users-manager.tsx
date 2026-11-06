
"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  CircleUserRound,
  LoaderCircle,
  Pencil,
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
  nationalId: string | null;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

type Props = {
  initialUsers: UserItem[];
};

type UserChanges = {
  role?: "MANAGER" | "EMPLOYEE";
  isActive?: boolean;
  nationalId?: string;
  phone?: string;
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
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:bg-slate-100 disabled:text-slate-500";

export default function UsersManager({
  initialUsers,
}: Props) {
  const [users, setUsers] = useState(initialUsers);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [busyUserId, setBusyUserId] = useState<
    string | null
  >(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editingUser, setEditingUser] =
    useState<UserItem | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    nationalId: "",
    phone: "",
    password: "",
    role: "EMPLOYEE" as UserRole,
  });

  const filteredUsers = users.filter((user) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.nationalId ?? "").includes(query) ||
      (user.phone ?? "").includes(query);

    const matchesRole =
      roleFilter === "ALL" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const activeCount = users.filter(
    (user) => user.isActive
  ).length;

  const managersCount = users.filter(
    (user) => user.role === "MANAGER"
  ).length;

  async function createUser(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/v1/users", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "ایجاد کاربر ناموفق بود"
        );
      }

      const newUser: UserItem = {
        ...data.user,
        createdAt: data.user.createdAt,
      };

      setUsers((previous) => [
        newUser,
        ...previous,
      ]);

      setForm({
        name: "",
        email: "",
        nationalId: "",
        phone: "",
        password: "",
        role: "EMPLOYEE",
      });

      setShowCreateForm(false);
      setNotice("کاربر جدید با موفقیت ایجاد شد.");
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
    changes: UserChanges
  ): Promise<UserItem> {
    const response = await fetch(
      `/api/v1/users/${user.id}`,
      {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(changes),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "ذخیره تغییرات ناموفق بود"
      );
    }

    const updatedUser: UserItem = {
      ...data.user,
      createdAt: data.user.createdAt,
    };

    setUsers((previous) =>
      previous.map((item) =>
        item.id === user.id ? updatedUser : item
      )
    );

    return updatedUser;
  }

  async function changeUser(
    user: UserItem,
    changes: UserChanges
  ) {
    if (busyUserId) return;

    setBusyUserId(user.id);
    setError("");
    setNotice("");

    try {
      await updateUser(user, changes);
      setNotice("اطلاعات کاربر به‌روزرسانی شد.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در ذخیره تغییرات"
      );
    } finally {
      setBusyUserId(null);
    }
  }

  function openEditModal(user: UserItem) {
    if (busyUserId) return;

    setError("");
    setNotice("");
    setEditingUser(user);
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
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

      {/* Users panel */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              فهرست کاربران
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {users.length.toLocaleString("fa-IR")} کاربر ثبت‌شده
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowCreateForm((previous) => !previous);
              setError("");
              setNotice("");
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            {showCreateForm ? (
              <X size={18} />
            ) : (
              <Plus size={18} />
            )}

            {showCreateForm
              ? "بستن فرم"
              : "افزودن کاربر"}
          </button>
        </div>

        {/* Create user */}
        {showCreateForm && (
          <form
            onSubmit={createUser}
            className="border-b border-emerald-100 bg-emerald-50/40 p-5 sm:p-6"
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

              <Field label="کد ملی">
                <input
                  className={inputClass}
                  dir="ltr"
                  inputMode="numeric"
                  required
                  maxLength={10}
                  value={form.nationalId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      nationalId: event.target.value,
                    })
                  }
                  placeholder="کد ملی ۱۰ رقمی"
                />
              </Field>

              <Field label="شماره موبایل">
                <input
                  className={inputClass}
                  dir="ltr"
                  type="tel"
                  inputMode="tel"
                  required
                  value={form.phone}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      phone: event.target.value,
                    })
                  }
                  placeholder="09123456789"
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
                  <option value="EMPLOYEE">
                    کارمند
                  </option>
                  <option value="MANAGER">
                    مدیر پروژه
                  </option>
                  <option value="ADMIN">
                    مدیر اصلی
                  </option>
                </select>
              </Field>
            </div>

            <p className="mt-4 text-xs leading-6 text-slate-500">
              کد ملی و شماره موبایل باید معتبر و یکتا
              باشند. رمز عبور حداقل ۱۰ کاراکتر است.
            </p>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving && (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                )}

                {saving
                  ? "در حال ذخیره..."
                  : "ثبت کاربر"}
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

        {/* Search and filters */}
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:p-6">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              className={`${inputClass} pr-11`}
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="جست‌وجو بر اساس نام، ایمیل، کد ملی یا موبایل..."
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

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-right text-sm">
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
                  عملیات
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
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                          <CircleUserRound size={21} />
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">
                            {user.name}
                          </p>

                          <p
                            dir="ltr"
                            className="mt-1 text-left text-xs text-slate-400"
                          >
                            {user.email}
                          </p>

                          <div className="mt-2 space-y-1 text-xs text-slate-500">
                            <p>
                              موبایل:{" "}
                              <span dir="ltr" className="inline-block">
                                {user.phone ?? "ثبت نشده"}
                              </span>
                            </p>
                            <p>
                              کد ملی:{" "}
                              {user.nationalId ?? "ثبت نشده"}
                            </p>
                          </div>
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
                        {user.isActive
                          ? "فعال"
                          : "غیرفعال"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-slate-500">
                      {new Date(
                        user.createdAt
                      ).toLocaleDateString("fa-IR")}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Edit modal is available for ADMIN too */}
                        <button
                          type="button"
                          disabled={Boolean(busyUserId)}
                          onClick={() =>
                            openEditModal(user)
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                        >
                          <Pencil size={14} />
                          ویرایش اطلاعات
                        </button>

                        {!isAdmin && (
                          <>
                            <select
                              aria-label={`نقش ${user.name}`}
                              disabled={Boolean(busyUserId)}
                              value={user.role}
                              onChange={(event) =>
                                changeUser(user, {
                                  role: event.target.value as
                                    | "MANAGER"
                                    | "EMPLOYEE",
                                })
                              }
                              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs outline-none focus:border-emerald-500 disabled:opacity-50"
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
                                changeUser(user, {
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
                          </>
                        )}
                      </div>
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
            اطلاعات ثبت‌شده
          </span>
        </div>
      </section>

      {/* Edit modal */}
      {editingUser && (
        <EditUserModal
          key={editingUser.id}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={async (changes) => {
            const updatedUser = await updateUser(
              editingUser,
              changes
            );

            setEditingUser(null);
            setNotice(
              `اطلاعات ${updatedUser.name} با موفقیت ذخیره شد.`
            );
          }}
        />
      )}
    </div>
  );
}

function EditUserModal({
  user,
  onClose,
  onSave,
}: {
  user: UserItem;
  onClose: () => void;
  onSave: (changes: {
    nationalId: string;
    phone: string;
  }) => Promise<void>;
}) {
  const [nationalId, setNationalId] = useState(
    user.nationalId ?? ""
  );
  const [phone, setPhone] = useState(
    user.phone ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const firstInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    firstInputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!saving) onClose();
      }

      if (event.key === "Tab") {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ) ?? []
        );

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (
          event.shiftKey &&
          document.activeElement === first
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [onClose, saving]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");

    try {
      await onSave({
        nationalId: nationalId.trim(),
        phone: phone.trim(),
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در ذخیره اطلاعات"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving
        ) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        {/* Modal header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Pencil size={20} />
            </div>

            <h2
              id="edit-user-title"
              className="text-lg font-extrabold text-slate-900"
            >
              ویرایش اطلاعات کاربر
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              اطلاعات هویتی و تماس کاربر را ویرایش کنید.
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="بستن پنجره"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal form */}
        <form onSubmit={handleSubmit}>
          <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-6">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-white text-emerald-600">
                  <CircleUserRound size={23} />
                </div>

                <div>
                  <p className="font-bold text-slate-900">
                    {user.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {roleLabels[user.role]}
                  </p>
                </div>
              </div>
            </div>

            <Field label="نام و نام خانوادگی">
              <input
                className={inputClass}
                value={user.name}
                disabled
                readOnly
              />
            </Field>

            <Field label="ایمیل">
              <input
                className={inputClass}
                dir="ltr"
                value={user.email}
                disabled
                readOnly
              />
            </Field>

            <Field label="کد ملی">
              <input
                ref={firstInputRef}
                className={inputClass}
                dir="ltr"
                inputMode="numeric"
                required
                maxLength={10}
                value={nationalId}
                onChange={(event) =>
                  setNationalId(event.target.value)
                }
                placeholder="کد ملی ۱۰ رقمی"
              />
            </Field>

            <Field label="شماره موبایل">
              <input
                className={inputClass}
                dir="ltr"
                type="tel"
                inputMode="tel"
                required
                value={phone}
                onChange={(event) =>
                  setPhone(event.target.value)
                }
                placeholder="09123456789"
              />
            </Field>

            <p className="text-xs leading-6 text-slate-500">
              کد ملی باید ۱۰ رقم و معتبر باشد. شماره
              موبایل باید به قالب ایران ثبت شود؛
              مانند 09123456789.
            </p>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </p>
            )}
          </div>

          {/* Modal footer */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving && (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
              )}

              {saving
                ? "در حال ذخیره..."
                : "ذخیره تغییرات"}
            </button>
          </div>
        </form>
      </div>
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
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        {icon}
      </div>

      <div>
        <p className="text-xs text-slate-500">
          {title}
        </p>

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
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>

      {children}
    </label>
  );
}
