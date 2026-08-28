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

      {vote.error && <div className="vote-error mt-xs">{vote.error}</div>}

      <button
        type="submit"
        disabled={vote.isPending}
        className="btn btn-primary mt-sm"
      >
        {vote.isPending
          ? "Submitting Vote..."
          : vote.isSingle
          ? "Cast Tiebreaker Vote"
          : "Cast In Person Votes"}
      </button>
      <Toast message={vote.toastMsg} onClose={vote.clearToast} />
      <PlotModal movie={vote.plotMovie} onClose={() => vote.setPlotMovie(null)} />
    </form>
  );
}
