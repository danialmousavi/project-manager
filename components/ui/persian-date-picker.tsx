
"use client";

import { useMemo } from "react";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";

import persian from "react-date-object/calendars/persian";
import persianFa from "react-date-object/locales/persian_fa";

import gregorian from "react-date-object/calendars/gregorian";
import gregorianEn from "react-date-object/locales/gregorian_en";

import { CalendarDays, X } from "lucide-react";

type Props = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  calendarPosition?: string;
  portal?: boolean;
  zIndex?: number;
};

export default function PersianDatePicker({
  label,
  value,
  onChange,
  disabled = false,
  calendarPosition = "bottom-right",
  portal = false,
  zIndex,
}: Props) {
  // Input: Gregorian YYYY-MM-DD (English digits)
  // Display: Persian calendar and Persian digits
  const selectedDate = useMemo(() => {
    if (!value) return null;

    try {
      return new DateObject({
        date: value,
        format: "YYYY-MM-DD",
        calendar: gregorian,
        locale: gregorianEn,
      }).convert(persian, persianFa);
    } catch {
      return null;
    }
  }, [value]);

  function handleDateChange(date: DateObject | null) {
    if (!date) {
      onChange(null);
      return;
    }

    // Copy the selected object to prevent mutating the
    // calendar's internal date object.
    const converted = new DateObject(date).convert(
      gregorian,
      gregorianEn
    );

    // Always returns ASCII digits and YYYY-MM-DD format.
    const isoDate = converted.format("YYYY-MM-DD");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return;
    }

    onChange(isoDate);
  }

  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <div className="relative">
        <CalendarDays
          size={18}
          className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 text-emerald-500"
        />

        <DatePicker
          calendar={persian}
          locale={persianFa}
          format="YYYY/MM/DD"
          calendarPosition={calendarPosition}
          portal={portal}
          zIndex={zIndex}
          value={selectedDate}
          onChange={(date) => {
            if (Array.isArray(date)) {
              return;
            }

            handleDateChange(date);
          }}
          editable={false}
          disabled={disabled}
          placeholder="انتخاب تاریخ..."
          containerClassName="w-full"
          inputClass="h-12 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-10 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:bg-slate-100"
        />

        {!disabled && value && (
          <button
            type="button"
            aria-label={`پاک کردن ${label}`}
            onClick={() => onChange(null)}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
