import { describe, it, expect } from "vitest";
import { parseRuntimeMinutes, formatWatchTime } from "@/lib/stats";

describe("stats helpers", () => {
  describe("parseRuntimeMinutes", () => {
    it("parses runtime in standard minute strings", () => {
      expect(parseRuntimeMinutes("109 min")).toBe(109);
      expect(parseRuntimeMinutes("120 mins")).toBe(120);
      expect(parseRuntimeMinutes("95")).toBe(95);
    });

    it("parses runtime in hours and minutes", () => {
      expect(parseRuntimeMinutes("1h 45m")).toBe(105);
      expect(parseRuntimeMinutes("2h 10min")).toBe(130);
      expect(parseRuntimeMinutes("2 hours")).toBe(120);
    });

    it("handles missing or invalid inputs gracefully", () => {
      expect(parseRuntimeMinutes(null)).toBe(0);
      expect(parseRuntimeMinutes(undefined)).toBe(0);
      expect(parseRuntimeMinutes("N/A")).toBe(0);
      expect(parseRuntimeMinutes("")).toBe(0);
    });
  });

  describe("formatWatchTime", () => {
    it("formats minutes to hours and minutes", () => {
      expect(formatWatchTime(0)).toBe("0m");
      expect(formatWatchTime(45)).toBe("45m");
      expect(formatWatchTime(120)).toBe("2h");
      expect(formatWatchTime(135)).toBe("2h 15m");
    });
  });
});
