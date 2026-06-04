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
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Subcategories */}
      {subcategories.map((sub) => {
        const isChecked = selectedIds.includes(sub.id);
        const isDisabled = isLimitReached && !isChecked;
        return (
          <label
            key={sub.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "14px 18px",
              borderRadius: "var(--radius-md)",
              border: "1px solid " + (isChecked ? "var(--primary)" : "var(--glass-border)"),
              backgroundColor: isChecked ? "var(--primary-light)" : "rgba(255,255,255,0.01)",
              cursor: isDisabled ? "not-allowed" : "pointer",
              opacity: isDisabled ? 0.4 : 1,
              transition: "all var(--transition-fast)",
            }}
          >
            <input
              type="checkbox"
              checked={isChecked}
              disabled={isDisabled || isPending}
              onChange={(e) => handleCheckboxChange(sub.id, e.target.checked)}
              style={{ cursor: isDisabled ? "not-allowed" : "pointer", accentColor: "var(--primary)" }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>📂 {sub.name} (Subcategory)</span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
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
            className="movie-row-card"
            style={{
              border: "1px solid " + (isChecked ? "var(--primary)" : "var(--glass-border)"),
              borderRadius: "var(--radius-md)",
              backgroundColor: isChecked ? "var(--primary-light)" : "rgba(255,255,255,0.01)",
              opacity: isDisabled ? 0.4 : 1,
              padding: "14px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              width: "100%",
              textAlign: "left"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: "12px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  flex: 1,
                  minWidth: "250px"
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled || isPending}
                  onChange={(e) => handleCheckboxChange(movie.id, e.target.checked)}
                  style={{ cursor: isDisabled ? "not-allowed" : "pointer", accentColor: "var(--primary)" }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600 }}>{movie.title}{movie.year ? ` (${movie.year})` : ""}</span>
                    {(movie.plot || movie.posterUrl) && (
                      <span className="movie-tooltip-trigger" style={{
                        fontSize: "0.7rem",
                        backgroundColor: "var(--primary-light)",
                        color: "var(--primary)",
                        padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        border: "1px solid rgba(99, 102, 241, 0.2)",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}>
                        🍿 Plot
                        <span className="movie-tooltip-card">
                          {movie.posterUrl && (
                            <img
                              src={movie.posterUrl}
                              alt={`${movie.title} Poster`}
                              style={{
                                width: "90px",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--glass-border)",
                                boxShadow: "var(--shadow-sm)",
                                flexShrink: 0
                              }}
                            />
                          )}
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", width: "100%", gap: "8px" }}>
                              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>{movie.title}</span>
                              {movie.imdbRating && (
                                <span style={{ fontSize: "0.8rem", color: "var(--warning)", fontWeight: 600, flexShrink: 0 }}>
                                  ⭐ {movie.imdbRating}/10
                                </span>
                              )}
                            </div>
                            {movie.plot && (
                              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: "1.4", margin: 0 }}>
                                {movie.plot}
                              </p>
                            )}
                          </div>
                        </span>
                      </span>
                    )}
                    {movie.imdbRating && (
                      <span style={{
                        fontSize: "0.7rem",
                        backgroundColor: "rgba(245, 158, 11, 0.12)",
                        color: "var(--warning)",
                        padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        border: "1px solid rgba(245, 158, 11, 0.25)",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}>
                        ⭐ {movie.imdbRating}
                      </span>
                    )}
                  </div>

                  {(movie.director || movie.runtime || movie.stars) && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                      {(movie.director || movie.runtime) && (
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                          {movie.director && <span>🎬 <span style={{ color: "var(--text-muted)" }}>Dir:</span> {movie.director}</span>}
                          {movie.director && movie.runtime && <span style={{ color: "var(--glass-border)" }}>•</span>}
                          {movie.runtime && <span>⏱️ {movie.runtime}</span>}
                        </div>
                      )}
                      {movie.stars && (
                        <div style={{ display: "flex", gap: "4px", alignItems: "baseline" }}>
                          <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>👥 Cast:</span>
                          <span style={{ color: "var(--text-secondary)" }}>{movie.stars}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </label>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "end", gap: "8px", flexShrink: 0 }}>
                {movie.genres && movie.genres.length > 0 && (
                  <div style={{ display: "flex", gap: "4px" }}>
                    {movie.genres.map((g: any) => (
                      <span key={g.id} style={{ fontSize: "0.7rem", color: "var(--text-secondary)", backgroundColor: "var(--bg-tertiary)", padding: "2px 8px", borderRadius: "var(--radius-sm)" }}>
                        #{g.name}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
                  {movie.trailerUrl && <TrailerButton trailerUrl={movie.trailerUrl} />}
                  {movie.imdbUrl && (
                    <a
                      href={movie.imdbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.75rem", color: "var(--primary)", textDecoration: "underline" }}
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
        <div style={{
          padding: "10px 14px",
          backgroundColor: "var(--accent-light)",
          border: "1px solid var(--accent)",
          borderRadius: "var(--radius-sm)",
          color: "var(--accent)",
          fontSize: "0.85rem",
          fontWeight: 600,
          marginTop: "4px",
        }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={isPending} className="btn btn-primary" style={{ marginTop: "8px" }}>
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
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {movies.map((movie) => {
        const isChecked = selectedIds.includes(movie.id);
        const isDisabled = isLimitReached && !isChecked;
        return (
          <div
            key={movie.id}
            className="movie-row-card"
            style={{
              border: "1px solid " + (isChecked ? "var(--primary)" : "var(--glass-border)"),
              borderRadius: "var(--radius-md)",
              backgroundColor: isChecked ? "var(--primary-light)" : "rgba(255,255,255,0.01)",
              opacity: isDisabled ? 0.4 : 1,
              padding: "14px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              width: "100%",
              textAlign: "left"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: "12px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  flex: 1,
                  minWidth: "250px"
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled || isPending}
                  onChange={(e) => handleCheckboxChange(movie.id, e.target.checked)}
                  style={{ cursor: isDisabled ? "not-allowed" : "pointer", accentColor: "var(--primary)" }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600 }}>{movie.title}{movie.year ? ` (${movie.year})` : ""}</span>
                    {(movie.plot || movie.posterUrl) && (
                      <span className="movie-tooltip-trigger" style={{
                        fontSize: "0.7rem",
                        backgroundColor: "var(--primary-light)",
                        color: "var(--primary)",
                        padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        border: "1px solid rgba(99, 102, 241, 0.2)",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}>
                        🍿 Plot
                        <span className="movie-tooltip-card">
                          {movie.posterUrl && (
                            <img
                              src={movie.posterUrl}
                              alt={`${movie.title} Poster`}
                              style={{
                                width: "90px",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--glass-border)",
                                boxShadow: "var(--shadow-sm)",
                                flexShrink: 0
                              }}
                            />
                          )}
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", width: "100%", gap: "8px" }}>
                              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>{movie.title}</span>
                              {movie.imdbRating && (
                                <span style={{ fontSize: "0.8rem", color: "var(--warning)", fontWeight: 600, flexShrink: 0 }}>
                                  ⭐ {movie.imdbRating}/10
                                </span>
                              )}
                            </div>
                            {movie.plot && (
                              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: "1.4", margin: 0 }}>
                                {movie.plot}
                              </p>
                            )}
                          </div>
                        </span>
                      </span>
                    )}
                    {movie.imdbRating && (
                      <span style={{
                        fontSize: "0.7rem",
                        backgroundColor: "rgba(245, 158, 11, 0.12)",
                        color: "var(--warning)",
                        padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        border: "1px solid rgba(245, 158, 11, 0.25)",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}>
                        ⭐ {movie.imdbRating}
                      </span>
                    )}
                  </div>

                  {(movie.director || movie.runtime || movie.stars) && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                      {(movie.director || movie.runtime) && (
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                          {movie.director && <span>🎬 <span style={{ color: "var(--text-muted)" }}>Dir:</span> {movie.director}</span>}
                          {movie.director && movie.runtime && <span style={{ color: "var(--glass-border)" }}>•</span>}
                          {movie.runtime && <span>⏱️ {movie.runtime}</span>}
                        </div>
                      )}
                      {movie.stars && (
                        <div style={{ display: "flex", gap: "4px", alignItems: "baseline" }}>
                          <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>👥 Cast:</span>
                          <span style={{ color: "var(--text-secondary)" }}>{movie.stars}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </label>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "end", gap: "8px", flexShrink: 0 }}>
                {movie.genres && movie.genres.length > 0 && (
                  <div style={{ display: "flex", gap: "4px" }}>
                    {movie.genres.map((g: any) => (
                      <span key={g.id} style={{ fontSize: "0.7rem", color: "var(--text-secondary)", backgroundColor: "var(--bg-tertiary)", padding: "2px 8px", borderRadius: "var(--radius-sm)" }}>
                        #{g.name}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
                  {movie.trailerUrl && <TrailerButton trailerUrl={movie.trailerUrl} />}
                  {movie.imdbUrl && (
                    <a
                      href={movie.imdbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.75rem", color: "var(--primary)", textDecoration: "underline" }}
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
        <div style={{
          padding: "10px 14px",
          backgroundColor: "var(--accent-light)",
          border: "1px solid var(--accent)",
          borderRadius: "var(--radius-sm)",
          color: "var(--accent)",
          fontSize: "0.85rem",
          fontWeight: 600,
          marginTop: "4px",
        }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={isPending} className="btn btn-primary" style={{ marginTop: "8px" }}>
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
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {movies.map((movie) => {
        const isChecked = selectedIds.includes(movie.id);
        const isDisabled = isLimitReached && !isChecked;
        return (
          <div
            key={movie.id}
            className="movie-row-card"
            style={{
              border: "1px solid " + (isChecked ? "var(--primary)" : "var(--glass-border)"),
              borderRadius: "var(--radius-md)",
              backgroundColor: isChecked ? "var(--primary-light)" : "rgba(255,255,255,0.01)",
              opacity: isDisabled ? 0.4 : 1,
              padding: "14px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              width: "100%",
              textAlign: "left"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: "12px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  flex: 1,
                  minWidth: "250px"
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled || isPending}
                  onChange={(e) => handleCheckboxChange(movie.id, e.target.checked)}
                  style={{ cursor: isDisabled ? "not-allowed" : "pointer", accentColor: "var(--primary)" }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600 }}>{movie.title}{movie.year ? ` (${movie.year})` : ""}</span>
                    {(movie.plot || movie.posterUrl) && (
                      <span className="movie-tooltip-trigger" style={{
                        fontSize: "0.7rem",
                        backgroundColor: "var(--primary-light)",
                        color: "var(--primary)",
                        padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        border: "1px solid rgba(99, 102, 241, 0.2)",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}>
                        🍿 Plot
                        <span className="movie-tooltip-card">
                          {movie.posterUrl && (
                            <img
                              src={movie.posterUrl}
                              alt={`${movie.title} Poster`}
                              style={{
                                width: "90px",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--glass-border)",
                                boxShadow: "var(--shadow-sm)",
                                flexShrink: 0
                              }}
                            />
                          )}
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", width: "100%", gap: "8px" }}>
                              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>{movie.title}</span>
                              {movie.imdbRating && (
                                <span style={{ fontSize: "0.8rem", color: "var(--warning)", fontWeight: 600, flexShrink: 0 }}>
                                  ⭐ {movie.imdbRating}/10
                                </span>
                              )}
                            </div>
                            {movie.plot && (
                              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: "1.4", margin: 0 }}>
                                {movie.plot}
                              </p>
                            )}
                          </div>
                        </span>
                      </span>
                    )}
                    {movie.imdbRating && (
                      <span style={{
                        fontSize: "0.7rem",
                        backgroundColor: "rgba(245, 158, 11, 0.12)",
                        color: "var(--warning)",
                        padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        border: "1px solid rgba(245, 158, 11, 0.25)",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}>
                        ⭐ {movie.imdbRating}
                      </span>
                    )}
                  </div>

                  {(movie.director || movie.runtime || movie.stars) && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                      {(movie.director || movie.runtime) && (
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                          {movie.director && <span>🎬 <span style={{ color: "var(--text-muted)" }}>Dir:</span> {movie.director}</span>}
                          {movie.director && movie.runtime && <span style={{ color: "var(--glass-border)" }}>•</span>}
                          {movie.runtime && <span>⏱️ {movie.runtime}</span>}
                        </div>
                      )}
                      {movie.stars && (
                        <div style={{ display: "flex", gap: "4px", alignItems: "baseline" }}>
                          <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>👥 Cast:</span>
                          <span style={{ color: "var(--text-secondary)" }}>{movie.stars}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </label>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "end", gap: "8px", flexShrink: 0 }}>
                {movie.genres && movie.genres.length > 0 && (
                  <div style={{ display: "flex", gap: "4px" }}>
                    {movie.genres.map((g: any) => (
                      <span key={g.id} style={{ fontSize: "0.7rem", color: "var(--text-secondary)", backgroundColor: "var(--bg-tertiary)", padding: "2px 8px", borderRadius: "var(--radius-sm)" }}>
                        #{g.name}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
                  {movie.trailerUrl && <TrailerButton trailerUrl={movie.trailerUrl} />}
                  {movie.imdbUrl && (
                    <a
                      href={movie.imdbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.75rem", color: "var(--primary)", textDecoration: "underline" }}
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
        <div style={{
          padding: "10px 14px",
          backgroundColor: "var(--accent-light)",
          border: "1px solid var(--accent)",
          borderRadius: "var(--radius-sm)",
          color: "var(--accent)",
          fontSize: "0.85rem",
          fontWeight: 600,
          marginTop: "4px",
        }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={isPending} className="btn btn-primary" style={{ marginTop: "8px" }}>
        {isPending ? "Submitting Votes..." : initialVotes.length > 0 ? "Update Shortlist Votes" : "Cast Shortlist Votes"}
      </button>
    </form>
  );
}
