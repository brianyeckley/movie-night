// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { readChunkResponse } from "@/components/WeekFilePanel";

vi.mock("@/app/actions", () => ({ deleteWeekFileAction: vi.fn() }));

describe("readChunkResponse", () => {
  it("returns the byte count the server reported", () => {
    expect(readChunkResponse(200, JSON.stringify({ received: 4096, done: false }))).toBe(4096);
  });

  it("refuses a 2xx whose body does not say how far the file got", () => {
    // The tunnel can answer with an error page carrying a 200. Reading that
    // as "zero bytes received" used to rewind the upload to the start.
    expect(() => readChunkResponse(200, "<html>Bad gateway</html>")).toThrowError(
      /could not be read/
    );
  });

  it("raises that case as retryable, so the next try asks where the file got to", () => {
    try {
      readChunkResponse(200, "{}");
      throw new Error("should have thrown");
    } catch (err) {
      // status 0 is the client's retryable band, alongside network errors.
      expect((err as { status: number }).status).toBe(0);
      expect((err as { received?: number }).received).toBeUndefined();
    }
  });

  it("carries the server's offset through an error so a retry can resume", () => {
    try {
      readChunkResponse(409, JSON.stringify({ error: "Offset does not match.", received: 8192 }));
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as { status: number }).status).toBe(409);
      expect((err as { received?: number }).received).toBe(8192);
      expect((err as Error).message).toBe("Offset does not match.");
    }
  });

  it("falls back to the status when an error body is unreadable", () => {
    expect(() => readChunkResponse(502, "<html>502</html>")).toThrowError(/\(502\)/);
  });
});
