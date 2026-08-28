"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getActiveUser } from "./user";
import { advanceWeekRound } from "@/lib/round-engine";
import { tallyVotes, type RoundCode } from "@/lib/rounds";

/**
 * Replace this user's votes for one round.
 *
 * The delete and the inserts run in a single transaction: without one, a
 * failure partway through leaves the user with their old votes already gone
 * and only some of the new ones written.
 */
async function replaceVotes({
  weekId,
  userId,
  round,
  targetIds,
}: {
  weekId: string;
  userId: string;
  round: RoundCode;
  targetIds: string[];
}) {
  await db.$transaction([
    db.weekVote.deleteMany({ where: { weekId, userId, round } }),
    db.weekVote.createMany({
      data: targetIds.map((targetId) => ({
        weekId,
        userId,
        round,
        targetId,
      })),
    }),
  ]);
}

/** Resolve the signed-in user and reject a selection that breaks the limit. */
async function prepareVote(targetIds: string[], maxVotes: number, limitError: string) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");
  if (targetIds.length > maxVotes) throw new Error(limitError);
  return currentUser;
}

// 5. Submit Category Vote (Round 1)
export async function submitCategoryVoteAction(weekId: string, categoryId: string) {
  const currentUser = await prepareVote(
    [categoryId],
    1,
    "You can select a maximum of 1 category."
  );

  await replaceVotes({
    weekId,
    userId: currentUser.id,
    round: "ROUND_1_CATEGORY",
    targetIds: [categoryId],
  });

  // Auto-advance when the leader can no longer be caught by the votes still
  // outstanding, so the round does not sit waiting on a foregone conclusion.
  const approvedUsers = await db.user.findMany({ where: { isApproved: true } });

  const votes = await db.weekVote.findMany({
    where: { weekId, round: "ROUND_1_CATEGORY" },
    include: { user: true },
  });
  const approved = votes.filter((v) => v.user.isApproved);
  const remainingVoters = approvedUsers.length - approved.length;

  const { counts } = tallyVotes(approved);
  const [maxCount = 0, runnerUpCount = 0] = Object.values(counts).sort(
    (a, b) => b - a
  );

  if (maxCount > runnerUpCount + remainingVoters) {
    await advanceWeekRound(weekId);
  }

  revalidatePath("/");
}

// 6. Submit Movie/Subcategory Votes (Round 2)
export async function submitMovieVotesAction(weekId: string, targets: string[]) {
  const currentUser = await prepareVote(
    targets,
    2,
    "You can select a maximum of 2 options."
  );

  await replaceVotes({
    weekId,
    userId: currentUser.id,
    round: "ROUND_2_MOVIE",
    targetIds: targets,
  });

  revalidatePath("/");
}

// 7. Submit Subcategory Movie Votes (Round 2b / 2c)
export async function submitSubMovieVotesAction(
  weekId: string,
  movieIds: string[],
  roundCode: string = "ROUND_2_SUB_MOVIE"
) {
  const isRound2c = roundCode === "ROUND_2C_SUB_MOVIE";
  const currentUser = await prepareVote(
    movieIds,
    isRound2c ? 1 : 3,
    isRound2c
      ? "You can select a maximum of 1 option."
      : "You can select a maximum of 3 movies."
  );

  await replaceVotes({
    weekId,
    userId: currentUser.id,
    round: roundCode as RoundCode,
    targetIds: movieIds,
  });

  revalidatePath("/");
}

// 8. Submit Shortlist Votes (Round 3)
export async function submitShortlistVotesAction(weekId: string, movieIds: string[]) {
  const week = await db.movieNightWeek.findUnique({ where: { id: weekId } });
  // A shortlist drawn from a single subcategory is a straight pick, not a rank.
  const maxAllowed = week?.selectedSubcategoryId ? 1 : 3;

  const currentUser = await prepareVote(
    movieIds,
    maxAllowed,
    maxAllowed === 1
      ? "You can select a maximum of 1 movie."
      : "You can select a maximum of 3 movies."
  );

  await replaceVotes({
    weekId,
    userId: currentUser.id,
    round: "ROUND_3_SHORTLIST",
    targetIds: movieIds,
  });

  revalidatePath("/");
}

// 9. Submit Final Tiebreaker Vote (Round 4)
export async function submitFinalVoteAction(weekId: string, movieId: string) {
  const currentUser = await prepareVote(
    [movieId],
    1,
    "You can select a maximum of 1 movie."
  );

  await replaceVotes({
    weekId,
    userId: currentUser.id,
    round: "ROUND_4_TIEBREAKER",
    targetIds: [movieId],
  });

  revalidatePath("/");
}

// 9b. Submit Category Tiebreaker Votes (Round 1b)
export async function submitCategoryTiebreakerVotesAction(
  weekId: string,
  categoryIds: string[]
) {
  const currentUser = await prepareVote(
    categoryIds,
    2,
    "You can select a maximum of 2 categories."
  );

  await replaceVotes({
    weekId,
    userId: currentUser.id,
    round: "ROUND_1_CATEGORY_TIEBREAKER",
    targetIds: categoryIds,
  });

  revalidatePath("/");
}
