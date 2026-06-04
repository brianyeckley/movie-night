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
    <form onSubmit={handleSubmit} style={{ display: "inline" }}>
      <button 
        type="submit" 
        className="btn btn-secondary" 
        style={{ 
          padding: "6px 12px", 
          fontSize: "0.8rem", 
          color: "var(--error)", 
          borderColor: "rgba(239, 68, 68, 0.2)",
          cursor: "pointer"
        }}
      >
        Delete
      </button>
    </form>
  );
}
