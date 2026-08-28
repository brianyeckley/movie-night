// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MovieVotingFormClient,
  ShortlistVotingFormClient,
  FinalVotingFormClient,
  CategoryTiebreakerVotingFormClient,
} from "@/components/VotingFormClient";
import InPersonVotingForm from "@/components/InPersonVotingForm";
import {
  submitMovieVotesAction,
  submitShortlistVotesAction,
  submitFinalVoteAction,
  submitCategoryTiebreakerVotesAction,
} from "@/app/actions";
import { submitInPersonVotesAction } from "@/app/actions/inPersonVoting";
import type { Category, MovieWithGenres } from "@/lib/types";

vi.mock("@/app/actions", () => ({
  submitCategoryVoteAction: vi.fn().mockResolvedValue(undefined),
  submitMovieVotesAction: vi.fn().mockResolvedValue(undefined),
  submitSubMovieVotesAction: vi.fn().mockResolvedValue(undefined),
  submitShortlistVotesAction: vi.fn().mockResolvedValue(undefined),
  submitFinalVoteAction: vi.fn().mockResolvedValue(undefined),
  submitCategoryTiebreakerVotesAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/app/actions/inPersonVoting", () => ({
  submitInPersonVotesAction: vi.fn().mockResolvedValue(undefined),
}));

function movie(id: string, title: string): MovieWithGenres {
  return {
    id,
    title,
    imdbUrl: null,
    trailerUrl: null,
    year: 1999,
    director: null,
    stars: null,
    runtime: null,
    plot: null,
    posterUrl: null,
    imdbRating: null,
    watched: false,
    physical4K: false,
    physicalBluRay: false,
    physicalDvd: false,
    categoryId: "cat-1",
    createdAt: new Date(),
    genres: [],
  } as MovieWithGenres;
}

function category(id: string, name: string): Category {
  return {
    id,
    name,
    isThemed: false,
    isActive: true,
    parentId: null,
    createdAt: new Date(),
  } as Category;
}

const MOVIES = [movie("m1", "Alien"), movie("m2", "Brazil"), movie("m3", "Cube")];

beforeEach(() => vi.clearAllMocks());

describe("Round 2 - movie voting", () => {
  it("submits the chosen movies", async () => {
    render(
      <MovieVotingFormClient
        weekId="week-1"
        movies={MOVIES}
        subcategories={[]}
        initialVotes={[]}
      />
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /Alien/ }));
    await userEvent.click(screen.getByRole("button", { name: /Cast Votes/ }));

    await waitFor(() =>
      expect(submitMovieVotesAction).toHaveBeenCalledWith("week-1", ["m1"])
    );
  });

  it("stops the user at the round's 2-vote limit", async () => {
    render(
      <MovieVotingFormClient
        weekId="week-1"
        movies={MOVIES}
        subcategories={[]}
        initialVotes={[]}
      />
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /Alien/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Brazil/ }));

    const third = screen.getByRole("checkbox", { name: /Cube/ }) as HTMLInputElement;
    expect(third.disabled).toBe(true);
  });

  it("offers a tied subcategory alongside the movies", async () => {
    render(
      <MovieVotingFormClient
        weekId="week-1"
        movies={[movie("m1", "Alien")]}
        subcategories={[category("sub-1", "Van Damme")]}
        initialVotes={[]}
      />
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /Van Damme/ }));
    await userEvent.click(screen.getByRole("button", { name: /Cast Votes/ }));

    await waitFor(() =>
      expect(submitMovieVotesAction).toHaveBeenCalledWith("week-1", ["sub-1"])
    );
  });
});

