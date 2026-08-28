"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getActiveUser } from "./user";
import { IN_PERSON_ROUNDS, type InPersonStatus } from "@/lib/rounds";

// 1. Submit Votes for In-Person Movie Night (Dynamic limits based on week status)
export async function submitInPersonVotesAction(weekId: string, movieIds: string[]) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  const week = await db.movieNightWeek.findUnique({ where: { id: weekId } });
  if (!week) throw new Error("Week not found.");

  const round = IN_PERSON_ROUNDS[week.status as InPersonStatus];
  if (!round) {
    throw new Error("Voting is not open for this round.");
  }
  const { code: roundCode, maxVotes } = round;

  if (movieIds.length < 1 || movieIds.length > maxVotes) {
    throw new Error(
      maxVotes === 1
        ? "Please select exactly 1 movie."
        : `You can select between 1 and ${maxVotes} movies.`
    );
  }

  // Swap the user's votes for this round atomically - a failure partway
  // through would otherwise drop the old votes and keep only some new ones.
  await db.$transaction([
    db.weekVote.deleteMany({
      where: {
        weekId,
        userId: currentUser.id,
        round: roundCode,
      },
    }),
    db.weekVote.createMany({
      data: movieIds.map((movieId) => ({
        weekId,
        userId: currentUser.id,
        round: roundCode,
        targetId: movieId,
      })),
    }),
  ]);

  revalidatePath("/");
  return { success: true };
}

