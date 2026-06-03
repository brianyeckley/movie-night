"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { fetchMovieMetadata } from "@/lib/imdb";

// Helper to get active user role and id from cookies
export async function getActiveUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("movie_night_user")?.value;
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}

// 1. Switch simulated user
export async function switchUserAction(userId: string) {
  const cookieStore = await cookies();
  if (userId) {
    cookieStore.set("movie_night_user", userId, { path: "/" });
  } else {
    cookieStore.delete("movie_night_user");
  }
  revalidatePath("/");
}

// 2. Create new Movie Night Week
export async function createWeekAction(themeCategoryName: string) {
  const currentUser = await getActiveUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw new Error("Unauthorized: Only Admin can create weeks.");
  }

  // Find if there is an active week already
  const activeWeek = await db.movieNightWeek.findFirst({
    where: { NOT: { status: "COMPLETED" } },
  });
  if (activeWeek) {
    throw new Error("An active week is already in progress.");
  }

  // Get current week number
  const lastWeek = await db.movieNightWeek.findFirst({
    orderBy: { weekNumber: "desc" },
  });
  const nextWeekNumber = lastWeek ? lastWeek.weekNumber + 1 : 1;

  // Deactivate all previous theme categories
  await db.category.updateMany({
    where: { isThemed: true },
    data: { isActive: false },
  });

  // Check if theme category already exists, if so make it active. If not, create it.
  let themeCategory = await db.category.findUnique({
    where: { name: themeCategoryName },
  });

  if (themeCategory) {
    themeCategory = await db.category.update({
      where: { id: themeCategory.id },
      data: { isActive: true, isThemed: true },
    });
  } else {
    themeCategory = await db.category.create({
      data: {
        name: themeCategoryName,
        isThemed: true,
        isActive: true,
      },
    });
  }

  // Create the week
  await db.movieNightWeek.create({
    data: {
      weekNumber: nextWeekNumber,
      status: "CATEGORY_VOTING",
      themeCategoryId: themeCategory.id,
    },
  });

  revalidatePath("/");
}

// 3. Delete week
export async function deleteWeekAction(weekId: string) {
  const currentUser = await getActiveUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw new Error("Unauthorized: Only Admin can delete weeks.");
  }

  await db.movieNightWeek.delete({ where: { id: weekId } });
  revalidatePath("/");
}

// 4. Reset votes in active week (re-runs current round)
export async function resetRoundAction(weekId: string) {
  const currentUser = await getActiveUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw new Error("Unauthorized: Only Admin can reset rounds.");
  }

  const week = await db.movieNightWeek.findUnique({ where: { id: weekId } });
  if (!week) throw new Error("Week not found.");

  let roundStr = "";
  if (week.status === "CATEGORY_VOTING") roundStr = "ROUND_1_CATEGORY";
  else if (week.status === "MOVIE_VOTING") roundStr = "ROUND_2_MOVIE";
  else if (week.status === "SUBCATEGORY_VOTING") roundStr = "ROUND_2_SUB_MOVIE";
  else if (week.status === "SHORTLIST_VOTING") roundStr = "ROUND_3_SHORTLIST";
  else if (week.status === "FINAL_VOTING") roundStr = "ROUND_4_TIEBREAKER";

  await db.weekVote.deleteMany({
    where: {
      weekId,
      round: roundStr,
    },
  });

  revalidatePath("/");
}

// 5. Submit Category Vote (Round 1)
export async function submitCategoryVoteAction(weekId: string, categoryId: string) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  // Delete previous vote for this user in this round
  await db.weekVote.deleteMany({
    where: {
      weekId,
      userId: currentUser.id,
      round: "ROUND_1_CATEGORY",
    },
  });

  // Create new vote
  await db.weekVote.create({
    data: {
      weekId,
      userId: currentUser.id,
      round: "ROUND_1_CATEGORY",
      targetId: categoryId,
    },
  });

  revalidatePath("/");
}

