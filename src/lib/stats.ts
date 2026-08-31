import { db } from "@/lib/db";
import type { MovieWithGenresAndCategory } from "@/lib/types";

export interface UserTastemakerStats {
  user: { id: string; name: string; username: string; role: string };
  totalWins: number;
  weeksParticipated: number;
  winRate: number;
  winningMovies: {
    weekNumber: number;
    movie: MovieWithGenresAndCategory;
  }[];
}

export interface KingmakerStats {
  user: { id: string; name: string; username: string };
  correctFinalVotes: number;
  totalFinalRounds: number;
  accuracy: number;
}

export interface FilmSnobStats {
  user: { id: string; name: string; username: string };
  soloPickCount: number;
  soloMovies: {
    title: string;
    year: number | null;
    weekNumber: number;
  }[];
}

export interface DynamicDuoStats {
  userA: { id: string; name: string };
  userB: { id: string; name: string };
  agreementScore: number;
  sharedVotesCount: number;
  sharedRoundsCount: number;
}

export interface GlobalMovieStats {
  totalWeeks: number;
  totalWatchTimeMinutes: number;
  formattedWatchTime: string;
  averageRating: number | null;
  topGenre: { name: string; count: number } | null;
  longestMovie: { title: string; runtime: string; minutes: number } | null;
  shortestMovie: { title: string; runtime: string; minutes: number } | null;
  highestRatedMovie: { title: string; rating: number } | null;
  physicalMedia: {
    fourK: number;
    bluRay: number;
    dvd: number;
    digitalOnly: number;
  };
}

export interface LeaderboardData {
  tastemakers: UserTastemakerStats[];
  kingmaker: KingmakerStats | null;
  kingmakersList: KingmakerStats[];
  filmSnob: FilmSnobStats | null;
  filmSnobsList: FilmSnobStats[];
  dynamicDuo: DynamicDuoStats | null;
  globalStats: GlobalMovieStats;
}

export function parseRuntimeMinutes(runtimeStr?: string | null): number {
  if (!runtimeStr) return 0;
  const str = runtimeStr.toLowerCase().trim();

  const hourMatch = str.match(/(\d+)\s*(?:h|hr|hours?)/);
  const minMatch = str.match(/(\d+)\s*(?:m|min|mins|minutes?)/);

  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    const mins = minMatch ? parseInt(minMatch[1], 10) : 0;
    return hours * 60 + mins;
  }

  if (minMatch) {
    return parseInt(minMatch[1], 10);
  }

  const justDigits = str.match(/\b\d+\b/);
  if (justDigits) {
    return parseInt(justDigits[0], 10);
  }

  return 0;
}

