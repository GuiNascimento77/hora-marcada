import { defineConfig } from "drizzle-kit";

const paths = {
  schema: "./src/api/database/schema.ts",
  out: "./drizzle",
};

// A demonstração local usa arquivo SQLite; a prévia usa libSQL/Turso remoto.
// Drizzle Kit exige configurações distintas para cada uma dessas conexões.
export default process.env.DATABASE_URL?.startsWith("file:")
  ? defineConfig({
      ...paths,
      dialect: "sqlite",
      dbCredentials: { url: process.env.DATABASE_URL },
    })
  : defineConfig({
      ...paths,
      dialect: "turso",
      dbCredentials: {
        url: process.env.DATABASE_URL!,
        authToken: process.env.DATABASE_AUTH_TOKEN,
      },
    });
