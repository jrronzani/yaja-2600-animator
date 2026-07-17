const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require("electron");

const isMac = process.platform === "darwin";
let dialogState;

function sendMenuCommand(command) {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) win.webContents.send("desktop-menu-command", command);
}

function dialogStatePath() {
  return path.join(app.getPath("userData"), "dialog-state.json");
}

function loadDialogState() {
  if (dialogState) return dialogState;
  try { dialogState = JSON.parse(fs.readFileSync(dialogStatePath(), "utf8")); }
  catch (_error) { dialogState = {}; }
  return dialogState;
}

function saveDialogState() {
  try {
    fs.mkdirSync(path.dirname(dialogStatePath()), { recursive: true });
    fs.writeFileSync(dialogStatePath(), JSON.stringify(loadDialogState(), null, 2), "utf8");
  } catch (error) {
    console.warn("Could not save dialog state:", error);
  }
}

function lastDirectory() {
  const directory = loadDialogState().lastDirectory;
  return directory && fs.existsSync(directory) ? directory : undefined;
}

function rememberPath(filePath) {
  if (!filePath) return;
  loadDialogState().lastDirectory = path.dirname(filePath);
  saveDialogState();
}

function defaultPath(suggestedName = "project.json") {
  return lastDirectory() ? path.join(lastDirectory(), suggestedName) : suggestedName;
}

