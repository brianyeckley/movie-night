import { db } from "@/lib/db";
import { sortMoviesByTitle } from "@/lib/movie-sort";
import { approvedVotes, tallyVotes, type RoundCode } from "@/lib/rounds";

// Helper: Load every vote cast in one round of a week, approved or not
function loadRawRoundVotes(weekId: string, round: RoundCode) {
  return db.weekVote.findMany({
    where: { weekId, round },
    include: { user: true },
  });
}

// Helper: Load a week's votes for one round, keeping only approved voters
async function loadRoundVotes(weekId: string, round: RoundCode) {
  return approvedVotes(await loadRawRoundVotes(weekId, round));
}

// Helper: Load the movies for a set of ids, sorted for display
async function loadMoviesById(ids: string[]) {
  const movies = await db.movie.findMany({
    where: { id: { in: ids } },
    include: { genres: true, category: true },
  });
  return sortMoviesByTitle(movies);
}

// Helper: Get shortlist movies compiled from Round 2/2b voting ties
export async function getShortlistMovies(
  weekId: string,
  selectedSubcategoryId: string | null
) {
  // 1. Get initial tied movies from ROUND_2_MOVIE
  const { tiedIds: r2TiedIds } = tallyVotes(await loadRoundVotes(weekId, "ROUND_2_MOVIE"));

  const r2TiedCategories = await db.category.findMany({
    where: { id: { in: r2TiedIds } },
  });
  const r2TiedCategoryIds = r2TiedCategories.map((c) => c.id);
  let candidateMovieIds = r2TiedIds.filter((id) => !r2TiedCategoryIds.includes(id));

  // 2. Check latest sub-round votes. Whether round 2c happened at all is judged
  // on raw votes, so the approval filter cannot fall us back to the earlier round.
  const r2cVotes = await loadRawRoundVotes(weekId, "ROUND_2C_SUB_MOVIE");
  const activeSubVotes =
    r2cVotes.length > 0 ? r2cVotes : await loadRawRoundVotes(weekId, "ROUND_2_SUB_MOVIE");
  const approvedSubVotes = approvedVotes(activeSubVotes);

  const subMovieIds: string[] = [];

  if (approvedSubVotes.length > 0) {
    const { counts: subCounts, tiedIds: topSubIds } = tallyVotes(approvedSubVotes);
    const allSubVotedIds = Object.keys(subCounts);

    // Check if the sub-round was a tiebreaker round involving the subcategory
    const isSubcategoryTiebreaker = selectedSubcategoryId && allSubVotedIds.includes(selectedSubcategoryId);

    if (isSubcategoryTiebreaker) {
      // In tiebreaker mode, only candidate movies from Round 2 that survived in topSubIds remain
      candidateMovieIds = candidateMovieIds.filter((id) => topSubIds.includes(id));
    }

    // If subcategory was in topSubIds, unpack all unwatched movies from that subcategory
    if (selectedSubcategoryId && topSubIds.includes(selectedSubcategoryId)) {
      const subMovies = await db.movie.findMany({
        where: { categoryId: selectedSubcategoryId, watched: false },
        select: { id: true },
      });
      subMovieIds.push(...subMovies.map((m) => m.id));
    }

    // Include movies that tied/won in the sub-round
    const topSubMovies = topSubIds.filter((id) => id !== selectedSubcategoryId);
    subMovieIds.push(...topSubMovies);
  }

  const finalShortlistIds = Array.from(new Set([...candidateMovieIds, ...subMovieIds]));

  return loadMoviesById(finalShortlistIds);
}

// Helper: Get final tiebreaker movies from Round 3 shortlist voting ties
export async function getFinalTiebreakerMovies(weekId: string) {
  const { tiedIds } = tallyVotes(await loadRoundVotes(weekId, "ROUND_3_SHORTLIST"));
  return loadMoviesById(tiedIds);
}

// Helper: Get category tiebreaker categories from Round 1 category voting ties
export async function getCategoryTiebreakerCategories(weekId: string) {
  const { tiedIds } = tallyVotes(await loadRoundVotes(weekId, "ROUND_1_CATEGORY"));

  return db.category.findMany({
    where: { id: { in: tiedIds } },
    orderBy: { name: "asc" },
  });
}

// Helper: Get in-person tiebreaker movies (every movie that received a vote in Round 1)
export async function getInPersonTiebreakerMovies(weekId: string) {
  const { counts } = tallyVotes(await loadRoundVotes(weekId, "IN_PERSON_ROUND_1"));
  return loadMoviesById(Object.keys(counts));
}

// Helper: Get in-person tied movies with max votes in a given round
export async function getInPersonTiedMovies(weekId: string, roundCode: RoundCode) {
  const { tiedIds } = tallyVotes(await loadRoundVotes(weekId, roundCode));
  return loadMoviesById(tiedIds);
}