describe("Round 3 - shortlist voting", () => {
  it("allows three picks on an open shortlist", async () => {
    render(
      <ShortlistVotingFormClient
        weekId="week-1"
        movies={MOVIES}
        initialVotes={[]}
        maxVotes={3}
      />
    );

    for (const name of [/Alien/, /Brazil/, /Cube/]) {
      await userEvent.click(screen.getByRole("checkbox", { name }));
    }
    await userEvent.click(
      screen.getByRole("button", { name: /Cast Shortlist Votes/ })
    );

    await waitFor(() =>
      expect(submitShortlistVotesAction).toHaveBeenCalledWith("week-1", [
        "m1",
        "m2",
        "m3",
      ])
    );
  });

  // A subcategory shortlist is a single pick, so it renders as radios.
  it("renders radios and swaps the pick when limited to one", async () => {
    render(
      <ShortlistVotingFormClient
        weekId="week-1"
        movies={MOVIES}
        initialVotes={[]}
        maxVotes={1}
      />
    );

    await userEvent.click(screen.getByRole("radio", { name: /Alien/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Cube/ }));
    await userEvent.click(
      screen.getByRole("button", { name: /Cast Shortlist Votes/ })
    );

    await waitFor(() =>
      expect(submitShortlistVotesAction).toHaveBeenCalledWith("week-1", ["m3"])
    );
  });
});

describe("Round 4 - final tiebreaker", () => {
  it("submits a single movie id", async () => {
    render(
      <FinalVotingFormClient weekId="week-1" movies={MOVIES} initialVoteId={null} />
    );

    await userEvent.click(screen.getByRole("radio", { name: /Brazil/ }));
    await userEvent.click(screen.getByRole("button", { name: /Cast Final Vote/ }));

    await waitFor(() =>
      expect(submitFinalVoteAction).toHaveBeenCalledWith("week-1", "m2")
    );
  });

  it("pre-selects the user's existing vote and labels the button as an update", () => {
    render(
      <FinalVotingFormClient weekId="week-1" movies={MOVIES} initialVoteId="m2" />
    );

    expect((screen.getByRole("radio", { name: /Brazil/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("button", { name: /Update Final Vote/ })).toBeDefined();
  });
});

describe("Round 1b - category tiebreaker", () => {
  it("caps the user at two categories", async () => {
    render(
      <CategoryTiebreakerVotingFormClient
        weekId="week-1"
        categories={[
          category("c1", "Horror"),
          category("c2", "Comedy"),
          category("c3", "Action"),
        ]}
        initialVotes={[]}
      />
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /Horror/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Comedy/ }));
    expect(
      (screen.getByRole("checkbox", { name: /Action/ }) as HTMLInputElement).disabled
    ).toBe(true);

    await userEvent.click(
      screen.getByRole("button", { name: /Cast Tiebreaker Votes/ })
    );
    await waitFor(() =>
      expect(submitCategoryTiebreakerVotesAction).toHaveBeenCalledWith("week-1", [
        "c1",
        "c2",
      ])
    );
  });
});

describe("In-person rounds", () => {
  it("allows up to three picks in Round 1", async () => {
    render(
      <InPersonVotingForm
        weekId="week-1"
        movies={MOVIES}
        initialVotes={[]}
        maxVotes={3}
      />
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /Alien/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Cube/ }));
    await userEvent.click(
      screen.getByRole("button", { name: /Cast In Person Votes/ })
    );

    await waitFor(() =>
      expect(submitInPersonVotesAction).toHaveBeenCalledWith("week-1", ["m1", "m3"])
    );
  });

  it("becomes a single-choice tiebreaker when limited to one", async () => {
    render(
      <InPersonVotingForm
        weekId="week-1"
        movies={MOVIES}
        initialVotes={[]}
        maxVotes={1}
      />
    );

    await userEvent.click(screen.getByRole("radio", { name: /Alien/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Brazil/ }));
    await userEvent.click(
      screen.getByRole("button", { name: /Cast Tiebreaker Vote/ })
    );

    await waitFor(() =>
      expect(submitInPersonVotesAction).toHaveBeenCalledWith("week-1", ["m2"])
    );
  });
});
