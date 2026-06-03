import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  let dbStatus = "Checking database connection...";
  let usersCount = 0;
  let movies: any[] = [];

  try {
    // Attempt to query the database and count users
    const users = await db.user.findMany();
    usersCount = users.length;

    // Seed a test user and a movie suggestion if the database is fresh
    if (usersCount === 0) {
      const testUser = await db.user.create({
        data: {
          username: "admin",
          name: "Movie Master",
          avatar: "🍿",
        },
      });
      usersCount = 1;

      await db.movie.create({
        data: {
          title: "Inception",
          description: "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
          releaseYear: 2010,
          suggestedById: testUser.id,
        },
      });
    }

    // Fetch the updated list of movies with their author profile
    movies = await db.movie.findMany({
      include: {
        suggestedBy: true,
      },
    });

    dbStatus = "Connected successfully! SQLite database verified.";
  } catch (error: any) {
    dbStatus = `Database Error: ${error?.message || error}`;
  }

  return (
    <div style={{ padding: "60px 0" }}>
      <main className="container">
        <div className="glass-panel" style={{ padding: "48px", marginBottom: "40px", textAlign: "center" }}>
          <h1 className="text-gradient" style={{ fontSize: "3.5rem", fontWeight: 800, marginBottom: "16px", letterSpacing: "-0.05em" }}>
            🎬 Movie Night
          </h1>
          <p style={{ fontSize: "1.25rem", color: "var(--text-secondary)", marginBottom: "24px", maxWidth: "600px", margin: "0 auto 24px auto" }}>
            Welcome to your movie voting and watch list tracker. Your environment is fully configured and ready for building!
          </p>
          <div
            style={{
              display: "inline-block",
              padding: "10px 20px",
              borderRadius: "var(--radius-full)",
              backgroundColor: dbStatus.includes("Error") ? "var(--accent-light)" : "var(--primary-light)",
              color: dbStatus.includes("Error") ? "var(--accent)" : "var(--primary)",
              fontWeight: 600,
              fontSize: "0.95rem",
              border: "1px solid " + (dbStatus.includes("Error") ? "var(--accent)" : "var(--primary)"),
            }}
          >
            {dbStatus}
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <div className="glass-panel" style={{ padding: "32px" }}>
            <h2 style={{ marginBottom: "20px", fontSize: "1.6rem", fontWeight: 700 }}>Database Integration</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.6" }}>
              This page runs as a **Next.js React Server Component**. It queries the local SQLite file directly via Prisma 7.
            </p>
            <div style={{ marginTop: "24px", padding: "16px", background: "rgba(0, 0, 0, 0.2)", borderRadius: "var(--radius-md)", border: "1px solid var(--glass-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "var(--text-secondary)" }}>Registered Users:</span>
                <strong style={{ color: "var(--text-primary)" }}>{usersCount}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Movies in Pool:</span>
                <strong style={{ color: "var(--text-primary)" }}>{movies.length}</strong>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "32px" }}>
            <h2 style={{ marginBottom: "20px", fontSize: "1.6rem", fontWeight: 700 }}>Active Movie Pool</h2>
            {movies.length === 0 ? (
              <p style={{ color: "var(--text-secondary)" }}>No movies in the pool yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {movies.map((movie) => (
                  <div
                    key={movie.id}
                    style={{
                      padding: "16px",
                      background: "var(--glass-hover)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--glass-border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <h3 style={{ fontSize: "1.15rem", fontWeight: 600 }}>{movie.title}</h3>
                      {movie.releaseYear && <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{movie.releaseYear}</span>}
                    </div>
                    <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>{movie.description}</p>
                    <div style={{ display: "flex", gap: "6px", marginTop: "8px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      <span>Suggested by:</span>
                      <strong style={{ color: "var(--text-secondary)" }}>{movie.suggestedBy.name}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
