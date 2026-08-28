/**
 * Single source of truth for week statuses, their matching vote round codes,
 * and the display names for both.
 *
 * `MovieNightWeek.status` and `WeekVote.round` are plain strings in the SQLite
 * schema, so these unions are what gives the rest of the app compile-time
 * checking over them. Because `STATUS_TO_ROUND` is a total `Record` over
 * `WeekStatus`, adding a status to the union fails the build until it is
 * mapped here.
 */

export type WeekStatus =
  | "CATEGORY_VOTING"
  | "CATEGORY_TIEBREAKER_VOTING"
  | "MOVIE_VOTING"
  | "SUBCATEGORY_VOTING"
  | "SUBCATEGORY_TIEBREAKER_VOTING"
  | "SHORTLIST_VOTING"
  | "FINAL_VOTING"
  | "IN_PERSON_VOTING"
  | "IN_PERSON_TIEBREAKER"
  | "IN_PERSON_ROUND_2"
  | "IN_PERSON_ROUND_3"
  | "COMPLETED";

export type RoundCode =
  | "ROUND_1_CATEGORY"
  | "ROUND_1_CATEGORY_TIEBREAKER"
  | "ROUND_2_MOVIE"
  | "ROUND_2_SUB_MOVIE"
  | "ROUND_2C_SUB_MOVIE"
  | "ROUND_3_SHORTLIST"
  | "ROUND_4_TIEBREAKER"
  | "IN_PERSON_ROUND_1"
  | "IN_PERSON_ROUND_1B"
  | "IN_PERSON_ROUND_2"
  | "IN_PERSON_ROUND_3";

/** The round that is open for voting in each status. `COMPLETED` has none. */
export const STATUS_TO_ROUND: Record<WeekStatus, RoundCode | null> = {
  CATEGORY_VOTING: "ROUND_1_CATEGORY",
  CATEGORY_TIEBREAKER_VOTING: "ROUND_1_CATEGORY_TIEBREAKER",
  MOVIE_VOTING: "ROUND_2_MOVIE",
  SUBCATEGORY_VOTING: "ROUND_2_SUB_MOVIE",
  SUBCATEGORY_TIEBREAKER_VOTING: "ROUND_2C_SUB_MOVIE",
  SHORTLIST_VOTING: "ROUND_3_SHORTLIST",
  FINAL_VOTING: "ROUND_4_TIEBREAKER",
  IN_PERSON_VOTING: "IN_PERSON_ROUND_1",
  IN_PERSON_TIEBREAKER: "IN_PERSON_ROUND_1B",
  IN_PERSON_ROUND_2: "IN_PERSON_ROUND_2",
  IN_PERSON_ROUND_3: "IN_PERSON_ROUND_3",
  COMPLETED: null,
};

/** Human-readable status name, used in the UI and in Discord notifications. */
export const STATUS_LABELS: Record<WeekStatus, string> = {
  CATEGORY_VOTING: "Category Voting",
  CATEGORY_TIEBREAKER_VOTING: "Category Tiebreaker Voting",
  MOVIE_VOTING: "Movie Voting",
  SUBCATEGORY_VOTING: "Subcategory Voting",
  SUBCATEGORY_TIEBREAKER_VOTING: "Subcategory Tiebreaker Voting",
  SHORTLIST_VOTING: "Shortlist Voting",
  FINAL_VOTING: "Final Tiebreaker Voting",
  IN_PERSON_VOTING: "In Person Voting",
  IN_PERSON_TIEBREAKER: "In Person Tiebreaker Voting",
  IN_PERSON_ROUND_2: "In Person Round 2 Tiebreaker",
  IN_PERSON_ROUND_3: "In Person Round 3 Final Tiebreaker",
  COMPLETED: "Completed",
};

