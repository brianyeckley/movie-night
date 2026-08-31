import { getActiveUser } from "@/app/actions/user";
import { getLeaderboardStats } from "@/lib/stats";
import LeaderboardView from "@/components/LeaderboardView";
import Link from "next/link";
import { Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const currentUser = await getActiveUser();

  if (!currentUser) {
    return (
      <div className="container py-2xl text-center">
        <div className="glass-panel no-hover max-w-md mx-auto p-2xl">
          <Lock size={48} className="text-accent mx-auto mb-lg" />
          <h1 className="text-4xl font-extrabold mb-sm">Members Only</h1>
          <p className="text-secondary mb-xl">
            Please log in to view the movie night leaderboards and hall of fame records.
          </p>
          <Link href="/login" className="btn btn-primary w-full">
            Log In
          </Link>
        </div>
      </div>
    );
  }

  const data = await getLeaderboardStats();

  return (
    <div className="py-xl">
      <main className="container">
        <LeaderboardView data={data} />
      </main>
    </div>
  );
}
