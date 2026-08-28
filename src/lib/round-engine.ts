/**
 * The voting round state machine.
 *
 * This module deliberately lives outside `src/app/actions`. Every exported
 * function in a `"use server"` file is a publicly callable server action, so
 * an unguarded "internal" advance function sitting next to a guarded one is
 * reachable by anyone. Keeping the engine here means the only exported
 * surface is `advanceWeekRoundAction`, which does the authorisation.
 */

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { notifyRoundAdvanced } from "@/lib/discord";
import { approvedVotesForRound, tallyVotes, type RoundCode } from "@/lib/rounds";

/**
 * A week loaded with its votes and each vote's user.
 *
 * Only `id`, `status` and `votes` are read on every path. The rest are
 * consulted by particular standard-week transitions, so they are optional and
 * a caller may pass a narrower object when the path being exercised does not
 * need them.
 */
export type WeekWithVotes = {
  id: string;
  status: string;
  isInPerson?: boolean;
  selectedCategoryId?: string | null;
  selectedSubcategoryId?: string | null;
  votes: Array<{
    round: string;
    targetId: string;
    userId?: string;
    user: { isApproved: boolean; name: string };
  }>;
};

export interface AdvanceResult {
  success: boolean;
  error?: string;
}

/**
 * Advance a standard (non in-person) week to its next status.
 *
 * Performs no authorisation of its own - callers must do that first.
 */
