/**
 * Shared shapes for the data the UI actually renders.
 *
 * These are derived from the Prisma schema rather than hand-written, so a
 * column rename or a changed `include` shows up as a type error in the
 * components instead of as `undefined` at runtime.
 */

import type { Prisma } from "@/generated/prisma/client";

export type Category = Prisma.CategoryModel;
export type Genre = Prisma.GenreModel;
export type User = Prisma.UserModel;

/** A movie as rendered in a voting row. */
export type MovieWithGenres = Prisma.MovieGetPayload<{
  include: { genres: true };
}>;

/** A movie plus its category, as rendered on the winner and catalog views. */
export type MovieWithGenresAndCategory = Prisma.MovieGetPayload<{
  include: { genres: true; category: true };
}>;

/**
 * A top-level category as loaded by the catalog page: its direct movies plus
 * each subcategory and the movies inside it.
 */
export type CatalogCategory = Prisma.CategoryGetPayload<{
  include: {
    subcategories: { include: { movies: { include: { genres: true } } } };
    movies: { include: { genres: true } };
  };
}>;

/** The active week as loaded by the dashboard, with its theme and every vote. */
export type ActiveWeek = Prisma.MovieNightWeekGetPayload<{
  include: {
    themeCategory: true;
    votes: { include: { user: true } };
  };
}>;

/**
 * Props shared by every per-round container component in `DashboardForms`.
 *
 * They all take exactly the active week and the viewer's id; anything else a
 * round needs, it fetches itself.
 */
export interface RoundFormProps {
  week: ActiveWeek;
  currentUserId: string;
}
