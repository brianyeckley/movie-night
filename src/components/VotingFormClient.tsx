"use client";

import { useState, useTransition } from "react";
import { 
  submitCategoryVoteAction,
  submitMovieVotesAction, 
  submitSubMovieVotesAction, 
  submitShortlistVotesAction,
  submitFinalVoteAction,
  submitCategoryTiebreakerVotesAction
} from "@/app/actions";
import TrailerButton from "@/components/TrailerButton";
import Toast from "@/components/Toast";
import { PlotModal, MoviePlotModalData } from "@/components/PlotModal";

// ======================================================================
// 1. Category Selection Form (Round 1)
// ======================================================================
interface CategoryVotingFormClientProps {
  weekId: string;
  categories: any[];
  initialVoteId: string | null;
}

export function CategoryVotingFormClient({
  weekId,
  categories,
  initialVoteId,
}: CategoryVotingFormClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialVoteId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      setError("⚠️ Please select a category before casting your vote.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await submitCategoryVoteAction(weekId, selectedId);
        setToastMsg("Category vote cast successfully!");
      } catch (err) {
        console.error("Failed to submit category vote:", err);
        setError("Failed to submit vote. Please try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex-col gap-md">
      {categories.map((cat) => (
        <label
          key={cat.id}
          className={`voting-card items-center gap-md ${selectedId === cat.id ? "checked" : ""}`}
        >
          <input
            type="radio"
            name="categoryId"
            value={cat.id}
            checked={selectedId === cat.id}
            disabled={isPending}
            onChange={() => {
              setError(null);
              setSelectedId(cat.id);
            }}
            className="vote-checkbox"
          />
          <div className="flex-col">
            <span className="font-semibold text-lg text-primary-var">{cat.name}</span>
            {cat.isThemed && <span className="text-sm text-accent-color">Current Theme Category</span>}
          </div>
        </label>
      ))}

      {error && (
        <div className="vote-error mt-xs">
          {error}
        </div>
      )}

      <button type="submit" disabled={isPending} className="btn btn-primary mt-md">
        {isPending ? "Submitting Vote..." : initialVoteId ? "Update Category Vote" : "Cast Category Vote"}
      </button>
      <Toast message={toastMsg} onClose={() => setToastMsg(null)} />
    </form>
  );
}

// ======================================================================
// 2. Movie & Subcategory Voting Form (Round 2)
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
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [selectedPlotMovie, setSelectedPlotMovie] = useState<MoviePlotModalData | null>(null);

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
        setToastMsg("Votes cast successfully!");
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
                      <button
                        type="button"
                        onClick={() => setSelectedPlotMovie(movie)}
                        className="btn-plot"
                      >
                        🍿 Plot
                      </button>
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
                <div className="flex-row gap-xs flex-wrap">
                  {movie.physical4K && <span className="badge-media badge-media-4k">4K</span>}
                  {movie.physicalBluRay && <span className="badge-media badge-media-bluray">Blu-ray</span>}
                  {movie.physicalDvd && <span className="badge-media badge-media-dvd">DVD</span>}
                  {movie.genres && movie.genres.length > 0 && movie.genres.map((g: any) => (
                    <span key={g.id} className="badge-genre">
                      #{g.name}
                    </span>
                  ))}
                </div>
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
      <Toast message={toastMsg} onClose={() => setToastMsg(null)} />
      <PlotModal movie={selectedPlotMovie} onClose={() => setSelectedPlotMovie(null)} />
    </form>
  );
}

// ======================================================================
// 3. Subcategory Movie Voting Form (Round 2b)
// ======================================================================
interface SubcategoryVotingFormClientProps {
  weekId: string;
  movies: any[];
  subcategories?: any[];
  initialVotes: string[];
  isTie?: boolean;
  maxVotes?: number;
  roundCode?: string;
}

