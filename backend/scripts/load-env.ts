import { loadEnvConfig } from "@next/env";

// Match Next.js precedence, including .env.local, for CLI/worker processes too.
if (process.argv.includes("--production") || process.argv[2] === "start") Object.assign(process.env, { NODE_ENV: "production" });
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
