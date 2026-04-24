import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const windowsRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(windowsRoot, "..", "..");
const runtimeRoot = path.join(windowsRoot, "runtime");
const runtimeServerRoot = path.join(runtimeRoot, "server");
const runtimeWebRoot = path.join(runtimeRoot, "web-dist");

async function main() {
  await rm(runtimeRoot, { recursive: true, force: true });
  await mkdir(runtimeRoot, { recursive: true });

  await cp(path.join(repositoryRoot, "web", "dist"), runtimeWebRoot, {
    recursive: true,
  });
  await cp(path.join(repositoryRoot, "server", "src"), path.join(runtimeServerRoot, "src"), {
    recursive: true,
  });
  await cp(
    path.join(repositoryRoot, "server", "package.json"),
    path.join(runtimeServerRoot, "package.json"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