/** Heading shown above each round's results in the Prior Round Results list. */
export const ROUND_TITLES: Record<RoundCode, string> = {
  ROUND_1_CATEGORY: "Round 1: Category Selection",
  ROUND_1_CATEGORY_TIEBREAKER: "Round 1b: Category Tiebreaker",
  ROUND_2_MOVIE: "Round 2: Movie Selection",
  ROUND_2_SUB_MOVIE: "Round 2b: Subcategory Movie Selection",
  ROUND_2C_SUB_MOVIE: "Round 2c: Subcategory Tiebreaker",
  ROUND_3_SHORTLIST: "Round 3: Shortlist Selection",
  ROUND_4_TIEBREAKER: "Round 4: Final Tiebreaker",
  IN_PERSON_ROUND_1: "Round 1: In Person Movie Selection",
  IN_PERSON_ROUND_1B: "Round 1b: In Person Tiebreaker",
  IN_PERSON_ROUND_2: "Round 2: In Person Tiebreaker (1 vote)",
  IN_PERSON_ROUND_3: "Round 3: In Person Final Tiebreaker (2 votes)",
};

/** Chronological order of rounds, oldest first. */
export const ROUND_ORDER = Object.keys(ROUND_TITLES) as RoundCode[];

/** The statuses an in-person week moves through. */
export type InPersonStatus = Extract<
  WeekStatus,
  | "IN_PERSON_VOTING"
  | "IN_PERSON_TIEBREAKER"
  | "IN_PERSON_ROUND_2"
  | "IN_PERSON_ROUND_3"
>;

/**
 * Vote limits for the in-person flow, shared by the server action that enforces
 * them and the forms that render them, so the two cannot drift apart.
 */
export const IN_PERSON_ROUNDS: Record<
  InPersonStatus,
  { code: RoundCode; maxVotes: number }
> = {
  IN_PERSON_VOTING: { code: "IN_PERSON_ROUND_1", maxVotes: 3 },
  IN_PERSON_TIEBREAKER: { code: "IN_PERSON_ROUND_1B", maxVotes: 4 },
  IN_PERSON_ROUND_2: { code: "IN_PERSON_ROUND_2", maxVotes: 1 },
  IN_PERSON_ROUND_3: { code: "IN_PERSON_ROUND_3", maxVotes: 2 },
};

/**
 * The round open for voting in a status, or null if the status is unknown or
 * the week is finished. Accepts a bare `string` because that is what Prisma
 * hands back for `MovieNightWeek.status`.
 */
export function roundCodeForStatus(status: string): RoundCode | null {
  return STATUS_TO_ROUND[status as WeekStatus] ?? null;
}

/** Display name for a status, falling back to the raw value if unrecognised. */
export function formatStatus(status: string): string {
  return STATUS_LABELS[status as WeekStatus] ?? status;
}

/** Display name for a round, falling back to the raw value if unrecognised. */
export function formatRound(round: string): string {
  return ROUND_TITLES[round as RoundCode] ?? round;
}

export interface VoteTally {
  /** Votes received, keyed by target id. Only targets with >= 1 vote appear. */
  counts: Record<string, number>;
  /** Highest vote count in the round, or 0 when no votes were cast. */
  max: number;
  /** Targets sharing `max`. One entry means an outright winner. */
  tiedIds: string[];
  /** Total votes counted. */
  total: number;
}

/**
 * Counts votes by target and finds the leaders.
 *
 * Pass only the votes for the round being resolved — this does not filter by
 * round or by voter approval. Use `approvedVotesForRound` for that.
 */
export function tallyVotes(votes: { targetId: string }[]): VoteTally {
  const counts: Record<string, number> = {};
  votes.forEach((v) => {
    counts[v.targetId] = (counts[v.targetId] || 0) + 1;
  });

  const max = Math.max(...Object.values(counts), 0);
  const tiedIds = Object.keys(counts).filter((id) => counts[id] === max);

  return { counts, max, tiedIds, total: votes.length };
}

/**
 * Narrows a week's votes to one round, dropping votes from users whose account
 * has not been approved. Unapproved users must never influence a result.
 */
export function approvedVotesForRound<
  T extends { round: string; user: { isApproved: boolean } },
>(votes: T[], round: string): T[] {
  return votes.filter((v) => v.round === round && v.user.isApproved);
}

/** Drops votes from users whose account has not been approved. */
export function approvedVotes<T extends { user: { isApproved: boolean } }>(
  votes: T[],
): T[] {
  return votes.filter((v) => v.user.isApproved);
}
