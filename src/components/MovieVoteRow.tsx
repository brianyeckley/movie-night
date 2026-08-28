"use client";

import TrailerButton from "@/components/TrailerButton";
import type { MovieWithGenres } from "@/lib/types";

interface MovieVoteRowProps {
  movie: MovieWithGenres;
  /** Radio for single-choice rounds, checkbox where several picks are allowed. */
  mode: "checkbox" | "radio";
  checked: boolean;
  disabled: boolean;
  /** Radio group name. Required by the browser to group radios in a round. */
  name?: string;
  onToggle: (checked: boolean) => void;
  onShowPlot: (movie: MovieWithGenres) => void;
}

/**
 * One selectable movie in a voting round: the control, the title and credits,
 * its media/genre badges, and links out to the trailer and IMDb.
 *
 * Every voting round renders this same row, so keep round-specific wording out
 * of it - the surrounding form owns the heading, the limits and the button.
 */
export default function MovieVoteRow({
  movie,
  mode,
  checked,
  disabled,
  name,
  onToggle,
  onShowPlot,
}: MovieVoteRowProps) {
  const hasCredits = movie.director || movie.runtime || movie.stars;

  return (
    <div
      className={`movie-row-card text-left ${checked ? "checked" : ""} ${
        disabled ? "disabled" : ""
      }`}
    >
      <div className="flex-row justify-between items-start flex-wrap gap-md">
        <label
          className={`flex-row items-center gap-md flex-1 min-w-250 ${
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          <input
            type={mode}
            name={name}
            value={movie.id}
            checked={checked}
            disabled={disabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="vote-checkbox"
          />
          <div className="flex-col gap-xs">
            <div className="flex-row items-center gap-sm-plus flex-wrap">
              <span className="font-semibold">
                {movie.title}
                {movie.year ? ` (${movie.year})` : ""}
              </span>
              {(movie.plot || movie.posterUrl) && (
                <button
                  type="button"
                  onClick={() => onShowPlot(movie)}
                  className="btn-plot"
                >
                  🍿 Plot
                </button>
              )}
              {movie.imdbRating && (
                <span className="badge-rating">⭐ {movie.imdbRating}</span>
              )}
            </div>

            {hasCredits && (
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
            {movie.genres.map((g) => (
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
}
