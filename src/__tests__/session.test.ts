import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const cookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("server-only", () => ({}));

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, SESSION_SECRET: "test-secret-for-unit-tests" };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("session tokens", () => {
  // Regression: the payload used to carry `role`, which a ten-year
  // "remember me" token would then keep asserting long after a demotion.
  it("carries only the user id, never the role", async () => {
    const { createSession, decrypt } = await import("@/lib/session");

    await createSession("user-1", false);

    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    const [name, token] = cookieStore.set.mock.calls[0];
    expect(name).toBe("movie_night_session");

    const payload = await decrypt(token as string);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe("user-1");
    expect(payload!.role).toBeUndefined();
  });

  it("sets an httpOnly, lax cookie", async () => {
    const { createSession } = await import("@/lib/session");

    await createSession("user-1", false);

    const options = cookieStore.set.mock.calls[0][2];
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("gives remember-me a far longer expiry than a plain sign-in", async () => {
    const { createSession } = await import("@/lib/session");

    await createSession("user-1", false);
    const shortLived = cookieStore.set.mock.calls[0][2].expires as Date;

    cookieStore.set.mockClear();
    await createSession("user-1", true);
    const longLived = cookieStore.set.mock.calls[0][2].expires as Date;

    expect(longLived.getTime()).toBeGreaterThan(shortLived.getTime());
  });

  it("rejects a token signed with a different secret", async () => {
    const { createSession } = await import("@/lib/session");
    await createSession("user-1", false);
    const token = cookieStore.set.mock.calls[0][1] as string;

    // Re-import under a different secret, as a tampered deployment would see it.
    vi.resetModules();
    process.env.SESSION_SECRET = "a-completely-different-secret";
    const { decrypt } = await import("@/lib/session");

    expect(await decrypt(token)).toBeNull();
  });

  it("treats a malformed token as signed out rather than throwing", async () => {
    const { decrypt } = await import("@/lib/session");

    expect(await decrypt("not-a-jwt")).toBeNull();
    expect(await decrypt(undefined)).toBeNull();
  });

  it("refuses to sign without SESSION_SECRET in production", async () => {
    vi.resetModules();
    // NODE_ENV is typed readonly, so replace the whole object rather than
    // assigning to the property.
    const { SESSION_SECRET: _omit, ...rest } = ORIGINAL_ENV;
    void _omit;
    process.env = { ...rest, NODE_ENV: "production" };

    const { createSession } = await import("@/lib/session");

    await expect(createSession("user-1", false)).rejects.toThrow(
      /SESSION_SECRET is not set/
    );
  });
});

describe("captcha", () => {
  it("accepts the right answer and rejects a wrong one", async () => {
    const { generateCaptcha, verifyCaptcha } = await import("@/lib/session");

    const { question, token } = await generateCaptcha();
    const [, a, b] = question.match(/What is (\d+) \+ (\d+)\?/)!;
    const answer = String(Number(a) + Number(b));

    expect(await verifyCaptcha(token, answer)).toBe(true);
    expect(await verifyCaptcha(token, String(Number(answer) + 1))).toBe(false);
  });

  it("rejects a missing token or a blank answer", async () => {
    const { generateCaptcha, verifyCaptcha } = await import("@/lib/session");
    const { token } = await generateCaptcha();

    expect(await verifyCaptcha(undefined, "5")).toBe(false);
    expect(await verifyCaptcha(token, "")).toBe(false);
  });
});
