import { vi, describe, it, expect, beforeEach } from "vitest";
import { resetRoundAction, advanceWeekRoundAction, createWeekAction } from "@/app/actions/week";
import { db } from "@/lib/db";
import { getActiveUser } from "@/app/actions/user";
import { notifyRoundAdvanced } from "@/lib/discord";
import { revalidatePath } from "next/cache";

vi.mock("@/lib/db", () => ({
  db: {
    movieNightWeek: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    category: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    movie: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    weekVote: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock("@/lib/discord", () => ({
  notifyNewWeek: vi.fn().mockResolvedValue(undefined),
  notifyRoundAdvanced: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/app/actions/user", () => ({
  getActiveUser: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Week Management Server Actions", () => {
  const mockAdmin = { id: "admin-1", username: "brian", name: "Brian", passwordHash: "", role: "ADMIN", isApproved: true };
  const mockUser = { id: "user-1", username: "stew", name: "Stew", passwordHash: "", role: "USER", isApproved: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createWeekAction", () => {
    it("throws an error if user is not admin", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      await expect(createWeekAction("Action")).rejects.toThrow("Unauthorized: Only Admin can create weeks.");
    });

    it("refuses to start a week while one is still open (including one awaiting close-out)", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findFirst).mockResolvedValueOnce({ id: "week-active" } as any);
      await expect(createWeekAction("Action")).rejects.toThrow(
        "An active week is already in progress."
      );
    });

    // Regression: the dashboard and the cron treated a week as active until it
    // was closed, while this guard used status !== COMPLETED. In the window
    // between a winner being picked and the admin closing out, an admin could
    // start a second week and leave two matching closedAt: null.
    it("treats a COMPLETED but unclosed week as still active", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findFirst).mockResolvedValueOnce({
        id: "week-5",
        status: "COMPLETED",
        closedAt: null,
      } as any);

      await expect(createWeekAction("Action")).rejects.toThrow(
        "Close it out before starting the next one."
      );
      expect(db.movieNightWeek.create).not.toHaveBeenCalled();
    });

    it("looks for the active week by closedAt, not by status", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findFirst).mockResolvedValueOnce({ id: "w" } as any);

      await expect(createWeekAction("Action")).rejects.toThrow();
      expect(db.movieNightWeek.findFirst).toHaveBeenCalledWith({
        where: { closedAt: null },
      });
    });

    it("creates a standard week successfully with category selection", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findFirst).mockImplementation((async ({ where }: any) => {
        // The active-week lookup filters on closedAt; the other findFirst
        // call is the "highest week number so far" lookup.
        if (where && "closedAt" in where) return null; // No active week
        return { weekNumber: 5 } as any; // Last week
      }) as any);

      vi.mocked(db.category.findUnique).mockResolvedValueOnce(null); // Category doesn't exist
      vi.mocked(db.category.create).mockResolvedValueOnce({ id: "cat-new", name: "Sci-Fi" } as any);
      vi.mocked(db.movieNightWeek.create).mockResolvedValueOnce({ id: "week-6", weekNumber: 6 } as any);

      await createWeekAction("Sci-Fi");

      expect(db.category.updateMany).toHaveBeenCalledWith({
        where: { isThemed: true },
        data: { isActive: false },
      });
      expect(db.category.create).toHaveBeenCalledWith({
        data: { name: "Sci-Fi", isThemed: true, isActive: true },
      });
      expect(db.movieNightWeek.create).toHaveBeenCalledWith({
        data: {
          weekNumber: 6,
          status: "CATEGORY_VOTING",
          themeCategoryId: "cat-new",
          isInPerson: false,
        },
      });
    });

    it("creates an In-Person week and skips categories selection using default theme", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findFirst).mockImplementation((async ({ where }: any) => {
        // The active-week lookup filters on closedAt; the other findFirst
        // call is the "highest week number so far" lookup.
        if (where && "closedAt" in where) return null; // No active week
        return { weekNumber: 10 } as any; // Last week
      }) as any);

      // Category "In Person Physical Media" already exists
      vi.mocked(db.category.findUnique).mockResolvedValueOnce({ id: "cat-inperson", name: "In Person Physical Media" } as any);
      vi.mocked(db.category.update).mockResolvedValueOnce({ id: "cat-inperson", name: "In Person Physical Media" } as any);
      vi.mocked(db.movieNightWeek.create).mockResolvedValueOnce({ id: "week-11", weekNumber: 11 } as any);

      await createWeekAction(undefined, true);

      expect(db.category.findUnique).toHaveBeenCalledWith({
        where: { name: "In Person Physical Media" },
      });
      expect(db.category.update).toHaveBeenCalledWith({
        where: { id: "cat-inperson" },
        data: { isActive: true, isThemed: true },
      });
      expect(db.movieNightWeek.create).toHaveBeenCalledWith({
        data: {
          weekNumber: 11,
          status: "IN_PERSON_VOTING",
          themeCategoryId: "cat-inperson",
          isInPerson: true,
        },
      });
    });
  });

  describe("resetRoundAction", () => {
    it("throws an error if user is not admin", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      await expect(resetRoundAction("week-1")).rejects.toThrow("Unauthorized: Only Admin can reset rounds.");
    });

    it("resets category tiebreaker votes when status is CATEGORY_TIEBREAKER_VOTING", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "CATEGORY_TIEBREAKER_VOTING",
      } as any);

      await resetRoundAction("week-1");

      expect(db.weekVote.deleteMany).toHaveBeenCalledWith({
        where: {
          weekId: "week-1",
          round: "ROUND_1_CATEGORY_TIEBREAKER",
        },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });

    it("resets in-person voting round 1 votes", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "IN_PERSON_VOTING",
      } as any);

      await resetRoundAction("week-1");

      expect(db.weekVote.deleteMany).toHaveBeenCalledWith({
        where: {
          weekId: "week-1",
          round: "IN_PERSON_ROUND_1",
        },
      });
    });

    it("resets in-person tiebreaker round 1b votes", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "IN_PERSON_TIEBREAKER",
      } as any);

      await resetRoundAction("week-1");

      expect(db.weekVote.deleteMany).toHaveBeenCalledWith({
        where: {
          weekId: "week-1",
          round: "IN_PERSON_ROUND_1B",
        },
      });
    });
  });

  describe("advanceWeekRoundAction", () => {
    it("allows non-admins to advance only if everyone has voted", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "CATEGORY_VOTING",
        votes: [
          { round: "ROUND_1_CATEGORY", userId: "user-1", user: { id: "user-1", isApproved: true } },
        ],
      } as any);

      // 2 approved users exist, but only user-1 has voted
      vi.mocked(db.user.findMany).mockResolvedValueOnce([
        { id: "user-1", isApproved: true },
        { id: "user-2", isApproved: true },
      ] as any);

      const result = await advanceWeekRoundAction("week-1");
      expect(result).toEqual({
        success: false,
        error: "Unauthorized: Only Admin can advance before all votes are in.",
      });
    });

    it("transitions CATEGORY_VOTING to CATEGORY_TIEBREAKER_VOTING on a tie", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "CATEGORY_VOTING",
        votes: [
          { round: "ROUND_1_CATEGORY", targetId: "cat-1", userId: "user-1", user: { id: "user-1", isApproved: true } },
          { round: "ROUND_1_CATEGORY", targetId: "cat-2", userId: "user-2", user: { id: "user-2", isApproved: true } },
        ],
      } as any);
      vi.mocked(db.user.findMany).mockResolvedValueOnce([
        { id: "user-1", isApproved: true },
        { id: "user-2", isApproved: true },
      ] as any);
      vi.mocked(db.category.findMany).mockResolvedValueOnce([
        { id: "cat-1", name: "Comedy" },
        { id: "cat-2", name: "Sci-Fi" },
      ] as any);

      const result = await advanceWeekRoundAction("week-1");
      expect(result).toEqual({ success: true });

      expect(db.movieNightWeek.update).toHaveBeenCalledWith({
        where: { id: "week-1" },
        data: { status: "CATEGORY_TIEBREAKER_VOTING" },
      });

      expect(notifyRoundAdvanced).toHaveBeenCalledWith("week-1", "CATEGORY_VOTING", "CATEGORY_TIEBREAKER_VOTING", {
        tiedItems: ["Comedy", "Sci-Fi"],
      });
    });

    it("transitions CATEGORY_VOTING to MOVIE_VOTING on outright winner", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "CATEGORY_VOTING",
        votes: [
          { round: "ROUND_1_CATEGORY", targetId: "cat-1", userId: "user-1", user: { id: "user-1", isApproved: true } },
          { round: "ROUND_1_CATEGORY", targetId: "cat-1", userId: "user-2", user: { id: "user-2", isApproved: true } },
        ],
      } as any);
      vi.mocked(db.user.findMany).mockResolvedValueOnce([
        { id: "user-1", isApproved: true },
        { id: "user-2", isApproved: true },
      ] as any);
      vi.mocked(db.category.findUnique).mockResolvedValueOnce({ id: "cat-1", name: "Comedy" } as any);

      const result = await advanceWeekRoundAction("week-1");
      expect(result).toEqual({ success: true });

      expect(db.movieNightWeek.update).toHaveBeenCalledWith({
        where: { id: "week-1" },
        data: {
          selectedCategoryId: "cat-1",
          status: "MOVIE_VOTING",
        },
      });

      expect(notifyRoundAdvanced).toHaveBeenCalledWith("week-1", "CATEGORY_VOTING", "MOVIE_VOTING", {
        winnerName: "Comedy",
        isRandom: false,
      });
    });

    it("ignores votes from unapproved users during counts", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "CATEGORY_VOTING",
        votes: [
          { round: "ROUND_1_CATEGORY", targetId: "cat-1", userId: "user-1", user: { id: "user-1", isApproved: true } },
          { round: "ROUND_1_CATEGORY", targetId: "cat-2", userId: "user-2", user: { id: "user-2", isApproved: false } }, // ignored!
        ],
      } as any);
      vi.mocked(db.user.findMany).mockResolvedValueOnce([
        { id: "user-1", isApproved: true },
      ] as any);
      vi.mocked(db.category.findUnique).mockResolvedValueOnce({ id: "cat-1", name: "Comedy" } as any);

      const result = await advanceWeekRoundAction("week-1");
      expect(result).toEqual({ success: true });

      // Only cat-1 has approved votes (1 vote). So Comedy is the outright winner.
      expect(db.movieNightWeek.update).toHaveBeenCalledWith({
        where: { id: "week-1" },
        data: {
          selectedCategoryId: "cat-1",
          status: "MOVIE_VOTING",
        },
      });
    });

    it("transitions CATEGORY_TIEBREAKER_VOTING to MOVIE_VOTING with random selection if tie persists", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "CATEGORY_TIEBREAKER_VOTING",
        votes: [
          { round: "ROUND_1_CATEGORY_TIEBREAKER", targetId: "cat-1", userId: "user-1", user: { id: "user-1", isApproved: true } },
          { round: "ROUND_1_CATEGORY_TIEBREAKER", targetId: "cat-2", userId: "user-2", user: { id: "user-2", isApproved: true } },
        ],
      } as any);
      vi.mocked(db.user.findMany).mockResolvedValueOnce([
        { id: "user-1", isApproved: true },
        { id: "user-2", isApproved: true },
      ] as any);
      vi.mocked(db.category.findUnique).mockImplementation((async ({ where: { id } }: any) => {
        if (id === "cat-1") return { id: "cat-1", name: "Comedy" } as any;
        if (id === "cat-2") return { id: "cat-2", name: "Sci-Fi" } as any;
        return null;
      }) as any);

      const result = await advanceWeekRoundAction("week-1");
      expect(result).toEqual({ success: true });

      // It should choose randomly between cat-1 and cat-2
      expect(db.movieNightWeek.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "week-1" },
          data: expect.objectContaining({
            status: "MOVIE_VOTING",
            selectedCategoryId: expect.stringMatching(/^(cat-1|cat-2)$/),
          }),
        })
      );

      expect(notifyRoundAdvanced).toHaveBeenCalledWith(
        "week-1",
        "CATEGORY_TIEBREAKER_VOTING",
        "MOVIE_VOTING",
        expect.objectContaining({
          winnerName: expect.stringMatching(/^(Comedy|Sci-Fi)$/),
          isRandom: true,
        })
      );
    });

    it("transitions SUBCATEGORY_VOTING to COMPLETED if a movie wins outright", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "SUBCATEGORY_VOTING",
        votes: [
          { round: "ROUND_2_SUB_MOVIE", targetId: "movie-1", userId: "user-1", user: { id: "user-1", isApproved: true } },
          { round: "ROUND_2_SUB_MOVIE", targetId: "movie-1", userId: "user-2", user: { id: "user-2", isApproved: true } },
        ],
      } as any);
      vi.mocked(db.user.findMany).mockResolvedValueOnce([
        { id: "user-1", isApproved: true },
        { id: "user-2", isApproved: true },
      ] as any);
      vi.mocked(db.category.findUnique).mockResolvedValueOnce(null); // not a category
      vi.mocked(db.movie.findUnique).mockResolvedValueOnce({ id: "movie-1", title: "Inception", year: 2010, posterUrl: "poster.jpg" } as any);

      const result = await advanceWeekRoundAction("week-1");
      expect(result).toEqual({ success: true });

      expect(db.movieNightWeek.update).toHaveBeenCalledWith({
        where: { id: "week-1" },
        data: {
          winningMovieId: "movie-1",
          status: "COMPLETED",
        },
      });
      expect(notifyRoundAdvanced).toHaveBeenCalledWith("week-1", "SUBCATEGORY_VOTING", "COMPLETED", {
        winnerName: "Inception",
        winnerYear: 2010,
        winnerPoster: "poster.jpg",
      });
    });

    it("transitions SUBCATEGORY_VOTING to SHORTLIST_VOTING if a subcategory wins outright (tiebreaker)", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "SUBCATEGORY_VOTING",
        votes: [
          { round: "ROUND_2_SUB_MOVIE", targetId: "cat-1", userId: "user-1", user: { id: "user-1", isApproved: true } },
        ],
      } as any);
      vi.mocked(db.user.findMany).mockResolvedValueOnce([
        { id: "user-1", isApproved: true },
      ] as any);
      vi.mocked(db.category.findUnique).mockResolvedValueOnce({ id: "cat-1", name: "Classic Sci-Fi" } as any); // is category

      const result = await advanceWeekRoundAction("week-1");
      expect(result).toEqual({ success: true });

      expect(db.movieNightWeek.update).toHaveBeenCalledWith({
        where: { id: "week-1" },
        data: {
          status: "SHORTLIST_VOTING",
        },
      });
      expect(notifyRoundAdvanced).toHaveBeenCalledWith("week-1", "SUBCATEGORY_VOTING", "SHORTLIST_VOTING", {
        winnerName: "Classic Sci-Fi",
      });
    });

    it("transitions SUBCATEGORY_VOTING to SUBCATEGORY_TIEBREAKER_VOTING if a subcategory ties in tiebreaker mode", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "SUBCATEGORY_VOTING",
        votes: [
          { round: "ROUND_2_SUB_MOVIE", targetId: "movie-1", userId: "user-1", user: { id: "user-1", isApproved: true } },
          { round: "ROUND_2_SUB_MOVIE", targetId: "cat-1", userId: "user-2", user: { id: "user-2", isApproved: true } },
        ],
      } as any);
      vi.mocked(db.user.findMany).mockResolvedValueOnce([
        { id: "user-1", isApproved: true },
        { id: "user-2", isApproved: true },
      ] as any);
      vi.mocked(db.category.findMany).mockResolvedValueOnce([{ name: "Classic Sci-Fi" }] as any);
      vi.mocked(db.movie.findMany).mockResolvedValueOnce([{ title: "Inception" }] as any);

      const result = await advanceWeekRoundAction("week-1");
      expect(result).toEqual({ success: true });

      expect(db.movieNightWeek.update).toHaveBeenCalledWith({
        where: { id: "week-1" },
        data: {
          status: "SUBCATEGORY_TIEBREAKER_VOTING",
        },
      });
      expect(notifyRoundAdvanced).toHaveBeenCalledWith("week-1", "SUBCATEGORY_VOTING", "SUBCATEGORY_TIEBREAKER_VOTING", {
        tiedItems: ["Classic Sci-Fi", "Inception"],
      });
    });

    it("transitions SUBCATEGORY_VOTING to SHORTLIST_VOTING if only movies tie", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "SUBCATEGORY_VOTING",
        votes: [
          { round: "ROUND_2_SUB_MOVIE", targetId: "movie-1", userId: "user-1", user: { id: "user-1", isApproved: true } },
          { round: "ROUND_2_SUB_MOVIE", targetId: "movie-2", userId: "user-2", user: { id: "user-2", isApproved: true } },
        ],
      } as any);
      vi.mocked(db.user.findMany).mockResolvedValueOnce([
        { id: "user-1", isApproved: true },
        { id: "user-2", isApproved: true },
      ] as any);
      vi.mocked(db.category.findMany).mockResolvedValueOnce([]);
      vi.mocked(db.movie.findMany).mockResolvedValueOnce([{ title: "Inception" }, { title: "Interstellar" }] as any);

      const result = await advanceWeekRoundAction("week-1");
      expect(result).toEqual({ success: true });

      expect(db.movieNightWeek.update).toHaveBeenCalledWith({
        where: { id: "week-1" },
        data: {
          status: "SHORTLIST_VOTING",
        },
      });
    });

    it("transitions SUBCATEGORY_TIEBREAKER_VOTING to COMPLETED if a movie wins Round 2c outright", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "SUBCATEGORY_TIEBREAKER_VOTING",
        votes: [
          { round: "ROUND_2C_SUB_MOVIE", targetId: "movie-1", userId: "user-1", user: { id: "user-1", isApproved: true } },
          { round: "ROUND_2C_SUB_MOVIE", targetId: "movie-1", userId: "user-2", user: { id: "user-2", isApproved: true } },
        ],
      } as any);
      vi.mocked(db.user.findMany).mockResolvedValueOnce([
        { id: "user-1", isApproved: true },
        { id: "user-2", isApproved: true },
      ] as any);
      vi.mocked(db.category.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.movie.findUnique).mockResolvedValueOnce({ title: "Inception", year: 2010 } as any);

      const result = await advanceWeekRoundAction("week-1");
      expect(result).toEqual({ success: true });

      expect(db.movieNightWeek.update).toHaveBeenCalledWith({
        where: { id: "week-1" },
        data: {
          winningMovieId: "movie-1",
          isRandomlyChosen: false,
          status: "COMPLETED",
        },
      });
    });

    it("transitions SUBCATEGORY_TIEBREAKER_VOTING to SHORTLIST_VOTING if a subcategory wins Round 2c", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "SUBCATEGORY_TIEBREAKER_VOTING",
        votes: [
          { round: "ROUND_2C_SUB_MOVIE", targetId: "cat-1", userId: "user-1", user: { id: "user-1", isApproved: true } },
          { round: "ROUND_2C_SUB_MOVIE", targetId: "cat-1", userId: "user-2", user: { id: "user-2", isApproved: true } },
        ],
      } as any);
      vi.mocked(db.user.findMany).mockResolvedValueOnce([
        { id: "user-1", isApproved: true },
        { id: "user-2", isApproved: true },
      ] as any);
      vi.mocked(db.category.findUnique).mockResolvedValueOnce({ id: "cat-1", name: "Classic Sci-Fi" } as any);

      const result = await advanceWeekRoundAction("week-1");
      expect(result).toEqual({ success: true });

      expect(db.movieNightWeek.update).toHaveBeenCalledWith({
        where: { id: "week-1" },
        data: {
          selectedSubcategoryId: "cat-1",
          status: "SHORTLIST_VOTING",
        },
      });
    });

    it("delegates to advanceInPersonWeekRound if week is in-person", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "IN_PERSON_VOTING",
        isInPerson: true,
        votes: [],
      } as any);

      const result = await advanceWeekRoundAction("week-1");
      expect(result).toEqual({ success: false, error: "No votes have been cast yet." });
    });
  });
});
