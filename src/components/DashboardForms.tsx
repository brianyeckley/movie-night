import { db } from "@/lib/db";
import { sortMoviesByTitle } from "@/lib/movie-sort";
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
import {
  approvedVotes,
  IN_PERSON_ROUNDS,
  tallyVotes,
  type InPersonStatus,
  type RoundCode,
} from "@/lib/rounds";
import type {
  ActiveWeek,
  Category,
  MovieWithGenres,
  MovieWithGenresAndCategory,
  RoundFormProps,
  User,
} from "@/lib/types";

// Load a week's votes for one round, keeping only approved voters
async function loadApprovedRoundVotes(weekId: string, round: RoundCode) {
  const votes = await db.weekVote.findMany({
    where: { weekId, round },
    include: { user: true },
  });
  return approvedVotes(votes);
}

// 1. Round 1: Category Voting
export async function CategoryVotingForm({ week, currentUserId }: RoundFormProps) {
  // Fetch active categories (Comedy, Other, Legacy, and active Theme).
  // A week without a theme contributes no id clause at all - matching on
  // `{ id: null }` would be meaningless.
  const categories = await db.category.findMany({
    where: {
      parentId: null,
      OR: [
        { name: "Comedy" },
        { name: "Other" },
        { name: "Legacy" },
        ...(week.themeCategoryId ? [{ id: week.themeCategoryId }] : []),
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
export async function CategoryTiebreakerVotingForm({ week, currentUserId }: RoundFormProps) {
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
export async function MovieVotingForm({ week, currentUserId }: RoundFormProps) {
  if (!week.selectedCategoryId) return <p>Category not selected.</p>;

  const category = await db.category.findUnique({
    where: { id: week.selectedCategoryId },
  });

  const isLegacy = category?.name === "Legacy";

  // Movies in this category (exclude watched, unless it is Legacy)
  const rawMovies = await db.movie.findMany({
    where: {
      categoryId: week.selectedCategoryId,
      OR: isLegacy ? undefined : [{ watched: false }],
    },
    include: { genres: true },
  });
  const movies = sortMoviesByTitle(rawMovies);

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

// 3. Round 2b/2c: Subcategory Movie Voting & Tiebreaker
export async function SubcategoryVotingForm({ week, currentUserId }: RoundFormProps) {
  if (!week.selectedSubcategoryId) return <p>Subcategory not selected.</p>;

  const subcategory = await db.category.findUnique({
    where: { id: week.selectedSubcategoryId },
  });

  const isRound2c = week.status === "SUBCATEGORY_TIEBREAKER_VOTING";

  let movies: MovieWithGenres[] = [];
  let subcategories: Category[] = [];
  let isTie = false;
  let maxVotes = 3;
  let roundCode = "ROUND_2_SUB_MOVIE";

  if (isRound2c) {
    roundCode = "ROUND_2C_SUB_MOVIE";
    maxVotes = 1;
    isTie = true;

    // Get top tied items from Round 2b (ROUND_2_SUB_MOVIE)
    const { tiedIds: r2bTiedIds } = tallyVotes(
      await loadApprovedRoundVotes(week.id, "ROUND_2_SUB_MOVIE")
    );

    if (subcategory && r2bTiedIds.includes(subcategory.id)) {
      subcategories = [subcategory];
    }
    const tiedMovieIds = r2bTiedIds.filter((id) => id !== week.selectedSubcategoryId);
    const rawTiedMovies = await db.movie.findMany({
      where: { id: { in: tiedMovieIds } },
      include: { genres: true },
    });
    movies = sortMoviesByTitle(rawTiedMovies);
  } else {
    // Round 2b
    const { tiedIds: r2TiedIds } = tallyVotes(
      await loadApprovedRoundVotes(week.id, "ROUND_2_MOVIE")
    );
    isTie = r2TiedIds.length > 1;

    if (isTie) {
      if (subcategory) {
        subcategories = [subcategory];
      }
      const tiedMovieIds = r2TiedIds.filter((id) => id !== week.selectedSubcategoryId);
      const rawTiedMovies = await db.movie.findMany({
        where: { id: { in: tiedMovieIds } },
        include: { genres: true },
      });
      movies = sortMoviesByTitle(rawTiedMovies);
    } else {
      const rawSubMovies = await db.movie.findMany({
        where: { categoryId: week.selectedSubcategoryId, watched: false },
        include: { genres: true },
      });
      movies = sortMoviesByTitle(rawSubMovies);
    }
  }

  // User's current votes in this sub-round
  const userVotes = await db.weekVote.findMany({
    where: { weekId: week.id, userId: currentUserId, round: roundCode },
  });
  const userVoteIds = userVotes.map((v) => v.targetId);

  return (
    <div>
      {isRound2c ? (
        <>
          <h3 className="text-3xl font-bold mb-sm">
            Round 2c: Subcategory Tiebreaker (1 Vote)
          </h3>
          <p className="text-secondary mb-xl text-md">
            Round 2b ended in a tie! Cast 1 vote for your top choice among the tied options.
          </p>
        </>
      ) : isTie ? (
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
          isTie={isTie}
          maxVotes={maxVotes}
          roundCode={roundCode}
        />
      )}
    </div>
  );
}

// 4. Round 3: Shortlist Voting
export async function ShortlistVotingForm({ week, currentUserId }: RoundFormProps) {
  // Dynamically compile shortlist movies based on ties in R2 / R2b
  const movies = await getShortlistMovies(week.id, week.selectedSubcategoryId);

  // User's current votes in this round
  const userVotes = await db.weekVote.findMany({
    where: { weekId: week.id, userId: currentUserId, round: "ROUND_3_SHORTLIST" },
  });
  const userVoteIds = userVotes.map((v) => v.targetId);

  const isSubcategory = !!week.selectedSubcategoryId;
  const maxVotes = isSubcategory ? 1 : 3;

  return (
    <div>
      <h3 className="text-3xl font-bold mb-sm">
        {isSubcategory ? "Round 3: Shortlist Voting (1 Vote)" : "Round 3: Shortlist Voting"}
      </h3>
      <p className="text-secondary mb-xl text-md">
        {isSubcategory
          ? "Select 1 movie from the subcategory shortlist. Outright highest voted movie wins!"
          : "Vote on the compiled shortlist of tied movies. Outright highest voted movie wins! (Max 3 Votes)"}
      </p>

      {movies.length === 0 ? (
        <p className="text-muted italic">No movies advanced to the shortlist.</p>
      ) : (
        <ShortlistVotingFormClient
          weekId={week.id}
          movies={movies}
          initialVotes={userVoteIds}
          maxVotes={maxVotes}
        />
      )}
    </div>
  );
}

// 5. Round 4: Final Tiebreaker Voting
export async function FinalVotingForm({ week, currentUserId }: RoundFormProps) {
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
interface CompletedWeekViewProps {
  week: ActiveWeek;
  movie: MovieWithGenresAndCategory;
  currentUser: User;
}

export function CompletedWeekView({
  week,
  movie,
  currentUser,
}: CompletedWeekViewProps) {
  const isLegacyMovie = movie.category.name === "Legacy";

  return (
    <div className="text-center py-md">
      {week.isInPerson && (
        <p className="text-md text-secondary mb-xs font-semibold animate-slide-in" style={{ opacity: 0.9 }}>
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
        {movie.genres.map((g) => (
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
            Ready to finalize the week? Choose an action below. This will mark the movie as watched and archive the week&apos;s history.
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

// 7-10. In Person rounds
//
// The four in-person rounds differ only in their copy and where the candidate
// movies come from; the limits live in IN_PERSON_ROUNDS so the form and the
// server action that enforces them cannot drift apart.
interface InPersonRoundView {
  heading: string;
  blurb: string;
  emptyMessage: string;
  loadMovies: (weekId: string) => Promise<MovieWithGenres[]>;
}

const IN_PERSON_ROUND_VIEWS: Record<InPersonStatus, InPersonRoundView> = {
  IN_PERSON_VOTING: {
    heading: "In Person Movie Night: Round 1",
    blurb:
      "Vote for up to 3 physical media movies to watch in person. (Max 3 Votes)",
    emptyMessage:
      "No physical media movies found. Go to the Catalog tab to add or mark movies with physical media formats!",
    loadMovies: async () =>
      sortMoviesByTitle(
        await db.movie.findMany({
          where: {
            watched: false,
            OR: [
              { physical4K: true },
              { physicalBluRay: true },
              { physicalDvd: true },
            ],
          },
          include: { genres: true },
        })
      ),
  },
  IN_PERSON_TIEBREAKER: {
    heading: "In Person Movie Night: Round 1b Tiebreaker",
    blurb:
      "Round 1 ended in a tie! Select up to 4 movies for the in-person tiebreaker. (Max 4 Votes)",
    emptyMessage: "No movies advanced to the tiebreaker.",
    loadMovies: (weekId) => getInPersonTiebreakerMovies(weekId),
  },
  IN_PERSON_ROUND_2: {
    heading: "In Person Movie Night: Round 2 Tiebreaker",
    blurb:
      "Round 1b ended in a tie! Select exactly 1 movie from the tied choices. (1 Vote)",
    emptyMessage: "No movies advanced to this round.",
    loadMovies: (weekId) => getInPersonTiedMovies(weekId, "IN_PERSON_ROUND_1B"),
  },
  IN_PERSON_ROUND_3: {
    heading: "In Person Movie Night: Round 3 Tiebreaker",
    blurb:
      "Round 2 ended in a tie! Since the remaining movies equals the number of voters, this is the final tiebreaker. Select up to 2 movies. (Max 2 Votes)",
    emptyMessage: "No movies advanced to this round.",
    loadMovies: (weekId) => getInPersonTiedMovies(weekId, "IN_PERSON_ROUND_2"),
  },
};

export async function InPersonRound({ week, currentUserId }: RoundFormProps) {
  const status = week.status as InPersonStatus;
  const view = IN_PERSON_ROUND_VIEWS[status];
  const round = IN_PERSON_ROUNDS[status];
  if (!view || !round) return null;

  const movies = await view.loadMovies(week.id);

  const userVotes = await db.weekVote.findMany({
    where: { weekId: week.id, userId: currentUserId, round: round.code },
  });

  return (
    <div>
      <h3 className="text-3xl font-bold mb-sm text-accent-color">
        {view.heading}
      </h3>
      <p className="text-secondary mb-xl text-md">{view.blurb}</p>

      {movies.length === 0 ? (
        <p className="text-muted italic py-sm">{view.emptyMessage}</p>
      ) : (
        <InPersonVotingForm
          weekId={week.id}
          movies={movies}
          initialVotes={userVotes.map((v) => v.targetId)}
          maxVotes={round.maxVotes}
        />
      )}
    </div>
  );
}
