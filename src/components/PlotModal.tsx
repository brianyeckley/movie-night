"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface MoviePlotModalData {
  title: string;
  year?: number | null;
  plot?: string | null;
  posterUrl?: string | null;
  imdbRating?: string | number | null;
}

interface PlotModalProps {
  movie: MoviePlotModalData | null;
  onClose: () => void;
}

export function PlotModal({ movie, onClose }: PlotModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!mounted || !movie) return null;

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
                ⭐ {movie.imdbRating}/10
              </span>
            )}
            {movie.plot ? (
              <p className="plot-modal-text">{movie.plot}</p>
            ) : (
              <p className="text-secondary italic text-sm">No plot summary available.</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
