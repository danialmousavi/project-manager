
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("خروج انجام نشد. دوباره تلاش کنید.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        aria-label="خروج از حساب"
        disabled={loading}
        onClick={logout}
        className="flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted)] transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
      >
        <LogOut size={16} aria-hidden="true" />
        <span className="hidden lg:inline">{loading ? "در حال خروج..." : "خروج از حساب"}</span>
      </button>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
