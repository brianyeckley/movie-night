"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getActiveUser } from "./user";
import { notifyRoundAdvanced } from "@/lib/discord";

// 1. Submit Votes for In-Person Movie Night (Dynamic limits based on week status)
export async function submitInPersonVotesAction(weekId: string, movieIds: string[]) {
  const currentUser = await getActiveUser();
  if (!currentUser) throw new Error("You must pick a user first.");

  const week = await db.movieNightWeek.findUnique({ where: { id: weekId } });
  if (!week) throw new Error("Week not found.");

  let roundCode = "";
  let minVotes = 1;
  let maxVotes = 1;

  if (week.status === "IN_PERSON_VOTING") {
    roundCode = "IN_PERSON_ROUND_1";
    maxVotes = 3;
  } else if (week.status === "IN_PERSON_TIEBREAKER") {
    roundCode = "IN_PERSON_ROUND_1B";
    maxVotes = 4;
  } else if (week.status === "IN_PERSON_ROUND_2") {
    roundCode = "IN_PERSON_ROUND_2";
    maxVotes = 1;
  } else if (week.status === "IN_PERSON_ROUND_3") {
    roundCode = "IN_PERSON_ROUND_3";
    maxVotes = 2;
  } else {
    throw new Error("Voting is not open for this round.");
  }

  if (movieIds.length < minVotes || movieIds.length > maxVotes) {
    if (maxVotes === 1) {
      throw new Error("Please select exactly 1 movie.");
    } else {
      throw new Error(`You can select between ${minVotes} and ${maxVotes} movies.`);
    }
  }

  // Delete any existing votes for this user in this round
  await db.weekVote.deleteMany({
    where: {
      weekId,
      userId: currentUser.id,
      round: roundCode,
    },
  });

  // Create new votes
  await db.weekVote.createMany({
    data: movieIds.map((movieId) => ({
      weekId,
      userId: currentUser.id,
      round: roundCode,
      targetId: movieId,
    })),
  });

  revalidatePath("/");
  return { success: true };
}

// 2. Submit Round 1b Tiebreaker Vote for In-Person Movie Night (1 vote) - Wrapper for compatibility
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
  await db.weekVote.createMany({
    data: [
      {
        weekId,
        userId: currentUser.id,
        round: "IN_PERSON_ROUND_1B",
        targetId: movieId,
      },
    ],
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
    // ROUND 1b: In-Person Tiebreaker (up to 4 votes)
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

    if (winners.length === 1) {
      // Outright winner!
      const winningId = winners[0];
      await db.movieNightWeek.update({
        where: { id: weekId },
        data: {
          winningMovieId: winningId,
          isRandomlyChosen: false,
          status: "COMPLETED",
        },
      });

      const movie = await db.movie.findUnique({ where: { id: winningId } });
      notifyRoundAdvanced(weekId, "IN_PERSON_TIEBREAKER", "COMPLETED", {
        winnerName: movie?.title,
        winnerYear: movie?.year,
        winnerPoster: movie?.posterUrl,
        isRandom: false,
      }).catch((e) => console.error("Discord notification error:", e));
    } else {
      // Tie persisted. Advance to Round 2 (Third Round - 1 vote) among the tied movies.
      await db.movieNightWeek.update({
        where: { id: weekId },
        data: {
          status: "IN_PERSON_ROUND_2",
        },
      });

      const tiedMovies = await db.movie.findMany({
        where: { id: { in: winners } },
        select: { title: true },
      });

      notifyRoundAdvanced(weekId, "IN_PERSON_TIEBREAKER", "IN_PERSON_ROUND_2", {
        tiedItems: tiedMovies.map((m) => m.title),
      }).catch((e) => console.error("Discord notification error:", e));
    }
  }
  else if (week.status === "IN_PERSON_ROUND_2") {
    // ----------------------------------------
    // ROUND 2 (Third Round): In-Person Tiebreaker (1 vote)
    // ----------------------------------------
    const votes = approvedVotes.filter((v) => v.round === "IN_PERSON_ROUND_2");
    if (votes.length === 0) return { success: false, error: "No votes have been cast yet." };

    // Count votes
    const counts: Record<string, number> = {};
    votes.forEach((v) => {
      counts[v.targetId] = (counts[v.targetId] || 0) + 1;
    });

    const maxVal = Math.max(...Object.values(counts));
    const winners = Object.keys(counts).filter((id) => counts[id] === maxVal);

    if (winners.length === 1) {
      // Outright winner!
      const winningId = winners[0];
      await db.movieNightWeek.update({
        where: { id: weekId },
        data: {
          winningMovieId: winningId,
          isRandomlyChosen: false,
          status: "COMPLETED",
        },
      });

      const movie = await db.movie.findUnique({ where: { id: winningId } });
      notifyRoundAdvanced(weekId, "IN_PERSON_ROUND_2", "COMPLETED", {
        winnerName: movie?.title,
        winnerYear: movie?.year,
        winnerPoster: movie?.posterUrl,
        isRandom: false,
      }).catch((e) => console.error("Discord notification error:", e));
    } else {
      // Tie persisted. Check if number of remaining tied movies equals number of voters.
      const votersCount = await db.user.count({
        where: { isApproved: true },
      });

      if (winners.length === votersCount) {
        // Advance to a final voting round of 2 votes each
        await db.movieNightWeek.update({
          where: { id: weekId },
          data: {
            status: "IN_PERSON_ROUND_3",
          },
        });

        const tiedMovies = await db.movie.findMany({
          where: { id: { in: winners } },
          select: { title: true },
        });

        notifyRoundAdvanced(weekId, "IN_PERSON_ROUND_2", "IN_PERSON_ROUND_3", {
          tiedItems: tiedMovies.map((m) => m.title),
        }).catch((e) => console.error("Discord notification error:", e));
      } else {
        // Otherwise, resolve via random draw
        const randIdx = Math.floor(Math.random() * winners.length);
        const winningId = winners[randIdx];

        await db.movieNightWeek.update({
          where: { id: weekId },
          data: {
            winningMovieId: winningId,
            isRandomlyChosen: true,
            status: "COMPLETED",
          },
        });

        const movie = await db.movie.findUnique({ where: { id: winningId } });
        notifyRoundAdvanced(weekId, "IN_PERSON_ROUND_2", "COMPLETED", {
          winnerName: movie?.title,
          winnerYear: movie?.year,
          winnerPoster: movie?.posterUrl,
          isRandom: true,
        }).catch((e) => console.error("Discord notification error:", e));
      }
    }
  }
  else if (week.status === "IN_PERSON_ROUND_3") {
    // ----------------------------------------
    // ROUND 3 (Final Round): In-Person Tiebreaker (up to 2 votes)
    // ----------------------------------------
    const votes = approvedVotes.filter((v) => v.round === "IN_PERSON_ROUND_3");
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
    notifyRoundAdvanced(weekId, "IN_PERSON_ROUND_3", "COMPLETED", {
      winnerName: movie?.title,
      winnerYear: movie?.year,
      winnerPoster: movie?.posterUrl,
      isRandom,
    }).catch((e) => console.error("Discord notification error:", e));
  }

  revalidatePath("/");
  return { success: true };
}

