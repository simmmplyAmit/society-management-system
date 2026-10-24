// Vercel build: apply database migrations, then build the app.
//
// Migrations only run for production deployments. Preview deployments share the project's
// environment variables, so running them there could change the production database from a
// branch that was never merged. If a migration fails the build fails and the previous
// deployment keeps serving traffic.
import { spawnSync } from "node:child_process";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const env = process.env.VERCEL_ENV; // "production" | "preview" | "development" (unset outside Vercel)

if (env === "production") {
  if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
    console.error("Neither DIRECT_URL nor DATABASE_URL is set; cannot run migrations.");
    process.exit(1);
  }
  console.log("Production build: applying database migrations…");
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  console.log(`Skipping database migrations (VERCEL_ENV=${env ?? "unset"}); they only run for production.`);
}

run("npx", ["next", "build"]);
