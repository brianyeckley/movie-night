// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LeaderboardView from "@/components/LeaderboardView";
import type { LeaderboardData } from "@/lib/stats";

// Reached via PlotModal; pulls in the server action barrel, which reaches
// next/headers. The leaderboard never enables the button anyway.
vi.mock("@/components/AddToLegacyButton", () => ({
  default: () => null,
}));

const mockLeaderboardData: LeaderboardData = {
  tastemakers: [
    {
      user: { id: "u1", name: "Brian", username: "brian", role: "ADMIN" },
      totalWins: 5,
      weeksParticipated: 10,
      winRate: 50,
      winningMovies: [],
    },
  ],
  kingmaker: null,
  kingmakersList: [],
  filmSnob: null,
  filmSnobsList: [],
  dynamicDuo: null,
  globalStats: {
    totalWeeks: 10,
    totalWatchTimeMinutes: 1000,
    formattedWatchTime: "16h 40m",
    averageRating: 7.2,
    topGenre: { name: "Comedy", count: 3 },
    longestMovie: null,
    shortestMovie: null,
    highestRatedMovie: null,
    physicalMedia: { fourK: 1, bluRay: 2, dvd: 0, digitalOnly: 1 },
  },
  mostNominatedNonWinners: [
    {
      movie: {
        id: "m-smoochy",
        title: "Death to Smoochy",
        year: 2002,
        imdbUrl: null,
        trailerUrl: null,
        director: "Danny DeVito",
        stars: "Robin Williams, Edward Norton",
        runtime: "109 min",
        plot: "A disgraced children's television host seeks revenge.",
        posterUrl: "https://example.com/smoochy.jpg",
        imdbRating: "6.4",
        watched: false,
        physical4K: false,
        physicalBluRay: true,
        physicalDvd: false,
        categoryId: "cat-1",
        category: { id: "cat-1", name: "Dark Comedy", isThemed: false, isActive: true, parentId: null, createdAt: new Date() },
        genres: [{ id: "g-1", name: "Comedy", createdAt: new Date() }],
        createdAt: new Date(),
      },
      nominationCount: 4,
      weeksNominatedCount: 4,
      weeks: [
        { weekNumber: 3, nominators: ["Stew"] },
        { weekNumber: 5, nominators: ["Stew"] },
        { weekNumber: 8, nominators: ["Stew"] },
        { weekNumber: 10, nominators: ["Stew"] },
      ],
      totalVotesCount: 6,
    },
    {
      movie: {
        id: "m-stripes",
        title: "Stripes",
        year: 1981,
        imdbUrl: null,
        trailerUrl: null,
        director: "Ivan Reitman",
        stars: "Bill Murray, Harold Ramis",
        runtime: "106 min",
        plot: "Two friends who are dissatisfied with their jobs join the army.",
        posterUrl: null,
        imdbRating: "6.8",
        watched: false,
        physical4K: false,
        physicalBluRay: false,
        physicalDvd: true,
        categoryId: "cat-1",
        category: { id: "cat-1", name: "Comedy", isThemed: false, isActive: true, parentId: null, createdAt: new Date() },
        genres: [{ id: "g-1", name: "Comedy", createdAt: new Date() }],
        createdAt: new Date(),
      },
      nominationCount: 2,
      weeksNominatedCount: 2,
      weeks: [
        { weekNumber: 5, nominators: ["Nick"] },
        { weekNumber: 8, nominators: ["Nick"] },
      ],
      totalVotesCount: 5,
    },
  ],
};

describe("LeaderboardView", () => {
  it("renders the Most Nominated Non-Winners chart and displays contenders", () => {
    render(<LeaderboardView data={mockLeaderboardData} />);

    // Check heading
    expect(screen.getByText("Most Nominated Non-Winners")).toBeDefined();
    expect(screen.getByText("Uncrowned Contenders Standings")).toBeDefined();

    // Check contender titles
    expect(screen.getByText("Death to Smoochy")).toBeDefined();
    expect(screen.getByText("Stripes")).toBeDefined();

    // Check nomination counts
    expect(screen.getByText("4 nominations")).toBeDefined();
    expect(screen.getByText("2 nominations")).toBeDefined();

    // Check weeks counts
    expect(screen.getByText("4 wks")).toBeDefined();
    expect(screen.getByText("2 wks")).toBeDefined();
  });

  it("toggles the breakdown drawer when clicking details", () => {
    render(<LeaderboardView data={mockLeaderboardData} />);

    // Initially breakdown is hidden
    expect(screen.queryByText(/Nominated by users 4 times across 4 weeks/i)).toBeNull();

    // Find and click the Details button for Death to Smoochy
    const detailButtons = screen.getAllByRole("button", { name: /Details/i });
    fireEvent.click(detailButtons[0]);

    // Now breakdown should be visible
    expect(screen.getByText(/Nominated by users 4 times across 4 weeks/i)).toBeDefined();
    expect(screen.getByText("Week #3")).toBeDefined();
    expect(screen.getByText("Week #10")).toBeDefined();

    // Toggle hide
    const hideButtons = screen.getAllByRole("button", { name: /Hide/i });
    fireEvent.click(hideButtons[0]);
    expect(screen.queryByText(/Nominated by users 4 times across 4 weeks/i)).toBeNull();
  });
});
