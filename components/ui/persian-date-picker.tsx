
"use client";

import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import { CalendarDays, X } from "lucide-react";

type Props = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
};

export default function PersianDatePicker({
  label,
  value,
  onChange,
  disabled = false,
}: Props) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <div className="relative">
        <CalendarDays
          size={18}
          className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 text-indigo-500"
        />

        <DatePicker
          calendar={persian}
          locale={persianFa}
          format="YYYY/MM/DD"
          calendarPosition="bottom-right"
          value={
            value
              ? new Date(`${value}T12:00:00`)
              : null
          }
          onChange={(date) => {
            if (!date || Array.isArray(date)) {
              onChange(null);
              return;
            }

            onChange(
              date.convert(gregorian).format("YYYY-MM-DD")
            );
          }}
          editable={false}
          disabled={disabled}
          placeholder="انتخاب تاریخ..."
          containerClassName="w-full"
          inputClass="h-12 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-10 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:bg-slate-100"
        />

        {!disabled && value && (
          <button
            type="button"
            aria-label={`پاک کردن ${label}`}
            onClick={() => onChange(null)}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
