/**
 * The Discord announcement for a finished movie-file upload.
 *
 * The webhook URL is read when the module loads, so each test sets the
 * environment and then imports a fresh copy of it.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: {
    movieNightWeek: { findUnique: vi.fn() },
    movie: { findUnique: vi.fn() },
  },
}));

const WEBHOOK = "https://discord.example/api/webhooks/test";

function weekWithFile(overrides: Record<string, unknown> = {}) {
  return {
    id: "week-1",
    winningMovieId: "movie-1",
    file: {
      id: "file-1",
      originalName: "robot-jox.mkv",
      size: BigInt(2 * 1024 * 1024 * 1024),
      completedAt: new Date(),
      uploadedBy: { name: "Stew" },
    },
    ...overrides,
  };
}

/** The module, loaded with the environment these tests set. */
async function loadNotifier() {
  vi.resetModules();
  return (await import("@/lib/discord")).notifyFileUploaded;
}

/** The single embed the webhook was posted. */
function postedEmbed() {
  const body = JSON.parse(vi.mocked(global.fetch).mock.calls[0][1]!.body as string);
  return body.embeds[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DISCORD_WEBHOOK_URL", WEBHOOK);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://movienight.example");
  global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "" }) as never;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("notifyFileUploaded", () => {
  it("announces the movie, the file, its size and who uploaded it", async () => {
    vi.mocked(db.movieNightWeek.findUnique).mockResolvedValue(weekWithFile() as any);
    vi.mocked(db.movie.findUnique).mockResolvedValue({
      id: "movie-1",
      title: "Robot Jox",
      year: 1989,
      posterUrl: "https://posters.example/robot-jox.jpg",
    } as any);
    const notifyFileUploaded = await loadNotifier();

    await notifyFileUploaded("week-1");

    expect(global.fetch).toHaveBeenCalledWith(WEBHOOK, expect.objectContaining({ method: "POST" }));
    const embed = postedEmbed();
    expect(embed.title).toContain("Uploaded");
    expect(embed.description).toContain("Robot Jox");
    expect(embed.description).toContain("1989");
    expect(embed.description).toContain("https://movienight.example");
    expect(embed.thumbnail).toEqual({ url: "https://posters.example/robot-jox.jpg" });
    expect(embed.fields).toEqual([
      { name: "File", value: "robot-jox.mkv" },
      { name: "Size", value: "2.0 GB", inline: true },
      { name: "Uploaded by", value: "Stew", inline: true },
    ]);
  });

  it("says nothing when the upload never finished", async () => {
    vi.mocked(db.movieNightWeek.findUnique).mockResolvedValue(
      weekWithFile({ file: { ...weekWithFile().file, completedAt: null } }) as any
    );
    const notifyFileUploaded = await loadNotifier();

    await notifyFileUploaded("week-1");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("says nothing when the file was cancelled or replaced", async () => {
    vi.mocked(db.movieNightWeek.findUnique).mockResolvedValue(
      weekWithFile({ file: null }) as any
    );
    const notifyFileUploaded = await loadNotifier();

    await notifyFileUploaded("week-1");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("still announces when the week has no winning movie row to name", async () => {
    vi.mocked(db.movieNightWeek.findUnique).mockResolvedValue(
      weekWithFile({ winningMovieId: null }) as any
    );
    const notifyFileUploaded = await loadNotifier();

    await notifyFileUploaded("week-1");

    expect(db.movie.findUnique).not.toHaveBeenCalled();
    const embed = postedEmbed();
    expect(embed.description).toContain("this week's movie");
    expect(embed.thumbnail).toBeUndefined();
  });

  it("names a movie that has no year or poster", async () => {
    vi.mocked(db.movieNightWeek.findUnique).mockResolvedValue(weekWithFile() as any);
    vi.mocked(db.movie.findUnique).mockResolvedValue({
      id: "movie-1",
      title: "The Street Fighter",
      year: null,
      posterUrl: null,
    } as any);
    const notifyFileUploaded = await loadNotifier();

    await notifyFileUploaded("week-1");

    const embed = postedEmbed();
    expect(embed.description).toContain("The Street Fighter");
    expect(embed.thumbnail).toBeUndefined();
  });

  it("falls back when the uploader's account has since been deleted", async () => {
    vi.mocked(db.movieNightWeek.findUnique).mockResolvedValue(
      weekWithFile({ file: { ...weekWithFile().file, uploadedBy: null } }) as any
    );
    vi.mocked(db.movie.findUnique).mockResolvedValue({ id: "movie-1", title: "Robot Jox" } as any);
    const notifyFileUploaded = await loadNotifier();

    await notifyFileUploaded("week-1");

    expect(postedEmbed().fields).toContainEqual({
      name: "Uploaded by",
      value: "Someone",
      inline: true,
    });
  });

  it("does nothing at all when no webhook is configured", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", "");
    vi.mocked(db.movieNightWeek.findUnique).mockResolvedValue(weekWithFile() as any);
    vi.mocked(db.movie.findUnique).mockResolvedValue({ id: "movie-1", title: "Robot Jox" } as any);
    const notifyFileUploaded = await loadNotifier();

    await notifyFileUploaded("week-1");

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
