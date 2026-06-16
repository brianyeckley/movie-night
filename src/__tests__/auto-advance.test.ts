import { vi, describe, it, expect, beforeEach } from "vitest";
import { submitCategoryVoteAction } from "@/app/actions/voting";
import { db } from "@/lib/db";
import { getActiveUser } from "@/app/actions/user";
import { advanceWeekRoundInternal } from "@/app/actions/week";

vi.mock("@/lib/db", () => ({
  db: {
    weekVote: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/app/actions/user", () => ({
  getActiveUser: vi.fn(),
}));

vi.mock("@/app/actions/week", () => ({
  advanceWeekRoundInternal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Category Voting Auto-Advancement Checks", () => {
  const mockUser = { id: "user-1", username: "brian", name: "Brian", passwordHash: "", role: "USER", isApproved: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("For a 3-User Group", () => {
    const mock3Users = [
      { id: "user-1", isApproved: true },
      { id: "user-2", isApproved: true },
      { id: "user-3", isApproved: true },
    ];

    it("does not auto-advance on the 1st vote", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      vi.mocked(db.user.findMany).mockResolvedValueOnce(mock3Users as any);

      // Only 1 vote cast so far
      vi.mocked(db.weekVote.findMany).mockResolvedValueOnce([
        { targetId: "cat-comedy", user: { id: "user-1", isApproved: true } },
      ] as any);

      await submitCategoryVoteAction("week-1", "cat-comedy");

      expect(advanceWeekRoundInternal).not.toHaveBeenCalled();
    });

    it("auto-advances on the 2nd vote if both voted for Comedy", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      vi.mocked(db.user.findMany).mockResolvedValueOnce(mock3Users as any);

      // 2 votes cast, both for Comedy
      vi.mocked(db.weekVote.findMany).mockResolvedValueOnce([
        { targetId: "cat-comedy", user: { id: "user-1", isApproved: true } },
        { targetId: "cat-comedy", user: { id: "user-2", isApproved: true } },
      ] as any);

      await submitCategoryVoteAction("week-1", "cat-comedy");

      expect(advanceWeekRoundInternal).toHaveBeenCalledWith("week-1");
    });
  });

  describe("For a 4-User Group", () => {
    const mock4Users = [
      { id: "user-1", isApproved: true },
      { id: "user-2", isApproved: true },
      { id: "user-3", isApproved: true },
      { id: "user-4", isApproved: true },
    ];

    it("does not auto-advance when votes are tied 1-1 with 2 remaining", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      vi.mocked(db.user.findMany).mockResolvedValueOnce(mock4Users as any);

      vi.mocked(db.weekVote.findMany).mockResolvedValueOnce([
        { targetId: "cat-comedy", user: { id: "user-1", isApproved: true } },
        { targetId: "cat-scifi", user: { id: "user-2", isApproved: true } },
      ] as any);

      await submitCategoryVoteAction("week-1", "cat-comedy");

      expect(advanceWeekRoundInternal).not.toHaveBeenCalled();
    });

    it("does not auto-advance when Comedy leads 2-1 with 1 remaining (tie possible)", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      vi.mocked(db.user.findMany).mockResolvedValueOnce(mock4Users as any);

      vi.mocked(db.weekVote.findMany).mockResolvedValueOnce([
        { targetId: "cat-comedy", user: { id: "user-1", isApproved: true } },
        { targetId: "cat-comedy", user: { id: "user-2", isApproved: true } },
        { targetId: "cat-scifi", user: { id: "user-3", isApproved: true } },
      ] as any);

      await submitCategoryVoteAction("week-1", "cat-comedy");

      expect(advanceWeekRoundInternal).not.toHaveBeenCalled();
    });

    it("auto-advances when Comedy leads 3-0 with 1 remaining (unbeatable)", async () => {
      vi.mocked(getActiveUser).mockResolvedValueOnce(mockUser);
      vi.mocked(db.user.findMany).mockResolvedValueOnce(mock4Users as any);

      vi.mocked(db.weekVote.findMany).mockResolvedValueOnce([
        { targetId: "cat-comedy", user: { id: "user-1", isApproved: true } },
        { targetId: "cat-comedy", user: { id: "user-2", isApproved: true } },
        { targetId: "cat-comedy", user: { id: "user-3", isApproved: true } },
      ] as any);

      await submitCategoryVoteAction("week-1", "cat-comedy");

      expect(advanceWeekRoundInternal).toHaveBeenCalledWith("week-1");
    });
  });
});
