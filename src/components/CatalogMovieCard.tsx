"use client";

import { Clapperboard, ExternalLink, Popcorn, Star, Timer, Users } from "lucide-react";
import TrailerButton from "@/components/TrailerButton";
import EditMovieButton from "@/components/EditMovieButton";
import type { MovieWithGenres } from "@/lib/types";

interface CatalogMovieCardProps {
  movie: MovieWithGenres;
  /** Flat category list for the edit dialog's parent dropdown. */
  categories: { id: string; name: string; parentId: string | null }[];
  genres: { id: string; name: string }[];
  /** Removal cascades, so only admins get the control. */
  isAdmin: boolean;
  isPending: boolean;
  onShowPlot: (movie: MovieWithGenres) => void;
  onRemove: (movie: MovieWithGenres) => void;
}

/**
 * A movie as listed in the catalog, whether it sits directly under a category
 * or inside one of its subcategories.
 */
export default function CatalogMovieCard({
  movie,
  categories,
  genres,
  isAdmin,
  isPending,
  onShowPlot,
  onRemove,
}: CatalogMovieCardProps) {
  const hasCredits = movie.director || movie.runtime || movie.stars;

  return (
    <div className="movie-row-card">
      <div className="movie-card-header">
        <div className="movie-card-title-group">
          <span className="movie-card-title">
            {movie.title}
            {movie.year ? (
              <span className="movie-card-year"> ({movie.year})</span>
            ) : (
              ""
            )}
          </span>
        </div>
        <div className="movie-card-badges-inline">
          {movie.imdbRating && (
            <span className="badge-rating"><Star size="1em" className="inline-icon" /> {movie.imdbRating}</span>
          )}
          {movie.watched && <span className="badge-watched">Watched</span>}
        </div>
      </div>

      {hasCredits && (
        <div className="movie-card-meta">
          {(movie.director || movie.runtime) && (
            <div className="flex-row gap-sm items-center flex-wrap">
              {movie.director && (
                <span>
                  <Clapperboard size="1em" className="inline-icon" /> <span className="text-muted">Dir:</span> {movie.director}
                </span>
              )}
              {movie.director && movie.runtime && (
                <span className="text-glass-border">•</span>
              )}
              {movie.runtime && <span><Timer size="1em" className="inline-icon" /> {movie.runtime}</span>}
            </div>
          )}
          {movie.stars && (
            <div className="flex-row gap-xs items-baseline text-xs text-secondary mt-xxs">
              <span className="text-muted flex-shrink-0"><Users size="1em" className="inline-icon" /> Cast:</span>
              <span className="text-secondary">{movie.stars}</span>
            </div>
          )}
        </div>
      )}

      <div className="movie-card-footer">
        <div className="movie-card-tags">
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
              {g.name}
            </span>
          ))}
        </div>

        <div className="movie-card-actions">
          {(movie.plot || movie.posterUrl) && (
            <button
              type="button"
              onClick={() => onShowPlot(movie)}
              className="btn btn-secondary btn-sm"
            >
              <Popcorn size="1em" className="inline-icon" /> Plot
            </button>
          )}
          {movie.trailerUrl && <TrailerButton trailerUrl={movie.trailerUrl} />}
          {movie.imdbUrl && (
            <a
              href={movie.imdbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              IMDb <ExternalLink size="1em" className="inline-icon" />
            </a>
          )}
          {/* Keyed so a different movie gets a freshly seeded form rather
              than one carrying the previous movie's edits. */}
          <EditMovieButton
            key={movie.id}
            movie={movie}
            categories={categories}
            genres={genres}
          />
          {isAdmin && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onRemove(movie)}
              className="btn btn-secondary btn-sm btn-danger-outline"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
