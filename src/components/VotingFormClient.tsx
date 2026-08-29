"use client";

import {
  submitCategoryVoteAction,
  submitMovieVotesAction,
  submitSubMovieVotesAction,
  submitShortlistVotesAction,
  submitFinalVoteAction,
  submitCategoryTiebreakerVotesAction,
} from "@/app/actions";
import { FolderOpen } from "lucide-react";
import Toast from "@/components/Toast";
import { PlotModal } from "@/components/PlotModal";
import MovieVoteRow from "@/components/MovieVoteRow";
import { useVoteSelection } from "@/hooks/useVoteSelection";
import type { Category, MovieWithGenres } from "@/lib/types";

// ======================================================================
// Shared pieces
// ======================================================================

interface CategoryVoteRowProps {
  category: Category;
  mode: "checkbox" | "radio";
  checked: boolean;
  disabled: boolean;
  name?: string;
  onToggle: (checked: boolean) => void;
}

/** One selectable category, used by both the Round 1 and Round 1b forms. */
function CategoryVoteRow({
  category,
  mode,
  checked,
  disabled,
  name,
  onToggle,
}: CategoryVoteRowProps) {
  return (
    <label
      className={`voting-card items-center gap-md ${checked ? "checked" : ""} ${
        disabled ? "disabled" : "enabled"
      }`}
    >
      <input
        type={mode}
        name={name}
        value={category.id}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="vote-checkbox"
      />
      <div className="flex-col">
        <span className="font-semibold text-lg text-primary-var">
          {category.name}
        </span>
        {category.isThemed && (
          <span className="text-sm text-accent-color">
            Current Theme Category
          </span>
        )}
      </div>
    </label>
  );
}

interface SubcategoryVoteRowProps {
  subcategory: Category;
  /** Matches the movie rows beside it, so one round never mixes both. */
  mode: "checkbox" | "radio";
  checked: boolean;
  disabled: boolean;
  name?: string;
  onToggle: (checked: boolean) => void;
}

/** A subcategory offered as a single option alongside individual movies. */
function SubcategoryVoteRow({
  subcategory,
  mode,
  checked,
  disabled,
  name,
  onToggle,
}: SubcategoryVoteRowProps) {
  return (
    <label
      className={`voting-card items-center gap-md ${checked ? "checked" : ""} ${
        disabled ? "disabled" : "enabled"
      }`}
    >
      <input
        type={mode}
        name={name}
        value={subcategory.id}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="vote-checkbox"
      />
      <div className="flex-col">
        <span className="font-bold text-lg"><FolderOpen size="1em" className="inline-icon" /> {subcategory.name} (Subcategory)</span>
        <span className="text-sm-alt text-secondary">
          Triggers an additional voting round for movies in this subcategory if
          selected
        </span>
      </div>
    </label>
  );
}

// ======================================================================
// 1. Category Selection Form (Round 1)
// ======================================================================
interface CategoryVotingFormClientProps {
  weekId: string;
  categories: Category[];
  initialVoteId: string | null;
}

export function CategoryVotingFormClient({
  weekId,
  categories,
  initialVoteId,
}: CategoryVotingFormClientProps) {
  const vote = useVoteSelection({
    initialVotes: initialVoteId ? [initialVoteId] : [],
    maxVotes: 1,
  });

  return (
    <form
      onSubmit={vote.handleSubmit({
        emptyMessage: "⚠️ Please select a category before casting your vote.",
        successMessage: "Category vote cast successfully!",
        action: (ids) => submitCategoryVoteAction(weekId, ids[0]),
      })}
      className="flex-col gap-md"
    >
      {categories.map((cat) => (
        <CategoryVoteRow
          key={cat.id}
          category={cat}
          mode="radio"
          name="categoryId"
          checked={vote.isChecked(cat.id)}
          disabled={vote.isPending}
          onToggle={(checked) => vote.toggle(cat.id, checked)}
        />
      ))}

      {vote.error && <div className="vote-error mt-xs">{vote.error}</div>}

      <button
        type="submit"
        disabled={vote.isPending}
        className="btn btn-primary mt-md"
      >
        {vote.isPending
          ? "Submitting Vote..."
          : initialVoteId
          ? "Update Category Vote"
          : "Cast Category Vote"}
      </button>
      <Toast message={vote.toastMsg} onClose={vote.clearToast} />
    </form>
  );
}

// ======================================================================
// 2. Movie & Subcategory Voting Form (Round 2)
// ======================================================================
interface MovieVotingFormClientProps {
  weekId: string;
  movies: MovieWithGenres[];
  subcategories: Category[];
  initialVotes: string[];
}

