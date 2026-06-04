"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getActiveUser } from "./user";

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

// 10. Advance Voting Round (State Machine)
export async function advanceWeekRoundAction(weekId: string) {
  const currentUser = await getActiveUser();
  if (!currentUser) {
    return { success: false, error: "Unauthorized: Must be logged in." };
  }

  const week = await db.movieNightWeek.findUnique({
    where: { id: weekId },
    include: { votes: true },
  });
  if (!week) return { success: false, error: "Week not found." };

  // Determine if everyone has voted in the current active round
  let activeRoundCode = "";
  if (week.status === "CATEGORY_VOTING") activeRoundCode = "ROUND_1_CATEGORY";
  else if (week.status === "MOVIE_VOTING") activeRoundCode = "ROUND_2_MOVIE";
  else if (week.status === "SUBCATEGORY_VOTING") activeRoundCode = "ROUND_2_SUB_MOVIE";
  else if (week.status === "SHORTLIST_VOTING") activeRoundCode = "ROUND_3_SHORTLIST";
  else if (week.status === "FINAL_VOTING") activeRoundCode = "ROUND_4_TIEBREAKER";

  const roundVotedUserIds = week.votes
    .filter((v) => v.round === activeRoundCode)
    .map((v) => v.userId);

  const allUsers = await db.user.findMany();
  const allVotesIn = allUsers.every((u) => roundVotedUserIds.includes(u.id));

  const isAdmin = currentUser.role === "ADMIN";
  if (!isAdmin && !allVotesIn) {
    return { success: false, error: "Unauthorized: Only Admin can advance before all votes are in." };
  }

  // State Machine Transitions
  if (week.status === "CATEGORY_VOTING") {
    // ----------------------------------------
    // ROUND 1: Category Voting
    // ----------------------------------------
    const votes = week.votes.filter((v) => v.round === "ROUND_1_CATEGORY");
    if (votes.length === 0) return { success: false, error: "No votes have been cast yet." };

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
    if (votes.length === 0) return { success: false, error: "No votes have been cast yet." };

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
    if (votes.length === 0) return { success: false, error: "No votes have been cast yet." };

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
    if (votes.length === 0) return { success: false, error: "No votes have been cast yet." };

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
  return { success: true };
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

// 11c. Delete a completed Movie Night week (admin only)
export async function deleteCompletedWeekAction(weekId: string) {
  const currentUser = await getActiveUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw new Error("Unauthorized: Only Admin can delete past movie nights.");
  }

  // Confirm it is actually a completed week before deleting
  const week = await db.movieNightWeek.findUnique({ where: { id: weekId } });
  if (!week) throw new Error("Week not found.");
  if (!week.closedAt) throw new Error("Only completed (closed) weeks can be deleted.");

  // Cascade: votes are deleted automatically via Prisma schema onDelete:Cascade
  await db.movieNightWeek.delete({ where: { id: weekId } });
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
