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
          🍿 THE PHYSICAL MEDIA CHAMPION IS CROWNED! 🍿
        </span>
      ) : (
        <span className="text-base text-uppercase tracking-widest-2 text-primary-color font-bold">
          Winning Movie Chosen!
        </span>
      )}
      
      {week.isInPerson && (
        <p className="text-md text-secondary mt-xs font-semibold animate-slide-in" style={{ opacity: 0.9 }}>
          📀 Gather round, clean those lenses, and fire up the player — showtime is ready! 🏠
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
      <h3 className="text-3xl font-bold mb-sm text-accent-color">🍿 In Person Movie Night: Round 1</h3>
      <p className="text-secondary mb-xl text-md">
        Optionally ignored theme: Bypassing standard categories. 📼 <strong>Physical Media Showdown!</strong> Select up to 3 physical media gems. No streams allowed here — only pristine bitrates, crisp audio, and shelf-fresh discs. Choose wisely! (Max 3 Votes)
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
          isTiebreaker={false}
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
      <h3 className="text-3xl font-bold mb-sm text-accent-color">⚡ In Person Movie Night: Round 1b Tiebreaker</h3>
      <p className="text-secondary mb-xl text-md">
        🔥 <strong>THE TIEBREAKER CRUCIBLE!</strong> The crowd is divided! Choose your absolute favorite disc. If this round ends in a deadlock, the movie gods (random draw) will decide our fate! (1 Vote)
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
          isTiebreaker={true}
        />
      )}
    </div>
  );
}
