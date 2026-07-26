import { db } from "@/lib/db";
import {
  getActiveUser,
  createWeekAction,
  deleteWeekAction,
  resetRoundAction,
  advanceWeekRoundAction,
} from "@/app/actions";
import Link from "next/link";
import DeletePastMovieNightButton from "@/components/DeletePastMovieNightButton";
import AdvanceRoundButton from "@/components/AdvanceRoundButton";
import AutoRefresh from "@/components/AutoRefresh";
import TrailerButton from "@/components/TrailerButton";
import {
  CategoryVotingForm,
  CategoryTiebreakerVotingForm,
  MovieVotingForm,
  SubcategoryVotingForm,
  ShortlistVotingForm,
  FinalVotingForm,
  CompletedWeekView,
  InPersonVotingRound,
  InPersonTiebreakerRound,
  InPersonRound2,
  InPersonRound3,
} from "@/components/DashboardForms";
import AdminStartWeekFormClient from "@/components/AdminStartWeekFormClient";

export const dynamic = "force-dynamic";


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

  // Fetch all approved users
  const users = await db.user.findMany({
    where: { isApproved: true },
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
    else if (activeWeek.status === "CATEGORY_TIEBREAKER_VOTING") activeRoundCode = "ROUND_1_CATEGORY_TIEBREAKER";
    else if (activeWeek.status === "MOVIE_VOTING") activeRoundCode = "ROUND_2_MOVIE";
    else if (activeWeek.status === "SUBCATEGORY_VOTING") activeRoundCode = "ROUND_2_SUB_MOVIE";
    else if (activeWeek.status === "SUBCATEGORY_TIEBREAKER_VOTING") activeRoundCode = "ROUND_2C_SUB_MOVIE";
    else if (activeWeek.status === "SHORTLIST_VOTING") activeRoundCode = "ROUND_3_SHORTLIST";
    else if (activeWeek.status === "FINAL_VOTING") activeRoundCode = "ROUND_4_TIEBREAKER";
    else if (activeWeek.status === "IN_PERSON_VOTING") activeRoundCode = "IN_PERSON_ROUND_1";
    else if (activeWeek.status === "IN_PERSON_TIEBREAKER") activeRoundCode = "IN_PERSON_ROUND_1B";
    else if (activeWeek.status === "IN_PERSON_ROUND_2") activeRoundCode = "IN_PERSON_ROUND_2";
    else if (activeWeek.status === "IN_PERSON_ROUND_3") activeRoundCode = "IN_PERSON_ROUND_3";

    if (activeWeek.status === "CATEGORY_TIEBREAKER_VOTING") {
      roundTitle = "Category Tiebreaker Voting";
    } else if (activeWeek.status === "SUBCATEGORY_TIEBREAKER_VOTING") {
      roundTitle = "Subcategory Tiebreaker Voting";
    } else if (activeWeek.status === "IN_PERSON_VOTING") {
      roundTitle = "In Person Voting";
    } else if (activeWeek.status === "IN_PERSON_TIEBREAKER") {
      roundTitle = "In Person Tiebreaker Voting";
    } else {
      roundTitle = activeWeek.status.replace("_", " ");
    }
    const approvedActiveVotes = activeWeek.votes.filter((v) => v.user.isApproved);

    roundVotedUserIds = approvedActiveVotes
      .filter((v) => v.round === activeRoundCode)
      .map((v) => v.userId);

    // Resolve display names for votes
    const targetIds = Array.from(new Set(approvedActiveVotes.map((v) => v.targetId)));

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
    approvedActiveVotes.forEach((v) => {
      if (v.round !== activeRoundCode) {
        if (!votesByRound[v.round]) {
          votesByRound[v.round] = [];
        }
        votesByRound[v.round].push(v);
      }
    });

    const roundTitles: Record<string, string> = {
      ROUND_1_CATEGORY: "Round 1: Category Selection",
      ROUND_1_CATEGORY_TIEBREAKER: "Round 1b: Category Tiebreaker",
      ROUND_2_MOVIE: "Round 2: Movie Selection",
      ROUND_2_SUB_MOVIE: "Round 2b: Subcategory Movie Selection",
      ROUND_2C_SUB_MOVIE: "Round 2c: Subcategory Tiebreaker",
      ROUND_3_SHORTLIST: "Round 3: Shortlist Selection",
      ROUND_4_TIEBREAKER: "Round 4: Final Tiebreaker",
      IN_PERSON_ROUND_1: "Round 1: In Person Movie Selection",
      IN_PERSON_ROUND_1B: "Round 1b: In Person Tiebreaker",
      IN_PERSON_ROUND_2: "Round 2: In Person Tiebreaker (1 vote)",
      IN_PERSON_ROUND_3: "Round 3: In Person Final Tiebreaker (2 votes)",
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
        if (roundCode === "ROUND_1_CATEGORY_TIEBREAKER") {
          chosenTargetId = activeWeek.selectedCategoryId;
        } else if (
          (roundCode === "ROUND_4_TIEBREAKER" || 
           roundCode === "IN_PERSON_ROUND_1B" || 
           roundCode === "IN_PERSON_ROUND_2" || 
           roundCode === "IN_PERSON_ROUND_3") &&
          activeWeek.isRandomlyChosen
        ) {
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
      "ROUND_1_CATEGORY_TIEBREAKER",
      "ROUND_2_MOVIE",
      "ROUND_2_SUB_MOVIE",
      "ROUND_3_SHORTLIST",
      "ROUND_4_TIEBREAKER",
      "IN_PERSON_ROUND_1",
      "IN_PERSON_ROUND_1B",
      "IN_PERSON_ROUND_2",
      "IN_PERSON_ROUND_3",
    ];

    parsedRounds.sort((a, b) => roundOrder.indexOf(b.roundCode) - roundOrder.indexOf(a.roundCode));
    completedRoundsData = parsedRounds;
  }

  const allVotesIn = activeWeek ? users.every((u) => roundVotedUserIds.includes(u.id)) : false;
  const round1TiebreakerTieInfo = completedRoundsData.find((r) => r.roundCode === "ROUND_1_CATEGORY_TIEBREAKER" && r.isTie);
  const round1TiebreakerChosenName = round1TiebreakerTieInfo && activeWeek?.selectedCategoryId
    ? round1TiebreakerTieInfo.targets.find((t: any) => t.targetId === activeWeek.selectedCategoryId)?.name
    : null;

  const inPersonTiebreakerTieInfo = completedRoundsData.find((r) => 
    (r.roundCode === "IN_PERSON_ROUND_2" || r.roundCode === "IN_PERSON_ROUND_3") && 
    r.isTie && 
    r.chosenTargetId
  );
  const inPersonTiebreakerChosenName = inPersonTiebreakerTieInfo && activeWeek?.winningMovieId
    ? inPersonTiebreakerTieInfo.targets.find((t: any) => t.targetId === activeWeek.winningMovieId)?.name
    : null;

  return (
    <div className="py-xl">
      {activeWeek && activeWeek.status !== "COMPLETED" && (
        <AutoRefresh interval={5000} />
      )}
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
                      <AdminStartWeekFormClient themeCategories={themeCategories} />
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
                        Week #{activeWeek.weekNumber} Voting {activeWeek.isInPerson && "🍿"}
                      </h2>
                      {activeWeek.isInPerson ? (
                        <p className="text-secondary text-md mt-xs animate-slide-in">
                          In-Person Movie Night (Physical Media Only)
                        </p>
                      ) : (
                        <p className="text-secondary text-md mt-xs">
                          Active Theme: <strong className="text-primary-color">{activeWeek.themeCategory?.name}</strong>
                        </p>
                      )}
                    </div>
                    <div className="flex-row items-center gap-sm">
                      <span className="text-sm-alt text-uppercase tracking-widest text-secondary">Status:</span>
                      <span className="badge badge-admin">
                        {roundTitle}
                      </span>
                    </div>
                  </div>

                  {/* Tiebreaker Alert Banner */}
                  {round1TiebreakerChosenName && (
                    <div className="tiebreaker-banner">
                      <span className="text-xl">🎲</span>
                      <div>
                        <strong>Random Tiebreaker Draw occurred!</strong> Round 1b: Category Tiebreaker resulted in a tie. The category <strong className="text-accent-color font-bold">{round1TiebreakerChosenName}</strong> was randomly selected to resolve the tie.
                      </div>
                    </div>
                  )}

                  {inPersonTiebreakerChosenName && (
                    <div className="tiebreaker-banner">
                      <span className="text-xl">🎲</span>
                      <div>
                        <strong>Random Tiebreaker Draw occurred!</strong> {inPersonTiebreakerTieInfo?.title} resulted in a tie. The movie <strong className="text-accent-color font-bold">{inPersonTiebreakerChosenName}</strong> was randomly selected to resolve the tie.
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
                    
                    <div className="flex-col gap-xl">
                      {/* Active Form based on Week State */}
                      <div className="dashboard-form-container">
                        
                        {/* ROUND 1: Category Voting */}
                        {activeWeek.status === "CATEGORY_VOTING" && (
                          <CategoryVotingForm week={activeWeek} currentUserId={currentUser.id} roundVotedUserIds={roundVotedUserIds} />
                        )}

                        {/* ROUND 1b: Category Tiebreaker Voting */}
                        {activeWeek.status === "CATEGORY_TIEBREAKER_VOTING" && (
                          <CategoryTiebreakerVotingForm week={activeWeek} currentUserId={currentUser.id} roundVotedUserIds={roundVotedUserIds} />
                        )}

                        {/* ROUND 2: Movie/Subcategory Voting */}
                        {activeWeek.status === "MOVIE_VOTING" && (
                          <MovieVotingForm week={activeWeek} currentUserId={currentUser.id} roundVotedUserIds={roundVotedUserIds} />
                        )}

                        {/* ROUND 2b / 2c: Subcategory Movie Voting & Tiebreaker */}
                        {(activeWeek.status === "SUBCATEGORY_VOTING" || activeWeek.status === "SUBCATEGORY_TIEBREAKER_VOTING") && (
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

                        {/* IN PERSON: Round 1 Voting */}
                        {activeWeek.status === "IN_PERSON_VOTING" && (
                          <InPersonVotingRound week={activeWeek} currentUserId={currentUser.id} roundVotedUserIds={roundVotedUserIds} />
                        )}

                        {/* IN PERSON: Round 1b Tiebreaker Voting */}
                        {activeWeek.status === "IN_PERSON_TIEBREAKER" && (
                          <InPersonTiebreakerRound week={activeWeek} currentUserId={currentUser.id} roundVotedUserIds={roundVotedUserIds} />
                        )}

                        {/* IN PERSON: Round 2 Tiebreaker Voting */}
                        {activeWeek.status === "IN_PERSON_ROUND_2" && (
                          <InPersonRound2 week={activeWeek} currentUserId={currentUser.id} roundVotedUserIds={roundVotedUserIds} />
                        )}

                        {/* IN PERSON: Round 3 Tiebreaker Voting */}
                        {activeWeek.status === "IN_PERSON_ROUND_3" && (
                          <InPersonRound3 week={activeWeek} currentUserId={currentUser.id} roundVotedUserIds={roundVotedUserIds} />
                        )}

                        {/* COMPLETED / WINNER STATE */}
                        {activeWeek.status === "COMPLETED" && activeWinnerMovie && (
                          <CompletedWeekView week={activeWeek} movie={activeWinnerMovie} currentUser={currentUser} />
                        )}

                      </div>

                      {/* PRIOR ROUND RESULTS (Flattened container) */}
                      {completedRoundsData.length > 0 && (
                        <div className="prior-rounds-section flex-col gap-md">
                          <h3 className="text-xl font-bold text-primary-var flex-row items-center gap-sm px-xs">
                            📊 Prior Round Results
                          </h3>
                          <div className="flex-col gap-md">
                            {completedRoundsData.map((round: any) => (
                              <div 
                                key={round.roundCode} 
                                className="prior-round-card"
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

                                    let itemBgColor = "rgba(255, 255, 255, 0.015)";
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
                                        className="prior-round-item"
                                        style={{ 
                                          display: "flex", 
                                          justifyContent: "space-between", 
                                          alignItems: "center", 
                                          padding: "10px 14px", 
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
                        {wk.winner?.physical4K && <span className="badge-media badge-media-4k">4K</span>}
                        {wk.winner?.physicalBluRay && <span className="badge-media badge-media-bluray">Blu-ray</span>}
                        {wk.winner?.physicalDvd && <span className="badge-media badge-media-dvd">DVD</span>}
                        {wk.winner?.genres.map((g) => (
                          <span key={g.id} className="badge-genre">
                            {g.name}
                          </span>
                        ))}
                      </div>
                      <div className="border-t pt-sm mt-sm flex-between text-sm-alt text-muted">
                        {wk.isInPerson ? (
                          <span className="text-accent-color font-semibold">📼 In-Person Screening</span>
                        ) : (
                          <span>Theme: {wk.themeCategory?.name || "None"}</span>
                        )}
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


