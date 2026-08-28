"use client";

import { useState, useTransition, useMemo } from "react";
import { deleteMovieAction, deleteCategoryAction } from "@/app/actions";
import { PlotModal } from "@/components/PlotModal";
import CatalogMovieCard from "@/components/CatalogMovieCard";
import type {
  CatalogCategory,
  Category,
  Genre,
  MovieWithGenres,
} from "@/lib/types";
import { sortMoviesByTitle } from "@/lib/movie-sort";

interface CatalogListClientProps {
  categories: CatalogCategory[];
  flatCategories: Category[];
  genres: Genre[];
  /** Deletions cascade, so only admins get the controls. */
  isAdmin: boolean;
}

export default function CatalogListClient({
  categories,
  flatCategories,
  genres,
  isAdmin,
}: CatalogListClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGenreIds, setSelectedGenreIds] = useState<Set<string>>(new Set());
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set());
  const [selectedPlotMovie, setSelectedPlotMovie] = useState<MovieWithGenres | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGenreToggle = (genreId: string) => {
    setSelectedGenreIds((prev) => {
      const next = new Set(prev);
      if (next.has(genreId)) {
        next.delete(genreId);
      } else {
        next.add(genreId);
      }
      return next;
    });
  };

  const handleFormatToggle = (format: string) => {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) {
        next.delete(format);
      } else {
        next.add(format);
      }
      return next;
    });
  };

  const handleRemoveMovie = (movie: MovieWithGenres) => {
    if (
      confirm(
        `Are you sure you want to remove the movie "${movie.title}" from the catalog?`
      )
    ) {
      startTransition(async () => {
        await deleteMovieAction(movie.id);
      });
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedGenreIds(new Set());
    setSelectedFormats(new Set());
  };

  // Client-side filtering logic
  const filteredCategories = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    /** Does this movie survive the search box and every active filter pill? */
    const matchesFilters = (movie: MovieWithGenres) => {
      if (term) {
        const haystack = [
          movie.title,
          movie.plot,
          movie.director,
          movie.stars,
        ];
        if (!haystack.some((f) => f?.toLowerCase().includes(term))) {
          return false;
        }
      }

      if (selectedGenreIds.size > 0) {
        if (!movie.genres.some((g) => selectedGenreIds.has(g.id))) return false;
      }

      if (selectedFormats.size > 0) {
        const matchesFormat =
          (selectedFormats.has("4K") && movie.physical4K) ||
          (selectedFormats.has("Blu-ray") && movie.physicalBluRay) ||
          (selectedFormats.has("DVD") && movie.physicalDvd);
        if (!matchesFormat) return false;
      }

      return true;
    };

    return categories
      .map((cat) => ({
        ...cat,
        movies: sortMoviesByTitle(cat.movies.filter(matchesFilters)),
        subcategories: cat.subcategories
          .map((sub) => ({
            ...sub,
            movies: sortMoviesByTitle(sub.movies.filter(matchesFilters)),
          }))
          .filter((sub) => sub.movies.length > 0),
      }))
      .filter((cat) => cat.movies.length > 0 || cat.subcategories.length > 0);
  }, [categories, searchTerm, selectedGenreIds, selectedFormats]);

  const hasActiveFilters = searchTerm !== "" || selectedGenreIds.size > 0 || selectedFormats.size > 0;

  return (
    <div className="flex-col gap-xl">
      {/* Search & Filter Panel */}
      <div className="catalog-search-container">
        <input type="checkbox" id="catalog-search-toggle" className="search-toggle-checkbox" />
        <label htmlFor="catalog-search-toggle" className="search-toggle-label">
          <span>
            🔍 Search & Filter Catalog{" "}
            {hasActiveFilters && (
              <span className="text-xs text-warning-color font-normal ml-xs">
                (Active)
              </span>
            )}
          </span>
          <span className="search-chevron">▼</span>
        </label>
        <div className="search-toggle-content">
          <div className="search-input-wrapper">
            <span className="search-input-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by title, plot, director, or cast..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="search-clear-btn"
                aria-label="Clear search text"
              >
                &times;
              </button>
            )}
          </div>

          {/* Media Formats Filter */}
          <div className="filter-section">
            <div className="filter-label">Media Type</div>
            <div className="filter-pills-row">
              {(["4K", "Blu-ray", "DVD"] as const).map((format) => {
                const isActive = selectedFormats.has(format);
                let activeClass = "";
                if (isActive) {
                  if (format === "4K") activeClass = "active-4k";
                  else if (format === "Blu-ray") activeClass = "active-bluray";
                  else if (format === "DVD") activeClass = "active-dvd";
                }
                return (
                  <button
                    key={format}
                    type="button"
                    onClick={() => handleFormatToggle(format)}
                    className={`filter-pill filter-pill-format ${isActive ? `active ${activeClass}` : ""}`}
                  >
                    {format}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Genres Filter */}
          {genres.length > 0 && (
            <div className="filter-section">
              <div className="filter-label">Genres</div>
              <div className="filter-pills-row">
                {genres.map((g) => {
                  const isActive = selectedGenreIds.has(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleGenreToggle(g.id)}
                      className={`filter-pill ${isActive ? "active" : ""}`}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <div className="flex-row justify-end">
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-btn text-sm"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Catalog Render List */}
      {filteredCategories.length === 0 ? (
        <div className="glass-panel no-hover p-xl no-movies-found">
          <span className="no-movies-found-icon">🔍</span>
          <h3 className="text-xl font-bold">No Movies Found</h3>
          <p className="text-secondary text-md">
            We couldn&apos;t find any movies in the catalog matching your current search parameters.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="btn btn-secondary btn-sm clear-filters-btn"
            >
              Reset Search & Filters
            </button>
          )}
        </div>
      ) : (
        <div className="flex-col gap-lg">
          {filteredCategories.map((cat) => {
            const totalMovies = cat.movies.length + cat.subcategories.reduce((acc, s) => acc + s.movies.length, 0);
            return (
              <details
                key={cat.id}
                open={hasActiveFilters}
                className="category-details"
              >
                {/* Top level Category Header Bar */}
                <summary className="category-summary">
                  <div className="category-title">
                    <span className="chevron-icon">▶</span>
                    <span>{cat.name}</span>
                    {cat.isThemed && <span className="badge-theme">Theme</span>}
                  </div>
                  <div className="flex-row items-center gap-sm">
                    <span className="category-count-badge">
                      {totalMovies} {totalMovies === 1 ? "movie" : "movies"}
                    </span>
                    {isAdmin && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete the category "${cat.name}"? This will delete all subcategories and movies inside it.`)) {
                          startTransition(async () => {
                            await deleteCategoryAction(cat.id);
                          });
                        }
                      }}
                      className="text-btn nav-link text-xs"
                      style={{ padding: "2px 6px" }}
                    >
                      Delete
                    </button>
                    )}
                  </div>
                </summary>

                <div className="category-details-content">
                  {/* Nested Subcategories (At Top of Category) */}
                  {cat.subcategories.length > 0 && (
                    <div className="flex-col gap-sm mb-lg">
                      {cat.subcategories.map((sub) => (
                        <details
                          key={sub.id}
                          open={hasActiveFilters}
                          className="subcategory-details"
                        >
                          <summary className="subcategory-summary">
                            <div className="subcategory-details-title">
                              <span className="chevron-icon">▶</span>
                              <span>📂 {sub.name}</span>
                              <span className="category-count-badge">
                                {sub.movies.length} {sub.movies.length === 1 ? "movie" : "movies"}
                                {hasActiveFilters && ` (${sub.movies.length} matches)`}
                              </span>
                            </div>
                            {isAdmin && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Are you sure you want to delete the subcategory "${sub.name}"? This will delete all movies inside it.`)) {
                                  startTransition(async () => {
                                    await deleteCategoryAction(sub.id);
                                  });
                                }
                              }}
                              className="text-btn text-xs text-danger-outline"
                              style={{ padding: "2px 6px" }}
                            >
                              Delete
                            </button>
                            )}
                          </summary>

                          <div className="subcategory-details-content">
                            {sub.movies.map((movie) => (
                              <CatalogMovieCard
                                key={movie.id}
                                movie={movie}
                                categories={flatCategories}
                                genres={genres}
                                isAdmin={isAdmin}
                                isPending={isPending}
                                onShowPlot={setSelectedPlotMovie}
                                onRemove={handleRemoveMovie}
                              />
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}

                  {/* Direct Movies in Top level Category (Below Subcategories) */}
                  {cat.movies.length > 0 && (
                    <div>
                      {cat.subcategories.length > 0 && (
                        <h5 className="text-xs font-bold text-muted uppercase tracking-widest mb-sm px-xs">
                          🎬 Direct Movies ({cat.movies.length})
                        </h5>
                      )}
                      <div className="flex-col gap-sm-plus">
                        {cat.movies.map((movie) => (
                          <CatalogMovieCard
                            key={movie.id}
                            movie={movie}
                            categories={flatCategories}
                            genres={genres}
                            isAdmin={isAdmin}
                            isPending={isPending}
                            onShowPlot={setSelectedPlotMovie}
                            onRemove={handleRemoveMovie}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
      </div>
      )}
      <PlotModal movie={selectedPlotMovie} onClose={() => setSelectedPlotMovie(null)} />
    </div>
  );
}
