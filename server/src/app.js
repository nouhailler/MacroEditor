import cors from "cors";
import express from "express";
import path from "node:path";

import {
  deleteDocument,
  deleteMacro,
  getDocument,
  getMacro,
  listDocuments,
  listMacros,
  saveDocument,
  saveMacro,
  storageHealth,
} from "./storage.js";

export function createApp({ enableCors = true, staticDir = null } = {}) {
  const app = express();

  if (enableCors) {
    app.use(cors());
  }

  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", async (_request, response) => {
    response.json({
      ok: true,
      storage: await storageHealth(),
    });
  });

  app.get("/api/documents", async (_request, response, next) => {
    try {
      response.json(await listDocuments());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/documents", async (request, response, next) => {
    try {
      const payload = await saveDocument(request.body ?? {});
      response.status(201).json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/documents/:id", async (request, response, next) => {
    try {
      response.json(await getDocument(request.params.id));
    } catch (error) {
      if (error?.code === "ENOENT") {
        response.status(404).json({ error: "Document not found." });
        return;
      }
      next(error);
    }
  });

  app.put("/api/documents/:id", async (request, response, next) => {
    try {
      response.json(
        await saveDocument({
          ...request.body,
          id: request.params.id,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/documents/:id", async (request, response, next) => {
    try {
      await deleteDocument(request.params.id);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/macros", async (_request, response, next) => {
    try {
      response.json(await listMacros());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/macros/:name", async (request, response, next) => {
    try {
      response.json(await getMacro(request.params.name));
    } catch (error) {
      if (error?.code === "ENOENT") {
        response.status(404).json({ error: "Macro not found." });
        return;
      }
      next(error);
    }
  });

  app.put("/api/macros/:name", async (request, response, next) => {
    try {
      response.json(
        await saveMacro({
          name: request.params.name,
          actions: request.body?.actions,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/macros/:name", async (request, response, next) => {
    try {
      await deleteMacro(request.params.name);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  if (staticDir) {
    app.use(express.static(staticDir));
    app.get("*", (request, response, next) => {
      if (request.path.startsWith("/api/")) {
        next();
        return;
      }
      response.sendFile(path.join(staticDir, "index.html"));
    });
  }

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({
      error: error?.message || "Unexpected server error.",
    });
  });

  return app;
}
