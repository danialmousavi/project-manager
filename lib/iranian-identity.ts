
export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) =>
      String(digit.charCodeAt(0) - 1776)
    )
    .replace(/[٠-٩]/g, (digit) =>
      String(digit.charCodeAt(0) - 1632)
    )
    .trim();
}

export function normalizeNationalId(value: string): string {
  return normalizeDigits(value).replace(/[\s-]/g, "");
}

export function isValidNationalId(value: string): boolean {
  const code = normalizeNationalId(value);

  if (!/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false;

  const sum = code
    .slice(0, 9)
    .split("")
    .reduce(
      (total, digit, index) =>
        total + Number(digit) * (10 - index),
      0
    );

  const remainder = sum % 11;
  const checkDigit = Number(code[9]);

  return remainder < 2
    ? checkDigit === remainder
    : checkDigit === 11 - remainder;
}

export function normalizePhone(value: string): string {
  const phone = normalizeDigits(value)
    .replace(/[\s()-]/g, "");

  if (phone.startsWith("+98")) {
    return `0${phone.slice(3)}`;
  }

  if (phone.startsWith("0098")) {
    return `0${phone.slice(4)}`;
  }

  if (phone.startsWith("98") && phone.length === 12) {
    return `0${phone.slice(2)}`;
  }

  return phone;
}

export function isValidIranianMobile(value: string): boolean {
  return /^09\d{9}$/.test(normalizePhone(value));
}
