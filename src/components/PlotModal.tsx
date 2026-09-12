"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Star } from "lucide-react";
import AddToLegacyButton from "@/components/AddToLegacyButton";

export interface MoviePlotModalData {
  id?: string;
  title: string;
  year?: number | null;
  plot?: string | null;
  posterUrl?: string | null;
  imdbRating?: string | number | null;
  watched?: boolean;
  isInLegacy?: boolean;
}

interface PlotModalProps {
  movie: MoviePlotModalData | null;
  onClose: () => void;
  /**
   * Opt-in, because this modal is shared with the voting forms and the
   * leaderboard, where moving a movie's category mid-vote has no business
   * being one click away.
   */
  allowAddToLegacy?: boolean;
}

export function PlotModal({ movie, onClose, allowAddToLegacy }: PlotModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // No "mounted" guard needed: `movie` is null until a click sets it, so the
  // server render returns here and never reaches `document.body`.
  if (!movie) return null;

  return createPortal(
    <div 
      className="plot-modal-overlay"
      onClick={onClose}
    >
      <div 
        className="plot-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-row justify-between items-start w-full mb-xs gap-sm">
          <span className="font-bold text-lg text-primary-var">
            {movie.title} {movie.year ? `(${movie.year})` : ""}
          </span>
          <button 
            type="button" 
            onClick={onClose}
            className="plot-modal-close-btn"
            aria-label="Close plot details"
          >
            ✕
          </button>
        </div>

        <div className="flex-row gap-md items-start mt-sm">
          {movie.posterUrl && (
            <img
              src={movie.posterUrl}
              alt={`${movie.title} Poster`}
              className="plot-modal-poster"
            />
          )}
          <div className="flex-1 flex-col gap-xs">
            {movie.imdbRating && (
              <span className="text-sm font-semibold text-warning mb-xs block">
                <Star size="1em" className="inline-icon" /> {movie.imdbRating}/10
              </span>
            )}
            {movie.plot ? (
              <p className="plot-modal-text">{movie.plot}</p>
            ) : (
              <p className="text-secondary italic text-sm">No plot summary available.</p>
            )}
            {allowAddToLegacy && movie.id && (
              <div className="mt-sm">
                <AddToLegacyButton
                  movieId={movie.id}
                  watched={Boolean(movie.watched)}
                  isInLegacy={Boolean(movie.isInLegacy)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
