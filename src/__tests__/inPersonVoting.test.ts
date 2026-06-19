import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  submitInPersonVotesAction,
  submitInPersonTiebreakerVoteAction,
  advanceInPersonWeekRound,
} from "@/app/actions/inPersonVoting";
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
    movie: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    weekVote: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/discord", () => ({
  notifyRoundAdvanced: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/app/actions/user", () => ({
  getActiveUser: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("In-Person Voting Server Actions", () => {
  const mockUser = {
    id: "user-1",
    username: "stew",
    name: "Stew",
    passwordHash: "",
    role: "USER",
    isApproved: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("submitInPersonVotesAction", () => {
    it("throws if no user is active", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(null);
      await expect(
        submitInPersonVotesAction("week-1", ["movie-1"])
      ).rejects.toThrow("You must pick a user first.");
    });

    it("throws if week is not found", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce(null);
      await expect(
        submitInPersonVotesAction("week-1", ["movie-1"])
      ).rejects.toThrow("Week not found.");
    });

    it("throws if week status is not IN_PERSON_VOTING", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "CATEGORY_VOTING",
      } as any);
      await expect(
        submitInPersonVotesAction("week-1", ["movie-1"])
      ).rejects.toThrow("Voting is not open for this round.");
    });

    it("throws if movieIds is empty or length > 3", async () => {
      vi.mocked(getActiveUser).mockResolvedValue(mockUser);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValue({
        id: "week-1",
        status: "IN_PERSON_VOTING",
      } as any);

      await expect(
        submitInPersonVotesAction("week-1", [])
      ).rejects.toThrow("You can select between 1 and 3 movies.");

      await expect(
        submitInPersonVotesAction("week-1", ["m1", "m2", "m3", "m4"])
      ).rejects.toThrow("You can select between 1 and 3 movies.");
    });

    it("deletes existing votes and creates new votes", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "IN_PERSON_VOTING",
      } as any);

      const result = await submitInPersonVotesAction("week-1", ["movie-1", "movie-2"]);
      expect(result).toEqual({ success: true });

      expect(db.weekVote.deleteMany).toHaveBeenCalledWith({
        where: {
          weekId: "week-1",
          userId: "user-1",
          round: "IN_PERSON_ROUND_1",
        },
      });

      expect(db.weekVote.createMany).toHaveBeenCalledWith({
        data: [
          { weekId: "week-1", userId: "user-1", round: "IN_PERSON_ROUND_1", targetId: "movie-1" },
          { weekId: "week-1", userId: "user-1", round: "IN_PERSON_ROUND_1", targetId: "movie-2" },
        ],
      });

      expect(revalidatePath).toHaveBeenCalledWith("/");
    });
  });

  describe("submitInPersonTiebreakerVoteAction", () => {
    it("throws if week status is not IN_PERSON_TIEBREAKER", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "IN_PERSON_VOTING",
      } as any);

      await expect(
        submitInPersonTiebreakerVoteAction("week-1", "movie-1")
      ).rejects.toThrow("Voting is not open for this round.");
    });

    it("throws if movieId is empty", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "IN_PERSON_TIEBREAKER",
      } as any);

      await expect(
        submitInPersonTiebreakerVoteAction("week-1", "")
      ).rejects.toThrow("Please select a movie.");
    });

    it("saves tiebreaker vote correctly", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({
        id: "week-1",
        status: "IN_PERSON_TIEBREAKER",
      } as any);

      const result = await submitInPersonTiebreakerVoteAction("week-1", "movie-1");
      expect(result).toEqual({ success: true });

      expect(db.weekVote.deleteMany).toHaveBeenCalledWith({
        where: {
          weekId: "week-1",
          userId: "user-1",
          round: "IN_PERSON_ROUND_1B",
        },
      });

      expect(db.weekVote.create).toHaveBeenCalledWith({
        data: {
          weekId: "week-1",
          userId: "user-1",
          round: "IN_PERSON_ROUND_1B",
          targetId: "movie-1",
        },
      });
    });
  });

  describe("advanceInPersonWeekRound", () => {
    it("throws error if week not found", async () => {
      vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce(null);
      const result = await advanceInPersonWeekRound("week-1");
      expect(result).toEqual({ success: false, error: "Week not found." });
    });

    it("returns error if no votes cast in Round 1", async () => {
      const weekMock = {
        id: "week-1",
        status: "IN_PERSON_VOTING",
        votes: [],
      };
      const result = await advanceInPersonWeekRound("week-1", weekMock);
      expect(result).toEqual({ success: false, error: "No votes have been cast yet." });
    });

    it("transitions IN_PERSON_VOTING to IN_PERSON_TIEBREAKER on tie", async () => {
      const weekMock = {
        id: "week-1",
        status: "IN_PERSON_VOTING",
        votes: [
          { round: "IN_PERSON_ROUND_1", targetId: "movie-1", user: { isApproved: true, name: "Stew" } },
          { round: "IN_PERSON_ROUND_1", targetId: "movie-2", user: { isApproved: true, name: "Brian" } },
        ],
      };

      vi.mocked(db.movie.findMany).mockResolvedValueOnce([
        { title: "The Thing" },
        { title: "Alien" },
      ] as any);

      const result = await advanceInPersonWeekRound("week-1", weekMock);
      expect(result).toEqual({ success: true });

      expect(db.movieNightWeek.update).toHaveBeenCalledWith({
        where: { id: "week-1" },
        data: { status: "IN_PERSON_TIEBREAKER" },
      });

      expect(notifyRoundAdvanced).toHaveBeenCalledWith("week-1", "IN_PERSON_VOTING", "IN_PERSON_TIEBREAKER", {
        tiedItems: ["The Thing", "Alien"],
      });
    });

    it("transitions IN_PERSON_VOTING to COMPLETED on outright winner", async () => {
      const weekMock = {
        id: "week-1",
        status: "IN_PERSON_VOTING",
        votes: [
          { round: "IN_PERSON_ROUND_1", targetId: "movie-1", user: { isApproved: true, name: "Stew" } },
          { round: "IN_PERSON_ROUND_1", targetId: "movie-1", user: { isApproved: true, name: "Brian" } },
        ],
      };

      vi.mocked(db.movie.findUnique).mockResolvedValueOnce({
        id: "movie-1",
        title: "The Thing",
        year: 1982,
        posterUrl: "https://example.com/poster.jpg",
      } as any);

      const result = await advanceInPersonWeekRound("week-1", weekMock);
      expect(result).toEqual({ success: true });

      expect(db.movieNightWeek.update).toHaveBeenCalledWith({
        where: { id: "week-1" },
        data: {
          winningMovieId: "movie-1",
          status: "COMPLETED",
        },
      });

      expect(notifyRoundAdvanced).toHaveBeenCalledWith("week-1", "IN_PERSON_VOTING", "COMPLETED", {
        winnerName: "The Thing",
        winnerYear: 1982,
        winnerPoster: "https://example.com/poster.jpg",
      });
    });

    it("transitions IN_PERSON_TIEBREAKER to COMPLETED with outright winner", async () => {
      const weekMock = {
        id: "week-1",
        status: "IN_PERSON_TIEBREAKER",
        votes: [
          { round: "IN_PERSON_ROUND_1B", targetId: "movie-1", user: { isApproved: true, name: "Stew" } },
          { round: "IN_PERSON_ROUND_1B", targetId: "movie-1", user: { isApproved: true, name: "Brian" } },
        ],
      };

      vi.mocked(db.movie.findUnique).mockResolvedValueOnce({
        id: "movie-1",
        title: "The Thing",
        year: 1982,
        posterUrl: "https://example.com/poster.jpg",
      } as any);

      const result = await advanceInPersonWeekRound("week-1", weekMock);
      expect(result).toEqual({ success: true });

      expect(db.movieNightWeek.update).toHaveBeenCalledWith({
        where: { id: "week-1" },
        data: {
          winningMovieId: "movie-1",
          isRandomlyChosen: false,
          status: "COMPLETED",
        },
      });

      expect(notifyRoundAdvanced).toHaveBeenCalledWith("week-1", "IN_PERSON_TIEBREAKER", "COMPLETED", {
        winnerName: "The Thing",
        winnerYear: 1982,
        winnerPoster: "https://example.com/poster.jpg",
        isRandom: false,
      });
    });

    it("transitions IN_PERSON_TIEBREAKER to COMPLETED with random winner on persistent tie", async () => {
      const weekMock = {
        id: "week-1",
        status: "IN_PERSON_TIEBREAKER",
        votes: [
          { round: "IN_PERSON_ROUND_1B", targetId: "movie-1", user: { isApproved: true, name: "Stew" } },
          { round: "IN_PERSON_ROUND_1B", targetId: "movie-2", user: { isApproved: true, name: "Brian" } },
        ],
      };

      vi.mocked(db.movie.findUnique).mockImplementation((async ({ where: { id } }: any) => {
        return {
          id,
          title: id === "movie-1" ? "The Thing" : "Alien",
          year: 1982,
          posterUrl: "https://example.com/poster.jpg",
        } as any;
      }) as any);

      const result = await advanceInPersonWeekRound("week-1", weekMock);
      expect(result).toEqual({ success: true });

      expect(db.movieNightWeek.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "week-1" },
          data: expect.objectContaining({
            status: "COMPLETED",
            winningMovieId: expect.stringMatching(/^(movie-1|movie-2)$/),
            isRandomlyChosen: true,
          }),
        })
      );

      expect(notifyRoundAdvanced).toHaveBeenCalledWith(
        "week-1",
        "IN_PERSON_TIEBREAKER",
        "COMPLETED",
        expect.objectContaining({
          winnerName: expect.stringMatching(/^(The Thing|Alien)$/),
          isRandom: true,
        })
      );
    });
  });
});
