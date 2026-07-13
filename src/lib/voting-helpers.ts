import { db } from "@/lib/db";

// Helper: Get shortlist movies compiled from Round 2/2b voting ties
export async function getShortlistMovies(weekId: string, selectedCategoryId: string, selectedSubcategoryId: string | null) {
  // 1. Get all votes in ROUND_2_MOVIE
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

  // Separate subcategories from movies
  const r2TiedCategories = await db.category.findMany({
    where: { id: { in: r2TiedIds } },
  });
  const r2TiedCategoryIds = r2TiedCategories.map((c) => c.id);
  const r2TiedMovieIds = r2TiedIds.filter((id) => !r2TiedCategoryIds.includes(id));

  // 2. If subcategory voting took place, get top movies from ROUND_2_SUB_MOVIE
  let subMovieIds: string[] = [];
  if (selectedSubcategoryId) {
    const subVotes = await db.weekVote.findMany({
      where: { weekId, round: "ROUND_2_SUB_MOVIE" },
      include: { user: true },
    });
    const approvedSubVotes = subVotes.filter((v) => v.user.isApproved);
    const subCounts: Record<string, number> = {};
    approvedSubVotes.forEach((v) => {
      subCounts[v.targetId] = (subCounts[v.targetId] || 0) + 1;
    });
    const subMax = Math.max(...Object.values(subCounts), 0);
    const topTiedSubIds = Object.keys(subCounts).filter((id) => subCounts[id] === subMax);

    // If the subcategory itself is among the top voted items in ROUND_2_SUB_MOVIE,
    // we should include all unwatched movies from that subcategory in the shortlist!
    if (topTiedSubIds.includes(selectedSubcategoryId)) {
      const subcategoryMovies = await db.movie.findMany({
        where: { categoryId: selectedSubcategoryId, watched: false },
        select: { id: true },
      });
      subMovieIds.push(...subcategoryMovies.map((m) => m.id));
    }

    // Also include any specific movies that were voted on and won/tied in ROUND_2_SUB_MOVIE
    const specificMovieIds = topTiedSubIds.filter((id) => id !== selectedSubcategoryId);
    subMovieIds.push(...specificMovieIds);
  }

  const finalShortlistIds = Array.from(new Set([...r2TiedMovieIds, ...subMovieIds]));

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


