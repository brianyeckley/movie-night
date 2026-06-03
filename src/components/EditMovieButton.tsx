"use client";

import { useState, useEffect, useTransition } from "react";
import { updateMovieAction } from "@/app/actions";

interface EditMovieButtonProps {
  movie: {
    id: string;
    title: string;
    imdbUrl: string | null;
    trailerUrl: string | null;
    categoryId: string;
    genres: { id: string; name: string }[];
  };
  categories: { id: string; name: string; parentId: string | null }[];
  genres: { id: string; name: string }[];
}

export default function EditMovieButton({ movie, categories, genres }: EditMovieButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form states
  const [title, setTitle] = useState(movie.title);
  const [imdbUrl, setImdbUrl] = useState(movie.imdbUrl || "");
  const [trailerUrl, setTrailerUrl] = useState(movie.trailerUrl || "");
  const [categoryId, setCategoryId] = useState(movie.categoryId);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>(
    movie.genres.map((g) => g.id)
  );

  // Sync state if movie prop changes
  useEffect(() => {
    setTitle(movie.title);
    setImdbUrl(movie.imdbUrl || "");
    setTrailerUrl(movie.trailerUrl || "");
    setCategoryId(movie.categoryId);
    setSelectedGenreIds(movie.genres.map((g) => g.id));
  }, [movie]);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      document.body.style.overflow = "hidden";
    } else {
      const timer = setTimeout(() => setIsRendered(false), 300);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleGenreToggle = (genreId: string) => {
    setSelectedGenreIds((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateMovieAction(
          movie.id,
          title,
          imdbUrl,
          trailerUrl,
          categoryId,
          selectedGenreIds
        );
        setIsOpen(false);
      } catch (err) {
        console.error("Failed to update movie:", err);
        alert("Failed to save changes. Please try again.");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          backgroundColor: "transparent",
          border: "none",
          color: "var(--primary)",
          cursor: "pointer",
          fontSize: "0.85rem",
          padding: "4px 8px",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          transition: "color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary-hover, #818cf8)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--primary)")}
      >
        ✏️ Edit
      </button>

      {isRendered && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(5, 7, 12, 0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            opacity: isOpen ? 1 : 0,
            transition: "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            padding: "24px",
          }}
        >
          {/* Modal Card */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "550px",
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-lg), var(--shadow-glow)",
              overflow: "hidden",
              transform: isOpen ? "translateY(0) scale(1)" : "translateY(-40px) scale(0.95)",
              transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "90vh",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 24px",
                borderBottom: "1px solid var(--glass-border)",
                backgroundColor: "rgba(0, 0, 0, 0.2)",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>✏️ Edit Movie Details</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  lineHeight: 1,
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                &times;
              </button>
            </div>

            {/* Scrollable Form */}
            <form
              onSubmit={handleSubmit}
              style={{
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                overflowY: "auto",
              }}
            >
              {/* Title Input */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Movie Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.25)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 14px",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
              </div>

              {/* IMDb URL Input */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  IMDb Link
                </label>
                <input
                  type="url"
                  value={imdbUrl}
                  onChange={(e) => setImdbUrl(e.target.value)}
                  placeholder="https://www.imdb.com/title/tt..."
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.25)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 14px",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                  Note: Changing this will automatically trigger metadata scraping.
                </span>
              </div>

              {/* YouTube URL Input */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  YouTube Trailer Link
                </label>
                <input
                  type="url"
                  value={trailerUrl}
                  onChange={(e) => setTrailerUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.25)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 14px",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
              </div>

              {/* Category Dropdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 14px",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.parentId ? `↳ ${cat.name}` : cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Genres Multi-Select */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Genres
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                    gap: "8px",
                    maxHeight: "150px",
                    overflowY: "auto",
                    backgroundColor: "rgba(0,0,0,0.15)",
                    padding: "12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  {genres.map((genre) => {
                    const isChecked = selectedGenreIds.includes(genre.id);
                    return (
                      <label
                        key={genre.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "0.85rem",
                          color: isChecked ? "var(--text-primary)" : "var(--text-secondary)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleGenreToggle(genre.id)}
                          style={{ accentColor: "var(--primary)" }}
                        />
                        {genre.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Actions Footer */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginTop: "12px",
                  borderTop: "1px solid var(--glass-border)",
                  paddingTop: "16px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn btn-secondary"
                  disabled={isPending}
                  style={{ padding: "8px 16px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isPending}
                  style={{ padding: "8px 24px", minWidth: "100px" }}
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
