"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

// Helper to get active user role and id from cookies
export async function getActiveUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("movie_night_user")?.value;
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}

// 1. Switch simulated user
export async function switchUserAction(userId: string) {
  const cookieStore = await cookies();
  if (userId) {
    cookieStore.set("movie_night_user", userId, { path: "/" });
  } else {
    cookieStore.delete("movie_night_user");
  }
  revalidatePath("/");
}
