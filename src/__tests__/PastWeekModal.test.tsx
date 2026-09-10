// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PastWeekModal } from "@/components/PastWeekModal";
import type { PastWeek } from "@/lib/types";

vi.mock("@/components/DeletePastMovieNightButton", () => ({
  default: () => null,
}));

const mockPastWeek: PastWeek = {
  id: "week-8",
  weekNumber: 8,
  status: "COMPLETED",
  themeCategoryId: "cat-comedy",
  themeCategory: {
    id: "cat-comedy",
    name: "Comedy",
    isThemed: true,
    isActive: false,
    parentId: null,
    createdAt: new Date(),
  },
  selectedCategoryId: "cat-comedy",
  selectedSubcategoryId: "sub-broken-lizard",
  winningMovieId: "movie-super-troopers",
  isRandomlyChosen: false,
  isInPerson: false,
  createdAt: new Date("2026-07-26"),
  closedAt: new Date("2026-08-02"),
  winner: {
    id: "movie-super-troopers",
    title: "Super Troopers",
    year: 2001,
    imdbUrl: "https://www.imdb.com/title/tt0247745/",
    trailerUrl: "https://youtube.com/watch?v=supertroopers",
    director: "Jay Chandrasekhar",
    stars: "Jay Chandrasekhar, Kevin Heffernan",
    runtime: "100 min",
    plot: "Five Vermont state troopers, avid pranksters, try to save their jobs.",
    posterUrl: "https://example.com/poster.jpg",
    imdbRating: "7.0",
    watched: true,
    physical4K: false,
    physicalBluRay: true,
    physicalDvd: false,
    categoryId: "sub-broken-lizard",
    category: {
      id: "sub-broken-lizard",
      name: "Broken Lizard",
      isThemed: false,
      isActive: true,
      parentId: "cat-comedy",
      createdAt: new Date(),
    },
    genres: [{ id: "g-1", name: "Comedy", createdAt: new Date() }],
    createdAt: new Date(),
  },
  votingHistory: [
    {
      roundCode: "ROUND_1_CATEGORY",
      title: "Round 1: Category Selection",
      targets: [
        {
          targetId: "cat-comedy",
          name: "Comedy",
          count: 2,
          voters: ["Brian", "Stew"],
        },
      ],
      isTie: false,
      chosenTargetId: null,
    },
    {
      roundCode: "ROUND_2_MOVIE",
      title: "Round 2: Movie Selection",
      targets: [
        {
          targetId: "movie-ace",
          name: "Ace Ventura: Pet Detective",
          count: 1,
          voters: ["Brian"],
        },
        {
          targetId: "movie-stripes",
          name: "Stripes",
          count: 1,
          voters: ["Nick"],
        },
        {
          targetId: "movie-smoochy",
          name: "Death to Smoochy",
          count: 1,
          voters: ["Stew"],
        },
      ],
      isTie: true,
      chosenTargetId: null,
    },
    {
      roundCode: "ROUND_3_SHORTLIST",
      title: "Round 3: Shortlist Selection",
      targets: [
        {
          targetId: "movie-super-troopers",
          name: "Super Troopers",
          count: 3,
          voters: ["Brian", "Nick", "Stew"],
        },
      ],
      isTie: false,
      chosenTargetId: null,
    },
  ],
};

describe("PastWeekModal", () => {
  it("renders week details and winner information", () => {
    render(<PastWeekModal week={mockPastWeek} isAdmin={false} onClose={vi.fn()} />);

    expect(screen.getByText("WEEK #8")).toBeDefined();
    expect(screen.getByText(/Super Troopers/i)).toBeDefined();
    expect(screen.getAllByText(/Jay Chandrasekhar/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/100 min/i)).toBeDefined();
  });

  it("shows voting history toggle and expands/collapses history on click", () => {
    render(<PastWeekModal week={mockPastWeek} isAdmin={false} onClose={vi.fn()} />);

    // Toggle button should be present
    const toggleBtn = screen.getByRole("button", { name: /Voting History \(3 Rounds\)/i });
    expect(toggleBtn).toBeDefined();

    // Before click, round titles should not be visible
    expect(screen.queryByText("Round 1: Category Selection")).toBeNull();
    expect(screen.queryByText("Round 2: Movie Selection")).toBeNull();

    // Click to expand
    fireEvent.click(toggleBtn);

    // After click, rounds and targets should be rendered
    expect(screen.getByText("Round 1: Category Selection")).toBeDefined();
    expect(screen.getByText("Round 2: Movie Selection")).toBeDefined();
    expect(screen.getByText("Round 3: Shortlist Selection")).toBeDefined();
    expect(screen.getAllByText("Comedy").length).toBeGreaterThan(0);
    expect(screen.getByText("Voters: Brian, Stew")).toBeDefined();
    expect(screen.getByText("Voters: Brian, Nick, Stew")).toBeDefined();

    // Click again to collapse
    fireEvent.click(toggleBtn);
    expect(screen.queryByText("Round 1: Category Selection")).toBeNull();
  });
});
