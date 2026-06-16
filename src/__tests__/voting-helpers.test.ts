import { vi, describe, it, expect, beforeEach } from "vitest";
import { 
  getCategoryTiebreakerCategories, 
  getShortlistMovies, 
  getFinalTiebreakerMovies 
} from "@/lib/voting-helpers";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: {
    weekVote: {
      findMany: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
    movie: {
      findMany: vi.fn(),
    },
  },
}));

describe("Voting Data Compilation Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCategoryTiebreakerCategories", () => {
    it("returns categories tied in Round 1 and filters out unapproved votes", async () => {
      vi.mocked(db.weekVote.findMany).mockResolvedValueOnce([
        { targetId: "cat-1", user: { id: "user-1", isApproved: true } },
        { targetId: "cat-2", user: { id: "user-2", isApproved: true } },
        { targetId: "cat-2", user: { id: "user-3", isApproved: false } }, // unapproved, should be ignored!
      ] as any);

      vi.mocked(db.category.findMany).mockResolvedValueOnce([
        { id: "cat-1", name: "Comedy" },
        { id: "cat-2", name: "Sci-Fi" },
      ] as any);

      const result = await getCategoryTiebreakerCategories("week-1");

      // Since the unapproved vote for cat-2 is ignored, both cat-1 and cat-2 have exactly 1 approved vote, resulting in a tie!
      expect(db.category.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["cat-1", "cat-2"] } },
        orderBy: { name: "asc" },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe("getShortlistMovies", () => {
    it("compiles movies tied in Round 2 and subcategory selections in Round 2b", async () => {
      // Mock Round 2 votes (cat-3 subcategory and movie-1 are tied with 1 approved vote each)
      vi.mocked(db.weekVote.findMany).mockImplementation(async ({ where }: any) => {
        if (where.round === "ROUND_2_MOVIE") {
          return [
            { targetId: "cat-3", user: { id: "user-1", isApproved: true } }, // Subcategory
            { targetId: "movie-1", user: { id: "user-2", isApproved: true } }, // Movie
          ] as any;
        }
        if (where.round === "ROUND_2_SUB_MOVIE") {
          return [
            { targetId: "movie-2", user: { id: "user-1", isApproved: true } },
          ] as any;
        }
        return [];
      });

      vi.mocked(db.category.findMany).mockResolvedValueOnce([
        { id: "cat-3", name: "Silly Horror" },
      ] as any);

      vi.mocked(db.movie.findMany).mockResolvedValueOnce([
        { id: "movie-1", title: "Shaun of the Dead" },
        { id: "movie-2", title: "Evil Dead 2" },
      ] as any);

      const result = await getShortlistMovies("week-1", "cat-horror", "cat-3");

      // Should check categories and determine that cat-3 was a tied category, while movie-1 is a movie.
      expect(db.category.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["cat-3", "movie-1"] } },
      });

      // Should load final shortlist movies (movie-1 from tied R2, and movie-2 from R2b subcategory win)
      expect(db.movie.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["movie-1", "movie-2"] } },
        include: { genres: true, category: true },
      });

      expect(result).toHaveLength(2);
    });
  });

  describe("getFinalTiebreakerMovies", () => {
    it("returns movies tied in the shortlist round (Round 3)", async () => {
      vi.mocked(db.weekVote.findMany).mockResolvedValueOnce([
        { targetId: "movie-1", user: { id: "user-1", isApproved: true } },
        { targetId: "movie-2", user: { id: "user-2", isApproved: true } },
      ] as any);

      vi.mocked(db.movie.findMany).mockResolvedValueOnce([
        { id: "movie-1", title: "Shaun of the Dead" },
        { id: "movie-2", title: "Evil Dead 2" },
      ] as any);

      const result = await getFinalTiebreakerMovies("week-1");

      expect(db.movie.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["movie-1", "movie-2"] } },
        include: { genres: true, category: true },
      });
      expect(result).toHaveLength(2);
    });
  });
});
