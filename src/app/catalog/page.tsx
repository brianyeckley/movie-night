import { db } from "@/lib/db";
import { getActiveUser, addCategoryAction, addSubcategoryAction, deleteMovieAction, deleteCategoryAction } from "@/app/actions";
import AddMovieForm from "@/components/AddMovieForm";
import Link from "next/link";
import TrailerButton from "@/components/TrailerButton";
import EditMovieButton from "@/components/EditMovieButton";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const currentUser = await getActiveUser();

  // Fetch all top-level categories, including their nested subcategories and direct movies
  const categories = await db.category.findMany({
    where: { parentId: null },
    include: {
      subcategories: {
        include: {
          movies: {
            include: {
              genres: true,
            },
            orderBy: { title: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
      movies: {
        where: {
          category: {
            parentId: null, // Only fetch direct movies here (redundant but safe)
          },
        },
        include: {
          genres: true,
        },
        orderBy: { title: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Fetch all flat categories (both top-level and subcategories) for the dropdown list
  const flatCategories = await db.category.findMany({
    orderBy: { name: "asc" },
  });

  // Fetch all genres
  const genres = await db.genre.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="py-xl">
      <main className="container">
        {/* Banner */}
        <div className="glass-panel no-hover p-xl mb-3xl">
          <h1 className="text-gradient text-8xl font-extrabold mb-sm tracking-tighter">
            📚 Catalog Management
          </h1>
          <p className="text-secondary text-xl">
            Manage the movie list, group them into categories or subcategories, and tag their genres.
          </p>
        </div>

        {!currentUser && (
          <div className="glass-panel no-hover p-lg text-center alert-error">
            <p className="text-accent-color font-semibold">
              ⚠️ You must select a user profile in the header dropdown to view or edit the catalog.
            </p>
          </div>
        )}

        {currentUser && (
          <div className="catalog-layout">
            {/* Catalog List */}
            <div className="glass-panel no-hover catalog-list-container p-xl">
              <h2 className="text-4xl font-bold mb-xl">Movie Catalog</h2>

              {categories.length === 0 ? (
                <p className="text-secondary">No categories created yet.</p>
              ) : (
                <div className="flex-col gap-2xl">
                  {categories.map((cat) => (
                    <details
                      key={cat.id}
                      open={cat.isThemed}
                      className="category-details border-b"
                    >
                      {/* Top level Category Header */}
                      <summary className="category-summary">
                        <h3 className="text-3xl font-bold text-primary-color flex-row items-center gap-md">
                          <span className="chevron-icon">
                            ▶
                          </span>
                          {cat.name}
                          {cat.isThemed && (
                            <span className="badge-theme">
                              Theme
                            </span>
                          )}
                        </h3>
                      </summary>

                      <div className="category-details-content">
                        {/* Option to Delete Category */}
                        <div className="flex-row justify-end mb-lg">
                          <form
                            action={async () => {
                              "use server";
                              await deleteCategoryAction(cat.id);
                            }}
                          >
                            <button
                              type="submit"
                              className="text-btn nav-link"
                            >
                              Delete Category
                            </button>
                          </form>
                        </div>

                      {/* Direct Movies in Top level Category */}
                      {cat.movies.length > 0 && (
                        <div className="flex-col gap-sm-plus mb-xl">
                          {cat.movies.map((movie) => (
                            <div
                              key={movie.id}
                              className="movie-row-card"
                            >
                              <div className="flex-row justify-between items-start flex-wrap gap-md">
                                <div className="flex-col gap-xs flex-1 min-w-250">
                                  <div className="flex-row items-center gap-sm-plus flex-wrap">
                                    <span className="font-semibold text-lg">{movie.title}{movie.year ? ` (${movie.year})` : ""}</span>
                                    {movie.watched && (
                                      <span className="badge-watched">
                                        Watched
                                      </span>
                                    )}
                                    {(movie.plot || movie.posterUrl) && (
                                      <span className="movie-tooltip-trigger btn-plot">
                                        🍿 Plot
                                        <span className="movie-tooltip-card">
                                          {movie.posterUrl && (
                                            <img
                                              src={movie.posterUrl}
                                              alt={`${movie.title} Poster`}
                                              className="tooltip-poster"
                                            />
                                          )}
                                          <div className="flex-1 flex-col gap-xs">
                                            <div className="flex-row justify-between items-baseline w-full gap-sm">
                                              <span className="font-bold text-md text-primary-var">{movie.title}</span>
                                              {movie.imdbRating && (
                                                <span className="text-sm text-warning font-semibold flex-shrink-0">
                                                  ⭐ {movie.imdbRating}/10
                                                </span>
                                              )}
                                            </div>
                                            {movie.plot && (
                                              <p className="tooltip-plot">
                                                {movie.plot}
                                              </p>
                                            )}
                                          </div>
                                        </span>
                                      </span>
                                    )}
                                    {movie.imdbRating && (
                                      <span className="badge-rating">
                                        ⭐ {movie.imdbRating}
                                      </span>
                                    )}
                                  </div>

                                  {(movie.director || movie.runtime || movie.stars) && (
                                    <div className="text-sm text-secondary flex-col gap-xxs mt-xs">
                                      {(movie.director || movie.runtime) && (
                                        <div className="flex-row gap-sm items-center flex-wrap">
                                          {movie.director && <span>🎬 <span className="text-muted">Dir:</span> {movie.director}</span>}
                                          {movie.director && movie.runtime && <span className="text-glass-border">•</span>}
                                          {movie.runtime && <span>⏱️ {movie.runtime}</span>}
                                        </div>
                                      )}
                                      {movie.stars && (
                                        <div className="flex-row gap-xs items-baseline">
                                          <span className="text-muted flex-shrink-0">👥 Cast:</span>
                                          <span className="text-secondary">{movie.stars}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div className="flex-col items-end gap-sm flex-shrink-0">
                                  <div className="flex-row gap-xs">
                                    {movie.genres.map((g) => (
                                      <span key={g.id} className="badge-genre">
                                        {g.name}
                                      </span>
                                    ))}
                                  </div>

                                  <div className="flex-row gap-sm items-center mt-xs">
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
                                    <EditMovieButton movie={movie} categories={flatCategories} genres={genres} />
                                    <form
                                      action={async () => {
                                        "use server";
                                        await deleteMovieAction(movie.id);
                                      }}
                                    >
                                      <button
                                        type="submit"
                                        className="btn btn-secondary btn-sm btn-danger-outline"
                                      >
                                        Remove
                                      </button>
                                    </form>
                                  </div>
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
                                <h4 className="text-xl font-bold text-primary-var">↳ {sub.name}</h4>
                                <form
                                  action={async () => {
                                    "use server";
                                    await deleteCategoryAction(sub.id);
                                  }}
                                >
                                  <button type="submit" className="text-btn text-sm">
                                    Delete Subcategory
                                  </button>
                                </form>
                              </div>

                              {sub.movies.length === 0 ? (
                                <p className="text-muted text-base">No movies added in this subcategory.</p>
                              ) : (
                                <div className="flex-col gap-sm">
                                  {sub.movies.map((movie) => (
                                    <details
                                      key={movie.id}
                                      className="movie-row-details movie-details-wrapper"
                                    >
                                      <summary className="movie-details-summary">
                                        <div className="flex-row items-center gap-sm-plus">
                                          <span className="movie-chevron">▶</span>
                                          <span className="font-semibold text-md">{movie.title}{movie.year ? ` (${movie.year})` : ""}</span>
                                          {movie.watched && (
                                            <span className="badge-watched">
                                              Watched
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex-row gap-xs">
                                          {movie.genres.map((g) => (
                                            <span key={g.id} className="badge-genre">
                                              {g.name}
                                            </span>
                                          ))}
                                        </div>
                                      </summary>

                                      <div className="movie-details-expanded">
                                        {movie.posterUrl && (
                                          <img 
                                            src={movie.posterUrl} 
                                            alt={`${movie.title} Poster`} 
                                            className="expanded-poster"
                                          />
                                        )}
                                        <div className="flex-1 flex-col gap-sm">
                                          {movie.plot && (
                                            <p className="expanded-plot">
                                              {movie.plot}
                                            </p>
                                          )}
                                          
                                          <div className="text-sm text-secondary flex-col gap-xs mt-xs">
                                            {movie.director && <span>🎬 <strong className="text-primary-var">Director:</strong> {movie.director}</span>}
                                            {movie.stars && <span>👥 <strong className="text-primary-var">Cast:</strong> {movie.stars}</span>}
                                            {movie.runtime && <span>⏱️ <strong className="text-primary-var">Runtime:</strong> {movie.runtime}</span>}
                                          </div>

                                          <div className="flex-row gap-md items-center mt-sm">
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
                                            <EditMovieButton movie={movie} categories={flatCategories} genres={genres} />
                                            <form
                                              action={async () => {
                                                "use server";
                                                await deleteMovieAction(movie.id);
                                              }}
                                            >
                                              <button 
                                                type="submit" 
                                                className="btn btn-secondary btn-sm btn-danger-outline"
                                              >
                                                Remove
                                              </button>
                                            </form>
                                          </div>
                                        </div>
                                      </div>
                                    </details>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {cat.movies.length === 0 && cat.subcategories.length === 0 && (
                        <p className="text-muted text-base">No movies or subcategories created yet.</p>
                      )}
                    </div>
                  </details>
                ))}
                </div>
              )}
            </div>

            {/* Catalog Controls Forms */}
            <div className="catalog-sidebar">
              <input type="checkbox" id="catalog-sidebar-toggle" className="sidebar-toggle-checkbox" />
              <label htmlFor="catalog-sidebar-toggle" className="sidebar-toggle-label">
                <span>🛠️ Manage Catalog (Add Movie/Category...)</span>
                <span className="sidebar-chevron">▼</span>
              </label>
              <div className="sidebar-content">
              {/* Form 1: Add Movie */}
              <div className="glass-panel no-hover p-lg">
                <AddMovieForm categories={flatCategories} genres={genres} />
              </div>

              {/* Form 2: Add Category */}
              <div className="glass-panel no-hover p-lg">
                <h3 className="text-2xl font-bold mb-lg">Add Category</h3>
                <form
                  action={async (formData) => {
                    "use server";
                    const name = formData.get("name") as string;
                    const isThemed = formData.get("isThemed") === "on";
                    if (name) {
                      await addCategoryAction(name, isThemed);
                    }
                  }}
                  className="form-container gap-md"
                >
                  <div className="form-group">
                    <label htmlFor="cat-name" className="form-label">
                      Category Name
                    </label>
                    <input
                      id="cat-name"
                      name="name"
                      type="text"
                      placeholder="e.g. Action"
                      required
                      className="form-input"
                    />
                  </div>
                  <label className="checkbox-label">
                    <input type="checkbox" name="isThemed" className="checkbox-input" />
                    Mark as Themed Category
                  </label>
                  <button type="submit" className="btn btn-secondary btn-md w-full">
                    Create Category
                  </button>
                </form>
              </div>

              {/* Form 3: Add Subcategory */}
              <div className="glass-panel no-hover p-lg">
                <h3 className="text-2xl font-bold mb-lg">Add Subcategory</h3>
                <form
                  action={async (formData) => {
                    "use server";
                    const name = formData.get("name") as string;
                    const parentId = formData.get("parentId") as string;
                    if (name && parentId) {
                      await addSubcategoryAction(name, parentId);
                    }
                  }}
                  className="form-container gap-md"
                >
                  <div className="form-group">
                    <label htmlFor="sub-parent" className="form-label">
                      Parent Category
                    </label>
                    <select
                      id="sub-parent"
                      name="parentId"
                      required
                      className="form-select"
                    >
                      <option value="">-- Select Parent --</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="sub-name" className="form-label">
                      Subcategory Name
                    </label>
                    <input
                      id="sub-name"
                      name="name"
                      type="text"
                      placeholder="e.g. Jean-Claude Van Damme"
                      required
                      className="form-input"
                    />
                  </div>
                  <button type="submit" className="btn btn-secondary btn-md w-full">
                    Create Subcategory
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
