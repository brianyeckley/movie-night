import { db } from "@/lib/db";

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4000";

interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  thumbnail?: { url: string };
  image?: { url: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

export async function sendDiscordPayload(payload: {
  content?: string;
  embeds?: DiscordEmbed[];
}) {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn("DISCORD_WEBHOOK_URL is not configured. Skipping Discord notification.");
    return;
  }

  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed to send Discord webhook: ${res.status} ${text}`);
    }
  } catch (error) {
    console.error("Error sending Discord webhook:", error);
  }
}

// 1. Notify that a new week has started
export async function notifyNewWeek(weekId: string) {
  const week = await db.movieNightWeek.findUnique({
    where: { id: weekId },
    include: { themeCategory: true },
  });
  if (!week) return;

  const weekNum = week.weekNumber;
  const themeName = week.themeCategory?.name || "None";
  const isInPerson = week.isInPerson;
  const initialStatus = isInPerson ? "In Person Voting" : "Category Voting";
  const description = isInPerson
    ? `Voting is now open for **Round 1: In Person Voting** (Physical Media Only).\n\nGo to the website to cast your vote!`
    : `Voting is now open for **Round 1: Category Voting**.\n\nGo to the website to cast your vote!`;

  await sendDiscordPayload({
    embeds: [
      {
        title: isInPerson ? `🎬 In-Person Movie Night Opened! (Week ${weekNum})` : `🎬 New Movie Night Week Opened! (Week ${weekNum})`,
        description,
        url: APP_URL,
        color: isInPerson ? 0xe11d48 : 0x2ecc71, // Rose/Accent for In-Person, Green for standard
        fields: [
          { name: "Theme Category", value: themeName, inline: true },
          { name: "Current Status", value: initialStatus, inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

// 2. Notify when a round is advanced or concluded
export async function notifyRoundAdvanced(
  weekId: string,
  prevStatus: string,
  newStatus: string,
  details: {
    winnerName?: string;
    winnerYear?: number | null;
    winnerPoster?: string | null;
    isRandom?: boolean;
    tiedItems?: string[];
  }
) {
  const week = await db.movieNightWeek.findUnique({
    where: { id: weekId },
  });
  if (!week) return;

  const weekNum = week.weekNumber;
  let title = `🔄 Week ${weekNum}: Round Advanced`;
  let color = 0x3498db; // Blue
  let description = "";
  const fields: { name: string; value: string; inline?: boolean }[] = [];
  let thumbnail: { url: string } | undefined = undefined;

  // Format status names nicely
  const formatStatus = (s: string) => {
    switch (s) {
      case "CATEGORY_VOTING": return "Category Voting";
      case "CATEGORY_TIEBREAKER_VOTING": return "Category Tiebreaker Voting";
      case "MOVIE_VOTING": return "Movie Voting";
      case "SUBCATEGORY_VOTING": return "Subcategory Voting";
      case "SHORTLIST_VOTING": return "Shortlist Voting";
      case "FINAL_VOTING": return "Final Tiebreaker Voting";
      case "IN_PERSON_VOTING": return "In Person Voting";
      case "IN_PERSON_TIEBREAKER": return "In Person Tiebreaker Voting";
      case "IN_PERSON_ROUND_2": return "In Person Round 2 Tiebreaker";
      case "IN_PERSON_ROUND_3": return "In Person Round 3 Final Tiebreaker";
      case "COMPLETED": return "Completed";
      default: return s;
    }
  };

  // Determine what happened in the previous round
  if (prevStatus === "CATEGORY_VOTING") {
    if (newStatus === "CATEGORY_TIEBREAKER_VOTING") {
      description = `**Round 1 (Category Voting)** ended in a tie! The tied categories have advanced to the Category Tiebreaker.`;
      if (details.tiedItems && details.tiedItems.length > 0) {
        fields.push({
          name: "Tied Categories",
          value: details.tiedItems.map(c => `• ${c}`).join("\n"),
        });
      }
    } else if (details.winnerName) {
      description = `**Round 1 (Category Voting)** has concluded!\n\nThe winning theme category is: **${details.winnerName}**${details.isRandom ? " *(selected via random tiebreaker)*" : ""}.`;
    }
  } else if (prevStatus === "CATEGORY_TIEBREAKER_VOTING") {
    if (details.winnerName) {
      description = `**Round 1b (Category Tiebreaker)** has concluded!\n\nThe winning theme category is: **${details.winnerName}**${details.isRandom ? " *(selected via random tiebreaker)*" : ""}.`;
    }
  } else if (prevStatus === "MOVIE_VOTING") {
    if (newStatus === "SUBCATEGORY_VOTING") {
      description = `**Round 2 (Movie Voting)** concluded with a subcategory winning!\n\nThe winning subcategory is: **${details.winnerName}**.`;
    } else if (newStatus === "SHORTLIST_VOTING") {
      description = `**Round 2 (Movie Voting)** ended in a tie! The tied movies have advanced to the Shortlist.`;
      if (details.tiedItems && details.tiedItems.length > 0) {
        fields.push({
          name: "Tied Movies",
          value: details.tiedItems.map(m => `• ${m}`).join("\n"),
        });
      }
    } else if (newStatus === "COMPLETED") {
      title = `🏆 Week ${weekNum}: Winner Selected!`;
      color = 0xf1c40f; // Gold
      description = `**Round 2 (Movie Voting)** concluded with an outright winner!\n\nThe movie for this week is: **${details.winnerName}**` + (details.winnerYear ? ` (${details.winnerYear})` : "") + ".";
      if (details.winnerPoster) {
        thumbnail = { url: details.winnerPoster };
      }
    }
  } else if (prevStatus === "SUBCATEGORY_VOTING") {
    if (newStatus === "COMPLETED") {
      title = `🏆 Week ${weekNum}: Winner Selected!`;
      color = 0xf1c40f; // Gold
      description = `**Round 2b (Subcategory Voting)** concluded with an outright winner!\n\nThe movie for this week is: **${details.winnerName}**` + (details.winnerYear ? ` (${details.winnerYear})` : "") + ".";
      if (details.winnerPoster) {
        thumbnail = { url: details.winnerPoster };
      }
    } else {
      description = `**Round 2b (Subcategory Voting)** has concluded! We are advancing to Shortlist Voting.`;
      if (details.tiedItems && details.tiedItems.length > 0) {
        fields.push({
          name: "Tied Options",
          value: details.tiedItems.map(m => `• ${m}`).join("\n"),
        });
      }
    }
  } else if (prevStatus === "SHORTLIST_VOTING") {
    if (newStatus === "COMPLETED") {
      title = `🏆 Week ${weekNum}: Winner Selected!`;
      color = 0xf1c40f; // Gold
      description = `**Round 3 (Shortlist Voting)** concluded with an outright winner!\n\nThe movie for this week is: **${details.winnerName}**` + (details.winnerYear ? ` (${details.winnerYear})` : "") + ".";
      if (details.winnerPoster) {
        thumbnail = { url: details.winnerPoster };
      }
    } else if (newStatus === "FINAL_VOTING") {
      description = `**Round 3 (Shortlist Voting)** ended in a tie! We are advancing to the Final Tiebreaker.`;
      if (details.tiedItems && details.tiedItems.length > 0) {
        fields.push({
          name: "Tied Movies",
          value: details.tiedItems.map(m => `• ${m}`).join("\n"),
        });
      }
    }
  } else if (prevStatus === "FINAL_VOTING") {
    title = `🏆 Week ${weekNum}: Winner Selected!`;
    color = 0xf1c40f; // Gold
    description = `**Round 4 (Final Tiebreaker)** concluded!\n\nThe movie for this week is: **${details.winnerName}**` + (details.winnerYear ? ` (${details.winnerYear})` : "") + `${details.isRandom ? " *(selected via random tiebreaker)*" : ""}.`;
    if (details.winnerPoster) {
      thumbnail = { url: details.winnerPoster };
    }
  } else if (prevStatus === "IN_PERSON_VOTING") {
    if (newStatus === "IN_PERSON_TIEBREAKER") {
      title = `⚡ Week ${weekNum}: In-Person Voting Tie`;
      color = 0xe11d48; // Rose
      description = `Round 1 ended in a tie. We are advancing to the In-Person Tiebreaker.`;
      if (details.tiedItems && details.tiedItems.length > 0) {
        fields.push({
          name: "Tied Movies",
          value: details.tiedItems.map(m => `• ${m}`).join("\n"),
        });
      }
    } else if (newStatus === "COMPLETED" && details.winnerName) {
      title = `🏆 In-Person Winner Selected! (Week ${weekNum})`;
      color = 0xf1c40f; // Gold
      description = `The winning in-person movie for this week is: **${details.winnerName}**` + (details.winnerYear ? ` (${details.winnerYear})` : "") + ".";
      if (details.winnerPoster) {
        thumbnail = { url: details.winnerPoster };
      }
    }
  } else if (prevStatus === "IN_PERSON_TIEBREAKER") {
    if (newStatus === "IN_PERSON_ROUND_2") {
      title = `⚡ Week ${weekNum}: In-Person Tiebreaker Tie`;
      color = 0xe11d48; // Rose
      description = `Round 1b ended in a tie. We are advancing to a third round with 1 vote among the tied movies.`;
      if (details.tiedItems && details.tiedItems.length > 0) {
        fields.push({
          name: "Tied Movies",
          value: details.tiedItems.map(m => `• ${m}`).join("\n"),
        });
      }
    } else if (newStatus === "COMPLETED" && details.winnerName) {
      title = `🏆 In-Person Winner Selected! (Week ${weekNum})`;
      color = 0xf1c40f; // Gold
      description = `The winning in-person movie for this week is: **${details.winnerName}**` + (details.winnerYear ? ` (${details.winnerYear})` : "") + `${details.isRandom ? " *(selected via random tiebreaker)*" : ""}.`;
      if (details.winnerPoster) {
        thumbnail = { url: details.winnerPoster };
      }
    }
  } else if (prevStatus === "IN_PERSON_ROUND_2") {
    if (newStatus === "IN_PERSON_ROUND_3") {
      title = `⚡ Week ${weekNum}: In-Person Third Round Tie`;
      color = 0xe11d48; // Rose
      description = `Round 2 ended in a tie. Since the remaining movies equals the number of voters, we are advancing to a final voting round of 2 votes each.`;
      if (details.tiedItems && details.tiedItems.length > 0) {
        fields.push({
          name: "Tied Movies",
          value: details.tiedItems.map(m => `• ${m}`).join("\n"),
        });
      }
    } else if (newStatus === "COMPLETED" && details.winnerName) {
      title = `🏆 In-Person Winner Selected! (Week ${weekNum})`;
      color = 0xf1c40f; // Gold
      description = `The winning in-person movie for this week is: **${details.winnerName}**` + (details.winnerYear ? ` (${details.winnerYear})` : "") + `${details.isRandom ? " *(selected via random tiebreaker)*" : ""}.`;
      if (details.winnerPoster) {
        thumbnail = { url: details.winnerPoster };
      }
    }
  } else if (prevStatus === "IN_PERSON_ROUND_3") {
    if (newStatus === "COMPLETED" && details.winnerName) {
      title = `🏆 In-Person Winner Selected! (Week ${weekNum})`;
      color = 0xf1c40f; // Gold
      description = `The winning in-person movie for this week is: **${details.winnerName}**` + (details.winnerYear ? ` (${details.winnerYear})` : "") + `${details.isRandom ? " *(selected via random tiebreaker)*" : ""}.`;
      if (details.winnerPoster) {
        thumbnail = { url: details.winnerPoster };
      }
    }
  }

  // Add information about next round
  if (newStatus !== "COMPLETED") {
    fields.push({
      name: "Next Round",
      value: `**${formatStatus(newStatus)}** is now open!\nGo to the website to cast your vote: ${APP_URL}`,
    });
  } else {
    fields.push({
      name: "Status",
      value: `Week ${weekNum} is now completed! Get ready for movie night! 🍿`,
    });
  }

  await sendDiscordPayload({
    embeds: [
      {
        title,
        description,
        url: APP_URL,
        color,
        fields,
        thumbnail,
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

// 3. Notify reminder for users who haven't voted yet
export async function notifyReminder(weekId: string, pendingVoterNames: string[]) {
  const week = await db.movieNightWeek.findUnique({
    where: { id: weekId },
  });
  if (!week) return;

  const weekNum = week.weekNumber;
  const formatStatus = (s: string) => {
    switch (s) {
      case "CATEGORY_VOTING": return "Category Voting";
      case "MOVIE_VOTING": return "Movie Voting";
      case "SUBCATEGORY_VOTING": return "Subcategory Voting";
      case "SHORTLIST_VOTING": return "Shortlist Voting";
      case "FINAL_VOTING": return "Final Tiebreaker Voting";
      case "IN_PERSON_VOTING": return "In Person Voting";
      case "IN_PERSON_TIEBREAKER": return "In Person Tiebreaker Voting";
      case "IN_PERSON_ROUND_2": return "In Person Round 2 Tiebreaker";
      case "IN_PERSON_ROUND_3": return "In Person Round 3 Final Tiebreaker";
      default: return s;
    }
  };

  const roundName = formatStatus(week.status);

  await sendDiscordPayload({
    content: `🔔 **Movie Night Reminder!** 🎬`,
    embeds: [
      {
        title: `Reminder: Cast Your Votes for Week ${weekNum}!`,
        description: `We are currently in **${roundName}**.\n\n⚠️ **Waiting on votes from:**\n${pendingVoterNames.map(name => `• **${name}**`).join("\n")}\n\nGo to the website to cast your vote: ${APP_URL}`,
        color: 0xe67e22, // Orange/Warning color
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
