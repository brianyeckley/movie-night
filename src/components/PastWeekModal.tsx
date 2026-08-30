"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CassetteTape, Clapperboard, Dices, ExternalLink, Timer, Users } from "lucide-react";
import TrailerButton from "@/components/TrailerButton";
import DeletePastMovieNightButton from "@/components/DeletePastMovieNightButton";
import type { PastWeek } from "@/lib/types";

interface PastWeekModalProps {
  week: PastWeek | null;
  isAdmin: boolean;
  onClose: () => void;
}

export function PastWeekModal({ week, isAdmin, onClose }: PastWeekModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // No "mounted" guard needed: `week` is null until a tile is clicked, so the
  // server render returns here and never reaches `document.body`.
  if (!week) return null;

  const winner = week.winner;

  return createPortal(
    <div className="plot-modal-overlay" onClick={onClose}>
      <div className="past-week-modal-card" onClick={(e) => e.stopPropagation()}>
        {winner?.posterUrl && (
          <img
            src={winner.posterUrl}
            alt={`${winner.title} Poster`}
            className="past-week-modal-poster"
          />
        )}

        <div className="flex-col gap-sm flex-1">
          <div className="flex-between items-start gap-sm">
            <div className="flex-row items-center gap-xs">
              <span className="text-sm-alt text-primary-color font-bold">
                WEEK #{week.weekNumber}
              </span>
              {isAdmin && (
                <DeletePastMovieNightButton
                  weekId={week.id}
                  weekNumber={week.weekNumber}
                  movieTitle={winner?.title || "Unknown Movie"}
                  onDeleted={onClose}
                />
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="plot-modal-close-btn"
              aria-label="Close week details"
            >
              ✕
            </button>
          </div>

          <span className="text-sm-alt text-muted">
            {week.closedAt ? new Date(week.closedAt).toLocaleDateString() : ""}
          </span>

          <h3 className="text-xl font-bold">
            {winner?.title || "Unknown Movie"}{winner?.year ? ` (${winner.year})` : ""}
          </h3>

          <div className="flex-row gap-sm items-center">
            {winner?.trailerUrl && <TrailerButton trailerUrl={winner.trailerUrl} />}
            {winner?.imdbUrl && (
              <a href={winner.imdbUrl} target="_blank" rel="noopener noreferrer" className="text-sm-alt text-primary-color underline">
                IMDb Link <ExternalLink size="1em" className="inline-icon" />
              </a>
            )}
          </div>

          {winner && (winner.director || winner.runtime || winner.stars) && (
            <div className="text-sm-alt text-secondary flex-col gap-xxs">
              {(winner.director || winner.runtime) && (
                <div className="flex-row gap-xs items-center">
                  {winner.director && <span><Clapperboard size="1em" className="inline-icon" /> {winner.director}</span>}
                  {winner.director && winner.runtime && <span className="text-glass-border">•</span>}
                  {winner.runtime && <span><Timer size="1em" className="inline-icon" /> {winner.runtime}</span>}
                </div>
              )}
              {winner.stars && (
                <div>
                  <Users size="1em" className="inline-icon" /> {winner.stars}
                </div>
              )}
            </div>
          )}

          <div className="flex-row gap-xs flex-wrap">
            {winner?.physical4K && <span className="badge-media badge-media-4k">4K</span>}
            {winner?.physicalBluRay && <span className="badge-media badge-media-bluray">Blu-ray</span>}
            {winner?.physicalDvd && <span className="badge-media badge-media-dvd">DVD</span>}
            {winner?.genres.map((g) => (
              <span key={g.id} className="badge-genre">
                {g.name}
              </span>
            ))}
          </div>

          <div className="border-t pt-sm mt-sm flex-between text-sm-alt text-muted">
            {week.isInPerson ? (
              <span className="text-accent-color font-semibold"><CassetteTape size="1em" className="inline-icon" /> In-Person Screening</span>
            ) : (
              <span>Theme: {week.themeCategory?.name || "None"}</span>
            )}
            {week.isRandomlyChosen && (
              <span className="text-accent-color font-semibold"><Dices size="1em" className="inline-icon" /> Random Draw</span>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
