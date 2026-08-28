import { describe, it, expect } from "vitest";
import {
  approvedVotes,
  approvedVotesForRound,
  formatRound,
  formatStatus,
  IN_PERSON_ROUNDS,
  ROUND_ORDER,
  ROUND_TITLES,
  roundCodeForStatus,
  STATUS_LABELS,
  STATUS_TO_ROUND,
  tallyVotes,
  type WeekStatus,
} from "@/lib/rounds";

const ALL_STATUSES = Object.keys(STATUS_TO_ROUND) as WeekStatus[];

describe("rounds", () => {
  describe("roundCodeForStatus", () => {
    it("maps every voting status to a round code", () => {
      for (const status of ALL_STATUSES) {
        if (status === "COMPLETED") continue;
        expect(roundCodeForStatus(status), status).toBeTruthy();
      }
    });

    // Regression: the cron reminder route had its own copy of this map that
    // omitted the in-person statuses, so reminders silently never fired for
    // in-person weeks.
    it("covers the in-person statuses", () => {
      expect(roundCodeForStatus("IN_PERSON_VOTING")).toBe("IN_PERSON_ROUND_1");
      expect(roundCodeForStatus("IN_PERSON_TIEBREAKER")).toBe("IN_PERSON_ROUND_1B");
      expect(roundCodeForStatus("IN_PERSON_ROUND_2")).toBe("IN_PERSON_ROUND_2");
      expect(roundCodeForStatus("IN_PERSON_ROUND_3")).toBe("IN_PERSON_ROUND_3");
    });

    it("returns null for a finished week and for unknown values", () => {
      expect(roundCodeForStatus("COMPLETED")).toBeNull();
      expect(roundCodeForStatus("NOT_A_STATUS")).toBeNull();
    });
  });

  describe("formatStatus", () => {
    // Regression: notifyReminder used a second, shorter copy of this lookup
    // that fell through to the raw enum name on tiebreaker rounds.
    it("gives every status a human-readable label", () => {
      for (const status of ALL_STATUSES) {
        expect(formatStatus(status), status).not.toBe(status);
      }
    });

    it("labels the tiebreaker rounds the reminder used to leak", () => {
      expect(formatStatus("CATEGORY_TIEBREAKER_VOTING")).toBe("Category Tiebreaker Voting");
      expect(formatStatus("SUBCATEGORY_TIEBREAKER_VOTING")).toBe("Subcategory Tiebreaker Voting");
      expect(formatStatus("COMPLETED")).toBe("Completed");
    });

    it("falls back to the raw value when unrecognised", () => {
      expect(formatStatus("SOMETHING_NEW")).toBe("SOMETHING_NEW");
    });
  });

  describe("formatRound", () => {
    it("titles every round code", () => {
      for (const round of ROUND_ORDER) {
        expect(formatRound(round), round).toBe(ROUND_TITLES[round]);
      }
    });

    it("falls back to the raw value when unrecognised", () => {
      expect(formatRound("ROUND_99")).toBe("ROUND_99");
    });
  });

  describe("table consistency", () => {
    it("gives every round code a title", () => {
      const mapped = ALL_STATUSES.map((s) => STATUS_TO_ROUND[s]).filter(Boolean);
      for (const round of mapped) {
        expect(ROUND_TITLES[round!], round!).toBeTruthy();
      }
    });

    it("labels every status", () => {
      for (const status of ALL_STATUSES) {
        expect(STATUS_LABELS[status], status).toBeTruthy();
      }
    });

    it("points each in-person round at a real round code with a sane limit", () => {
      for (const [status, round] of Object.entries(IN_PERSON_ROUNDS)) {
        expect(roundCodeForStatus(status), status).toBe(round.code);
        expect(round.maxVotes).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("tallyVotes", () => {
    it("counts votes per target and finds an outright winner", () => {
      const result = tallyVotes([
        { targetId: "a" },
        { targetId: "b" },
        { targetId: "a" },
      ]);

      expect(result.counts).toEqual({ a: 2, b: 1 });
      expect(result.max).toBe(2);
      expect(result.tiedIds).toEqual(["a"]);
      expect(result.total).toBe(3);
    });

    it("returns every leader when the round is tied", () => {
      const result = tallyVotes([
        { targetId: "a" },
        { targetId: "b" },
        { targetId: "c" },
      ]);

      expect(result.max).toBe(1);
      expect(result.tiedIds.sort()).toEqual(["a", "b", "c"]);
    });

    it("handles an empty round without producing -Infinity", () => {
      const result = tallyVotes([]);

      expect(result.counts).toEqual({});
      expect(result.max).toBe(0);
      expect(result.tiedIds).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("approved vote filters", () => {
    const votes = [
      { round: "ROUND_1_CATEGORY", targetId: "a", user: { isApproved: true } },
      { round: "ROUND_1_CATEGORY", targetId: "b", user: { isApproved: false } },
      { round: "ROUND_2_MOVIE", targetId: "c", user: { isApproved: true } },
    ];

    it("keeps only approved voters", () => {
      expect(approvedVotes(votes)).toHaveLength(2);
    });

    it("narrows to one round and drops unapproved voters", () => {
      const result = approvedVotesForRound(votes, "ROUND_1_CATEGORY");

      expect(result).toHaveLength(1);
      expect(result[0].targetId).toBe("a");
    });
  });
});