export async function advanceWeekRound(
  weekId: string,
  preloadedWeek?: WeekWithVotes
): Promise<AdvanceResult> {
  const week = preloadedWeek ?? await db.movieNightWeek.findUnique({
    where: { id: weekId },
    include: { votes: { include: { user: true } } },
  });
  if (!week) return { success: false, error: "Week not found." };

  if (week.isInPerson) {
    return advanceInPersonWeekRound(weekId, week);
  }

  /** Tally the approved votes cast in one round of this week. */
  const roundTally = (round: RoundCode) =>
    tallyVotes(approvedVotesForRound(week.votes, round));

  // State Machine Transitions
  if (week.status === "CATEGORY_VOTING") {
    // ----------------------------------------
    // ROUND 1: Category Voting
    // ----------------------------------------
    const { tiedIds: winners, total } = roundTally("ROUND_1_CATEGORY");
    if (total === 0) return { success: false, error: "No votes have been cast yet." };

    if (winners.length > 1) {
      // Tie breaker round: transition to CATEGORY_TIEBREAKER_VOTING
      await db.movieNightWeek.update({
        where: { id: weekId },
        data: {
          status: "CATEGORY_TIEBREAKER_VOTING",
        },
      });

      const tiedCategories = await db.category.findMany({
        where: { id: { in: winners } },
      });

      notifyRoundAdvanced(weekId, "CATEGORY_VOTING", "CATEGORY_TIEBREAKER_VOTING", {
        tiedItems: tiedCategories.map((c) => c.name),
      }).catch((e) => console.error("Discord notification error:", e));
    } else {
      // Outright winner! Transition to MOVIE_VOTING
      const winnerId = winners[0];
      const winnerCategory = await db.category.findUnique({
        where: { id: winnerId },
      });
      const winnerName = winnerCategory?.name || "Unknown";

      await db.movieNightWeek.update({
        where: { id: weekId },
        data: {
          selectedCategoryId: winnerId,
          status: "MOVIE_VOTING",
        },
      });

      notifyRoundAdvanced(weekId, "CATEGORY_VOTING", "MOVIE_VOTING", {
        winnerName,
        isRandom: false,
      }).catch((e) => console.error("Discord notification error:", e));
    }
  } 
  else if (week.status === "CATEGORY_TIEBREAKER_VOTING") {
    // ----------------------------------------
    // ROUND 1b: Category Tiebreaker Voting
    // ----------------------------------------
    const { tiedIds: winners, total } = roundTally("ROUND_1_CATEGORY_TIEBREAKER");
    if (total === 0) return { success: false, error: "No votes have been cast yet." };

    let winnerId = winners[0];
    let isRandom = false;

    if (winners.length > 1) {
      // Tie persisted in tiebreaker. Draw a random winner from top tied categories!
      const randIdx = Math.floor(Math.random() * winners.length);
      winnerId = winners[randIdx];
      isRandom = true;
    }

    const winnerCategory = await db.category.findUnique({
      where: { id: winnerId },
    });
    const winnerName = winnerCategory?.name || "Unknown";

    await db.movieNightWeek.update({
      where: { id: weekId },
      data: {
        selectedCategoryId: winnerId,
        status: "MOVIE_VOTING",
      },
    });

    notifyRoundAdvanced(weekId, "CATEGORY_TIEBREAKER_VOTING", "MOVIE_VOTING", {
      winnerName,
      isRandom,
    }).catch((e) => console.error("Discord notification error:", e));
  } 
  else if (week.status === "MOVIE_VOTING") {
    // ----------------------------------------
    // ROUND 2: Movie/Subcategory Voting
    // ----------------------------------------
    const { tiedIds: topItems, total } = roundTally("ROUND_2_MOVIE");
    if (total === 0) return { success: false, error: "No votes have been cast yet." };

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

        notifyRoundAdvanced(weekId, "MOVIE_VOTING", "SUBCATEGORY_VOTING", {
          winnerName: category.name,
        }).catch((e) => console.error("Discord notification error:", e));
      } else {
        // It's a movie! It wins the week immediately
        await db.movieNightWeek.update({
          where: { id: weekId },
          data: {
            winningMovieId: winningId,
            status: "COMPLETED",
          },
        });

        const movie = await db.movie.findUnique({ where: { id: winningId } });
        notifyRoundAdvanced(weekId, "MOVIE_VOTING", "COMPLETED", {
          winnerName: movie?.title,
          winnerYear: movie?.year,
          winnerPoster: movie?.posterUrl,
        }).catch((e) => console.error("Discord notification error:", e));
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

        const tiedMovies = await db.movie.findMany({
          where: { id: { in: topItems } },
          select: { title: true },
        });
        const tiedNames = [
          ...categories.map((c) => c.name),
          ...tiedMovies.map((m) => m.title),
        ];

        notifyRoundAdvanced(weekId, "MOVIE_VOTING", "SUBCATEGORY_VOTING", {
          tiedItems: tiedNames,
          isTie: true,
        }).catch((e) => console.error("Discord notification error:", e));
      } else {
        // All top tied items are movies. Transition straight to SHORTLIST_VOTING.
        await db.movieNightWeek.update({
          where: { id: weekId },
          data: {
            status: "SHORTLIST_VOTING",
          },
        });

        const tiedMovies = await db.movie.findMany({
          where: { id: { in: topItems } },
          select: { title: true },
        });
        notifyRoundAdvanced(weekId, "MOVIE_VOTING", "SHORTLIST_VOTING", {
          tiedItems: tiedMovies.map(m => m.title),
        }).catch((e) => console.error("Discord notification error:", e));
      }
    }
  } 
  else if (week.status === "SUBCATEGORY_VOTING") {
    // ----------------------------------------
    // ROUND 2b: Subcategory Movie Voting
    // ----------------------------------------
    const { tiedIds: topItems, total } = roundTally("ROUND_2_SUB_MOVIE");
    if (total === 0) return { success: false, error: "No votes have been cast yet." };

    if (topItems.length === 1) {
      // Outright winner!
      const winningId = topItems[0];

      // Check if the winner is a Subcategory or a Movie
      const category = await db.category.findUnique({
        where: { id: winningId },
      });

      if (category) {
        // Subcategory won outright (in tiebreaker mode). Transition to SHORTLIST_VOTING.
        await db.movieNightWeek.update({
          where: { id: weekId },
          data: {
            status: "SHORTLIST_VOTING",
          },
        });

        notifyRoundAdvanced(weekId, "SUBCATEGORY_VOTING", "SHORTLIST_VOTING", {
          winnerName: category.name,
        }).catch((e) => console.error("Discord notification error:", e));
      } else {
        // A movie won outright! It wins the week immediately.
        await db.movieNightWeek.update({
          where: { id: weekId },
          data: {
            winningMovieId: winningId,
            status: "COMPLETED",
          },
        });

        const movie = await db.movie.findUnique({ where: { id: winningId } });
        notifyRoundAdvanced(weekId, "SUBCATEGORY_VOTING", "COMPLETED", {
          winnerName: movie?.title,
          winnerYear: movie?.year,
          winnerPoster: movie?.posterUrl,
        }).catch((e) => console.error("Discord notification error:", e));
      }
    } else {
      // Tie in Round 2b!
      // Check if topItems includes any Subcategory (tiebreaker mode)
      const categories = await db.category.findMany({
        where: { id: { in: topItems } },
        select: { id: true, name: true },
      });

      if (categories.length > 0) {
        // Tie in Round 2b tiebreaker mode! Transition to SUBCATEGORY_TIEBREAKER_VOTING (Round 2c)!
        await db.movieNightWeek.update({
          where: { id: weekId },
          data: {
            status: "SUBCATEGORY_TIEBREAKER_VOTING",
          },
        });

        const tiedMovies = await db.movie.findMany({
          where: { id: { in: topItems } },
          select: { title: true },
        });
        const tiedNames = [
          ...categories.map((c) => c.name),
          ...tiedMovies.map((m) => m.title),
        ];

        notifyRoundAdvanced(weekId, "SUBCATEGORY_VOTING", "SUBCATEGORY_TIEBREAKER_VOTING", {
          tiedItems: tiedNames,
        }).catch((e) => console.error("Discord notification error:", e));
      } else {
        // Normal mode (movies inside winning subcategory). Transition to SHORTLIST_VOTING.
        await db.movieNightWeek.update({
          where: { id: weekId },
          data: {
            status: "SHORTLIST_VOTING",
          },
        });

        const tiedMovies = await db.movie.findMany({
          where: { id: { in: topItems } },
          select: { title: true },
        });

        notifyRoundAdvanced(weekId, "SUBCATEGORY_VOTING", "SHORTLIST_VOTING", {
          tiedItems: tiedMovies.map((m) => m.title),
        }).catch((e) => console.error("Discord notification error:", e));
      }
    }
  } 
  else if (week.status === "SUBCATEGORY_TIEBREAKER_VOTING") {
    // ----------------------------------------
    // ROUND 2c: Subcategory Tiebreaker Voting (1 vote per user)
    // ----------------------------------------
    const { tiedIds: topItems, total } = roundTally("ROUND_2C_SUB_MOVIE");
    if (total === 0) return { success: false, error: "No votes have been cast yet." };

    let winnerId = topItems[0];
    let isRandom = false;

    if (topItems.length > 1) {
      // Tie persisted in Round 2c tiebreaker. Draw a random winner from top tied items!
      const randIdx = Math.floor(Math.random() * topItems.length);
      winnerId = topItems[randIdx];
      isRandom = true;
    }

    const category = await db.category.findUnique({
      where: { id: winnerId },
    });

    if (category) {
      // Subcategory won Round 2c! Transition to SHORTLIST_VOTING.
      await db.movieNightWeek.update({
        where: { id: weekId },
        data: {
          selectedSubcategoryId: winnerId,
          status: "SHORTLIST_VOTING",
        },
      });

      notifyRoundAdvanced(weekId, "SUBCATEGORY_TIEBREAKER_VOTING", "SHORTLIST_VOTING", {
        winnerName: category.name,
        isRandom,
      }).catch((e) => console.error("Discord notification error:", e));
    } else {
      // Movie won Round 2c! It wins the week immediately.
      await db.movieNightWeek.update({
        where: { id: weekId },
        data: {
          winningMovieId: winnerId,
          isRandomlyChosen: isRandom,
          status: "COMPLETED",
        },
      });

      const movie = await db.movie.findUnique({ where: { id: winnerId } });
      notifyRoundAdvanced(weekId, "SUBCATEGORY_TIEBREAKER_VOTING", "COMPLETED", {
        winnerName: movie?.title,
        winnerYear: movie?.year,
        winnerPoster: movie?.posterUrl,
        isRandom,
      }).catch((e) => console.error("Discord notification error:", e));
    }
  } 
  else if (week.status === "SHORTLIST_VOTING") {
    // ----------------------------------------
    // ROUND 3: Shortlist Voting (3 votes per user)
    // ----------------------------------------
    const { tiedIds: topMovies, total } = roundTally("ROUND_3_SHORTLIST");
    if (total === 0) return { success: false, error: "No votes have been cast yet." };

    if (topMovies.length === 1) {
      // Outright winner!
      await db.movieNightWeek.update({
        where: { id: weekId },
        data: {
          winningMovieId: topMovies[0],
          status: "COMPLETED",
        },
      });

      const movie = await db.movie.findUnique({ where: { id: topMovies[0] } });
      notifyRoundAdvanced(weekId, "SHORTLIST_VOTING", "COMPLETED", {
        winnerName: movie?.title,
        winnerYear: movie?.year,
        winnerPoster: movie?.posterUrl,
      }).catch((e) => console.error("Discord notification error:", e));
    } else {
      // Tie! Transition to final tiebreaker
      await db.movieNightWeek.update({
        where: { id: weekId },
        data: {
          status: "FINAL_VOTING",
        },
      });

      const tiedMovies = await db.movie.findMany({
        where: { id: { in: topMovies } },
        select: { title: true },
      });
      notifyRoundAdvanced(weekId, "SHORTLIST_VOTING", "FINAL_VOTING", {
        tiedItems: tiedMovies.map(m => m.title),
      }).catch((e) => console.error("Discord notification error:", e));
    }
  } 
  else if (week.status === "FINAL_VOTING") {
    // ----------------------------------------
    // ROUND 4: Tiebreaker (1 vote per user)
    // ----------------------------------------
    const { tiedIds: winners, total } = roundTally("ROUND_4_TIEBREAKER");
    if (total === 0) return { success: false, error: "No votes have been cast yet." };

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

    const movie = await db.movie.findUnique({ where: { id: winnerId } });
    notifyRoundAdvanced(weekId, "FINAL_VOTING", "COMPLETED", {
      winnerName: movie?.title,
      winnerYear: movie?.year,
      winnerPoster: movie?.posterUrl,
      isRandom,
    }).catch((e) => console.error("Discord notification error:", e));
  }

  revalidatePath("/");
  return { success: true };
}

