"use client";

import { useState } from "react";
import {
  Trophy,
  Crown,
  Medal,
  Glasses,
  Users,
  Target,
  Clock,
  Star,
  Disc,
  Popcorn,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Flame,
  Award,
  HeartCrack,
  Film,
  Info,
} from "lucide-react";
import type { LeaderboardData } from "@/lib/stats";
import { PlotModal, type MoviePlotModalData } from "@/components/PlotModal";

interface LeaderboardViewProps {
  data: LeaderboardData;
}

export default function LeaderboardView({ data }: LeaderboardViewProps) {
  const [expandedUserIds, setExpandedUserIds] = useState<Record<string, boolean>>({});
  const [showFilmSnobMovies, setShowFilmSnobMovies] = useState(false);
  const [expandedNonWinnerMovieIds, setExpandedNonWinnerMovieIds] = useState<Record<string, boolean>>({});
  const [showAllNonWinners, setShowAllNonWinners] = useState(false);
  const [selectedPlotMovie, setSelectedPlotMovie] = useState<MoviePlotModalData | null>(null);

  const toggleExpandUser = (userId: string) => {
    setExpandedUserIds((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const toggleExpandNonWinner = (movieId: string) => {
    setExpandedNonWinnerMovieIds((prev) => ({
      ...prev,
      [movieId]: !prev[movieId],
    }));
  };

  const {
    tastemakers,
    kingmaker,
    filmSnob,
    dynamicDuo,
    globalStats,
    mostNominatedNonWinners = [],
  } = data;

  const top3 = tastemakers.slice(0, 3);

  return (
    <div className="leaderboard-container flex-col gap-3xl">
      {/* 1. Header Banner */}
      <div className="glass-panel no-hover p-2xl text-center relative overflow-hidden">
        <div className="leaderboard-header-glow" />
        <div className="flex-center mb-sm gap-sm">
          <Trophy className="text-warning inline-icon" size={32} />
          <h1 className="text-6xl font-extrabold tracking-tighter">
            Movie Night <span className="text-gradient">Leaderboards</span>
          </h1>
        </div>
        <p className="text-secondary text-xl max-w-2xl mx-auto mb-2xl">
          Celebrating the tastemakers, the consensus deciders, and the unapologetic film snobs.
        </p>

        {/* Global Overview Stat Bar */}
        <div className="leaderboard-stat-strip">
          <div className="stat-pill">
            <Popcorn className="text-primary inline-icon" size={20} />
            <div className="stat-pill-content">
              <span className="stat-pill-value">{globalStats.totalWeeks}</span>
              <span className="stat-pill-label">Movies Watched</span>
            </div>
          </div>

          <div className="stat-pill">
            <Clock className="text-accent inline-icon" size={20} />
            <div className="stat-pill-content">
              <span className="stat-pill-value">{globalStats.formattedWatchTime}</span>
              <span className="stat-pill-label">Total Watch Time</span>
            </div>
          </div>

          {globalStats.averageRating !== null && (
            <div className="stat-pill">
              <Star className="text-warning inline-icon" size={20} />
              <div className="stat-pill-content">
                <span className="stat-pill-value">{globalStats.averageRating} ★</span>
                <span className="stat-pill-label">Avg Winner IMDb</span>
              </div>
            </div>
          )}

          {globalStats.topGenre && (
            <div className="stat-pill">
              <Flame className="text-accent inline-icon" size={20} />
              <div className="stat-pill-content">
                <span className="stat-pill-value">{globalStats.topGenre.name}</span>
                <span className="stat-pill-label">Top Genre ({globalStats.topGenre.count} wins)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Spotlight Superlative Awards */}
      <div className="flex-col gap-md">
        <div className="flex-between items-center">
          <h2 className="text-3xl font-bold flex-row items-center gap-sm">
            <Award className="text-primary inline-icon" size={24} />
            Hall of Fame Superlatives
          </h2>
          <span className="text-secondary text-sm">Group accolades</span>
        </div>

        <div className="leaderboard-awards-grid">
          {/* Award 1: The Tastemaker / #1 Picker */}
          <div className="award-card award-gold">
            <div className="award-icon-box">
              <Crown size={28} className="text-warning" />
            </div>
            <div className="award-badge">#1 Tastemaker</div>
            <h3 className="award-title">
              {tastemakers.length > 0 && tastemakers[0].totalWins > 0
                ? tastemakers[0].user.name
                : "TBD"}
            </h3>
            <p className="award-stat">
              {tastemakers.length > 0 && tastemakers[0].totalWins > 0
                ? `${tastemakers[0].totalWins} Winning Nominations (${tastemakers[0].winRate}% hit rate)`
                : "No winning movie picks yet"}
            </p>
            <p className="award-desc">
              Has championed the highest number of victorious films in early selection rounds.
            </p>
          </div>

          {/* Award 2: The Kingmaker */}
          <div className="award-card award-indigo">
            <div className="award-icon-box">
              <Target size={28} className="text-primary" />
            </div>
            <div className="award-badge">The Kingmaker</div>
            <h3 className="award-title">
              {kingmaker ? kingmaker.user.name : "TBD"}
            </h3>
            <p className="award-stat">
              {kingmaker
                ? `${kingmaker.correctFinalVotes} Correct Final Votes (${kingmaker.accuracy}% accuracy)`
                : "No final votes recorded yet"}
            </p>
            <p className="award-desc">
              Always has their finger on the group&apos;s pulse when the final vote is cast.
            </p>
          </div>

          {/* Award 3: Film Snob (as requested!) */}
          <div className="award-card award-rose">
            <div className="award-icon-box">
              <Glasses size={28} className="text-accent" />
            </div>
            <div className="award-badge">Film Snob</div>
            <h3 className="award-title">
              {filmSnob ? filmSnob.user.name : "TBD"}
            </h3>
            <p className="award-stat">
              {filmSnob
                ? `${filmSnob.soloPickCount} Solo Nominations`
                : "No solo picks recorded"}
            </p>
            <p className="award-desc">
              Discerning cinematic tastes that mere mortals just don&apos;t understand.
            </p>
            {filmSnob && filmSnob.soloMovies.length > 0 && (
              <button
                type="button"
                className="film-snob-toggle-btn"
                onClick={() => setShowFilmSnobMovies((prev) => !prev)}
              >
                {showFilmSnobMovies ? (
                  <>
                    Hide solo picks <ChevronUp size={14} />
                  </>
                ) : (
                  <>
                    View solo picks <ChevronDown size={14} />
                  </>
                )}
              </button>
            )}
            {showFilmSnobMovies && filmSnob && filmSnob.soloMovies.length > 0 && (
              <div className="film-snob-movies-list">
                {filmSnob.soloMovies.map((m, idx) => (
                  <span key={idx} className="film-snob-chip">
                    {m.title} {m.year ? `(${m.year})` : ""} · Wk {m.weekNumber}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Award 4: Dynamic Duo */}
          <div className="award-card award-emerald">
            <div className="award-icon-box">
              <Users size={28} className="text-success" />
            </div>
            <div className="award-badge">Dynamic Duo</div>
            <h3 className="award-title">
              {dynamicDuo
                ? `${dynamicDuo.userA.name} & ${dynamicDuo.userB.name}`
                : "TBD"}
            </h3>
            <p className="award-stat">
              {dynamicDuo
                ? `${dynamicDuo.agreementScore}% Voting Harmony`
                : "Need more shared weeks"}
            </p>
            <p className="award-desc">
              Basically sharing a brain whenever movie votes are cast.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Primary Leaderboard: The Tastemakers */}
      <div className="flex-col gap-lg">
        <div className="flex-between items-center flex-wrap gap-sm">
          <div>
            <h2 className="text-3xl font-bold flex-row items-center gap-sm">
              <Trophy className="text-warning inline-icon" size={24} />
              The Tastemakers Leaderboard
            </h2>
            <p className="text-secondary text-base">
              Ranked by who nominated and voted for winning movies in early selection rounds.
            </p>
          </div>
        </div>

        {/* Podium View for Top 3 */}
        {top3.length > 0 && (
          <div className="podium-grid">
            {/* Rank 2 - Silver */}
            {top3[1] && (
              <div className="podium-card podium-silver">
                <div className="podium-rank-badge">🥈 #2</div>
                <h4 className="podium-name">{top3[1].user.name}</h4>
                <div className="podium-score">
                  <strong>{top3[1].totalWins}</strong> wins
                </div>
                <div className="podium-rate">
                  {top3[1].winRate}% hit rate ({top3[1].weeksParticipated} wks)
                </div>
                {top3[1].winningMovies.length > 0 && (
                  <button
                    type="button"
                    className="podium-view-btn"
                    onClick={() => toggleExpandUser(top3[1].user.id)}
                  >
                    {expandedUserIds[top3[1].user.id] ? "Hide Movies" : `Show ${top3[1].totalWins} Movies`}
                  </button>
                )}
              </div>
            )}

            {/* Rank 1 - Gold */}
            {top3[0] && (
              <div className="podium-card podium-gold">
                <div className="podium-crown-icon">
                  <Crown size={32} className="text-warning" />
                </div>
                <div className="podium-rank-badge">🥇 #1</div>
                <h4 className="podium-name">{top3[0].user.name}</h4>
                <div className="podium-score">
                  <strong>{top3[0].totalWins}</strong> wins
                </div>
                <div className="podium-rate">
                  {top3[0].winRate}% hit rate ({top3[0].weeksParticipated} wks)
                </div>
                {top3[0].winningMovies.length > 0 && (
                  <button
                    type="button"
                    className="podium-view-btn"
                    onClick={() => toggleExpandUser(top3[0].user.id)}
                  >
                    {expandedUserIds[top3[0].user.id] ? "Hide Movies" : `Show ${top3[0].totalWins} Movies`}
                  </button>
                )}
              </div>
            )}

            {/* Rank 3 - Bronze */}
            {top3[2] && (
              <div className="podium-card podium-bronze">
                <div className="podium-rank-badge">🥉 #3</div>
                <h4 className="podium-name">{top3[2].user.name}</h4>
                <div className="podium-score">
                  <strong>{top3[2].totalWins}</strong> wins
                </div>
                <div className="podium-rate">
                  {top3[2].winRate}% hit rate ({top3[2].weeksParticipated} wks)
                </div>
                {top3[2].winningMovies.length > 0 && (
                  <button
                    type="button"
                    className="podium-view-btn"
                    onClick={() => toggleExpandUser(top3[2].user.id)}
                  >
                    {expandedUserIds[top3[2].user.id] ? "Hide Movies" : `Show ${top3[2].totalWins} Movies`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Detailed Full Standings Table */}
        <div className="glass-panel no-hover overflow-hidden">
          <div className="p-lg border-b border-glass flex-between items-center">
            <h3 className="text-xl font-bold flex-row items-center gap-sm">
              <Medal size={18} className="text-secondary" />
              Full Standings
            </h3>
            <span className="text-secondary text-sm">
              {tastemakers.length} active voters
            </span>
          </div>

          <div className="tastemakers-list">
            {tastemakers.map((entry, index) => {
              const isExpanded = expandedUserIds[entry.user.id];
              const rank = index + 1;

              return (
                <div key={entry.user.id} className="tastemaker-row">
                  <div className="tastemaker-main flex-between items-center flex-wrap gap-md">
                    {/* Rank & User */}
                    <div className="flex-row items-center gap-lg">
                      <span className={`rank-indicator rank-${rank <= 3 ? rank : "other"}`}>
                        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                      </span>
                      <div>
                        <div className="flex-row items-center gap-xs">
                          <span className="text-xl font-bold">{entry.user.name}</span>
                          {entry.user.role === "ADMIN" ? (
                            <Crown size="1em" className="inline-icon text-warning" />
                          ) : (
                            <Popcorn size="1em" className="inline-icon text-secondary" />
                          )}
                        </div>
                        <span className="text-secondary text-xs">
                          @{entry.user.username} · {entry.weeksParticipated} active weeks
                        </span>
                      </div>
                    </div>

                    {/* Stats & Expand Button */}
                    <div className="flex-row items-center gap-xl">
                      <div className="text-right">
                        <div className="text-2xl font-extrabold text-primary-var">
                          {entry.totalWins} <span className="text-sm font-normal text-secondary">wins</span>
                        </div>
                        <div className="text-xs text-secondary">
                          {entry.winRate}% hit rate
                        </div>
                      </div>

                      {entry.winningMovies.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-secondary text-xs py-xs px-sm"
                          onClick={() => toggleExpandUser(entry.user.id)}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <>
                              Hide Picks <ChevronUp size={14} />
                            </>
                          ) : (
                            <>
                              View {entry.winningMovies.length} {entry.winningMovies.length === 1 ? "Winner" : "Winners"} <ChevronDown size={14} />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Winning Movies Drawer */}
                  {isExpanded && entry.winningMovies.length > 0 && (
                    <div className="winning-movies-drawer">
                      <div className="winning-movies-grid">
                        {entry.winningMovies.map(({ weekNumber, movie }) => (
                          <div key={movie.id} className="winning-movie-card">
                            <div className="winning-movie-header">
                              <span className="week-badge">Week #{weekNumber}</span>
                              {movie.imdbRating && (
                                <span className="imdb-chip">★ {movie.imdbRating}</span>
                              )}
                            </div>
                            <h5 className="winning-movie-title">{movie.title}</h5>
                            <div className="winning-movie-meta">
                              {movie.year && <span>{movie.year}</span>}
                              {movie.category && <span>{movie.category.name}</span>}
                              {movie.runtime && <span>{movie.runtime}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Most Nominated Non-Winning Movies Chart */}
      <div className="flex-col gap-lg">
        <div className="flex-between items-center flex-wrap gap-sm">
          <div>
            <h2 className="text-3xl font-bold flex-row items-center gap-sm">
              <HeartCrack className="text-accent inline-icon" size={24} />
              Most Nominated Non-Winners
            </h2>
            <p className="text-secondary text-base">
              The uncrowned contenders with the most nominations in selection rounds that have never won.
            </p>
          </div>
          {mostNominatedNonWinners.length > 0 && (
            <span className="text-secondary text-sm">
              {mostNominatedNonWinners.length} contender{mostNominatedNonWinners.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {mostNominatedNonWinners.length === 0 ? (
          <div className="glass-panel no-hover p-xl text-center text-secondary">
            No non-winning nominated movies recorded yet.
          </div>
        ) : (
          <div className="glass-panel no-hover overflow-hidden">
            <div className="p-lg border-b border-glass flex-between items-center">
              <h3 className="text-xl font-bold flex-row items-center gap-sm">
                <Film size={18} className="text-secondary" />
                Uncrowned Contenders Standings
              </h3>
              <span className="text-secondary text-sm">
                Ranked by nominations
              </span>
            </div>

            <div className="non-winners-list">
              {(showAllNonWinners
                ? mostNominatedNonWinners
                : mostNominatedNonWinners.slice(0, 10)
              ).map((entry, index) => {
                const rank = index + 1;
                const maxNominations = Math.max(
                  ...mostNominatedNonWinners.map((m) => m.nominationCount),
                  1
                );
                const barWidth = Math.max(
                  16,
                  Math.round((entry.nominationCount / maxNominations) * 100)
                );
                const isExpanded = expandedNonWinnerMovieIds[entry.movie.id];

                return (
                  <div key={entry.movie.id} className="non-winner-row">
                    <div className="non-winner-main">
                      {/* Left: Rank, Poster & Movie Info */}
                      <div className="non-winner-movie-col">
                        <span className={`rank-indicator rank-${rank <= 3 ? rank : "other"}`}>
                          {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                        </span>

                        <div className="non-winner-poster-wrapper">
                          {entry.movie.posterUrl ? (
                            <img
                              src={entry.movie.posterUrl}
                              alt={`${entry.movie.title} poster`}
                              className="non-winner-poster"
                              loading="lazy"
                            />
                          ) : (
                            <div className="non-winner-poster-placeholder">
                              <Film size={18} className="text-muted" />
                            </div>
                          )}
                        </div>

                        <div className="non-winner-details">
                          <div className="flex-row items-center gap-xs flex-wrap">
                            <span className="font-bold text-base non-winner-title">
                              {entry.movie.title}
                            </span>
                            {entry.movie.year && (
                              <span className="text-secondary text-xs">
                                ({entry.movie.year})
                              </span>
                            )}
                            {entry.movie.imdbRating && (
                              <span className="imdb-chip text-xs">
                                ★ {entry.movie.imdbRating}
                              </span>
                            )}
                          </div>

                          <div className="non-winner-meta">
                            {entry.movie.category && (
                              <span className="non-winner-category-tag">
                                {entry.movie.category.name}
                              </span>
                            )}
                            {entry.movie.genres.slice(0, 2).map((g) => (
                              <span key={g.id} className="non-winner-genre-tag">
                                {g.name}
                              </span>
                            ))}
                            {entry.movie.runtime && (
                              <span className="text-xs text-muted">
                                {entry.movie.runtime}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Chart Bar & Actions */}
                      <div className="non-winner-chart-col">
                        <div className="non-winner-bar-track">
                          <div
                            className={`non-winner-bar-fill non-winner-bar-rank-${rank <= 3 ? rank : "other"}`}
                            style={{ width: `${barWidth}%` }}
                          >
                            <span className="non-winner-bar-label">
                              {entry.nominationCount} {entry.nominationCount === 1 ? "nomination" : "nominations"}
                            </span>
                          </div>
                        </div>

                        <div className="non-winner-actions">
                          <span className="non-winner-weeks-badge">
                            {entry.weeksNominatedCount} {entry.weeksNominatedCount === 1 ? "wk" : "wks"}
                          </span>

                          <button
                            type="button"
                            className="btn btn-secondary text-xs py-xs px-sm"
                            onClick={() => toggleExpandNonWinner(entry.movie.id)}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? (
                              <>
                                Hide <ChevronUp size={14} />
                              </>
                            ) : (
                              <>
                                Details <ChevronDown size={14} />
                              </>
                            )}
                          </button>

                          {entry.movie.plot && (
                            <button
                              type="button"
                              className="btn btn-ghost text-xs p-xs"
                              onClick={() => setSelectedPlotMovie(entry.movie)}
                              title="View plot synopsis"
                              aria-label={`View plot for ${entry.movie.title}`}
                            >
                              <Info size={16} className="text-secondary" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Breakdown Drawer */}
                    {isExpanded && (
                      <div className="non-winner-drawer">
                        <div className="non-winner-drawer-header">
                          <span className="text-xs font-semibold text-secondary uppercase tracking-wider">
                            Nominated by users {entry.nominationCount} {entry.nominationCount === 1 ? "time" : "times"} across {entry.weeks.length} {entry.weeks.length === 1 ? "week" : "weeks"} · {entry.totalVotesCount} total votes across all rounds
                          </span>
                        </div>
                        <div className="non-winner-weeks-grid">
                          {entry.weeks.map((w) => (
                            <div key={w.weekNumber} className="non-winner-week-card">
                              <span className="week-badge">Week #{w.weekNumber}</span>
                              <div className="text-xs text-secondary mt-xs">
                                Nominators:{" "}
                                <span className="text-primary-var font-semibold">
                                  {w.nominators.join(", ")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {mostNominatedNonWinners.length > 10 && (
              <div className="p-md text-center border-t border-glass">
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={() => setShowAllNonWinners((prev) => !prev)}
                >
                  {showAllNonWinners
                    ? "Show Top 10 Contenders"
                    : `Show All ${mostNominatedNonWinners.length} Contenders`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. The Movie Vault / Trivia Records */}
      <div className="flex-col gap-lg">
        <h2 className="text-3xl font-bold flex-row items-center gap-sm">
          <Clapperboard className="text-accent inline-icon" size={24} />
          The Movie Vault Records
        </h2>

        <div className="vault-records-grid">
          {/* Record 1: Longest Winner */}
          <div className="vault-card">
            <div className="vault-icon"><Clock size={24} className="text-primary" /></div>
            <span className="vault-label">Marathon Champion (Longest)</span>
            <h4 className="vault-value">
              {globalStats.longestMovie ? globalStats.longestMovie.title : "—"}
            </h4>
            <span className="vault-sub">
              {globalStats.longestMovie ? globalStats.longestMovie.runtime : "N/A"}
            </span>
          </div>

          {/* Record 2: Shortest Winner */}
          <div className="vault-card">
            <div className="vault-icon"><Clock size={24} className="text-accent" /></div>
            <span className="vault-label">Bite-Sized Winner (Shortest)</span>
            <h4 className="vault-value">
              {globalStats.shortestMovie ? globalStats.shortestMovie.title : "—"}
            </h4>
            <span className="vault-sub">
              {globalStats.shortestMovie ? globalStats.shortestMovie.runtime : "N/A"}
            </span>
          </div>

          {/* Record 3: Highest Rated */}
          <div className="vault-card">
            <div className="vault-icon"><Star size={24} className="text-warning" /></div>
            <span className="vault-label">Critically Acclaimed (Top IMDb)</span>
            <h4 className="vault-value">
              {globalStats.highestRatedMovie ? globalStats.highestRatedMovie.title : "—"}
            </h4>
            <span className="vault-sub">
              {globalStats.highestRatedMovie ? `${globalStats.highestRatedMovie.rating} / 10 IMDb` : "N/A"}
            </span>
          </div>

          {/* Record 4: Physical Media Breakdown */}
          <div className="vault-card">
            <div className="vault-icon"><Disc size={24} className="text-success" /></div>
            <span className="vault-label">Physical Media Trophy Case</span>
            <div className="vault-media-breakdown">
              <span className="media-chip">4K UHD: {globalStats.physicalMedia.fourK}</span>
              <span className="media-chip">Blu-ray: {globalStats.physicalMedia.bluRay}</span>
              <span className="media-chip">DVD: {globalStats.physicalMedia.dvd}</span>
              <span className="media-chip">Digital: {globalStats.physicalMedia.digitalOnly}</span>
            </div>
          </div>
        </div>
      </div>

      <PlotModal
        movie={selectedPlotMovie}
        onClose={() => setSelectedPlotMovie(null)}
      />
    </div>
  );
}
