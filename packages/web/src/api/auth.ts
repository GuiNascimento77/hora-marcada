import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { runableManagedAuth } from "@runablehq/managed-auth/server";
import { db } from "./database/connection";

const managed = Boolean(process.env.APPLICATION_ID && process.env.VITE_RUNABLE_AUTH_ISSUER);
const website = process.env.WEBSITE_URL;
if (!process.env.BETTER_AUTH_SECRET)
  throw new Error("Configure BETTER_AUTH_SECRET no .env da raiz antes de iniciar.");

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: website,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "sqlite", transaction: true }),
  emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
  // Nunca confiar no Origin enviado para montar a lista: isso aceitaria qualquer site.
  trustedOrigins: [
    ...(website ? [new URL(website).origin] : []),
    ...(process.env.NODE_ENV !== "production"
      ? ["http://localhost:4200", "http://127.0.0.1:4200"]
      : []),
  ],
  advanced: { disableOriginCheck: false, disableCSRFCheck: false },
  user: {
    additionalFields: {
      // input:false impede que alguém se cadastre enviando role:"admin".
      role: { type: "string", defaultValue: "customer", required: true, input: false },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  plugins: managed
    ? runableManagedAuth({
        applicationId: process.env.APPLICATION_ID!,
        issuer: process.env.VITE_RUNABLE_AUTH_ISSUER!,
      })
    : [bearer()],
});
