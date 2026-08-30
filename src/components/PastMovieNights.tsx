"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { PastWeekModal } from "@/components/PastWeekModal";
import type { PastWeek } from "@/lib/types";

interface PastMovieNightsProps {
  pastWeeks: PastWeek[];
  isAdmin: boolean;
}

export default function PastMovieNights({ pastWeeks, isAdmin }: PastMovieNightsProps) {
  const [selectedWeek, setSelectedWeek] = useState<PastWeek | null>(null);

  return (
    <div className="glass-panel no-hover p-lg">
      <h2 className="text-4xl font-semibold mb-2xl">
        Past Movie Nights
      </h2>
      {pastWeeks.length === 0 ? (
        <p className="text-secondary italic">No movie nights have completed yet.</p>
      ) : (
        <div className="past-week-grid">
          {pastWeeks.map((wk) => (
            <button
              key={wk.id}
              type="button"
              onClick={() => setSelectedWeek(wk)}
              className="past-week-tile"
              aria-label={`View details for Week #${wk.weekNumber}: ${wk.winner?.title || "Unknown Movie"}`}
            >
              {wk.winner?.posterUrl ? (
                <img src={wk.winner.posterUrl} alt={`${wk.winner.title} poster`} />
              ) : (
                <span className="past-week-tile-placeholder">
                  {wk.winner?.title || "Unknown Movie"}
                </span>
              )}
              <span className="past-week-tile-badge">
                <Calendar size="1em" className="inline-icon" />{" "}
                {wk.closedAt ? new Date(wk.closedAt).toLocaleDateString() : ""}
              </span>
            </button>
          ))}
        </div>
      )}

      <PastWeekModal week={selectedWeek} isAdmin={isAdmin} onClose={() => setSelectedWeek(null)} />
    </div>
  );
}
