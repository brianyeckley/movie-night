import { vi, describe, it, expect, beforeEach } from "vitest";
import { resetRoundAction, advanceWeekRoundAction } from "@/app/actions/week";
import { db } from "@/lib/db";
import { getActiveUser } from "@/app/actions/user";
import { notifyRoundAdvanced } from "@/lib/discord";
import { revalidatePath } from "next/cache";

vi.mock("@/lib/db", () => ({
  db: {
    movieNightWeek: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    weekVote: {
      deleteMany: vi.fn(),
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
  const mockAdmin = { id: "admin-1", username: "brian", name: "Brian", role: "ADMIN", isApproved: true };
  const mockUser = { id: "user-1", username: "stew", name: "Stew", role: "USER", isApproved: true };

  beforeEach(() => {
    vi.clearAllMocks();
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
      vi.mocked(db.category.findUnique).mockImplementation(async ({ where: { id } }: any) => {
        if (id === "cat-1") return { id: "cat-1", name: "Comedy" } as any;
        if (id === "cat-2") return { id: "cat-2", name: "Sci-Fi" } as any;
        return null;
      });

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
  });
});
