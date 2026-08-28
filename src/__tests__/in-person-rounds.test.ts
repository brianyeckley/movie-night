import { describe, it, expect } from "vitest";
import {
  IN_PERSON_ROUNDS,
  roundCodeForStatus,
  formatStatus,
  STATUS_TO_ROUND,
  type InPersonStatus,
  type WeekStatus,
} from "@/lib/rounds";

const IN_PERSON_STATUSES = Object.keys(IN_PERSON_ROUNDS) as InPersonStatus[];
const ALL_STATUSES = Object.keys(STATUS_TO_ROUND) as WeekStatus[];

/**
 * In-person weeks are a separate track through the state machine, not a
 * variation on the standard one. The four rounds were once four near-identical
 * components; they are now one component driven by IN_PERSON_ROUNDS, so these
 * guard the thing that collapse could plausibly have flattened.
 */
describe("in-person weeks stay a distinct track", () => {
  it("has exactly four in-person rounds", () => {
    expect(IN_PERSON_STATUSES).toEqual([
      "IN_PERSON_VOTING",
      "IN_PERSON_TIEBREAKER",
      "IN_PERSON_ROUND_2",
      "IN_PERSON_ROUND_3",
    ]);
  });

  it("gives each round its own code and vote limit", () => {
    expect(IN_PERSON_ROUNDS).toEqual({
      IN_PERSON_VOTING: { code: "IN_PERSON_ROUND_1", maxVotes: 3 },
      IN_PERSON_TIEBREAKER: { code: "IN_PERSON_ROUND_1B", maxVotes: 4 },
      IN_PERSON_ROUND_2: { code: "IN_PERSON_ROUND_2", maxVotes: 1 },
      IN_PERSON_ROUND_3: { code: "IN_PERSON_ROUND_3", maxVotes: 2 },
    });
  });

  it("keeps every round code distinct", () => {
    const codes = IN_PERSON_STATUSES.map((s) => IN_PERSON_ROUNDS[s].code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("never shares a round code with the standard track", () => {
    const inPersonCodes = new Set(
      IN_PERSON_STATUSES.map((s) => IN_PERSON_ROUNDS[s].code)
    );
    const standardCodes = ALL_STATUSES.filter(
      (s) => !IN_PERSON_STATUSES.includes(s as InPersonStatus)
    )
      .map((s) => STATUS_TO_ROUND[s])
      .filter(Boolean);

    for (const code of standardCodes) {
      expect(inPersonCodes.has(code!)).toBe(false);
    }
  });

  it("agrees with STATUS_TO_ROUND on every in-person round", () => {
    for (const status of IN_PERSON_STATUSES) {
      expect(roundCodeForStatus(status)).toBe(IN_PERSON_ROUNDS[status].code);
    }
  });

  it("labels each in-person round distinctly for the UI and Discord", () => {
    const labels = IN_PERSON_STATUSES.map(formatStatus);

    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) {
      expect(label).toMatch(/In Person/);
    }
  });

  it("does not treat a standard status as an in-person round", () => {
    for (const status of ["CATEGORY_VOTING", "MOVIE_VOTING", "COMPLETED"]) {
      expect(status in IN_PERSON_ROUNDS).toBe(false);
    }
  });
});
