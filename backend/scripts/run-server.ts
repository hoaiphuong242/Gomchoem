import "./load-env";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const resolve = createRequire(path.join(process.cwd(), "package.json")).resolve;
const mode = process.argv[2] === "start" ? "start" : "dev";
const server = spawn(process.execPath, [resolve("next/dist/bin/next"), mode, ...process.argv.slice(3)], { stdio: "inherit", windowsHide: true });
const worker = spawn(process.execPath, ["--import", "tsx", "scripts/reservation-worker.ts"], { stdio: "inherit", windowsHide: true });
let stopping = false;
function stop(code: number) {
  if (stopping) return;
  stopping = true;
  server.kill(); worker.kill();
  process.exitCode = code;
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
server.on("exit", code => stop(code ?? 1));
worker.on("exit", code => stop(code ?? 1));
for (const child of [server, worker]) child.on("error", () => stop(1));