export function MovieVotingFormClient({
  weekId,
  movies,
  subcategories,
  initialVotes,
}: MovieVotingFormClientProps) {
  const vote = useVoteSelection({ initialVotes, maxVotes: 2 });

  return (
    <form
      onSubmit={vote.handleSubmit({
        emptyMessage:
          "⚠️ Please select at least one option before casting your votes.",
        successMessage: "Votes cast successfully!",
        action: (ids) => submitMovieVotesAction(weekId, ids),
      })}
      className="flex-col gap-md"
    >
      {subcategories.map((sub) => (
        <SubcategoryVoteRow
          key={sub.id}
          subcategory={sub}
          mode="checkbox"
          checked={vote.isChecked(sub.id)}
          disabled={vote.isDisabled(sub.id) || vote.isPending}
          onToggle={(checked) => vote.toggle(sub.id, checked)}
        />
      ))}

      {movies.map((movie) => (
        <MovieVoteRow
          key={movie.id}
          movie={movie}
          mode="checkbox"
          checked={vote.isChecked(movie.id)}
          disabled={vote.isDisabled(movie.id) || vote.isPending}
          onToggle={(checked) => vote.toggle(movie.id, checked)}
          onShowPlot={vote.setPlotMovie}
        />
      ))}

      {vote.error && <div className="vote-error mt-xs">{vote.error}</div>}

      <button
        type="submit"
        disabled={vote.isPending}
        className="btn btn-primary mt-sm"
      >
        {vote.isPending
          ? "Submitting Votes..."
          : vote.hasExistingVotes
          ? "Update Votes"
          : "Cast Votes"}
      </button>
      <Toast message={vote.toastMsg} onClose={vote.clearToast} />
      <PlotModal movie={vote.plotMovie} onClose={() => vote.setPlotMovie(null)} />
    </form>
  );
}

// ======================================================================
// 3. Subcategory Movie Voting Form (Round 2b / 2c)
// ======================================================================
interface SubcategoryVotingFormClientProps {
  weekId: string;
  movies: MovieWithGenres[];
  subcategories?: Category[];
  initialVotes: string[];
  isTie?: boolean;
  maxVotes?: number;
  roundCode?: string;
}

export function SubcategoryVotingFormClient({
  weekId,
  movies,
  subcategories = [],
  initialVotes,
  isTie = false,
  maxVotes = 3,
  roundCode = "ROUND_2_SUB_MOVIE",
}: SubcategoryVotingFormClientProps) {
  const vote = useVoteSelection({ initialVotes, maxVotes });

  const buttonLabel = vote.isPending
    ? "Submitting Votes..."
    : `${vote.hasExistingVotes ? "Update" : "Cast"} ${
        isTie ? "Tiebreaker" : "Subcategory"
      } Votes`;

  return (
    <form
      onSubmit={vote.handleSubmit({
        emptyMessage:
          "⚠️ Please select at least one option before casting your votes.",
        successMessage: isTie
          ? "Tiebreaker votes cast successfully!"
          : "Subcategory votes cast successfully!",
        action: (ids) => submitSubMovieVotesAction(weekId, ids, roundCode),
      })}
      className="flex-col gap-md"
    >
      {subcategories.map((sub) => (
        <SubcategoryVoteRow
          key={sub.id}
          subcategory={sub}
          mode={vote.isSingle ? "radio" : "checkbox"}
          name={vote.isSingle ? "subMovieId" : undefined}
          checked={vote.isChecked(sub.id)}
          disabled={vote.isDisabled(sub.id) || vote.isPending}
          onToggle={(checked) => vote.toggle(sub.id, checked)}
        />
      ))}

      {movies.map((movie) => (
        <MovieVoteRow
          key={movie.id}
          movie={movie}
          mode={vote.isSingle ? "radio" : "checkbox"}
          name={vote.isSingle ? "subMovieId" : undefined}
          checked={vote.isChecked(movie.id)}
          disabled={vote.isDisabled(movie.id) || vote.isPending}
          onToggle={(checked) => vote.toggle(movie.id, checked)}
          onShowPlot={vote.setPlotMovie}
        />
      ))}

      {vote.error && <div className="vote-error mt-xs">{vote.error}</div>}

      <button
        type="submit"
        disabled={vote.isPending}
        className="btn btn-primary mt-sm"
      >
        {buttonLabel}
      </button>
      <Toast message={vote.toastMsg} onClose={vote.clearToast} />
      <PlotModal movie={vote.plotMovie} onClose={() => vote.setPlotMovie(null)} />
    </form>
  );
}

// ======================================================================
// 4. Shortlist Movie Voting Form (Round 3)
// ======================================================================
interface ShortlistVotingFormClientProps {
  weekId: string;
  movies: MovieWithGenres[];
  initialVotes: string[];
  maxVotes?: number;
}

