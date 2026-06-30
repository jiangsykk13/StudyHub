import { describe, expect, it } from "vitest";
import { hashSecret, randomToken, signCsrfToken, verifyCsrfToken } from "./token";

describe("auth token helpers", () => {
  it("generates non-repeating opaque tokens and hashes them", () => {
    const first = randomToken();
    const second = randomToken();
    expect(first).not.toEqual(second);
    expect(hashSecret(first)).toHaveLength(64);
    expect(hashSecret(first)).toEqual(hashSecret(first));
  });

  it("signs and verifies CSRF tokens without storing the raw token", () => {
    const token = signCsrfToken("test-secret-at-least-32-bytes");
    expect(verifyCsrfToken("test-secret-at-least-32-bytes", token)).toBe(true);
    expect(verifyCsrfToken("different-secret-at-least-32-bytes", token)).toBe(false);
    expect(verifyCsrfToken("test-secret-at-least-32-bytes", `${token}x`)).toBe(false);
  });
});
