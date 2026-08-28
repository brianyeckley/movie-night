import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * A week is active until it is closed out, not until it reaches COMPLETED.
 *
 * These two are not the same: a week sits at COMPLETED with a winner picked
 * for as long as it takes the admin to press "Mark Watched & Close". The
 * dashboard and the reminder cron already treated that window as active while
 * `createWeekAction` did not, so an admin could start a second week during it
 * and leave two weeks matching `closedAt: null` — after which `findFirst`
 * picked between them arbitrarily.
 */
export const ACTIVE_WEEK: Prisma.MovieNightWeekWhereInput = { closedAt: null };

/** The week currently in progress, or null when there is none. */
export function findActiveWeek<T extends Prisma.MovieNightWeekInclude>(
  include?: T
) {
  return db.movieNightWeek.findFirst({
    where: ACTIVE_WEEK,
    ...(include ? { include } : {}),
  });
}