export function ShortlistVotingFormClient({
  weekId,
  movies,
  initialVotes,
  maxVotes = 3,
}: ShortlistVotingFormClientProps) {
  const vote = useVoteSelection({ initialVotes, maxVotes });

  return (
    <form
      onSubmit={vote.handleSubmit({
        emptyMessage:
          "⚠️ Please select at least one movie before casting your votes.",
        successMessage: "Shortlist votes cast successfully!",
        action: (ids) => submitShortlistVotesAction(weekId, ids),
      })}
      className="flex-col gap-md"
    >
      {movies.map((movie) => (
        <MovieVoteRow
          key={movie.id}
          movie={movie}
          mode={vote.isSingle ? "radio" : "checkbox"}
          name={vote.isSingle ? "shortlistMovieId" : undefined}
          checked={vote.isChecked(movie.id)}
          disabled={vote.isDisabled(movie.id) || vote.isPending}
          onToggle={(checked) => vote.toggle(movie.id, checked)}
          onShowPlot={vote.setPlotMovie}
        />
      ))}

      {vote.error && <div className="vote-error mt-xs">{vote.error}</div>}

      <button
        type="submit"
        disabled={vote.isPending}
        className="btn btn-primary mt-sm"
      >
        {vote.isPending
          ? "Submitting Votes..."
          : vote.hasExistingVotes
          ? "Update Shortlist Votes"
          : "Cast Shortlist Votes"}
      </button>
      <Toast message={vote.toastMsg} onClose={vote.clearToast} />
      <PlotModal movie={vote.plotMovie} onClose={() => vote.setPlotMovie(null)} />
    </form>
  );
}

// ======================================================================
// 5. Final Tiebreaker Selection Form (Round 4)
// ======================================================================
interface FinalVotingFormClientProps {
  weekId: string;
  movies: MovieWithGenres[];
  initialVoteId: string | null;
}

export function FinalVotingFormClient({
  weekId,
  movies,
  initialVoteId,
}: FinalVotingFormClientProps) {
  const vote = useVoteSelection({
    initialVotes: initialVoteId ? [initialVoteId] : [],
    maxVotes: 1,
  });

  return (
    <form
      onSubmit={vote.handleSubmit({
        emptyMessage: "⚠️ Please select a movie before casting your vote.",
        successMessage: "Final tiebreaker vote cast successfully!",
        action: (ids) => submitFinalVoteAction(weekId, ids[0]),
      })}
      className="flex-col gap-md"
    >
      {movies.map((movie) => (
        <MovieVoteRow
          key={movie.id}
          movie={movie}
          mode="radio"
          name="movieId"
          checked={vote.isChecked(movie.id)}
          disabled={vote.isPending}
          onToggle={(checked) => vote.toggle(movie.id, checked)}
          onShowPlot={vote.setPlotMovie}
        />
      ))}

      {vote.error && <div className="vote-error mt-xs">{vote.error}</div>}

      <button
        type="submit"
        disabled={vote.isPending}
        className="btn btn-primary mt-md"
      >
        {vote.isPending
          ? "Submitting Vote..."
          : initialVoteId
          ? "Update Final Vote"
          : "Cast Final Vote"}
      </button>
      <Toast message={vote.toastMsg} onClose={vote.clearToast} />
      <PlotModal movie={vote.plotMovie} onClose={() => vote.setPlotMovie(null)} />
    </form>
  );
}

// ======================================================================
// 6. Category Tiebreaker Selection Form (Round 1b)
// ======================================================================
interface CategoryTiebreakerVotingFormClientProps {
  weekId: string;
  categories: Category[];
  initialVotes: string[];
}

export function CategoryTiebreakerVotingFormClient({
  weekId,
  categories,
  initialVotes,
}: CategoryTiebreakerVotingFormClientProps) {
  const vote = useVoteSelection({ initialVotes, maxVotes: 2 });

  return (
    <form
      onSubmit={vote.handleSubmit({
        emptyMessage:
          "⚠️ Please select at least one option before casting your votes.",
        successMessage: "Tiebreaker votes cast successfully!",
        action: (ids) => submitCategoryTiebreakerVotesAction(weekId, ids),
      })}
      className="flex-col gap-md"
    >
      {categories.map((cat) => (
        <CategoryVoteRow
          key={cat.id}
          category={cat}
          mode="checkbox"
          checked={vote.isChecked(cat.id)}
          disabled={vote.isDisabled(cat.id) || vote.isPending}
          onToggle={(checked) => vote.toggle(cat.id, checked)}
        />
      ))}

      {vote.error && <div className="vote-error mt-xs">{vote.error}</div>}

      <button
        type="submit"
        disabled={vote.isPending}
        className="btn btn-primary mt-sm"
      >
        {vote.isPending
          ? "Submitting Votes..."
          : vote.hasExistingVotes
          ? "Update Tiebreaker Votes"
          : "Cast Tiebreaker Votes"}
      </button>
      <Toast message={vote.toastMsg} onClose={vote.clearToast} />
    </form>
  );
}
