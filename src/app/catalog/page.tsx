import { AlertTriangle, BookOpen, Wrench } from "lucide-react";
import { db } from "@/lib/db";
import { getActiveUser, addCategoryAction, addSubcategoryAction } from "@/app/actions";
import AddMovieForm from "@/components/AddMovieForm";
import CatalogListClient from "@/components/CatalogListClient";
import { sortMoviesByTitle } from "@/lib/movie-sort";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const currentUser = await getActiveUser();

  // Fetch all top-level categories, including their nested subcategories and direct movies
  const rawCategories = await db.category.findMany({
    where: { parentId: null },
    include: {
      subcategories: {
        include: {
          movies: {
            include: {
              genres: true,
            },
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
      },
    },
    orderBy: { name: "asc" },
  });

  const categories = rawCategories.map((cat) => ({
    ...cat,
    movies: sortMoviesByTitle(cat.movies),
    subcategories: cat.subcategories.map((sub) => ({
      ...sub,
      movies: sortMoviesByTitle(sub.movies),
    })),
  }));

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
            <BookOpen size="1em" className="inline-icon" /> Catalog Management
          </h1>
          <p className="text-secondary text-xl">
            Manage the movie list, group them into categories or subcategories, and tag their genres.
          </p>
        </div>

        {!currentUser && (
          <div className="glass-panel no-hover p-lg text-center alert-error">
            <p className="text-accent-color font-semibold">
              <AlertTriangle size="1em" className="inline-icon" /> You must select a user profile in the header dropdown to view or edit the catalog.
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
                <CatalogListClient
                  categories={categories}
                  flatCategories={flatCategories}
                  genres={genres}
                  isAdmin={currentUser.role === "ADMIN"}
                />
              )}
            </div>

            {/* Catalog Controls Forms */}
            <div className="catalog-sidebar">
              <input type="checkbox" id="catalog-sidebar-toggle" className="sidebar-toggle-checkbox" />
              <label htmlFor="catalog-sidebar-toggle" className="sidebar-toggle-label">
                <span><Wrench size="1em" className="inline-icon" /> Manage Catalog</span>
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
