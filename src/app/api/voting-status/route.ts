import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ACTIVE_WEEK } from "@/lib/weeks";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const activeWeek = await db.movieNightWeek.findFirst({
      where: ACTIVE_WEEK,
      select: {
        id: true,
        status: true,
        selectedCategoryId: true,
        selectedSubcategoryId: true,
        winningMovieId: true,
        isRandomlyChosen: true,
        _count: {
          select: { votes: true },
        },
        votes: {
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!activeWeek) {
      return NextResponse.json({
        active: false,
        signature: "no-active-week",
      });
    }

    const latestVoteAt = activeWeek.votes[0]?.createdAt.getTime() ?? 0;
    const signature = [
      activeWeek.id,
      activeWeek.status,
      activeWeek._count.votes,
      latestVoteAt,
      activeWeek.selectedCategoryId ?? "",
      activeWeek.selectedSubcategoryId ?? "",
      activeWeek.winningMovieId ?? "",
      activeWeek.isRandomlyChosen ? "1" : "0",
    ].join(":");

    return NextResponse.json({
      active: true,
      signature,
      status: activeWeek.status,
      voteCount: activeWeek._count.votes,
    });
  } catch (error) {
    console.error("Voting status poll error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
