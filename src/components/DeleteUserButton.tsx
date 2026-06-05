"use client";

import { deleteUserAction } from "@/app/actions/user";

interface DeleteUserButtonProps {
  userId: string;
  userName: string;
}

export default function DeleteUserButton({ userId, userName }: DeleteUserButtonProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirm(`Are you sure you want to permanently delete user "${userName}"? This action cannot be undone.`)) {
      try {
        await deleteUserAction(userId);
      } catch (error: any) {
        alert(error.message || "Failed to delete user.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="inline">
      <button 
        type="submit" 
        className="btn btn-secondary btn-sm btn-danger-outline"
      >
        Delete
      </button>
    </form>
  );
}
