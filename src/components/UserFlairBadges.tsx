import { Crown, Target, Glasses, Users } from "lucide-react";
import type { UserFlair } from "@/lib/stats";

interface UserFlairBadgesProps {
  flairs?: UserFlair[];
}

export default function UserFlairBadges({ flairs }: UserFlairBadgesProps) {
  if (!flairs || flairs.length === 0) return null;

  return (
    <span className="user-flairs-container" inline-flex="true">
      {flairs.map((flair) => (
        <span
          key={flair.id}
          className={`user-flair-badge flair-${flair.type}`}
          title={flair.description}
          aria-label={flair.description}
        >
          {flair.id === "tastemaker-1" && <Crown size={13} className="inline-icon" />}
          {flair.id === "kingmaker" && <Target size={13} className="inline-icon" />}
          {flair.id === "film-snob" && <Glasses size={13} className="inline-icon" />}
          {flair.id === "duo" && <Users size={13} className="inline-icon" />}
        </span>
      ))}
    </span>
  );
}
