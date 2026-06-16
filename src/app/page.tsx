import { db } from "@/lib/db";
import {
  getActiveUser,
  createWeekAction,
  deleteWeekAction,
  resetRoundAction,
  submitCategoryVoteAction,
  submitMovieVotesAction,
  submitSubMovieVotesAction,
  submitShortlistVotesAction,
  submitFinalVoteAction,
  advanceWeekRoundAction,
  completeWeekAction,
  completeWeekLegacyOverrideAction,
} from "@/app/actions";
import Link from "next/link";
import { CategoryVotingFormClient, MovieVotingFormClient, SubcategoryVotingFormClient, ShortlistVotingFormClient, FinalVotingFormClient } from "@/components/VotingFormClient";
import TrailerButton from "@/components/TrailerButton";
import DeletePastMovieNightButton from "@/components/DeletePastMovieNightButton";
import AdvanceRoundButton from "@/components/AdvanceRoundButton";

export const dynamic = "force-dynamic";

// Helper: Get shortlist movies
async function getShortlistMovies(weekId: string, selectedCategoryId: string, selectedSubcategoryId: string | null) {
  // 1. Get all votes in ROUND_2_MOVIE
  const r2Votes = await db.weekVote.findMany({
    where: { weekId, round: "ROUND_2_MOVIE" },
  });

  const r2Counts: Record<string, number> = {};
  r2Votes.forEach((v) => {
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
    });
    const subCounts: Record<string, number> = {};
    subVotes.forEach((v) => {
      subCounts[v.targetId] = (subCounts[v.targetId] || 0) + 1;
    });
    const subMax = Math.max(...Object.values(subCounts), 0);
    subMovieIds = Object.keys(subCounts).filter((id) => subCounts[id] === subMax);
  }

  const finalShortlistIds = Array.from(new Set([...r2TiedMovieIds, ...subMovieIds]));

  return db.movie.findMany({
    where: { id: { in: finalShortlistIds } },
    include: { genres: true, category: true },
  });
}

// Helper: Get final tiebreaker movies
async function getFinalTiebreakerMovies(weekId: string) {
  const r3Votes = await db.weekVote.findMany({
    where: { weekId, round: "ROUND_3_SHORTLIST" },
  });

  const r3Counts: Record<string, number> = {};
  r3Votes.forEach((v) => {
    r3Counts[v.targetId] = (r3Counts[v.targetId] || 0) + 1;
  });

  const r3Max = Math.max(...Object.values(r3Counts), 0);
  const r3TiedIds = Object.keys(r3Counts).filter((id) => r3Counts[id] === r3Max);

  return db.movie.findMany({
    where: { id: { in: r3TiedIds } },
    include: { genres: true, category: true },
  });
}

