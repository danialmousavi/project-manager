
"use client";

import {
  AlertTriangle,
  LoaderCircle,
  X,
} from "lucide-react";

type Props = {
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = "حذف تسک",
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertTriangle size={24} />
          </div>

          <button
            type="button"
            disabled={busy}
            aria-label="بستن پنجره"
            onClick={onCancel}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100"
          >
            <X size={19} />
          </button>
        </div>

        <h2
          id="confirm-title"
          className="mt-5 text-xl font-bold text-slate-900"
        >
          {title}
        </h2>

        <p
          id="confirm-description"
          className="mt-3 text-sm leading-8 text-slate-500"
        >
          {description}
        </p>

        <div className="mt-7 flex justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            انصراف
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {busy && (
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
