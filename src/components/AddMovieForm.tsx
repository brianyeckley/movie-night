"use client";

import { useState, useEffect, useTransition } from "react";
import { addMovieAction } from "@/app/actions";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  parent?: { name: string } | null;
}

interface Genre {
  id: string;
  name: string;
}

interface AddMovieFormProps {
  categories: Category[];
  genres: Genre[];
}

export default function AddMovieForm({ categories, genres }: AddMovieFormProps) {
  const [imdbUrl, setImdbUrl] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auto-check "Comedy" genre when Comedy category is selected
  useEffect(() => {
    const selectedCategory = categories.find((c) => c.id === categoryId);
    const comedyGenre = genres.find((g) => g.name.toLowerCase() === "comedy");

    if (selectedCategory && selectedCategory.name.toLowerCase() === "comedy" && comedyGenre) {
      if (!selectedGenreIds.includes(comedyGenre.id)) {
        setSelectedGenreIds((prev) => [...prev, comedyGenre.id]);
      }
    }
  }, [categoryId, categories, genres, selectedGenreIds]);

  const handleGenreChange = (genreId: string, checked: boolean) => {
    if (checked) {
      setSelectedGenreIds((prev) => [...prev, genreId]);
    } else {
      setSelectedGenreIds((prev) => prev.filter((id) => id !== genreId));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imdbUrl || !categoryId) {
      setError("IMDb URL and Category are required.");
      return;
    }

    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        await addMovieAction(imdbUrl, categoryId, selectedGenreIds, trailerUrl);
        setImdbUrl("");
        setTrailerUrl("");
        setCategoryId("");
        setSelectedGenreIds([]);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } catch (err: any) {
        setError(err.message || "Failed to add movie.");
      }
    });
  };

  // Group categories so subcategories are indented under their parents
  const topLevelCategories = categories.filter((c) => c.parentId === null);
  const subCategories = categories.filter((c) => c.parentId !== null);

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "8px" }}>Add New Movie</h3>

      {error && (
        <div style={{ color: "var(--accent)", backgroundColor: "var(--accent-light)", padding: "12px", borderRadius: "var(--radius-sm)", fontSize: "0.9rem", border: "1px solid var(--accent)" }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ color: "var(--success)", backgroundColor: "rgba(16, 185, 129, 0.15)", padding: "12px", borderRadius: "var(--radius-sm)", fontSize: "0.9rem", border: "1px solid var(--success)" }}>
          Movie added successfully!
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label htmlFor="movie-imdb" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>
          IMDb Link *
        </label>
        <input
          id="movie-imdb"
          type="url"
          value={imdbUrl}
          onChange={(e) => setImdbUrl(e.target.value)}
          placeholder="https://www.imdb.com/title/..."
          disabled={isPending}
          required
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            color: "var(--text-primary)",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 12px",
            fontSize: "0.9rem",
            outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label htmlFor="movie-trailer" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>
          YouTube Trailer Link
        </label>
        <input
          id="movie-trailer"
          type="url"
          value={trailerUrl}
          onChange={(e) => setTrailerUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          disabled={isPending}
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            color: "var(--text-primary)",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 12px",
            fontSize: "0.9rem",
            outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label htmlFor="movie-category" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>
          Category *
        </label>
        <select
          id="movie-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          disabled={isPending}
          required
          style={{
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 12px",
            fontSize: "0.9rem",
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="">-- Select Category --</option>
          {topLevelCategories.map((cat) => (
            <optgroup key={cat.id} label={cat.name}>
              <option value={cat.id}>{cat.name} (Direct)</option>
              {subCategories
                .filter((sub) => sub.parentId === cat.id)
                .map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    ↳ {sub.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Genres / Tags</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "10px", padding: "12px", backgroundColor: "rgba(0, 0, 0, 0.15)", borderRadius: "var(--radius-sm)", border: "1px solid var(--glass-border)" }}>
          {genres.map((genre) => (
            <label key={genre.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer", color: "var(--text-primary)" }}>
              <input
                type="checkbox"
                checked={selectedGenreIds.includes(genre.id)}
                onChange={(e) => handleGenreChange(genre.id, e.target.checked)}
                disabled={isPending}
                style={{ cursor: "pointer", accentColor: "var(--primary)" }}
              />
              {genre.name}
            </label>
          ))}
        </div>
      </div>

      <button type="submit" disabled={isPending} className="btn btn-primary" style={{ marginTop: "8px", width: "100%" }}>
        {isPending ? "Adding Movie..." : "Add Movie"}
      </button>
    </form>
  );
}
