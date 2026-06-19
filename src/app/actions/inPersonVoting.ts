"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getActiveUser } from "./user";
import { notifyRoundAdvanced } from "@/lib/discord";

// 1. Submit Round 1 Votes for In-Person Movie Night (Up to 3 votes)
export async function submitInPersonVotesAction(weekId: string, movieIds: string[]) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  const week = await db.movieNightWeek.findUnique({ where: { id: weekId } });
  if (!week) throw new Error("Week not found.");
  if (week.status !== "IN_PERSON_VOTING") {
    throw new Error("Voting is not open for this round.");
  }

  if (movieIds.length === 0 || movieIds.length > 3) {
    throw new Error("You can select between 1 and 3 movies.");
  }

  // Delete any existing votes for this user in this round
  await db.weekVote.deleteMany({
    where: {
      weekId,
      userId: currentUser.id,
      round: "IN_PERSON_ROUND_1",
    },
  });

  // Create new votes
  await db.weekVote.createMany({
    data: movieIds.map((movieId) => ({
      weekId,
      userId: currentUser.id,
      round: "IN_PERSON_ROUND_1",
      targetId: movieId,
    })),
  });

  revalidatePath("/");
  return { success: true };
}

// 2. Submit Round 1b Tiebreaker Vote for In-Person Movie Night (1 vote)
export async function submitInPersonTiebreakerVoteAction(weekId: string, movieId: string) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  const week = await db.movieNightWeek.findUnique({ where: { id: weekId } });
  if (!week) throw new Error("Week not found.");
  if (week.status !== "IN_PERSON_TIEBREAKER") {
    throw new Error("Voting is not open for this round.");
  }

  if (!movieId) throw new Error("Please select a movie.");

  // Delete any existing votes for this user in this round
  await db.weekVote.deleteMany({
    where: {
      weekId,
      userId: currentUser.id,
      round: "IN_PERSON_ROUND_1B",
    },
  });

  // Create new vote
  await db.weekVote.create({
    data: {
      weekId,
      userId: currentUser.id,
      round: "IN_PERSON_ROUND_1B",
      targetId: movieId,
    },
  });

  revalidatePath("/");
  return { success: true };
}

// 3. Advance In-Person Round (State Machine)
export async function advanceInPersonWeekRound(weekId: string, preloadedWeek?: any) {
  const week = preloadedWeek ?? await db.movieNightWeek.findUnique({
    where: { id: weekId },
    include: { votes: { include: { user: true } } },
  });
  if (!week) return { success: false, error: "Week not found." };

  const approvedVotes = (week.votes as Array<{
    round: string;
    targetId: string;
    userId: string;
    user: { isApproved: boolean; name: string };
  }>).filter((v) => v.user.isApproved);

  if (week.status === "IN_PERSON_VOTING") {
    // ----------------------------------------
    // ROUND 1: In-Person Voting (3 votes)
    // ----------------------------------------
    const votes = approvedVotes.filter((v) => v.round === "IN_PERSON_ROUND_1");
    if (votes.length === 0) return { success: false, error: "No votes have been cast yet." };

    // Count votes
    const counts: Record<string, number> = {};
    votes.forEach((v) => {
      counts[v.targetId] = (counts[v.targetId] || 0) + 1;
    });

    const maxVal = Math.max(...Object.values(counts));
    const topMovies = Object.keys(counts).filter((id) => counts[id] === maxVal);

    if (topMovies.length === 1) {
      // Outright winner!
      const winningId = topMovies[0];
      await db.movieNightWeek.update({
        where: { id: weekId },
        data: {
          winningMovieId: winningId,
          status: "COMPLETED",
        },
      });

      const movie = await db.movie.findUnique({ where: { id: winningId } });
      notifyRoundAdvanced(weekId, "IN_PERSON_VOTING", "COMPLETED", {
        winnerName: movie?.title,
        winnerYear: movie?.year,
        winnerPoster: movie?.posterUrl,
      }).catch((e) => console.error("Discord notification error:", e));
    } else {
      // Tie! All movies that got at least 1 vote advance to Round 1b
      const candidateIds = Object.keys(counts).filter((id) => counts[id] >= 1);

      await db.movieNightWeek.update({
        where: { id: weekId },
        data: {
          status: "IN_PERSON_TIEBREAKER",
        },
      });

      const tiedMovies = await db.movie.findMany({
        where: { id: { in: candidateIds } },
        select: { title: true },
      });

      notifyRoundAdvanced(weekId, "IN_PERSON_VOTING", "IN_PERSON_TIEBREAKER", {
        tiedItems: tiedMovies.map((m) => m.title),
      }).catch((e) => console.error("Discord notification error:", e));
    }
  } 
  else if (week.status === "IN_PERSON_TIEBREAKER") {
    // ----------------------------------------
    // ROUND 1b: In-Person Tiebreaker (1 vote)
    // ----------------------------------------
    const votes = approvedVotes.filter((v) => v.round === "IN_PERSON_ROUND_1B");
    if (votes.length === 0) return { success: false, error: "No votes have been cast yet." };

    // Count votes
    const counts: Record<string, number> = {};
    votes.forEach((v) => {
      counts[v.targetId] = (counts[v.targetId] || 0) + 1;
    });

    const maxVal = Math.max(...Object.values(counts));
    const winners = Object.keys(counts).filter((id) => counts[id] === maxVal);

    let winnerId = winners[0];
    let isRandom = false;

    if (winners.length > 1) {
      // Tie persisted. Draw a random winner!
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

    const movie = await db.movie.findUnique({ where: { id: winnerId } });
    notifyRoundAdvanced(weekId, "IN_PERSON_TIEBREAKER", "COMPLETED", {
      winnerName: movie?.title,
      winnerYear: movie?.year,
      winnerPoster: movie?.posterUrl,
      isRandom,
    }).catch((e) => console.error("Discord notification error:", e));
  }

  revalidatePath("/");
  return { success: true };
}
