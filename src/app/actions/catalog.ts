"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getActiveUser } from "./user";
import { fetchMovieMetadata } from "@/lib/imdb";

// 12. Catalog Management: Add Category
export async function addCategoryAction(name: string, isThemed: boolean = false) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  const category = await db.category.upsert({
    where: { name },
    update: { isActive: true, isThemed },
    create: { name, isThemed, isActive: true },
  });

  revalidatePath("/catalog");
  revalidatePath("/");
  return category;
}

// 13. Catalog Management: Add Subcategory
export async function addSubcategoryAction(name: string, parentId: string) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  const subcategory = await db.category.create({
    data: {
      name,
      parentId,
    },
  });

  revalidatePath("/catalog");
  revalidatePath("/");
  return subcategory;
}

// 14. Catalog Management: Add Movie
export async function addMovieAction(
  imdbUrl: string,
  categoryId: string,
  genreIds: string[],
  trailerUrl?: string
) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");
  if (!imdbUrl) throw new Error("IMDb URL is required.");

  let title = "Unknown Movie";
  let year = null;
  let director = null;
  let stars = null;
  let runtime = null;
  let plot = null;
  let posterUrl = null;
  let imdbRating = null;

  try {
    const meta = await fetchMovieMetadata(imdbUrl);
    if (meta) {
      title = meta.title || "Unknown Movie";
      year = meta.year || null;
      director = meta.director || null;
      stars = meta.stars || null;
      runtime = meta.runtime || null;
      plot = meta.plot || null;
      posterUrl = meta.posterUrl || null;
      imdbRating = meta.imdbRating || null;
    }
  } catch (e) {
    console.error("Failed to fetch movie metadata during creation:", e);
  }

  const movie = await db.movie.create({
    data: {
      title,
      imdbUrl: imdbUrl || null,
      trailerUrl: trailerUrl || null,
      year,
      director,
      stars,
      runtime,
      plot,
      posterUrl,
      imdbRating,
      categoryId,
      genres: {
        connect: genreIds.map((id) => ({ id })),
      },
    },
  });

  revalidatePath("/catalog");
  revalidatePath("/");
  return movie;
}

// 15. Catalog Management: Delete Movie
export async function deleteMovieAction(movieId: string) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  await db.movie.delete({ where: { id: movieId } });
  revalidatePath("/catalog");
  revalidatePath("/");
}

// 16. Catalog Management: Delete Category/Subcategory
export async function deleteCategoryAction(categoryId: string) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  // Delete category (cascade deletes movies and subcategories in schema)
  await db.category.delete({ where: { id: categoryId } });
  revalidatePath("/catalog");
  revalidatePath("/");
}

// 17. Catalog Management: Update Movie
export async function updateMovieAction(
  movieId: string,
  title: string,
  imdbUrl: string,
  trailerUrl?: string,
  categoryId?: string,
  genreIds?: string[]
) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  const existingMovie = await db.movie.findUnique({
    where: { id: movieId },
  });

  if (!existingMovie) throw new Error("Movie not found.");

  let year = existingMovie.year;
  let director = existingMovie.director;
  let stars = existingMovie.stars;
  let runtime = existingMovie.runtime;
  let plot = existingMovie.plot;
  let posterUrl = existingMovie.posterUrl;
  let imdbRating = existingMovie.imdbRating;

  if (imdbUrl && imdbUrl !== existingMovie.imdbUrl) {
    try {
      const meta = await fetchMovieMetadata(imdbUrl);
      if (meta) {
        year = meta.year || null;
        director = meta.director || null;
        stars = meta.stars || null;
        runtime = meta.runtime || null;
        plot = meta.plot || null;
        posterUrl = meta.posterUrl || null;
        imdbRating = meta.imdbRating || null;
      }
    } catch (e) {
      console.error("Failed to fetch movie metadata during update:", e);
    }
  } else if (!imdbUrl) {
    year = null;
    director = null;
    stars = null;
    runtime = null;
    plot = null;
    posterUrl = null;
    imdbRating = null;
  }

  const updateData: any = {
    title,
    imdbUrl: imdbUrl || null,
    trailerUrl: trailerUrl || null,
    year,
    director,
    stars,
    runtime,
    plot,
    posterUrl,
    imdbRating,
  };

  if (categoryId) {
    updateData.categoryId = categoryId;
  }

  if (genreIds) {
    updateData.genres = {
      set: genreIds.map((id) => ({ id })),
    };
  }

  const updatedMovie = await db.movie.update({
    where: { id: movieId },
    data: updateData,
  });

  revalidatePath("/catalog");
  revalidatePath("/");
  return updatedMovie;
}
