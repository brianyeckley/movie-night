"use client";

import { submitInPersonVotesAction } from "@/app/actions/inPersonVoting";
import Toast from "@/components/Toast";
import { PlotModal } from "@/components/PlotModal";
import MovieVoteRow from "@/components/MovieVoteRow";
import { useVoteSelection } from "@/hooks/useVoteSelection";
import type { MovieWithGenres } from "@/lib/types";

interface InPersonVotingFormProps {
  weekId: string;
  movies: MovieWithGenres[];
  initialVotes: string[];
  maxVotes: number;
}

export default function InPersonVotingForm({
  weekId,
  movies,
  initialVotes,
  maxVotes,
}: InPersonVotingFormProps) {
  const vote = useVoteSelection({ initialVotes, maxVotes });

  const required = Math.min(maxVotes, movies.length);
  const remaining = Math.max(0, required - vote.selectedIds.length);
  const baseLabel = vote.isSingle ? "Cast Tiebreaker Vote" : "Cast In Person Votes";

  return (
    <form
      onSubmit={vote.handleSubmit({
        emptyMessage: vote.isSingle
          ? "⚠️ Please select a movie before casting your tiebreaker vote."
          : "⚠️ Please select at least one movie before casting your votes.",
        successMessage: vote.isSingle
          ? "Tiebreaker vote cast successfully!"
          : "Votes cast successfully!",
        action: (ids) => submitInPersonVotesAction(weekId, ids),
      })}
      className="flex-col gap-md"
    >
      {movies.map((movie) => (
        <MovieVoteRow
          key={movie.id}
          movie={movie}
          mode={vote.isSingle ? "radio" : "checkbox"}
          name={vote.isSingle ? "inPersonMovieTie" : undefined}
          checked={vote.isChecked(movie.id)}
          disabled={vote.isDisabled(movie.id) || vote.isPending}
          onToggle={(checked) => vote.toggle(movie.id, checked)}
          onShowPlot={vote.setPlotMovie}
        />
      ))}

      <div className="vote-submit-bar">
        {vote.error && <div className="vote-error">{vote.error}</div>}
        <button
          type="submit"
          disabled={vote.isPending || remaining > 0}
          className="btn btn-primary"
        >
          {vote.isPending
            ? "Submitting Vote..."
            : remaining > 0
            ? `${baseLabel} (${remaining} more)`
            : baseLabel}
        </button>
      </div>
      <Toast message={vote.toastMsg} onClose={vote.clearToast} />
      <PlotModal movie={vote.plotMovie} onClose={() => vote.setPlotMovie(null)} />
    </form>
  );
}
