
"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Check,
  ChevronDown,
  LoaderCircle,
  Search,
  UserRound,
  X,
} from "lucide-react";

export type SelectableUser = {
  id: string;
  name: string;
  email: string;
};

type Props = {
  label: string;
  role: "MANAGER" | "EMPLOYEE" | "CONTROLLER";
  selected: SelectableUser[];
  onChange: (users: SelectableUser[]) => void;
  projectId?: string;
  companyId?: string;
  placeholder?: string;
  disabled?: boolean;
};

export default function UserMultiSelect({
  label,
  role,
  selected,
  onChange,
  projectId,
  companyId,
  placeholder = "انتخاب کاربران...",
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SelectableUser[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleMouseDown(event: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleMouseDown
    );
    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleMouseDown
      );
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    inputRef.current?.focus();

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        role,
        q: query.trim(),
      });

      if (projectId) {
        params.set("projectId", projectId);
      }

      if (companyId) {
        params.set("companyId", companyId);
      }

      try {
        const response = await fetch(
          `/api/v1/users/search?${params.toString()}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "دریافت کاربران ناموفق بود"
          );
        }

        if (!controller.signal.aborted) {
          setResults(data.users ?? []);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setResults([]);
        setError(
          err instanceof Error
            ? err.message
            : "خطا در جست‌وجوی کاربران"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, role, projectId, companyId]);

  function toggleUser(user: SelectableUser) {
    if (selected.some((item) => item.id === user.id)) {
      onChange(
        selected.filter((item) => item.id !== user.id)
      );
    } else {
      onChange([...selected, user]);
    }
  }

  function removeUser(id: string) {
    onChange(selected.filter((user) => user.id !== id));
  }

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <div
        className={`min-h-12 rounded-xl border bg-white transition ${
          open
            ? "border-emerald-400 ring-4 ring-emerald-500/10"
            : "border-slate-200"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <div className="flex min-h-12 items-center gap-2 p-2">
          <button
            type="button"
            disabled={disabled}
            aria-expanded={open}
            aria-haspopup="listbox"
            onClick={() => setOpen((previous) => !previous)}
            className="flex min-w-0 flex-1 items-center gap-2 text-right"
          >
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {selected.length === 0 ? (
                <span className="px-2 text-sm text-slate-400">
                  {placeholder}
                </span>
              ) : (
                selected.slice(0, 4).map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex max-w-full items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700"
                  >
                    <span className="max-w-32 truncate">
                      {user.name}
                    </span>
                  </span>
                ))
              )}

              {selected.length > 4 && (
                <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600">
                  +{(selected.length - 4).toLocaleString("fa-IR")} نفر
                </span>
              )}
            </div>

            <span className="shrink-0 text-xs text-slate-400">
              {selected.length.toLocaleString("fa-IR")} نفر
            </span>

            <ChevronDown
              size={17}
              className={`shrink-0 text-slate-400 transition ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((user) => (
            <span
              key={user.id}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white py-1 pr-2.5 pl-1 text-xs text-slate-600"
            >
              {user.name}
              {!disabled && (
                <button
                  type="button"
                  aria-label={`حذف ${user.name}`}
                  onClick={() => removeUser(user.id)}
                  className="rounded-md p-1 hover:bg-rose-50 hover:text-rose-600"
                >
                  <X size={13} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {open && !disabled && (
        <div className="absolute right-0 left-0 z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-3">
            <div className="relative">
              <Search
                size={17}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="جست‌وجو نام یا ایمیل..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pr-10 pl-3 text-sm outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <div
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="max-h-64 overflow-y-auto p-2"
          >
            {loading && (
              <div className="flex items-center justify-center gap-2 py-7 text-sm text-slate-500">
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
                در حال جست‌وجو...
              </div>
            )}

            {!loading && error && (
              <p
                role="alert"
                className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700"
              >
                {error}
              </p>
            )}

            {!loading && !error && results.length === 0 && (
              <p className="py-7 text-center text-sm text-slate-400">
                کاربری پیدا نشد.
              </p>
            )}

            {!loading &&
              !error &&
              results.map((user) => {
                const isSelected = selected.some(
                  (item) => item.id === user.id
                );

                return (
                  <button
                    key={user.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleUser(user)}
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-right transition ${
                      isSelected
                        ? "bg-emerald-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <UserRound size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {user.name}
                      </p>

                      <p
                        dir="ltr"
                        className="mt-1 truncate text-left text-xs text-slate-400"
                      >
                        {user.email}
                      </p>
                    </div>

                    <div
                      className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300"
                      }`}
                    >
                      {isSelected && <Check size={13} />}
                    </div>
                  </button>
                );
              })}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
            <span className="text-xs text-slate-400">
              حداکثر ۲۰ نتیجه در هر جست‌وجو
            </span>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              تأیید انتخاب
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
