"use client";

import { useTransition } from "react";
import { switchUserAction } from "@/app/actions";

interface User {
  id: string;
  name: string;
  role: string;
  username: string;
}

interface UserSwitcherProps {
  users: User[];
  activeUserId: string | null;
}

export default function UserSwitcher({ users, activeUserId }: UserSwitcherProps) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = e.target.value;
    startTransition(async () => {
      await switchUserAction(userId);
    });
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <label
        htmlFor="user-select"
        style={{
          fontSize: "0.85rem",
          color: "var(--text-secondary)",
          fontWeight: 500,
        }}
      >
        Watching As:
      </label>
      <div style={{ position: "relative" }}>
        <select
          id="user-select"
          value={activeUserId || ""}
          onChange={handleChange}
          disabled={isPending}
          style={{
            appearance: "none",
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 32px 8px 12px",
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: "pointer",
            outline: "none",
            transition: "all var(--transition-fast)",
            boxShadow: "var(--shadow-sm)",
          }}
          className="user-select-dropdown"
        >
          <option value="">-- Select Profile --</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} {user.role === "ADMIN" ? "👑 (Admin)" : "🍿"}
            </option>
          ))}
        </select>
        <span
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-secondary)",
            pointerEvents: "none",
            fontSize: "0.8rem",
          }}
        >
          ▼
        </span>
      </div>
      {isPending && (
        <span style={{ fontSize: "0.8rem", color: "var(--primary)" }}>
          Updating...
        </span>
      )}
    </div>
  );
}