export function SubcategoryVotingFormClient({
  weekId,
  movies,
  subcategories = [],
  initialVotes,
  isTie = false,
  maxVotes = 3,
  roundCode = "ROUND_2_SUB_MOVIE",
}: SubcategoryVotingFormClientProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialVotes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [selectedPlotMovie, setSelectedPlotMovie] = useState<MoviePlotModalData | null>(null);

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
        await submitSubMovieVotesAction(weekId, selectedIds, roundCode);
        setToastMsg(isTie ? "Tiebreaker votes cast successfully!" : "Subcategory votes cast successfully!");
      } catch (err) {
        console.error("Failed to submit sub-movie votes:", err);
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
                      <button
                        type="button"
                        onClick={() => setSelectedPlotMovie(movie)}
                        className="btn-plot"
                      >
                        🍿 Plot
                      </button>
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
                <div className="flex-row gap-xs flex-wrap">
                  {movie.physical4K && <span className="badge-media badge-media-4k">4K</span>}
                  {movie.physicalBluRay && <span className="badge-media badge-media-bluray">Blu-ray</span>}
                  {movie.physicalDvd && <span className="badge-media badge-media-dvd">DVD</span>}
                  {movie.genres && movie.genres.length > 0 && movie.genres.map((g: any) => (
                    <span key={g.id} className="badge-genre">
                      #{g.name}
                    </span>
                  ))}
                </div>
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
        {isPending
          ? "Submitting Votes..."
          : initialVotes.length > 0
          ? isTie
            ? "Update Tiebreaker Votes"
            : "Update Subcategory Votes"
          : isTie
          ? "Cast Tiebreaker Votes"
          : "Cast Subcategory Votes"}
      </button>
      <Toast message={toastMsg} onClose={() => setToastMsg(null)} />
      <PlotModal movie={selectedPlotMovie} onClose={() => setSelectedPlotMovie(null)} />
    </form>
  );
}

// ======================================================================
// 4. Shortlist Movie Voting Form (Round 3)
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
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [selectedPlotMovie, setSelectedPlotMovie] = useState<MoviePlotModalData | null>(null);

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
        setToastMsg("Shortlist votes cast successfully!");
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
                      <button
                        type="button"
                        onClick={() => setSelectedPlotMovie(movie)}
                        className="btn-plot"
                      >
                        🍿 Plot
                      </button>
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
                <div className="flex-row gap-xs flex-wrap">
                  {movie.physical4K && <span className="badge-media badge-media-4k">4K</span>}
                  {movie.physicalBluRay && <span className="badge-media badge-media-bluray">Blu-ray</span>}
                  {movie.physicalDvd && <span className="badge-media badge-media-dvd">DVD</span>}
                  {movie.genres && movie.genres.length > 0 && movie.genres.map((g: any) => (
                    <span key={g.id} className="badge-genre">
                      #{g.name}
                    </span>
                  ))}
                </div>
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
      <Toast message={toastMsg} onClose={() => setToastMsg(null)} />
      <PlotModal movie={selectedPlotMovie} onClose={() => setSelectedPlotMovie(null)} />
    </form>
  );
}

// ======================================================================
// 5. Final Tiebreaker Selection Form (Round 4)
// ======================================================================
interface FinalVotingFormClientProps {
  weekId: string;
  movies: any[];
  initialVoteId: string | null;
}

