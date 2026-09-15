import { vi, describe, it, expect, beforeEach } from "vitest";
import { addThemeAction, deleteThemeAction, addMovieAction, updateMovieAction } from "@/app/actions/catalog";
import { createWeekAction, advanceWeekRoundAction } from "@/app/actions/week";
import { db } from "@/lib/db";
import { getActiveUser } from "@/app/actions/user";
import { fetchMovieMetadata } from "@/lib/imdb";

vi.mock("@/lib/db", () => ({
  db: {
    theme: {
      upsert: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    category: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    movie: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    movieNightWeek: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/app/actions/user", () => ({
  getActiveUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", isApproved: true }),
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", isApproved: true }),
}));

vi.mock("@/lib/imdb", () => ({
  fetchMovieMetadata: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/discord", () => ({
  notifyNewWeek: vi.fn().mockResolvedValue(undefined),
  notifyRoundAdvanced: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Theme Feature & Theme Week Tests", () => {
  const mockAdmin = { id: "admin-1", username: "brian", name: "Brian", passwordHash: "", role: "ADMIN", isApproved: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Theme Management Actions", () => {
    it("addThemeAction creates or revives a theme", async () => {
      vi.mocked(db.theme.upsert).mockResolvedValueOnce({
        id: "theme-1",
        name: "Halloween",
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await addThemeAction("Halloween");
      expect(db.theme.upsert).toHaveBeenCalledWith({
        where: { name: "Halloween" },
        update: { deletedAt: null },
        create: { name: "Halloween" },
      });
      expect(result.name).toBe("Halloween");
    });

    it("deleteThemeAction logically deletes a theme", async () => {
      vi.mocked(db.theme.update).mockResolvedValueOnce({} as any);

      await deleteThemeAction("theme-1");
      expect(db.theme.update).toHaveBeenCalledWith({
        where: { id: "theme-1" },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe("Movie Theme Tagging", () => {
    it("addMovieAction connects specified themeIds", async () => {
      vi.mocked(fetchMovieMetadata).mockResolvedValueOnce({
        title: "Scream",
        year: 1996,
        director: "Wes Craven",
        stars: "Neve Campbell",
        runtime: "111 min",
        plot: "Ghostface arrives",
        posterUrl: "https://poster.jpg",
        imdbRating: 7.3,
      } as any);

      vi.mocked(db.movie.create).mockResolvedValueOnce({
        id: "movie-1",
        title: "Scream",
      } as any);

      await addMovieAction(
        "https://imdb.com/title/tt0117577",
        "cat-other",
        ["genre-horror"],
        "",
        true,
        false,
        false,
        ["theme-halloween", "theme-slasher"]
      );

      expect(db.movie.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: "Scream",
          categoryId: "cat-other",
          themes: {
            connect: [{ id: "theme-halloween" }, { id: "theme-slasher" }],
          },
        }),
      });
    });

    it("updateMovieAction sets updated themeIds", async () => {
      vi.mocked(db.movie.findUnique).mockResolvedValueOnce({
        id: "movie-1",
        title: "Scream",
        imdbUrl: "https://imdb.com/title/tt0117577",
      } as any);
      vi.mocked(db.movie.update).mockResolvedValueOnce({} as any);

      await updateMovieAction(
        "movie-1",
        "Scream (1996)",
        "https://imdb.com/title/tt0117577",
        undefined,
        "cat-other",
        ["genre-horror"],
        true,
        false,
        false,
        ["theme-halloween"]
      );

      expect(db.movie.update).toHaveBeenCalledWith({
        where: { id: "movie-1" },
        data: expect.objectContaining({
          themes: {
            set: [{ id: "theme-halloween" }],
          },
        }),
      });
    });
  });

  describe("Dedicated Theme Week vs Standard Week", () => {
    it("creates a Dedicated Theme Week that bypasses category voting and enters MOVIE_VOTING directly", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findFirst).mockImplementation((async ({ where }: any) => {
        if (where && "closedAt" in where) return null; // No active week
        return { weekNumber: 20 } as any;
      }) as any);

      vi.mocked(db.theme.findFirst).mockResolvedValueOnce({
        id: "theme-christmas",
        name: "Christmas",
      } as any);
      vi.mocked(db.movieNightWeek.create).mockResolvedValueOnce({ id: "week-21" } as any);

      await createWeekAction("Christmas", false, true);

      expect(db.movieNightWeek.create).toHaveBeenCalledWith({
        data: {
          weekNumber: 21,
          status: "MOVIE_VOTING",
          themeId: "theme-christmas",
          selectedThemeId: "theme-christmas",
          isInPerson: false,
        },
      });
    });

    it("creates a Standard Week with theme option in category voting", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findFirst).mockImplementation((async ({ where }: any) => {
        if (where && "closedAt" in where) return null;
        return { weekNumber: 21 } as any;
      }) as any);

      vi.mocked(db.theme.findFirst).mockResolvedValueOnce({
        id: "theme-halloween",
        name: "Halloween",
      } as any);
      vi.mocked(db.movieNightWeek.create).mockResolvedValueOnce({ id: "week-22" } as any);

      await createWeekAction("Halloween", false, false);

      expect(db.movieNightWeek.create).toHaveBeenCalledWith({
        data: {
          weekNumber: 22,
          status: "CATEGORY_VOTING",
          themeId: "theme-halloween",
          selectedThemeId: null,
          isInPerson: false,
        },
      });
    });
  });

  describe("Voting Engine: Round 1 Theme Winner", () => {
    it("sets selectedThemeId when the theme wins Round 1 Category Voting", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-30",
        status: "CATEGORY_VOTING",
        votes: [
          { round: "ROUND_1_CATEGORY", targetId: "theme-halloween", userId: "u-1", user: { id: "u-1", isApproved: true } },
          { round: "ROUND_1_CATEGORY", targetId: "theme-halloween", userId: "u-2", user: { id: "u-2", isApproved: true } },
          { round: "ROUND_1_CATEGORY", targetId: "cat-comedy", userId: "u-3", user: { id: "u-3", isApproved: true } },
        ],
      } as any);
      vi.mocked(db.user.findMany).mockResolvedValueOnce([
        { id: "u-1", isApproved: true },
        { id: "u-2", isApproved: true },
        { id: "u-3", isApproved: true },
      ] as any);
      // Not a category
      vi.mocked(db.category.findUnique).mockResolvedValueOnce(null);
      // It is a theme
      vi.mocked(db.theme.findUnique).mockResolvedValueOnce({
        id: "theme-halloween",
        name: "Halloween",
      } as any);

      const res = await advanceWeekRoundAction("week-30");
      expect(res).toEqual({ success: true });

      expect(db.movieNightWeek.update).toHaveBeenCalledWith({
        where: { id: "week-30" },
        data: {
          selectedThemeId: "theme-halloween",
          selectedCategoryId: null,
          status: "MOVIE_VOTING",
        },
      });
    });

    it("sets selectedCategoryId when a category wins Round 1 Category Voting", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockAdmin);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-31",
        status: "CATEGORY_VOTING",
        votes: [
          { round: "ROUND_1_CATEGORY", targetId: "cat-comedy", userId: "u-1", user: { id: "u-1", isApproved: true } },
          { round: "ROUND_1_CATEGORY", targetId: "cat-comedy", userId: "u-2", user: { id: "u-2", isApproved: true } },
        ],
      } as any);
      vi.mocked(db.user.findMany).mockResolvedValueOnce([
        { id: "u-1", isApproved: true },
        { id: "u-2", isApproved: true },
      ] as any);
      // Is a category
      vi.mocked(db.category.findUnique).mockResolvedValueOnce({
        id: "cat-comedy",
        name: "Comedy",
      } as any);

      const res = await advanceWeekRoundAction("week-31");
      expect(res).toEqual({ success: true });

      expect(db.movieNightWeek.update).toHaveBeenCalledWith({
        where: { id: "week-31" },
        data: {
          selectedCategoryId: "cat-comedy",
          selectedThemeId: null,
          status: "MOVIE_VOTING",
        },
      });
    });
  });
});
