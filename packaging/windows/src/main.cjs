const { app, BrowserWindow, dialog } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let mainWindow = null;
let runningServer = null;

async function startEmbeddedServer() {
  process.env.MACROEDITOR_DATA_DIR = path.join(app.getPath("userData"), "data");

  const runtimeRoot = path.join(__dirname, "..", "runtime");
  const serverEntry = path.join(runtimeRoot, "server", "src", "index.js");
  const staticDir = path.join(runtimeRoot, "web-dist");
  const serverModule = await import(pathToFileURL(serverEntry).href);

  return serverModule.startServer({
    port: 0,
    host: "127.0.0.1",
    enableCors: false,
    staticDir,
  });
}

async function createMainWindow() {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  runningServer = await startEmbeddedServer();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: "MacroEditor",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(runningServer.url);
}

app.whenReady().then(() => {
  createMainWindow().catch((error) => {
    console.error(error);
    dialog.showErrorBox("MacroEditor", `Unable to start MacroEditor.\n\n${error.message}`);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow().catch((error) => {
        console.error(error);
        dialog.showErrorBox("MacroEditor", `Unable to reopen MacroEditor.\n\n${error.message}`);
      });
    }
  });
});

app.on("before-quit", () => {
  if (runningServer?.server) {
    runningServer.server.close();
    runningServer = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
