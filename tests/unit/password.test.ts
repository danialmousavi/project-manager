import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../../lib/password";

describe("password hashing", () => {
  it("creates a PHC Argon2id hash and verifies only the correct password", async () => {
    const encoded = await hashPassword("correct horse battery staple");

    expect(encoded).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=4\$/u);
    await expect(
      verifyPassword(encoded, "correct horse battery staple")
    ).resolves.toBe(true);
    await expect(verifyPassword(encoded, "wrong password")).resolves.toBe(false);
  });

  it("rejects malformed or unsafe hash parameters", async () => {
    await expect(verifyPassword("not-a-password-hash", "password")).resolves.toBe(false);
    await expect(
      verifyPassword(
        "$argon2id$v=19$m=999999999,t=3,p=4$c2FsdHNhbHQ$YWJjZA",
        "password"
      )
    ).resolves.toBe(false);
  });
});
