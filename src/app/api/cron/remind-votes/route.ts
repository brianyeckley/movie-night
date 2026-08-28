import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyReminder } from "@/lib/discord";
import { approvedVotesForRound, roundCodeForStatus } from "@/lib/rounds";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Simple token protection to prevent spamming
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;

  // Fail closed: with no configured secret there is no way to authorise a
  // caller, so refuse rather than leaving the endpoint open to anyone.
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Find the active week
    const activeWeek = await db.movieNightWeek.findFirst({
      where: { closedAt: null },
      include: { votes: { include: { user: true } } },
    });

    if (!activeWeek || activeWeek.status === "COMPLETED") {
      return NextResponse.json({ message: "No active voting round in progress." });
    }

    // 2. Identify the active round code
    const activeRoundCode = roundCodeForStatus(activeWeek.status);

    if (!activeRoundCode) {
      return NextResponse.json({ message: "Invalid active round state." });
    }

    // 3. Find all approved users
    const allApprovedUsers = await db.user.findMany({
      where: { isApproved: true },
    });

    // 4. Determine who has voted in the current active round
    const roundVotedUserIds = approvedVotesForRound(
      activeWeek.votes,
      activeRoundCode
    ).map((v) => v.userId);

    // 5. Find pending voters
    const pendingVoters = allApprovedUsers.filter(
      (u) => !roundVotedUserIds.includes(u.id)
    );

    if (pendingVoters.length === 0) {
      return NextResponse.json({ message: "All approved users have already voted." });
    }

    // 6. Send the Discord notification
    const pendingNames = pendingVoters.map((u) => u.name);
    await notifyReminder(activeWeek.id, pendingNames);

    return NextResponse.json({
      success: true,
      message: `Reminder sent for pending voters: ${pendingNames.join(", ")}`,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
