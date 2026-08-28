"use server";

import { db } from "@/lib/db";
import { getSession, createSession, deleteSession, verifyCaptcha } from "@/lib/session";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Helper to get active user details from the secure session cookie
export async function getActiveUser() {
  const session = await getSession();
  if (!session || !session.userId) return null;

  try {
    const user = await db.user.findUnique({
      where: { id: session.userId as string },
    });
    // Ensure the user exists and is approved to access the app
    if (!user || !user.isApproved) {
      return null;
    }
    return user;
  } catch {
    // Treat a lookup failure the same as "not signed in".
    return null;
  }
}

// 1. Log in a user
export async function loginAction(
  prevState: unknown,
  formData: FormData
) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const rememberMe = formData.get("rememberMe") === "on";

  if (!username || !password) {
    return { error: "Please enter both username and password." };
  }

  try {
    const user = await db.user.findUnique({
      where: { username: username.toLowerCase().trim() },
    });

    if (!user) {
      return { error: "Invalid username or password." };
    }

    if (!user.isApproved) {
      return { error: "Your account is pending admin approval." };
    }

    const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isPasswordValid) {
      return { error: "Invalid username or password." };
    }

    await createSession(user.id, user.role, rememberMe);
  } catch (error) {
    console.error("Login action error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }

  // Redirect to dashboard on successful login
  redirect("/");
}

// 2. Sign up a new user
export async function signupAction(
  prevState: unknown,
  formData: FormData
) {
  const username = formData.get("username") as string;
  const name = formData.get("name") as string;
  const password = formData.get("password") as string;
  const captchaToken = formData.get("captchaToken") as string;
  const captchaAnswer = formData.get("captchaAnswer") as string;

  if (!username || !name || !password || !captchaAnswer) {
    return { error: "All fields are required." };
  }

  const usernameClean = username.toLowerCase().trim();

  // Basic username validation (alphanumeric and underscores)
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(usernameClean)) {
    return { error: "Username can only contain letters, numbers, and underscores." };
  }

  try {
    // Verify the math captcha
    const isCaptchaValid = await verifyCaptcha(captchaToken, captchaAnswer);
    if (!isCaptchaValid) {
      return { error: "Incorrect math answer. Please try again." };
    }

    // Check if the username already exists
    const existingUser = await db.user.findUnique({
      where: { username: usernameClean },
    });
    if (existingUser) {
      return { error: "Username is already taken." };
    }

    // Hash the password and create the pending user
    const passwordHash = bcrypt.hashSync(password, 10);
    await db.user.create({
      data: {
        username: usernameClean,
        name: name.trim(),
        passwordHash,
        role: "USER",
        isApproved: false, // Requires admin approval
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Signup action error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

// 3. Log out a user
export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}

// 4. Toggle User Approval (Admin only)
export async function toggleUserApprovalAction(userId: string) {
  const currentUser = await getActiveUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  if (currentUser.id === userId) {
    throw new Error("You cannot change your own approval status.");
  }

  const targetUser = await db.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    throw new Error("User not found.");
  }

  await db.user.update({
    where: { id: userId },
    data: { isApproved: !targetUser.isApproved },
  });

  revalidatePath("/admin/users");
  revalidatePath("/");
}

// 5. Change User Role (Admin only)
export async function changeUserRoleAction(userId: string, newRole: string) {
  const currentUser = await getActiveUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  if (currentUser.id === userId) {
    throw new Error("You cannot change your own role.");
  }

  if (newRole !== "ADMIN" && newRole !== "USER") {
    throw new Error("Invalid role.");
  }

  await db.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  revalidatePath("/admin/users");
}

// 6. Delete User (Admin only)
export async function deleteUserAction(userId: string) {
  const currentUser = await getActiveUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  if (currentUser.id === userId) {
    throw new Error("You cannot delete your own account.");
  }

  await db.user.delete({
    where: { id: userId },
  });

  revalidatePath("/admin/users");
}

// 7. Change Password
export async function changePasswordAction(
  prevState: unknown,
  formData: FormData
) {
  const currentUser = await getActiveUser();
  if (!currentUser) {
    return { error: "You must be logged in to change your password." };
  }

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All fields are required." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match." };
  }

  const isPasswordValid = bcrypt.compareSync(currentPassword, currentUser.passwordHash);
  if (!isPasswordValid) {
    return { error: "Incorrect current password." };
  }

  try {
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await db.user.update({
      where: { id: currentUser.id },
      data: { passwordHash },
    });
    return { success: true };
  } catch (error) {
    console.error("Change password error:", error);
    return { error: "Failed to update password. Please try again." };
  }
}
