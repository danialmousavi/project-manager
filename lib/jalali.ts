
import {
  isValidJalaaliDate,
  toGregorian,
  toJalaali,
} from "jalaali-js";

export function jalaliToIso(value: string): string | null {
  const normalized = value
    .replace(/[۰-۹]/g, (digit) =>
      String(digit.charCodeAt(0) - 1776)
    )
    .replace(/[٠-٩]/g, (digit) =>
      String(digit.charCodeAt(0) - 1632)
    )
    .trim()
    .replace(/-/g, "/");

  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(
    normalized
  );

  if (!match) return null;

  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);

  if (!isValidJalaaliDate(jy, jm, jd)) return null;

  const { gy, gm, gd } = toGregorian(jy, jm, jd);

  return [
    gy,
    String(gm).padStart(2, "0"),
    String(gd).padStart(2, "0"),
  ].join("-");
}

export function isoToJalali(
  iso: string | null | undefined
): string {
  if (!iso) return "";

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return "";

  const { jy, jm, jd } = toJalaali(
    Number(match[1]),
    Number(match[2]),
    Number(match[3])
  );

  return [
    jy,
    String(jm).padStart(2, "0"),
    String(jd).padStart(2, "0"),
  ].join("/");
}