// 6. Submit Movie/Subcategory Votes (Round 2)
export async function submitMovieVotesAction(weekId: string, targets: string[]) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  if (targets.length > 2) {
    throw new Error("You can select a maximum of 2 options.");
  }

  // Delete previous votes for this user in this round
  await db.weekVote.deleteMany({
    where: {
      weekId,
      userId: currentUser.id,
      round: "ROUND_2_MOVIE",
    },
  });

  // Create new votes
  for (const targetId of targets) {
    await db.weekVote.create({
      data: {
        weekId,
        userId: currentUser.id,
        round: "ROUND_2_MOVIE",
        targetId,
      },
    });
  }

  revalidatePath("/");
}

// 7. Submit Subcategory Movie Votes (Round 2b)
export async function submitSubMovieVotesAction(weekId: string, movieIds: string[]) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  if (movieIds.length > 2) {
    throw new Error("You can select a maximum of 2 movies.");
  }

  // Delete previous votes for this user in this round
  await db.weekVote.deleteMany({
    where: {
      weekId,
      userId: currentUser.id,
      round: "ROUND_2_SUB_MOVIE",
    },
  });

  // Create new votes
  for (const targetId of movieIds) {
    await db.weekVote.create({
      data: {
        weekId,
        userId: currentUser.id,
        round: "ROUND_2_SUB_MOVIE",
        targetId,
      },
    });
  }

  revalidatePath("/");
}

// 8. Submit Shortlist Votes (Round 3)
export async function submitShortlistVotesAction(weekId: string, movieIds: string[]) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  if (movieIds.length > 3) {
    throw new Error("You can select a maximum of 3 movies.");
  }

  // Delete previous votes for this user in this round
  await db.weekVote.deleteMany({
    where: {
      weekId,
      userId: currentUser.id,
      round: "ROUND_3_SHORTLIST",
    },
  });

  // Create new votes
  for (const targetId of movieIds) {
    await db.weekVote.create({
      data: {
        weekId,
        userId: currentUser.id,
        round: "ROUND_3_SHORTLIST",
        targetId,
      },
    });
  }

  revalidatePath("/");
}

// 9. Submit Final Tiebreaker Vote (Round 4)
export async function submitFinalVoteAction(weekId: string, movieId: string) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  // Delete previous vote for this user in this round
  await db.weekVote.deleteMany({
    where: {
      weekId,
      userId: currentUser.id,
      round: "ROUND_4_TIEBREAKER",
    },
  });

  // Create new vote
  await db.weekVote.create({
    data: {
      weekId,
      userId: currentUser.id,
      round: "ROUND_4_TIEBREAKER",
      targetId: movieId,
    },
  });

  revalidatePath("/");
}

