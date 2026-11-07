import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("HTTP security header policy configuration", () => {
  it("defines response headers for document and API routes", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(typeof nextConfig.headers).toBe("function");
    const entries = await nextConfig.headers!();
    const names = entries.flatMap((entry) => entry.headers.map((header) => header.key.toLowerCase()));
    expect(names).toEqual(expect.arrayContaining([
      "content-security-policy",
      "x-content-type-options",
      "referrer-policy",
      "x-frame-options",
      "permissions-policy",
    ]));

    const headers = new Map(
      entries.flatMap((entry) =>
        entry.headers.map((header) => [
          header.key.toLowerCase(),
          header.value,
        ])
      )
    );
    expect(headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("content-security-policy")).toContain("object-src 'none'");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.has("strict-transport-security")).toBe(false);
  });
});
