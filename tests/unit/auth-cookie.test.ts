import { describe, expect, it } from "vitest";

import { shouldUseSecureSessionCookie } from "@/lib/session-cookie";

describe("shouldUseSecureSessionCookie", () => {
  it("does not mark sessions secure for an HTTP public URL", () => {
    expect(
      shouldUseSecureSessionCookie({
        NODE_ENV: "production",
        APP_URL: "http://46.34.163.94:3000",
      })
    ).toBe(false);
  });

  it("keeps sessions secure on HTTPS by default", () => {
    expect(
      shouldUseSecureSessionCookie({
        NODE_ENV: "production",
        APP_URL: "https://app.example.test",
      })
    ).toBe(true);
  });

  it("honors an explicit cookie security setting", () => {
    expect(
      shouldUseSecureSessionCookie({
        NODE_ENV: "production",
        APP_URL: "http://46.34.163.94:3000",
        SESSION_COOKIE_SECURE: "true",
      })
    ).toBe(true);
  });
});
