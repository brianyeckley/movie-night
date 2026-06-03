import { db } from "@/lib/db";
import { getActiveUser, addCategoryAction, addSubcategoryAction, deleteMovieAction, deleteCategoryAction } from "@/app/actions";
import AddMovieForm from "@/components/AddMovieForm";
import Link from "next/link";

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
    <div style={{ padding: "40px 0" }}>
      <main className="container">
        {/* Banner */}
        <div className="glass-panel" style={{ padding: "32px", marginBottom: "40px" }}>
          <h1 className="text-gradient" style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "8px", letterSpacing: "-0.03em" }}>
            📚 Catalog Management
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem" }}>
            Manage the movie list, group them into categories or subcategories, and tag their genres.
          </p>
        </div>

        {!currentUser && (
          <div className="glass-panel" style={{ padding: "24px", textAlign: "center", border: "1px solid var(--accent)" }}>
            <p style={{ color: "var(--accent)", fontWeight: 600 }}>
              ⚠️ You must select a user profile in the header dropdown to view or edit the catalog.
            </p>
          </div>
        )}

        {currentUser && (
          <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
            {/* Catalog List */}
            <div className="glass-panel no-hover" style={{ padding: "32px" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "24px" }}>Movie Catalog</h2>

              {categories.length === 0 ? (
                <p style={{ color: "var(--text-secondary)" }}>No categories created yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                  {categories.map((cat) => (
                    <div key={cat.id} style={{ borderBottom: "1px solid var(--glass-border)", paddingBottom: "24px" }}>
                      {/* Top level Category Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                          {cat.name}
                          {cat.isThemed && (
                            <span style={{ fontSize: "0.75rem", backgroundColor: "var(--accent-light)", color: "var(--accent)", padding: "2px 8px", borderRadius: "var(--radius-full)", border: "1px solid var(--accent)", fontWeight: 600 }}>
                              Theme
                            </span>
                          )}
                        </h3>
                        <form
                          action={async () => {
                            "use server";
                            await deleteCategoryAction(cat.id);
                          }}
                        >
                          <button
                            type="submit"
                            style={{
                              backgroundColor: "transparent",
                              border: "none",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              fontSize: "0.85rem",
                            }}
                            className="nav-link"
                          >
                            Delete Category
                          </button>
                        </form>
                      </div>

                      {/* Direct Movies in Top level Category */}
                      {cat.movies.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                          {cat.movies.map((movie) => (
                            <div
                              key={movie.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "12px 16px",
                                backgroundColor: "rgba(255, 255, 255, 0.02)",
                                border: "1px solid var(--glass-border)",
                                borderRadius: "var(--radius-sm)",
                              }}
                            >
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                  <span style={{ fontWeight: 600 }}>{movie.title}</span>
                                  {movie.imdbUrl && (
                                    <a href={movie.imdbUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.8rem", color: "var(--primary)", textDecoration: "underline" }}>
                                      IMDb ↗
                                    </a>
                                  )}
                                  {movie.watched && (
                                    <span style={{ fontSize: "0.7rem", backgroundColor: "var(--glass-hover)", color: "var(--text-muted)", padding: "2px 6px", borderRadius: "var(--radius-sm)", border: "1px solid var(--glass-border)" }}>
                                      Watched
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  {movie.genres.map((g) => (
                                    <span key={g.id} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", backgroundColor: "var(--bg-tertiary)", padding: "1px 6px", borderRadius: "var(--radius-sm)" }}>
                                      {g.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <form
                                action={async () => {
                                  "use server";
                                  await deleteMovieAction(movie.id);
                                }}
                              >
                                <button type="submit" style={{ backgroundColor: "transparent", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.85rem" }}>
                                  Remove
                                </button>
                              </form>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Nested Subcategories */}
                      {cat.subcategories.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginLeft: "20px", marginTop: "16px" }}>
                          {cat.subcategories.map((sub) => (
                            <div key={sub.id} style={{ backgroundColor: "rgba(255, 255, 255, 0.01)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--glass-border)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>↳ {sub.name}</h4>
                                <form
                                  action={async () => {
                                    "use server";
                                    await deleteCategoryAction(sub.id);
                                  }}
                                >
                                  <button type="submit" style={{ backgroundColor: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}>
                                    Delete Subcategory
                                  </button>
                                </form>
                              </div>

                              {sub.movies.length === 0 ? (
                                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No movies added in this subcategory.</p>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {sub.movies.map((movie) => (
                                    <div
                                      key={movie.id}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "10px 14px",
                                        backgroundColor: "rgba(0, 0, 0, 0.15)",
                                        border: "1px solid var(--glass-border)",
                                        borderRadius: "var(--radius-sm)",
                                      }}
                                    >
                                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{movie.title}</span>
                                          {movie.imdbUrl && (
                                            <a href={movie.imdbUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.75rem", color: "var(--primary)", textDecoration: "underline" }}>
                                              IMDb ↗
                                            </a>
                                          )}
                                          {movie.watched && (
                                            <span style={{ fontSize: "0.65rem", backgroundColor: "var(--glass-hover)", color: "var(--text-muted)", padding: "1px 5px", borderRadius: "var(--radius-sm)", border: "1px solid var(--glass-border)" }}>
                                              Watched
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ display: "flex", gap: "6px" }}>
                                          {movie.genres.map((g) => (
                                            <span key={g.id} style={{ fontSize: "0.7rem", color: "var(--text-secondary)", backgroundColor: "var(--bg-tertiary)", padding: "1px 5px", borderRadius: "var(--radius-sm)" }}>
                                              {g.name}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      <form
                                        action={async () => {
                                          "use server";
                                          await deleteMovieAction(movie.id);
                                        }}
                                      >
                                        <button type="submit" style={{ backgroundColor: "transparent", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.8rem" }}>
                                          Remove
                                        </button>
                                      </form>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {cat.movies.length === 0 && cat.subcategories.length === 0 && (
                        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No movies or subcategories created yet.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Catalog Controls Forms */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Form 1: Add Movie */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <AddMovieForm categories={flatCategories} genres={genres} />
              </div>

              {/* Form 2: Add Category */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px" }}>Add Category</h3>
                <form
                  action={async (formData) => {
                    "use server";
                    const name = formData.get("name") as string;
                    const isThemed = formData.get("isThemed") === "on";
                    if (name) {
                      await addCategoryAction(name, isThemed);
                    }
                  }}
                  style={{ display: "flex", flexDirection: "column", gap: "12px" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label htmlFor="cat-name" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      Category Name
                    </label>
                    <input
                      id="cat-name"
                      name="name"
                      type="text"
                      placeholder="e.g. Action"
                      required
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.2)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "8px 12px",
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" name="isThemed" style={{ accentColor: "var(--primary)" }} />
                    Mark as Themed Category
                  </label>
                  <button type="submit" className="btn btn-secondary" style={{ width: "100%", padding: "8px" }}>
                    Create Category
                  </button>
                </form>
              </div>

              {/* Form 3: Add Subcategory */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px" }}>Add Subcategory</h3>
                <form
                  action={async (formData) => {
                    "use server";
                    const name = formData.get("name") as string;
                    const parentId = formData.get("parentId") as string;
                    if (name && parentId) {
                      await addSubcategoryAction(name, parentId);
                    }
                  }}
                  style={{ display: "flex", flexDirection: "column", gap: "12px" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label htmlFor="sub-parent" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      Parent Category
                    </label>
                    <select
                      id="sub-parent"
                      name="parentId"
                      required
                      style={{
                        backgroundColor: "var(--bg-tertiary)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "8px 12px",
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    >
                      <option value="">-- Select Parent --</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label htmlFor="sub-name" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      Subcategory Name
                    </label>
                    <input
                      id="sub-name"
                      name="name"
                      type="text"
                      placeholder="e.g. Jean-Claude Van Damme"
                      required
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.2)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "8px 12px",
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>
                  <button type="submit" className="btn btn-secondary" style={{ width: "100%", padding: "8px" }}>
                    Create Subcategory
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
