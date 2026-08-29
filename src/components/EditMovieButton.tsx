"use client";

import { useState, useEffect, useTransition } from "react";
import { Pencil } from "lucide-react";
import { updateMovieAction } from "@/app/actions";

interface EditMovieButtonProps {
  movie: {
    id: string;
    title: string;
    imdbUrl: string | null;
    trailerUrl: string | null;
    categoryId: string;
    genres: { id: string; name: string }[];
    physical4K: boolean;
    physicalBluRay: boolean;
    physicalDvd: boolean;
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
  const [physical4K, setPhysical4K] = useState(movie.physical4K);
  const [physicalBluRay, setPhysicalBluRay] = useState(movie.physicalBluRay);
  const [physicalDvd, setPhysicalDvd] = useState(movie.physicalDvd);

  // The form is seeded from `movie` on mount only. It deliberately does not
  // re-sync on prop change: `movie` is a fresh object on every server render,
  // so an effect keyed on it wiped whatever the user had typed each time the
  // page revalidated. The dialog is remounted per movie by its `key` instead.

  const openModal = () => {
    // Mounted here rather than in an effect so opening is a single render.
    setIsRendered(true);
    setIsOpen(true);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return;
    }
    // Keep the overlay mounted until the close transition has finished.
    const timer = setTimeout(() => setIsRendered(false), 300);
    document.body.style.overflow = "";
    return () => clearTimeout(timer);
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
          selectedGenreIds,
          physical4K,
          physicalBluRay,
          physicalDvd
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
        onClick={openModal}
        className="btn-edit"
      >
        <Pencil size="1em" className="inline-icon" /> Edit
      </button>

      {isRendered && (
        <div
          onClick={() => setIsOpen(false)}
          className={`modal-overlay ${isOpen ? "open" : ""}`}
        >
          {/* Modal Card */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="modal-card max-w-xl"
          >
            {/* Header */}
            <div className="modal-header">
              <span className="font-bold text-lg"><Pencil size="1em" className="inline-icon" /> Edit Movie Details</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="modal-close-btn"
              >
                &times;
              </button>
            </div>

            {/* Scrollable Form */}
            <form
              onSubmit={handleSubmit}
              className="form-container modal-form"
            >
              {/* Title Input */}
              <div className="form-group">
                <label className="form-label-bold">
                  Movie Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="form-input form-input-dark"
                />
              </div>

              {/* IMDb URL Input */}
              <div className="form-group">
                <label className="form-label-bold">
                  IMDb Link
                </label>
                <input
                  type="url"
                  value={imdbUrl}
                  onChange={(e) => setImdbUrl(e.target.value)}
                  placeholder="https://www.imdb.com/title/tt..."
                  className="form-input form-input-dark"
                />
                <span className="text-xs text-muted italic">
                  Note: Changing this will automatically trigger metadata scraping.
                </span>
              </div>

              {/* YouTube URL Input */}
              <div className="form-group">
                <label className="form-label-bold">
                  YouTube Trailer Link
                </label>
                <input
                  type="url"
                  value={trailerUrl}
                  onChange={(e) => setTrailerUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="form-input form-input-dark"
                />
              </div>

              {/* Category Dropdown */}
              <div className="form-group">
                <label className="form-label-bold">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  className="form-select"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.parentId ? `↳ ${cat.name}` : cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Genres Multi-Select */}
              <div className="form-group">
                <label className="form-label-bold">
                  Genres
                </label>
                <div className="checkbox-group-scroll">
                  {genres.map((genre) => {
                    const isChecked = selectedGenreIds.includes(genre.id);
                    return (
                      <label
                        key={genre.id}
                        className={`checkbox-label ${isChecked ? "text-primary-var" : "text-secondary"}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleGenreToggle(genre.id)}
                          className="checkbox-input"
                        />
                        {genre.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Physical Media (Optional) */}
              <div className="form-group">
                <label className="form-label-bold">
                  Physical Media (Optional)
                </label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={physical4K}
                      onChange={(e) => setPhysical4K(e.target.checked)}
                      className="checkbox-input"
                    />
                    4K UHD
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={physicalBluRay}
                      onChange={(e) => setPhysicalBluRay(e.target.checked)}
                      className="checkbox-input"
                    />
                    Blu-ray
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={physicalDvd}
                      onChange={(e) => setPhysicalDvd(e.target.checked)}
                      className="checkbox-input"
                    />
                    DVD
                  </label>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn btn-secondary btn-md"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-md min-w-100"
                  disabled={isPending}
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
