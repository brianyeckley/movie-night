import {
  Calendar,
  Clapperboard,
  Crown,
  Popcorn,
  Dices,
  PartyPopper,
  BarChart3,
  Scale,
  Trophy,
  CheckCircle2,
  CircleX,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  getActiveUser,
  deleteWeekAction,
  resetRoundAction,
} from "@/app/actions";
import AdvanceRoundButton from "@/components/AdvanceRoundButton";
import AutoRefresh from "@/components/AutoRefresh";
import PastMovieNights from "@/components/PastMovieNights";
import {
  CategoryVotingForm,
  CategoryTiebreakerVotingForm,
  MovieVotingForm,
  SubcategoryVotingForm,
  ShortlistVotingForm,
  FinalVotingForm,
  CompletedWeekView,
  InPersonRound,
} from "@/components/DashboardForms";
import AdminStartWeekFormClient from "@/components/AdminStartWeekFormClient";
import { ACTIVE_WEEK } from "@/lib/weeks";
import { getRandomBgImage } from "@/lib/bg-images";
import {
  approvedVotes,
  formatRound,
  formatStatus,
  IN_PERSON_ROUNDS,
  roundCodeForStatus,
  ROUND_ORDER,
  type RoundCode,
} from "@/lib/rounds";


export const dynamic = "force-dynamic";

/** True while an in-person week is on one of its voting rounds. */
function isInPersonRound(status: string) {
  return status in IN_PERSON_ROUNDS;
}

/** One option within a closed round's results. */
interface RoundTarget {
  targetId: string;
  name: string;
  count: number;
  voters: string[];
}

/** A closed round, as shown under "Prior Round Results". */
interface RoundResult {
  roundCode: string;
  title: string;
  targets: RoundTarget[];
  isTie: boolean;
  /** Set when a random draw resolved this round's tie. */
  chosenTargetId: string | null;
}


