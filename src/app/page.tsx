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
import { MovieVotingFormClient, SubcategoryVotingFormClient, ShortlistVotingFormClient } from "@/components/VotingFormClient";
import TrailerButton from "@/components/TrailerButton";

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
  if (activeWeek) {
    let activeRoundCode = "";
    if (activeWeek.status === "CATEGORY_VOTING") activeRoundCode = "ROUND_1_CATEGORY";
    else if (activeWeek.status === "MOVIE_VOTING") activeRoundCode = "ROUND_2_MOVIE";
    else if (activeWeek.status === "SUBCATEGORY_VOTING") activeRoundCode = "ROUND_2_SUB_MOVIE";
    else if (activeWeek.status === "SHORTLIST_VOTING") activeRoundCode = "ROUND_3_SHORTLIST";
    else if (activeWeek.status === "FINAL_VOTING") activeRoundCode = "ROUND_4_TIEBREAKER";

    roundTitle = activeWeek.status.replace("_", " ");
    roundVotedUserIds = activeWeek.votes
      .filter((v) => v.round === activeRoundCode)
      .map((v) => v.userId);
  }

  return (
    <div style={{ padding: "40px 0" }}>
      <main className="container">
        {!currentUser ? (
          // ----------------------------------------
          // NO USER SELECTED VIEW
          // ----------------------------------------
          <div className="glass-panel no-hover" style={{ padding: "48px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
            <h1 className="text-gradient" style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "16px" }}>
              🎬 Welcome to Movie Night
            </h1>
            <p style={{ color: "var(--text-secondary)", marginBottom: "32px", fontSize: "1.1rem" }}>
              Please pick your profile in the header dropdown to enter the movie night dashboard, participate in voting, or manage the catalog.
            </p>
            <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: "24px" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "block", marginBottom: "12px" }}>
                Simulating profiles for:
              </span>
              <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
                {users.map((u) => (
                  <span key={u.id} style={{ fontSize: "0.95rem", color: "var(--text-primary)", padding: "6px 12px", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-secondary)" }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
            
            {/* Active Week / Voting Dashboard */}
            <div className="glass-panel no-hover" style={{ padding: "32px" }}>
              {!activeWeek ? (
                // ----------------------------------------
                // NO ACTIVE WEEK STATE
                // ----------------------------------------
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <span style={{ fontSize: "3rem", display: "block", marginBottom: "16px" }}>🍿</span>
                  <h2 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "8px" }}>No Active Week</h2>
                  <p style={{ color: "var(--text-secondary)", marginBottom: "32px", maxWidth: "500px", margin: "0 auto 32px auto" }}>
                    There is currently no movie night week in progress.
                  </p>
                  
                  {currentUser.role === "ADMIN" ? (
                    <div style={{ maxWidth: "400px", margin: "0 auto", padding: "24px", backgroundColor: "rgba(0, 0, 0, 0.15)", borderRadius: "var(--radius-md)", border: "1px solid var(--glass-border)", textAlign: "left" }}>
                      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "12px", color: "var(--text-primary)" }}>
                        Admin: Start New Movie Night Week
                      </h3>
                      <form
                        action={async (formData) => {
                          "use server";
                          const theme = formData.get("theme") as string;
                          if (theme) await createWeekAction(theme);
                        }}
                        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <label htmlFor="week-theme" style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                            Theme Category
                          </label>
                          {themeCategories.length > 0 ? (
                            <select
                              id="week-theme"
                              name="theme"
                              required
                              style={{
                                backgroundColor: "var(--bg-tertiary)",
                                color: "var(--text-primary)",
                                border: "1px solid var(--glass-border)",
                                borderRadius: "var(--radius-sm)",
                                padding: "8px 12px",
                                fontSize: "0.9rem",
                                outline: "none",
                                width: "100%",
                              }}
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
                              style={{
                                backgroundColor: "rgba(0, 0, 0, 0.2)",
                                color: "var(--text-primary)",
                                border: "1px solid var(--glass-border)",
                                borderRadius: "var(--radius-sm)",
                                padding: "8px 12px",
                                fontSize: "0.9rem",
                                outline: "none",
                              }}
                            />
                          )}
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "10px" }}>
                          Start Week
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div style={{ display: "inline-block", padding: "12px 24px", backgroundColor: "var(--primary-light)", border: "1px solid var(--primary)", borderRadius: "var(--radius-md)", color: "var(--primary)" }}>
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid var(--glass-border)", paddingBottom: "20px", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
                    <div>
                      <h2 style={{ fontSize: "1.8rem", fontWeight: 800 }}>
                        Week #{activeWeek.weekNumber} Voting
                      </h2>
                      <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginTop: "4px" }}>
                        Active Theme: <strong style={{ color: "var(--primary)" }}>{activeWeek.themeCategory?.name}</strong>
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>Status:</span>
                      <span style={{ fontSize: "0.85rem", backgroundColor: "var(--primary-light)", color: "var(--primary)", padding: "4px 12px", borderRadius: "var(--radius-full)", fontWeight: 700, border: "1px solid var(--primary)" }}>
                        {roundTitle}
                      </span>
                    </div>
                  </div>

                  {/* Admin Controls */}
                  {currentUser.role === "ADMIN" && (
                    <div style={{ padding: "16px 20px", backgroundColor: "rgba(99, 102, 241, 0.05)", border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: "var(--radius-md)", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                      <span style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: 600 }}>
                        👑 Admin Actions ({currentUser.name}):
                      </span>
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        {activeWeek.status !== "COMPLETED" && (
                          <>
                            <form
                              action={async () => {
                                "use server";
                                await resetRoundAction(activeWeek.id);
                              }}
                            >
                              <button type="submit" className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: "0.85rem" }}>
                                Reset Current Round Votes
                              </button>
                            </form>
                            <form
                              action={async () => {
                                "use server";
                                await advanceWeekRoundAction(activeWeek.id);
                              }}
                            >
                              <button type="submit" className="btn btn-primary" style={{ padding: "6px 14px", fontSize: "0.85rem" }}>
                                Close Round & Advance ➔
                              </button>
                            </form>
                          </>
                        )}
                        <form
                          action={async () => {
                            "use server";
                            await deleteWeekAction(activeWeek.id);
                          }}
                        >
                          <button type="submit" className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: "0.85rem", color: "var(--accent)", borderColor: "rgba(244, 63, 94, 0.2)" }}>
                            Delete Week
                          </button>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Voting Area */}
                  <div className="grid" style={{ gridTemplateColumns: "3fr 1.5fr", alignItems: "start" }}>
                    
                    {/* Active Form based on Week State */}
                    <div style={{ backgroundColor: "rgba(255, 255, 255, 0.015)", border: "1px solid var(--glass-border)", padding: "24px", borderRadius: "var(--radius-md)" }}>
                      
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

                    </div>

                    {/* Live Voting Tracker */}
                    <div className="glass-panel" style={{ padding: "24px", backgroundColor: "rgba(0,0,0,0.15)" }}>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px" }}>Vote Progress</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {users.map((u) => {
                          const hasVoted = roundVotedUserIds.includes(u.id);
                          return (
                            <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-sm)" }}>
                              <span style={{ fontWeight: 600 }}>{u.name}</span>
                              <span style={{ fontSize: "0.85rem", color: hasVoted ? "var(--success)" : "var(--accent)" }}>
                                {hasVoted ? "✅ Voted" : "❌ Waiting"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      
                      {activeWeek.status !== "COMPLETED" && (
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "16px", fontStyle: "italic", textAlign: "center" }}>
                          Selections are hidden until the Admin closes the round.
                        </p>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </div>

            {/* Past Movie Nights Log */}
            <div className="glass-panel no-hover" style={{ padding: "32px" }}>
              <h2 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "20px" }}>🎬 Past Movie Nights</h2>
              {pastWeeks.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>No movie nights have completed yet.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
                  {pastWeeks.map((wk) => (
                    <div key={wk.id} className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px", backgroundColor: "rgba(255, 255, 255, 0.01)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: 700 }}>
                          WEEK #{wk.weekNumber}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {wk.closedAt ? new Date(wk.closedAt).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                        {wk.winner?.title || "Unknown Movie"}{wk.winner?.year ? ` (${wk.winner.year})` : ""}
                      </h3>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "2px" }}>
                        {wk.winner?.trailerUrl && <TrailerButton trailerUrl={wk.winner.trailerUrl} />}
                        {wk.winner?.imdbUrl && (
                          <a href={wk.winner.imdbUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.8rem", color: "var(--primary)", textDecoration: "underline" }}>
                            IMDb Link ↗
                          </a>
                        )}
                      </div>
                      {wk.winner && (wk.winner.director || wk.winner.runtime || wk.winner.stars) && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "2px", margin: "2px 0 4px 0" }}>
                          {(wk.winner.director || wk.winner.runtime) && (
                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              {wk.winner.director && <span>🎬 {wk.winner.director}</span>}
                              {wk.winner.director && wk.winner.runtime && <span style={{ color: "var(--glass-border)" }}>•</span>}
                              {wk.winner.runtime && <span>⏱️ {wk.winner.runtime}</span>}
                            </div>
                          )}
                          {wk.winner.stars && (
                            <div style={{ color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                              👥 {wk.winner.stars}
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                        {wk.winner?.genres.map((g) => (
                          <span key={g.id} style={{ fontSize: "0.7rem", color: "var(--text-secondary)", backgroundColor: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: "var(--radius-sm)" }}>
                            {g.name}
                          </span>
                        ))}
                      </div>
                      <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: "8px", marginTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        <span>Theme: {wk.themeCategory?.name || "None"}</span>
                        {wk.isRandomlyChosen && (
                          <span style={{ color: "var(--accent)", fontWeight: 600 }}>🎲 Random Draw</span>
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
      <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "12px" }}>Round 1: Select Category</h3>
      <p style={{ color: "var(--text-secondary)", marginBottom: "20px", fontSize: "0.95rem" }}>
        Vote for the high-level category of movies to watch this week. Tie-breaks will result in a random pick. (1 Vote)
      </p>

      <form
        action={async (formData) => {
          "use server";
          const categoryId = formData.get("categoryId") as string;
          if (categoryId) {
            await submitCategoryVoteAction(week.id, categoryId);
          }
        }}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        {categories.map((cat) => (
          <label
            key={cat.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "14px 18px",
              borderRadius: "var(--radius-md)",
              border: "1px solid " + (userVote?.targetId === cat.id ? "var(--primary)" : "var(--glass-border)"),
              backgroundColor: userVote?.targetId === cat.id ? "var(--primary-light)" : "rgba(255,255,255,0.01)",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
            }}
          >
            <input
              type="radio"
              name="categoryId"
              value={cat.id}
              defaultChecked={userVote?.targetId === cat.id}
              style={{ cursor: "pointer", accentColor: "var(--primary)" }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)" }}>{cat.name}</span>
              {cat.isThemed && <span style={{ fontSize: "0.75rem", color: "var(--accent)" }}>Current Theme Category</span>}
            </div>
          </label>
        ))}

        <button type="submit" className="btn btn-primary" style={{ marginTop: "12px" }}>
          {userVote ? "Update Category Vote" : "Cast Category Vote"}
        </button>
      </form>
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
      <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "6px" }}>
        Round 2: Select Movies in <span style={{ color: "var(--primary)" }}>{category?.name}</span>
      </h3>
      <p style={{ color: "var(--text-secondary)", marginBottom: "20px", fontSize: "0.95rem" }}>
        Select movies or subcategories from the winning category. If one movie wins outright, it becomes the weekly winner immediately! (Max 2 Votes)
      </p>

      {movies.length === 0 && subcategories.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontStyle: "italic", padding: "12px 0" }}>
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
      <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "6px" }}>
        Round 2b: Select Movies in Subcategory <span style={{ color: "var(--primary)" }}>{subcategory?.name}</span>
      </h3>
      <p style={{ color: "var(--text-secondary)", marginBottom: "20px", fontSize: "0.95rem" }}>
        Select movies inside the winning subcategory. The top voted movies will enter the shortlist. (Max 2 Votes)
      </p>

      {movies.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontStyle: "italic", padding: "12px 0" }}>
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
      <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "6px" }}>Round 3: Shortlist Voting</h3>
      <p style={{ color: "var(--text-secondary)", marginBottom: "20px", fontSize: "0.95rem" }}>
        Vote on the compiled shortlist of tied movies. Outright highest voted movie wins! (Max 3 Votes)
      </p>

      {movies.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No movies advanced to the shortlist.</p>
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
      <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "6px" }}>Round 4: Final Tiebreaker</h3>
      <p style={{ color: "var(--text-secondary)", marginBottom: "20px", fontSize: "0.95rem" }}>
        A tie has occurred in the shortlist round! Vote on the remaining tied options. If a tie persists here, a random winner will be selected. (1 Vote)
      </p>

      <form
        action={async (formData) => {
          "use server";
          const movieId = formData.get("movieId") as string;
          if (movieId) {
            await submitFinalVoteAction(week.id, movieId);
          }
        }}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        {movies.map((movie) => (
          <div
            key={movie.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 18px",
              borderRadius: "var(--radius-md)",
              border: "1px solid " + (userVote?.targetId === movie.id ? "var(--primary)" : "var(--glass-border)"),
              backgroundColor: userVote?.targetId === movie.id ? "var(--primary-light)" : "rgba(255,255,255,0.01)",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                cursor: "pointer",
                flex: 1,
              }}
            >
              <input
                type="radio"
                name="movieId"
                value={movie.id}
                defaultChecked={userVote?.targetId === movie.id}
                style={{ cursor: "pointer", accentColor: "var(--primary)" }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontWeight: 600 }}>{movie.title}{movie.year ? ` (${movie.year})` : ""}</span>
                {(movie.director || movie.runtime || movie.stars) && (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px", display: "flex", flexDirection: "column", gap: "2px" }}>
                    {(movie.director || movie.runtime) && (
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                        {movie.director && <span>🎬 <span style={{ color: "var(--text-muted)" }}>Dir:</span> {movie.director}</span>}
                        {movie.director && movie.runtime && <span style={{ color: "var(--glass-border)" }}>•</span>}
                        {movie.runtime && <span>⏱️ {movie.runtime}</span>}
                      </div>
                    )}
                    {movie.stars && (
                      <div style={{ display: "flex", gap: "4px", alignItems: "baseline" }}>
                        <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>👥 Cast:</span>
                        <span style={{ color: "var(--text-secondary)" }}>{movie.stars}</span>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                  {movie.genres.map((g) => (
                    <span key={g.id} style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                      #{g.name}
                    </span>
                  ))}
                </div>
              </div>
            </label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {movie.trailerUrl && <TrailerButton trailerUrl={movie.trailerUrl} />}
              {movie.imdbUrl && (
                <a
                  href={movie.imdbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "0.75rem", color: "var(--primary)", textDecoration: "underline" }}
                >
                  IMDb ↗
                </a>
              )}
            </div>
          </div>
        ))}

        <button type="submit" className="btn btn-primary" style={{ marginTop: "12px" }}>
          {userVote ? "Update Final Vote" : "Cast Final Vote"}
        </button>
      </form>
    </div>
  );
}

