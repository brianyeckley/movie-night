"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getActiveUser } from "./user";

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

  // Auto-advance checking:
  // Fetch total number of approved users
  const approvedUsers = await db.user.findMany({ where: { isApproved: true } });
  const totalVoters = approvedUsers.length;

  // Fetch all votes in the current round
  const votes = await db.weekVote.findMany({
    where: { weekId, round: "ROUND_1_CATEGORY" },
    include: { user: true },
  });
  const approvedVotes = votes.filter((v) => v.user.isApproved);
  const currentVotesCount = approvedVotes.length;
  const remainingVotersCount = totalVoters - currentVotesCount;

  // Count votes
  const counts: Record<string, number> = {};
  approvedVotes.forEach((v) => {
    counts[v.targetId] = (counts[v.targetId] || 0) + 1;
  });

  const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const maxCount = sortedCounts[0]?.[1] || 0;
  const runnerUpCount = sortedCounts[1]?.[1] || 0;

  if (maxCount > runnerUpCount + remainingVotersCount) {
    // Leading category has mathematically won! Trigger auto-advancement.
    const { advanceWeekRoundInternal } = await import("./week");
    await advanceWeekRoundInternal(weekId);
  }

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

  if (movieIds.length > 3) {
    throw new Error("You can select a maximum of 3 movies.");
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

// 9b. Submit Category Tiebreaker Votes (Round 1b)
export async function submitCategoryTiebreakerVotesAction(weekId: string, categoryIds: string[]) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  if (categoryIds.length > 2) {
    throw new Error("You can select a maximum of 2 categories.");
  }

  // Delete previous votes for this user in this round
  await db.weekVote.deleteMany({
    where: {
      weekId,
      userId: currentUser.id,
      round: "ROUND_1_CATEGORY_TIEBREAKER",
    },
  });

  // Create new votes
  for (const targetId of categoryIds) {
    await db.weekVote.create({
      data: {
        weekId,
        userId: currentUser.id,
        round: "ROUND_1_CATEGORY_TIEBREAKER",
        targetId,
      },
    });
  }

  revalidatePath("/");
}
