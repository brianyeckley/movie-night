import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/cron/remind-votes/route";
import { db } from "@/lib/db";
import { notifyReminder } from "@/lib/discord";

vi.mock("@/lib/db", () => ({
  db: {
    movieNightWeek: {
      findFirst: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/discord", () => ({
  notifyReminder: vi.fn().mockResolvedValue(undefined),
}));

describe("API Cron Reminder - /api/cron/remind-votes", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: "my-test-secret" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("responds with 401 if secret query parameter is missing or incorrect", async () => {
    const request1 = new Request("http://localhost:4000/api/cron/remind-votes");
    const response1 = await GET(request1);
    expect(response1.status).toBe(401);

    const request2 = new Request("http://localhost:4000/api/cron/remind-votes?secret=wrong-secret");
    const response2 = await GET(request2);
    expect(response2.status).toBe(401);
  });

  it("responds with success message if there is no active week", async () => {
    vi.mocked(db.movieNightWeek.findFirst).mockResolvedValueOnce(null);

    const request = new Request("http://localhost:4000/api/cron/remind-votes?secret=my-test-secret");
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toBe("No active voting round in progress.");
  });

  it("sends discord reminders to pending users in CATEGORY_TIEBREAKER_VOTING round", async () => {
    // Mock active week in Category Tiebreaker round
    vi.mocked(db.movieNightWeek.findFirst).mockResolvedValueOnce({
      id: "week-1",
      status: "CATEGORY_TIEBREAKER_VOTING",
      votes: [
        { userId: "user-1", round: "ROUND_1_CATEGORY_TIEBREAKER", user: { id: "user-1", isApproved: true } },
      ],
    } as any);

    // Mock approved users list
    vi.mocked(db.user.findMany).mockResolvedValueOnce([
      { id: "user-1", name: "Brian", isApproved: true },
      { id: "user-2", name: "Stew", isApproved: true },
    ] as any);

    const request = new Request("http://localhost:4000/api/cron/remind-votes?secret=my-test-secret");
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("Reminder sent for pending voters: Stew");

    expect(notifyReminder).toHaveBeenCalledWith("week-1", ["Stew"]);
  });

  it("does not send reminders if everyone has voted", async () => {
    vi.mocked(db.movieNightWeek.findFirst).mockResolvedValueOnce({
      id: "week-1",
      status: "CATEGORY_VOTING",
      votes: [
        { userId: "user-1", round: "ROUND_1_CATEGORY", user: { id: "user-1", isApproved: true } },
        { userId: "user-2", round: "ROUND_1_CATEGORY", user: { id: "user-2", isApproved: true } },
      ],
    } as any);

    vi.mocked(db.user.findMany).mockResolvedValueOnce([
      { id: "user-1", name: "Brian", isApproved: true },
      { id: "user-2", name: "Stew", isApproved: true },
    ] as any);

    const request = new Request("http://localhost:4000/api/cron/remind-votes?secret=my-test-secret");
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toBe("All approved users have already voted.");
    expect(notifyReminder).not.toHaveBeenCalled();
  });
});
