import { afterEach, describe, expect, it, vi } from "vitest";

import { isAllowedOrigin } from "@/lib/security/origin";

function request(origin: string | undefined, headers: Record<string, string> = {}) {
  return new Request("http://internal-service:3000/api/v1/test", {
    headers: {
      ...(origin ? { origin } : {}),
      ...headers,
    },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAllowedOrigin", () => {
  it("allows the exact configured origin", () => {
    vi.stubEnv("APP_URL", "http://46.34.163.94:3000");
    vi.stubEnv("NODE_ENV", "production");

    expect(isAllowedOrigin(request("http://46.34.163.94:3000"))).toBe(true);
  });

  it.each([
    "http://evil.example",
    "http://46.34.163.94:3001",
    "https://46.34.163.94:3000",
  ])("rejects unauthorized origin %s", (origin) => {
    vi.stubEnv("APP_URL", "http://46.34.163.94:3000");
    vi.stubEnv("NODE_ENV", "production");

    expect(isAllowedOrigin(request(origin))).toBe(false);
  });

  it("rejects missing and malformed origins", () => {
    vi.stubEnv("APP_URL", "http://46.34.163.94:3000");
    vi.stubEnv("NODE_ENV", "production");

    expect(isAllowedOrigin(request(undefined))).toBe(false);
    expect(isAllowedOrigin(request("not-a-url"))).toBe(false);
  });

  it("fails closed when APP_URL is missing or invalid in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    vi.stubEnv("APP_URL", "");
    expect(isAllowedOrigin(request("http://internal-service:3000"))).toBe(false);

    vi.stubEnv("APP_URL", "not-a-url");
    expect(isAllowedOrigin(request("http://internal-service:3000"))).toBe(false);
  });

  it("does not trust forged host or forwarded headers", () => {
    vi.stubEnv("APP_URL", "http://46.34.163.94:3000");
    vi.stubEnv("NODE_ENV", "production");

    expect(
      isAllowedOrigin(
        request("http://evil.example", {
          host: "46.34.163.94:3000",
          "x-forwarded-host": "46.34.163.94:3000",
          "x-forwarded-proto": "http",
        }),
      ),
    ).toBe(false);
  });
});
