import { db } from "@/lib/db";
import {
  completeWeekAction,
  completeWeekLegacyOverrideAction,
} from "@/app/actions";
import {
  CategoryVotingFormClient,
  CategoryTiebreakerVotingFormClient,
  MovieVotingFormClient,
  SubcategoryVotingFormClient,
  ShortlistVotingFormClient,
  FinalVotingFormClient,
} from "@/components/VotingFormClient";
import TrailerButton from "@/components/TrailerButton";
import {
  getCategoryTiebreakerCategories,
  getShortlistMovies,
  getFinalTiebreakerMovies,
  getInPersonTiebreakerMovies,
  getInPersonTiedMovies,
} from "@/lib/voting-helpers";
import InPersonVotingForm from "@/components/InPersonVotingForm";

// 1. Round 1: Category Voting
export async function CategoryVotingForm({ week, currentUserId }: any) {
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

// 1b. Round 1b: Category Tiebreaker Voting
export async function CategoryTiebreakerVotingForm({ week, currentUserId }: any) {
  const categories = await getCategoryTiebreakerCategories(week.id);

  // User's current votes in this round
  const userVotes = await db.weekVote.findMany({
    where: { weekId: week.id, userId: currentUserId, round: "ROUND_1_CATEGORY_TIEBREAKER" },
  });
  const userVoteIds = userVotes.map((v) => v.targetId);

  return (
    <div>
      <h3 className="text-3xl font-bold mb-sm">Round 1b: Category Tiebreaker</h3>
      <p className="text-secondary mb-xl text-md">
        Round 1 ended in a tie! Select up to 2 categories. If a tie persists, a random winner will be selected from the top choices. (Max 2 Votes)
      </p>

      {categories.length === 0 ? (
        <p className="text-muted italic">No categories tied in the first round.</p>
      ) : (
        <CategoryTiebreakerVotingFormClient
          weekId={week.id}
          categories={categories}
          initialVotes={userVoteIds}
        />
      )}
    </div>
  );
}

// 2. Round 2: Movie/Subcategory Voting in Category
export async function MovieVotingForm({ week, currentUserId }: any) {
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
export async function SubcategoryVotingForm({ week, currentUserId }: any) {
  if (!week.selectedSubcategoryId) return <p>Subcategory not selected.</p>;

  // Check if this round is a tiebreaker from Round 2
  const r2Votes = await db.weekVote.findMany({
    where: { weekId: week.id, round: "ROUND_2_MOVIE" },
    include: { user: true },
  });
  const approvedR2Votes = r2Votes.filter((v) => v.user.isApproved);
  const r2Counts: Record<string, number> = {};
  approvedR2Votes.forEach((v) => {
    r2Counts[v.targetId] = (r2Counts[v.targetId] || 0) + 1;
  });
  const r2Max = Math.max(...Object.values(r2Counts), 0);
  const r2TiedIds = Object.keys(r2Counts).filter((id) => r2Counts[id] === r2Max);
  const isTie = r2TiedIds.length > 1;

  const subcategory = await db.category.findUnique({
    where: { id: week.selectedSubcategoryId },
  });

  let movies: any[] = [];
  let subcategories: any[] = [];

  if (isTie) {
    // Tiebreaker mode: show the subcategory itself plus the other tied movies
    if (subcategory) {
      subcategories = [subcategory];
    }
    const tiedMovieIds = r2TiedIds.filter((id) => id !== week.selectedSubcategoryId);
    movies = await db.movie.findMany({
      where: { id: { in: tiedMovieIds } },
      include: { genres: true },
      orderBy: { title: "asc" },
    });
  } else {
    // Normal mode: movies in this subcategory (exclude watched)
    movies = await db.movie.findMany({
      where: { categoryId: week.selectedSubcategoryId, watched: false },
      include: { genres: true },
      orderBy: { title: "asc" },
    });
  }

  // User's current votes in this sub-round
  const userVotes = await db.weekVote.findMany({
    where: { weekId: week.id, userId: currentUserId, round: "ROUND_2_SUB_MOVIE" },
  });
  const userVoteIds = userVotes.map((v) => v.targetId);

  return (
    <div>
      {isTie ? (
        <>
          <h3 className="text-3xl font-bold mb-sm">
            Round 2b: Tiebreaker Voting
          </h3>
          <p className="text-secondary mb-xl text-md">
            Round 2 ended in a tie! Select from the tied options, including the subcategory and movies. (Max 3 Votes)
          </p>
        </>
      ) : (
        <>
          <h3 className="text-3xl font-bold mb-sm">
            Round 2b: Select Movies in Subcategory <span className="text-primary-color">{subcategory?.name}</span>
          </h3>
          <p className="text-secondary mb-xl text-md">
            Select movies inside the winning subcategory. The top voted movies will enter the shortlist. (Max 3 Votes)
          </p>
        </>
      )}

      {movies.length === 0 && subcategories.length === 0 ? (
        <p className="text-muted italic py-sm">
          {isTie ? "No tied options available." : `No movies added in this subcategory yet. Go to the Catalog tab to add movies under "${subcategory?.name}"!`}
        </p>
      ) : (
        <SubcategoryVotingFormClient
          weekId={week.id}
          movies={movies}
          subcategories={subcategories}
          initialVotes={userVoteIds}
        />
      )}
    </div>
  );
}

// 4. Round 3: Shortlist Voting
export async function ShortlistVotingForm({ week, currentUserId }: any) {
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
export async function FinalVotingForm({ week, currentUserId }: any) {
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
export function CompletedWeekView({ week, movie, currentUser }: any) {
  const isLegacyMovie = movie.category.name === "Legacy";

  return (
    <div className="text-center py-md">
      <span className="text-10xl block mb-sm">🏆</span>
      {week.isInPerson ? (
        <span className="text-base text-uppercase tracking-widest-2 text-accent-color font-bold">
          Winning In-Person Movie Chosen!
        </span>
      ) : (
        <span className="text-base text-uppercase tracking-widest-2 text-primary-color font-bold">
          Winning Movie Chosen!
        </span>
      )}
      
      {week.isInPerson && (
        <p className="text-md text-secondary mt-xs font-semibold animate-slide-in" style={{ opacity: 0.9 }}>
          Ready for screening on physical media.
        </p>
      )}

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
        {movie.physical4K && <span className="badge-media badge-media-4k">4K</span>}
        {movie.physicalBluRay && <span className="badge-media badge-media-bluray">Blu-ray</span>}
        {movie.physicalDvd && <span className="badge-media badge-media-dvd">DVD</span>}
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

// 7. In Person: Round 1 In Person Voting
export async function InPersonVotingRound({ week, currentUserId }: any) {
  const movies = await db.movie.findMany({
    where: {
      watched: false,
      OR: [
        { physical4K: true },
        { physicalBluRay: true },
        { physicalDvd: true },
      ],
    },
    include: { genres: true },
    orderBy: { title: "asc" },
  });

  const userVotes = await db.weekVote.findMany({
    where: { weekId: week.id, userId: currentUserId, round: "IN_PERSON_ROUND_1" },
  });
  const userVoteIds = userVotes.map((v) => v.targetId);

  return (
    <div>
      <h3 className="text-3xl font-bold mb-sm text-accent-color">In Person Movie Night: Round 1</h3>
      <p className="text-secondary mb-xl text-md">
        Vote for up to 3 physical media movies to watch in person. (Max 3 Votes)
      </p>

      {movies.length === 0 ? (
        <p className="text-muted italic py-sm">
          No physical media movies found. Go to the Catalog tab to add or mark movies with physical media formats!
        </p>
      ) : (
        <InPersonVotingForm
          weekId={week.id}
          movies={movies}
          initialVotes={userVoteIds}
          maxVotes={3}
        />
      )}
    </div>
  );
}

// 8. In Person: Round 1b In Person Tiebreaker Voting
export async function InPersonTiebreakerRound({ week, currentUserId }: any) {
  const movies = await getInPersonTiebreakerMovies(week.id);

  const userVotes = await db.weekVote.findMany({
    where: { weekId: week.id, userId: currentUserId, round: "IN_PERSON_ROUND_1B" },
  });
  const userVoteIds = userVotes.map((v) => v.targetId);

  return (
    <div>
      <h3 className="text-3xl font-bold mb-sm text-accent-color">In Person Movie Night: Round 1b Tiebreaker</h3>
      <p className="text-secondary mb-xl text-md">
        Round 1 ended in a tie! Select up to 4 movies for the in-person tiebreaker. (Max 4 Votes)
      </p>

      {movies.length === 0 ? (
        <p className="text-muted italic py-sm">
          No movies advanced to the tiebreaker.
        </p>
      ) : (
        <InPersonVotingForm
          weekId={week.id}
          movies={movies}
          initialVotes={userVoteIds}
          maxVotes={4}
        />
      )}
    </div>
  );
}

// 9. In Person: Round 2 In Person Tiebreaker Voting (Third Round)
export async function InPersonRound2({ week, currentUserId }: any) {
  const movies = await getInPersonTiedMovies(week.id, "IN_PERSON_ROUND_1B");

  const userVotes = await db.weekVote.findMany({
    where: { weekId: week.id, userId: currentUserId, round: "IN_PERSON_ROUND_2" },
  });
  const userVoteIds = userVotes.map((v) => v.targetId);

  return (
    <div>
      <h3 className="text-3xl font-bold mb-sm text-accent-color">In Person Movie Night: Round 2 Tiebreaker</h3>
      <p className="text-secondary mb-xl text-md">
        Round 1b ended in a tie! Select exactly 1 movie from the tied choices. (1 Vote)
      </p>

      {movies.length === 0 ? (
        <p className="text-muted italic py-sm">
          No movies advanced to this round.
        </p>
      ) : (
        <InPersonVotingForm
          weekId={week.id}
          movies={movies}
          initialVotes={userVoteIds}
          maxVotes={1}
        />
      )}
    </div>
  );
}

// 10. In Person: Round 3 In Person Tiebreaker Voting (Final Round)
export async function InPersonRound3({ week, currentUserId }: any) {
  const movies = await getInPersonTiedMovies(week.id, "IN_PERSON_ROUND_2");

  const userVotes = await db.weekVote.findMany({
    where: { weekId: week.id, userId: currentUserId, round: "IN_PERSON_ROUND_3" },
  });
  const userVoteIds = userVotes.map((v) => v.targetId);

  return (
    <div>
      <h3 className="text-3xl font-bold mb-sm text-accent-color">In Person Movie Night: Round 3 Tiebreaker</h3>
      <p className="text-secondary mb-xl text-md">
        Round 2 ended in a tie! Since the remaining movies equals the number of voters, this is the final tiebreaker. Select up to 2 movies. (Max 2 Votes)
      </p>

      {movies.length === 0 ? (
        <p className="text-muted italic py-sm">
          No movies advanced to this round.
        </p>
      ) : (
        <InPersonVotingForm
          weekId={week.id}
          movies={movies}
          initialVotes={userVoteIds}
          maxVotes={2}
        />
      )}
    </div>
  );
}

