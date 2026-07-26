import { db } from "@/lib/db";

// Helper: Get shortlist movies compiled from Round 2/2b voting ties
export async function getShortlistMovies(weekId: string, selectedCategoryId: string, selectedSubcategoryId: string | null) {
  // 1. Get initial tied movies from ROUND_2_MOVIE
  const r2Votes = await db.weekVote.findMany({
    where: { weekId, round: "ROUND_2_MOVIE" },
    include: { user: true },
  });
  const approvedR2Votes = r2Votes.filter((v) => v.user.isApproved);
  const r2Counts: Record<string, number> = {};
  approvedR2Votes.forEach((v) => {
    r2Counts[v.targetId] = (r2Counts[v.targetId] || 0) + 1;
  });
  const r2Max = Math.max(...Object.values(r2Counts), 0);
  const r2TiedIds = Object.keys(r2Counts).filter((id) => r2Counts[id] === r2Max);

  const r2TiedCategories = await db.category.findMany({
    where: { id: { in: r2TiedIds } },
  });
  const r2TiedCategoryIds = r2TiedCategories.map((c) => c.id);
  let candidateMovieIds = r2TiedIds.filter((id) => !r2TiedCategoryIds.includes(id));

  // 2. Check latest sub-round votes (ROUND_2C_SUB_MOVIE or ROUND_2_SUB_MOVIE)
  const r2cVotes = await db.weekVote.findMany({
    where: { weekId, round: "ROUND_2C_SUB_MOVIE" },
    include: { user: true },
  });
  const r2subVotes = await db.weekVote.findMany({
    where: { weekId, round: "ROUND_2_SUB_MOVIE" },
    include: { user: true },
  });

  const activeSubVotes = r2cVotes.length > 0 ? r2cVotes : r2subVotes;
  const approvedSubVotes = activeSubVotes.filter((v) => v.user.isApproved);

  let subMovieIds: string[] = [];

  if (approvedSubVotes.length > 0) {
    const subCounts: Record<string, number> = {};
    approvedSubVotes.forEach((v) => {
      subCounts[v.targetId] = (subCounts[v.targetId] || 0) + 1;
    });
    const subMax = Math.max(...Object.values(subCounts), 0);
    const topSubIds = Object.keys(subCounts).filter((id) => subCounts[id] === subMax);
    const allSubVotedIds = Object.keys(subCounts);

    // If subcategory was in the sub-round and won/tied
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

    // Filter candidateMovieIds from Round 2 to remove movies that were voted on in the sub-round but lost
    const lostSubMovies = allSubVotedIds.filter((id) => !topSubIds.includes(id) && id !== selectedSubcategoryId);
    candidateMovieIds = candidateMovieIds.filter((id) => !lostSubMovies.includes(id));
  }

  const finalShortlistIds = Array.from(new Set([...candidateMovieIds, ...subMovieIds]));

  return db.movie.findMany({
    where: { id: { in: finalShortlistIds } },
    include: { genres: true, category: true },
  });
}

// Helper: Get final tiebreaker movies from Round 3 shortlist voting ties
export async function getFinalTiebreakerMovies(weekId: string) {
  const r3Votes = await db.weekVote.findMany({
    where: { weekId, round: "ROUND_3_SHORTLIST" },
    include: { user: true },
  });

  const approvedR3Votes = r3Votes.filter((v) => v.user.isApproved);
  const r3Counts: Record<string, number> = {};
  approvedR3Votes.forEach((v) => {
    r3Counts[v.targetId] = (r3Counts[v.targetId] || 0) + 1;
  });

  const r3Max = Math.max(...Object.values(r3Counts), 0);
  const r3TiedIds = Object.keys(r3Counts).filter((id) => r3Counts[id] === r3Max);

  return db.movie.findMany({
    where: { id: { in: r3TiedIds } },
    include: { genres: true, category: true },
  });
}

// Helper: Get category tiebreaker categories from Round 1 category voting ties
export async function getCategoryTiebreakerCategories(weekId: string) {
  const votes = await db.weekVote.findMany({
    where: { weekId, round: "ROUND_1_CATEGORY" },
    include: { user: true },
  });

  const approvedVotes = votes.filter((v) => v.user.isApproved);
  const counts: Record<string, number> = {};
  approvedVotes.forEach((v) => {
    counts[v.targetId] = (counts[v.targetId] || 0) + 1;
  });

  const maxVal = Math.max(...Object.values(counts), 0);
  const tiedIds = Object.keys(counts).filter((id) => counts[id] === maxVal);

  return db.category.findMany({
    where: { id: { in: tiedIds } },
    orderBy: { name: "asc" },
  });
}

// Helper: Get in-person tiebreaker movies (any movie with >= 1 vote in Round 1)
export async function getInPersonTiebreakerMovies(weekId: string) {
  const votes = await db.weekVote.findMany({
    where: { weekId, round: "IN_PERSON_ROUND_1" },
    include: { user: true },
  });

  const approvedVotes = votes.filter((v) => v.user.isApproved);
  const counts: Record<string, number> = {};
  approvedVotes.forEach((v) => {
    counts[v.targetId] = (counts[v.targetId] || 0) + 1;
  });

  const candidateIds = Object.keys(counts).filter((id) => counts[id] >= 1);

  return db.movie.findMany({
    where: { id: { in: candidateIds } },
    include: { genres: true, category: true },
    orderBy: { title: "asc" },
  });
}

// Helper: Get in-person tied movies with max votes in a given round
export async function getInPersonTiedMovies(weekId: string, roundCode: string) {
  const votes = await db.weekVote.findMany({
    where: { weekId, round: roundCode },
    include: { user: true },
  });

  const approvedVotes = votes.filter((v) => v.user.isApproved);
  if (approvedVotes.length === 0) return [];

  const counts: Record<string, number> = {};
  approvedVotes.forEach((v) => {
    counts[v.targetId] = (counts[v.targetId] || 0) + 1;
  });

  const maxVal = Math.max(...Object.values(counts));
  const tiedIds = Object.keys(counts).filter((id) => counts[id] === maxVal);

  return db.movie.findMany({
    where: { id: { in: tiedIds } },
    include: { genres: true, category: true },
    orderBy: { title: "asc" },
  });
}