export default async function DashboardPage() {
  const currentUser = await getActiveUser();
  const bgImage = getRandomBgImage();

  const activeWeek = await db.movieNightWeek.findFirst({
    where: ACTIVE_WEEK,
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

  // Fetch details for past winning movies in one query rather than one per week
  const pastWinnerIds = closedWeeks
    .map((wk) => wk.winningMovieId)
    .filter((id): id is string => Boolean(id));

  const pastWinners = await db.movie.findMany({
    where: { id: { in: pastWinnerIds } },
    include: { genres: true, category: true },
  });
  const pastWinnersById = new Map(pastWinners.map((m) => [m.id, m]));

  const pastWeeks = closedWeeks.map((wk) => ({
    ...wk,
    winner: wk.winningMovieId
      ? pastWinnersById.get(wk.winningMovieId) ?? null
      : null,
  }));

  // Compute round status details
  let roundTitle = "";
  let roundVotedUserIds: string[] = [];
  let activeRoundCode = "";
  let completedRoundsData: RoundResult[] = [];

  if (activeWeek) {
    activeRoundCode = roundCodeForStatus(activeWeek.status) ?? "";
    roundTitle = formatStatus(activeWeek.status);

    const approvedActiveVotes = approvedVotes(activeWeek.votes);

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

    const votesByRound: Record<string, typeof approvedActiveVotes> = {};
    approvedActiveVotes.forEach((v) => {
      if (v.round !== activeRoundCode) {
        if (!votesByRound[v.round]) {
          votesByRound[v.round] = [];
        }
        votesByRound[v.round].push(v);
      }
    });

    const parsedRounds = Object.entries(votesByRound).map(([roundCode, roundVotes]) => {
      const targetCounts: Record<string, RoundTarget> = {};
      
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
        } else if (roundCode === "ROUND_2C_SUB_MOVIE" && activeWeek.isRandomlyChosen) {
          chosenTargetId = activeWeek.selectedSubcategoryId || activeWeek.winningMovieId;
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
        title: formatRound(roundCode),
        targets: sortedTargets,
        isTie,
        chosenTargetId,
      };
    });

    // Newest round first
    parsedRounds.sort(
      (a, b) =>
        ROUND_ORDER.indexOf(b.roundCode as RoundCode) -
        ROUND_ORDER.indexOf(a.roundCode as RoundCode)
    );
    completedRoundsData = parsedRounds;
  }

  const allVotesIn = activeWeek ? users.every((u) => roundVotedUserIds.includes(u.id)) : false;
  const round1TiebreakerTieInfo = completedRoundsData.find((r) => r.roundCode === "ROUND_1_CATEGORY_TIEBREAKER" && r.isTie);
  const round1TiebreakerChosenName = round1TiebreakerTieInfo && activeWeek?.selectedCategoryId
    ? round1TiebreakerTieInfo.targets.find((t) => t.targetId === activeWeek.selectedCategoryId)?.name
    : null;

  const inPersonTiebreakerTieInfo = completedRoundsData.find((r) => 
    (r.roundCode === "IN_PERSON_ROUND_2" || r.roundCode === "IN_PERSON_ROUND_3") && 
    r.isTie && 
    r.chosenTargetId
  );
  const inPersonTiebreakerChosenName = inPersonTiebreakerTieInfo && activeWeek?.winningMovieId
    ? inPersonTiebreakerTieInfo.targets.find((t) => t.targetId === activeWeek.winningMovieId)?.name
    : null;

  const showBgImage = Boolean(currentUser && !activeWeek && bgImage);

  const latestVoteAt = activeWeek?.votes.reduce(
    (max, v) => Math.max(max, new Date(v.createdAt).getTime()),
    0
  ) ?? 0;
  const initialSignature = activeWeek
    ? [
        activeWeek.id,
        activeWeek.status,
        activeWeek.votes.length,
        latestVoteAt,
        activeWeek.selectedCategoryId ?? "",
        activeWeek.selectedSubcategoryId ?? "",
        activeWeek.winningMovieId ?? "",
        activeWeek.isRandomlyChosen ? "1" : "0",
      ].join(":")
    : undefined;

  return (
    <div className="py-xl">
      {activeWeek && activeWeek.status !== "COMPLETED" && (
        <AutoRefresh interval={5000} initialSignature={initialSignature} />
      )}

      {showBgImage && bgImage && (
        <div
          className="random-bg-image"
          style={{
            backgroundImage: `linear-gradient(rgba(8, 12, 20, 0.3), rgba(8, 12, 20, 0.45)), url(${bgImage.url})`,
            backgroundPosition: bgImage.bgPosition,
          }}
        />
      )}

      <main className="container">
        {!currentUser ? (
          // ----------------------------------------
          // NO USER SELECTED VIEW
          // ----------------------------------------
          <div className="glass-panel no-hover p-2xl text-center max-w-2xl mx-auto my-3xl">
            <h1 className="text-gradient text-8xl font-extrabold mb-lg">
              <Clapperboard size="1em" className="inline-icon" /> Welcome to Movie Night
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
                    {u.name} {u.role === "ADMIN" && <Crown size="1em" className="inline-icon" />}
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
            <div
              className={`glass-panel no-hover dashboard-panel ${
                !activeWeek ? `dashboard-panel-compact align-${bgImage?.panelAlign ?? "center"}` : ""
              }`}
            >
              {!activeWeek ? (
                // ----------------------------------------
                // NO ACTIVE WEEK STATE
                // ----------------------------------------
                <div className="text-center">
                  <div className="no-active-week-banner mb-lg">
                    <span className="text-8xl"><Popcorn size="1em" strokeWidth={1} className="inline-icon" /></span>
                    <div>
                      <h2 className="text-2xl font-semibold">No Active Week</h2>
                      <p className="text-secondary">
                        There is currently no movie night week in progress.
                      </p>
                    </div>
                  </div>

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
                        Week #{activeWeek.weekNumber} Voting {activeWeek.isInPerson && <Popcorn size="1em" className="inline-icon" />}
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
                      <span className="text-xl"><Dices size="1em" className="inline-icon" /></span>
                      <div>
                        <strong>Random Tiebreaker Draw occurred!</strong> Round 1b: Category Tiebreaker resulted in a tie. The category <strong className="text-accent-color font-bold">{round1TiebreakerChosenName}</strong> was randomly selected to resolve the tie.
                      </div>
                    </div>
                  )}

                  {inPersonTiebreakerChosenName && (
                    <div className="tiebreaker-banner">
                      <span className="text-xl"><Dices size="1em" className="inline-icon" /></span>
                      <div>
                        <strong>Random Tiebreaker Draw occurred!</strong> {inPersonTiebreakerTieInfo?.title} resulted in a tie. The movie <strong className="text-accent-color font-bold">{inPersonTiebreakerChosenName}</strong> was randomly selected to resolve the tie.
                      </div>
                    </div>
                  )}

                  {/* Admin Controls */}
                  {currentUser.role === "ADMIN" && (
                    <div className="admin-actions-bar">
                      <span className="text-md text-primary-var font-semibold">
                        <Crown size="1em" className="inline-icon" /> Admin Actions ({currentUser.name}):
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
                        <PartyPopper size="1em" className="inline-icon" /> Everyone has voted! Anyone can advance the round:
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
                          <CategoryVotingForm week={activeWeek} currentUserId={currentUser.id} />
                        )}

                        {/* ROUND 1b: Category Tiebreaker Voting */}
                        {activeWeek.status === "CATEGORY_TIEBREAKER_VOTING" && (
                          <CategoryTiebreakerVotingForm week={activeWeek} currentUserId={currentUser.id} />
                        )}

                        {/* ROUND 2: Movie/Subcategory Voting */}
                        {activeWeek.status === "MOVIE_VOTING" && (
                          <MovieVotingForm week={activeWeek} currentUserId={currentUser.id} />
                        )}

                        {/* ROUND 2b / 2c: Subcategory Movie Voting & Tiebreaker */}
                        {(activeWeek.status === "SUBCATEGORY_VOTING" || activeWeek.status === "SUBCATEGORY_TIEBREAKER_VOTING") && (
                          <SubcategoryVotingForm week={activeWeek} currentUserId={currentUser.id} />
                        )}

                        {/* ROUND 3: Shortlist Voting */}
                        {activeWeek.status === "SHORTLIST_VOTING" && (
                          <ShortlistVotingForm week={activeWeek} currentUserId={currentUser.id} />
                        )}

                        {/* ROUND 4: Tiebreaker Voting */}
                        {activeWeek.status === "FINAL_VOTING" && (
                          <FinalVotingForm week={activeWeek} currentUserId={currentUser.id} />
                        )}

                        {/* IN PERSON: every round, driven by the week's status */}
                        {isInPersonRound(activeWeek.status) && (
                          <InPersonRound week={activeWeek} currentUserId={currentUser.id} />
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
                            <BarChart3 size="1em" className="inline-icon" /> Prior Round Results
                          </h3>
                          <div className="flex-col gap-md">
                            {completedRoundsData.map((round) => (
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
                                        <Dices size="1em" className="inline-icon" /> <strong>Tiebreaker:</strong> Random draw selected{" "}
                                        <strong className="text-accent-color">
                                          {round.targets.find((t) => t.targetId === round.chosenTargetId)?.name || "Option"}
                                        </strong>
                                      </>
                                    ) : (
                                      <>
                                        <Scale size="1em" className="inline-icon" /> <strong>Tie:</strong> Round tied! All tied options advanced to the next round.
                                      </>
                                    )}
                                  </div>
                                )}

                                <div className="flex-col gap-sm">
                                  {round.targets.map((target) => {
                                    // Targets are sorted by count, so the leaders match the first entry
                                    const isWinner = target.count === round.targets[0].count;
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
                                            {isChosenRandomly ? <Dices size="1em" className="inline-icon" /> : (isWinner && !round.isTie) ? <Trophy size="1em" className="inline-icon" /> : null}
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
                                  {hasVoted ? (
                                    <>
                                      <CheckCircle2 size="1em" className="inline-icon" /> Voted
                                    </>
                                  ) : (
                                    <>
                                      <CircleX size="1em" className="inline-icon" /> Waiting
                                    </>
                                  )}
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
            <PastMovieNights pastWeeks={pastWeeks} isAdmin={currentUser?.role === "ADMIN"} />

          </div>
        )}
      </main>

      {showBgImage && bgImage?.credit && (
        <div className="bg-credit">
          <b>{bgImage.credit.title}</b> ({bgImage.credit.year})
          <br />
          <Calendar size="1em" className="inline-icon" /> {bgImage.credit.watched}
        </div>
      )}
    </div>
  );
}


