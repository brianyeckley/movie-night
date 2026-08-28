"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getActiveUser } from "./user";
import { notifyNewWeek } from "@/lib/discord";
import { advanceWeekRound } from "@/lib/round-engine";
import { approvedVotesForRound, roundCodeForStatus } from "@/lib/rounds";
import { ACTIVE_WEEK } from "@/lib/weeks";

// 2. Create new Movie Night Week
export async function createWeekAction(themeCategoryName?: string, isInPerson: boolean = false) {
  const currentUser = await getActiveUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw new Error("Unauthorized: Only Admin can create weeks.");
  }

  // A week counts as active until it is closed out, which includes a week
  // that already has a winner but has not been marked watched yet.
  const activeWeek = await db.movieNightWeek.findFirst({ where: ACTIVE_WEEK });
  if (activeWeek) {
    throw new Error(
      "An active week is already in progress. Close it out before starting the next one."
    );
  }

  // Get current week number
  const lastWeek = await db.movieNightWeek.findFirst({
    orderBy: { weekNumber: "desc" },
  });
  const nextWeekNumber = lastWeek ? lastWeek.weekNumber + 1 : 1;

  let themeCategoryId: string | null = null;

  if (isInPerson) {
    // For In-Person, we default the category theme to "In Person Physical Media" if not provided
    const catName = themeCategoryName || "In Person Physical Media";
    let themeCategory = await db.category.findUnique({
      where: { name: catName },
    });

    if (themeCategory) {
      themeCategory = await db.category.update({
        where: { id: themeCategory.id },
        data: { isActive: true, isThemed: true },
      });
    } else {
      themeCategory = await db.category.create({
        data: {
          name: catName,
          isThemed: true,
          isActive: true,
        },
      });
    }
    themeCategoryId = themeCategory.id;
  } else {
    if (!themeCategoryName) {
      throw new Error("Theme category name is required.");
    }

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
    themeCategoryId = themeCategory.id;
  }

  // Create the week
  const week = await db.movieNightWeek.create({
    data: {
      weekNumber: nextWeekNumber,
      status: isInPerson ? "IN_PERSON_VOTING" : "CATEGORY_VOTING",
      themeCategoryId,
      isInPerson,
    },
  });

  notifyNewWeek(week.id).catch((err) => {
    console.error("Failed to send Discord notification for new week:", err);
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

  const roundStr = roundCodeForStatus(week.status);
  if (!roundStr) {
    throw new Error("There is no open voting round to reset.");
  }

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
    include: { votes: { include: { user: true } } },
  });
  if (!week) return { success: false, error: "Week not found." };

  // Determine if everyone has voted in the current active round
  const activeRoundCode = roundCodeForStatus(week.status);

  const roundVotedUserIds = activeRoundCode
    ? approvedVotesForRound(week.votes, activeRoundCode).map((v) => v.userId)
    : [];

  const allUsers = await db.user.findMany({
    where: { isApproved: true },
  });
  const allVotesIn = allUsers.every((u) => roundVotedUserIds.includes(u.id));

  const isAdmin = currentUser.role === "ADMIN";
  if (!isAdmin && !allVotesIn) {
    return { success: false, error: "Unauthorized: Only Admin can advance before all votes are in." };
  }

  return advanceWeekRound(weekId, week);
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
