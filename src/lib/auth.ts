/**
 * Authorisation guards for server actions.
 *
 * These live outside `src/app/actions` so they are plain functions rather than
 * exported server actions, and so any action file can reach for them without
 * re-implementing the same preamble.
 */

import { getActiveUser } from "@/app/actions/user";

/** The signed-in, approved user, or throws. */
export async function requireUser() {
  const user = await getActiveUser();
  if (!user) throw new Error("You must pick a user first.");
  return user;
}

/**
 * The signed-in user, or throws unless they are an admin.
 *
 * Use for anything destructive or configuration-changing. Client code should
 * additionally hide the control, but this is the check that actually enforces it.
 */
export async function requireAdmin(action = "do that") {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error(`Unauthorized: Only Admin can ${action}.`);
  }
  return user;
}
