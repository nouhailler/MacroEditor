import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const windowsRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(windowsRoot, "package.json");
const packageLockPath = path.join(windowsRoot, "package-lock.json");

function normalizeVersion(rawVersion) {
  const version = String(rawVersion || "").trim().replace(/^v/, "");

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(
      `Invalid version "${rawVersion}". Expected a semantic version such as 0.3.2 or v0.3.2.`,
    );
  }

  return version;
}

async function updateJsonFile(filePath, version) {
  const payload = JSON.parse(await readFile(filePath, "utf8"));
  payload.version = version;

  if (payload.packages?.[""]) {
    payload.packages[""].version = version;
  }

  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const version = normalizeVersion(process.argv[2]);

  if (!version) {
    throw new Error("Missing version argument.");
  }

  await updateJsonFile(packageJsonPath, version);
  await updateJsonFile(packageLockPath, version);

  console.log(`Updated Windows package version to ${version}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
