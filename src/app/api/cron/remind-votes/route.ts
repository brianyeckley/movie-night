import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyReminder } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Simple token protection to prevent spamming
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
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
    let activeRoundCode = "";
    if (activeWeek.status === "CATEGORY_VOTING") activeRoundCode = "ROUND_1_CATEGORY";
    else if (activeWeek.status === "CATEGORY_TIEBREAKER_VOTING") activeRoundCode = "ROUND_1_CATEGORY_TIEBREAKER";
    else if (activeWeek.status === "MOVIE_VOTING") activeRoundCode = "ROUND_2_MOVIE";
    else if (activeWeek.status === "SUBCATEGORY_VOTING") activeRoundCode = "ROUND_2_SUB_MOVIE";
    else if (activeWeek.status === "SUBCATEGORY_TIEBREAKER_VOTING") activeRoundCode = "ROUND_2C_SUB_MOVIE";
    else if (activeWeek.status === "SHORTLIST_VOTING") activeRoundCode = "ROUND_3_SHORTLIST";
    else if (activeWeek.status === "FINAL_VOTING") activeRoundCode = "ROUND_4_TIEBREAKER";

    if (!activeRoundCode) {
      return NextResponse.json({ message: "Invalid active round state." });
    }

    // 3. Find all approved users
    const allApprovedUsers = await db.user.findMany({
      where: { isApproved: true },
    });

    // 4. Determine who has voted in the current active round
    const roundVotedUserIds = activeWeek.votes
      .filter((v) => v.round === activeRoundCode && v.user.isApproved)
      .map((v) => v.userId);

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
  } catch (error: any) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
