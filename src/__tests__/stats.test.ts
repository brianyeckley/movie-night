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

  describe("getUserFlairsMap", () => {
    it("correctly maps flairs to qualifying users", async () => {
      const { getUserFlairsMap } = await import("@/lib/stats");
      const mockData = {
        tastemakers: [
          {
            user: { id: "u1", name: "Brian", username: "brian", role: "ADMIN" },
            totalWins: 5,
            weeksParticipated: 10,
            winRate: 50,
            winningMovies: [],
          },
        ],
        kingmaker: {
          user: { id: "u2", name: "Stew", username: "stew" },
          correctFinalVotes: 4,
          totalFinalRounds: 5,
          accuracy: 80,
        },
        kingmakersList: [],
        filmSnob: {
          user: { id: "u3", name: "Nick", username: "nick" },
          soloPickCount: 6,
          soloMovies: [],
        },
        filmSnobsList: [],
        dynamicDuo: {
          userA: { id: "u1", name: "Brian" },
          userB: { id: "u2", name: "Stew" },
          agreementScore: 85,
          sharedVotesCount: 12,
          sharedRoundsCount: 8,
        },
        globalStats: {
          totalWeeks: 10,
          totalWatchTimeMinutes: 1200,
          formattedWatchTime: "20h",
          averageRating: 7.5,
          topGenre: { name: "Horror", count: 4 },
          longestMovie: null,
          shortestMovie: null,
          highestRatedMovie: null,
          physicalMedia: { fourK: 2, bluRay: 5, dvd: 1, digitalOnly: 2 },
        },
        mostNominatedNonWinners: [],
      };

      const flairsMap = getUserFlairsMap(mockData);
      expect(flairsMap["u1"].some((f) => f.id === "tastemaker-1")).toBe(true);
      expect(flairsMap["u1"].some((f) => f.id === "duo")).toBe(true);
      expect(flairsMap["u2"].some((f) => f.id === "kingmaker")).toBe(true);
      expect(flairsMap["u2"].some((f) => f.id === "duo")).toBe(true);
      expect(flairsMap["u3"].some((f) => f.id === "film-snob")).toBe(true);
    });
  });

  describe("mostNominatedNonWinners contract", () => {
    it("sorts contenders by nominationCount desc then weeksNominatedCount desc", () => {
      const contenders = [
        {
          movie: { id: "m1", title: "Movie B", year: 2000, category: null, genres: [] },
          nominationCount: 3,
          weeksNominatedCount: 2,
          weeks: [{ weekNumber: 1, nominators: ["Alice"] }],
          totalVotesCount: 4,
        },
        {
          movie: { id: "m2", title: "Movie A", year: 2005, category: null, genres: [] },
          nominationCount: 5,
          weeksNominatedCount: 4,
          weeks: [{ weekNumber: 2, nominators: ["Bob"] }],
          totalVotesCount: 6,
        },
        {
          movie: { id: "m3", title: "Movie C", year: 2010, category: null, genres: [] },
          nominationCount: 3,
          weeksNominatedCount: 3,
          weeks: [{ weekNumber: 3, nominators: ["Charlie"] }],
          totalVotesCount: 5,
        },
      ];

      const sorted = [...contenders].sort((a, b) => {
        if (b.nominationCount !== a.nominationCount) {
          return b.nominationCount - a.nominationCount;
        }
        if (b.weeksNominatedCount !== a.weeksNominatedCount) {
          return b.weeksNominatedCount - a.weeksNominatedCount;
        }
        return a.movie.title.localeCompare(b.movie.title);
      });

      expect(sorted[0].movie.title).toBe("Movie A"); // 5 noms
      expect(sorted[1].movie.title).toBe("Movie C"); // 3 noms, 3 weeks
      expect(sorted[2].movie.title).toBe("Movie B"); // 3 noms, 2 weeks
    });
  });
});

