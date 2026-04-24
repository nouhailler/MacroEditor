import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = path.resolve(
  process.env.MACROEDITOR_DATA_DIR || path.resolve(__dirname, "..", "data"),
);
const documentsDirectory = path.join(dataDirectory, "documents");
const macrosDirectory = path.join(dataDirectory, "macros");

function sanitizeSegment(value) {
  return String(value)
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "item";
}

function nowIso() {
  return new Date().toISOString();
}

async function ensureDirectory(directory) {
  await mkdir(directory, { recursive: true });
}

async function readJson(filePath) {
  const payload = await readFile(filePath, "utf8");
  return JSON.parse(payload);
}

async function writeJson(filePath, payload) {
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function safeEntries(directory) {
  await ensureDirectory(directory);
  const entries = await readdir(directory, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"));
}

function documentFile(id) {
  return path.join(documentsDirectory, `${sanitizeSegment(id)}.json`);
}

function macroFile(name) {
  return path.join(macrosDirectory, `${sanitizeSegment(name)}.json`);
}

export async function initializeStorage() {
  await ensureDirectory(documentsDirectory);
  await ensureDirectory(macrosDirectory);
}

export async function listDocuments() {
  const entries = await safeEntries(documentsDirectory);
  const documents = await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(documentsDirectory, entry.name);
      const payload = await readJson(filePath);
      return {
        id: payload.id,
        name: payload.name,
        updatedAt: payload.updatedAt,
      };
    }),
  );
  return documents.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getDocument(id) {
  return readJson(documentFile(id));
}

export async function saveDocument({ id, name, content }) {
  const safeName = String(name || "").trim() || "untitled.txt";
  const nextId = id ? sanitizeSegment(id) : `${sanitizeSegment(safeName)}-${Date.now()}`;
  let createdAt = nowIso();
  const target = documentFile(nextId);

  try {
    const existing = await readJson(target);
    createdAt = existing.createdAt || createdAt;
  } catch {
    // New document, keep fresh createdAt.
  }

  const payload = {
    id: nextId,
    name: safeName,
    content: String(content ?? ""),
    createdAt,
    updatedAt: nowIso(),
  };

  await writeJson(target, payload);
  return payload;
}

export async function deleteDocument(id) {
  await rm(documentFile(id), { force: true });
}

export async function listMacros() {
  const entries = await safeEntries(macrosDirectory);
  const macros = await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(macrosDirectory, entry.name);
      const payload = await readJson(filePath);
      return {
        name: payload.name,
        actions: Array.isArray(payload.actions) ? payload.actions : [],
        updatedAt: payload.updatedAt ?? nowIso(),
      };
    }),
  );
  return macros.sort((left, right) => left.name.localeCompare(right.name));
}

export async function getMacro(name) {
  return readJson(macroFile(name));
}

export async function saveMacro({ name, actions }) {
  const safeName = String(name || "").trim() || "macro";
  const target = macroFile(safeName);
  let createdAt = nowIso();

  try {
    const existing = await readJson(target);
    createdAt = existing.createdAt || createdAt;
  } catch {
    // New macro, keep fresh createdAt.
  }

  const payload = {
    name: safeName,
    actions: Array.isArray(actions) ? actions : [],
    createdAt,
    updatedAt: nowIso(),
  };

  await writeJson(target, payload);
  return payload;
}

export async function deleteMacro(name) {
  await rm(macroFile(name), { force: true });
}

export async function storageHealth() {
  const stats = await Promise.all([
    stat(documentsDirectory).catch(() => null),
    stat(macrosDirectory).catch(() => null),
  ]);

  return {
    documentsReady: Boolean(stats[0]),
    macrosReady: Boolean(stats[1]),
  };
}
