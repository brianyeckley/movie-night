"use client";

import { useState, useTransition, useMemo } from "react";
import { deleteMovieAction, deleteCategoryAction } from "@/app/actions";
import TrailerButton from "@/components/TrailerButton";
import EditMovieButton from "@/components/EditMovieButton";
import { PlotModal, MoviePlotModalData } from "@/components/PlotModal";
import { sortMoviesByTitle } from "@/lib/movie-sort";

interface Genre {
  id: string;
  name: string;
}

interface Movie {
  id: string;
  title: string;
  year: number | null;
  plot: string | null;
  posterUrl: string | null;
  imdbRating: string | null;
  imdbUrl: string | null;
  trailerUrl: string | null;
  director: string | null;
  runtime: string | null;
  stars: string | null;
  watched: boolean;
  physical4K: boolean;
  physicalBluRay: boolean;
  physicalDvd: boolean;
  categoryId: string;
  genres: Genre[];
}

interface Subcategory {
  id: string;
  name: string;
  movies: Movie[];
}

interface Category {
  id: string;
  name: string;
  isThemed: boolean;
  movies: Movie[];
  subcategories: Subcategory[];
}

interface CatalogListClientProps {
  categories: Category[];
  flatCategories: any[];
  genres: Genre[];
}

export default function CatalogListClient({
  categories,
  flatCategories,
  genres,
}: CatalogListClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGenreIds, setSelectedGenreIds] = useState<Set<string>>(new Set());
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set());
  const [selectedPlotMovie, setSelectedPlotMovie] = useState<MoviePlotModalData | null>(null);
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

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedGenreIds(new Set());
    setSelectedFormats(new Set());
  };

  // Client-side filtering logic
  const filteredCategories = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return categories
      .map((cat) => {
        // Filter direct movies in category
        const filteredDirectMovies = cat.movies.filter((movie) => {
          // 1. Text Search Check
          if (term) {
            const matchesTitle = movie.title.toLowerCase().includes(term);
            const matchesPlot = movie.plot?.toLowerCase().includes(term) || false;
            const matchesDirector = movie.director?.toLowerCase().includes(term) || false;
            const matchesStars = movie.stars?.toLowerCase().includes(term) || false;
            if (!matchesTitle && !matchesPlot && !matchesDirector && !matchesStars) {
              return false;
            }
          }

          // 2. Genre Filter Check
          if (selectedGenreIds.size > 0) {
            const hasMatchingGenre = movie.genres.some((g) => selectedGenreIds.has(g.id));
            if (!hasMatchingGenre) return false;
          }

          // 3. Format Filter Check
          if (selectedFormats.size > 0) {
            const matchesFormat =
              (selectedFormats.has("4K") && movie.physical4K) ||
              (selectedFormats.has("Blu-ray") && movie.physicalBluRay) ||
              (selectedFormats.has("DVD") && movie.physicalDvd);
            if (!matchesFormat) return false;
          }

          return true;
        });

        // Filter subcategories
        const filteredSubcategories = cat.subcategories
          .map((sub) => {
            const filteredSubMovies = sub.movies.filter((movie) => {
              // 1. Text Search Check
              if (term) {
                const matchesTitle = movie.title.toLowerCase().includes(term);
                const matchesPlot = movie.plot?.toLowerCase().includes(term) || false;
                const matchesDirector = movie.director?.toLowerCase().includes(term) || false;
                const matchesStars = movie.stars?.toLowerCase().includes(term) || false;
                if (!matchesTitle && !matchesPlot && !matchesDirector && !matchesStars) {
                  return false;
                }
              }

              // 2. Genre Filter Check
              if (selectedGenreIds.size > 0) {
                const hasMatchingGenre = movie.genres.some((g) => selectedGenreIds.has(g.id));
                if (!hasMatchingGenre) return false;
              }

              // 3. Format Filter Check
              if (selectedFormats.size > 0) {
                const matchesFormat =
                  (selectedFormats.has("4K") && movie.physical4K) ||
                  (selectedFormats.has("Blu-ray") && movie.physicalBluRay) ||
                  (selectedFormats.has("DVD") && movie.physicalDvd);
                if (!matchesFormat) return false;
              }

              return true;
            });

            return { ...sub, movies: sortMoviesByTitle(filteredSubMovies) };
          })
          .filter((sub) => sub.movies.length > 0);

        return {
          ...cat,
          movies: sortMoviesByTitle(filteredDirectMovies),
          subcategories: filteredSubcategories,
        };
      })
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
            We couldn't find any movies in the catalog matching your current search parameters.
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
                  </div>
                </summary>

                <div className="category-details-content">
                  {/* Direct Movies in Top level Category */}
                  {cat.movies.length > 0 && (
                    <div className="flex-col gap-sm-plus mb-lg">
                      {cat.movies.map((movie) => (
                        <div key={movie.id} className="movie-row-card">
                          <div className="movie-card-header">
                            <div className="movie-card-title-group">
                              <span className="movie-card-title">
                                {movie.title}
                                {movie.year ? <span className="movie-card-year"> ({movie.year})</span> : ""}
                              </span>
                            </div>
                            <div className="movie-card-badges-inline">
                              {movie.imdbRating && (
                                <span className="badge-rating">⭐ {movie.imdbRating}</span>
                              )}
                              {movie.watched && <span className="badge-watched">Watched</span>}
                            </div>
                          </div>

                          {(movie.director || movie.runtime || movie.stars) && (
                            <div className="movie-card-meta">
                              {(movie.director || movie.runtime) && (
                                <div className="flex-row gap-sm items-center flex-wrap">
                                  {movie.director && (
                                    <span>
                                      🎬 <span className="text-muted">Dir:</span>{" "}
                                      {movie.director}
                                    </span>
                                  )}
                                  {movie.director && movie.runtime && (
                                    <span className="text-glass-border">•</span>
                                  )}
                                  {movie.runtime && <span>⏱️ {movie.runtime}</span>}
                                </div>
                              )}
                              {movie.stars && (
                                <div className="flex-row gap-xs items-baseline text-xs text-secondary mt-xxs">
                                  <span className="text-muted flex-shrink-0">👥 Cast:</span>
                                  <span className="text-secondary">{movie.stars}</span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="movie-card-footer">
                            <div className="movie-card-tags">
                              {movie.physical4K && <span className="badge-media badge-media-4k">4K</span>}
                              {movie.physicalBluRay && (
                                <span className="badge-media badge-media-bluray">Blu-ray</span>
                              )}
                              {movie.physicalDvd && <span className="badge-media badge-media-dvd">DVD</span>}
                              {movie.genres.map((g) => (
                                <span key={g.id} className="badge-genre">
                                  {g.name}
                                </span>
                              ))}
                            </div>

                            <div className="movie-card-actions">
                              {(movie.plot || movie.posterUrl) && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPlotMovie(movie)}
                                  className="btn btn-secondary btn-sm"
                                >
                                  🍿 Plot
                                </button>
                              )}
                              {movie.trailerUrl && <TrailerButton trailerUrl={movie.trailerUrl} />}
                              {movie.imdbUrl && (
                                <a
                                  href={movie.imdbUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-secondary btn-sm"
                                >
                                  IMDb ↗
                                </a>
                              )}
                              <EditMovieButton
                                movie={movie}
                                categories={flatCategories}
                                genres={genres}
                              />
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => {
                                  if (confirm(`Are you sure you want to remove the movie "${movie.title}" from the catalog?`)) {
                                    startTransition(async () => {
                                      await deleteMovieAction(movie.id);
                                    });
                                  }
                                }}
                                className="btn btn-secondary btn-sm btn-danger-outline"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Nested Subcategories */}
                {cat.subcategories.length > 0 && (
                  <div className="flex-col gap-lg ml-lg mt-md">
                    {cat.subcategories.map((sub) => (
                      <div key={sub.id} className="subcategory-card">
                        <div className="flex-between mb-md">
                          <h4 className="text-xl font-bold text-primary-var">
                            ↳ {sub.name}
                            {hasActiveFilters && (
                              <span className="text-sm-alt text-muted normal-case font-normal ml-xs">
                                ({sub.movies.length} matches)
                              </span>
                            )}
                          </h4>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete the subcategory "${sub.name}"? This will delete all movies inside it.`)) {
                                startTransition(async () => {
                                  await deleteCategoryAction(sub.id);
                                });
                              }
                            }}
                            className="text-btn text-sm"
                          >
                            Delete Subcategory
                          </button>
                        </div>

                        <div className="flex-col gap-sm">
                          {sub.movies.map((movie) => (
                            <div key={movie.id} className="movie-row-card">
                              <div className="movie-card-header">
                                <div className="movie-card-title-group">
                                  <span className="movie-card-title">
                                    {movie.title}
                                    {movie.year ? <span className="movie-card-year"> ({movie.year})</span> : ""}
                                  </span>
                                </div>
                                <div className="movie-card-badges-inline">
                                  {movie.imdbRating && (
                                    <span className="badge-rating">⭐ {movie.imdbRating}</span>
                                  )}
                                  {movie.watched && <span className="badge-watched">Watched</span>}
                                </div>
                              </div>

                              {(movie.director || movie.runtime || movie.stars) && (
                                <div className="movie-card-meta">
                                  {(movie.director || movie.runtime) && (
                                    <div className="flex-row gap-sm items-center flex-wrap">
                                      {movie.director && (
                                        <span>
                                          🎬 <span className="text-muted">Dir:</span>{" "}
                                          {movie.director}
                                        </span>
                                      )}
                                      {movie.director && movie.runtime && (
                                        <span className="text-glass-border">•</span>
                                      )}
                                      {movie.runtime && <span>⏱️ {movie.runtime}</span>}
                                    </div>
                                  )}
                                  {movie.stars && (
                                    <div className="flex-row gap-xs items-baseline text-xs text-secondary mt-xxs">
                                      <span className="text-muted flex-shrink-0">👥 Cast:</span>
                                      <span className="text-secondary">{movie.stars}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="movie-card-footer">
                                <div className="movie-card-tags">
                                  {movie.physical4K && <span className="badge-media badge-media-4k">4K</span>}
                                  {movie.physicalBluRay && (
                                    <span className="badge-media badge-media-bluray">Blu-ray</span>
                                  )}
                                  {movie.physicalDvd && <span className="badge-media badge-media-dvd">DVD</span>}
                                  {movie.genres.map((g) => (
                                    <span key={g.id} className="badge-genre">
                                      {g.name}
                                    </span>
                                  ))}
                                </div>

                                <div className="movie-card-actions">
                                  {(movie.plot || movie.posterUrl) && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedPlotMovie(movie)}
                                      className="btn btn-secondary btn-sm"
                                    >
                                      🍿 Plot
                                    </button>
                                  )}
                                  {movie.trailerUrl && <TrailerButton trailerUrl={movie.trailerUrl} />}
                                  {movie.imdbUrl && (
                                    <a
                                      href={movie.imdbUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn btn-secondary btn-sm"
                                    >
                                      IMDb ↗
                                    </a>
                                  )}
                                  <EditMovieButton
                                    movie={movie}
                                    categories={flatCategories}
                                    genres={genres}
                                  />
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to remove the movie "${movie.title}" from the catalog?`)) {
                                        startTransition(async () => {
                                          await deleteMovieAction(movie.id);
                                        });
                                      }
                                    }}
                                    className="btn btn-secondary btn-sm btn-danger-outline"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
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
