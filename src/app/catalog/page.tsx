import { AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { getActiveUser } from "@/app/actions";
import CatalogAddMenu from "@/components/CatalogAddMenu";
import CatalogListClient from "@/components/CatalogListClient";
import { sortMoviesByTitle } from "@/lib/movie-sort";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const currentUser = await getActiveUser();

  // Fetch all top-level categories, including their nested subcategories and direct movies
  const rawCategories = await db.category.findMany({
    where: { parentId: null, deletedAt: null },
    include: {
      subcategories: {
        where: { deletedAt: null },
        include: {
          movies: {
            where: { deletedAt: null },
            include: {
              genres: true,
              themes: true,
              backgroundImages: true,
            },
          },
        },
        orderBy: { name: "asc" },
      },
      movies: {
        where: {
          category: {
            is: { parentId: null },
          },
          deletedAt: null,
        },
        include: {
          genres: true,
          themes: true,
          backgroundImages: true,
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
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });

  // Fetch all active themes
  const themes = await db.theme.findMany({
    where: { deletedAt: null },
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
        <div className="glass-panel no-hover p-xl mb-3xl catalog-banner">
          <div className="catalog-banner-text">
            <h1 className="text-5xl font-semibold mb-xs tracking-tighter">
              Catalog Management
            </h1>
            <p className="text-secondary text-xl">
              Manage the movie list, group them into categories or subcategories, and tag their genres.
            </p>
          </div>

          {currentUser && (
            <CatalogAddMenu categories={flatCategories} genres={genres} themes={themes} />
          )}
        </div>

        {!currentUser && (
          <div className="glass-panel no-hover p-lg text-center alert-error">
            <p className="text-accent-color font-semibold">
              <AlertTriangle size="1em" className="inline-icon" /> You must select a user profile in the header dropdown to view or edit the catalog.
            </p>
          </div>
        )}

        {currentUser && (
          <div className="glass-panel no-hover catalog-list-container p-xl">
            <h2 className="text-4xl font-bold mb-xl">Movie Catalog</h2>

            {categories.length === 0 ? (
              <p className="text-secondary">No categories created yet.</p>
            ) : (
              <CatalogListClient
                categories={categories}
                flatCategories={flatCategories}
                genres={genres}
                themes={themes}
                isAdmin={currentUser.role === "ADMIN"}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