ipcMain.handle("desktop:open-project-file", async (_event, options = {}) => {
  const result = await dialog.showOpenDialog({
    title: options.title || "Open Animator Project",
    defaultPath: lastDirectory(),
    properties: ["openFile"],
    filters: options.filters || [{ name: "YAJA Animator Projects", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
  const filePath = result.filePaths[0];
  rememberPath(filePath);
  return {
    canceled: false,
    filePath,
    fileName: path.basename(filePath),
    content: await fs.promises.readFile(filePath, "utf8")
  };
});

ipcMain.handle("desktop:save-project-file-as", async (_event, options = {}) => {
  const result = await dialog.showSaveDialog({
    title: options.title || "Save Animator Project As",
    defaultPath: defaultPath(options.suggestedName || "Untitled_Project_yaja2600animator.json"),
    filters: options.filters || [{ name: "YAJA Animator Projects", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.promises.writeFile(result.filePath, options.content || "", "utf8");
  rememberPath(result.filePath);
  return { canceled: false, filePath: result.filePath, fileName: path.basename(result.filePath) };
});

ipcMain.handle("desktop:save-project-file", async (_event, options = {}) => {
  if (!options.filePath) throw new Error("No project path was provided.");
  await fs.promises.writeFile(options.filePath, options.content || "", "utf8");
  rememberPath(options.filePath);
  return { canceled: false, filePath: options.filePath, fileName: path.basename(options.filePath) };
});

ipcMain.handle("desktop:open-file", async (_event, options = {}) => {
  const result = await dialog.showOpenDialog({
    title: options.title || "Open File",
    defaultPath: lastDirectory(),
    properties: ["openFile", ...(options.multiple ? ["multiSelections"] : [])],
    filters: options.filters || [{ name: "All Files", extensions: ["*"] }]
  });
  if (result.canceled || !result.filePaths?.length) return { canceled: true };
  rememberPath(result.filePaths[0]);
  const files = await Promise.all(result.filePaths.map(async filePath => ({
    filePath,
    fileName: path.basename(filePath),
    contentBase64: options.binary ? await fs.promises.readFile(filePath, "base64") : undefined,
    content: options.binary ? undefined : await fs.promises.readFile(filePath, "utf8")
  })));
  return { canceled: false, ...files[0], files };
});

ipcMain.handle("desktop:save-file-as", async (_event, options = {}) => {
  const result = await dialog.showSaveDialog({
    title: options.title || "Save File",
    defaultPath: defaultPath(options.suggestedName || "export.bin"),
    filters: options.filters || [{ name: "All Files", extensions: ["*"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const content = typeof options.contentBase64 === "string"
    ? Buffer.from(options.contentBase64, "base64")
    : options.content || "";
  await fs.promises.writeFile(result.filePath, content);
  rememberPath(result.filePath);
  return { canceled: false, filePath: result.filePath, fileName: path.basename(result.filePath) };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    backgroundColor: "#1f1f1f",
    title: "YAJA 2600 Animator",
    icon: path.join(__dirname, "build", process.platform === "win32" ? "icon.ico" : "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "electron-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    const current = new URL(win.webContents.getURL());
    const next = new URL(url);
    if (current.origin !== next.origin) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  win.once("ready-to-show", () => {
    win.maximize();
    win.show();
  });
}

async function openDocumentation() {
  const candidates = [
    path.join(path.dirname(app.getPath("exe")), "DOCUMENTATION.md"),
    path.resolve(path.dirname(app.getPath("exe")), "..", "..", "..", "DOCUMENTATION.md"),
    path.join(__dirname, "DOCUMENTATION.md")
  ];
  const documentPath = candidates.find(candidate => fs.existsSync(candidate));
  if (documentPath) {
    const error = await shell.openPath(documentPath);
    if (!error) return;
  }
  await dialog.showMessageBox({
    type: "info",
    title: "YAJA 2600 Animator Documentation",
    message: "Open DOCUMENTATION.md from the application folder for the complete user guide."
  });
}

function createAppMenu() {
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: "about" }, { type: "separator" }, { role: "services" },
        { type: "separator" }, { role: "hide" }, { role: "hideOthers" },
        { role: "unhide" }, { type: "separator" }, { role: "quit" }
      ]
    }] : []),
    {
      label: "File",
      submenu: [
        { label: "New Project", accelerator: "CmdOrCtrl+N", click: () => sendMenuCommand("new") },
        { label: "Open Project…", accelerator: "CmdOrCtrl+O", click: () => sendMenuCommand("open") },
        { type: "separator" },
        { label: "Save Project", accelerator: "CmdOrCtrl+S", click: () => sendMenuCommand("save") },
        { label: "Save Project As…", accelerator: "CmdOrCtrl+Shift+S", click: () => sendMenuCommand("save-as") },
        { type: "separator" },
        { label: "Import bB…", click: () => sendMenuCommand("import-bb") },
        { label: "Export bB…", click: () => sendMenuCommand("export-bb") },
        { label: "Export PNG…", click: () => sendMenuCommand("export-png") },
        { label: "Import Reference Images…", click: () => sendMenuCommand("import-reference") },
        { type: "separator" },
        { role: isMac ? "close" : "quit", label: isMac ? "Close Window" : "Exit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", click: () => sendMenuCommand("undo") },
        { label: "Redo", accelerator: isMac ? "Cmd+Shift+Z" : "Ctrl+Y", click: () => sendMenuCommand("redo") },
        { type: "separator" },
        { label: "Cut Selection", accelerator: "CmdOrCtrl+X", click: () => sendMenuCommand("cut") },
        { label: "Copy Selection", accelerator: "CmdOrCtrl+C", click: () => sendMenuCommand("copy") },
        { label: "Paste Selection", accelerator: "CmdOrCtrl+V", click: () => sendMenuCommand("paste") },
        { label: "Clear Selection", accelerator: "Escape", click: () => sendMenuCommand("clear-selection") }
      ]
    },
    {
      label: "Animation",
      submenu: [
        { label: "Play / Stop", click: () => sendMenuCommand("play-toggle") },
        { label: "Toggle Loop", click: () => sendMenuCommand("loop-toggle") },
        { type: "separator" },
        { label: "Add Frame", click: () => sendMenuCommand("add-frame") },
        { label: "Duplicate Selected Frames", click: () => sendMenuCommand("duplicate-frame") },
        { label: "Delete Selected Frames", click: () => sendMenuCommand("delete-frame") },
        { label: "Move Frames Left", click: () => sendMenuCommand("move-frame-left") },
        { label: "Move Frames Right", click: () => sendMenuCommand("move-frame-right") },
        { label: "Reverse Frames", click: () => sendMenuCommand("reverse-frames") }
      ]
    },
    {
      label: "View",
      submenu: [
        { label: "Toggle Grid", click: () => sendMenuCommand("grid-toggle") },
        { label: "Toggle Color Columns", click: () => sendMenuCommand("colors-toggle") },
        { label: "Toggle Onion Skin", click: () => sendMenuCommand("onion-toggle") },
        { type: "separator" },
        { role: "reload" }, { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" }, { role: "zoom" },
        ...(isMac ? [{ type: "separator" }, { role: "front" }] : [{ role: "close" }])
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Documentation",
          click: openDocumentation
        },
        {
          label: "About YAJA 2600 Animator",
          click: () => dialog.showMessageBox({
            type: "info",
            title: "About YAJA 2600 Animator",
            message: "YAJA 2600 Animator",
            detail: "Version 1.0.0\nAtari 2600 sprite animation editor by Nebulords."
          })
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.nebulords.yaja2600animator");
  createAppMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (!isMac) app.quit();
});