// 10. Advance Voting Round (State Machine)
export async function advanceWeekRoundAction(weekId: string) {
  const currentUser = await getActiveUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw new Error("Unauthorized: Only Admin can advance rounds.");
  }

  const week = await db.movieNightWeek.findUnique({
    where: { id: weekId },
    include: { votes: true },
  });
  if (!week) throw new Error("Week not found.");

  // State Machine Transitions
  if (week.status === "CATEGORY_VOTING") {
    // ----------------------------------------
    // ROUND 1: Category Voting
    // ----------------------------------------
    const votes = week.votes.filter((v) => v.round === "ROUND_1_CATEGORY");
    if (votes.length === 0) throw new Error("No votes have been cast yet.");

    // Count votes
    const counts: Record<string, number> = {};
    votes.forEach((v) => {
      counts[v.targetId] = (counts[v.targetId] || 0) + 1;
    });

    // Find highest count
    const maxVal = Math.max(...Object.values(counts));
    const winners = Object.keys(counts).filter((id) => counts[id] === maxVal);

    let winnerId = winners[0];
    if (winners.length > 1) {
      // Tie breaker: pick random
      const randIdx = Math.floor(Math.random() * winners.length);
      winnerId = winners[randIdx];
    }

    await db.movieNightWeek.update({
      where: { id: weekId },
      data: {
        selectedCategoryId: winnerId,
        status: "MOVIE_VOTING",
      },
    });
  } 
  else if (week.status === "MOVIE_VOTING") {
    // ----------------------------------------
    // ROUND 2: Movie/Subcategory Voting
    // ----------------------------------------
    const votes = week.votes.filter((v) => v.round === "ROUND_2_MOVIE");
    if (votes.length === 0) throw new Error("No votes have been cast yet.");

    // Count votes
    const counts: Record<string, number> = {};
    votes.forEach((v) => {
      counts[v.targetId] = (counts[v.targetId] || 0) + 1;
    });

    const maxVal = Math.max(...Object.values(counts));
    const topItems = Object.keys(counts).filter((id) => counts[id] === maxVal);

    if (topItems.length === 1) {
      // Outright winner!
      const winningId = topItems[0];

      // Check if the winner is a Subcategory or a Movie
      const category = await db.category.findUnique({
        where: { id: winningId },
      });

      if (category) {
        // It's a subcategory! Transition to subcategory movie voting
        await db.movieNightWeek.update({
          where: { id: weekId },
          data: {
            selectedSubcategoryId: winningId,
            status: "SUBCATEGORY_VOTING",
          },
        });
      } else {
        // It's a movie! It wins the week immediately
        await db.movieNightWeek.update({
          where: { id: weekId },
          data: {
            winningMovieId: winningId,
            status: "COMPLETED",
          },
        });
      }
    } else {
      // Tie! Advance the tied items to Round 3 (Shortlist)
      // Wait, if any of the tied items is a subcategory, we must resolve it.
      // To handle this cleanly: if there is a subcategory among the tied top items,
      // we transition to SUBCATEGORY_VOTING for it first.
      const categories = await db.category.findMany({
        where: { id: { in: topItems } },
      });

      if (categories.length > 0) {
        // A subcategory is tied for the top. Transition to subcategory voting for that subcategory.
        await db.movieNightWeek.update({
          where: { id: weekId },
          data: {
            selectedSubcategoryId: categories[0].id,
            status: "SUBCATEGORY_VOTING",
          },
        });
      } else {
        // All top tied items are movies. Transition straight to SHORTLIST_VOTING.
        await db.movieNightWeek.update({
          where: { id: weekId },
          data: {
            status: "SHORTLIST_VOTING",
          },
        });
      }
    }
  } 
  else if (week.status === "SUBCATEGORY_VOTING") {
    // ----------------------------------------
    // ROUND 2b: Subcategory Movie Voting
    // ----------------------------------------
    // Transitions to Shortlist, carrying over the top voted subcategory movies
    // and any other tied individual movies from Round 2.
    await db.movieNightWeek.update({
      where: { id: weekId },
      data: {
        status: "SHORTLIST_VOTING",
      },
    });
  } 
  else if (week.status === "SHORTLIST_VOTING") {
    // ----------------------------------------
    // ROUND 3: Shortlist Voting (3 votes per user)
    // ----------------------------------------
    const votes = week.votes.filter((v) => v.round === "ROUND_3_SHORTLIST");
    if (votes.length === 0) throw new Error("No votes have been cast yet.");

    const counts: Record<string, number> = {};
    votes.forEach((v) => {
      counts[v.targetId] = (counts[v.targetId] || 0) + 1;
    });

    const maxVal = Math.max(...Object.values(counts));
    const topMovies = Object.keys(counts).filter((id) => counts[id] === maxVal);

    if (topMovies.length === 1) {
      // Outright winner!
      await db.movieNightWeek.update({
        where: { id: weekId },
        data: {
          winningMovieId: topMovies[0],
          status: "COMPLETED",
        },
      });
    } else {
      // Tie! Transition to final tiebreaker
      await db.movieNightWeek.update({
        where: { id: weekId },
        data: {
          status: "FINAL_VOTING",
        },
      });
    }
  } 
  else if (week.status === "FINAL_VOTING") {
    // ----------------------------------------
    // ROUND 4: Tiebreaker (1 vote per user)
    // ----------------------------------------
    const votes = week.votes.filter((v) => v.round === "ROUND_4_TIEBREAKER");
    if (votes.length === 0) throw new Error("No votes have been cast yet.");

    const counts: Record<string, number> = {};
    votes.forEach((v) => {
      counts[v.targetId] = (counts[v.targetId] || 0) + 1;
    });

    const maxVal = Math.max(...Object.values(counts));
    const winners = Object.keys(counts).filter((id) => counts[id] === maxVal);

    let winnerId = winners[0];
    let isRandom = false;

    if (winners.length > 1) {
      // Tie persisted in finals. Draw a random winner!
      const randIdx = Math.floor(Math.random() * winners.length);
      winnerId = winners[randIdx];
      isRandom = true;
    }

    await db.movieNightWeek.update({
      where: { id: weekId },
      data: {
        winningMovieId: winnerId,
        isRandomlyChosen: isRandom,
        status: "COMPLETED",
      },
    });
  }

  revalidatePath("/");
}

