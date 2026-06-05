"use client";

import { useState, useTransition } from "react";
import { submitMovieVotesAction, submitSubMovieVotesAction, submitShortlistVotesAction } from "@/app/actions";
import TrailerButton from "@/components/TrailerButton";

// ======================================================================
// 1. Movie & Subcategory Voting Form (Round 2)
// ======================================================================
interface MovieVotingFormClientProps {
  weekId: string;
  movies: any[];
  subcategories: any[];
  initialVotes: string[];
}

export function MovieVotingFormClient({
  weekId,
  movies,
  subcategories,
  initialVotes,
}: MovieVotingFormClientProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialVotes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const maxVotes = 2;
  const isLimitReached = selectedIds.length >= maxVotes;

  const handleCheckboxChange = (id: string, checked: boolean) => {
    setError(null);
    if (checked) {
      if (selectedIds.length < maxVotes) {
        setSelectedIds((prev) => [...prev, id]);
      }
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError("⚠️ Please select at least one option before casting your votes.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await submitMovieVotesAction(weekId, selectedIds);
      } catch (err) {
        console.error("Failed to submit votes:", err);
        setError("Failed to submit votes. Please try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex-col gap-md">
      {/* Subcategories */}
      {subcategories.map((sub) => {
        const isChecked = selectedIds.includes(sub.id);
        const isDisabled = isLimitReached && !isChecked;
        return (
          <label
            key={sub.id}
            className={`voting-card items-center gap-md ${isChecked ? "checked" : ""} ${isDisabled ? "disabled" : "enabled"}`}
          >
            <input
              type="checkbox"
              checked={isChecked}
              disabled={isDisabled || isPending}
              onChange={(e) => handleCheckboxChange(sub.id, e.target.checked)}
              className="vote-checkbox"
            />
            <div className="flex-col">
              <span className="font-bold text-lg">📂 {sub.name} (Subcategory)</span>
              <span className="text-sm-alt text-secondary">
                Triggers an additional voting round for movies in this subcategory if selected
              </span>
            </div>
          </label>
        );
      })}

      {/* Movies */}
      {movies.map((movie) => {
        const isChecked = selectedIds.includes(movie.id);
        const isDisabled = isLimitReached && !isChecked;
        return (
          <div
            key={movie.id}
            className={`movie-row-card text-left ${isChecked ? "checked" : ""} ${isDisabled ? "disabled" : ""}`}
          >
            <div className="flex-row justify-between items-start flex-wrap gap-md">
              <label
                className={`flex-row items-center gap-md flex-1 min-w-250 ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled || isPending}
                  onChange={(e) => handleCheckboxChange(movie.id, e.target.checked)}
                  className="vote-checkbox"
                />
                <div className="flex-col gap-xs">
                  <div className="flex-row items-center gap-sm-plus flex-wrap">
                    <span className="font-semibold">{movie.title}{movie.year ? ` (${movie.year})` : ""}</span>
                    {(movie.plot || movie.posterUrl) && (
                      <span className="movie-tooltip-trigger btn-plot">
                        🍿 Plot
                        <span className="movie-tooltip-card">
                          {movie.posterUrl && (
                            <img
                              src={movie.posterUrl}
                              alt={`${movie.title} Poster`}
                              className="tooltip-poster"
                            />
                          )}
                          <div className="flex-1 flex-col gap-xs">
                            <div className="flex-row justify-between items-baseline w-full gap-sm">
                              <span className="font-bold text-md text-primary-var">{movie.title}</span>
                              {movie.imdbRating && (
                                <span className="text-sm-alt text-warning-color font-semibold flex-shrink-0">
                                  ⭐ {movie.imdbRating}/10
                                </span>
                              )}
                            </div>
                            {movie.plot && (
                              <p className="tooltip-plot">
                                {movie.plot}
                              </p>
                            )}
                          </div>
                        </span>
                      </span>
                    )}
                    {movie.imdbRating && (
                      <span className="badge-rating">
                        ⭐ {movie.imdbRating}
                      </span>
                    )}
                  </div>

                  {(movie.director || movie.runtime || movie.stars) && (
                    <div className="text-sm text-secondary flex-col gap-xxs mt-xxs">
                      {(movie.director || movie.runtime) && (
                        <div className="flex-row gap-sm items-center flex-wrap">
                          {movie.director && <span>🎬 <span className="text-muted">Dir:</span> {movie.director}</span>}
                          {movie.director && movie.runtime && <span className="text-glass-border">•</span>}
                          {movie.runtime && <span>⏱️ {movie.runtime}</span>}
                        </div>
                      )}
                      {movie.stars && (
                        <div className="flex-row gap-xs items-baseline">
                          <span className="text-muted flex-shrink-0">👥 Cast:</span>
                          <span className="text-secondary">{movie.stars}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </label>

              <div className="flex-col items-end gap-sm flex-shrink-0">
                {movie.genres && movie.genres.length > 0 && (
                  <div className="flex-row gap-xs">
                    {movie.genres.map((g: any) => (
                      <span key={g.id} className="badge-genre">
                        #{g.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex-row gap-sm items-center mt-xs">
                  {movie.trailerUrl && <TrailerButton trailerUrl={movie.trailerUrl} />}
                  {movie.imdbUrl && (
                    <a
                      href={movie.imdbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-color underline"
                    >
                      IMDb ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {error && (
        <div className="vote-error mt-xs">
          {error}
        </div>
      )}

      <button type="submit" disabled={isPending} className="btn btn-primary mt-sm">
        {isPending ? "Submitting Votes..." : initialVotes.length > 0 ? "Update Votes" : "Cast Votes"}
      </button>
    </form>
  );
}

// ======================================================================
// 2. Subcategory Movie Voting Form (Round 2b)
// ======================================================================
interface SubcategoryVotingFormClientProps {
  weekId: string;
  movies: any[];
  initialVotes: string[];
}

export function SubcategoryVotingFormClient({
  weekId,
  movies,
  initialVotes,
}: SubcategoryVotingFormClientProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialVotes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const maxVotes = 2;
  const isLimitReached = selectedIds.length >= maxVotes;

  const handleCheckboxChange = (id: string, checked: boolean) => {
    setError(null);
    if (checked) {
      if (selectedIds.length < maxVotes) {
        setSelectedIds((prev) => [...prev, id]);
      }
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError("⚠️ Please select at least one movie before casting your votes.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await submitSubMovieVotesAction(weekId, selectedIds);
      } catch (err) {
        console.error("Failed to submit sub-movie votes:", err);
        setError("Failed to submit votes. Please try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex-col gap-md">
      {movies.map((movie) => {
        const isChecked = selectedIds.includes(movie.id);
        const isDisabled = isLimitReached && !isChecked;
        return (
          <div
            key={movie.id}
            className={`movie-row-card text-left ${isChecked ? "checked" : ""} ${isDisabled ? "disabled" : ""}`}
          >
            <div className="flex-row justify-between items-start flex-wrap gap-md">
              <label
                className={`flex-row items-center gap-md flex-1 min-w-250 ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled || isPending}
                  onChange={(e) => handleCheckboxChange(movie.id, e.target.checked)}
                  className="vote-checkbox"
                />
                <div className="flex-col gap-xs">
                  <div className="flex-row items-center gap-sm-plus flex-wrap">
                    <span className="font-semibold">{movie.title}{movie.year ? ` (${movie.year})` : ""}</span>
                    {(movie.plot || movie.posterUrl) && (
                      <span className="movie-tooltip-trigger btn-plot">
                        🍿 Plot
                        <span className="movie-tooltip-card">
                          {movie.posterUrl && (
                            <img
                              src={movie.posterUrl}
                              alt={`${movie.title} Poster`}
                              className="tooltip-poster"
                            />
                          )}
                          <div className="flex-1 flex-col gap-xs">
                            <div className="flex-row justify-between items-baseline w-full gap-sm">
                              <span className="font-bold text-md text-primary-var">{movie.title}</span>
                              {movie.imdbRating && (
                                <span className="text-sm-alt text-warning-color font-semibold flex-shrink-0">
                                  ⭐ {movie.imdbRating}/10
                                </span>
                              )}
                            </div>
                            {movie.plot && (
                              <p className="tooltip-plot">
                                {movie.plot}
                              </p>
                            )}
                          </div>
                        </span>
                      </span>
                    )}
                    {movie.imdbRating && (
                      <span className="badge-rating">
                        ⭐ {movie.imdbRating}
                      </span>
                    )}
                  </div>

                  {(movie.director || movie.runtime || movie.stars) && (
                    <div className="text-sm text-secondary flex-col gap-xxs mt-xxs">
                      {(movie.director || movie.runtime) && (
                        <div className="flex-row gap-sm items-center flex-wrap">
                          {movie.director && <span>🎬 <span className="text-muted">Dir:</span> {movie.director}</span>}
                          {movie.director && movie.runtime && <span className="text-glass-border">•</span>}
                          {movie.runtime && <span>⏱️ {movie.runtime}</span>}
                        </div>
                      )}
                      {movie.stars && (
                        <div className="flex-row gap-xs items-baseline">
                          <span className="text-muted flex-shrink-0">👥 Cast:</span>
                          <span className="text-secondary">{movie.stars}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </label>

              <div className="flex-col items-end gap-sm flex-shrink-0">
                {movie.genres && movie.genres.length > 0 && (
                  <div className="flex-row gap-xs">
                    {movie.genres.map((g: any) => (
                      <span key={g.id} className="badge-genre">
                        #{g.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex-row gap-sm items-center mt-xs">
                  {movie.trailerUrl && <TrailerButton trailerUrl={movie.trailerUrl} />}
                  {movie.imdbUrl && (
                    <a
                      href={movie.imdbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-color underline"
                    >
                      IMDb ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {error && (
        <div className="vote-error mt-xs">
          {error}
        </div>
      )}

      <button type="submit" disabled={isPending} className="btn btn-primary mt-sm">
        {isPending ? "Submitting Votes..." : initialVotes.length > 0 ? "Update Subcategory Votes" : "Cast Subcategory Votes"}
      </button>
    </form>
  );
}

// ======================================================================
// 3. Shortlist Movie Voting Form (Round 3)
// ======================================================================
interface ShortlistVotingFormClientProps {
  weekId: string;
  movies: any[];
  initialVotes: string[];
}

export function ShortlistVotingFormClient({
  weekId,
  movies,
  initialVotes,
}: ShortlistVotingFormClientProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialVotes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const maxVotes = 3;
  const isLimitReached = selectedIds.length >= maxVotes;

  const handleCheckboxChange = (id: string, checked: boolean) => {
    setError(null);
    if (checked) {
      if (selectedIds.length < maxVotes) {
        setSelectedIds((prev) => [...prev, id]);
      }
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError("⚠️ Please select at least one movie before casting your votes.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await submitShortlistVotesAction(weekId, selectedIds);
      } catch (err) {
        console.error("Failed to submit shortlist votes:", err);
        setError("Failed to submit votes. Please try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex-col gap-md">
      {movies.map((movie) => {
        const isChecked = selectedIds.includes(movie.id);
        const isDisabled = isLimitReached && !isChecked;
        return (
          <div
            key={movie.id}
            className={`movie-row-card text-left ${isChecked ? "checked" : ""} ${isDisabled ? "disabled" : ""}`}
          >
            <div className="flex-row justify-between items-start flex-wrap gap-md">
              <label
                className={`flex-row items-center gap-md flex-1 min-w-250 ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled || isPending}
                  onChange={(e) => handleCheckboxChange(movie.id, e.target.checked)}
                  className="vote-checkbox"
                />
                <div className="flex-col gap-xs">
                  <div className="flex-row items-center gap-sm-plus flex-wrap">
                    <span className="font-semibold">{movie.title}{movie.year ? ` (${movie.year})` : ""}</span>
                    {(movie.plot || movie.posterUrl) && (
                      <span className="movie-tooltip-trigger btn-plot">
                        🍿 Plot
                        <span className="movie-tooltip-card">
                          {movie.posterUrl && (
                            <img
                              src={movie.posterUrl}
                              alt={`${movie.title} Poster`}
                              className="tooltip-poster"
                            />
                          )}
                          <div className="flex-1 flex-col gap-xs">
                            <div className="flex-row justify-between items-baseline w-full gap-sm">
                              <span className="font-bold text-md text-primary-var">{movie.title}</span>
                              {movie.imdbRating && (
                                <span className="text-sm-alt text-warning-color font-semibold flex-shrink-0">
                                  ⭐ {movie.imdbRating}/10
                                </span>
                              )}
                            </div>
                            {movie.plot && (
                              <p className="tooltip-plot">
                                {movie.plot}
                              </p>
                            )}
                          </div>
                        </span>
                      </span>
                    )}
                    {movie.imdbRating && (
                      <span className="badge-rating">
                        ⭐ {movie.imdbRating}
                      </span>
                    )}
                  </div>

                  {(movie.director || movie.runtime || movie.stars) && (
                    <div className="text-sm text-secondary flex-col gap-xxs mt-xxs">
                      {(movie.director || movie.runtime) && (
                        <div className="flex-row gap-sm items-center flex-wrap">
                          {movie.director && <span>🎬 <span className="text-muted">Dir:</span> {movie.director}</span>}
                          {movie.director && movie.runtime && <span className="text-glass-border">•</span>}
                          {movie.runtime && <span>⏱️ {movie.runtime}</span>}
                        </div>
                      )}
                      {movie.stars && (
                        <div className="flex-row gap-xs items-baseline">
                          <span className="text-muted flex-shrink-0">👥 Cast:</span>
                          <span className="text-secondary">{movie.stars}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </label>

              <div className="flex-col items-end gap-sm flex-shrink-0">
                {movie.genres && movie.genres.length > 0 && (
                  <div className="flex-row gap-xs">
                    {movie.genres.map((g: any) => (
                      <span key={g.id} className="badge-genre">
                        #{g.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex-row gap-sm items-center mt-xs">
                  {movie.trailerUrl && <TrailerButton trailerUrl={movie.trailerUrl} />}
                  {movie.imdbUrl && (
                    <a
                      href={movie.imdbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-color underline"
                    >
                      IMDb ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {error && (
        <div className="vote-error mt-xs">
          {error}
        </div>
      )}

      <button type="submit" disabled={isPending} className="btn btn-primary mt-sm">
        {isPending ? "Submitting Votes..." : initialVotes.length > 0 ? "Update Shortlist Votes" : "Cast Shortlist Votes"}
      </button>
    </form>
  );
}