// 6. Completed Week / Winner Announcement View
function CompletedWeekView({ week, movie, currentUser }: any) {
  const isLegacyMovie = movie.category.name === "Legacy";

  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <span style={{ fontSize: "4rem", display: "block", marginBottom: "8px" }}>🏆</span>
      <span style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--primary)", fontWeight: 700 }}>
        Winning Movie Chosen!
      </span>
      <h2 style={{ fontSize: "2.5rem", fontWeight: 800, marginTop: "8px", marginBottom: "12px" }}>
        {movie.title}{movie.year ? ` (${movie.year})` : ""}
      </h2>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
        {movie.trailerUrl && (
          <TrailerButton
            trailerUrl={movie.trailerUrl}
            style={{
              padding: "6px 14px",
              fontSize: "0.85rem",
              borderRadius: "var(--radius-md)",
            }}
          />
        )}
        {movie.imdbUrl && (
          <a
            href={movie.imdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--primary)",
              fontWeight: 600,
              fontSize: "0.95rem",
              textDecoration: "underline",
            }}
          >
            View IMDb Page ↗
          </a>
        )}
      </div>

      {/* Prominent Metadata display for winner */}
      {(movie.director || movie.runtime || movie.stars) && (
        <div style={{
          backgroundColor: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--glass-border)",
          borderRadius: "var(--radius-md)",
          padding: "16px",
          maxWidth: "450px",
          margin: "0 auto 24px auto",
          fontSize: "0.9rem",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          textAlign: "left"
        }}>
          {movie.director && (
            <div>
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>🎬 Director:</span>{" "}
              <span style={{ color: "var(--text-primary)" }}>{movie.director}</span>
            </div>
          )}
          {movie.runtime && (
            <div>
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>⏱️ Runtime:</span>{" "}
              <span style={{ color: "var(--text-primary)" }}>{movie.runtime}</span>
            </div>
          )}
          {movie.stars && (
            <div>
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>👥 Starring:</span>{" "}
              <span style={{ color: "var(--text-secondary)" }}>{movie.stars}</span>
            </div>
          )}
        </div>
      )}

      {week.isRandomlyChosen && (
        <div
          style={{
            maxWidth: "320px",
            margin: "0 auto 24px auto",
            padding: "6px 12px",
            backgroundColor: "var(--accent-light)",
            border: "1px solid var(--accent)",
            borderRadius: "var(--radius-full)",
            color: "var(--accent)",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          🎲 Chosen by random tiebreaker draw!
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap", marginBottom: "32px" }}>
        {movie.genres.map((g: any) => (
          <span key={g.id} style={{ fontSize: "0.8rem", color: "var(--text-secondary)", backgroundColor: "var(--bg-tertiary)", padding: "4px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--glass-border)" }}>
            {g.name}
          </span>
        ))}
      </div>

      {/* Admin Close-out Prompt */}
      {currentUser.role === "ADMIN" && (
        <div style={{ maxWidth: "450px", margin: "0 auto", padding: "24px", backgroundColor: "rgba(99, 102, 241, 0.05)", border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: "var(--radius-md)" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "12px", color: "var(--text-primary)" }}>
            👑 Admin: Close out Movie Night Week
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "20px", lineHeight: "1.5" }}>
            Ready to finalize the week? Choose an action below. This will mark the movie as watched and archive the week's history.
          </p>

          {!isLegacyMovie ? (
            // Form for Non-Legacy winning movies
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <form
                action={async () => {
                  "use server";
                  await completeWeekAction(week.id, false);
                }}
              >
                <button type="submit" className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
                  Mark Watched & Close
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await completeWeekAction(week.id, true);
                }}
              >
                <button type="submit" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
                  Move to Legacy List & Close
                </button>
              </form>
            </div>
          ) : (
            // Form for Legacy winning movies
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <form
                action={async () => {
                  "use server";
                  await completeWeekLegacyOverrideAction(week.id, false);
                }}
              >
                <button type="submit" className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: "0.85rem", color: "var(--accent)", borderColor: "rgba(244, 63, 94, 0.2)" }}>
                  Remove from Legacy & Close
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await completeWeekLegacyOverrideAction(week.id, true);
                }}
              >
                <button type="submit" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
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