// 11. Complete Week and prompt watched/legacy actions
export async function completeWeekAction(weekId: string, addToLegacy: boolean) {
  const currentUser = await getActiveUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw new Error("Unauthorized: Only Admin can close weeks.");
  }

  const week = await db.movieNightWeek.findUnique({
    where: { id: weekId },
  });
  if (!week || !week.winningMovieId) throw new Error("Winner movie not found.");

  // Mark the movie as watched
  const movie = await db.movie.findUnique({
    where: { id: week.winningMovieId },
    include: { category: true },
  });

  if (!movie) throw new Error("Winning movie not found.");

  // Handle Legacy prompt
  if (movie.category.name === "Legacy") {
    // Already in Legacy. We don't change category but keep it watched.
    await db.movie.update({
      where: { id: movie.id },
      data: { watched: true },
    });
  } else {
    // If not in Legacy and admin chose to add to Legacy, move to Legacy category
    if (addToLegacy) {
      const legacyCategory = await db.category.findUnique({
        where: { name: "Legacy" },
      });
      if (legacyCategory) {
        await db.movie.update({
          where: { id: movie.id },
          data: {
            categoryId: legacyCategory.id,
            watched: true,
          },
        });
      }
    } else {
      // Standard movie - set watched to true
      await db.movie.update({
        where: { id: movie.id },
        data: { watched: true },
      });
    }
  }

  // Set week closedAt date
  await db.movieNightWeek.update({
    where: { id: weekId },
    data: {
      closedAt: new Date(),
    },
  });

  revalidatePath("/");
}

// 11b. Keep/Remove Legacy Movie prompt action (for movies that were already in Legacy)
export async function completeWeekLegacyOverrideAction(weekId: string, keepInLegacy: boolean) {
  const currentUser = await getActiveUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw new Error("Unauthorized: Only Admin can close weeks.");
  }

  const week = await db.movieNightWeek.findUnique({
    where: { id: weekId },
  });
  if (!week || !week.winningMovieId) throw new Error("Winner movie not found.");

  if (!keepInLegacy) {
    // Remove from Legacy: we keep watched=true but set categoryId to "Other" (uncategorized)
    const otherCategory = await db.category.findUnique({
      where: { name: "Other" },
    });
    if (otherCategory) {
      await db.movie.update({
        where: { id: week.winningMovieId },
        data: {
          categoryId: otherCategory.id,
          watched: true,
        },
      });
    }
  } else {
    // Keep in legacy
    await db.movie.update({
      where: { id: week.winningMovieId },
      data: { watched: true },
    });
  }

  // Set week closedAt date
  await db.movieNightWeek.update({
    where: { id: weekId },
    data: {
      closedAt: new Date(),
    },
  });

  revalidatePath("/");
}

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
export async function addMovieAction(title: string, imdbUrl: string, categoryId: string, genreIds: string[], trailerUrl?: string) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  let year = null;
  let director = null;
  let stars = null;
  let runtime = null;

  if (imdbUrl) {
    try {
      const meta = await fetchMovieMetadata(imdbUrl);
      if (meta) {
        year = meta.year || null;
        director = meta.director || null;
        stars = meta.stars || null;
        runtime = meta.runtime || null;
      }
    } catch (e) {
      console.error("Failed to fetch movie metadata during creation:", e);
    }
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

  if (imdbUrl && imdbUrl !== existingMovie.imdbUrl) {
    try {
      const meta = await fetchMovieMetadata(imdbUrl);
      if (meta) {
        year = meta.year || null;
        director = meta.director || null;
        stars = meta.stars || null;
        runtime = meta.runtime || null;
      }
    } catch (e) {
      console.error("Failed to fetch movie metadata during update:", e);
    }
  } else if (!imdbUrl) {
    year = null;
    director = null;
    stars = null;
    runtime = null;
  }

  const updateData: any = {
    title,
    imdbUrl: imdbUrl || null,
    trailerUrl: trailerUrl || null,
    year,
    director,
    stars,
    runtime,
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