export default async function DashboardPage() {
  const currentUser = await getActiveUser();

  // Find active week (a week is active until it is closed / closedAt is set)
  const activeWeek = await db.movieNightWeek.findFirst({
    where: { closedAt: null },
    include: {
      themeCategory: true,
      votes: { include: { user: true } },
    },
  });

  // Get active week winner details
  const activeWinnerMovie = activeWeek?.winningMovieId
    ? await db.movie.findUnique({
        where: { id: activeWeek.winningMovieId },
        include: { category: true, genres: true },
      })
    : null;

  // Fetch all users
  const users = await db.user.findMany({
    orderBy: { name: "asc" },
  });

  // Fetch themed categories
  const themeCategories = await db.category.findMany({
    where: { isThemed: true },
    orderBy: { name: "asc" },
  });

  // Fetch past movie night weeks (closed weeks)
  const closedWeeks = await db.movieNightWeek.findMany({
    where: { NOT: { closedAt: null } },
    include: {
      themeCategory: true,
    },
    orderBy: { weekNumber: "desc" },
  });

  // Fetch details for past winning movies
  const pastWeeks = await Promise.all(
    closedWeeks.map(async (wk) => {
      const winner = wk.winningMovieId
        ? await db.movie.findUnique({
            where: { id: wk.winningMovieId },
            include: { genres: true, category: true },
          })
        : null;
      return { ...wk, winner };
    })
  );

  // Compute round status details
  let roundTitle = "";
  let roundVotedUserIds: string[] = [];
  let activeRoundCode = "";
  let completedRoundsData: any[] = [];

  if (activeWeek) {
    if (activeWeek.status === "CATEGORY_VOTING") activeRoundCode = "ROUND_1_CATEGORY";
    else if (activeWeek.status === "MOVIE_VOTING") activeRoundCode = "ROUND_2_MOVIE";
    else if (activeWeek.status === "SUBCATEGORY_VOTING") activeRoundCode = "ROUND_2_SUB_MOVIE";
    else if (activeWeek.status === "SHORTLIST_VOTING") activeRoundCode = "ROUND_3_SHORTLIST";
    else if (activeWeek.status === "FINAL_VOTING") activeRoundCode = "ROUND_4_TIEBREAKER";

    roundTitle = activeWeek.status.replace("_", " ");
    roundVotedUserIds = activeWeek.votes
      .filter((v) => v.round === activeRoundCode)
      .map((v) => v.userId);

    // Resolve display names for votes
    const targetIds = Array.from(new Set(activeWeek.votes.map((v) => v.targetId)));

    const votedCategories = await db.category.findMany({
      where: { id: { in: targetIds } },
    });

    const votedMovies = await db.movie.findMany({
      where: { id: { in: targetIds } },
    });

    const targetLookup: Record<string, string> = {};
    votedCategories.forEach((c) => {
      targetLookup[c.id] = c.name;
    });
    votedMovies.forEach((m) => {
      targetLookup[m.id] = m.title + (m.year ? ` (${m.year})` : "");
    });

    const votesByRound: Record<string, any[]> = {};
    activeWeek.votes.forEach((v) => {
      if (v.round !== activeRoundCode) {
        if (!votesByRound[v.round]) {
          votesByRound[v.round] = [];
        }
        votesByRound[v.round].push(v);
      }
    });

    const roundTitles: Record<string, string> = {
      ROUND_1_CATEGORY: "Round 1: Category Selection",
      ROUND_2_MOVIE: "Round 2: Movie Selection",
      ROUND_2_SUB_MOVIE: "Round 2b: Subcategory Movie Selection",
      ROUND_3_SHORTLIST: "Round 3: Shortlist Selection",
      ROUND_4_TIEBREAKER: "Round 4: Final Tiebreaker",
    };

    const parsedRounds = Object.entries(votesByRound).map(([roundCode, roundVotes]) => {
      const targetCounts: Record<string, { targetId: string; name: string; count: number; voters: string[] }> = {};
      
      roundVotes.forEach((v) => {
        if (!targetCounts[v.targetId]) {
          targetCounts[v.targetId] = {
            targetId: v.targetId,
            name: targetLookup[v.targetId] || "Unknown Option",
            count: 0,
            voters: [],
          };
        }
        targetCounts[v.targetId].count += 1;
        targetCounts[v.targetId].voters.push(v.user.name);
      });

      const sortedTargets = Object.values(targetCounts).sort((a, b) => b.count - a.count);

      // Check if there was a tie in this round
      const isTie = sortedTargets.length > 1 && sortedTargets[0].count === sortedTargets[1].count;

      // Identify which target was chosen by a random tiebreaker draw
      let chosenTargetId: string | null = null;
      if (isTie) {
        if (roundCode === "ROUND_1_CATEGORY") {
          chosenTargetId = activeWeek.selectedCategoryId;
        } else if (roundCode === "ROUND_4_TIEBREAKER") {
          chosenTargetId = activeWeek.winningMovieId;
        }
      }

      return {
        roundCode,
        title: roundTitles[roundCode] || roundCode,
        targets: sortedTargets,
        isTie,
        chosenTargetId,
      };
    });

    const roundOrder = [
      "ROUND_1_CATEGORY",
      "ROUND_2_MOVIE",
      "ROUND_2_SUB_MOVIE",
      "ROUND_3_SHORTLIST",
      "ROUND_4_TIEBREAKER",
    ];

    parsedRounds.sort((a, b) => roundOrder.indexOf(a.roundCode) - roundOrder.indexOf(b.roundCode));
    completedRoundsData = parsedRounds;
  }

  const allVotesIn = activeWeek ? users.every((u) => roundVotedUserIds.includes(u.id)) : false;
  const round1TieInfo = completedRoundsData.find((r) => r.roundCode === "ROUND_1_CATEGORY" && r.isTie);
  const round1ChosenName = round1TieInfo && activeWeek?.selectedCategoryId
    ? round1TieInfo.targets.find((t: any) => t.targetId === activeWeek.selectedCategoryId)?.name
    : null;

  return (
    <div className="py-xl">
      <main className="container">
        {!currentUser ? (
          // ----------------------------------------
          // NO USER SELECTED VIEW
          // ----------------------------------------
          <div className="glass-panel no-hover p-2xl text-center max-w-2xl mx-auto my-3xl">
            <h1 className="text-gradient text-8xl font-extrabold mb-lg">
              🎬 Welcome to Movie Night
            </h1>
            <p className="text-secondary mb-2xl text-xl">
              Please pick your profile in the header dropdown to enter the movie night dashboard, participate in voting, or manage the catalog.
            </p>
            <div className="border-t pt-lg">
              <span className="text-base text-muted block mb-md">
                Simulating profiles for:
              </span>
              <div className="flex-center gap-lg">
                {users.map((u) => (
                  <span key={u.id} className="dashboard-user-badge">
                    {u.name} {u.role === "ADMIN" && "👑"}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // ----------------------------------------
          // MAIN DASHBOARD (ACTIVE USER)
          // ----------------------------------------
          <div className="flex-col gap-3xl">
            
            {/* Active Week / Voting Dashboard */}
            <div className="glass-panel no-hover dashboard-panel">
              {!activeWeek ? (
                // ----------------------------------------
                // NO ACTIVE WEEK STATE
                // ----------------------------------------
                <div className="text-center py-xl">
                  <span className="text-9xl block mb-lg">🍿</span>
                  <h2 className="text-5xl font-extrabold mb-sm">No Active Week</h2>
                  <p className="text-secondary max-w-xl mx-auto mb-2xl">
                    There is currently no movie night week in progress.
                  </p>
                  
                  {currentUser.role === "ADMIN" ? (
                    <div className="admin-start-week-card">
                      <h3 className="text-lg font-bold mb-md text-primary-var">
                        Admin: Start New Movie Night Week
                      </h3>
                      <form
                        action={async (formData) => {
                          "use server";
                          const theme = formData.get("theme") as string;
                          if (theme) await createWeekAction(theme);
                        }}
                        className="flex-col gap-md"
                      >
                        <div className="form-group">
                          <label htmlFor="week-theme" className="form-label">
                            Theme Category
                          </label>
                          {themeCategories.length > 0 ? (
                            <select
                              id="week-theme"
                              name="theme"
                              required
                              className="form-select w-full"
                            >
                              {themeCategories.map((theme) => (
                                <option key={theme.id} value={theme.name}>
                                  {theme.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id="week-theme"
                              name="theme"
                              type="text"
                              placeholder="No themes found. Type to create..."
                              required
                              className="form-input w-full"
                            />
                          )}
                        </div>
                        <button type="submit" className="btn btn-primary w-full">
                          Start Week
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="waiting-banner">
                      <strong>Waiting for Brian (Admin) to start the next week!</strong>
                    </div>
                  )}
                </div>
              ) : (
                // ----------------------------------------
                // ACTIVE WEEK IN PROGRESS
                // ----------------------------------------
                <div>
                  {/* Top Bar Info */}
                  <div className="dashboard-header-bar">
                    <div>
                      <h2 className="text-5xl font-extrabold">
                        Week #{activeWeek.weekNumber} Voting
                      </h2>
                      <p className="text-secondary text-md mt-xs">
                        Active Theme: <strong className="text-primary-color">{activeWeek.themeCategory?.name}</strong>
                      </p>
                    </div>
                    <div className="flex-row items-center gap-sm">
                      <span className="text-sm-alt text-uppercase tracking-widest text-secondary">Status:</span>
                      <span className="badge badge-admin">
                        {roundTitle}
                      </span>
                    </div>
                  </div>

                  {/* Tiebreaker Alert Banner */}
                  {round1ChosenName && (
                    <div className="tiebreaker-banner">
                      <span className="text-xl">🎲</span>
                      <div>
                        <strong>Random Tiebreaker Draw occurred!</strong> Round 1: Category Selection resulted in a tie. The category <strong className="text-accent-color font-bold">{round1ChosenName}</strong> was randomly selected to resolve the tie.
                      </div>
                    </div>
                  )}

                  {/* Admin Controls */}
                  {currentUser.role === "ADMIN" && (
                    <div className="admin-actions-bar">
                      <span className="text-md text-primary-var font-semibold">
                        👑 Admin Actions ({currentUser.name}):
                      </span>
                      <div className="flex-row gap-md flex-wrap">
                        {activeWeek.status !== "COMPLETED" && (
                          <>
                            <form
                              action={async () => {
                                "use server";
                                await resetRoundAction(activeWeek.id);
                              }}
                            >
                              <button type="submit" className="btn btn-secondary btn-sm">
                                Reset Current Round Votes
                              </button>
                            </form>
                            <AdvanceRoundButton weekId={activeWeek.id} />
                          </>
                        )}
                        <form
                          action={async () => {
                            "use server";
                            await deleteWeekAction(activeWeek.id);
                          }}
                        >
                          <button type="submit" className="btn btn-secondary btn-delete-week">
                            Delete Week
                          </button>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Non-Admin Round Advance Controls (shows up only when all votes are cast) */}
                  {currentUser.role !== "ADMIN" && allVotesIn && activeWeek.status !== "COMPLETED" && (
                    <div className="voted-all-bar">
                      <span className="text-md text-primary-var font-semibold">
                        🎉 Everyone has voted! Anyone can advance the round:
                      </span>
                      <AdvanceRoundButton weekId={activeWeek.id} isGreen />
                    </div>
                  )}

                  {/* Voting Area */}
                  <div className={`dashboard-layout ${activeWeek.status === "COMPLETED" ? "completed" : ""}`}>
                    
                    {/* Active Form based on Week State */}
                    <div className="dashboard-form-container">
                      
                      {/* ROUND 1: Category Voting */}
                      {activeWeek.status === "CATEGORY_VOTING" && (
                        <CategoryVotingForm week={activeWeek} currentUserId={currentUser.id} roundVotedUserIds={roundVotedUserIds} />
                      )}

                      {/* ROUND 2: Movie/Subcategory Voting */}
                      {activeWeek.status === "MOVIE_VOTING" && (
                        <MovieVotingForm week={activeWeek} currentUserId={currentUser.id} roundVotedUserIds={roundVotedUserIds} />
                      )}

                      {/* ROUND 2b: Subcategory Movie Voting */}
                      {activeWeek.status === "SUBCATEGORY_VOTING" && (
                        <SubcategoryVotingForm week={activeWeek} currentUserId={currentUser.id} roundVotedUserIds={roundVotedUserIds} />
                      )}

                      {/* ROUND 3: Shortlist Voting */}
                      {activeWeek.status === "SHORTLIST_VOTING" && (
                        <ShortlistVotingForm week={activeWeek} currentUserId={currentUser.id} roundVotedUserIds={roundVotedUserIds} />
                      )}

                      {/* ROUND 4: Tiebreaker Voting */}
                      {activeWeek.status === "FINAL_VOTING" && (
                        <FinalVotingForm week={activeWeek} currentUserId={currentUser.id} roundVotedUserIds={roundVotedUserIds} />
                      )}

                      {/* COMPLETED / WINNER STATE */}
                      {activeWeek.status === "COMPLETED" && activeWinnerMovie && (
                        <CompletedWeekView week={activeWeek} movie={activeWinnerMovie} currentUser={currentUser} />
                      )}

                      {/* PRIOR ROUND RESULTS */}
                      {completedRoundsData.length > 0 && (
                        <div className="border-t pt-lg mt-2xl flex-col gap-xl">
                          <h3 className="text-2xl font-bold text-primary-var flex-row items-center gap-sm">
                            📊 Prior Round Results
                          </h3>
                          <div className="flex-col gap-lg">
                            {completedRoundsData.map((round: any) => (
                              <div 
                                key={round.roundCode} 
                                className="dashboard-form-container"
                              >
                                <h4 className="text-md font-bold text-primary-color mb-md flex-row justify-between items-center">
                                  <span>{round.title}</span>
                                  <span className="text-sm-alt text-muted text-uppercase tracking-widest">Closed</span>
                                </h4>

                                {round.isTie && (
                                  <div className={`alert-box mb-md font-semibold flex-row items-center gap-xs ${round.chosenTargetId ? "alert-error" : "alert-success alert-sm"}`}>
                                    {round.chosenTargetId ? (
                                      <>
                                        🎲 <strong>Tiebreaker:</strong> Random draw selected{" "}
                                        <strong className="text-accent-color">
                                          {round.targets.find((t: any) => t.targetId === round.chosenTargetId)?.name || "Option"}
                                        </strong>
                                      </>
                                    ) : (
                                      <>
                                        ⚖️ <strong>Tie:</strong> Round tied! All tied options advanced to the next round.
                                      </>
                                    )}
                                  </div>
                                )}

                                <div className="flex-col gap-sm">
                                  {round.targets.map((target: any, idx: number) => {
                                    const isWinner = idx === 0 || target.count === round.targets[0].count;
                                    const isChosenRandomly = round.chosenTargetId === target.targetId;

                                    let itemBgColor = "rgba(255, 255, 255, 0.01)";
                                    let itemBorderColor = "var(--glass-border)";
                                    if (isChosenRandomly) {
                                      itemBgColor = "var(--accent-light)";
                                      itemBorderColor = "var(--accent)";
                                    } else if (isWinner) {
                                      itemBgColor = "rgba(99, 102, 241, 0.04)";
                                      itemBorderColor = "rgba(99, 102, 241, 0.2)";
                                    }

                                    return (
                                      <div 
                                        key={target.targetId} 
                                        style={{ 
                                          display: "flex", 
                                          justifyContent: "space-between", 
                                          alignItems: "center", 
                                          padding: "8px 12px", 
                                          backgroundColor: itemBgColor, 
                                          border: `1px solid ${itemBorderColor}`, 
                                          borderRadius: "var(--radius-sm)",
                                          fontSize: "0.9rem"
                                        }}
                                      >
                                        <div className="flex-col gap-xxs">
                                          <span className={`font-semibold ${isChosenRandomly || isWinner ? "text-primary-var" : "text-secondary"}`}>
                                            {target.name}{" "}
                                            {isChosenRandomly ? "🎲" : (isWinner && !round.isTie) ? "🏆" : ""}
                                          </span>
                                          <span className="text-sm-alt text-muted">
                                            Voters: {target.voters.join(", ")}
                                          </span>
                                        </div>
                                        <span className={`badge ${isChosenRandomly ? "badge-pending" : isWinner ? "badge-admin" : "badge-user"}`}>
                                          {target.count} {target.count === 1 ? "vote" : "votes"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Live Voting Tracker — hidden once a winner is chosen */}
                    {activeWeek.status !== "COMPLETED" && (
                      <div className="glass-panel p-lg bg-white-05">
                        <h3 className="text-xl font-bold mb-lg">Vote Progress</h3>
                        <div className="flex-col gap-md">
                          {users.map((u) => {
                            const hasVoted = roundVotedUserIds.includes(u.id);
                            return (
                              <div key={u.id} className="flex-between p-sm border-b bg-white-05">
                                <span className="font-semibold">{u.name}</span>
                                <span className={`text-base ${hasVoted ? "text-success-color" : "text-accent-color"}`}>
                                  {hasVoted ? "✅ Voted" : "❌ Waiting"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-sm text-muted mt-lg italic text-center">
                          Selections are hidden until the Admin closes the round.
                        </p>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>

            {/* Past Movie Nights Log */}
            <div className="glass-panel no-hover p-xl">
              <h2 className="text-6xl font-extrabold mb-lg">🎬 Past Movie Nights</h2>
              {pastWeeks.length === 0 ? (
                <p className="text-secondary italic">No movie nights have completed yet.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
                  {pastWeeks.map((wk) => (
                    <div key={wk.id} className="glass-panel p-lg flex-col gap-sm bg-white-05">
                      <div className="flex-between">
                        <div className="flex-row items-center gap-xs">
                          <span className="text-sm-alt text-primary-color font-bold">
                            WEEK #{wk.weekNumber}
                          </span>
                          {currentUser?.role === "ADMIN" && (
                            <DeletePastMovieNightButton
                              weekId={wk.id}
                              weekNumber={wk.weekNumber}
                              movieTitle={wk.winner?.title || "Unknown Movie"}
                            />
                          )}
                        </div>
                        <span className="text-sm-alt text-muted">
                          {wk.closedAt ? new Date(wk.closedAt).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold">
                        {wk.winner?.title || "Unknown Movie"}{wk.winner?.year ? ` (${wk.winner.year})` : ""}
                      </h3>
                      <div className="flex-row gap-sm items-center mt-xxs">
                        {wk.winner?.trailerUrl && <TrailerButton trailerUrl={wk.winner.trailerUrl} />}
                        {wk.winner?.imdbUrl && (
                          <a href={wk.winner.imdbUrl} target="_blank" rel="noopener noreferrer" className="text-sm-alt text-primary-color underline">
                            IMDb Link ↗
                          </a>
                        )}
                      </div>
                      {wk.winner && (wk.winner.director || wk.winner.runtime || wk.winner.stars) && (
                        <div className="text-sm-alt text-secondary flex-col gap-xxs mt-xxs mb-xs">
                          {(wk.winner.director || wk.winner.runtime) && (
                            <div className="flex-row gap-xs items-center">
                              {wk.winner.director && <span>🎬 {wk.winner.director}</span>}
                              {wk.winner.director && wk.winner.runtime && <span className="text-glass-border">•</span>}
                              {wk.winner.runtime && <span>⏱️ {wk.winner.runtime}</span>}
                            </div>
                          )}
                          {wk.winner.stars && (
                            <div style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                              👥 {wk.winner.stars}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex-row gap-xs flex-wrap mt-xs">
                        {wk.winner?.genres.map((g) => (
                          <span key={g.id} className="badge-genre">
                            {g.name}
                          </span>
                        ))}
                      </div>
                      <div className="border-t pt-sm mt-sm flex-between text-sm-alt text-muted">
                        <span>Theme: {wk.themeCategory?.name || "None"}</span>
                        {wk.isRandomlyChosen && (
                          <span className="text-accent-color font-semibold">🎲 Random Draw</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------
// FORM COMPONENTS FOR EACH STATE
// ----------------------------------------------------------------------

// 1. Round 1: Category Voting
async function CategoryVotingForm({ week, currentUserId, roundVotedUserIds }: any) {
  // Fetch active categories (Comedy, Other, Legacy, and active Theme)
  const categories = await db.category.findMany({
    where: {
      parentId: null,
      OR: [
        { name: "Comedy" },
        { name: "Other" },
        { name: "Legacy" },
        { id: week.themeCategoryId },
      ],
    },
  });

  // Find if user already voted
  const userVote = await db.weekVote.findFirst({
    where: { weekId: week.id, userId: currentUserId, round: "ROUND_1_CATEGORY" },
  });

  return (
    <div>
      <h3 className="text-3xl font-bold mb-md">Round 1: Select Category</h3>
      <p className="text-secondary mb-xl text-md">
        Vote for the high-level category of movies to watch this week. Tie-breaks will result in a random pick. (1 Vote)
      </p>

      <CategoryVotingFormClient
        weekId={week.id}
        categories={categories}
        initialVoteId={userVote?.targetId || null}
      />
    </div>
  );
}

// 2. Round 2: Movie/Subcategory Voting in Category
async function MovieVotingForm({ week, currentUserId, roundVotedUserIds }: any) {
  if (!week.selectedCategoryId) return <p>Category not selected.</p>;

  const category = await db.category.findUnique({
    where: { id: week.selectedCategoryId },
  });

  const isLegacy = category?.name === "Legacy";

  // Movies in this category (exclude watched, unless it is Legacy)
  const movies = await db.movie.findMany({
    where: {
      categoryId: week.selectedCategoryId,
      OR: isLegacy ? undefined : [{ watched: false }],
    },
    include: { genres: true },
    orderBy: { title: "asc" },
  });

  // Subcategories in this category
  const subcategories = await db.category.findMany({
    where: { parentId: week.selectedCategoryId },
    orderBy: { name: "asc" },
  });

  // User's current votes in this round
  const userVotes = await db.weekVote.findMany({
    where: { weekId: week.id, userId: currentUserId, round: "ROUND_2_MOVIE" },
  });
  const userVoteIds = userVotes.map((v) => v.targetId);

  return (
    <div>
      <h3 className="text-3xl font-bold mb-sm">
        Round 2: Select Movies in <span className="text-primary-color">{category?.name}</span>
      </h3>
      <p className="text-secondary mb-xl text-md">
        Select movies or subcategories from the winning category. If one movie wins outright, it becomes the weekly winner immediately! (Max 2 Votes)
      </p>

      {movies.length === 0 && subcategories.length === 0 ? (
        <p className="text-muted italic py-sm">
          No options created in this category yet. Go to the Catalog tab to add movies or subcategories!
        </p>
      ) : (
        <MovieVotingFormClient
          weekId={week.id}
          movies={movies}
          subcategories={subcategories}
          initialVotes={userVoteIds}
        />
      )}
    </div>
  );
}

// 3. Round 2b: Subcategory Movie Voting
async function SubcategoryVotingForm({ week, currentUserId, roundVotedUserIds }: any) {
  if (!week.selectedSubcategoryId) return <p>Subcategory not selected.</p>;

  const subcategory = await db.category.findUnique({
    where: { id: week.selectedSubcategoryId },
  });

  // Movies in this subcategory (exclude watched)
  const movies = await db.movie.findMany({
    where: { categoryId: week.selectedSubcategoryId, watched: false },
    include: { genres: true },
    orderBy: { title: "asc" },
  });

  // User's current votes in this sub-round
  const userVotes = await db.weekVote.findMany({
    where: { weekId: week.id, userId: currentUserId, round: "ROUND_2_SUB_MOVIE" },
  });
  const userVoteIds = userVotes.map((v) => v.targetId);

  return (
    <div>
      <h3 className="text-3xl font-bold mb-sm">
        Round 2b: Select Movies in Subcategory <span className="text-primary-color">{subcategory?.name}</span>
      </h3>
      <p className="text-secondary mb-xl text-md">
        Select movies inside the winning subcategory. The top voted movies will enter the shortlist. (Max 2 Votes)
      </p>

      {movies.length === 0 ? (
        <p className="text-muted italic py-sm">
          No movies added in this subcategory yet. Go to the Catalog tab to add movies under "{subcategory?.name}"!
        </p>
      ) : (
        <SubcategoryVotingFormClient
          weekId={week.id}
          movies={movies}
          initialVotes={userVoteIds}
        />
      )}
    </div>
  );
}

// 4. Round 3: Shortlist Voting
async function ShortlistVotingForm({ week, currentUserId, roundVotedUserIds }: any) {
  // Dynamically compile shortlist movies based on ties in R2 / R2b
  const movies = await getShortlistMovies(week.id, week.selectedCategoryId, week.selectedSubcategoryId);

  // User's current votes in this round
  const userVotes = await db.weekVote.findMany({
    where: { weekId: week.id, userId: currentUserId, round: "ROUND_3_SHORTLIST" },
  });
  const userVoteIds = userVotes.map((v) => v.targetId);

  return (
    <div>
      <h3 className="text-3xl font-bold mb-sm">Round 3: Shortlist Voting</h3>
      <p className="text-secondary mb-xl text-md">
        Vote on the compiled shortlist of tied movies. Outright highest voted movie wins! (Max 3 Votes)
      </p>

      {movies.length === 0 ? (
        <p className="text-muted italic">No movies advanced to the shortlist.</p>
      ) : (
        <ShortlistVotingFormClient
          weekId={week.id}
          movies={movies}
          initialVotes={userVoteIds}
        />
      )}
    </div>
  );
}

// 5. Round 4: Final Tiebreaker Voting
async function FinalVotingForm({ week, currentUserId, roundVotedUserIds }: any) {
  // Dynamically compile tied movies from Round 3
  const movies = await getFinalTiebreakerMovies(week.id);

  // User's current vote in this round
  const userVote = await db.weekVote.findFirst({
    where: { weekId: week.id, userId: currentUserId, round: "ROUND_4_TIEBREAKER" },
  });

  return (
    <div>
      <h3 className="text-3xl font-bold mb-sm">Round 4: Final Tiebreaker</h3>
      <p className="text-secondary mb-xl text-md">
        A tie has occurred in the shortlist round! Vote on the remaining tied options. If a tie persists here, a random winner will be selected. (1 Vote)
      </p>

      <FinalVotingFormClient
        weekId={week.id}
        movies={movies}
        initialVoteId={userVote?.targetId || null}
      />
    </div>
  );
}

// 6. Completed Week / Winner Announcement View
function CompletedWeekView({ week, movie, currentUser }: any) {
  const isLegacyMovie = movie.category.name === "Legacy";

  return (
    <div className="text-center py-md">
      <span className="text-10xl block mb-sm">🏆</span>
      <span className="text-base text-uppercase tracking-widest-2 text-primary-color font-bold">
        Winning Movie Chosen!
      </span>
      <h2 className="text-8xl font-extrabold mt-sm mb-md">
        {movie.title}{movie.year ? ` (${movie.year})` : ""}
      </h2>

      <div className="flex-center gap-lg mb-lg">
        {movie.trailerUrl && (
          <TrailerButton
            trailerUrl={movie.trailerUrl}
            className="btn-sm"
          />
        )}
        {movie.imdbUrl && (
          <a
            href={movie.imdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-sm text-primary-color font-semibold text-md underline"
          >
            View IMDb Page ↗
          </a>
        )}
      </div>

      {/* Prominent Metadata display for winner */}
      {(movie.director || movie.runtime || movie.stars || movie.plot || movie.posterUrl) && (
        <div className="winner-meta-card">
          {movie.posterUrl && (
            <img
              src={movie.posterUrl}
              alt={`${movie.title} Poster`}
              style={{
                width: "130px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--glass-border)",
                boxShadow: "var(--shadow-lg)",
                flexShrink: 0,
                margin: "0 auto"
              }}
            />
          )}
          <div className="winner-meta-info">
            {movie.plot && (
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.5", margin: 0 }}>
                {movie.plot}
              </p>
            )}
            <div className="text-sm text-secondary flex-col gap-sm mt-xs">
              {movie.imdbRating && <span>⭐ <strong className="text-primary-var">IMDb Rating:</strong> <span className="text-warning-color font-semibold">{movie.imdbRating}/10</span></span>}
              {movie.director && <span>🎬 <strong className="text-primary-var">Director:</strong> {movie.director}</span>}
              {movie.stars && <span>👥 <strong className="text-primary-var">Cast:</strong> {movie.stars}</span>}
              {movie.runtime && <span>⏱️ <strong className="text-primary-var">Runtime:</strong> {movie.runtime}</span>}
            </div>
          </div>
        </div>
      )}

      {week.isRandomlyChosen && (
        <div className="random-chosen-badge">
          🎲 Chosen by random tiebreaker draw!
        </div>
      )}

      <div className="flex-center gap-sm flex-wrap mb-2xl">
        {movie.genres.map((g: any) => (
          <span key={g.id} className="badge badge-user">
            {g.name}
          </span>
        ))}
      </div>

      {/* Admin Close-out Prompt */}
      {currentUser.role === "ADMIN" && (
        <div className="admin-actions-bar max-w-xl mx-auto text-left flex-col gap-md">
          <h3 className="text-lg font-bold mb-xs text-primary-var">
            👑 Admin: Close out Movie Night Week
          </h3>
          <p className="text-sm text-secondary mb-md">
            Ready to finalize the week? Choose an action below. This will mark the movie as watched and archive the week's history.
          </p>

          {!isLegacyMovie ? (
            // Form for Non-Legacy winning movies
            <div className="flex-row gap-md justify-center">
              <form
                action={async () => {
                  "use server";
                  await completeWeekAction(week.id, false);
                }}
              >
                <button type="submit" className="btn btn-secondary btn-sm">
                  Mark Watched & Close
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await completeWeekAction(week.id, true);
                }}
              >
                <button type="submit" className="btn btn-primary btn-sm">
                  Move to Legacy List & Close
                </button>
              </form>
            </div>
          ) : (
            // Form for Legacy winning movies
            <div className="flex-row gap-md justify-center">
              <form
                action={async () => {
                  "use server";
                  await completeWeekLegacyOverrideAction(week.id, false);
                }}
              >
                <button type="submit" className="btn btn-secondary btn-delete-week">
                  Remove from Legacy & Close
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await completeWeekLegacyOverrideAction(week.id, true);
                }}
              >
                <button type="submit" className="btn btn-primary btn-sm">
                  Keep on Legacy & Close
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
