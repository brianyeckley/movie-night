// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MovieVoteRow from "@/components/MovieVoteRow";
import type { MovieWithGenres } from "@/lib/types";

function makeMovie(overrides: Partial<MovieWithGenres> = {}): MovieWithGenres {
  return {
    id: "movie-1",
    title: "The Thing",
    imdbUrl: "https://www.imdb.com/title/tt0084787/",
    trailerUrl: null,
    year: 1982,
    director: "John Carpenter",
    stars: "Kurt Russell",
    runtime: "109 min",
    plot: "A research team in Antarctica.",
    posterUrl: null,
    imdbRating: "8.2",
    watched: false,
    physical4K: true,
    physicalBluRay: false,
    physicalDvd: false,
    categoryId: "cat-1",
    createdAt: new Date(),
    genres: [{ id: "g1", name: "Horror", createdAt: new Date() }],
    ...overrides,
  } as MovieWithGenres;
}

const noop = () => {};

describe("MovieVoteRow", () => {
  it("shows the title, year, credits and rating", () => {
    render(
      <MovieVoteRow
        movie={makeMovie()}
        mode="checkbox"
        checked={false}
        disabled={false}
        onToggle={noop}
        onShowPlot={noop}
      />
    );

    expect(screen.getByText(/The Thing \(1982\)/)).toBeDefined();
    expect(screen.getByText(/John Carpenter/)).toBeDefined();
    expect(screen.getByText(/109 min/)).toBeDefined();
    expect(screen.getByText(/Kurt Russell/)).toBeDefined();
    expect(screen.getByText(/8\.2/)).toBeDefined();
  });

  it("renders a checkbox or a radio according to mode", () => {
    const { unmount } = render(
      <MovieVoteRow
        movie={makeMovie()}
        mode="checkbox"
        checked={false}
        disabled={false}
        onToggle={noop}
        onShowPlot={noop}
      />
    );
    expect(screen.getByRole("checkbox")).toBeDefined();
    unmount();

    render(
      <MovieVoteRow
        movie={makeMovie()}
        mode="radio"
        name="movieId"
        checked={false}
        disabled={false}
        onToggle={noop}
        onShowPlot={noop}
      />
    );
    expect(screen.getByRole("radio")).toBeDefined();
  });

  it("reports the new checked state when toggled", async () => {
    const onToggle = vi.fn();
    render(
      <MovieVoteRow
        movie={makeMovie()}
        mode="checkbox"
        checked={false}
        disabled={false}
        onToggle={onToggle}
        onShowPlot={noop}
      />
    );

    await userEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("does not fire when disabled", async () => {
    const onToggle = vi.fn();
    render(
      <MovieVoteRow
        movie={makeMovie()}
        mode="checkbox"
        checked={false}
        disabled
        onToggle={onToggle}
        onShowPlot={noop}
      />
    );

    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.disabled).toBe(true);
    await userEvent.click(box);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("offers the plot button only when there is a plot or poster", () => {
    const { unmount } = render(
      <MovieVoteRow
        movie={makeMovie({ plot: null, posterUrl: null })}
        mode="checkbox"
        checked={false}
        disabled={false}
        onToggle={noop}
        onShowPlot={noop}
      />
    );
    expect(screen.queryByRole("button", { name: /Plot/ })).toBeNull();
    unmount();

    render(
      <MovieVoteRow
        movie={makeMovie()}
        mode="checkbox"
        checked={false}
        disabled={false}
        onToggle={noop}
        onShowPlot={noop}
      />
    );
    expect(screen.getByRole("button", { name: /Plot/ })).toBeDefined();
  });

  it("hands the movie back when the plot button is pressed", async () => {
    const onShowPlot = vi.fn();
    const movie = makeMovie();
    render(
      <MovieVoteRow
        movie={movie}
        mode="checkbox"
        checked={false}
        disabled={false}
        onToggle={noop}
        onShowPlot={onShowPlot}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /Plot/ }));
    expect(onShowPlot).toHaveBeenCalledWith(movie);
  });

  it("shows only the physical formats the movie actually has", () => {
    render(
      <MovieVoteRow
        movie={makeMovie({ physical4K: true, physicalBluRay: true, physicalDvd: false })}
        mode="checkbox"
        checked={false}
        disabled={false}
        onToggle={noop}
        onShowPlot={noop}
      />
    );

    expect(screen.getByText("4K")).toBeDefined();
    expect(screen.getByText("Blu-ray")).toBeDefined();
    expect(screen.queryByText("DVD")).toBeNull();
  });

  it("omits the credits block entirely when there are no credits", () => {
    render(
      <MovieVoteRow
        movie={makeMovie({ director: null, runtime: null, stars: null })}
        mode="checkbox"
        checked={false}
        disabled={false}
        onToggle={noop}
        onShowPlot={noop}
      />
    );

    expect(screen.queryByText(/Dir:/)).toBeNull();
    expect(screen.queryByText(/Cast:/)).toBeNull();
  });
});
