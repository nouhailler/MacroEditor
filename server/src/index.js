import path from "node:path";
import { fileURLToPath } from "node:url";

import { createApp } from "./app.js";
import { initializeStorage } from "./storage.js";

const __filename = fileURLToPath(import.meta.url);

export async function startServer({
  port = Number(process.env.PORT || 4000),
  host = process.env.HOST || "127.0.0.1",
  enableCors = true,
  staticDir = process.env.MACROEDITOR_WEB_DIST || null,
} = {}) {
  await initializeStorage();

  const app = createApp({ enableCors, staticDir });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const address = server.address();
      const resolvedPort =
        typeof address === "object" && address ? address.port : port;
      resolve({
        app,
        host,
        port: resolvedPort,
        server,
        url: `http://${host}:${resolvedPort}`,
      });
    });

    server.on("error", reject);
  });
}

async function main() {
  const { url } = await startServer();
  console.log(`MacroEditor server listening on ${url}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
