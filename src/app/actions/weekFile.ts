"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getActiveUser } from "./user";
import { removeWeekFile } from "@/lib/week-files";

// Uploading and downloading go through /api/weeks/[weekId]/file, since a
// server action would have to hold a whole movie in memory.

// Delete (or cancel the upload of) a week's file: its uploader or an admin.
//
// Returns a result rather than throwing so the reason survives Next's
// production error redaction.
export async function deleteWeekFileAction(
  weekId: string
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getActiveUser();
  if (!currentUser) return { success: false, error: "You must be signed in." };

  const file = await db.weekFile.findUnique({ where: { weekId } });
  if (!file) {
    revalidatePath("/");
    return { success: true };
  }

  if (currentUser.role !== "ADMIN" && file.uploadedById !== currentUser.id) {
    return { success: false, error: "Only an admin or the person who uploaded it can delete this file." };
  }

  await removeWeekFile(weekId);
  revalidatePath("/");
  return { success: true };
}
