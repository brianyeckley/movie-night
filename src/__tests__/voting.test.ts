import { vi, describe, it, expect, beforeEach } from "vitest";
import { 
  submitCategoryVoteAction, 
  submitMovieVotesAction, 
  submitSubMovieVotesAction, 
  submitShortlistVotesAction, 
  submitFinalVoteAction,
  submitCategoryTiebreakerVotesAction
} from "@/app/actions/voting";
import { db } from "@/lib/db";
import { getActiveUser } from "@/app/actions/user";
import { revalidatePath } from "next/cache";

vi.mock("@/lib/db", () => ({
  db: {
    weekVote: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/app/actions/user", () => ({
  getActiveUser: vi.fn(),
}));

describe("Voting Server Actions", () => {
  const mockUser = { id: "user-1", username: "brian", name: "Brian", passwordHash: "", role: "USER", isApproved: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("submitCategoryVoteAction", () => {
    it("throws an error if no user is active", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(null);
      await expect(submitCategoryVoteAction("week-1", "cat-1")).rejects.toThrow("You must pick a user first.");
    });

    it("deletes previous votes and creates a new vote", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);

      await submitCategoryVoteAction("week-1", "cat-1");

      expect(db.weekVote.deleteMany).toHaveBeenCalledWith({
        where: {
          weekId: "week-1",
          userId: "user-1",
          round: "ROUND_1_CATEGORY",
        },
      });

      expect(db.weekVote.create).toHaveBeenCalledWith({
        data: {
          weekId: "week-1",
          userId: "user-1",
          round: "ROUND_1_CATEGORY",
          targetId: "cat-1",
        },
      });

      expect(revalidatePath).toHaveBeenCalledWith("/");
    });
  });

  describe("submitCategoryTiebreakerVotesAction", () => {
    it("throws an error if no user is active", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(null);
      await expect(submitCategoryTiebreakerVotesAction("week-1", ["cat-1"])).rejects.toThrow("You must pick a user first.");
    });

    it("throws an error if selecting more than 2 categories", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      await expect(submitCategoryTiebreakerVotesAction("week-1", ["cat-1", "cat-2", "cat-3"])).rejects.toThrow(
        "You can select a maximum of 2 categories."
      );
    });

    it("submits category tiebreaker votes correctly", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);

      await submitCategoryTiebreakerVotesAction("week-1", ["cat-1", "cat-2"]);

      expect(db.weekVote.deleteMany).toHaveBeenCalledWith({
        where: {
          weekId: "week-1",
          userId: "user-1",
          round: "ROUND_1_CATEGORY_TIEBREAKER",
        },
      });

      expect(db.weekVote.create).toHaveBeenCalledTimes(2);
      expect(db.weekVote.create).toHaveBeenNthCalledWith(1, {
        data: {
          weekId: "week-1",
          userId: "user-1",
          round: "ROUND_1_CATEGORY_TIEBREAKER",
          targetId: "cat-1",
        },
      });
      expect(db.weekVote.create).toHaveBeenNthCalledWith(2, {
        data: {
          weekId: "week-1",
          userId: "user-1",
          round: "ROUND_1_CATEGORY_TIEBREAKER",
          targetId: "cat-2",
        },
      });

      expect(revalidatePath).toHaveBeenCalledWith("/");
    });
  });

  describe("submitMovieVotesAction", () => {
    it("throws an error if selecting more than 2 movies", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      await expect(submitMovieVotesAction("week-1", ["movie-1", "movie-2", "movie-3"])).rejects.toThrow(
        "You can select a maximum of 2 options."
      );
    });

    it("submits movie votes correctly", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);

      await submitMovieVotesAction("week-1", ["movie-1"]);

      expect(db.weekVote.deleteMany).toHaveBeenCalledWith({
        where: {
          weekId: "week-1",
          userId: "user-1",
          round: "ROUND_2_MOVIE",
        },
      });

      expect(db.weekVote.create).toHaveBeenCalledWith({
        data: {
          weekId: "week-1",
          userId: "user-1",
          round: "ROUND_2_MOVIE",
          targetId: "movie-1",
        },
      });
    });
  });

  describe("submitSubMovieVotesAction", () => {
    it("throws an error if selecting more than 2 movies", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      await expect(submitSubMovieVotesAction("week-1", ["movie-1", "movie-2", "movie-3"])).rejects.toThrow(
        "You can select a maximum of 2 movies."
      );
    });
  });

  describe("submitShortlistVotesAction", () => {
    it("throws an error if selecting more than 3 movies", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      await expect(submitShortlistVotesAction("week-1", ["movie-1", "movie-2", "movie-3", "movie-4"])).rejects.toThrow(
        "You can select a maximum of 3 movies."
      );
    });
  });

  describe("submitFinalVoteAction", () => {
    it("submits a final tiebreaker vote", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);

      await submitFinalVoteAction("week-1", "movie-1");

      expect(db.weekVote.deleteMany).toHaveBeenCalledWith({
        where: {
          weekId: "week-1",
          userId: "user-1",
          round: "ROUND_4_TIEBREAKER",
        },
      });

      expect(db.weekVote.create).toHaveBeenCalledWith({
        data: {
          weekId: "week-1",
          userId: "user-1",
          round: "ROUND_4_TIEBREAKER",
          targetId: "movie-1",
        },
      });
    });
  });
});
