"use client";

import { useState, useTransition } from "react";
import { submitInPersonVotesAction, submitInPersonTiebreakerVoteAction } from "@/app/actions/inPersonVoting";
import TrailerButton from "@/components/TrailerButton";
import Toast from "@/components/Toast";

interface InPersonVotingFormProps {
  weekId: string;
  movies: any[];
  initialVotes: string[];
  isTiebreaker: boolean;
}

export default function InPersonVotingForm({
  weekId,
  movies,
  initialVotes,
  isTiebreaker,
}: InPersonVotingFormProps) {
  // If tiebreaker, initialVotes will contain at most 1 item.
  const [selectedIds, setSelectedIds] = useState<string[]>(initialVotes);
  const [radioSelectedId, setRadioSelectedId] = useState<string | null>(
    isTiebreaker && initialVotes.length > 0 ? initialVotes[0] : null
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const maxVotes = 3;
  const isLimitReached = selectedIds.length >= maxVotes;

  const handleCheckboxChange = (movieId: string, checked: boolean) => {
    setError(null);
    if (checked) {
      if (selectedIds.length < maxVotes) {
        setSelectedIds((prev) => [...prev, movieId]);
      }
    } else {
      setSelectedIds((prev) => prev.filter((id) => id !== movieId));
    }
  };

  const handleRadioChange = (movieId: string) => {
    setError(null);
    setRadioSelectedId(movieId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isTiebreaker) {
      if (!radioSelectedId) {
        setError("⚠️ Please select a movie before casting your tiebreaker vote.");
        return;
      }
      setError(null);
      startTransition(async () => {
        try {
          await submitInPersonTiebreakerVoteAction(weekId, radioSelectedId);
          setToastMsg("Tiebreaker vote cast successfully!");
        } catch (err: any) {
          console.error("Failed to submit in-person tiebreaker vote:", err);
          setError(err.message || "Failed to submit vote. Please try again.");
        }
      });
    } else {
      if (selectedIds.length === 0) {
        setError("⚠️ Please select at least one movie before casting your votes.");
        return;
      }
      setError(null);
      startTransition(async () => {
        try {
          await submitInPersonVotesAction(weekId, selectedIds);
          setToastMsg("Votes cast successfully!");
        } catch (err: any) {
          console.error("Failed to submit in-person votes:", err);
          setError(err.message || "Failed to submit votes. Please try again.");
        }
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-col gap-md">
      {movies.map((movie) => {
        const isChecked = isTiebreaker
          ? radioSelectedId === movie.id
          : selectedIds.includes(movie.id);
        const isDisabled = !isTiebreaker && isLimitReached && !isChecked;

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
                  type={isTiebreaker ? "radio" : "checkbox"}
                  name={isTiebreaker ? "inPersonMovieTie" : undefined}
                  checked={isChecked}
                  disabled={isDisabled || isPending}
                  onChange={(e) =>
                    isTiebreaker
                      ? handleRadioChange(movie.id)
                      : handleCheckboxChange(movie.id, e.target.checked)
                  }
                  className="vote-checkbox"
                />
                <div className="flex-col gap-xs">
                  <div className="flex-row items-center gap-sm-plus flex-wrap">
                    <span className="font-semibold">
                      {movie.title}
                      {movie.year ? ` (${movie.year})` : ""}
                    </span>
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
                              <span className="font-bold text-md text-primary-var">
                                {movie.title}
                              </span>
                              {movie.imdbRating && (
                                <span className="text-sm-alt text-warning-color font-semibold flex-shrink-0">
                                  ⭐ {movie.imdbRating}/10
                                </span>
                              )}
                            </div>
                            {movie.plot && (
                              <p className="tooltip-plot">{movie.plot}</p>
                            )}
                          </div>
                        </span>
                      </span>
                    )}
                    {movie.imdbRating && (
                      <span className="badge-rating">⭐ {movie.imdbRating}</span>
                    )}
                  </div>

                  {(movie.director || movie.runtime || movie.stars) && (
                    <div className="text-sm text-secondary flex-col gap-xxs mt-xxs">
                      {(movie.director || movie.runtime) && (
                        <div className="flex-row gap-sm items-center flex-wrap">
                          {movie.director && (
                            <span>
                              🎬 <span className="text-muted">Dir:</span>{" "}
                              {movie.director}
                            </span>
                          )}
                          {movie.director && movie.runtime && (
                            <span className="text-glass-border">•</span>
                          )}
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
                  {movie.physical4K && (
                    <span className="badge-media badge-media-4k">4K</span>
                  )}
                  {movie.physicalBluRay && (
                    <span className="badge-media badge-media-bluray">Blu-ray</span>
                  )}
                  {movie.physicalDvd && (
                    <span className="badge-media badge-media-dvd">DVD</span>
                  )}
                  {movie.genres && movie.genres.length > 0 && (
                    <div className="flex-row gap-xs">
                      {movie.genres.map((g: any) => (
                        <span key={g.id} className="badge-genre">
                          #{g.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-row gap-sm items-center mt-xs">
                  {movie.trailerUrl && (
                    <TrailerButton trailerUrl={movie.trailerUrl} />
                  )}
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

      {error && <div className="vote-error mt-xs">{error}</div>}

      <button type="submit" disabled={isPending} className="btn btn-primary mt-sm">
        {isPending
          ? "Submitting Vote..."
          : isTiebreaker
          ? "Cast Tiebreaker Vote"
          : "Cast In Person Votes"}
      </button>
      <Toast message={toastMsg} onClose={() => setToastMsg(null)} />
    </form>
  );
}