export function formatWatchTime(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0m";
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

const INITIAL_MOVIE_ROUNDS = new Set([
  "ROUND_2_MOVIE",
  "ROUND_2_SUB_MOVIE",
  "IN_PERSON_ROUND_1",
]);

const FINAL_ROUND_PRIORITY = [
  "IN_PERSON_ROUND_3",
  "IN_PERSON_ROUND_2",
  "IN_PERSON_ROUND_1B",
  "IN_PERSON_ROUND_1",
  "ROUND_4_TIEBREAKER",
  "ROUND_3_SHORTLIST",
  "ROUND_2C_SUB_MOVIE",
  "ROUND_2_SUB_MOVIE",
  "ROUND_2_MOVIE",
];

export async function getLeaderboardStats(): Promise<LeaderboardData> {
  const users = await db.user.findMany({
    where: { isApproved: true },
    orderBy: { name: "asc" },
  });

  const closedWeeks = await db.movieNightWeek.findMany({
    where: {
      NOT: { closedAt: null },
      winningMovieId: { not: null },
    },
    include: {
      votes: {
        include: { user: true },
      },
      themeCategory: true,
    },
    orderBy: { weekNumber: "asc" },
  });

  const winnerIds = closedWeeks
    .map((w) => w.winningMovieId)
    .filter((id): id is string => Boolean(id));

  const allVotedMovieIds = Array.from(
    new Set(
      closedWeeks.flatMap((w) =>
        w.votes
          .filter((v) => INITIAL_MOVIE_ROUNDS.has(v.round))
          .map((v) => v.targetId)
      )
    )
  );

  const movies = await db.movie.findMany({
    where: { id: { in: Array.from(new Set([...winnerIds, ...allVotedMovieIds])) } },
    include: { category: true, genres: true },
  });

  const movieById = new Map<string, MovieWithGenresAndCategory>(
    movies.map((m) => [m.id, m])
  );

  // 1. Tastemakers Calculation
  const tastemakerMap = new Map<
    string,
    {
      user: { id: string; name: string; username: string; role: string };
      totalWins: number;
      weeksParticipated: number;
      winningMovies: {
        weekNumber: number;
        movie: MovieWithGenresAndCategory;
      }[];
    }
  >();

  users.forEach((u) => {
    tastemakerMap.set(u.id, {
      user: { id: u.id, name: u.name, username: u.username, role: u.role },
      totalWins: 0,
      weeksParticipated: 0,
      winningMovies: [],
    });
  });

  // 2. Film Snob Tracking
  const filmSnobMap = new Map<
    string,
    {
      user: { id: string; name: string; username: string };
      soloPickCount: number;
      soloMovies: { title: string; year: number | null; weekNumber: number }[];
    }
  >();

  users.forEach((u) => {
    filmSnobMap.set(u.id, {
      user: { id: u.id, name: u.name, username: u.username },
      soloPickCount: 0,
      soloMovies: [],
    });
  });

  // 3. Kingmaker Tracking
  const kingmakerMap = new Map<
    string,
    {
      user: { id: string; name: string; username: string };
      correctFinalVotes: number;
      totalFinalRounds: number;
    }
  >();

  users.forEach((u) => {
    kingmakerMap.set(u.id, {
      user: { id: u.id, name: u.name, username: u.username },
      correctFinalVotes: 0,
      totalFinalRounds: 0,
    });
  });

  closedWeeks.forEach((week) => {
    const winningId = week.winningMovieId;
    if (!winningId) return;

    const winningMovie = movieById.get(winningId);

    // Initial movie selection votes
    const initialVotes = week.votes.filter(
      (v) => v.user.isApproved && INITIAL_MOVIE_ROUNDS.has(v.round)
    );

    // Voters in initial round
    const participatedUserIds = new Set(initialVotes.map((v) => v.userId));
    participatedUserIds.forEach((uid) => {
      const entry = tastemakerMap.get(uid);
      if (entry) entry.weeksParticipated += 1;
    });

    // Winning picks in initial round
    const winningPickVotes = initialVotes.filter((v) => v.targetId === winningId);
    const winningUserIds = new Set(winningPickVotes.map((v) => v.userId));

    winningUserIds.forEach((uid) => {
      const entry = tastemakerMap.get(uid);
      if (entry && winningMovie) {
        entry.totalWins += 1;
        entry.winningMovies.push({
          weekNumber: week.weekNumber,
          movie: winningMovie,
        });
      }
    });

    // Calculate solo picks for Film Snob in initial movie round
    const votesByTarget: Record<string, string[]> = {};
    initialVotes.forEach((v) => {
      if (!votesByTarget[v.targetId]) votesByTarget[v.targetId] = [];
      votesByTarget[v.targetId].push(v.userId);
    });

    Object.entries(votesByTarget).forEach(([targetId, voterIds]) => {
      if (voterIds.length === 1) {
        const soloUserId = voterIds[0];
        const snobEntry = filmSnobMap.get(soloUserId);
        const m = movieById.get(targetId);
        if (snobEntry && m) {
          snobEntry.soloPickCount += 1;
          snobEntry.soloMovies.push({
            title: m.title,
            year: m.year,
            weekNumber: week.weekNumber,
          });
        }
      }
    });

    // Determine latest final round
    const roundsInWeek = Array.from(
      new Set(week.votes.filter((v) => v.user.isApproved).map((v) => v.round))
    );

    const finalRound = FINAL_ROUND_PRIORITY.find((r) => roundsInWeek.includes(r));
    if (finalRound) {
      const finalVotes = week.votes.filter(
        (v) => v.user.isApproved && v.round === finalRound
      );
      const finalVoters = new Set(finalVotes.map((v) => v.userId));

      finalVoters.forEach((uid) => {
        const kmEntry = kingmakerMap.get(uid);
        if (kmEntry) {
          kmEntry.totalFinalRounds += 1;
          const userFinalVotes = finalVotes.filter((v) => v.userId === uid);
          if (userFinalVotes.some((v) => v.targetId === winningId)) {
            kmEntry.correctFinalVotes += 1;
          }
        }
      });
    }
  });

  // Assemble Tastemakers list
  const tastemakers: UserTastemakerStats[] = Array.from(tastemakerMap.values())
    .map((item) => ({
      ...item,
      winRate:
        item.weeksParticipated > 0
          ? Math.round((item.totalWins / item.weeksParticipated) * 100)
          : 0,
    }))
    .sort((a, b) => {
      if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return a.user.name.localeCompare(b.user.name);
    });

  // Assemble Film Snob list
  const filmSnobsList: FilmSnobStats[] = Array.from(filmSnobMap.values()).sort(
    (a, b) => b.soloPickCount - a.soloPickCount || a.user.name.localeCompare(b.user.name)
  );
  const filmSnob = filmSnobsList.length > 0 && filmSnobsList[0].soloPickCount > 0
    ? filmSnobsList[0]
    : null;

  // Assemble Kingmakers list
  const kingmakersList: KingmakerStats[] = Array.from(kingmakerMap.values())
    .map((item) => ({
      ...item,
      accuracy:
        item.totalFinalRounds > 0
          ? Math.round((item.correctFinalVotes / item.totalFinalRounds) * 100)
          : 0,
    }))
    .sort((a, b) => {
      if (b.correctFinalVotes !== a.correctFinalVotes) {
        return b.correctFinalVotes - a.correctFinalVotes;
      }
      return b.accuracy - a.accuracy || a.user.name.localeCompare(b.user.name);
    });
  const kingmaker = kingmakersList.length > 0 && kingmakersList[0].correctFinalVotes > 0
    ? kingmakersList[0]
    : null;

  // 4. Dynamic Duo Calculation
  let bestDuo: DynamicDuoStats | null = null;
  const userList = Array.from(users);

  for (let i = 0; i < userList.length; i++) {
    for (let j = i + 1; j < userList.length; j++) {
      const u1 = userList[i];
      const u2 = userList[j];

      let sharedRoundsCount = 0;
      let sharedVotesCount = 0;
      let totalRoundsEvaluated = 0;

      closedWeeks.forEach((week) => {
        const weekVotes = week.votes.filter((v) => v.user.isApproved);
        const roundCodes = Array.from(new Set(weekVotes.map((v) => v.round)));

        roundCodes.forEach((round) => {
          const u1Votes = new Set(
            weekVotes.filter((v) => v.round === round && v.userId === u1.id).map((v) => v.targetId)
          );
          const u2Votes = new Set(
            weekVotes.filter((v) => v.round === round && v.userId === u2.id).map((v) => v.targetId)
          );

          if (u1Votes.size > 0 && u2Votes.size > 0) {
            totalRoundsEvaluated += 1;
            let roundShared = 0;
            u1Votes.forEach((t) => {
              if (u2Votes.has(t)) roundShared += 1;
            });
            sharedVotesCount += roundShared;
            if (roundShared > 0) {
              sharedRoundsCount += 1;
            }
          }
        });
      });

      if (totalRoundsEvaluated >= 2) {
        const agreementScore = Math.round(
          (sharedRoundsCount / totalRoundsEvaluated) * 100
        );
        if (
          !bestDuo ||
          sharedVotesCount > bestDuo.sharedVotesCount ||
          (sharedVotesCount === bestDuo.sharedVotesCount &&
            agreementScore > bestDuo.agreementScore)
        ) {
          bestDuo = {
            userA: { id: u1.id, name: u1.name },
            userB: { id: u2.id, name: u2.name },
            agreementScore,
            sharedVotesCount,
            sharedRoundsCount,
          };
        }
      }
    }
  }

  // 5. Global Stats Calculation
  const winningMoviesList = winnerIds
    .map((id) => movieById.get(id))
    .filter((m): m is MovieWithGenresAndCategory => Boolean(m));

  let totalWatchTimeMinutes = 0;
  let totalRatingSum = 0;
  let ratingCount = 0;

  const genreCounts: Record<string, number> = {};
  let longestMovie: GlobalMovieStats["longestMovie"] = null;
  let shortestMovie: GlobalMovieStats["shortestMovie"] = null;
  let highestRatedMovie: GlobalMovieStats["highestRatedMovie"] = null;

  const physicalMedia = {
    fourK: 0,
    bluRay: 0,
    dvd: 0,
    digitalOnly: 0,
  };

  winningMoviesList.forEach((movie) => {
    const mins = parseRuntimeMinutes(movie.runtime);
    if (mins > 0) {
      totalWatchTimeMinutes += mins;
      if (!longestMovie || mins > longestMovie.minutes) {
        longestMovie = { title: movie.title, runtime: movie.runtime || `${mins} min`, minutes: mins };
      }
      if (!shortestMovie || mins < shortestMovie.minutes) {
        shortestMovie = { title: movie.title, runtime: movie.runtime || `${mins} min`, minutes: mins };
      }
    }

    if (movie.imdbRating) {
      const r = parseFloat(movie.imdbRating);
      if (!isNaN(r)) {
        totalRatingSum += r;
        ratingCount += 1;
        if (!highestRatedMovie || r > highestRatedMovie.rating) {
          highestRatedMovie = { title: movie.title, rating: r };
        }
      }
    }

    movie.genres.forEach((g) => {
      genreCounts[g.name] = (genreCounts[g.name] || 0) + 1;
    });

    if (movie.physical4K) {
      physicalMedia.fourK += 1;
    } else if (movie.physicalBluRay) {
      physicalMedia.bluRay += 1;
    } else if (movie.physicalDvd) {
      physicalMedia.dvd += 1;
    } else {
      physicalMedia.digitalOnly += 1;
    }
  });

  const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
  const topGenre = sortedGenres.length > 0
    ? { name: sortedGenres[0][0], count: sortedGenres[0][1] }
    : null;

  const globalStats: GlobalMovieStats = {
    totalWeeks: closedWeeks.length,
    totalWatchTimeMinutes,
    formattedWatchTime: formatWatchTime(totalWatchTimeMinutes),
    averageRating: ratingCount > 0 ? parseFloat((totalRatingSum / ratingCount).toFixed(1)) : null,
    topGenre,
    longestMovie,
    shortestMovie,
    highestRatedMovie,
    physicalMedia,
  };

  return {
    tastemakers,
    kingmaker,
    kingmakersList,
    filmSnob,
    filmSnobsList,
    dynamicDuo: bestDuo,
    globalStats,
  };
}
