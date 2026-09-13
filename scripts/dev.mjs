import { spawn } from "node:child_process";
const args = process.argv.slice(2);
const at = args.indexOf("--port");
const child = spawn(
  "node",
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "0.0.0.0",
    "--port",
    at >= 0 ? args[at + 1] : "4173",
  ],
  { stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
