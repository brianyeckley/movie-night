try {
  require("dotenv").config();
} catch (e) {
  // Ignore if dotenv is not installed (e.g. in runtime container)
}

module.exports = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
};
