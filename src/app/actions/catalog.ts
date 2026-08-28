"use server";

import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { fetchMovieMetadata } from "@/lib/imdb";

// 12. Catalog Management: Add Category
export async function addCategoryAction(name: string, isThemed: boolean = false) {
  await requireUser();

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
  await requireUser();

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
  trailerUrl?: string,
  physical4K?: boolean,
  physicalBluRay?: boolean,
  physicalDvd?: boolean
) {
  await requireUser();
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
      physical4K: physical4K ?? false,
      physicalBluRay: physicalBluRay ?? false,
      physicalDvd: physicalDvd ?? false,
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

/**
 * Refuse to delete a movie that a past movie night points at.
 *
 * `winningMovieId` is a plain column rather than a foreign key, so deleting a
 * winner leaves the week pointing at nothing and its entry in Past Movie
 * Nights permanently reads "Unknown Movie".
 */
async function assertNotAPastWinner(movieIds: string[]) {
  if (movieIds.length === 0) return;

  const week = await db.movieNightWeek.findFirst({
    where: { winningMovieId: { in: movieIds } },
    select: { weekNumber: true },
  });

  if (week) {
    throw new Error(
      `This movie won Week #${week.weekNumber}. Delete that movie night first if you really want to remove it.`
    );
  }
}

// 15. Catalog Management: Delete Movie
export async function deleteMovieAction(movieId: string) {
  await requireAdmin("remove movies from the catalog");
  await assertNotAPastWinner([movieId]);

  await db.movie.delete({ where: { id: movieId } });
  revalidatePath("/catalog");
  revalidatePath("/");
}

// 16. Catalog Management: Delete Category/Subcategory
export async function deleteCategoryAction(categoryId: string) {
  await requireAdmin("delete categories");

  // Deleting a category cascades to its subcategories and every movie inside
  // them, so check the whole subtree for past winners before removing it.
  const doomedMovies = await db.movie.findMany({
    where: {
      OR: [{ categoryId }, { category: { parentId: categoryId } }],
    },
    select: { id: true },
  });
  await assertNotAPastWinner(doomedMovies.map((m) => m.id));

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
  genreIds?: string[],
  physical4K?: boolean,
  physicalBluRay?: boolean,
  physicalDvd?: boolean
) {
  await requireUser();

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

  const updateData: Prisma.MovieUpdateInput = {
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
    physical4K: physical4K ?? false,
    physicalBluRay: physicalBluRay ?? false,
    physicalDvd: physicalDvd ?? false,
  };

  if (categoryId) {
    updateData.category = { connect: { id: categoryId } };
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