/**
 * Advance an in-person week to its next status.
 *
 * Performs no authorisation of its own - callers must do that first.
 */
export async function advanceInPersonWeekRound(
  weekId: string,
  preloadedWeek?: WeekWithVotes
): Promise<AdvanceResult> {
  const week = preloadedWeek ?? await db.movieNightWeek.findUnique({
    where: { id: weekId },
    include: { votes: { include: { user: true } } },
  });
  if (!week) return { success: false, error: "Week not found." };

  /** Tally the approved votes cast in one round of this week. */
  const roundTally = (round: RoundCode) =>
    tallyVotes(approvedVotesForRound(week.votes, round));

  if (week.status === "IN_PERSON_VOTING") {
    // ----------------------------------------
    // ROUND 1: In-Person Voting (3 votes)
    // ----------------------------------------
    const { counts, tiedIds: topMovies, total } = roundTally("IN_PERSON_ROUND_1");
    if (total === 0) return { success: false, error: "No votes have been cast yet." };

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
      // Tie! Every movie that received a vote advances to Round 1b
      const candidateIds = Object.keys(counts);

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
    const { tiedIds: winners, total } = roundTally("IN_PERSON_ROUND_1B");
    if (total === 0) return { success: false, error: "No votes have been cast yet." };

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
    const { tiedIds: winners, total } = roundTally("IN_PERSON_ROUND_2");
    if (total === 0) return { success: false, error: "No votes have been cast yet." };

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
    const { tiedIds: winners, total } = roundTally("IN_PERSON_ROUND_3");
    if (total === 0) return { success: false, error: "No votes have been cast yet." };

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
