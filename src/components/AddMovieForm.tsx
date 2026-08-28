"use client";

import { useState, useTransition } from "react";
import { addMovieAction } from "@/app/actions";
import Toast from "@/components/Toast";

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
  const [physical4K, setPhysical4K] = useState(false);
  const [physicalBluRay, setPhysicalBluRay] = useState(false);
  const [physicalDvd, setPhysicalDvd] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /**
   * Picking the Comedy category pre-ticks the Comedy genre as a convenience.
   *
   * This runs on the change itself rather than in an effect watching
   * `selectedGenreIds` - as an effect it re-applied the moment the user
   * unticked the box, making the genre impossible to remove.
   */
  const handleCategoryChange = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);

    const category = categories.find((c) => c.id === nextCategoryId);
    const comedyGenre = genres.find((g) => g.name.toLowerCase() === "comedy");
    if (category?.name.toLowerCase() === "comedy" && comedyGenre) {
      setSelectedGenreIds((prev) =>
        prev.includes(comedyGenre.id) ? prev : [...prev, comedyGenre.id]
      );
    }
  };

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
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        const movie = await addMovieAction(
          imdbUrl,
          categoryId,
          selectedGenreIds,
          trailerUrl,
          physical4K,
          physicalBluRay,
          physicalDvd
        );
        setImdbUrl("");
        setTrailerUrl("");
        setCategoryId("");
        setSelectedGenreIds([]);
        setPhysical4K(false);
        setPhysicalBluRay(false);
        setPhysicalDvd(false);
        setSuccessMsg(`"${movie.title}" added successfully!`);
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to add movie."
        );
      }
    });
  };

  // Group categories so subcategories are indented under their parents
  const topLevelCategories = categories.filter((c) => c.parentId === null);
  const subCategories = categories.filter((c) => c.parentId !== null);

  return (
    <form onSubmit={handleSubmit} className="form-container">
      <h3 className="text-2xl font-bold mb-sm">Add New Movie</h3>

      {error && (
        <div className="alert-box alert-error text-accent-color text-base font-semibold">
          {error}
        </div>
      )}

      <Toast message={successMsg} onClose={() => setSuccessMsg(null)} />

      <div className="form-group">
        <label htmlFor="movie-imdb" className="form-label">
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
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="movie-trailer" className="form-label">
          YouTube Trailer Link
        </label>
        <input
          id="movie-trailer"
          type="url"
          value={trailerUrl}
          onChange={(e) => setTrailerUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          disabled={isPending}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="movie-category" className="form-label">
          Category *
        </label>
        <select
          id="movie-category"
          value={categoryId}
          onChange={(e) => handleCategoryChange(e.target.value)}
          disabled={isPending}
          required
          className="form-select"
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

      <div className="form-group">
        <span className="form-label">Genres / Tags</span>
        <div className="checkbox-group">
          {genres.map((genre) => (
            <label key={genre.id} className="checkbox-label">
              <input
                type="checkbox"
                checked={selectedGenreIds.includes(genre.id)}
                onChange={(e) => handleGenreChange(genre.id, e.target.checked)}
                disabled={isPending}
                className="checkbox-input"
              />
              {genre.name}
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <span className="form-label">Physical Media (Optional)</span>
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={physical4K}
              onChange={(e) => setPhysical4K(e.target.checked)}
              disabled={isPending}
              className="checkbox-input"
            />
            4K UHD
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={physicalBluRay}
              onChange={(e) => setPhysicalBluRay(e.target.checked)}
              disabled={isPending}
              className="checkbox-input"
            />
            Blu-ray
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={physicalDvd}
              onChange={(e) => setPhysicalDvd(e.target.checked)}
              disabled={isPending}
              className="checkbox-input"
            />
            DVD
          </label>
        </div>
      </div>

      <button type="submit" disabled={isPending} className="btn btn-primary mt-sm w-full">
        {isPending ? "Adding Movie..." : "Add Movie"}
      </button>
    </form>
  );
}