export function FinalVotingFormClient({
  weekId,
  movies,
  initialVoteId,
}: FinalVotingFormClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialVoteId);
  const [selectedPlotMovie, setSelectedPlotMovie] = useState<MoviePlotModalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      setError("⚠️ Please select a movie before casting your vote.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await submitFinalVoteAction(weekId, selectedId);
        setToastMsg("Final tiebreaker vote cast successfully!");
      } catch (err) {
        console.error("Failed to submit final vote:", err);
        setError("Failed to submit vote. Please try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex-col gap-md">
      {movies.map((movie: any) => (
        <div
          key={movie.id}
          className={`movie-row-card text-left ${selectedId === movie.id ? "checked" : ""}`}
        >
          <div className="flex-row justify-between items-start flex-wrap gap-md">
            <label
              className="flex-row items-center gap-md flex-1 min-w-250 cursor-pointer"
            >
              <input
                type="radio"
                name="movieId"
                value={movie.id}
                checked={selectedId === movie.id}
                disabled={isPending}
                onChange={() => {
                  setError(null);
                  setSelectedId(movie.id);
                }}
                className="vote-checkbox"
              />
              <div className="flex-col gap-xs">
                <div className="flex-row items-center gap-sm-plus flex-wrap">
                  <span className="font-semibold">{movie.title}{movie.year ? ` (${movie.year})` : ""}</span>
                  {(movie.plot || movie.posterUrl) && (
                    <button
                      type="button"
                      onClick={() => setSelectedPlotMovie(movie)}
                      className="btn-plot"
                    >
                      🍿 Plot
                    </button>
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
              <div className="flex-row gap-xs flex-wrap">
                {movie.physical4K && <span className="badge-media badge-media-4k">4K</span>}
                {movie.physicalBluRay && <span className="badge-media badge-media-bluray">Blu-ray</span>}
                {movie.physicalDvd && <span className="badge-media badge-media-dvd">DVD</span>}
                {movie.genres && movie.genres.length > 0 && movie.genres.map((g: any) => (
                  <span key={g.id} className="badge-genre">
                    #{g.name}
                  </span>
                ))}
              </div>
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
      ))}

      {error && (
        <div className="vote-error mt-xs">
          {error}
        </div>
      )}

      <button type="submit" disabled={isPending} className="btn btn-primary mt-md">
        {isPending ? "Submitting Vote..." : initialVoteId ? "Update Final Vote" : "Cast Final Vote"}
      </button>
      <Toast message={toastMsg} onClose={() => setToastMsg(null)} />
      <PlotModal movie={selectedPlotMovie} onClose={() => setSelectedPlotMovie(null)} />
    </form>
  );
}

// ======================================================================
// 6. Category Tiebreaker Selection Form (Round 1b)
// ======================================================================
interface CategoryTiebreakerVotingFormClientProps {
  weekId: string;
  categories: any[];
  initialVotes: string[];
}

export function CategoryTiebreakerVotingFormClient({
  weekId,
  categories,
  initialVotes,
}: CategoryTiebreakerVotingFormClientProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialVotes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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
        await submitCategoryTiebreakerVotesAction(weekId, selectedIds);
        setToastMsg("Tiebreaker votes cast successfully!");
      } catch (err) {
        console.error("Failed to submit category tiebreaker votes:", err);
        setError("Failed to submit votes. Please try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex-col gap-md">
      {categories.map((cat) => {
        const isChecked = selectedIds.includes(cat.id);
        const isDisabled = isLimitReached && !isChecked;
        return (
          <label
            key={cat.id}
            className={`voting-card items-center gap-md ${isChecked ? "checked" : ""} ${isDisabled ? "disabled" : "enabled"}`}
          >
            <input
              type="checkbox"
              checked={isChecked}
              disabled={isDisabled || isPending}
              onChange={(e) => handleCheckboxChange(cat.id, e.target.checked)}
              className="vote-checkbox"
            />
            <div className="flex-col">
              <span className="font-semibold text-lg text-primary-var">{cat.name}</span>
              {cat.isThemed && <span className="text-sm text-accent-color">Current Theme Category</span>}
            </div>
          </label>
        );
      })}

      {error && (
        <div className="vote-error mt-xs">
          {error}
        </div>
      )}

      <button type="submit" disabled={isPending} className="btn btn-primary mt-sm">
        {isPending ? "Submitting Votes..." : initialVotes.length > 0 ? "Update Tiebreaker Votes" : "Cast Tiebreaker Votes"}
      </button>
      <Toast message={toastMsg} onClose={() => setToastMsg(null)} />
    </form>
  );
}
